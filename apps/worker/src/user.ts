import { UserRecord } from './types';
import { generateIdBase62 } from './utils';

/**
 * User management utilities for the QuickStage Worker
 * Handles user creation, subscription management, and trial logic
 */

/**
 * Get user by username
 */
export async function getUserByName(c: any, name: string): Promise<UserRecord | null> {
  const uid = await c.env.KV_USERS.get(`user:byname:${name}`);
  if (!uid) return null;
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Ensure user exists by name, create if not found
 */
export async function ensureUserByName(c: any, name: string): Promise<UserRecord> {
  let user = await getUserByName(c, name);
  if (user) return user;
  
  const uid = generateIdBase62(16);
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
      totalCommentsReceived: 0
    },
    onboarding: {
      hasSeenWelcome: false,
      completedTutorials: [],
    }
  };
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  await c.env.KV_USERS.put(`user:byname:${name}`, uid);
  
  return user as UserRecord;
}

/**
 * Get subscription display status for UI
 */
export function getSubscriptionDisplayStatus(user: UserRecord): 'Free Trial' | 'Pro' | 'Cancelled' | 'Past Due' | 'None' | 'Superadmin' {
  // Superadmin gets special status
  if (user.role === 'superadmin') return 'Superadmin';
  
  // Use new subscription.status field, fallback to legacy subscriptionStatus for backward compatibility
  const status = user.subscription?.status || user.subscriptionStatus || 'none';
  
  if (status === 'none') return 'None';
  if (status === 'trial') return 'Free Trial';
  if (status === 'active') return 'Pro';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'past_due') return 'Past Due';
  return 'None';
}

/**
 * Check if user can access pro features
 */
export function canAccessProFeatures(user: UserRecord): boolean {
  // Superadmin can always access
  if (user.role === 'superadmin') return true;
  
  const now = Date.now();
  
  // Use new subscription.status field, fallback to legacy subscriptionStatus for backward compatibility
  const status = user.subscription?.status || user.subscriptionStatus || 'none';
  
  // Active subscription
  if (status === 'active') return true;
  
  // Trial period - check both new and legacy trial fields
  if (status === 'trial') {
    const trialEndsAt = user.subscription?.trialEnd || user.trialEndsAt;
    if (trialEndsAt && now < trialEndsAt) {
      return true;
    }
  }
  
  return false;
}

/**
 * Start free trial for a user
 */
export function startFreeTrial(user: UserRecord): void {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  
  // Update new subscription schema
  if (!user.subscription) {
    user.subscription = { status: 'trial' };
  } else {
    user.subscription.status = 'trial';
  }
  user.subscription.trialStart = now;
  user.subscription.trialEnd = now + sevenDays;
  
  // Update legacy fields for backward compatibility
  user.subscriptionStatus = 'trial';
  user.trialStartedAt = now;
  user.trialEndsAt = now + sevenDays;
  
  user.plan = 'pro'; // Give pro features during trial
}

/**
 * Start trial for a user and save to database
 */
export async function startTrialForUser(c: any, user: UserRecord): Promise<void> {
  const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
  if (!subscriptionStatus || subscriptionStatus === 'none') {
    // Initialize subscription object if it doesn't exist
    if (!user.subscription) {
      user.subscription = { status: 'trial' };
    } else {
      user.subscription.status = 'trial';
    }
    
    // Update legacy fields for backward compatibility
    user.subscriptionStatus = 'trial';
    user.plan = 'pro'; // Set plan to pro during trial
    user.trialEndsAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    user.subscriptionStartedAt = Date.now(); // Track when trial started
    
    await c.env.KV_USERS.put(`user:${user.uid}`, JSON.stringify(user));
    console.log(`Started 7-day trial for user ${user.uid}`);
  }
}

/**
 * Check and update trial status - expire trials that have ended
 */
export async function checkAndUpdateTrialStatus(c: any, user: UserRecord): Promise<UserRecord> {
  const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
  const trialEndsAt = user.subscription?.trialEnd || user.trialEndsAt;
  
  if (subscriptionStatus === 'trial' && trialEndsAt) {
    const now = Date.now();
    if (now >= trialEndsAt) {
      // Trial expired, mark as cancelled - update both new and legacy fields
      if (user.subscription) {
        user.subscription.status = 'cancelled';
      }
      user.subscriptionStatus = 'cancelled';
      user.plan = 'free'; // Revert to free plan after trial expires
      await c.env.KV_USERS.put(`user:${user.uid}`, JSON.stringify(user));
      console.log(`Trial expired for user ${user.uid}, marked as cancelled`);
    }
  }
  return user;
}
