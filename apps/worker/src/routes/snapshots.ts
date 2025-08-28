import { getUidFromSession, getUidFromPAT } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
import { CreateSnapshotBodySchema, FinalizeSnapshotBodySchema } from '@quickstage/shared/schemas';
import { DEFAULT_CAPS, VIEWER_COOKIE_PREFIX, ALLOW_MIME_PREFIXES } from '@quickstage/shared/index';
import { generateIdBase62, hashPasswordArgon2id, nowMs, randomHex } from '../utils';
import { generatePassword } from '@quickstage/shared/cookies';

// Snapshot route handlers
export async function handleCreateSnapshot(c: any) {
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
        endpoint: '/snapshots/create',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  const body = await c.req.json();
  const parsed = CreateSnapshotBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request', details: parsed.error.format() }, 400);
  const { expiryDays = 7, password = null, public: isPublic = false } = parsed.data;

  // Quota: count active snapshots
  const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
  const activeIds: string[] = JSON.parse(listJson);
  if (activeIds.length >= 10) return c.json({ error: 'quota_exceeded' }, 403);
  
  // Add retry logic for KV read operations
  const maxRetriesRead = 3;
  let retryCountRead = 0;
  
  while (retryCountRead < maxRetriesRead) {
    try {
      const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
      const activeIds: string[] = JSON.parse(listJson);
      if (activeIds.length >= 10) return c.json({ error: 'quota_exceeded' }, 403);
      break; // Success, exit retry loop
    } catch (error: any) {
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
    password: realPassword, // Store plain text password for display
    totalBytes: 0,
    files: [],
    views: { m: new Date().toISOString().slice(0, 7).replace('-', ''), n: 0 },
    commentsCount: 0,
    public: Boolean(isPublic),
    caps: DEFAULT_CAPS,
    status: 'creating' as const,
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
    } catch (error: any) {
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
}

export async function handleFinalizeSnapshot(c: any) {
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
  const body = await c.req.json();
  const parsed = FinalizeSnapshotBodySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad_request', details: parsed.error.format() }, 400);
  const { id, totalBytes, files } = parsed.data;
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.json({ error: 'not_found' }, 404);
  const meta = JSON.parse(metaRaw);
  if (meta.ownerUid !== uid) return c.json({ error: 'forbidden' }, 403);
  if (totalBytes > meta.caps.maxBytes) return c.json({ error: 'bundle_too_large' }, 400);
  // Normalize file metadata shape for the viewer
  const normalizedFiles = (files || []).map((f: any) => ({
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
    } catch (error: any) {
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
  const ids: string[] = JSON.parse(listJson);
  ids.unshift(id);
  
  retryCountWrite = 0;
  while (retryCountWrite < maxRetriesWrite) {
    try {
      await c.env.KV_USERS.put(`user:${uid}:snapshots`, JSON.stringify(ids.slice(0, 100)));
      break; // Success, exit retry loop
    } catch (error: any) {
      retryCountWrite++;
      if (error.message?.includes('429') && retryCountWrite < maxRetriesWrite) {
        console.log(`KV write failed with 429, retrying (${retryCountWrite}/${maxRetriesWrite})...`);
        // Wait with exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCountWrite - 1) * 1000));
        break;
      }
      throw error; // Re-throw if max retries reached or non-429 error
    }
  }
  
  // Track analytics event
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'snapshot_created', { 
    snapshotId: id, 
    expiryDays: Math.ceil((meta.expiresAt - meta.createdAt) / (24 * 60 * 60 * 1000)),
    isPublic: meta.public || false
  });
  
  return c.json({ url: `${c.env.PUBLIC_BASE_URL}/s/${id}`, password: 'hidden' });
}

export async function handleListSnapshots(c: any) {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  // Track analytics event for page view
  const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'page_view', { page: 'Dashboard' });
  
  const listJson = (await c.env.KV_USERS.get(`user:${uid}:snapshots`)) || '[]';
  const ids: string[] = JSON.parse(listJson);
  
  const metas = await Promise.all(
    ids.map(async (id) => JSON.parse((await c.env.KV_SNAPS.get(`snap:${id}`)) || '{}')),
  );
  
  // Sort snapshots by createdAt in descending order (newest first)
  const sortedMetas = metas.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  return c.json({ data: { snapshots: sortedMetas.map((m) => ({ 
    id: m.id, 
    name: m.name || `Snapshot ${m.id.slice(0, 8)}`,
    createdAt: m.createdAt, 
    expiresAt: m.expiresAt, 
    totalBytes: m.totalBytes, 
    status: m.status,
    password: m.password || (m.passwordHash ? 'Password protected' : null),
    isPublic: m.public || false,
    viewCount: m.viewCount || 0
  })) } });
}

export async function handleGetSnapshot(c: any) {
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
}

export async function handleExpireSnapshot(c: any) {
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
}

export async function handleExtendSnapshot(c: any) {
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
}

export async function handleRotateSnapshotPassword(c: any) {
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
}