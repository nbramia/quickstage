import { getUidFromSession, getUidFromPAT } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
import { createNewUserWithSchema } from '../migrate-schema';
import { generateIdBase62, hashPasswordArgon2id, nowMs, randomHex } from '../utils';
import { signSession, generatePassword } from '@quickstage/shared/cookies';
import { DEFAULT_CAPS } from '@quickstage/shared/index';
// API route handlers (duplicate/alternative API endpoints)
export async function handleApiSnapshotExtend(c) {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    const days = Number(body?.days || 1);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'forbidden' }, 403);
    const cap = DEFAULT_CAPS.maxDays;
    const added = Math.min(Math.max(1, days || 1), cap);
    meta.expiresAt += added * 24 * 60 * 60 * 1000;
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    return c.json({ ok: true, expiresAt: meta.expiresAt });
}
export async function handleApiSnapshotExpire(c) {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.param('id');
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'forbidden' }, 403);
    meta.status = 'expired';
    meta.expiresAt = nowMs() - 1000;
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    // Don't remove from index - keep expired snapshots visible when "All" is selected
    return c.json({ ok: true });
}
export async function handleApiSnapshotRotatePassword(c) {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.param('id');
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'forbidden' }, 403);
    const newPass = generatePassword(20);
    const saltHex = randomHex(8);
    meta.passwordHash = await hashPasswordArgon2id(newPass, saltHex);
    meta.password = newPass; // Store plain text password for display
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    return c.json({ password: newPass });
}
export async function handleApiGoogleAuth(c) {
    const { idToken } = await c.req.json();
    if (!idToken)
        return c.json({ error: 'missing_token' }, 400);
    try {
        // For now, we'll use the access token to get user info directly
        // In production, you should verify the ID token properly
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${idToken}`,
            },
        });
        if (!userInfoResponse.ok) {
            return c.json({ error: 'invalid_token' }, 401);
        }
        const userInfo = await userInfoResponse.json();
        const { email, name, given_name, family_name } = userInfo;
        if (!email) {
            return c.json({ error: 'email_required' }, 400);
        }
        // Check if user exists by email
        let uid = await c.env.KV_USERS.get(`user:byemail:${email}`);
        let user;
        if (uid) {
            // User exists, update last login and Google ID
            const raw = await c.env.KV_USERS.get(`user:${uid}`);
            if (raw) {
                user = JSON.parse(raw);
                user.lastLoginAt = Date.now();
                user.googleId = idToken; // Store Google ID for future reference
                if (!user.name && name)
                    user.name = name;
                // Fix users who have incorrect trial status without Stripe subscription - use new schema with fallbacks
                const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
                const hasStripe = !!(user.subscription?.stripeCustomerId || user.stripeCustomerId || user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId);
                if (subscriptionStatus === 'trial' && !hasStripe) {
                    // Update new schema
                    if (user.subscription) {
                        user.subscription.status = 'none';
                    }
                    // Update legacy fields for backward compatibility
                    user.subscriptionStatus = 'none';
                    user.plan = 'free';
                    user.trialEndsAt = undefined;
                    user.subscriptionStartedAt = undefined;
                    console.log(`Fixed user ${uid}: reset incorrect trial status to free plan`);
                }
                // Fix users who have 'pro' plan but no Stripe subscription (except superadmin)
                if (user.plan === 'pro' && !hasStripe && user.role !== 'superadmin') {
                    // Update new schema
                    if (user.subscription) {
                        user.subscription.status = 'none';
                    }
                    // Update legacy fields for backward compatibility
                    user.subscriptionStatus = 'none';
                    user.plan = 'free';
                    user.trialEndsAt = undefined;
                    user.subscriptionStartedAt = undefined;
                    console.log(`Fixed user ${uid}: reset incorrect pro plan to free plan`);
                }
                await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
            }
            else {
                // Fallback: create user if raw data is missing
                uid = generateIdBase62(16);
                user = createNewUserWithSchema(uid, name || `${given_name || ''} ${family_name || ''}`.trim() || 'Google User', email, 'user', 'free', undefined, idToken);
                await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
                await c.env.KV_USERS.put(`user:byname:${user.name}`, uid);
                await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
            }
        }
        else {
            // Create new user
            uid = generateIdBase62(16);
            const displayName = name || `${given_name || ''} ${family_name || ''}`.trim() || 'Google User';
            user = createNewUserWithSchema(uid, displayName, email, 'user', 'free', undefined, idToken);
            await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
            await c.env.KV_USERS.put(`user:byname:${displayName}`, uid);
            await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
        }
        // Sign session
        const token = await signSession({ uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
        return c.json({ ok: true, user: { uid, name: user.name, email: user.email, plan: user.plan, role: user.role || 'user' }, sessionToken: token });
    }
    catch (error) {
        console.error('Google OAuth error:', error);
        return c.json({ error: 'authentication_failed' }, 401);
    }
}
export async function handleApiMe(c) {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    return c.json({ user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan, role: user.role || 'user', createdAt: user.createdAt, lastLoginAt: user.lastLoginAt } });
}
export async function handleApiSnapshotCreate(c) {
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/api/snapshots/create',
                method: 'POST'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    const { expiryDays = 7, public: isPublic = false } = await c.req.json();
    const id = generateIdBase62(16);
    const realPassword = generatePassword(8);
    const saltHex = randomHex(8);
    const passwordHash = await hashPasswordArgon2id(realPassword, saltHex);
    const now = Date.now();
    const expiresAt = now + (expiryDays * 24 * 60 * 60 * 1000);
    const snapshot = {
        id,
        ownerUid: uid,
        createdAt: now,
        expiresAt,
        passwordHash,
        password: realPassword, // Store plain text password for display
        totalBytes: 0,
        files: [],
        views: { m: new Date().toISOString().slice(0, 7).replace('-', ''), n: 0 },
        commentsCount: 0,
        public: Boolean(isPublic),
        caps: DEFAULT_CAPS,
        status: 'uploading',
        gateVersion: 1,
    };
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(snapshot));
    // Add to user's snapshot list
    const listJson = await c.env.KV_USERS.get(`user:${uid}:snapshots`) || '[]';
    const ids = JSON.parse(listJson);
    ids.push(id);
    await c.env.KV_USERS.put(`user:${uid}:snapshots`, JSON.stringify(ids));
    // Track analytics event
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'snapshot_created', {
        snapshotId: id,
        expiryDays: expiryDays || 7,
        isPublic: isPublic || false
    });
    return c.json({ id, password: realPassword });
}
