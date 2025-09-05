import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { corsMiddleware } from './middleware/cors';
import { migrateSnapshotToNewSchema } from './migrate-schema';
import { DEFAULT_CAPS, VIEWER_COOKIE_PREFIX, ALLOW_MIME_PREFIXES } from '@quickstage/shared/index';
import { generateIdBase62, hashPasswordArgon2id, nowMs, randomHex } from './utils';
import { generatePassword } from '@quickstage/shared/cookies';
import { presignR2PutURL } from './s3presign';
import { getExtensionVersion } from './version-info';
// Import refactored modules
import { getUidFromSession, getUidFromPAT, isSuperadmin } from './auth';
// Import route handlers
import * as AuthRoutes from './routes/auth';
import * as BillingRoutes from './routes/billing';
import * as SnapshotRoutes from './routes/snapshots';
import * as ProjectRoutes from './routes/projects';
import * as ReviewRoutes from './routes/reviews';
import * as EnhancedCommentRoutes from './routes/enhanced-comments';
import * as SubscriptionRoutes from './routes/subscriptions';
import * as NotificationRoutes from './routes/notifications';
import * as OnboardingRoutes from './routes/onboarding';
import * as AISuggestionsRoutes from './routes/ai-suggestions';
import { getSubscriptionDisplayStatus, canAccessProFeatures } from './user';
import { handleCustomerCreated, handleCheckoutSessionCompleted, handleSubscriptionCreated, handleSubscriptionUpdated, handleSubscriptionDeleted, handleCustomerDeleted, handlePaymentSucceeded, handlePaymentFailed } from './stripe';
import { purgeExpired } from './snapshot';
import { getAnalyticsManager } from './worker-utils';
import { handleViewerById, handleViewerByIdWithPath, handleSnapByIdWithPath, handleSnapById, handleViewerGate } from './routes/viewer';
import { handleGetCommentsLegacy, handlePostCommentLegacy, handleGetSnapshotCommentsAlt, handlePostSnapshotCommentAlt } from './routes/comments';
import { handlePurgeExpired, handleGetUsers, handleCreateUser, handleDeactivateUser, handleActivateUser, handleDeleteUser, handleSetupSuperadmin, handleCleanupCorruptedUsers } from './routes/admin';
// Billing (Stripe)
// Edge-compatible Stripe client with Fetch + SubtleCrypto providers
// @ts-ignore
import Stripe from 'stripe';
const app = new Hono();
// Apply CORS middleware
app.use('*', corsMiddleware);
// Simplified authentication - no more complex cookie logic
// User helpers
// Google OAuth: Login/Register
// Email/Password: Register
app.post('/auth/register', AuthRoutes.handleRegister);
// Email/Password: Login
app.post('/auth/login', AuthRoutes.handleLogin);
app.post('/auth/google', AuthRoutes.handleGoogleAuth);
app.get('/me', AuthRoutes.handleMe);
// Logout endpoint
app.post('/auth/logout', AuthRoutes.handleLogout);
// Update user profile
app.put('/auth/profile', AuthRoutes.handleProfile);
// Change password
app.post('/auth/change-password', AuthRoutes.handleChangePassword);
// Start free trial with credit card required for auto-billing after trial
app.post('/billing/start-trial', BillingRoutes.handleStartTrial);
// Manual subscription for existing users (after trial ends or reactivation)
app.post('/billing/subscribe', BillingRoutes.handleSubscribe);
// Get subscription status
app.get('/billing/status', BillingRoutes.handleBillingStatus);
// Cancel subscription
app.post('/billing/cancel', BillingRoutes.handleBillingCancel);
// Create snapshot
app.post('/snapshots/create', SnapshotRoutes.handleCreateSnapshot);
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
app.post('/snapshots/finalize', SnapshotRoutes.handleFinalizeSnapshot);
// Add /snapshots/list route BEFORE /snapshots/:id to avoid conflicts
app.get('/snapshots/list', SnapshotRoutes.handleListSnapshots);
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
        // Password protected snapshots - check for password gate cookie
        const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (gateCookie && gateCookie === 'ok') {
            // Password gate cookie is valid, allow access
            return c.json({ snapshot: meta });
        }
        else {
            // No valid password gate cookie, require authentication
            return c.json({ error: 'unauthorized' }, 401);
        }
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
    // Track analytics event for snapshot expiration
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'snapshot_expired', { snapshotId: id });
    // Don't remove from index - keep expired snapshots visible when "All" is selected
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
    // Track analytics event for snapshot extension
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'snapshot_extended', {
        snapshotId: id,
        daysAdded: added,
        newExpiryDate: meta.expiresAt
    });
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
    meta.password = newPass; // Store plain text password for display
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    // Track analytics event for password rotation
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'snapshot_extended', {
        snapshotId: id,
        action: 'password_rotated'
    });
    return c.json({ password: newPass });
});
// Add /api/snapshots/list route BEFORE the /api/snapshots/:id route to avoid conflicts
app.get('/api/snapshots/list', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    // Track analytics event for page view
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'page_view', { page: '/api/snapshots/list' });
    const listJson = await c.env.KV_USERS.get(`user:${uid}:snapshots`) || '[]';
    const ids = JSON.parse(listJson);
    const snapshots = [];
    for (const id of ids) {
        const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
        if (metaRaw) {
            try {
                const meta = JSON.parse(metaRaw);
                // Migrate snapshot to ensure proper schema
                const migratedMeta = migrateSnapshotToNewSchema(meta);
                // Always include the snapshot, let the frontend handle filtering
                snapshots.push({
                    id: migratedMeta.id,
                    name: migratedMeta.name || `Snapshot ${migratedMeta.id.slice(0, 8)}`,
                    projectId: migratedMeta.projectId,
                    createdAt: migratedMeta.createdAt,
                    updatedAt: migratedMeta.updatedAt || migratedMeta.createdAt,
                    expiresAt: migratedMeta.expiresAt,
                    lastModifiedAt: migratedMeta.lastModifiedAt || migratedMeta.updatedAt || migratedMeta.createdAt,
                    password: migratedMeta.password || (migratedMeta.passwordHash ? 'Password protected' : null),
                    isPublic: migratedMeta.public || false,
                    viewCount: migratedMeta.analytics?.viewCount || 0,
                    uniqueViewers: migratedMeta.analytics?.uniqueViewers || 0,
                    commentCount: migratedMeta.analytics?.commentCount || migratedMeta.commentsCount || 0,
                    metadata: migratedMeta.metadata || {},
                    review: migratedMeta.review,
                    status: migratedMeta.status || 'active',
                    tags: migratedMeta.metadata?.tags || [],
                    description: migratedMeta.metadata?.description,
                    version: migratedMeta.metadata?.version,
                    clientName: migratedMeta.metadata?.clientName,
                    milestone: migratedMeta.metadata?.milestone
                });
            }
            catch { }
        }
    }
    // Sort snapshots by createdAt in descending order (newest first)
    snapshots.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return c.json({ snapshots });
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
        // Password protected snapshots - check for password gate cookie
        const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (gateCookie && gateCookie === 'ok') {
            // Password gate cookie is valid, allow access
            return c.json({ snapshot: meta });
        }
        else {
            // No valid password gate cookie, require authentication
            return c.json({ error: 'unauthorized' }, 401);
        }
    }
});
// Main snapshot page route - serves the app's index.html (MUST come FIRST)
app.get('/s/:id', handleViewerById);
// Asset serving with password gate - for individual files (CSS, JS, images, etc.)
app.get('/s/:id/*', handleViewerByIdWithPath);
// Alternative /snap/* routes for better Pages compatibility
app.get('/snap/:id/*', handleSnapByIdWithPath);
// Alternative /snap/:id route for better Pages compatibility
app.get('/snap/:id', handleSnapById);
// Gate
app.post('/s/:id/gate', handleViewerGate);
// OLD Basic comment endpoints - DEPRECATED - Removed in favor of enhanced system below
// Legacy comments endpoints for backward compatibility
app.get('/comments', handleGetCommentsLegacy);
app.post('/comments', handlePostCommentLegacy);
// Cron purge
app.get('/admin/purge-expired', handlePurgeExpired);
// Add /api prefixed routes for Cloudflare routing
app.post('/api/snapshots/:id/extend', async (c) => {
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
app.post('/api/snapshots/:id/expire', async (c) => {
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
});
app.post('/api/snapshots/:id/rotate-password', async (c) => {
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
});
app.put('/api/snapshots/:id', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    console.log(`PUT /api/snapshots/${id} - User: ${uid}, Body:`, JSON.stringify(body));
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw) {
        console.log(`Snapshot ${id} not found in KV store`);
        return c.json({ error: 'snapshot_not_found', snapshotId: id }, 404);
    }
    let meta;
    try {
        meta = JSON.parse(metaRaw);
    }
    catch (error) {
        console.log(`Failed to parse snapshot ${id} metadata:`, error);
        return c.json({ error: 'invalid_snapshot_data' }, 500);
    }
    if (meta.ownerUid !== uid)
        return c.json({ error: 'forbidden' }, 403);
    // Update password if provided
    if (body.password) {
        const newPass = body.password;
        const saltHex = randomHex(8);
        meta.passwordHash = await hashPasswordArgon2id(newPass, saltHex);
        meta.password = newPass; // Store plain text password for display
    }
    // Update name if provided
    if (body.name !== undefined) {
        meta.name = body.name;
    }
    // Update projectId if provided
    if (body.projectId !== undefined) {
        meta.projectId = body.projectId;
    }
    // Update updatedAt timestamp
    meta.updatedAt = Date.now();
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
    return c.json({ ok: true, password: meta.password, name: meta.name, projectId: meta.projectId });
});
// Add /api prefixed routes for Cloudflare routing
app.post('/api/auth/google', AuthRoutes.handleGoogleAuth);
app.get('/api/me', AuthRoutes.handleMe);
// Project management routes
app.post('/api/projects', ProjectRoutes.handleCreateProject);
app.get('/api/projects', ProjectRoutes.handleGetProjects);
app.put('/api/projects/:projectId', ProjectRoutes.handleUpdateProject);
app.delete('/api/projects/:projectId', ProjectRoutes.handleDeleteProject);
app.post('/api/projects/:projectId/archive', ProjectRoutes.handleArchiveProject);
app.post('/api/projects/reorder', ProjectRoutes.handleReorderProjects);
// Review workflow routes
app.post('/api/snapshots/:snapshotId/reviews', ReviewRoutes.handleCreateReview);
app.get('/api/reviews/:reviewId', ReviewRoutes.handleGetReview);
app.post('/api/reviews/:reviewId/submit', ReviewRoutes.handleSubmitReview);
app.get('/api/snapshots/:snapshotId/reviews', ReviewRoutes.handleGetSnapshotReviews);
app.delete('/api/reviews/:reviewId', ReviewRoutes.handleCancelReview);
// Main comment routes (formerly enhanced) - Full threading, states, attachments support
app.post('/api/snapshots/:snapshotId/comments', EnhancedCommentRoutes.handleCreateComment);
app.get('/api/snapshots/:snapshotId/comments', EnhancedCommentRoutes.handleGetComments);
app.put('/api/snapshots/:snapshotId/comments/:commentId', EnhancedCommentRoutes.handleUpdateComment);
app.delete('/api/snapshots/:snapshotId/comments/:commentId', EnhancedCommentRoutes.handleDeleteComment);
app.post('/api/snapshots/:snapshotId/comments/:commentId/resolve', EnhancedCommentRoutes.handleResolveComment);
app.post('/api/snapshots/:snapshotId/comments/:commentId/attachments', EnhancedCommentRoutes.handleUploadAttachment);
app.post('/api/snapshots/:snapshotId/comments/bulk-resolve', EnhancedCommentRoutes.handleBulkResolveComments);
// Subscription routes
app.post('/api/snapshots/:snapshotId/subscribe', SubscriptionRoutes.handleSubscribeToSnapshot);
app.post('/api/snapshots/:snapshotId/unsubscribe', SubscriptionRoutes.handleUnsubscribeFromSnapshot);
app.get('/api/subscriptions', SubscriptionRoutes.handleGetUserSubscriptions);
app.patch('/api/subscriptions/:subscriptionId', SubscriptionRoutes.handleUpdateSubscription);
app.delete('/api/subscriptions/:subscriptionId', SubscriptionRoutes.handleDeleteSubscription);
// Notification routes
app.get('/api/notifications', NotificationRoutes.handleGetNotifications);
app.get('/api/notifications/stats', NotificationRoutes.handleGetNotificationStats);
app.post('/api/notifications/:notificationId/read', NotificationRoutes.handleMarkNotificationRead);
app.post('/api/notifications/read-all', NotificationRoutes.handleMarkAllNotificationsRead);
app.delete('/api/notifications/:notificationId', NotificationRoutes.handleDeleteNotification);
// Onboarding routes
app.get('/api/onboarding', OnboardingRoutes.handleGetOnboarding);
app.put('/api/onboarding', OnboardingRoutes.handleUpdateOnboarding);
app.post('/api/onboarding/tutorial', OnboardingRoutes.handleTrackTutorial);
app.get('/api/onboarding/should-show-welcome', OnboardingRoutes.handleShouldShowWelcome);
// AI Suggestions routes
// AI Chat Routes
app.post('/api/snapshots/:snapshotId/ai-chat/start', AISuggestionsRoutes.handleStartAIConversation);
app.post('/api/snapshots/:snapshotId/ai-chat/message', AISuggestionsRoutes.handleSendAIMessage);
app.get('/api/snapshots/:snapshotId/ai-chat', AISuggestionsRoutes.handleGetAIConversation);
// Admin endpoints
app.get('/admin/users', handleGetUsers);
app.post('/admin/users', handleCreateUser);
app.post('/admin/users/:uid/deactivate', handleDeactivateUser);
app.post('/admin/users/:uid/activate', handleActivateUser);
// Delete user completely (superadmin only)
app.delete('/admin/users/:uid', handleDeleteUser);
// Create superadmin user (one-time setup)
app.post('/admin/setup-superadmin', handleSetupSuperadmin);
// Get all snapshots (admin only)
app.get('/admin/snapshots', async (c) => {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/admin/snapshots',
                method: 'GET'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    // Check if user is superadmin
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw) {
        return c.json({ error: 'user_not_found' }, 404);
    }
    const user = JSON.parse(userRaw);
    if (user.role !== 'superadmin') {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'unauthorized_access', {
                endpoint: '/admin/snapshots',
                method: 'GET',
                userRole: user.role
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'insufficient_permissions' }, 403);
    }
    // Track analytics event for page view
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'page_view', { page: '/admin/snapshots' });
    try {
        // Get all snapshots from KV
        const list = await c.env.KV_SNAPS.list({ prefix: 'snap:' });
        const snapshots = [];
        for (const key of list.keys) {
            if (key.name.startsWith('snap:') && !key.name.includes(':', 5)) {
                const snapRaw = await c.env.KV_SNAPS.get(key.name);
                if (snapRaw) {
                    try {
                        const meta = JSON.parse(snapRaw);
                        // Migrate snapshot to ensure proper schema
                        const migratedMeta = migrateSnapshotToNewSchema(meta);
                        // Get owner information
                        const ownerRaw = await c.env.KV_USERS.get(`user:${migratedMeta.ownerUid}`);
                        const owner = ownerRaw ? JSON.parse(ownerRaw) : null;
                        snapshots.push({
                            id: migratedMeta.id,
                            name: migratedMeta.name || `Snapshot ${migratedMeta.id.slice(0, 8)}`,
                            projectId: migratedMeta.projectId,
                            createdAt: migratedMeta.createdAt,
                            updatedAt: migratedMeta.updatedAt || migratedMeta.createdAt,
                            expiresAt: migratedMeta.expiresAt,
                            lastModifiedAt: migratedMeta.lastModifiedAt || migratedMeta.updatedAt || migratedMeta.createdAt,
                            password: migratedMeta.password || (migratedMeta.passwordHash ? 'Password protected' : null),
                            isPublic: migratedMeta.public || false,
                            viewCount: migratedMeta.analytics?.viewCount || 0,
                            uniqueViewers: migratedMeta.analytics?.uniqueViewers || 0,
                            commentCount: migratedMeta.analytics?.commentCount || migratedMeta.commentsCount || 0,
                            metadata: migratedMeta.metadata || {},
                            review: migratedMeta.review,
                            status: migratedMeta.status || 'active',
                            tags: migratedMeta.metadata?.tags || [],
                            description: migratedMeta.metadata?.description,
                            version: migratedMeta.metadata?.version,
                            clientName: migratedMeta.metadata?.clientName,
                            milestone: migratedMeta.metadata?.milestone,
                            ownerUid: migratedMeta.ownerUid,
                            ownerName: owner?.name || 'Unknown',
                            ownerEmail: owner?.email || 'Unknown'
                        });
                    }
                    catch (parseError) {
                        console.error('Failed to parse snapshot:', key.name, parseError);
                    }
                }
            }
        }
        // Sort snapshots by createdAt in descending order (newest first)
        snapshots.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return c.json({ snapshots });
    }
    catch (error) {
        console.error('Admin snapshots error:', error);
        // Track analytics event for error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_snapshots',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for admin snapshots error:', analyticsError);
        }
        return c.json({ error: 'Failed to fetch snapshots' }, 500);
    }
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
    const { expiryDays = 7, public: isPublic = false, name, projectId, description, tags, version, clientName, milestone, reviewSummary } = await c.req.json();
    const id = generateIdBase62(16);
    const realPassword = generatePassword(8);
    const saltHex = randomHex(8);
    const passwordHash = await hashPasswordArgon2id(realPassword, saltHex);
    const now = Date.now();
    const expiresAt = now + (expiryDays * 24 * 60 * 60 * 1000);
    const snapshot = {
        id,
        name,
        ownerUid: uid,
        projectId,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        lastModifiedAt: now,
        passwordHash,
        password: realPassword, // Store plain text password for display
        totalBytes: 0,
        files: [],
        public: Boolean(isPublic),
        status: 'creating',
        analytics: {
            viewCount: 0,
            uniqueViewers: 0,
            downloadCount: 0,
            commentCount: 0,
            averageTimeOnPage: 0,
            lastViewedAt: 0,
            viewerCountries: [],
            viewerIPs: [],
            viewSessions: []
        },
        metadata: {
            fileCount: 0,
            hasComments: false,
            tags: tags || [],
            description,
            version,
            clientName,
            milestone,
            reviewSummary
        },
        // Legacy fields for backward compatibility
        views: { m: new Date().toISOString().slice(0, 7).replace('-', ''), n: 0 },
        commentsCount: 0,
        caps: DEFAULT_CAPS,
        gateVersion: 1,
    };
    await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(snapshot));
    // Add to user's snapshot list
    const listJson = await c.env.KV_USERS.get(`user:${uid}:snapshots`) || '[]';
    const ids = JSON.parse(listJson);
    ids.push(id);
    await c.env.KV_USERS.put(`user:${uid}:snapshots`, JSON.stringify(ids));
    // Update project snapshot count if projectId is provided
    if (projectId) {
        const projectData = await c.env.KV_PROJECTS?.get(`${uid}:${projectId}`);
        if (projectData) {
            const project = JSON.parse(projectData);
            project.snapshotCount = (project.snapshotCount || 0) + 1;
            project.updatedAt = now;
            await c.env.KV_PROJECTS.put(`${uid}:${projectId}`, JSON.stringify(project));
        }
    }
    // Track analytics event
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'snapshot_created', {
        snapshotId: id,
        expiryDays: expiryDays || 7,
        isPublic: isPublic || false,
        hasProject: !!projectId,
        hasName: !!name
    });
    return c.json({ id, password: realPassword });
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
    // Track analytics event for token creation
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'api_call', {
        action: 'token_created',
        tokenType: 'PAT',
        expiresIn: 90
    });
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
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/tokens/:tokenId',
                method: 'DELETE'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
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
    // Track analytics event for token deletion
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'api_call', {
        action: 'token_deleted',
        tokenType: 'PAT'
    });
    return c.json({ message: 'PAT revoked successfully' });
});
// Helper function to get user ID from PAT
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
// Protected VSIX download endpoint - requires active subscription or trial
app.get('/api/extensions/download', async (c) => {
    // Check authentication first
    const uid = await getUidFromSession(c);
    if (!uid) {
        return c.json({ error: 'unauthorized', message: 'Please log in to download the extension' }, 401);
    }
    // Check subscription status
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw) {
        return c.json({ error: 'user_not_found' }, 404);
    }
    const user = JSON.parse(userRaw);
    if (!canAccessProFeatures(user)) {
        return c.json({
            error: 'subscription_required',
            message: 'Active subscription or trial required to download extension',
            subscriptionStatus: getSubscriptionDisplayStatus(user)
        }, 403);
    }
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
        console.log(`VSIX download authorized for user ${uid} (${getSubscriptionDisplayStatus(user)})`);
        // Track analytics event
        console.log(`🎯 EXTENSION DOWNLOAD: Starting analytics tracking for user ${uid}`);
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'extension_downloaded', {
            version: getExtensionVersion().version,
            filename: filename
        });
        console.log(`✅ EXTENSION DOWNLOAD: Analytics tracking completed for user ${uid}`);
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
    // Check authentication first
    const uid = await getUidFromSession(c);
    if (!uid) {
        return c.json({ error: 'unauthorized', message: 'Please log in to download the extension' }, 401);
    }
    // Check subscription status
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw) {
        return c.json({ error: 'user_not_found' }, 404);
    }
    const user = JSON.parse(userRaw);
    if (!canAccessProFeatures(user)) {
        return c.json({
            error: 'subscription_required',
            message: 'Active subscription or trial required to download extension',
            subscriptionStatus: getSubscriptionDisplayStatus(user)
        }, 403);
    }
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
        // Track analytics event
        console.log(`🎯 EXTENSION DOWNLOAD (alt route): Starting analytics tracking for user ${uid}`);
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'extension_downloaded', {
            version: versionInfo.version,
            filename: filename
        });
        console.log(`✅ EXTENSION DOWNLOAD (alt route): Analytics tracking completed for user ${uid}`);
        return new Response(vsixData, { headers });
    }
    catch (error) {
        console.error('Error serving VSIX download:', error);
        return c.json({ error: 'download_failed' }, 500);
    }
});
// Comments endpoints (robust implementation with error handling and logging)
app.get('/comments/:snapshotId', handleGetSnapshotCommentsAlt);
app.post('/comments/:snapshotId', handlePostSnapshotCommentAlt);
// Analytics tracking endpoint
app.post('/analytics/track', async (c) => {
    console.log('🔥🔥🔥 ANALYTICS ENDPOINT HIT');
    console.log('Method:', c.req.method);
    console.log('URL:', c.req.url);
    try {
        console.log('🔥 Step 1: Reading request body...');
        const body = await c.req.json();
        console.log('🔥 Step 1 SUCCESS: Body =', JSON.stringify(body));
        console.log('🔥 Step 2: Importing analytics handler...');
        const { handleAnalyticsTrack } = await import('./routes/analytics');
        console.log('🔥 Step 2 SUCCESS: Handler imported');
        console.log('🔥 Step 3: Calling analytics handler...');
        const result = await handleAnalyticsTrack(c);
        console.log('🔥 Step 3 SUCCESS: Handler completed, returning result');
        return result;
    }
    catch (error) {
        console.error('🔥🔥🔥 ANALYTICS ENDPOINT ERROR:', error);
        console.error('🔥 Error message:', error.message);
        console.error('🔥 Error stack:', error.stack);
        console.error('🔥 Error name:', error.name);
        return c.json({
            error: 'Analytics endpoint failed',
            details: error.message,
            name: error.name,
            stack: error.stack
        }, 500);
    }
});
// Simple analytics test endpoint
app.post('/analytics/test', async (c) => {
    try {
        console.log('🔧 SIMPLE ANALYTICS TEST');
        const body = await c.req.json();
        console.log('🔧 Request body:', JSON.stringify(body));
        return c.json({
            success: true,
            message: 'Simple test passed',
            receivedData: body
        });
    }
    catch (error) {
        console.error('🔧 SIMPLE TEST ERROR:', error);
        return c.json({ error: 'Simple test failed', details: error.message }, 500);
    }
});
// Original web app serving (keep as primary)
// Extension is served directly from web app public directory
// Get analytics events (superadmin only)
app.get('/debug/analytics/events', async (c) => {
    const { handleDebugAnalyticsEvents } = await import('./routes/debug');
    return handleDebugAnalyticsEvents(c);
});
// Migration system endpoints (superadmin only)
app.get('/debug/migration/stats', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        const { MigrationSystem } = await import('./migration-system');
        const migrationSystem = new MigrationSystem(c.env);
        const stats = await migrationSystem.getMigrationStats();
        return c.json({
            stats,
            timestamp: new Date().toISOString(),
            summary: {
                totalRecords: stats.totalUsers + stats.totalSnapshots,
                migratedRecords: stats.migratedUsers + stats.migratedSnapshots,
                legacyRecords: stats.legacyUsers + stats.legacySnapshots,
                migrationProgress: stats.totalUsers + stats.totalSnapshots > 0
                    ? Math.round(((stats.migratedUsers + stats.migratedSnapshots) / (stats.totalUsers + stats.totalSnapshots)) * 100)
                    : 100
            }
        });
    }
    catch (error) {
        console.error('Migration stats error:', error);
        return c.json({ error: 'Failed to get migration stats' }, 500);
    }
});
app.post('/debug/migration/run', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        const body = await c.req.json();
        const { dryRun = false, batchSize = 50, skipErrors = true, verbose = false } = body;
        const { MigrationSystem } = await import('./migration-system');
        const migrationSystem = new MigrationSystem(c.env, {
            dryRun,
            batchSize,
            skipErrors,
            verbose
        });
        console.log(`🚀 Starting migration with options:`, { dryRun, batchSize, skipErrors, verbose });
        const result = await migrationSystem.runFullMigration();
        // Track analytics event for migration
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'migration_completed', {
                migrated: result.migrated,
                errors: result.errors,
                duration: result.duration,
                dryRun
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for migration:', analyticsError);
        }
        return c.json({
            success: result.success,
            result,
            message: `Migration completed: ${result.migrated} migrated, ${result.errors} errors`
        });
    }
    catch (error) {
        console.error('Migration run error:', error);
        // Track analytics event for migration error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'migration_run',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for migration error:', analyticsError);
        }
        return c.json({ error: 'Failed to run migration' }, 500);
    }
});
app.post('/debug/migration/users', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        const body = await c.req.json();
        const { dryRun = false, batchSize = 50, skipErrors = true, verbose = false } = body;
        const { MigrationSystem } = await import('./migration-system');
        const migrationSystem = new MigrationSystem(c.env, {
            dryRun,
            batchSize,
            skipErrors,
            verbose
        });
        console.log(`👥 Starting user migration with options:`, { dryRun, batchSize, skipErrors, verbose });
        const result = await migrationSystem.migrateAllUsers();
        // Track analytics event for user migration
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'user_migration_completed', {
                migrated: result.migrated,
                errors: result.errors,
                duration: result.duration,
                dryRun
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for user migration:', analyticsError);
        }
        return c.json({
            success: result.success,
            result,
            message: `User migration completed: ${result.migrated} migrated, ${result.errors} errors`
        });
    }
    catch (error) {
        console.error('User migration error:', error);
        return c.json({ error: 'Failed to run user migration' }, 500);
    }
});
app.post('/debug/migration/snapshots', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        const body = await c.req.json();
        const { dryRun = false, batchSize = 50, skipErrors = true, verbose = false } = body;
        const { MigrationSystem } = await import('./migration-system');
        const migrationSystem = new MigrationSystem(c.env, {
            dryRun,
            batchSize,
            skipErrors,
            verbose
        });
        console.log(`📸 Starting snapshot migration with options:`, { dryRun, batchSize, skipErrors, verbose });
        const result = await migrationSystem.migrateAllSnapshots();
        // Track analytics event for snapshot migration
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'snapshot_migration_completed', {
                migrated: result.migrated,
                errors: result.errors,
                duration: result.duration,
                dryRun
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for snapshot migration:', analyticsError);
        }
        return c.json({
            success: result.success,
            result,
            message: `Snapshot migration completed: ${result.migrated} migrated, ${result.errors} errors`
        });
    }
    catch (error) {
        console.error('Snapshot migration error:', error);
        return c.json({ error: 'Failed to run snapshot migration' }, 500);
    }
});
// Migration endpoint for switching to production Stripe
app.post('/admin/migrate-stripe-production', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        const { migrateToProductionStripe } = await import('./migrate-to-production-stripe');
        const result = await migrateToProductionStripe(c.env);
        return c.json({
            success: true,
            result,
            message: `Production Stripe migration completed: ${result.updated} users updated`
        });
    }
    catch (error) {
        console.error('Production Stripe migration error:', error);
        return c.json({ error: 'Failed to run production Stripe migration' }, 500);
    }
});
// Test endpoint to preview migration (no authentication required for testing)
app.get('/admin/test-migration-preview', async (c) => {
    try {
        console.log('🔧 PREVIEW: Testing migration logic...');
        const usersToUpdate = [];
        let hasMore = true;
        let cursor = undefined;
        // Get all user keys
        while (hasMore) {
            const listResult = await c.env.KV_USERS.list({
                prefix: 'user:',
                cursor: cursor
            });
            for (const key of listResult.keys) {
                if (key.name.startsWith('user:') && !key.name.includes(':by')) {
                    const userData = await c.env.KV_USERS.get(key.name);
                    if (userData) {
                        const user = JSON.parse(userData);
                        // Check if user has test Stripe data that needs cleanup
                        const hasTestStripeData = (user.stripeCustomerId?.startsWith('cus_') ||
                            user.stripeSubscriptionId?.startsWith('sub_') ||
                            user.subscription?.stripeCustomerId?.startsWith('cus_') ||
                            user.subscription?.stripeSubscriptionId?.startsWith('sub_'));
                        if (hasTestStripeData || user.subscriptionStatus !== 'none') {
                            const isSuperadmin = user.email === 'nbramia@gmail.com';
                            usersToUpdate.push({
                                email: user.email,
                                currentStatus: user.subscriptionStatus || 'none',
                                currentPlan: user.plan || 'free',
                                willBecomeSuperadmin: isSuperadmin,
                                hasTestStripeData
                            });
                        }
                    }
                }
            }
            hasMore = !listResult.list_complete;
            cursor = listResult.cursor;
        }
        return c.json({
            message: 'Migration preview (no changes made)',
            usersToUpdate,
            totalUsers: usersToUpdate.length,
            superadminEmails: ['nbramia@gmail.com']
        });
    }
    catch (error) {
        console.error('🔧 PREVIEW: Migration preview failed:', error);
        return c.json({
            error: 'Migration preview failed',
            message: error.message
        }, 500);
    }
});
export { CommentsRoom } from './comments';
// Stripe billing endpoints
app.post('/billing/checkout', BillingRoutes.handleCheckout);
// Change payment method endpoint
app.post('/billing/change-payment', BillingRoutes.handleChangePayment);
app.post('/billing/portal', BillingRoutes.handleBillingPortal);
// Stripe webhook endpoint (both plural and singular for compatibility)
app.post('/webhook/stripe', async (c) => {
    try {
        // Check if Stripe secret key is available
        if (!c.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY not found in environment');
            return c.json({ error: 'stripe_configuration_error' }, 500);
        }
        // Check if Stripe webhook secret is available
        if (!c.env.STRIPE_WEBHOOK_SECRET) {
            console.error('STRIPE_WEBHOOK_SECRET not found in environment');
            return c.json({ error: 'stripe_configuration_error' }, 500);
        }
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });
        const sig = c.req.header('stripe-signature');
        const rawBody = await c.req.arrayBuffer();
        const bodyString = new TextDecoder().decode(rawBody);
        if (!sig) {
            console.error('Missing stripe-signature header');
            return c.json({ error: 'missing_signature' }, 400);
        }
        // Verify webhook signature (async version for Cloudflare Workers)
        let event;
        try {
            event = await stripe.webhooks.constructEventAsync(bodyString, sig, c.env.STRIPE_WEBHOOK_SECRET);
            console.log(`✅ Verified webhook event: ${event.type}`);
        }
        catch (err) {
            console.error(`❌ Webhook signature verification failed: ${err.message}`);
            return c.json({ error: 'invalid_signature' }, 400);
        }
        // Import Stripe handlers
        const { handleCustomerCreated, handleCheckoutSessionCompleted, handleSubscriptionCreated, handleSubscriptionUpdated, handleSubscriptionDeleted, handleCustomerDeleted, handlePaymentSucceeded, handlePaymentFailed } = await import('./stripe');
        const { getAnalyticsManager } = await import('./worker-utils');
        const analytics = getAnalyticsManager(c);
        // Handle different event types
        switch (event.type) {
            case 'customer.created':
                await handleCustomerCreated(c, event.data.object, analytics);
                break;
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(c, event.data.object, analytics);
                break;
            case 'customer.subscription.created':
                await handleSubscriptionCreated(c, event.data.object, analytics);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(c, event.data.object, analytics);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(c, event.data.object, analytics);
                break;
            case 'customer.deleted':
                await handleCustomerDeleted(c, event.data.object, analytics);
                break;
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(c, event.data.object, analytics);
                break;
            case 'invoice.payment_failed':
                await handlePaymentFailed(c, event.data.object, analytics);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        return c.json({ received: true });
    }
    catch (error) {
        console.error('Webhook error:', error);
        return c.json({ error: 'webhook_error', details: error.message }, 500);
    }
});
app.post('/webhooks/stripe', async (c) => {
    try {
        // Check if Stripe secret key is available
        if (!c.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY not found in environment');
            return c.json({ error: 'stripe_configuration_error' }, 500);
        }
        // Check if Stripe webhook secret is available
        if (!c.env.STRIPE_WEBHOOK_SECRET) {
            console.error('STRIPE_WEBHOOK_SECRET not found in environment');
            return c.json({ error: 'stripe_configuration_error' }, 500);
        }
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });
        const sig = c.req.header('stripe-signature');
        const rawBody = await c.req.arrayBuffer();
        const bodyString = new TextDecoder().decode(rawBody);
        if (!sig) {
            console.error('No Stripe signature found');
            return c.json({ error: 'no_signature' }, 400);
        }
        let event;
        try {
            event = await stripe.webhooks.constructEventAsync(bodyString, sig, c.env.STRIPE_WEBHOOK_SECRET);
        }
        catch (err) {
            console.error('Webhook signature verification failed:', err);
            return c.json({ error: 'bad_signature' }, 400);
        }
        console.log(`Processing Stripe webhook: ${event.type}`);
        // Handle various Stripe webhook events
        switch (event.type) {
            case 'checkout.session.completed':
                console.log('Handling checkout.session.completed event');
                await handleCheckoutSessionCompleted(c, event.data.object, getAnalyticsManager(c));
                break;
            case 'customer.created':
                console.log('Handling customer.created event');
                await handleCustomerCreated(c, event.data.object, getAnalyticsManager(c));
                break;
            case 'customer.subscription.created':
                console.log('Handling customer.subscription.created event');
                await handleSubscriptionCreated(c, event.data.object, getAnalyticsManager(c));
                break;
            case 'customer.subscription.updated':
                console.log('Handling customer.subscription.updated event');
                await handleSubscriptionUpdated(c, event.data.object, getAnalyticsManager(c));
                break;
            case 'customer.subscription.deleted':
                console.log('Handling customer.subscription.deleted event');
                await handleSubscriptionDeleted(c, event.data.object, getAnalyticsManager(c));
                break;
            case 'customer.deleted':
                console.log('Handling customer.deleted event');
                await handleCustomerDeleted(c, event.data.object, getAnalyticsManager(c));
                break;
            case 'invoice.payment_succeeded':
                console.log('Handling invoice.payment_succeeded event');
                await handlePaymentSucceeded(c, event.data.object, getAnalyticsManager(c));
                break;
            case 'invoice.payment_failed':
                console.log('Handling invoice.payment_failed event');
                await handlePaymentFailed(c, event.data.object, getAnalyticsManager(c));
                break;
            case 'customer.updated':
                console.log('Handling customer.updated event');
                // Customer updates don't require immediate action
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
                console.log('Event data:', JSON.stringify(event.data, null, 2));
        }
        return c.json({ received: true });
    }
    catch (error) {
        console.error('Webhook processing error:', error);
        // Track analytics event for webhook processing error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'stripe_webhook',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for webhook error:', analyticsError);
        }
        return c.json({ error: 'webhook_processing_failed' }, 500);
    }
});
// Cancel subscription endpoint
// Helper function to start a trial for a user
// Helper function to check and update trial status
// Temporary endpoint to fix existing users with incorrect subscription data
app.post('/debug/fix-subscription/:uid', async (c) => {
    const uid = c.req.param('uid');
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!raw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(raw);
    console.log(`Fixing user ${uid}:`, user);
    // Fix users who have 'trial' status but no actual Stripe subscription - use new schema with fallbacks
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
        user.trialEndsAt = null;
        user.subscriptionStartedAt = null;
        await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
        console.log(`Fixed user ${uid}: reset to free plan`);
        return c.json({
            success: true,
            message: 'User subscription data fixed',
            before: { subscriptionStatus: 'trial', plan: 'pro' },
            after: { subscriptionStatus: 'none', plan: 'free' }
        });
    }
    return c.json({
        success: false,
        message: 'User does not need fixing',
        current: {
            subscriptionStatus: user.subscription?.status || user.subscriptionStatus || 'none',
            plan: user.plan,
            hasStripe: !!(user.subscription?.stripeCustomerId || user.stripeCustomerId || user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId)
        }
    });
});
// Temporary debug endpoint to check user data
app.get('/debug/user/:uid', async (c) => {
    const uid = c.req.param('uid');
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!raw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(raw);
    return c.json({
        uid: user.uid,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role,
        subscriptionStatus: user.subscription?.status || user.subscriptionStatus || 'none',
        trialEndsAt: user.subscription?.trialEnd || user.trialEndsAt,
        subscriptionStartedAt: user.subscription?.currentPeriodStart || user.subscriptionStartedAt,
        stripeCustomerId: user.subscription?.stripeCustomerId || user.stripeCustomerId,
        stripeSubscriptionId: user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId,
        canAccessPro: canAccessProFeatures(user),
        subscriptionDisplay: getSubscriptionDisplayStatus(user)
    });
});
// Temporary debug endpoint to check user by email
app.get('/debug/user-by-email/:email', async (c) => {
    const email = c.req.param('email');
    const uid = await c.env.KV_USERS.get(`user:byemail:${email}`);
    if (!uid)
        return c.json({ error: 'user_not_found' }, 404);
    const raw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!raw)
        return c.json({ error: 'user_data_not_found' }, 404);
    const user = JSON.parse(raw);
    return c.json({
        uid: user.uid,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role,
        subscriptionStatus: user.subscription?.status || user.subscriptionStatus || 'none',
        trialEndsAt: user.subscription?.trialEnd || user.trialEndsAt,
        subscriptionStartedAt: user.subscription?.currentPeriodStart || user.subscriptionStartedAt,
        stripeCustomerId: user.subscription?.stripeCustomerId || user.stripeCustomerId,
        stripeSubscriptionId: user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId,
        canAccessPro: canAccessProFeatures(user),
        subscriptionDisplay: getSubscriptionDisplayStatus(user),
        rawUser: user
    });
});
// Cleanup endpoint to fix all users with corrupted subscription data (superadmin only)
app.post('/admin/cleanup-corrupted-users', handleCleanupCorruptedUsers);
// Webhook handler functions
// ============================================================================
// DEBUG ENDPOINTS - Superadmin Only Access
// ============================================================================
// Helper function to check if user is superadmin
// List all users with pagination
app.get('/debug/users', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    const cursor = c.req.query('cursor');
    const limit = parseInt(c.req.query('limit') || '100');
    try {
        const list = await c.env.KV_USERS.list({
            prefix: 'user:',
            cursor: cursor || undefined,
            limit: Math.min(limit, 1000) // Cap at 1000 for safety
        });
        const users = [];
        for (const key of list.keys) {
            if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
                const userRaw = await c.env.KV_USERS.get(key.name);
                if (userRaw) {
                    const user = JSON.parse(userRaw);
                    // Remove sensitive fields
                    delete user.googleId;
                    delete user.passwordHash;
                    users.push(user);
                }
            }
        }
        return c.json({
            users,
            cursor: list.cursor,
            truncated: list.list_complete === false,
            total: users.length
        });
    }
    catch (error) {
        console.error('Debug users error:', error);
        // Track analytics event for debug users error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_users',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug users error:', analyticsError);
        }
        return c.json({ error: 'Failed to fetch users' }, 500);
    }
});
// Get specific user by UID
app.get('/debug/user/:uid', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    const uid = c.req.param('uid');
    try {
        const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
        if (!userRaw) {
            return c.json({ error: 'User not found' }, 404);
        }
        const user = JSON.parse(userRaw);
        // Remove sensitive fields
        delete user.googleId;
        delete user.passwordHash;
        return c.json(user);
    }
    catch (error) {
        console.error('Debug user error:', error);
        // Track analytics event for debug user error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_user',
                error: error.message || 'Unknown error',
                uid: uid
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug user error:', analyticsError);
        }
        return c.json({ error: 'Failed to fetch user' }, 500);
    }
});
// Search users by email
app.get('/debug/search/email/:email', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    const email = c.req.param('email');
    try {
        const list = await c.env.KV_USERS.list({ prefix: 'user:' });
        const users = [];
        for (const key of list.keys) {
            if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
                const userRaw = await c.env.KV_USERS.get(key.name);
                if (userRaw) {
                    const user = JSON.parse(userRaw);
                    if (user.email && user.email.toLowerCase().includes(email.toLowerCase())) {
                        // Remove sensitive fields
                        delete user.googleId;
                        delete user.passwordHash;
                        users.push(user);
                    }
                }
            }
        }
        return c.json({
            users,
            total: users.length,
            searchTerm: email
        });
    }
    catch (error) {
        console.error('Debug search error:', error);
        // Track analytics event for debug search error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_search',
                error: error.message || 'Unknown error',
                searchTerm: email
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug search error:', analyticsError);
        }
        return c.json({ error: 'Failed to search users' }, 500);
    }
});
// List all snapshots with pagination
app.get('/debug/snapshots', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    const cursor = c.req.query('cursor');
    const limit = parseInt(c.req.query('limit') || '100');
    try {
        const list = await c.env.KV_SNAPS.list({
            prefix: 'snap:',
            cursor: cursor || undefined,
            limit: Math.min(limit, 1000)
        });
        const snapshots = [];
        for (const key of list.keys) {
            if (key.name.startsWith('snap:') && !key.name.includes(':', 5)) {
                const snapRaw = await c.env.KV_SNAPS.get(key.name);
                if (snapRaw) {
                    const snapshot = JSON.parse(snapRaw);
                    snapshots.push(snapshot);
                }
            }
        }
        return c.json({
            snapshots,
            cursor: list.cursor,
            truncated: list.list_complete === false,
            total: snapshots.length
        });
    }
    catch (error) {
        console.error('Debug snapshots error:', error);
        // Track analytics event for debug snapshots error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_snapshots',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug snapshots error:', analyticsError);
        }
        return c.json({ error: 'Failed to fetch snapshots' }, 500);
    }
});
// Get specific snapshot by ID
app.get('/debug/snapshot/:id', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    const id = c.req.param('id');
    try {
        const snapRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
        if (!snapRaw) {
            return c.json({ error: 'Snapshot not found' }, 404);
        }
        const snapshot = JSON.parse(snapRaw);
        return c.json(snapshot);
    }
    catch (error) {
        console.error('Debug snapshot error:', error);
        // Track analytics event for debug snapshot error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_snapshot',
                error: error.message || 'Unknown error',
                snapshotId: id
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug snapshot error:', analyticsError);
        }
        return c.json({ error: 'Failed to fetch snapshot' }, 500);
    }
});
// Get system statistics
app.get('/debug/stats', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        // Count users
        const userList = await c.env.KV_USERS.list({ prefix: 'user:' });
        const userCount = userList.keys.filter((key) => key.name.startsWith('user:') && !key.name.includes(':', 5)).length;
        // Count snapshots
        const snapList = await c.env.KV_SNAPS.list({ prefix: 'snap:' });
        const snapCount = snapList.keys.filter((key) => key.name.startsWith('snap:') && !key.name.includes(':', 5)).length;
        // Count active sessions
        const sessionList = await c.env.KV_USERS.list({ prefix: 'session:' });
        const sessionCount = sessionList.keys.length;
        // Get subscription breakdown
        const users = [];
        for (const key of userList.keys) {
            if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
                const userRaw = await c.env.KV_USERS.get(key.name);
                if (userRaw) {
                    const user = JSON.parse(userRaw);
                    users.push(user);
                }
            }
        }
        const subscriptionStats = {
            free: users.filter(u => (u.subscription?.status || u.subscriptionStatus) === 'none' || (u.subscription?.status || u.subscriptionStatus) === 'Free').length,
            trial: users.filter(u => (u.subscription?.status || u.subscriptionStatus) === 'trial').length,
            active: users.filter(u => (u.subscription?.status || u.subscriptionStatus) === 'active').length,
            cancelled: users.filter(u => (u.subscription?.status || u.subscriptionStatus) === 'cancelled').length,
            pastDue: users.filter(u => (u.subscription?.status || u.subscriptionStatus) === 'past_due').length,
            superadmin: users.filter(u => u.role === 'superadmin').length
        };
        return c.json({
            system: {
                totalUsers: userCount,
                totalSnapshots: snapCount,
                activeSessions: sessionCount,
                timestamp: new Date().toISOString()
            },
            subscriptions: subscriptionStats,
            storage: {
                users: userList.keys.length,
                snapshots: snapList.keys.length,
                sessions: sessionList.keys.length
            }
        });
    }
    catch (error) {
        console.error('Debug stats error:', error);
        // Track analytics event for debug stats error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_stats',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug stats error:', analyticsError);
        }
        return c.json({ error: 'Failed to fetch system stats' }, 500);
    }
});
// Export all data for backup/analysis (superadmin only)
app.get('/debug/export', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        // Get all users
        const userList = await c.env.KV_USERS.list({ prefix: 'user:' });
        const users = [];
        for (const key of userList.keys) {
            if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
                const userRaw = await c.env.KV_USERS.get(key.name);
                if (userRaw) {
                    const user = JSON.parse(userRaw);
                    // Remove sensitive fields
                    delete user.googleId;
                    delete user.passwordHash;
                    users.push(user);
                }
            }
        }
        // Get all snapshots
        const snapList = await c.env.KV_SNAPS.list({ prefix: 'snap:' });
        const snapshots = [];
        for (const key of snapList.keys) {
            if (key.name.startsWith('snap:') && !key.name.includes(':', 5)) {
                const snapRaw = await c.env.KV_SNAPS.get(key.name);
                if (snapRaw) {
                    const snapshot = JSON.parse(snapRaw);
                    snapshots.push(snapshot);
                }
            }
        }
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            data: {
                users,
                snapshots,
                summary: {
                    totalUsers: users.length,
                    totalSnapshots: snapshots.length,
                    exportTimestamp: new Date().toISOString()
                }
            }
        };
        // Set headers for file download
        c.header('Content-Type', 'application/json');
        c.header('Content-Disposition', `attachment; filename="quickstage-export-${new Date().toISOString().split('T')[0]}.json"`);
        return c.json(exportData);
    }
    catch (error) {
        console.error('Debug export error:', error);
        // Track analytics event for debug export error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_export',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug export error:', analyticsError);
        }
        return c.json({ error: 'Failed to export data' }, 500);
    }
});
// Health check endpoint (public, no auth required)
app.get('/debug/health', async (c) => {
    try {
        // Simple health check without KV access to avoid timeouts
        return c.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                worker: 'operational'
            }
        });
    }
    catch (error) {
        console.error('Health check error:', error);
        return c.json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        }, 500);
    }
});
// Catch-all route for direct worker URL access
app.all('*', async (c) => {
    const url = new URL(c.req.url);
    console.log(`🔍 Direct worker URL access: ${c.req.method} ${url.pathname}`);
    // If accessing the direct worker URL, redirect to main domain
    if (url.hostname.includes('workers.dev')) {
        const mainDomain = 'https://quickstage.tech';
        const redirectUrl = `${mainDomain}${url.pathname}${url.search}`;
        return c.redirect(redirectUrl, 302);
    }
    // For other unmatched routes, return 404
    return c.json({
        error: 'Route not found',
        path: url.pathname,
        method: c.req.method,
        message: 'This endpoint is not available. Please use the main domain: https://quickstage.tech'
    }, 404);
});
// Test analytics endpoint (for debugging)
app.get('/debug/test-analytics', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        console.log('🔧 DEBUG: Testing analytics manually...');
        const analytics = getAnalyticsManager(c);
        const testUserId = 'test_analytics_' + Date.now();
        // Track a test extension download event
        console.log(`🔧 DEBUG: Tracking test extension_downloaded event for ${testUserId}`);
        await analytics.trackEvent(testUserId, 'extension_downloaded', {
            version: 'test-1.0.0',
            filename: 'test-quickstage.vsix',
            testEvent: true,
            timestamp: Date.now()
        });
        console.log('🔧 DEBUG: Test event tracking completed');
        // Try to retrieve recent events to see if it was stored
        console.log('🔧 DEBUG: Attempting to retrieve recent events...');
        const recentEvents = await c.env.KV_ANALYTICS.list({ prefix: 'event:', limit: 10 });
        console.log(`🔧 DEBUG: Found ${recentEvents.keys.length} recent event keys`);
        const events = [];
        for (const key of recentEvents.keys) {
            const eventData = await c.env.KV_ANALYTICS.get(key.name);
            if (eventData) {
                const event = JSON.parse(eventData);
                events.push({
                    id: event.id,
                    type: event.eventType,
                    userId: event.userId,
                    timestamp: event.timestamp,
                    isTestEvent: event.eventData?.testEvent || false
                });
            }
        }
        const testEvents = events.filter(e => e.isTestEvent);
        console.log(`🔧 DEBUG: Found ${testEvents.length} test events`);
        return c.json({
            message: 'Analytics test completed',
            testUserId,
            totalRecentEvents: events.length,
            testEventsFound: testEvents.length,
            events: events.slice(0, 5), // Return first 5 events
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('🔧 DEBUG: Analytics test failed:', error);
        return c.json({
            error: 'Analytics test failed',
            message: error.message,
            stack: error.stack
        }, 500);
    }
});
// Debug analytics events without time filter
app.get('/debug/analytics/events/all', async (c) => {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        console.log('🔧 DEBUG: Fetching ALL analytics events (no time filter)...');
        const limit = parseInt(c.req.query('limit') || '20');
        const list = await c.env.KV_ANALYTICS.list({
            prefix: 'event:',
            limit: Math.min(limit, 100)
        });
        console.log(`🔧 DEBUG: Found ${list.keys.length} event keys in KV`);
        const events = [];
        for (const key of list.keys) {
            if (key.name.startsWith('event:')) {
                const eventRaw = await c.env.KV_ANALYTICS.get(key.name);
                if (eventRaw) {
                    const event = JSON.parse(eventRaw);
                    console.log(`🔧 DEBUG: Event ${event.id}: ${event.eventType} at ${new Date(event.timestamp).toISOString()}`);
                    events.push({
                        id: event.id,
                        type: event.eventType,
                        userId: event.userId,
                        timestamp: event.timestamp,
                        page: event.eventData?.page || 'unknown',
                        eventData: event.eventData,
                        timestampISO: new Date(event.timestamp).toISOString()
                    });
                }
            }
        }
        // Sort by timestamp descending
        events.sort((a, b) => b.timestamp - a.timestamp);
        console.log(`🔧 DEBUG: Returning ${events.length} events`);
        return c.json({
            message: `Found ${events.length} total events`,
            events,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('🔧 DEBUG: Failed to fetch all events:', error);
        return c.json({
            error: 'Failed to fetch events',
            message: error.message
        }, 500);
    }
});
// Worker object that includes both the Hono app and scheduled handler
const worker = {
    fetch: app.fetch,
    scheduled: async (_event, env) => {
        await purgeExpired(env);
    },
};
export default worker;
