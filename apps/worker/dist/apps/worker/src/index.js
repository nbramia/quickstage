import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { CreateSnapshotBodySchema, FinalizeSnapshotBodySchema } from '../../../packages/shared/src/schemas';
import { DEFAULT_CAPS, SESSION_COOKIE_NAME, VIEWER_COOKIE_PREFIX, ALLOW_MIME_PREFIXES } from '../../../packages/shared/src/index';
import { generateIdBase62, hashPasswordArgon2id, verifyPasswordHash, nowMs, randomHex } from './utils';
import { signSession, verifySession, generatePassword } from '../../../packages/shared/src/cookies';
import { presignR2PutURL } from './s3presign';
import { getExtensionVersion } from './version-info';
// Passkeys (WebAuthn)
// @ts-ignore
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse, } from '@simplewebauthn/server';
// Billing (Stripe)
// Edge-compatible Stripe client with Fetch + SubtleCrypto providers
// @ts-ignore
import Stripe from 'stripe';
const app = new Hono();
app.use('*', cors({
    origin: (origin) => {
        // Allow requests from quickstage.tech and localhost
        if (!origin)
            return '*';
        if (origin.includes('quickstage.tech') || origin.includes('localhost'))
            return origin;
        return false;
    },
    credentials: true
}));
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
    setCookie(c, SESSION_COOKIE_NAME, '', { httpOnly: true, secure: isSecureRequest(c), sameSite: 'Lax', maxAge: 0, path: '/' });
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
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
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
    // Add retry logic for KV read operations
    const maxRetriesRead = 3;
    let retryCountRead = 0;
    while (retryCountRead < maxRetriesRead) {
        try {
            const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
            const activeIds = JSON.parse(listJson);
            if (activeIds.length >= 10)
                return c.json({ error: 'quota_exceeded' }, 403);
            break; // Success, exit retry loop
        }
        catch (error) {
            retryCountRead++;
            if (error.message?.includes('429') && retryCountRead < maxRetriesRead) {
                console.log(`KV read failed with 429, retrying (${retryCountRead}/${maxRetriesRead})...`);
                // Wait with exponential backoff: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCountRead - 1) * 1000));
                continue;
            }
            throw error; // Re-throw if max retries reached or non-429 error
        }
    }
    const id = generateIdBase62(16);
    const createdAt = nowMs();
    const expiresAt = createdAt + expiryDays * 24 * 60 * 60 * 1000;
    const realPassword = password ?? generatePassword(20);
    const saltHex = randomHex(8);
    const passwordHash = await hashPasswordArgon2id(realPassword, saltHex);
    console.log('Creating snapshot with caps:', DEFAULT_CAPS);
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
    console.log('Snapshot metadata to store:', JSON.stringify(meta, null, 2));
    // Add retry logic for KV operations to handle rate limiting
    const maxRetriesCreate = 3;
    let retryCountCreate = 0;
    while (retryCountCreate < maxRetriesCreate) {
        try {
            await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
            break; // Success, exit retry loop
        }
        catch (error) {
            retryCountCreate++;
            if (error.message?.includes('429') && retryCountCreate < maxRetriesCreate) {
                console.log(`KV write failed with 429, retrying (${retryCountCreate}/${maxRetriesCreate})...`);
                // Wait with exponential backoff: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCountCreate - 1) * 1000));
                continue;
            }
            throw error; // Re-throw if max retries reached or non-429 error
        }
    }
    return c.json({ id, password: realPassword, expiryDays, caps: DEFAULT_CAPS });
});
// Presign upload URL for direct R2 PUT
app.post('/upload-url', async (c) => {
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
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
    // Defensive check for caps property
    if (!meta.caps || typeof meta.caps !== 'object') {
        console.error('Missing or invalid caps in snapshot metadata:', { id: meta.id, caps: meta.caps });
        // Fallback to default caps if missing
        meta.caps = {
            maxBytes: 20 * 1024 * 1024,
            maxFile: 5 * 1024 * 1024,
            maxDays: 14,
        };
        console.log('Applied fallback caps:', meta.caps);
    }
    if (sz > meta.caps.maxFile)
        return c.json({ error: 'file_too_large' }, 400);
    if (!ALLOW_MIME_PREFIXES.some((x) => String(ct).startsWith(x)))
        return c.json({ error: 'type_not_allowed' }, 400);
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
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
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
    // Defensive check for caps property
    if (!meta.caps || typeof meta.caps !== 'object') {
        console.error('Missing or invalid caps in snapshot metadata:', { id: meta.id, caps: meta.caps });
        // Fallback to default caps if missing
        meta.caps = {
            maxBytes: 20 * 1024 * 1024,
            maxFile: 5 * 1024 * 1024,
            maxDays: 14,
        };
        console.log('Applied fallback caps:', meta.caps);
    }
    if (sz > meta.caps.maxFile)
        return c.json({ error: 'file_too_large' }, 400);
    if (!ALLOW_MIME_PREFIXES.some((prefix) => ct.startsWith(prefix)))
        return c.json({ error: 'type_not_allowed' }, 400);
    const objectKey = `snap/${id}/${p}`;
    const body = c.req.raw.body;
    if (!body)
        return c.json({ error: 'no_body' }, 400);
    try {
        await c.env.R2_SNAPSHOTS.put(objectKey, body, { httpMetadata: { contentType: ct } });
        return c.json({ ok: true });
    }
    catch (error) {
        console.error('R2 upload failed:', error);
        return c.json({ error: 'upload_failed', details: String(error) }, 500);
    }
});
// API version of upload endpoint for extension
app.put('/api/upload', async (c) => {
    try {
        console.log('API upload endpoint called');
        let uid = await getUidFromSession(c);
        if (!uid) {
            // Try PAT authentication as fallback
            const authHeader = c.req.header('authorization') || c.req.header('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.slice(7);
                uid = await getUidFromPAT(c, token);
            }
        }
        if (!uid)
            return c.json({ error: 'unauthorized' }, 401);
        const id = c.req.query('id');
        const p = c.req.query('path');
        const ct = c.req.header('content-type') || 'application/octet-stream';
        const sz = Number(c.req.header('content-length') || '0');
        const h = c.req.query('h') || '';
        console.log('Upload params:', { id, path: p, contentType: ct, size: sz });
        if (!id || !p)
            return c.json({ error: 'bad_request', details: 'Missing id or path' }, 400);
        if (p.includes('..'))
            return c.json({ error: 'bad_path', details: 'Path contains invalid characters' }, 400);
        const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
        if (!metaRaw)
            return c.json({ error: 'not_found', details: 'Snapshot not found' }, 404);
        console.log('Raw snapshot data from KV:', metaRaw);
        const meta = JSON.parse(metaRaw);
        console.log('Parsed snapshot meta:', { id: meta.id, ownerUid: meta.ownerUid, caps: meta.caps, hasCaps: !!meta.caps, capsType: typeof meta.caps });
        if (meta.ownerUid !== uid)
            return c.json({ error: 'forbidden', details: 'Not owner of snapshot' }, 403);
        // Defensive check for caps property
        if (!meta.caps || typeof meta.caps !== 'object') {
            console.error('Missing or invalid caps in snapshot metadata:', { id: meta.id, caps: meta.caps });
            // Fallback to default caps if missing
            meta.caps = {
                maxBytes: 20 * 1024 * 1024,
                maxFile: 5 * 1024 * 1024,
                maxDays: 14,
            };
            console.log('Applied fallback caps:', meta.caps);
        }
        if (sz > meta.caps.maxFile)
            return c.json({ error: 'file_too_large', details: `File size ${sz} exceeds limit ${meta.caps.maxFile}` }, 400);
        if (!ALLOW_MIME_PREFIXES.some((prefix) => ct.startsWith(prefix)))
            return c.json({ error: 'type_not_allowed', details: `Content type ${ct} not allowed` }, 400);
        const objectKey = `snap/${id}/${p}`;
        const body = c.req.raw.body;
        if (!body)
            return c.json({ error: 'no_body', details: 'No request body' }, 400);
        console.log('Attempting R2 upload to:', objectKey);
        try {
            await c.env.R2_SNAPSHOTS.put(objectKey, body, { httpMetadata: { contentType: ct } });
            console.log('R2 upload successful');
            return c.json({ ok: true });
        }
        catch (error) {
            console.error('R2 upload failed:', error);
            return c.json({ error: 'upload_failed', details: String(error) }, 500);
        }
    }
    catch (error) {
        console.error('Unexpected error in upload endpoint:', error);
        return c.json({ error: 'internal_error', details: String(error) }, 500);
    }
});
// Finalize snapshot
app.post('/snapshots/finalize', async (c) => {
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
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
    // Normalize file metadata shape for the viewer
    const normalizedFiles = (files || []).map((f) => ({
        name: f.name || f.p,
        size: typeof f.size === 'number' ? f.size : Number(f.sz || 0),
        type: f.type || f.ct || 'application/octet-stream',
        hash: f.hash || f.h,
    }));
    meta.totalBytes = typeof totalBytes === 'number' ? totalBytes : Number(totalBytes || 0);
    meta.files = normalizedFiles;
    meta.status = 'active';
    // Add retry logic for KV operations to handle rate limiting
    const maxRetriesWrite = 3;
    let retryCountWrite = 0;
    while (retryCountWrite < maxRetriesWrite) {
        try {
            await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
            break; // Success, exit retry loop
        }
        catch (error) {
            retryCountWrite++;
            if (error.message?.includes('429') && retryCountWrite < maxRetriesWrite) {
                console.log(`KV write failed with 429, retrying (${retryCountWrite}/${maxRetriesWrite})...`);
                // Wait with exponential backoff: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCountWrite - 1) * 1000));
                continue;
            }
            throw error; // Re-throw if max retries reached or non-429 error
        }
    }
    // Append to user index with retry logic
    const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
    const ids = JSON.parse(listJson);
    ids.unshift(id);
    retryCountWrite = 0;
    while (retryCountWrite < maxRetriesWrite) {
        try {
            await c.env.KV_USERS.put(`user:${uid}:snapshots`, JSON.stringify(ids.slice(0, 100)));
            break; // Success, exit retry loop
        }
        catch (error) {
            retryCountWrite++;
            if (error.message?.includes('429') && retryCountWrite < maxRetriesWrite) {
                console.log(`KV write failed with 429, retrying (${retryCountWrite}/${maxRetriesWrite})...`);
                // Wait with exponential backoff: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCountWrite - 1) * 1000));
                continue;
            }
            throw error; // Re-throw if max retries reached or non-429 error
        }
    }
    return c.json({ url: `${c.env.PUBLIC_BASE_URL}/s/${id}`, password: 'hidden' });
});
// Add /snapshots/list route BEFORE /snapshots/:id to avoid conflicts
app.get('/snapshots/list', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
    const ids = JSON.parse(listJson);
    const metas = await Promise.all(ids.map(async (id) => JSON.parse((await c.env.KV_SNAPS.get(`snap:${id}`)) || '{}')));
    // Sort snapshots by createdAt in descending order (newest first)
    const sortedMetas = metas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return c.json({ snapshots: sortedMetas.map((m) => ({
            id: m.id,
            createdAt: m.createdAt,
            expiresAt: m.expiresAt,
            totalBytes: m.totalBytes,
            status: m.status,
            password: m.password || null,
            public: m.public || false
        })) });
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
    // Normalize legacy file entries for viewer compatibility
    if (Array.isArray(meta.files)) {
        meta.files = meta.files.map((f) => ({
            name: f?.name || f?.p || '',
            size: typeof f?.size === 'number' ? f.size : Number(f?.sz || 0),
            type: f?.type || f?.ct || 'application/octet-stream',
            hash: f?.hash || f?.h,
        }));
    }
    else {
        meta.files = [];
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
// Add /api/snapshots/list route BEFORE the /api/snapshots/:id route to avoid conflicts
app.get('/api/snapshots/list', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const listJson = await c.env.KV_USERS.get(`user:${uid}:snapshots`) || '[]';
    const ids = JSON.parse(listJson);
    const snapshots = [];
    for (const id of ids) {
        const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
        if (metaRaw) {
            try {
                const meta = JSON.parse(metaRaw);
                if (meta.expiresAt && meta.expiresAt > Date.now()) {
                    snapshots.push({
                        id: meta.id,
                        name: meta.name || `Snapshot ${meta.id.slice(0, 8)}`,
                        createdAt: meta.createdAt,
                        expiresAt: meta.expiresAt,
                        password: meta.password,
                        isPublic: meta.isPublic || false,
                        viewCount: meta.viewCount || 0
                    });
                }
            }
            catch { }
        }
    }
    return c.json({ data: { snapshots } });
});
// API version of snapshot details endpoint (for Viewer component)
app.get('/api/snapshots/:id', async (c) => {
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
// Main snapshot page route - serves the app's index.html (MUST come FIRST)
app.get('/s/:id', async (c) => {
    const id = c.req.param('id');
    console.log(`🔍 Worker: /s/:id route hit - id: ${id}`);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.text('Snapshot not found', 404);
    const meta = JSON.parse(metaRaw);
    if (meta.status === 'expired' || meta.expiresAt < nowMs()) {
        return c.text('Snapshot expired', 410);
    }
    // Check if password protected
    if (!meta.public) {
        const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (!gateCookie || gateCookie !== 'ok') {
            // Serve a password prompt page instead of 401
            const passwordPromptHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enter Password - QuickStage</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
        h1 { margin: 0 0 1rem 0; font-size: 1.5rem; color: #333; text-align: center; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555; }
        input[type="password"] { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
        button { width: 100%; padding: 0.75rem; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
        button:hover { background: #0056b3; }
        .error { color: #dc3545; margin-top: 0.5rem; font-size: 0.875rem; }
        .footer { text-align: center; margin-top: 1rem; font-size: 0.875rem; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 Password Required</h1>
        <form onsubmit="submitPassword(event)">
            <div class="form-group">
                <label for="password">Enter the password to view this snapshot:</label>
                <input type="password" id="password" name="password" required autofocus>
            </div>
            <button type="submit">Access Snapshot</button>
            <div id="error" class="error" style="display: none;"></div>
        </form>
        <div class="footer">
            <a href="https://quickstage.tech" target="_blank">Powered by QuickStage</a>
        </div>
    </div>
    
    <script>
        async function submitPassword(event) {
            event.preventDefault();
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            
            try {
                const response = await fetch('/s/${id}/gate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                
                if (response.ok) {
                    // Password accepted, reload page
                    window.location.reload();
                } else {
                    // Password rejected
                    errorDiv.textContent = 'Incorrect password. Please try again.';
                    errorDiv.style.display = 'block';
                    document.getElementById('password').value = '';
                    document.getElementById('password').focus();
                }
            } catch (error) {
                errorDiv.textContent = 'Error verifying password. Please try again.';
                errorDiv.style.display = 'block';
            }
        }
    </script>
</body>
</html>`;
            return new Response(passwordPromptHTML, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 200
            });
        }
    }
    // Get the main index.html file
    const indexObj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/index.html`);
    if (!indexObj) {
        return c.text('Snapshot index not found', 404);
    }
    // Read and modify the HTML content to fix asset paths
    let htmlContent = await indexObj.text();
    console.log(`🔍 Original HTML content preview:`, htmlContent.substring(0, 500));
    // Replace absolute asset paths with relative ones scoped to this snapshot
    const beforeReplace = htmlContent;
    // Use a single, comprehensive replacement that handles all cases at once
    // This prevents double-replacement by doing everything in one pass
    htmlContent = htmlContent.replace(/(href|src)=["']\/([^"']*)/g, (match, attr, path) => {
        // Only replace if it looks like an asset path
        if (path.startsWith('assets/') || /\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/.test(path)) {
            return `${attr}="/s/${id}/${path}"`;
        }
        return match; // Keep original if not an asset
    });
    // Inject the QuickStage commenting overlay
    const commentsOverlay = `
    <!-- QuickStage Comments Overlay -->
    <div id="quickstage-comments-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <!-- Comments Button -->
      <div id="quickstage-comments-button" style="position: fixed; top: 20px; right: 20px; pointer-events: auto; background: #007bff; color: white; border: none; border-radius: 8px; padding: 12px 20px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.2s ease;">
        💬 Comments
      </div>
      
      <!-- Comments Side Panel -->
      <div id="quickstage-comments-panel" style="position: fixed; top: 0; right: -400px; width: 400px; height: 100%; background: white; box-shadow: -4px 0 20px rgba(0,0,0,0.1); pointer-events: auto; transition: right 0.3s ease; display: flex; flex-direction: column;">
        <!-- Panel Header -->
        <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: #333; font-size: 18px;">💬 Comments</h3>
          <button id="quickstage-close-panel" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
        
        <!-- Comment Form -->
        <div style="padding: 20px; border-bottom: 1px solid #eee;">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Your Name:</label>
            <input type="text" id="quickstage-comment-name" placeholder="Anonymous" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Comment:</label>
            <textarea id="quickstage-comment-text" placeholder="Share your thoughts..." rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; resize: vertical;"></textarea>
          </div>
          <button id="quickstage-submit-comment" style="background: #007bff; color: white; border: none; border-radius: 4px; padding: 10px 20px; font-size: 14px; cursor: pointer; width: 100%; transition: background 0.2s ease;">Post Comment</button>
        </div>
        
        <!-- Comments List -->
        <div id="quickstage-comments-list" style="flex: 1; overflow-y: auto; padding: 20px;">
          <div id="quickstage-loading" style="text-align: center; color: #666; padding: 20px;">Loading comments...</div>
        </div>
      </div>
    </div>
    
    <script>
      (function() {
        const overlay = document.getElementById('quickstage-comments-overlay');
        const button = document.getElementById('quickstage-comments-button');
        const panel = document.getElementById('quickstage-comments-panel');
        const closeBtn = document.getElementById('quickstage-close-panel');
        const commentForm = document.getElementById('quickstage-submit-comment');
        const nameInput = document.getElementById('quickstage-comment-name');
        const textInput = document.getElementById('quickstage-comment-text');
        const commentsList = document.getElementById('quickstage-comments-list');
        const loading = document.getElementById('quickstage-loading');
        
        const snapshotId = '${id}';
        
        // Toggle panel
        button.addEventListener('click', () => {
          panel.style.right = '0';
          loadComments();
        });
        
        closeBtn.addEventListener('click', () => {
          panel.style.right = '-400px';
        });
        
        // Close panel when clicking outside
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            panel.style.right = '-400px';
          }
        });
        
        // Load comments
        async function loadComments() {
          try {
            loading.style.display = 'block';
            const response = await fetch(\`/comments/\${snapshotId}\`);
            const data = await response.json();
            
            if (data.comments && data.comments.length > 0) {
              loading.style.display = 'none';
              commentsList.innerHTML = data.comments.map(comment => \`
                <div style="padding: 15px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 15px; background: #f9f9f9;">
                  <div style="font-weight: 500; color: #333; margin-bottom: 5px;">\${comment.author || 'Anonymous'}</div>
                  <div style="color: #555; line-height: 1.4;">\${comment.text}</div>
                  <div style="font-size: 12px; color: #999; margin-top: 8px;">\${new Date(comment.createdAt).toLocaleString()}</div>
                </div>
              \`).join('');
            } else {
              loading.style.display = 'none';
              commentsList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No comments yet. Be the first to comment!</div>';
            }
          } catch (error) {
            loading.style.display = 'none';
            commentsList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Error loading comments.</div>';
          }
        }
        
        // Submit comment
        commentForm.addEventListener('click', async () => {
          const name = nameInput.value.trim() || 'Anonymous';
          const text = textInput.value.trim();
          
          if (!text) {
            alert('Please enter a comment.');
            return;
          }
          
          try {
            commentForm.disabled = true;
            commentForm.textContent = 'Posting...';
            
            const response = await fetch(\`/comments/\${snapshotId}\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, author: name })
            });
            
            if (response.ok) {
              nameInput.value = '';
              textInput.value = '';
              loadComments();
              commentForm.textContent = 'Comment Posted!';
              setTimeout(() => {
                commentForm.textContent = 'Post Comment';
                commentForm.disabled = false;
              }, 2000);
            } else {
              throw new Error('Failed to post comment');
            }
          } catch (error) {
            commentForm.textContent = 'Error - Try Again';
            commentForm.disabled = false;
            setTimeout(() => {
              commentForm.textContent = 'Post Comment';
            }, 2000);
          }
        });
        
        // Enter key to submit
        textInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commentForm.click();
          }
        });
      })();
    </script>
  `;
    // Insert the overlay before the closing </body> tag, or at the end if no body tag
    if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', commentsOverlay + '</body>');
    }
    else {
        htmlContent += commentsOverlay;
    }
    console.log(`🔍 HTML content after replacement:`, htmlContent.substring(0, 500));
    console.log(`🔍 Asset path replacements made:`, {
        before: beforeReplace.includes('/assets/'),
        after: htmlContent.includes(`/s/${id}/assets/`),
        id: id
    });
    // Return the modified HTML with proper headers
    const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
    return new Response(htmlContent, { headers });
});
// Asset serving with password gate - for individual files (CSS, JS, images, etc.)
app.get('/s/:id/*', async (c) => {
    const id = c.req.param('id');
    let path = c.req.param('*') || '';
    // If Hono wildcard fails, extract path manually from URL
    if (!path) {
        const url = new URL(c.req.url);
        const pathMatch = url.pathname.match(`^/s/${id}/(.+)$`);
        path = pathMatch ? pathMatch[1] : '';
    }
    console.log(`🔍 Worker: /s/:id/* route hit - id: ${id}, path: "${path}", url: ${c.req.url}`);
    if (!path) {
        console.log(`❌ No path extracted from URL: ${c.req.url}`);
        return c.text('Not found', 404);
    }
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
    console.log(`🔍 Looking for asset: snap/${id}/${path}`);
    const r2obj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/${path}`);
    if (!r2obj) {
        console.log(`❌ Asset not found: snap/${id}/${path}`);
        return c.text('Not found', 404);
    }
    console.log(`✅ Asset found: snap/${id}/${path}, size: ${r2obj.size}, type: ${r2obj.httpMetadata?.contentType}`);
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
// Alternative /snap/* routes for better Pages compatibility
app.get('/snap/:id/*', async (c) => {
    const id = c.req.param('id');
    const path = c.req.param('*') || '';
    console.log(`🔍 Worker: /snap/:id/* route hit - id: ${id}, path: ${path}`);
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
// Alternative /snap/:id route for better Pages compatibility
app.get('/snap/:id', async (c) => {
    const id = c.req.param('id');
    console.log(`🔍 Worker: /snap/:id route hit - id: ${id}`);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.text('Snapshot not found', 404);
    const meta = JSON.parse(metaRaw);
    if (meta.status === 'expired' || meta.expiresAt < nowMs()) {
        return c.text('Snapshot expired', 410);
    }
    // Check if password protected
    if (!meta.public) {
        const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (!gateCookie || gateCookie !== 'ok') {
            return c.text('Password required', 401);
        }
    }
    // Get the main index.html file
    const indexObj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/index.html`);
    if (!indexObj) {
        return c.text('Snapshot index not found', 404);
    }
    // Return the HTML with proper headers
    const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
    return new Response(indexObj.body, { headers });
});
// Gate
app.post('/s/:id/gate', async (c) => {
    try {
        const id = c.req.param('id');
        console.log(`🔐 Gate endpoint called for snapshot: ${id}`);
        const body = await c.req.json();
        const password = String(body?.password || '');
        console.log(`🔐 Password received: ${password ? '***' : 'empty'}`);
        const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
        if (!metaRaw) {
            console.log(`❌ Snapshot metadata not found for: ${id}`);
            return c.json({ error: 'not_found' }, 404);
        }
        const meta = JSON.parse(metaRaw);
        console.log(`🔐 Snapshot metadata found:`, {
            id: meta.id,
            hasPasswordHash: !!meta.passwordHash,
            passwordHashLength: meta.passwordHash?.length || 0
        });
        // Handle both old and new metadata structures
        let passwordToVerify = meta.passwordHash;
        let isLegacy = false;
        if (!passwordToVerify && meta.password) {
            // Legacy structure - use plain text password
            passwordToVerify = meta.password;
            isLegacy = true;
            console.log(`🔐 Using legacy password structure for: ${id}`);
        }
        if (!passwordToVerify) {
            console.log(`❌ No password found in metadata (neither passwordHash nor password)`);
            return c.json({ error: 'no_password_set' }, 400);
        }
        let ok = false;
        if (isLegacy) {
            // Legacy: direct string comparison
            ok = password === passwordToVerify;
            console.log(`🔐 Legacy password verification result: ${ok}`);
        }
        else {
            // New: hash verification
            ok = await verifyPasswordHash(password, passwordToVerify);
            console.log(`🔐 Hash password verification result: ${ok}`);
        }
        if (!ok)
            return c.json({ error: 'forbidden' }, 403);
        setCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`, 'ok', {
            secure: isSecureRequest(c),
            sameSite: 'Lax',
            path: `/s/${id}`,
            maxAge: 60 * 60,
        });
        console.log(`✅ Password verified, cookie set for: ${id}`);
        return c.json({ ok: true });
    }
    catch (error) {
        console.error(`❌ Error in gate endpoint:`, error);
        return c.json({ error: 'internal_error', details: String(error) }, 500);
    }
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
// Add /api prefixed routes for Cloudflare routing
app.post('/api/auth/google', async (c) => {
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
app.get('/api/me', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    return c.json({ user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt } });
});
// Add missing /api endpoints for the extension
app.post('/api/snapshots/create', async (c) => {
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
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
    return c.json({ id, password: realPassword });
});
// PAT (Personal Access Token) endpoints for extension authentication
app.post('/api/tokens/create', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    // Generate a new PAT
    const tokenId = generateIdBase62(16);
    const token = `qs_pat_${tokenId}`;
    const now = Date.now();
    const expiresAt = now + (90 * 24 * 60 * 60 * 1000); // 90 days
    const patData = {
        id: tokenId,
        token,
        userId: uid,
        createdAt: now,
        expiresAt,
        lastUsed: null,
        description: 'VS Code/Cursor Extension'
    };
    // Store PAT in KV
    await c.env.KV_USERS.put(`pat:${token}`, JSON.stringify(patData));
    // Add to user's PAT list
    const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
    const patIds = JSON.parse(patListJson);
    patIds.push(token);
    await c.env.KV_USERS.put(`user:${uid}:pats`, JSON.stringify(patIds));
    return c.json({
        token,
        expiresAt,
        message: 'Store this token securely. It will not be shown again.'
    });
});
app.get('/api/tokens/list', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
    const patIds = JSON.parse(patListJson);
    const pats = [];
    for (const patId of patIds) {
        const patData = await c.env.KV_USERS.get(`pat:${patId}`);
        if (patData) {
            const pat = JSON.parse(patData);
            // Don't return the full token, just metadata
            pats.push({
                id: pat.id,
                createdAt: pat.createdAt,
                expiresAt: pat.expiresAt,
                lastUsed: pat.lastUsed,
                description: pat.description
            });
        }
    }
    return c.json({ pats });
});
app.delete('/api/tokens/:tokenId', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const tokenId = c.req.param('tokenId');
    const fullToken = `qs_pat_${tokenId}`;
    // Verify ownership
    const patData = await c.env.KV_USERS.get(`pat:${fullToken}`);
    if (!patData)
        return c.json({ error: 'not_found' }, 404);
    const pat = JSON.parse(patData);
    if (pat.userId !== uid)
        return c.json({ error: 'forbidden' }, 403);
    // Remove PAT
    await c.env.KV_USERS.delete(`pat:${fullToken}`);
    // Remove from user's PAT list
    const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
    const patIds = JSON.parse(patListJson);
    const updatedPatIds = patIds.filter(id => id !== fullToken);
    await c.env.KV_USERS.put(`user:${uid}:pats`, JSON.stringify(updatedPatIds));
    return c.json({ message: 'PAT revoked successfully' });
});
// Add tokens endpoints without /api prefix for web app compatibility
app.post('/tokens/create', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    // Generate a new PAT
    const tokenId = generateIdBase62(16);
    const token = `qs_pat_${tokenId}`;
    const now = Date.now();
    const expiresAt = now + (90 * 24 * 60 * 60 * 1000); // 90 days
    const patData = {
        id: tokenId,
        token,
        userId: uid,
        createdAt: now,
        expiresAt,
        lastUsed: null,
        description: 'VS Code/Cursor Extension'
    };
    // Store PAT in KV
    await c.env.KV_USERS.put(`pat:${token}`, JSON.stringify(patData));
    // Add to user's PAT list
    const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
    const patIds = JSON.parse(patListJson);
    patIds.push(token);
    await c.env.KV_USERS.put(`user:${uid}:pats`, JSON.stringify(patIds));
    return c.json({
        token,
        expiresAt,
        message: 'Store this token securely. It will not be shown again.'
    });
});
app.get('/tokens/list', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
    const patIds = JSON.parse(patListJson);
    const pats = [];
    for (const patId of patIds) {
        const patData = await c.env.KV_USERS.get(`pat:${patId}`);
        if (patData) {
            const pat = JSON.parse(patData);
            // Don't return the full token, just metadata
            pats.push({
                id: pat.id,
                createdAt: pat.createdAt,
                expiresAt: pat.expiresAt,
                lastUsed: pat.lastUsed,
                description: pat.description
            });
        }
    }
    return c.json({ pats });
});
app.delete('/tokens/:tokenId', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const tokenId = c.req.param('tokenId');
    const fullToken = `qs_pat_${tokenId}`;
    // Verify ownership
    const patData = await c.env.KV_USERS.get(`pat:${fullToken}`);
    if (!patData)
        return c.json({ error: 'not_found' }, 404);
    const pat = JSON.parse(patData);
    if (pat.userId !== uid)
        return c.json({ error: 'forbidden' }, 403);
    // Remove PAT
    await c.env.KV_USERS.put(`pat:${fullToken}`, JSON.stringify(patData));
    // Remove from user's PAT list
    const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
    const patIds = JSON.parse(patListJson);
    const updatedPatIds = patIds.filter(id => id !== fullToken);
    await c.env.KV_USERS.put(`user:${uid}:pats`, JSON.stringify(updatedPatIds));
    return c.json({ message: 'PAT revoked successfully' });
});
// Helper function to get user ID from PAT
async function getUidFromPAT(c, token) {
    const patData = await c.env.KV_USERS.get(`pat:${token}`);
    if (!patData)
        return null;
    const pat = JSON.parse(patData);
    if (pat.expiresAt < Date.now())
        return null;
    // Update last used timestamp
    pat.lastUsed = Date.now();
    await c.env.KV_USERS.put(`pat:${token}`, JSON.stringify(pat));
    return pat.userId;
}
app.post('/api/upload-url', async (c) => {
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const { id, path: filePath, ct: contentType, sz: size, h: hash } = c.req.query();
    if (!id || !filePath || !contentType || !size || !hash) {
        return c.json({ error: 'missing_parameters' }, 400);
    }
    // Verify snapshot ownership
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'snapshot_not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'unauthorized' }, 401);
    // Generate presigned URL for R2
    const key = `snap/${id}/${filePath}`;
    const url = await presignR2PutURL({
        accountId: c.env.R2_ACCOUNT_ID,
        bucket: 'snapshots',
        key,
        accessKeyId: c.env.R2_ACCESS_KEY_ID,
        secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
        contentType,
        expiresSeconds: 600
    });
    return c.json({ url });
});
app.post('/api/snapshots/finalize', async (c) => {
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const { id, totalBytes, files } = await c.req.json();
    if (!id || totalBytes === undefined || !files) {
        return c.json({ error: 'missing_parameters' }, 400);
    }
    // Verify snapshot ownership
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'snapshot_not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'unauthorized' }, 401);
    // Update snapshot metadata with normalized files
    meta.status = 'ready';
    meta.totalBytes = typeof totalBytes === 'number' ? totalBytes : Number(totalBytes || 0);
    meta.files = (files || []).map((f) => ({
        name: f.name || f.p,
        size: typeof f.size === 'number' ? f.size : Number(f.sz || 0),
        type: f.type || f.ct || 'application/octet-stream',
        hash: f.hash || f.h,
    }));
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    return c.json({ ok: true });
});
// Add snapshot serving endpoint for /api/s/:id/*
app.get('/api/s/:id/*', async (c) => {
    const id = c.req.param('id');
    const path = c.req.param('*');
    if (!id || !path)
        return c.json({ error: 'invalid_path' }, 400);
    // Get snapshot metadata
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'snapshot_not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    // Check if expired
    if (meta.expiresAt && meta.expiresAt < Date.now()) {
        return c.json({ error: 'snapshot_expired' }, 410);
    }
    // Check if password protected
    if (meta.password) {
        const accessCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (!accessCookie) {
            return c.json({ error: 'password_required' }, 401);
        }
    }
    // Get file from R2
    const key = `snap/${id}/${path}`;
    const obj = await c.env.R2_SNAPSHOTS.get(key);
    if (!obj)
        return c.json({ error: 'file_not_found' }, 404);
    // Increment view count
    meta.viewCount = (meta.viewCount || 0) + 1;
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    // Return file with appropriate headers
    const headers = new Headers();
    if (obj.httpMetadata?.contentType) {
        headers.set('Content-Type', obj.httpMetadata.contentType);
    }
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(obj.body, { headers });
});
// Add extension version endpoint
app.get('/api/extensions/version', async (c) => {
    try {
        const versionInfo = getExtensionVersion();
        return c.json({
            version: versionInfo.version,
            buildDate: versionInfo.buildDate,
            checksum: 'direct-serve', // No longer serving VSIX content
            downloadUrl: '/quickstage.vsix', // Direct from web app
            filename: 'quickstage.vsix'
        });
    }
    catch (error) {
        console.error('Error serving version info:', error);
        return c.json({ error: 'version_info_unavailable' }, 500);
    }
});
// Backup VSIX download endpoint with explicit headers
app.get('/api/extensions/download', async (c) => {
    try {
        // Fetch the VSIX from the web app's public directory
        const vsixUrl = `https://quickstage.tech/quickstage.vsix`;
        const response = await fetch(vsixUrl);
        if (!response.ok) {
            console.error('Failed to fetch VSIX from web app:', response.status);
            return c.json({ error: 'download_unavailable' }, 500);
        }
        const vsixData = await response.arrayBuffer();
        // Get version for dynamic filename
        const versionInfo = getExtensionVersion();
        const filename = `quickstage-${versionInfo.version}.vsix`;
        // Serve with explicit headers to ensure proper download
        const headers = new Headers();
        headers.set('Content-Type', 'application/octet-stream');
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        headers.set('Content-Length', vsixData.byteLength.toString());
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');
        return new Response(vsixData, { headers });
    }
    catch (error) {
        console.error('Error serving VSIX download:', error);
        return c.json({ error: 'download_failed' }, 500);
    }
});
// Add extensions endpoints without /api prefix for web app compatibility
app.get('/extensions/version', async (c) => {
    try {
        const versionInfo = getExtensionVersion();
        return c.json({
            version: versionInfo.version,
            buildDate: versionInfo.buildDate,
            checksum: 'direct-serve', // No longer serving VSIX content
            downloadUrl: '/quickstage.vsix', // Direct from web app
            filename: 'quickstage.vsix'
        });
    }
    catch (error) {
        console.error('Error serving version info:', error);
        return c.json({ error: 'version_info_unavailable' }, 500);
    }
});
app.get('/extensions/download', async (c) => {
    try {
        // Fetch the VSIX from the web app's public directory
        const vsixUrl = `https://quickstage.tech/quickstage.vsix`;
        const response = await fetch(vsixUrl);
        if (!response.ok) {
            console.error('Failed to fetch VSIX from web app:', response.status);
            return c.json({ error: 'download_unavailable' }, 500);
        }
        const vsixData = await response.arrayBuffer();
        // Get version for dynamic filename
        const versionInfo = getExtensionVersion();
        const filename = `quickstage-${versionInfo.version}.vsix`;
        // Serve with explicit headers to ensure proper download
        const headers = new Headers();
        headers.set('Content-Type', 'application/octet-stream');
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        headers.set('Content-Length', vsixData.byteLength.toString());
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');
        return new Response(vsixData, { headers });
    }
    catch (error) {
        console.error('Error serving VSIX download:', error);
        return c.json({ error: 'download_failed' }, 500);
    }
});
// Comments endpoints
app.get('/comments/:snapshotId', async (c) => {
    try {
        const snapshotId = c.req.param('snapshotId');
        console.log(`💬 Getting comments for snapshot: ${snapshotId}`);
        // Get the Durable Object for this snapshot
        const id = c.env.COMMENTS_DO.idFromName(snapshotId);
        const obj = c.env.COMMENTS_DO.get(id);
        // Call the getComments method
        const response = await obj.fetch('https://dummy.com/comments', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            console.error(`❌ Failed to get comments for snapshot: ${snapshotId}`);
            return c.json({ error: 'failed_to_get_comments' }, 500);
        }
        const data = await response.json();
        console.log(`✅ Retrieved ${data.comments?.length || 0} comments for snapshot: ${snapshotId}`);
        return c.json(data);
    }
    catch (error) {
        console.error('❌ Error getting comments:', error);
        return c.json({ error: 'internal_error' }, 500);
    }
});
app.post('/comments/:snapshotId', async (c) => {
    try {
        const snapshotId = c.req.param('snapshotId');
        const { text, author = 'Anonymous' } = await c.req.json();
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return c.json({ error: 'invalid_comment' }, 400);
        }
        console.log(`💬 Adding comment to snapshot: ${snapshotId}, author: ${author}`);
        // Get the Durable Object for this snapshot
        const id = c.env.COMMENTS_DO.idFromName(snapshotId);
        const obj = c.env.COMMENTS_DO.get(id);
        // Call the addComment method
        const response = await obj.fetch('https://dummy.com/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim(), author: author.trim() || 'Anonymous' })
        });
        if (!response.ok) {
            console.error(`❌ Failed to add comment to snapshot: ${snapshotId}`);
            return c.json({ error: 'failed_to_add_comment' }, 500);
        }
        const data = await response.json();
        console.log(`✅ Comment added successfully to snapshot: ${snapshotId}`);
        return c.json(data);
    }
    catch (error) {
        console.error('❌ Error adding comment:', error);
        return c.json({ error: 'internal_error' }, 500);
    }
});
// Original web app serving (keep as primary)
// Extension is served directly from web app public directory
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
