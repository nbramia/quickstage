import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { CreateSnapshotBodySchema, FinalizeSnapshotBodySchema } from '../../../packages/shared/src/schemas';
import { DEFAULT_CAPS, SESSION_COOKIE_NAME, VIEWER_COOKIE_PREFIX, ALLOW_MIME_PREFIXES } from '../../../packages/shared/src/index';
import { generateIdBase62, hashPasswordArgon2id, verifyPasswordHash, nowMs, randomHex } from './utils';
import { signSession, verifySession, generatePassword } from '../../../packages/shared/src/cookies';
// Passkeys (WebAuthn)
// @ts-ignore
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse, } from '@simplewebauthn/server';
// Billing (Stripe)
// Edge-compatible Stripe client with Fetch + SubtleCrypto providers
// @ts-ignore
import Stripe from 'stripe';
const app = new Hono();
app.use('*', cors({ origin: (origin) => origin || '*', credentials: true }));
function isSecureRequest(c) {
    try {
        const url = new URL(c.req.url);
        if (url.protocol === 'https:')
            return true;
    }
    catch { }
    const xfProto = c.req.header('x-forwarded-proto') || c.req.header('X-Forwarded-Proto');
    return typeof xfProto === 'string' && xfProto.toLowerCase().includes('https');
}
async function getUidFromSession(c) {
    const cookie = getCookie(c, SESSION_COOKIE_NAME);
    let token = cookie;
    if (!token) {
        const auth = c.req.header('authorization') || c.req.header('Authorization');
        if (auth && auth.startsWith('Bearer '))
            token = auth.slice(7);
    }
    if (!token)
        return null;
    const data = await verifySession(token, c.env.SESSION_HMAC_SECRET);
    return data && data.uid ? String(data.uid) : null;
}
async function getUserByName(c, name) {
    const uid = await c.env.KV_USERS.get(`user:byname:${name}`);
    if (!uid)
        return null;
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    return raw ? JSON.parse(raw) : null;
}
async function ensureUserByName(c, name) {
    let user = await getUserByName(c, name);
    if (user)
        return user;
    const uid = generateIdBase62(16);
    user = { uid, createdAt: Date.now(), plan: 'free', passkeys: [] };
    await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
    await c.env.KV_USERS.put(`user:byname:${name}`, uid);
    return user;
}
// Passkey: Register begin
app.post('/auth/register-passkey/begin', async (c) => {
    const { name } = await c.req.json();
    if (!name)
        return c.json({ error: 'name_required' }, 400);
    const user = await ensureUserByName(c, name);
    const options = generateRegistrationOptions({
        rpID: c.env.RP_ID,
        rpName: 'QuickStage',
        userID: user.uid,
        userName: name,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
        excludeCredentials: (user.passkeys || []).map((pk) => ({ id: pk.id, type: 'public-key' })),
    });
    await c.env.KV_USERS.put(`user:${user.uid}:regChallenge`, options.challenge, { expirationTtl: 600 });
    return c.json(options);
});
// Passkey: Register finish
app.post('/auth/register-passkey/finish', async (c) => {
    const { name, response } = await c.req.json();
    if (!name || !response)
        return c.json({ error: 'bad_request' }, 400);
    const user = await getUserByName(c, name);
    if (!user)
        return c.json({ error: 'not_found' }, 404);
    const expectedChallenge = await c.env.KV_USERS.get(`user:${user.uid}:regChallenge`);
    if (!expectedChallenge)
        return c.json({ error: 'challenge_expired' }, 400);
    const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: `${c.env.PUBLIC_BASE_URL}`,
        expectedRPID: c.env.RP_ID,
    });
    if (!verification.verified || !verification.registrationInfo)
        return c.json({ error: 'verify_failed' }, 400);
    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    user.passkeys = user.passkeys || [];
    if (!user.passkeys.find((pk) => pk.id === credentialID)) {
        user.passkeys.push({ id: credentialID, publicKey: credentialPublicKey, counter: counter || 0 });
    }
    user.lastLoginAt = Date.now();
    await c.env.KV_USERS.put(`user:${user.uid}`, JSON.stringify(user));
    const token = await signSession({ uid: user.uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
    setCookie(c, SESSION_COOKIE_NAME, token, { httpOnly: true, secure: isSecureRequest(c), sameSite: 'Lax', maxAge: 60 * 60 * 24 * 7, path: '/' });
    return c.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
});
// Passkey: Login begin
app.post('/auth/login-passkey/begin', async (c) => {
    const { name } = await c.req.json();
    if (!name)
        return c.json({ error: 'name_required' }, 400);
    const user = await getUserByName(c, name);
    if (!user || !user.passkeys || user.passkeys.length === 0)
        return c.json({ error: 'not_found' }, 404);
    const options = generateAuthenticationOptions({
        rpID: c.env.RP_ID,
        userVerification: 'preferred',
        allowCredentials: user.passkeys.map((pk) => ({ id: pk.id, type: 'public-key' })),
    });
    await c.env.KV_USERS.put(`user:${user.uid}:authChallenge`, options.challenge, { expirationTtl: 600 });
    return c.json(options);
});
// Passkey: Login finish
app.post('/auth/login-passkey/finish', async (c) => {
    const { name, response } = await c.req.json();
    if (!name || !response)
        return c.json({ error: 'bad_request' }, 400);
    const user = await getUserByName(c, name);
    if (!user)
        return c.json({ error: 'not_found' }, 404);
    const expectedChallenge = await c.env.KV_USERS.get(`user:${user.uid}:authChallenge`);
    if (!expectedChallenge)
        return c.json({ error: 'challenge_expired' }, 400);
    const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: `${c.env.PUBLIC_BASE_URL}`,
        expectedRPID: c.env.RP_ID,
        authenticator: {
            // Use the first for now; in future map credentialID to stored authenticator
            credentialID: user.passkeys?.[0]?.id,
            credentialPublicKey: user.passkeys?.[0]?.publicKey,
            counter: user.passkeys?.[0]?.counter || 0,
            transports: user.passkeys?.[0]?.transports,
        },
    });
    if (!verification.verified)
        return c.json({ error: 'verify_failed' }, 400);
    user.lastLoginAt = Date.now();
    await c.env.KV_USERS.put(`user:${user.uid}`, JSON.stringify(user));
    const token = await signSession({ uid: user.uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
    setCookie(c, SESSION_COOKIE_NAME, token, { httpOnly: true, secure: isSecureRequest(c), sameSite: 'Lax', maxAge: 60 * 60 * 24 * 7, path: '/' });
    return c.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
});
// Email/Password: Register
app.post('/auth/register', async (c) => {
    const { email, password, name } = await c.req.json();
    if (!email || !password || !name)
        return c.json({ error: 'missing_fields' }, 400);
    // Check if user already exists
    const existingUser = await getUserByName(c, name);
    if (existingUser)
        return c.json({ error: 'user_exists' }, 400);
    // Hash password
    const salt = randomHex(16);
    const hashedPassword = await hashPasswordArgon2id(password, salt);
    // Create user
    const uid = generateIdBase62(16);
    const user = {
        uid,
        createdAt: Date.now(),
        plan: 'free',
        passkeys: [],
        email,
        passwordHash: hashedPassword,
        name
    };
    await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
    await c.env.KV_USERS.put(`user:byname:${name}`, uid);
    await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
    // Sign session
    const token = await signSession({ uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
    setCookie(c, SESSION_COOKIE_NAME, token, { httpOnly: true, secure: isSecureRequest(c), sameSite: 'Lax', maxAge: 60 * 60 * 24 * 7, path: '/' });
    return c.json({ ok: true, user: { uid, name, email, plan: user.plan } });
});
// Email/Password: Login
app.post('/auth/login', async (c) => {
    const { email, password } = await c.req.json();
    if (!email || !password)
        return c.json({ error: 'missing_fields' }, 400);
    // Find user by email
    const uid = await c.env.KV_USERS.get(`user:byemail:${email}`);
    if (!uid)
        return c.json({ error: 'invalid_credentials' }, 401);
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!raw)
        return c.json({ error: 'invalid_credentials' }, 401);
    const user = JSON.parse(raw);
    if (!user.passwordHash)
        return c.json({ error: 'invalid_credentials' }, 401);
    // Verify password
    const isValid = await verifyPasswordHash(password, user.passwordHash);
    if (!isValid)
        return c.json({ error: 'invalid_credentials' }, 401);
    // Update last login
    user.lastLoginAt = Date.now();
    await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
    // Sign session
    const token = await signSession({ uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
    setCookie(c, SESSION_COOKIE_NAME, token, { httpOnly: true, secure: isSecureRequest(c), sameSite: 'Lax', maxAge: 60 * 60 * 24 * 7, path: '/' });
    return c.json({ ok: true, user: { uid, name: user.name, email: user.email, plan: user.plan } });
});
// Google OAuth: Login/Register
app.post('/auth/google', async (c) => {
    const { idToken } = await c.req.json();
    if (!idToken)
        return c.json({ error: 'missing_token' }, 400);
    try {
        // Verify Google ID token with Google's servers
        const verifyResponse = await fetch('https://oauth2.googleapis.com/tokeninfo', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
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
                await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
            }
            else {
                // Fallback: create user if raw data is missing
                uid = generateIdBase62(16);
                user = {
                    uid,
                    createdAt: Date.now(),
                    plan: 'free',
                    passkeys: [],
                    email: email,
                    name: name || `${given_name || ''} ${family_name || ''}`.trim() || 'Google User',
                    googleId: idToken
                };
                await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
                await c.env.KV_USERS.put(`user:byname:${user.name}`, uid);
                await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
            }
        }
        else {
            // Create new user
            uid = generateIdBase62(16);
            const displayName = name || `${given_name || ''} ${family_name || ''}`.trim() || 'Google User';
            user = {
                uid,
                createdAt: Date.now(),
                plan: 'free',
                passkeys: [],
                email: email,
                name: displayName,
                googleId: idToken
            };
            await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
            await c.env.KV_USERS.put(`user:byname:${displayName}`, uid);
            await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
        }
        // Sign session
        const token = await signSession({ uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
        setCookie(c, SESSION_COOKIE_NAME, token, { httpOnly: true, secure: isSecureRequest(c), sameSite: 'Lax', maxAge: 60 * 60 * 24 * 7, path: '/' });
        return c.json({ ok: true, user: { uid, name: user.name, email: user.email, plan: user.plan } });
    }
    catch (error) {
        console.error('Google OAuth error:', error);
        return c.json({ error: 'authentication_failed' }, 401);
    }
});
app.get('/me', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ user: null });
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!raw)
        return c.json({ user: null });
    const user = JSON.parse(raw);
    // Return safe user data (no sensitive info)
    return c.json({
        user: {
            uid: user.uid,
            name: user.name,
            email: user.email,
            plan: user.plan,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
            hasPasskeys: user.passkeys && user.passkeys.length > 0,
            hasPassword: !!user.passwordHash,
            hasGoogle: !!user.googleId
        }
    });
});
// Logout endpoint
app.post('/auth/logout', async (c) => {
    // Clear the session cookie
    setCookie(c, SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        secure: isSecureRequest(c),
        sameSite: 'Lax',
        maxAge: 0,
        path: '/'
    });
    return c.json({ ok: true });
});
// Update user profile
app.put('/auth/profile', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const { name, email } = await c.req.json();
    if (!name && !email)
        return c.json({ error: 'no_changes' }, 400);
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!raw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(raw);
    let updated = false;
    if (name && name !== user.name) {
        // Check if new name is already taken
        const existingUid = await c.env.KV_USERS.get(`user:byname:${name}`);
        if (existingUid && existingUid !== uid) {
            return c.json({ error: 'name_taken' }, 400);
        }
        // Update name mappings
        if (user.name) {
            await c.env.KV_USERS.delete(`user:byname:${user.name}`);
        }
        await c.env.KV_USERS.put(`user:byname:${name}`, uid);
        user.name = name;
        updated = true;
    }
    if (email && email !== user.email) {
        // Check if new email is already taken
        const existingUid = await c.env.KV_USERS.get(`user:byemail:${email}`);
        if (existingUid && existingUid !== uid) {
            return c.json({ error: 'email_taken' }, 400);
        }
        // Update email mappings
        if (user.email) {
            await c.env.KV_USERS.delete(`user:byemail:${user.email}`);
        }
        await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
        user.email = email;
        updated = true;
    }
    if (updated) {
        await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
    }
    return c.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
});
// Change password
app.post('/auth/change-password', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const { currentPassword, newPassword } = await c.req.json();
    if (!currentPassword || !newPassword)
        return c.json({ error: 'missing_fields' }, 400);
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!raw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(raw);
    if (!user.passwordHash)
        return c.json({ error: 'no_password_set' }, 400);
    // Verify current password
    const isValid = await verifyPasswordHash(currentPassword, user.passwordHash);
    if (!isValid)
        return c.json({ error: 'invalid_password' }, 401);
    // Hash new password
    const salt = randomHex(16);
    const hashedPassword = await hashPasswordArgon2id(newPassword, salt);
    // Update password
    user.passwordHash = hashedPassword;
    await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
    return c.json({ ok: true });
});
// Remove passkey
app.delete('/auth/passkeys/:credentialId', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const credentialId = c.req.param('credentialId');
    if (!credentialId)
        return c.json({ error: 'missing_credential_id' }, 400);
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!raw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(raw);
    if (!user.passkeys || user.passkeys.length === 0)
        return c.json({ error: 'no_passkeys' }, 400);
    // Remove the passkey
    user.passkeys = user.passkeys.filter((pk) => pk.id !== credentialId);
    await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
    return c.json({ ok: true, passkeys: user.passkeys });
});
// Billing: checkout
app.post('/billing/checkout', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
    });
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: c.env.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${c.env.PUBLIC_BASE_URL}/?billing=success`,
        cancel_url: `${c.env.PUBLIC_BASE_URL}/?billing=canceled`,
        metadata: { uid },
    });
    return c.json({ url: session.url });
});
// Billing: webhook
app.post('/billing/webhook', async (c) => {
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
        httpClient: Stripe.createFetchHttpClient(),
    });
    const sig = c.req.header('stripe-signature');
    const rawBody = await c.req.text();
    let event;
    try {
        const cryptoProvider = Stripe.createSubtleCryptoProvider();
        event = await stripe.webhooks.constructEventAsync(rawBody, sig, c.env.STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider);
    }
    catch (err) {
        return c.json({ error: 'bad_signature' }, 400);
    }
    if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
        const session = event.data.object;
        const uid = session.metadata?.uid;
        if (uid) {
            const raw = await c.env.KV_USERS.get(`user:${uid}`);
            if (raw) {
                const user = JSON.parse(raw);
                user.plan = 'pro';
                await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
            }
        }
    }
    return c.json({ received: true });
});
// Create snapshot
app.post('/snapshots/create', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const body = await c.req.json();
    const parsed = CreateSnapshotBodySchema.safeParse(body);
    if (!parsed.success)
        return c.json({ error: 'bad_request', details: parsed.error.format() }, 400);
    const { expiryDays = 7, password = null, public: isPublic = false } = parsed.data;
    // Quota: count active snapshots
    const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
    const activeIds = JSON.parse(listJson);
    if (activeIds.length >= 10)
        return c.json({ error: 'quota_exceeded' }, 403);
    const id = generateIdBase62(16);
    const createdAt = nowMs();
    const expiresAt = createdAt + expiryDays * 24 * 60 * 60 * 1000;
    const realPassword = password ?? generatePassword(20);
    const saltHex = randomHex(8);
    const passwordHash = await hashPasswordArgon2id(realPassword, saltHex);
    const meta = {
        id,
        ownerUid: uid,
        createdAt,
        expiresAt,
        passwordHash,
        totalBytes: 0,
        files: [],
        views: { m: new Date().toISOString().slice(0, 7).replace('-', ''), n: 0 },
        commentsCount: 0,
        public: Boolean(isPublic),
        caps: DEFAULT_CAPS,
        status: 'creating',
        gateVersion: 1,
    };
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    return c.json({ id, password: realPassword, expiryDays, caps: DEFAULT_CAPS });
});
// Presign upload URL for direct R2 PUT
app.post('/upload-url', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.query('id');
    const p = c.req.query('path');
    const ct = c.req.query('ct') || 'application/octet-stream';
    const sz = Number(c.req.query('sz') || '0');
    if (!id || !p)
        return c.json({ error: 'bad_request' }, 400);
    if (p.includes('..'))
        return c.json({ error: 'bad_path' }, 400);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'forbidden' }, 403);
    if (sz > meta.caps.maxFile)
        return c.json({ error: 'file_too_large' }, 400);
    if (!ALLOW_MIME_PREFIXES.some((x) => String(ct).startsWith(x)))
        return c.json({ error: 'type_not_allowed' }, 400);
    const { presignR2PutURL } = await import('./s3presign');
    const url = await presignR2PutURL({
        accountId: c.env.R2_ACCOUNT_ID,
        bucket: 'snapshots',
        key: `snap/${id}/${p}`,
        accessKeyId: c.env.R2_ACCESS_KEY_ID,
        secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
        contentType: String(ct),
        expiresSeconds: 600,
    });
    return c.json({ url });
});
// Upload via Worker (streaming) to R2; path query is required
app.put('/upload', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.query('id');
    const p = c.req.query('path');
    const ct = c.req.header('content-type') || 'application/octet-stream';
    const sz = Number(c.req.header('content-length') || '0');
    const h = c.req.query('h') || '';
    if (!id || !p)
        return c.json({ error: 'bad_request' }, 400);
    if (p.includes('..'))
        return c.json({ error: 'bad_path' }, 400);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'forbidden' }, 403);
    if (sz > meta.caps.maxFile)
        return c.json({ error: 'file_too_large' }, 400);
    if (!ALLOW_MIME_PREFIXES.some((p) => ct.startsWith(p)))
        return c.json({ error: 'type_not_allowed' }, 400);
    const objectKey = `snap/${id}/${p}`;
    const body = c.req.raw.body;
    if (!body)
        return c.json({ error: 'no_body' }, 400);
    await c.env.R2_SNAPSHOTS.put(objectKey, body, { httpMetadata: { contentType: ct } });
    return c.json({ ok: true });
});
// Finalize snapshot
app.post('/snapshots/finalize', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const body = await c.req.json();
    const parsed = FinalizeSnapshotBodySchema.safeParse(body);
    if (!parsed.success)
        return c.json({ error: 'bad_request', details: parsed.error.format() }, 400);
    const { id, totalBytes, files } = parsed.data;
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'forbidden' }, 403);
    if (totalBytes > meta.caps.maxBytes)
        return c.json({ error: 'bundle_too_large' }, 400);
    meta.totalBytes = totalBytes;
    meta.files = files;
    meta.status = 'active';
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    // Append to user index
    const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
    const ids = JSON.parse(listJson);
    ids.unshift(id);
    await c.env.KV_USERS.put(`user:${uid}:snapshots`, JSON.stringify(ids.slice(0, 100)));
    return c.json({ url: `${c.env.PUBLIC_BASE_URL}/s/${id}`, password: 'hidden' });
});
// List snapshots (compact)
app.get('/snapshots/list', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
    const ids = JSON.parse(listJson);
    const metas = await Promise.all(ids.map(async (id) => JSON.parse((await c.env.KV_SNAPS.get(`snap:${id}`)) || '{}')));
    return c.json({ snapshots: metas.map((m) => ({ id: m.id, createdAt: m.createdAt, expiresAt: m.expiresAt, totalBytes: m.totalBytes, status: m.status })) });
});
// Get individual snapshot details
app.get('/snapshots/:id', async (c) => {
    const id = c.req.param('id');
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.status === 'expired' || meta.expiresAt < nowMs()) {
        return c.json({ error: 'gone' }, 410);
    }
    // Check if user is authenticated and owns this snapshot
    const uid = await getUidFromSession(c);
    if (uid && meta.ownerUid === uid) {
        // Owner can see full details
        return c.json({ snapshot: meta });
    }
    // For non-owners, check if public or password protected
    if (meta.public) {
        // Public snapshots can be viewed without authentication
        return c.json({ snapshot: meta });
    }
    else {
        // Password protected snapshots require authentication
        return c.json({ error: 'unauthorized' }, 401);
    }
});
// Expire
app.post('/snapshots/:id/expire', async (c) => {
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
    // remove from index
    const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
    const ids = JSON.parse(listJson).filter((x) => x !== id);
    await c.env.KV_USERS.put(`user:${uid}:snapshots`, JSON.stringify(ids));
    return c.json({ ok: true });
});
// Extend
app.post('/snapshots/:id/extend', async (c) => {
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
});
// Rotate password
app.post('/snapshots/:id/rotate-password', async (c) => {
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
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    return c.json({ password: newPass });
});
// Serve viewer shell (redirect to Pages handled app) or simple shell
app.get('/s/:id', async (c) => {
    const id = c.req.param('id');
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'gone' }, 410);
    const meta = JSON.parse(metaRaw);
    if (meta.status === 'expired' || meta.expiresAt < nowMs())
        return c.json({ error: 'gone' }, 410);
    // Let Pages app handle viewer route
    return c.redirect(`${c.env.PUBLIC_BASE_URL}/app/s/${id}`);
});
// Asset serving with password gate
app.get('/s/:id/*', async (c) => {
    const id = c.req.param('id');
    const path = c.req.param('*') || '';
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.text('Gone', 410);
    const meta = JSON.parse(metaRaw);
    if (meta.status === 'expired' || meta.expiresAt < nowMs())
        return c.text('Gone', 410);
    if (!meta.public) {
        const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (!gateCookie || gateCookie !== 'ok')
            return c.json({ error: 'unauthorized' }, 401);
    }
    const r2obj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/${path}`);
    if (!r2obj) {
        // SPA fallback
        const indexObj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/index.html`);
        if (indexObj) {
            const headers = {
                'Cache-Control': 'no-cache',
                'Content-Type': 'text/html; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
                'Referrer-Policy': 'no-referrer',
                'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
            };
            return new Response(indexObj.body, { headers });
        }
        return c.text('Not found', 404);
    }
    const headers = {
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
    const ct = r2obj.httpMetadata?.contentType;
    if (ct)
        headers['Content-Type'] = ct;
    return new Response(r2obj.body, { headers });
});
// Gate
app.post('/s/:id/gate', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const password = String(body?.password || '');
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    const ok = await verifyPasswordHash(password, meta.passwordHash);
    if (!ok)
        return c.json({ error: 'forbidden' }, 403);
    setCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`, 'ok', {
        secure: isSecureRequest(c),
        sameSite: 'Lax',
        path: `/s/${id}`,
        maxAge: 60 * 60,
    });
    return c.json({ ok: true });
});
// Snapshot comments endpoints
app.get('/api/snapshots/:id/comments', async (c) => {
    const id = c.req.param('id');
    if (!id)
        return c.json({ error: 'bad_request' }, 400);
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(id));
    const res = await stub.fetch(new URL(`/comments?id=${encodeURIComponent(id)}`, 'http://do').toString());
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
});
// Get comments for a snapshot (public endpoint)
app.get('/comments/:snapshotId', async (c) => {
    const snapshotId = c.req.param('snapshotId');
    if (!snapshotId)
        return c.json({ error: 'bad_request' }, 400);
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(snapshotId));
    const res = await stub.fetch(new URL(`/comments?id=${encodeURIComponent(snapshotId)}`, 'http://do').toString());
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
});
app.post('/api/snapshots/:id/comments', async (c) => {
    const id = c.req.param('id');
    if (!id)
        return c.json({ error: 'bad_request' }, 400);
    const body = await c.req.json();
    if (!body || !body.text)
        return c.json({ error: 'bad_request' }, 400);
    // Turnstile verification
    const token = body.turnstileToken || '';
    if (!token)
        return c.json({ error: 'turnstile_required' }, 400);
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson.success)
        return c.json({ error: 'turnstile_failed' }, 403);
    // Get user info for author
    const uid = await getUidFromSession(c);
    const author = uid ? `User-${uid.slice(0, 8)}` : 'Anonymous';
    const commentData = {
        text: body.text,
        file: body.file,
        line: body.line,
        author: author
    };
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(id));
    const res = await stub.fetch('http://do/comments', {
        method: 'POST',
        body: JSON.stringify(commentData),
        headers: { 'Content-Type': 'application/json' }
    });
    // Increment comments count
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (metaRaw) {
        try {
            const meta = JSON.parse(metaRaw);
            meta.commentsCount = (meta.commentsCount || 0) + 1;
            await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
        }
        catch { }
    }
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
});
// Legacy comments endpoints for backward compatibility
app.get('/comments', async (c) => {
    const id = c.req.query('id');
    if (!id)
        return c.json({ error: 'bad_request' }, 400);
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(id));
    const res = await stub.fetch(new URL(`/comments?id=${encodeURIComponent(id)}`, 'http://do').toString());
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
});
app.post('/comments', async (c) => {
    const body = await c.req.json();
    if (!body || !body.id || !body.text)
        return c.json({ error: 'bad_request' }, 400);
    // Turnstile verification
    const token = c.req.header('cf-turnstile-token') || c.req.header('x-turnstile-token') || '';
    if (!token)
        return c.json({ error: 'turnstile_required' }, 400);
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson.success)
        return c.json({ error: 'turnstile_failed' }, 403);
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(body.id));
    const res = await stub.fetch('http://do/comments', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    // Increment comments count eventually
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${body.id}`);
    if (metaRaw) {
        try {
            const meta = JSON.parse(metaRaw);
            meta.commentsCount = (meta.commentsCount || 0) + 1;
            await c.env.KV_SNAPS.put(`snap:${body.id}`, JSON.stringify(meta));
        }
        catch { }
    }
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
});
// Cron purge
app.get('/admin/purge-expired', async (c) => {
    // This route will be bound to CRON; iterate KV list
    // Cloudflare KV list requires pagination; for MVP, skip and rely on manual
    return c.json({ ok: true });
});
async function purgeExpired(env) {
    let cursor = undefined;
    do {
        const list = await env.KV_SNAPS.list({ prefix: 'snap:', cursor });
        cursor = list.cursor;
        for (const k of list.keys) {
            const metaRaw = await env.KV_SNAPS.get(k.name);
            if (!metaRaw)
                continue;
            try {
                const meta = JSON.parse(metaRaw);
                if (meta.expiresAt && meta.expiresAt < Date.now()) {
                    // delete R2 objects under snap/id/
                    const id = meta.id;
                    let r2cursor = undefined;
                    do {
                        const objs = await env.R2_SNAPSHOTS.list({ prefix: `snap/${id}/`, cursor: r2cursor });
                        r2cursor = objs.cursor;
                        if (objs.objects.length) {
                            await env.R2_SNAPSHOTS.delete(objs.objects.map((o) => o.key));
                        }
                    } while (r2cursor);
                    await env.KV_SNAPS.delete(k.name);
                    if (meta.ownerUid) {
                        const listJson = (await env.KV_USERS.get(`user:${meta.ownerUid}:snapshots`)) || '[]';
                        const ids = JSON.parse(listJson).filter((x) => x !== id);
                        await env.KV_USERS.put(`user:${meta.ownerUid}:snapshots`, JSON.stringify(ids));
                    }
                }
            }
            catch { }
        }
    } while (cursor);
}
const worker = {
    fetch: app.fetch,
    scheduled: async (_event, env) => {
        await purgeExpired(env);
    },
};
export default worker;
export { CommentsRoom } from './comments';
