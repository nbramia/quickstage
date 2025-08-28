import { verifySession } from '@quickstage/shared/cookies';
import { UserRecord } from './types';

/**
 * Authentication utilities for the QuickStage Worker
 * Handles session verification, PAT authentication, and superadmin checks
 */

/**
 * Extract user ID from session token in Authorization header
 */
export async function getUidFromSession(c: any): Promise<string | null> {
  // Only use Authorization header - much simpler
  const auth = c.req.header('authorization') || c.req.header('Authorization');
  
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  
  const token = auth.slice(7);
  
  if (!token) {
    return null;
  }
  
  try {
    const data = await verifySession(token, c.env.SESSION_HMAC_SECRET);
    return data && data.uid ? String(data.uid) : null;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

/**
 * Extract user ID from Personal Access Token (PAT)
 * Requires pro subscription for PAT usage
 */
export async function getUidFromPAT(c: any, token: string): Promise<string | null> {
  const patData = await c.env.KV_USERS.get(`pat:${token}`);
  if (!patData) return null;
  
  const pat = JSON.parse(patData);
  if (pat.expiresAt < Date.now()) return null;
  
  // Check if user has access to pro features (subscription required for PAT usage)
  const userRaw = await c.env.KV_USERS.get(`user:${pat.userId}`);
  if (!userRaw) return null;
  
  const user: UserRecord = JSON.parse(userRaw);
  if (!canAccessProFeatures(user)) {
    const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
    console.log(`PAT access denied for user ${pat.userId}: subscription status ${subscriptionStatus}`);
    return null; // PAT is invalid if subscription is cancelled
  }
  
  // Update last used timestamp
  pat.lastUsed = Date.now();
  await c.env.KV_USERS.put(`pat:${token}`, JSON.stringify(pat));
  
  return pat.userId;
}

/**
 * Find user ID by Stripe customer ID
 * Searches through all users to find matching customer ID
 */
export async function getUidByStripeCustomerId(c: any, customerId: string): Promise<string | null> {
  let cursor: string | undefined = undefined;
  
  do {
    const list = await c.env.KV_USERS.list({ prefix: 'user:', cursor });
    cursor = list.cursor as string | undefined;
    
    for (const key of list.keys) {
      if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
        const userRaw = await c.env.KV_USERS.get(key.name);
        if (userRaw) {
          const user = JSON.parse(userRaw);
          // Check both new and legacy fields
          if ((user.subscription?.stripeCustomerId || user.stripeCustomerId) === customerId) {
            return user.uid;
          }
        }
      }
    }
  } while (cursor);
  
  return null;
}

/**
 * Check if the current user is a superadmin
 */
export async function isSuperadmin(c: any): Promise<boolean> {
  const uid = await getUidFromSession(c);
  if (!uid) return false;
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return false;
  
  const user = JSON.parse(userRaw);
  return user.role === 'superadmin';
}

/**
 * Check if user can access pro features
 * Used by PAT authentication to verify subscription status
 */
function canAccessProFeatures(user: UserRecord): boolean {
  // Check new schema first, then fall back to legacy
  const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
  const plan = user.plan || 'free';
  
  // Superadmin always has access
  if (user.role === 'superadmin') return true;
  
  // Check subscription status
  if (subscriptionStatus === 'active' || subscriptionStatus === 'trial') return true;
  
  // Legacy plan check
  if (plan === 'pro') return true;
  
  return false;
}
