import { getUidFromSession } from '../auth';
import { generateIdBase62 } from '../utils';
import { getAnalyticsManager } from '../worker-utils';

// Token route handlers
export async function handleCreateToken(c: any) {
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
}

export async function handleListTokens(c: any) {
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
}

export async function handleDeleteToken(c: any) {
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
}