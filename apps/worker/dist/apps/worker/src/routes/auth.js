import { createNewUserWithSchema } from '../migrate-schema';
import { generateIdBase62, hashPasswordArgon2id, verifyPasswordHash, randomHex } from '../utils';
import { signSession } from '@quickstage/shared/cookies';
import { getUidFromSession } from '../auth';
import { getUserByName } from '../user';
import { getAnalyticsManager } from '../worker-utils';
import Stripe from 'stripe';
// Authentication route handlers
export async function handleRegister(c) {
    const { email, password, name } = await c.req.json();
    if (!email || !password || !name) {
        return c.json({ error: 'Missing required fields' }, 400);
    }
    try {
        // Check if user already exists
        const existingUser = await getUserByName(c, name);
        if (existingUser) {
            return c.json({ error: 'Username already taken' }, 400);
        }
        // Check if email already exists
        const existingEmail = await c.env.KV_USERS.get(`user:byemail:${email}`);
        if (existingEmail) {
            return c.json({ error: 'Email already registered' }, 400);
        }
        const uid = generateIdBase62(16);
        const hashedPassword = await hashPasswordArgon2id(password, c.env.ARGON2_SALT);
        // Create user with new schema
        const user = createNewUserWithSchema(uid, name, email, 'user', 'free', hashedPassword);
        // Store user data
        await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
        await c.env.KV_USERS.put(`user:byname:${name}`, uid);
        await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
        // Track analytics
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'user_registered', { method: 'email' });
        // Create session
        const sessionToken = await signSession({ uid, name }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
        return c.json({
            ok: true,
            user: { uid, name, email, role: user.role },
            sessionToken: sessionToken
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        return c.json({ error: 'Registration failed' }, 500);
    }
}
export async function handleLogin(c) {
    const { email, password } = await c.req.json();
    if (!email || !password) {
        return c.json({ error: 'Missing email or password' }, 400);
    }
    try {
        const uid = await c.env.KV_USERS.get(`user:byemail:${email}`);
        if (!uid) {
            return c.json({ error: 'Invalid credentials' }, 401);
        }
        const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
        if (!userRaw) {
            return c.json({ error: 'Invalid credentials' }, 401);
        }
        const user = JSON.parse(userRaw);
        if (!user.passwordHash) {
            return c.json({ error: 'Invalid credentials' }, 401);
        }
        const isValid = await verifyPasswordHash(password, user.passwordHash);
        if (!isValid) {
            return c.json({ error: 'Invalid credentials' }, 401);
        }
        // Update last login
        user.lastLoginAt = Date.now();
        user.analytics.lastActiveAt = Date.now();
        await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
        // Track analytics
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'user_login', { method: 'email' });
        // Create session
        const sessionToken = await signSession({ uid, name: user.name }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
        return c.json({
            ok: true,
            user: { uid, name: user.name, email: user.email, role: user.role },
            sessionToken: sessionToken
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return c.json({ error: 'Login failed' }, 500);
    }
}
export async function handleGoogleAuth(c) {
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
                const now = Date.now();
                user = {
                    uid,
                    createdAt: now,
                    updatedAt: now,
                    plan: 'free',
                    role: 'user',
                    status: 'active',
                    subscription: { status: 'none' },
                    analytics: {
                        totalSnapshotsCreated: 0,
                        totalSnapshotsViewed: 0,
                        totalDownloads: 0,
                        totalPageVisits: 0,
                        lastActiveAt: now,
                        sessionCount: 0,
                        averageSessionDuration: 0,
                        totalCommentsPosted: 0,
                        totalCommentsReceived: 0,
                    },
                    onboarding: {
                        hasSeenWelcome: false,
                        completedTutorials: [],
                    },
                    email: email,
                    name: name || `${given_name || ''} ${family_name || ''}`.trim() || 'Google User',
                    googleId: idToken
                };
                await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
                await c.env.KV_USERS.put(`user:byname:${user.name}`, uid);
                await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
                // Track analytics event for new user
                const analytics = getAnalyticsManager(c);
                await analytics.trackEvent(uid, 'user_registered', { method: 'google' });
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
            // Track analytics event for new user
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'user_registered', { method: 'google' });
        }
        // Track analytics event
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'user_login', { method: 'google' });
        // Sign session
        const token = await signSession({ uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
        return c.json({ ok: true, user: { uid, name: user.name, email: user.email, plan: user.plan, role: user.role || 'user' }, sessionToken: token });
    }
    catch (error) {
        console.error('Google OAuth error:', error);
        return c.json({ error: 'authentication_failed' }, 401);
    }
}
export async function handleMe(c) {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ user: null });
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!raw)
        return c.json({ user: null });
    const user = JSON.parse(raw);
    // Track analytics event for page view
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'page_view', { page: 'Settings' });
    // Get subscription status from new schema with fallback to legacy
    const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
    const hasStripe = !!(user.subscription?.stripeCustomerId || user.stripeCustomerId || user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId);
    console.log(`/me endpoint called for user ${uid}:`, {
        subscriptionStatus: subscriptionStatus,
        plan: user.plan,
        hasStripe: hasStripe
    });
    // Fix users who have incorrect trial status without Stripe subscription
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
        await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
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
        await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
        console.log(`Fixed user ${uid}: reset incorrect pro plan to free plan`);
    }
    // Calculate subscription display information
    let subscriptionDisplay = 'Free';
    let trialEndsAt = null;
    let nextBillingDate = null;
    let nextBillingAmount = null;
    let canAccessPro = false;
    console.log(`/me endpoint - User subscription status: "${subscriptionStatus}" (type: ${typeof subscriptionStatus})`);
    console.log(`/me endpoint - User plan: "${user.plan}" (type: ${typeof user.plan})`);
    // Superadmin accounts always have Pro access
    if (user.role === 'superadmin') {
        subscriptionDisplay = 'Pro (Superadmin)';
        canAccessPro = true;
    }
    else if (subscriptionStatus && subscriptionStatus !== 'none') {
        if (subscriptionStatus === 'trial') {
            // Check both new and legacy trial fields
            const trialEnd = user.subscription?.trialEnd || user.trialEndsAt;
            subscriptionDisplay = 'Pro (Trial)';
            canAccessPro = true;
            if (trialEnd) {
                trialEndsAt = trialEnd;
                // For trial users, next billing date is when the trial ends
                nextBillingDate = trialEnd;
            }
            else {
                // If no trial end date is set, try to get it from Stripe or set a default
                const stripeSubscriptionId = user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId;
                if (stripeSubscriptionId) {
                    try {
                        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
                        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
                        if (subscription.trial_end) {
                            trialEndsAt = subscription.trial_end * 1000; // Convert to milliseconds
                            nextBillingDate = trialEndsAt;
                        }
                        // Get the next billing amount for when trial ends
                        if (subscription.items && subscription.items.data.length > 0) {
                            const item = subscription.items.data[0];
                            if (item && item.price && item.price.unit_amount) {
                                nextBillingAmount = item.price.unit_amount; // Amount in cents
                                // If there's a discount/coupon applied, calculate the discounted amount
                                if (subscription.discount && subscription.discount.coupon) {
                                    const coupon = subscription.discount.coupon;
                                    if (coupon.percent_off && nextBillingAmount !== null) {
                                        nextBillingAmount = nextBillingAmount * (100 - coupon.percent_off) / 100;
                                    }
                                    else if (coupon.amount_off && nextBillingAmount !== null) {
                                        nextBillingAmount = Math.max(0, nextBillingAmount - coupon.amount_off);
                                    }
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Failed to fetch Stripe trial end for ${uid}:`, error);
                        // Fallback: assume 7 days from subscription start
                        const subscriptionStartedAt = user.subscription?.currentPeriodStart || user.subscriptionStartedAt;
                        if (subscriptionStartedAt) {
                            trialEndsAt = subscriptionStartedAt + (7 * 24 * 60 * 60 * 1000);
                            nextBillingDate = trialEndsAt;
                        }
                    }
                }
            }
        }
        else if (subscriptionStatus === 'active') {
            subscriptionDisplay = 'Pro';
            canAccessPro = true;
            // If user has a Stripe subscription ID, get billing details from Stripe
            const stripeSubscriptionId = user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId;
            if (stripeSubscriptionId) {
                try {
                    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
                    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
                    if (subscription.current_period_end) {
                        nextBillingDate = subscription.current_period_end * 1000; // Convert to milliseconds
                        // Get the next billing amount from the subscription
                        if (subscription.items && subscription.items.data.length > 0) {
                            const item = subscription.items.data[0];
                            if (item && item.price && item.price.unit_amount) {
                                nextBillingAmount = item.price.unit_amount; // Amount in cents
                                // If there's a discount/coupon applied, calculate the discounted amount
                                if (subscription.discount && subscription.discount.coupon) {
                                    const coupon = subscription.discount.coupon;
                                    if (coupon.percent_off && nextBillingAmount !== null) {
                                        nextBillingAmount = nextBillingAmount * (100 - coupon.percent_off) / 100;
                                    }
                                    else if (coupon.amount_off && nextBillingAmount !== null) {
                                        nextBillingAmount = Math.max(0, nextBillingAmount - coupon.amount_off);
                                    }
                                }
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Failed to fetch Stripe subscription details for ${uid}:`, error);
                    // Fallback to legacy calculation
                    const lastPaymentAt = user.subscription?.lastPaymentAt || user.lastPaymentAt;
                    const subscriptionStartedAt = user.subscription?.currentPeriodStart || user.subscriptionStartedAt;
                    if (lastPaymentAt) {
                        nextBillingDate = lastPaymentAt + (30 * 24 * 60 * 60 * 1000);
                    }
                    else if (subscriptionStartedAt) {
                        nextBillingDate = subscriptionStartedAt + (30 * 24 * 60 * 60 * 1000);
                    }
                }
            }
            else {
                // Fallback to legacy calculation if no Stripe subscription ID
                const lastPaymentAt = user.subscription?.lastPaymentAt || user.lastPaymentAt;
                const subscriptionStartedAt = user.subscription?.currentPeriodStart || user.subscriptionStartedAt;
                if (lastPaymentAt) {
                    nextBillingDate = lastPaymentAt + (30 * 24 * 60 * 60 * 1000);
                }
                else if (subscriptionStartedAt) {
                    nextBillingDate = subscriptionStartedAt + (30 * 24 * 60 * 60 * 1000);
                }
            }
        }
        else if (subscriptionStatus === 'cancelled') {
            subscriptionDisplay = 'Pro (Cancelled)';
            canAccessPro = false;
        }
        else if (subscriptionStatus === 'past_due') {
            subscriptionDisplay = 'Pro (Past Due)';
            canAccessPro = false;
        }
    }
    else {
        // No subscription status or subscriptionStatus is 'none', user is on free plan
        canAccessPro = false;
        subscriptionDisplay = 'Free';
    }
    // Debug: Log what we're about to return
    const responseUser = {
        uid: user.uid,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role || 'user',
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        hasPassword: !!user.passwordHash,
        hasGoogle: !!user.googleId,
        // Subscription information
        subscriptionStatus: subscriptionStatus,
        subscriptionDisplay: subscriptionDisplay,
        trialEndsAt: trialEndsAt,
        nextBillingDate: nextBillingDate,
        nextBillingAmount: nextBillingAmount,
        canAccessPro: canAccessPro,
        stripeCustomerId: user.subscription?.stripeCustomerId || user.stripeCustomerId,
        stripeSubscriptionId: user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId
    };
    console.log(`/me endpoint returning for user ${uid}:`, responseUser);
    // Return safe user data with subscription information
    return c.json({
        user: responseUser
    });
}
export async function handleLogout(c) {
    const uid = await getUidFromSession(c);
    // Track analytics event for logout if user was authenticated
    if (uid) {
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'user_logout', {});
    }
    // No need to clear cookies - just return success
    return c.json({ ok: true });
}
export async function handleProfile(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/auth/profile',
                method: 'PUT'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
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
        // Track analytics event for profile update
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'profile_updated', {
            fieldsUpdated: { name: !!name, email: !!email }
        });
    }
    return c.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
}
export async function handleChangePassword(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/auth/change-password',
                method: 'POST'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
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
    // Track analytics event for password change
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'password_changed', {});
    return c.json({ ok: true });
}
