import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { Bindings, UserRecord, SnapshotRecord } from './types';
import { corsMiddleware } from './middleware/cors';
import { 
  createNewUserWithSchema, 
  createNewSnapshotWithSchema,
  migrateUserToNewSchema 
} from './migrate-schema';
import { CreateSnapshotBodySchema, FinalizeSnapshotBodySchema } from '@quickstage/shared/schemas';
import { DEFAULT_CAPS, VIEWER_COOKIE_PREFIX, ALLOW_MIME_PREFIXES } from '@quickstage/shared/index';
import { generateIdBase62, hashPasswordArgon2id, verifyPasswordHash, nowMs, randomHex, sha256Hex } from './utils';
import { signSession, verifySession, generatePassword } from '@quickstage/shared/cookies';
import { presignR2PutURL } from './s3presign';
import { getExtensionVersion } from './version-info';

// Import refactored modules
import { getUidFromSession, getUidFromPAT, getUidByStripeCustomerId, isSuperadmin } from './auth';

// Import route handlers
import * as AuthRoutes from './routes/auth';
import * as BillingRoutes from './routes/billing';
import * as SnapshotRoutes from './routes/snapshots';
import * as UploadRoutes from './routes/upload';
import * as ViewerRoutes from './routes/viewer';
import * as CommentRoutes from './routes/comments';
import * as AdminRoutes from './routes/admin';
import * as ApiRoutes from './routes/api';
import * as TokenRoutes from './routes/tokens';
import * as ExtensionRoutes from './routes/extensions';
import * as DebugRoutes from './routes/debug';
import * as WebhookRoutes from './routes/webhooks';
import { 
  getUserByName, 
  ensureUserByName, 
  getSubscriptionDisplayStatus, 
  canAccessProFeatures, 
  startFreeTrial, 
  startTrialForUser, 
  checkAndUpdateTrialStatus 
} from './user';
import { 
  handleCustomerCreated, 
  handleCheckoutSessionCompleted, 
  handleSubscriptionCreated, 
  handleSubscriptionUpdated, 
  handleSubscriptionDeleted, 
  handleCustomerDeleted, 
  handlePaymentSucceeded, 
  handlePaymentFailed 
} from './stripe';
import { incrementUniqueViewCount, purgeExpired } from './snapshot';
import { getAnalyticsManager } from './worker-utils';
import { 
  handleViewerById,
  handleViewerByIdWithPath,
  handleSnapByIdWithPath,
  handleSnapById,
  handleViewerGate
} from './routes/viewer';
import {
  handleGetSnapshotComments,
  handleGetComments,
  handlePostSnapshotComment,
  handleGetCommentsLegacy,
  handlePostCommentLegacy,
  handleGetSnapshotCommentsAlt,
  handlePostSnapshotCommentAlt
} from './routes/comments';
import {
  handlePurgeExpired,
  handleGetUsers,
  handleCreateUser,
  handleDeactivateUser,
  handleActivateUser,
  handleDeleteUser,
  handleSetupSuperadmin,
  handleCleanupCorruptedUsers
} from './routes/admin';



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
app.post('/upload-url', async (c: any) => {
  let uid = await getUidFromSession(c);
  if (!uid) {
    // Try PAT authentication as fallback
    const authHeader = c.req.header('authorization') || c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      uid = await getUidFromPAT(c, token);
    }
  }
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.query('id');
  const p = c.req.query('path');
  const ct = c.req.query('ct') || 'application/octet-stream';
  const sz = Number(c.req.query('sz') || '0');
  if (!id || !p) return c.json({ error: 'bad_request' }, 400);
  if (p.includes('..')) return c.json({ error: 'bad_path' }, 400);
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'forbidden' }, 403);
  
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
  
  if (sz > meta.caps.maxFile) return c.json({ error: 'file_too_large' }, 400);
  if (!ALLOW_MIME_PREFIXES.some((x) => String(ct).startsWith(x))) return c.json({ error: 'type_not_allowed' }, 400);
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
app.put('/upload', async (c: any) => {
  let uid = await getUidFromSession(c);
  if (!uid) {
    // Try PAT authentication as fallback
    const authHeader = c.req.header('authorization') || c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      uid = await getUidFromPAT(c, token);
    }
  }
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.query('id');
  const p = c.req.query('path');
  const ct = c.req.header('content-type') || 'application/octet-stream';
  const sz = Number(c.req.header('content-length') || '0');
  const h = c.req.query('h') || '';
  if (!id || !p) return c.json({ error: 'bad_request' }, 400);
  if (p.includes('..')) return c.json({ error: 'bad_path' }, 400);
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'forbidden' }, 403);
  
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
  
  if (sz > meta.caps.maxFile) return c.json({ error: 'file_too_large' }, 400);
  if (!ALLOW_MIME_PREFIXES.some((prefix) => ct.startsWith(prefix))) return c.json({ error: 'type_not_allowed' }, 400);
  const objectKey = `snap/${id}/${p}`;
  const body = c.req.raw.body;
  if (!body) return c.json({ error: 'no_body' }, 400);
  
  try {
    await c.env.R2_SNAPSHOTS.put(objectKey, body, { httpMetadata: { contentType: ct } });
    return c.json({ ok: true });
  } catch (error) {
    console.error('R2 upload failed:', error);
    return c.json({ error: 'upload_failed', details: String(error) }, 500);
  }
});

// API version of upload endpoint for extension
app.put('/api/upload', async (c: any) => {
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
    if (!uid) return c.json({ error: 'unauthorized' }, 401);
    
    const id = c.req.query('id');
    const p = c.req.query('path');
    const ct = c.req.header('content-type') || 'application/octet-stream';
    const sz = Number(c.req.header('content-length') || '0');
    const h = c.req.query('h') || '';
    
    console.log('Upload params:', { id, path: p, contentType: ct, size: sz });
    
    if (!id || !p) return c.json({ error: 'bad_request', details: 'Missing id or path' }, 400);
    if (p.includes('..')) return c.json({ error: 'bad_path', details: 'Path contains invalid characters' }, 400);
    
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw) return c.json({ error: 'not_found', details: 'Snapshot not found' }, 404);
    
    console.log('Raw snapshot data from KV:', metaRaw);
    const meta = JSON.parse(metaRaw);
    console.log('Parsed snapshot meta:', { id: meta.id, ownerUid: meta.ownerUid, caps: meta.caps, hasCaps: !!meta.caps, capsType: typeof meta.caps });
    
    if (meta.ownerUid !== uid) return c.json({ error: 'forbidden', details: 'Not owner of snapshot' }, 403);
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
    
    if (sz > meta.caps.maxFile) return c.json({ error: 'file_too_large', details: `File size ${sz} exceeds limit ${meta.caps.maxFile}` }, 400);
    if (!ALLOW_MIME_PREFIXES.some((prefix) => ct.startsWith(prefix))) return c.json({ error: 'type_not_allowed', details: `Content type ${ct} not allowed` }, 400);
    
    const objectKey = `snap/${id}/${p}`;
    const body = c.req.raw.body;
    if (!body) return c.json({ error: 'no_body', details: 'No request body' }, 400);
    
    console.log('Attempting R2 upload to:', objectKey);
    
    try {
      await c.env.R2_SNAPSHOTS.put(objectKey, body, { httpMetadata: { contentType: ct } });
      console.log('R2 upload successful');
      return c.json({ ok: true });
    } catch (error) {
      console.error('R2 upload failed:', error);
      return c.json({ error: 'upload_failed', details: String(error) }, 500);
    }
  } catch (error) {
    console.error('Unexpected error in upload endpoint:', error);
    return c.json({ error: 'internal_error', details: String(error) }, 500);
  }
});

// Finalize snapshot
app.post('/snapshots/finalize', SnapshotRoutes.handleFinalizeSnapshot);




  


// Add /snapshots/list route BEFORE /snapshots/:id to avoid conflicts
app.get('/snapshots/list', SnapshotRoutes.handleListSnapshots);

// Get individual snapshot details
app.get('/snapshots/:id', async (c: any) => {
  const id = c.req.param('id');
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  
  const meta = JSON.parse(metaRaw);
  if (meta.status === 'expired' || meta.expiresAt < nowMs()) {
    return c.json({ error: 'gone' }, 410);
  }
  // Normalize legacy file entries for viewer compatibility
  if (Array.isArray(meta.files)) {
    meta.files = meta.files.map((f: any) => ({
      name: f?.name || f?.p || '',
      size: typeof f?.size === 'number' ? f.size : Number(f?.sz || 0),
      type: f?.type || f?.ct || 'application/octet-stream',
      hash: f?.hash || f?.h,
    }));
  } else {
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
  } else {
    // Password protected snapshots require authentication
    return c.json({ error: 'unauthorized' }, 401);
  }
});

// Expire
app.post('/snapshots/:id/expire', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'forbidden' }, 403);
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
app.post('/snapshots/:id/extend', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const body: any = await c.req.json();
  const days: number = Number(body?.days || 1);
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'forbidden' }, 403);
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
app.post('/snapshots/:id/rotate-password', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'forbidden' }, 403);
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
app.get('/api/snapshots/list', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  // Track analytics event for page view
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'page_view', { page: '/api/snapshots/list' });
  
  const listJson = await c.env.KV_USERS.get(`user:${uid}:snapshots`) || '[]';
  const ids: string[] = JSON.parse(listJson);
  
  const snapshots = [];
  for (const id of ids) {
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw);
        // Always include the snapshot, let the frontend handle filtering
        snapshots.push({
          id: meta.id,
          name: meta.name || `Snapshot ${meta.id.slice(0, 8)}`,
          createdAt: meta.createdAt,
          expiresAt: meta.expiresAt,
                      password: meta.password || (meta.passwordHash ? 'Password protected' : null),
          isPublic: meta.public || false,
          viewCount: meta.viewCount || 0
        });
      } catch {}
    }
  }
  
  // Sort snapshots by createdAt in descending order (newest first)
  snapshots.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  return c.json({ snapshots });
});

// API version of snapshot details endpoint (for Viewer component)
app.get('/api/snapshots/:id', async (c: any) => {
  const id = c.req.param('id');
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  
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
  } else {
    // Password protected snapshots require authentication
    return c.json({ error: 'unauthorized' }, 401);
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

// Snapshot comments endpoints
app.get('/api/snapshots/:id/comments', handleGetSnapshotComments);

// Get comments for a snapshot (public endpoint) - Removed to avoid conflict with the more robust implementation below

app.post('/api/snapshots/:id/comments', handlePostSnapshotComment);

// Legacy comments endpoints for backward compatibility
app.get('/comments', handleGetCommentsLegacy);

app.post('/comments', handlePostCommentLegacy);

// Cron purge
app.get('/admin/purge-expired', handlePurgeExpired);

// Add /api prefixed routes for Cloudflare routing
app.post('/api/snapshots/:id/extend', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const body: any = await c.req.json();
  const days: number = Number(body?.days || 1);
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'forbidden' }, 403);
  const cap = DEFAULT_CAPS.maxDays;
  const added = Math.min(Math.max(1, days || 1), cap);
  meta.expiresAt += added * 24 * 60 * 60 * 1000;
  await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
  return c.json({ ok: true, expiresAt: meta.expiresAt });
});

app.post('/api/snapshots/:id/expire', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'forbidden' }, 403);
  meta.status = 'expired';
  meta.expiresAt = nowMs() - 1000;
  await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
  // Don't remove from index - keep expired snapshots visible when "All" is selected
  return c.json({ ok: true });
});

app.post('/api/snapshots/:id/rotate-password', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  const id = c.req.param('id');
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'forbidden' }, 403);
  const newPass = generatePassword(20);
  const saltHex = randomHex(8);
  meta.passwordHash = await hashPasswordArgon2id(newPass, saltHex);
  meta.password = newPass; // Store plain text password for display
  await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
  return c.json({ password: newPass });
});

// Add /api prefixed routes for Cloudflare routing
app.post('/api/auth/google', AuthRoutes.handleGoogleAuth);

app.get('/api/me', AuthRoutes.handleMe);

// Admin endpoints
app.get('/admin/users', handleGetUsers);

app.post('/admin/users', handleCreateUser);

app.post('/admin/users/:uid/deactivate', handleDeactivateUser);

app.post('/admin/users/:uid/activate', handleActivateUser);

// Delete user completely (superadmin only)
app.delete('/admin/users/:uid', handleDeleteUser);

// Create superadmin user (one-time setup)
app.post('/admin/setup-superadmin', handleSetupSuperadmin);



// Add missing /api endpoints for the extension
app.post('/api/snapshots/create', async (c: any) => {
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
    } catch (analyticsError) {
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
    status: 'uploading' as const,
    gateVersion: 1,
  };
  
  await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(snapshot));
  
  // Add to user's snapshot list
  const listJson = await c.env.KV_USERS.get(`user:${uid}:snapshots`) || '[]';
  const ids: string[] = JSON.parse(listJson);
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
});

// PAT (Personal Access Token) endpoints for extension authentication
app.post('/api/tokens/create', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/api/tokens/create',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
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
  const patIds: string[] = JSON.parse(patListJson);
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

app.get('/api/tokens/list', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  // Track analytics event for page view
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'page_view', { page: '/api/tokens/list' });
  
  const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
  const patIds: string[] = JSON.parse(patListJson);
  
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

app.delete('/api/tokens/:tokenId', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/api/tokens/:tokenId',
        method: 'DELETE'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const tokenId = c.req.param('tokenId');
  const fullToken = `qs_pat_${tokenId}`;
  
  // Verify ownership
  const patData = await c.env.KV_USERS.get(`pat:${fullToken}`);
  if (!patData) return c.json({ error: 'not_found' }, 404);
  
  const pat = JSON.parse(patData);
  if (pat.userId !== uid) return c.json({ error: 'forbidden' }, 403);
  
  // Remove PAT
  await c.env.KV_USERS.delete(`pat:${fullToken}`);
  
  // Remove from user's PAT list
  const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
  const patIds: string[] = JSON.parse(patListJson);
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





// Add tokens endpoints without /api prefix for web app compatibility
app.post('/tokens/create', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
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
  const patIds: string[] = JSON.parse(patListJson);
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

app.get('/tokens/list', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
  const patIds: string[] = JSON.parse(patListJson);
  
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

app.delete('/tokens/:tokenId', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/tokens/:tokenId',
        method: 'DELETE'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const tokenId = c.req.param('tokenId');
  const fullToken = `qs_pat_${tokenId}`;
  
  // Verify ownership
  const patData = await c.env.KV_USERS.get(`pat:${fullToken}`);
  if (!patData) return c.json({ error: 'not_found' }, 404);
  
  const pat = JSON.parse(patData);
  if (pat.userId !== uid) return c.json({ error: 'forbidden' }, 403);
  
  // Remove PAT
  await c.env.KV_USERS.put(`pat:${fullToken}`, JSON.stringify(patData));
  
  // Remove from user's PAT list
  const patListJson = await c.env.KV_USERS.get(`user:${uid}:pats`) || '[]';
  const patIds: string[] = JSON.parse(patListJson);
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

app.post('/api/upload-url', async (c: any) => {
  let uid = await getUidFromSession(c);
  if (!uid) {
    // Try PAT authentication as fallback
    const authHeader = c.req.header('authorization') || c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      uid = await getUidFromPAT(c, token);
    }
  }
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  const { id, path: filePath, ct: contentType, sz: size, h: hash } = c.req.query();
  if (!id || !filePath || !contentType || !size || !hash) {
    return c.json({ error: 'missing_parameters' }, 400);
  }
  
  // Verify snapshot ownership
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'snapshot_not_found' }, 404);
  
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'unauthorized' }, 401);
  
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

app.post('/api/snapshots/finalize', async (c: any) => {
  let uid = await getUidFromSession(c);
  if (!uid) {
    // Try PAT authentication as fallback
    const authHeader = c.req.header('authorization') || c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      uid = await getUidFromPAT(c, token);
    }
  }
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  const { id, totalBytes, files } = await c.req.json();
  if (!id || totalBytes === undefined || !files) {
    return c.json({ error: 'missing_parameters' }, 400);
  }
  
  // Verify snapshot ownership
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'snapshot_not_found' }, 404);
  
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'unauthorized' }, 401);
  
  // Update snapshot metadata with normalized files
  meta.status = 'ready';
  meta.totalBytes = typeof totalBytes === 'number' ? totalBytes : Number(totalBytes || 0);
  meta.files = (files || []).map((f: any) => ({
    name: f.name || f.p,
    size: typeof f.size === 'number' ? f.size : Number(f.sz || 0),
    type: f.type || f.ct || 'application/octet-stream',
    hash: f.hash || f.h,
  }));
  await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
  
  return c.json({ ok: true });
});



// Add snapshot serving endpoint for /api/s/:id/*
app.get('/api/s/:id/*', async (c: any) => {
  const id = c.req.param('id');
  const path = c.req.param('*');
  
  if (!id || !path) return c.json({ error: 'invalid_path' }, 400);
  
  // Get snapshot metadata
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'snapshot_not_found' }, 404);
  
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
  
  if (!obj) return c.json({ error: 'file_not_found' }, 404);
  
  // Return file with appropriate headers
  const headers = new Headers();
  if (obj.httpMetadata?.contentType) {
    headers.set('Content-Type', obj.httpMetadata.contentType);
  }
  headers.set('Cache-Control', 'public, max-age=3600');
  
  return new Response(obj.body, { headers });
});

// Add extension version endpoint
app.get('/api/extensions/version', async (c: any) => {
  try {
    const versionInfo = getExtensionVersion();
    return c.json({
      version: versionInfo.version,
      buildDate: versionInfo.buildDate,
      checksum: 'direct-serve', // No longer serving VSIX content
      downloadUrl: '/quickstage.vsix', // Direct from web app
      filename: 'quickstage.vsix'
    });
  } catch (error) {
    console.error('Error serving version info:', error);
    return c.json({ error: 'version_info_unavailable' }, 500);
  }
});

// Protected VSIX download endpoint - requires active subscription or trial
app.get('/api/extensions/download', async (c: any) => {
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
  
  const user: UserRecord = JSON.parse(userRaw);
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
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'extension_downloaded', { 
      version: getExtensionVersion().version,
      filename: filename
    });
    
    return new Response(vsixData, { headers });
    
  } catch (error) {
    console.error('Error serving VSIX download:', error);
    return c.json({ error: 'download_failed' }, 500);
  }
});

// Add extensions endpoints without /api prefix for web app compatibility
app.get('/extensions/version', async (c: any) => {
  try {
    const versionInfo = getExtensionVersion();
    return c.json({
      version: versionInfo.version,
      buildDate: versionInfo.buildDate,
      checksum: 'direct-serve', // No longer serving VSIX content
      downloadUrl: '/quickstage.vsix', // Direct from web app
      filename: 'quickstage.vsix'
    });
  } catch (error) {
    console.error('Error serving version info:', error);
    return c.json({ error: 'version_info_unavailable' }, 500);
  }
});

app.get('/extensions/download', async (c: any) => {
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
  
  const user: UserRecord = JSON.parse(userRaw);
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
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'extension_downloaded', { 
      version: versionInfo.version,
      filename: filename
    });
    
    return new Response(vsixData, { headers });
    
  } catch (error) {
    console.error('Error serving VSIX download:', error);
    return c.json({ error: 'download_failed' }, 500);
  }
});

// Comments endpoints (robust implementation with error handling and logging)
app.get('/comments/:snapshotId', handleGetSnapshotCommentsAlt);

app.post('/comments/:snapshotId', handlePostSnapshotCommentAlt);

// Analytics tracking endpoint
app.post('/analytics/track', async (c: any) => {
  const { handleAnalyticsTrack } = await import('./routes/analytics');
  return handleAnalyticsTrack(c);
});

// Original web app serving (keep as primary)
// Extension is served directly from web app public directory



const worker = {
  fetch: app.fetch,
  scheduled: async (_event: any, env: Bindings) => {
    await purgeExpired(env);
  },
};

// Get analytics events (superadmin only)
app.get('/debug/analytics/events', async (c: any) => {
  const { handleDebugAnalyticsEvents } = await import('./routes/debug');
  return handleDebugAnalyticsEvents(c);
});

// Migration system endpoints (superadmin only)
app.get('/debug/migration/stats', async (c: any) => {
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
  } catch (error: any) {
    console.error('Migration stats error:', error);
    return c.json({ error: 'Failed to get migration stats' }, 500);
  }
});

app.post('/debug/migration/run', async (c: any) => {
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
    } catch (analyticsError) {
      console.error('Failed to track analytics for migration:', analyticsError);
    }
    
    return c.json({
      success: result.success,
      result,
      message: `Migration completed: ${result.migrated} migrated, ${result.errors} errors`
    });
  } catch (error: any) {
    console.error('Migration run error:', error);
    
    // Track analytics event for migration error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'migration_run',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for migration error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to run migration' }, 500);
  }
});

app.post('/debug/migration/users', async (c: any) => {
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
    } catch (analyticsError) {
      console.error('Failed to track analytics for user migration:', analyticsError);
    }
    
    return c.json({
      success: result.success,
      result,
      message: `User migration completed: ${result.migrated} migrated, ${result.errors} errors`
    });
  } catch (error: any) {
    console.error('User migration error:', error);
    return c.json({ error: 'Failed to run user migration' }, 500);
  }
});

app.post('/debug/migration/snapshots', async (c: any) => {
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
    } catch (analyticsError) {
      console.error('Failed to track analytics for snapshot migration:', analyticsError);
    }
    
    return c.json({
      success: result.success,
      result,
      message: `Snapshot migration completed: ${result.migrated} migrated, ${result.errors} errors`
    });
  } catch (error: any) {
    console.error('Snapshot migration error:', error);
    return c.json({ error: 'Failed to run snapshot migration' }, 500);
  }
});

export default worker;
export { CommentsRoom } from './comments';

// Stripe billing endpoints
app.post('/billing/checkout', BillingRoutes.handleCheckout);

// Change payment method endpoint
app.post('/billing/change-payment', BillingRoutes.handleChangePayment);

app.post('/billing/portal', BillingRoutes.handleBillingPortal);

// Stripe webhook endpoint
app.post('/webhooks/stripe', async (c: any) => {
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
    const rawBody = await c.req.text();
    
    if (!sig) {
      console.error('No Stripe signature found');
      return c.json({ error: 'no_signature' }, 400);
    }
    
    let event: any;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        sig,
        c.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
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
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Track analytics event for webhook processing error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'stripe_webhook',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for webhook error:', analyticsError);
    }
    
    return c.json({ error: 'webhook_processing_failed' }, 500);
  }
});



// Cancel subscription endpoint

// Helper function to start a trial for a user

// Helper function to check and update trial status

// Temporary endpoint to fix existing users with incorrect subscription data
app.post('/debug/fix-subscription/:uid', async (c: any) => {
  const uid = c.req.param('uid');
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return c.json({ error: 'user_not_found' }, 404);
  
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
app.get('/debug/user/:uid', async (c: any) => {
  const uid = c.req.param('uid');
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return c.json({ error: 'user_not_found' }, 404);
  
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
app.get('/debug/user-by-email/:email', async (c: any) => {
  const email = c.req.param('email');
  const uid = await c.env.KV_USERS.get(`user:byemail:${email}`);
  if (!uid) return c.json({ error: 'user_not_found' }, 404);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return c.json({ error: 'user_data_not_found' }, 404);
  
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
app.get('/debug/users', async (c: any) => {
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
  } catch (error: any) {
    console.error('Debug users error:', error);
    
    // Track analytics event for debug users error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_users',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug users error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Get specific user by UID
app.get('/debug/user/:uid', async (c: any) => {
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
  } catch (error: any) {
    console.error('Debug user error:', error);
    
    // Track analytics event for debug user error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_user',
        error: error.message || 'Unknown error',
        uid: uid
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug user error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Search users by email
app.get('/debug/search/email/:email', async (c: any) => {
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
  } catch (error: any) {
    console.error('Debug search error:', error);
    
    // Track analytics event for debug search error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_search',
        error: error.message || 'Unknown error',
        searchTerm: email
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug search error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to search users' }, 500);
  }
});

// List all snapshots with pagination
app.get('/debug/snapshots', async (c: any) => {
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
  } catch (error: any) {
    console.error('Debug snapshots error:', error);
    
    // Track analytics event for debug snapshots error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_snapshots',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug snapshots error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to fetch snapshots' }, 500);
  }
});

// Get specific snapshot by ID
app.get('/debug/snapshot/:id', async (c: any) => {
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
  } catch (error: any) {
    console.error('Debug snapshot error:', error);
    
    // Track analytics event for debug snapshot error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_snapshot',
        error: error.message || 'Unknown error',
        snapshotId: id
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug snapshot error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to fetch snapshot' }, 500);
  }
});

// Get system statistics
app.get('/debug/stats', async (c: any) => {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    // Count users
    const userList = await c.env.KV_USERS.list({ prefix: 'user:' });
    const userCount = userList.keys.filter((key: any) => 
      key.name.startsWith('user:') && !key.name.includes(':', 5)
    ).length;
    
    // Count snapshots
    const snapList = await c.env.KV_SNAPS.list({ prefix: 'snap:' });
    const snapCount = snapList.keys.filter((key: any) => 
      key.name.startsWith('snap:') && !key.name.includes(':', 5)
    ).length;
    
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
  } catch (error: any) {
    console.error('Debug stats error:', error);
    
    // Track analytics event for debug stats error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_stats',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug stats error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to fetch system stats' }, 500);
  }
});

// Export all data for backup/analysis (superadmin only)
app.get('/debug/export', async (c: any) => {
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
  } catch (error: any) {
    console.error('Debug export error:', error);
    
    // Track analytics event for debug export error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_export',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug export error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to export data' }, 500);
  }
});

// Health check endpoint (public, no auth required)
app.get('/debug/health', async (c: any) => {
  try {
    // Test KV access
    const userCount = await c.env.KV_USERS.list({ prefix: 'user:', limit: 1 });
    const snapCount = await c.env.KV_SNAPS.list({ prefix: 'snap:', limit: 1 });
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        kv_users: 'operational',
        kv_snapshots: 'operational',
        worker: 'operational'
      },
      metrics: {
        userKeys: userCount.keys.length,
        snapshotKeys: snapCount.keys.length
      }
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    
    // Track analytics event for health check error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'health_check',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for health check error:', analyticsError);
    }
    
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }, 500);
  }
});


