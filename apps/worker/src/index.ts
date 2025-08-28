import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import { Bindings, UserRecord, SnapshotRecord } from './types';
import { AnalyticsManager } from './analytics';
import { 
  createNewUserWithSchema, 
  createNewSnapshotWithSchema,
  migrateUserToNewSchema 
} from './migrate-schema';
import { CreateSnapshotBodySchema, FinalizeSnapshotBodySchema } from '../../../packages/shared/src/schemas';
import { DEFAULT_CAPS, VIEWER_COOKIE_PREFIX, ALLOW_MIME_PREFIXES } from '../../../packages/shared/src/index';
import { generateIdBase62, hashPasswordArgon2id, verifyPasswordHash, nowMs, randomHex, sha256Hex } from './utils';
import { signSession, verifySession, generatePassword } from '../../../packages/shared/src/cookies';
import { presignR2PutURL } from './s3presign';
import { getExtensionVersion } from './version-info';

// Initialize analytics manager
let analyticsManager: AnalyticsManager;

// Helper function to increment unique view count
async function incrementUniqueViewCount(c: any, snapshotId: string, meta: any) {
  try {
    // Get viewer fingerprint (IP + User-Agent + timestamp for deduplication)
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    const now = Date.now();
    
    // Create a unique viewer identifier (hash of IP + User-Agent)
    const viewerFingerprint = await sha256Hex(`${ip}:${userAgent}`);
    
    // Check if this viewer has already been counted for this snapshot
    const viewerKey = `viewer:${snapshotId}:${viewerFingerprint}`;
    const existingView = await c.env.KV_SNAPS.get(viewerKey);
    
    if (!existingView) {
      // This is a new unique viewer
      // Store viewer record with 24-hour expiration to prevent immediate re-counting
      await c.env.KV_SNAPS.put(viewerKey, JSON.stringify({
        ip,
        userAgent,
        timestamp: now,
        snapshotId
      }), { expirationTtl: 86400 }); // 24 hours
      
      // Increment view count
      meta.viewCount = (meta.viewCount || 0) + 1;
      await c.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(meta));
      
      console.log(`👁️ New unique viewer for snapshot ${snapshotId}: ${ip} (total views: ${meta.viewCount})`);
    } else {
      console.log(`👁️ Returning viewer for snapshot ${snapshotId}: ${ip} (not counted)`);
    }
  } catch (error) {
    console.error('Error incrementing view count:', error);
    // Don't fail the request if view counting fails
  }
}

// Billing (Stripe)
// Edge-compatible Stripe client with Fetch + SubtleCrypto providers
// @ts-ignore
import Stripe from 'stripe';

const app = new Hono();

app.use('*', cors({ 
  origin: (origin: string | undefined) => {
    // Allow requests from quickstage.tech and localhost
    if (!origin) return '*';
    if (origin.includes('quickstage.tech') || origin.includes('localhost')) return origin;
    return false;
  }, 
  credentials: true 
}));

// Simplified authentication - no more complex cookie logic

async function getUidFromSession(c: any): Promise<string | null> {
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

// Initialize analytics manager when environment is available
function getAnalyticsManager(c: any): AnalyticsManager {
  if (!analyticsManager) {
    analyticsManager = new AnalyticsManager(c.env);
  }
  return analyticsManager;
}

// User helpers

async function getUserByName(c: any, name: string): Promise<UserRecord | null> {
  const uid = await c.env.KV_USERS.get(`user:byname:${name}`);
  if (!uid) return null;
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  return raw ? JSON.parse(raw) : null;
}

// Subscription helper functions
function getSubscriptionDisplayStatus(user: UserRecord): 'Free Trial' | 'Pro' | 'Cancelled' | 'Past Due' | 'None' | 'Superadmin' {
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

function canAccessProFeatures(user: UserRecord): boolean {
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

function startFreeTrial(user: UserRecord): void {
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

async function ensureUserByName(c: any, name: string): Promise<UserRecord> {
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
      totalCommentsReceived: 0,
    }
  };
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  await c.env.KV_USERS.put(`user:byname:${name}`, uid);
  
  return user;
}



// Email/Password: Register
app.post('/auth/register', async (c: any) => {
  const { email, password, name } = await c.req.json();
  if (!email || !password || !name) return c.json({ error: 'missing_fields' }, 400);
  
  // Check if user already exists
  const existingUser = await getUserByName(c, name);
  if (existingUser) return c.json({ error: 'user_exists' }, 400);
  
  // Hash password
  const salt = randomHex(16);
  const hashedPassword = await hashPasswordArgon2id(password, salt);
  
  // Create user
  const uid = generateIdBase62(16);
  const now = Date.now();
  const user: UserRecord = { 
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
    email,
    passwordHash: hashedPassword,
    name
  };
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  await c.env.KV_USERS.put(`user:byname:${name}`, uid);
  await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
  
  // Sign session
  const token = await signSession({ uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
  
  return c.json({ ok: true, user: { uid, name, email, plan: user.plan, role: user.role || 'user' }, sessionToken: token });
});

// Email/Password: Login
app.post('/auth/login', async (c: any) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: 'missing_fields' }, 400);
  
  // Find user by email
  const uid = await c.env.KV_USERS.get(`user:byemail:${email}`);
  if (!uid) return c.json({ error: 'invalid_credentials' }, 401);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return c.json({ error: 'invalid_credentials' }, 401);
  
  const user = JSON.parse(raw);
  if (!user.passwordHash) return c.json({ error: 'invalid_credentials' }, 401);
  
  // Verify password
  const isValid = await verifyPasswordHash(password, user.passwordHash);
  if (!isValid) return c.json({ error: 'invalid_credentials' }, 401);
  
  // Update last login
  user.lastLoginAt = Date.now();
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'user_login', { method: 'email' });
  
  // Sign session
  const token = await signSession({ uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
  
  return c.json({ ok: true, user: { uid, name: user.name, email: user.email, plan: user.plan, role: user.role || 'user' }, sessionToken: token });
});

// Google OAuth: Login/Register
app.post('/auth/google', async (c: any) => {
  const { idToken } = await c.req.json();
  if (!idToken) return c.json({ error: 'missing_token' }, 400);
  
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
    
    const userInfo = await userInfoResponse.json() as {
      email: string;
      name?: string;
      given_name?: string;
      family_name?: string;
    };
    const { email, name, given_name, family_name } = userInfo;
    
    if (!email) {
      return c.json({ error: 'email_required' }, 400);
    }
    
    // Check if user exists by email
    let uid = await c.env.KV_USERS.get(`user:byemail:${email}`);
    let user: UserRecord;
    
    if (uid) {
      // User exists, update last login and Google ID
      const raw = await c.env.KV_USERS.get(`user:${uid}`);
      if (raw) {
        user = JSON.parse(raw);
        user.lastLoginAt = Date.now();
        user.googleId = idToken; // Store Google ID for future reference
        if (!user.name && name) user.name = name;
        await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
      } else {
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
    } else {
      // Create new user
      uid = generateIdBase62(16);
      const displayName = name || `${given_name || ''} ${family_name || ''}`.trim() || 'Google User';
      
      user = createNewUserWithSchema(
        uid,
        displayName,
        email,
        'user',
        'free',
        undefined,
        idToken
      );
      
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
    
  } catch (error) {
    console.error('Google OAuth error:', error);
    return c.json({ error: 'authentication_failed' }, 401);
  }
});

app.get('/me', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ user: null });
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return c.json({ user: null });
  
  const user = JSON.parse(raw);
  
  // Track analytics event for page view
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'page_view', { page: '/me' });
  
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
  let canAccessPro = false;
  
  console.log(`/me endpoint - User subscription status: "${subscriptionStatus}" (type: ${typeof subscriptionStatus})`);
  console.log(`/me endpoint - User plan: "${user.plan}" (type: ${typeof user.plan})`);
  
  // Superadmin accounts always have Pro access
  if (user.role === 'superadmin') {
    subscriptionDisplay = 'Pro (Superadmin)';
    canAccessPro = true;
  } else if (subscriptionStatus && subscriptionStatus !== 'none') {
    
    if (subscriptionStatus === 'trial') {
      // Check both new and legacy trial fields
      const trialEnd = user.subscription?.trialEnd || user.trialEndsAt;
      if (trialEnd) {
        subscriptionDisplay = 'Pro (Trial)';
        trialEndsAt = trialEnd;
        canAccessPro = true;
        // For trial users, next billing date is when the trial ends
        nextBillingDate = trialEnd;
      }
    } else if (subscriptionStatus === 'active') {
      subscriptionDisplay = 'Pro';
      canAccessPro = true;
      // Calculate next billing date (30 days from last payment or subscription start)
      const lastPaymentAt = user.subscription?.lastPaymentAt || user.lastPaymentAt;
      const subscriptionStartedAt = user.subscription?.currentPeriodStart || user.subscriptionStartedAt;
      if (lastPaymentAt) {
        nextBillingDate = lastPaymentAt + (30 * 24 * 60 * 60 * 1000);
      } else if (subscriptionStartedAt) {
        nextBillingDate = subscriptionStartedAt + (30 * 24 * 60 * 60 * 1000);
      }
    } else if (subscriptionStatus === 'cancelled') {
      subscriptionDisplay = 'Pro (Cancelled)';
      canAccessPro = false;
    } else if (subscriptionStatus === 'past_due') {
      subscriptionDisplay = 'Pro (Past Due)';
      canAccessPro = false;
    }
  } else {
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
    canAccessPro: canAccessPro,
    stripeCustomerId: user.subscription?.stripeCustomerId || user.stripeCustomerId,
    stripeSubscriptionId: user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId
  };
  
  console.log(`/me endpoint returning for user ${uid}:`, responseUser);
  
  // Return safe user data with subscription information
  return c.json({ 
    user: responseUser
  });
});

// Logout endpoint
app.post('/auth/logout', async (c: any) => {
  const uid = await getUidFromSession(c);
  
  // Track analytics event for logout if user was authenticated
  if (uid) {
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'user_logout', {});
  }
  
  // No need to clear cookies - just return success
  return c.json({ ok: true });
});

// Update user profile
app.put('/auth/profile', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/auth/profile',
        method: 'PUT'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const { name, email } = await c.req.json();
  if (!name && !email) return c.json({ error: 'no_changes' }, 400);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return c.json({ error: 'user_not_found' }, 404);
  
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
});

// Change password
app.post('/auth/change-password', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/auth/change-password',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const { currentPassword, newPassword } = await c.req.json();
  if (!currentPassword || !newPassword) return c.json({ error: 'missing_fields' }, 400);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return c.json({ error: 'user_not_found' }, 404);
  
  const user = JSON.parse(raw);
  if (!user.passwordHash) return c.json({ error: 'no_password_set' }, 400);
  
  // Verify current password
  const isValid = await verifyPasswordHash(currentPassword, user.passwordHash);
  if (!isValid) return c.json({ error: 'invalid_password' }, 401);
  
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
});



// Start free trial with credit card required for auto-billing after trial
app.post('/billing/start-trial', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/billing/start-trial',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user: UserRecord = JSON.parse(userRaw);
  
  // Check if user already has trial/subscription - use new schema with fallback
  const subscriptionStatus = user.subscription?.status || user.subscriptionStatus || 'none';
  if (subscriptionStatus && subscriptionStatus !== 'none' && subscriptionStatus !== 'cancelled') {
    return c.json({ error: 'already_subscribed' }, 400);
  }
  
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });
  
  // Create or get Stripe customer - use new schema with fallback
  let customerId = user.subscription?.stripeCustomerId || user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { uid }
    });
    customerId = customer.id;
    // Update both new and legacy fields
    if (!user.subscription) {
      user.subscription = { status: 'none' };
    }
    user.subscription.stripeCustomerId = customerId;
    user.stripeCustomerId = customerId;
  }
  
  // Create checkout session for trial with required payment method
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: c.env.STRIPE_PRICE_ID, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { uid }
    },
    success_url: `${c.env.PUBLIC_BASE_URL}/?trial=started`,
    cancel_url: `${c.env.PUBLIC_BASE_URL}/?trial=cancelled`,
    metadata: { uid, action: 'start_trial' },
  });
  
  // Track analytics event for trial start
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'subscription_started', { 
    method: 'trial',
    trialDays: 7
  });
  
  return c.json({ url: session.url });
});

// Manual subscription for existing users (after trial ends or reactivation)
app.post('/billing/subscribe', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/billing/subscribe',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user: UserRecord = JSON.parse(userRaw);
  
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });
  
  // Create or get Stripe customer - use new schema with fallback
  let customerId = user.subscription?.stripeCustomerId || user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { uid }
    });
    customerId = customer.id;
    // Update both new and legacy fields
    if (!user.subscription) {
      user.subscription = { status: 'none' };
    }
    user.subscription.stripeCustomerId = customerId;
    user.stripeCustomerId = customerId;
  }
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: c.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${c.env.PUBLIC_BASE_URL}/?billing=success`,
    cancel_url: `${c.env.PUBLIC_BASE_URL}/?billing=canceled`,
    metadata: { uid, action: 'subscribe' },
  });
  
  // Track analytics event for subscription start
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'subscription_started', { 
    method: 'direct_subscription'
  });
  
  return c.json({ url: session.url });
});

// Get subscription status
app.get('/billing/status', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user: UserRecord = JSON.parse(userRaw);
  
  return c.json({
    status: getSubscriptionDisplayStatus(user),
    canAccessPro: canAccessProFeatures(user),
    trialEndsAt: user.subscription?.trialEnd || user.trialEndsAt,
    subscriptionStartedAt: user.subscription?.currentPeriodStart || user.subscriptionStartedAt,
    lastPaymentAt: user.subscription?.lastPaymentAt || user.lastPaymentAt,
    stripeCustomerId: user.subscription?.stripeCustomerId || user.stripeCustomerId
  });
});

// Cancel subscription
app.post('/billing/cancel', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/billing/cancel',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user = JSON.parse(userRaw);
  
  // Check for subscription ID in both new and legacy fields
  const stripeSubscriptionId = user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId;
  if (!stripeSubscriptionId) {
    return c.json({ error: 'no_subscription' }, 400);
  }
  
  try {
    // Check if Stripe secret key is available
    if (!c.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not found in environment');
      return c.json({ error: 'stripe_configuration_error' }, 500);
    }
    
    // Initialize Stripe client with environment variables
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    console.log(`Cancelling subscription ${stripeSubscriptionId} for user ${uid}`);
    
    // Cancel the subscription at period end (user keeps access until paid period ends)
    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true
    });
    
    // Update user status - update both new and legacy fields
    if (user.subscription) {
      user.subscription.status = 'cancelled';
    }
    user.subscriptionStatus = 'cancelled';
    await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
    
    // Track analytics event for subscription cancellation
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'subscription_cancelled', { 
      stripeSubscriptionId: stripeSubscriptionId,
      cancelAt: subscription.cancel_at
    });
    
    console.log(`Subscription ${stripeSubscriptionId} cancelled for user ${uid}`);
    return c.json({ 
      ok: true, 
      message: 'Subscription cancelled. You will retain access until the end of your current billing period.',
      cancelAt: subscription.cancel_at
    });
  } catch (error) {
    console.error('Stripe cancel subscription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'cancel_failed', details: errorMessage }, 500);
  }
});

// Create snapshot
app.post('/snapshots/create', async (c: any) => {
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
});

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
app.post('/snapshots/finalize', async (c: any) => {
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
});




  


// Add /snapshots/list route BEFORE /snapshots/:id to avoid conflicts
app.get('/snapshots/list', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  // Track analytics event for page view
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'page_view', { page: '/snapshots/list' });
  
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
});

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
app.get('/s/:id', async (c: any) => {
  const id = c.req.param('id');
  console.log(`🔍 Worker: /s/:id route hit - id: ${id}`);
  
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.text('Snapshot not found', 404);
  
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
  
  // Increment view count for unique viewers
  await incrementUniqueViewCount(c, id, meta);
  
  // Track analytics event for snapshot viewing
  // Note: We don't have user ID here for anonymous viewers, so we'll track it as a system event
  // In a real implementation, you'd want to pass user context when available
  console.log(`👁️ Snapshot viewed: ${id} (public: ${meta.public}, password protected: ${!meta.public})`);
  
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
  htmlContent = htmlContent.replace(
    /(href|src)=["']\/([^"']*)/g,
    (match: string, attr: string, path: string) => {
      // Only replace if it looks like an asset path
      if (path.startsWith('assets/') || /\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/.test(path)) {
        return `${attr}="/s/${id}/${path}"`;
      }
      return match; // Keep original if not an asset
    }
  );
  
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
  } else {
    htmlContent += commentsOverlay;
  }
  
  console.log(`🔍 HTML content after replacement:`, htmlContent.substring(0, 500));
  console.log(`🔍 Asset path replacements made:`, {
    before: beforeReplace.includes('/assets/'),
    after: htmlContent.includes(`/s/${id}/assets/`),
    id: id
  });
  
  // Return the modified HTML with proper headers
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
  
  return new Response(htmlContent, { headers });
});

// Asset serving with password gate - for individual files (CSS, JS, images, etc.)
app.get('/s/:id/*', async (c: any) => {
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
  if (!metaRaw) return c.text('Gone', 410);
  const meta = JSON.parse(metaRaw);
  if (meta.status === 'expired' || meta.expiresAt < nowMs()) return c.text('Gone', 410);
  if (!meta.public) {
    const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
    if (!gateCookie || gateCookie !== 'ok') return c.json({ error: 'unauthorized' }, 401);
  }
  
  console.log(`🔍 Looking for asset: snap/${id}/${path}`);
  const r2obj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/${path}`);
  if (!r2obj) {
    console.log(`❌ Asset not found: snap/${id}/${path}`);
    return c.text('Not found', 404);
  }
  console.log(`✅ Asset found: snap/${id}/${path}, size: ${r2obj.size}, type: ${r2obj.httpMetadata?.contentType}`);
  const headers: Record<string, string> = {
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
  const ct = r2obj.httpMetadata?.contentType;
  if (ct) headers['Content-Type'] = ct;
  return new Response(r2obj.body, { headers });
});

// Alternative /snap/* routes for better Pages compatibility
app.get('/snap/:id/*', async (c: any) => {
  const id = c.req.param('id');
  const path = c.req.param('*') || '';
  console.log(`🔍 Worker: /snap/:id/* route hit - id: ${id}, path: ${path}`);
  
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.text('Gone', 410);
  const meta = JSON.parse(metaRaw);
  if (meta.status === 'expired' || meta.expiresAt < nowMs()) return c.text('Gone', 410);
  if (!meta.public) {
    const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
    if (!gateCookie || gateCookie !== 'ok') return c.json({ error: 'unauthorized' }, 401);
  }
  const r2obj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/${path}`);
  if (!r2obj) {
    return c.text('Not found', 404);
  }
  const headers: Record<string, string> = {
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
  const ct = r2obj.httpMetadata?.contentType;
  if (ct) headers['Content-Type'] = ct;
  return new Response(r2obj.body, { headers });
});

// Alternative /snap/:id route for better Pages compatibility
app.get('/snap/:id', async (c: any) => {
  const id = c.req.param('id');
  console.log(`🔍 Worker: /snap/:id route hit - id: ${id}`);
  
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.text('Snapshot not found', 404);
  
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
  
  // Increment view count for unique viewers
  await incrementUniqueViewCount(c, id, meta);
  
  // Get the main index.html file
  const indexObj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/index.html`);
  if (!indexObj) {
    return c.text('Snapshot index not found', 404);
  }
  
  // Return the HTML with proper headers
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };
  
  return new Response(indexObj.body, { headers });
});

// Gate
app.post('/s/:id/gate', async (c: any) => {
  try {
    const id = c.req.param('id');
    console.log(`🔐 Gate endpoint called for snapshot: ${id}`);
    
    const body: any = await c.req.json();
    const password: string = String(body?.password || '');
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
    } else {
      // New: hash verification
      ok = await verifyPasswordHash(password, passwordToVerify);
      console.log(`🔐 Hash password verification result: ${ok}`);
    }
    
    if (!ok) return c.json({ error: 'forbidden' }, 403);
    
    setCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`, 'ok', {
      secure: true,
      sameSite: 'None',
      path: `/s/${id}`,
      maxAge: 60 * 60,
    });
    
    console.log(`✅ Password verified, cookie set for: ${id}`);
    
    // Track analytics event for password verification
    // Note: We don't have user ID here for anonymous viewers, so we'll track it as a system event
    console.log(`🔐 Password verified for snapshot: ${id}`);
    
    return c.json({ ok: true });
    
  } catch (error) {
    console.error(`❌ Error in gate endpoint:`, error);
    return c.json({ error: 'internal_error', details: String(error) }, 500);
  }
});

// Snapshot comments endpoints
app.get('/api/snapshots/:id/comments', async (c: any) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'bad_request' }, 400);
  
  const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(id));
  const res = await stub.fetch(new URL(`/comments?id=${encodeURIComponent(id)}`, 'http://do').toString());
  return new Response(res.body as any, { headers: { 'Content-Type': 'application/json' } });
});

// Get comments for a snapshot (public endpoint)
app.get('/comments/:snapshotId', async (c: any) => {
  const snapshotId = c.req.param('snapshotId');
  if (!snapshotId) return c.json({ error: 'bad_request' }, 400);
  
  const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(snapshotId));
  const res = await stub.fetch(new URL(`/comments?id=${encodeURIComponent(snapshotId)}`, 'http://do').toString());
  return new Response(res.body as any, { headers: { 'Content-Type': 'application/json' } });
});

app.post('/api/snapshots/:id/comments', async (c: any) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'bad_request' }, 400);
  
  const body: any = await c.req.json();
  if (!body || !body.text) return c.json({ error: 'bad_request' }, 400);
  
  // Turnstile verification
  const token = body.turnstileToken || '';
  if (!token) return c.json({ error: 'turnstile_required' }, 400);
  
  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET_KEY, response: token }),
  });
  
  const verifyJson: any = await verifyRes.json();
  if (!verifyJson.success) return c.json({ error: 'turnstile_failed' }, 403);
  
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
    } catch {}
  }
  
  // Track analytics event for comment posting
  if (uid) {
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'comment_posted', { 
      snapshotId: id,
      commentLength: body.text.length,
      hasFile: !!body.file,
      hasLine: !!body.line
    });
  }
  
  return new Response(res.body as any, { headers: { 'Content-Type': 'application/json' } });
});

// Legacy comments endpoints for backward compatibility
app.get('/comments', async (c: any) => {
  const id = c.req.query('id');
  if (!id) return c.json({ error: 'bad_request' }, 400);
  const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(id));
  const res = await stub.fetch(new URL(`/comments?id=${encodeURIComponent(id)}`, 'http://do').toString());
  return new Response(res.body as any, { headers: { 'Content-Type': 'application/json' } });
});

app.post('/comments', async (c: any) => {
  const body: any = await c.req.json();
  if (!body || !body.id || !body.text) return c.json({ error: 'bad_request' }, 400);
  // Turnstile verification
  const token = c.req.header('cf-turnstile-token') || c.req.header('x-turnstile-token') || '';
  if (!token) return c.json({ error: 'turnstile_required' }, 400);
  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET_KEY, response: token }),
  });
  const verifyJson: any = await verifyRes.json();
  if (!verifyJson.success) return c.json({ error: 'turnstile_failed' }, 403);
  const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(body.id));
  const res = await stub.fetch('http://do/comments', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  // Increment comments count eventually
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${body.id}`);
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw);
      meta.commentsCount = (meta.commentsCount || 0) + 1;
      await c.env.KV_SNAPS.put(`snap:${body.id}`, JSON.stringify(meta));
    } catch {}
  }
  
  // Track analytics event for comment posting (legacy endpoint)
  // Note: We don't have user ID here, so we'll track it as a system event
  console.log(`💬 Comment posted to snapshot: ${body.id} by ${body.author || 'Anonymous'}`);
  
  return new Response(res.body as any, { headers: { 'Content-Type': 'application/json' } });
});

// Cron purge
app.get('/admin/purge-expired', async (c: any) => {
  // This route will be bound to CRON; iterate KV list
  // Cloudflare KV list requires pagination; for MVP, skip and rely on manual
  return c.json({ ok: true });
});

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
app.post('/api/auth/google', async (c: any) => {
  const { idToken } = await c.req.json();
  if (!idToken) return c.json({ error: 'missing_token' }, 400);
  
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
    
    const userInfo = await userInfoResponse.json() as {
      email: string;
      name?: string;
      given_name?: string;
      family_name?: string;
    };
    const { email, name, given_name, family_name } = userInfo;
    
    if (!email) {
      return c.json({ error: 'email_required' }, 400);
    }
    
    // Check if user exists by email
    let uid = await c.env.KV_USERS.get(`user:byemail:${email}`);
    let user: UserRecord;
    
    if (uid) {
      // User exists, update last login and Google ID
      const raw = await c.env.KV_USERS.get(`user:${uid}`);
      if (raw) {
        user = JSON.parse(raw);
        user.lastLoginAt = Date.now();
        user.googleId = idToken; // Store Google ID for future reference
        if (!user.name && name) user.name = name;
        
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
      } else {
        // Fallback: create user if raw data is missing
        uid = generateIdBase62(16);
        user = createNewUserWithSchema(
          uid,
          name || `${given_name || ''} ${family_name || ''}`.trim() || 'Google User',
          email,
          'user',
          'free',
          undefined,
          idToken
        );
        await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
        await c.env.KV_USERS.put(`user:byname:${user.name}`, uid);
        await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
      }
    } else {
      // Create new user
      uid = generateIdBase62(16);
      const displayName = name || `${given_name || ''} ${family_name || ''}`.trim() || 'Google User';
      
      user = createNewUserWithSchema(
        uid,
        displayName,
        email,
        'user',
        'free',
        undefined,
        idToken
      );
      
      await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
      await c.env.KV_USERS.put(`user:byname:${displayName}`, uid);
      await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
    }
    
    // Sign session
    const token = await signSession({ uid }, c.env.SESSION_HMAC_SECRET, 60 * 60 * 24 * 7);
    
    return c.json({ ok: true, user: { uid, name: user.name, email: user.email, plan: user.plan, role: user.role || 'user' }, sessionToken: token });
    
  } catch (error) {
    console.error('Google OAuth error:', error);
    return c.json({ error: 'authentication_failed' }, 401);
  }
});

app.get('/api/me', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user = JSON.parse(userRaw);
  return c.json({ user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan, role: user.role || 'user', createdAt: user.createdAt, lastLoginAt: user.lastLoginAt } });
});

// Admin endpoints
app.get('/admin/users', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/admin/users',
        method: 'GET'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user = JSON.parse(userRaw);
  if (user.role !== 'superadmin') return c.json({ error: 'forbidden' }, 403);
  
  // Track analytics event for page view
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'page_view', { page: '/admin/users' });
  
  // Get all users
  const users = [];
  let cursor: string | undefined = undefined;
  
  do {
    const list = await c.env.KV_USERS.list({ prefix: 'user:', cursor });
    cursor = list.cursor as string | undefined;
    
    for (const key of list.keys) {
      // Filter for actual user records (user:uid) vs other keys (user:byemail:*, user:uid:snapshots, etc.)
      if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
        const uid = key.name.replace('user:', '');
        const userDataRaw = await c.env.KV_USERS.get(key.name);
        if (userDataRaw) {
          const userData = JSON.parse(userDataRaw);
          
          // Get user's snapshots
          const snapshotsList = await c.env.KV_USERS.get(`user:${uid}:snapshots`) || '[]';
          const snapshotIds = JSON.parse(snapshotsList);
          
          // Count active vs total snapshots
          let totalSnapshots = snapshotIds.length;
          let activeSnapshots = 0;
          
          for (const snapshotId of snapshotIds) {
            const snapshotRaw = await c.env.KV_SNAPS.get(`snap:${snapshotId}`);
            if (snapshotRaw) {
              const snapshot = JSON.parse(snapshotRaw);
              if (snapshot.status === 'active' && snapshot.expiresAt > Date.now()) {
                activeSnapshots++;
              }
            }
          }
          
          users.push({
            uid: userData.uid,
            name: userData.name || 'Unknown',
            email: userData.email || '',
            plan: userData.plan || 'free',
            role: userData.role || 'user',
            createdAt: userData.createdAt,
            lastLoginAt: userData.lastLoginAt,
            totalSnapshots,
            activeSnapshots,
            status: userData.status || 'active',
            
            // Subscription fields - use new schema with fallbacks
            subscriptionStatus: getSubscriptionDisplayStatus(userData),
            canAccessPro: canAccessProFeatures(userData),
            trialEndsAt: userData.subscription?.trialEnd || userData.trialEndsAt,
            subscriptionStartedAt: userData.subscription?.currentPeriodStart || userData.subscriptionStartedAt,
            lastPaymentAt: userData.subscription?.lastPaymentAt || userData.lastPaymentAt,
            stripeCustomerId: userData.subscription?.stripeCustomerId || userData.stripeCustomerId
          });
        }
      }
    }
  } while (cursor);
  
  return c.json({ users });
});

app.post('/admin/users', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/admin/users',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) {
    // Track analytics event for user not found
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_creation',
        error: 'user_not_found',
        uid: uid
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for user not found:', analyticsError);
    }
    return c.json({ error: 'user_not_found' }, 404);
  }
  
  const user = JSON.parse(userRaw);
  if (user.role !== 'superadmin') {
    // Track analytics event for insufficient permissions
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_creation',
        error: 'insufficient_permissions',
        userRole: user.role
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for insufficient permissions:', analyticsError);
    }
    return c.json({ error: 'forbidden' }, 403);
  }
  
  const { name, email, password, role } = await c.req.json();
  if (!name || !email || !password || !role) {
    // Track analytics event for missing fields
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_creation',
        error: 'missing_fields',
        providedFields: { name: !!name, email: !!email, password: !!password, role: !!role }
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for missing fields:', analyticsError);
    }
    return c.json({ error: 'missing_fields' }, 400);
  }
  
  // Check if user already exists
  const existingUser = await getUserByName(c, name);
  if (existingUser) {
    // Track analytics event for user already exists
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_creation',
        error: 'user_exists',
        attemptedName: name
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for user already exists:', analyticsError);
    }
    return c.json({ error: 'user_exists' }, 400);
  }
  
  const existingEmail = await c.env.KV_USERS.get(`user:byemail:${email}`);
  if (existingEmail) {
    // Track analytics event for email already exists
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_creation',
        error: 'email_exists',
        attemptedEmail: email
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for email already exists:', analyticsError);
    }
    return c.json({ error: 'email_exists' }, 400);
  }
  
  // Hash password
  const salt = randomHex(16);
  const hashedPassword = await hashPasswordArgon2id(password, salt);
  
  // Create user
  const newUid = generateIdBase62(16);
  const newUser: UserRecord = createNewUserWithSchema(
    newUid,
    name,
    email,
    role as 'user' | 'admin',
    'free',
    hashedPassword
  );
  
  await c.env.KV_USERS.put(`user:${newUid}`, JSON.stringify(newUser));
  await c.env.KV_USERS.put(`user:byname:${name}`, newUid);
  await c.env.KV_USERS.put(`user:byemail:${email}`, newUid);
  
  // Track analytics event
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(newUid, 'user_registered', { 
    method: 'admin',
    role: role,
    createdBy: uid
  });
  
  return c.json({ ok: true, user: { uid: newUid, name, email, role } });
});

app.post('/admin/users/:uid/deactivate', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/admin/users/:uid/deactivate',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) {
    // Track analytics event for user not found
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_deactivation',
        error: 'user_not_found',
        uid: uid
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for user not found:', analyticsError);
    }
    return c.json({ error: 'user_not_found' }, 404);
  }
  
  const user = JSON.parse(userRaw);
  if (user.role !== 'superadmin') {
    // Track analytics event for insufficient permissions
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_deactivation',
        error: 'insufficient_permissions',
        userRole: user.role
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for insufficient permissions:', analyticsError);
    }
    return c.json({ error: 'forbidden' }, 403);
  }
  
  const targetUid = c.req.param('uid');
  const targetUserRaw = await c.env.KV_USERS.get(`user:${targetUid}`);
  if (!targetUserRaw) {
    // Track analytics event for target user not found
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_deactivation',
        error: 'target_user_not_found',
        targetUid: targetUid
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for target user not found:', analyticsError);
    }
    return c.json({ error: 'target_user_not_found' }, 404);
  }
  
  const targetUser = JSON.parse(targetUserRaw);
  targetUser.status = 'deactivated';
  
  await c.env.KV_USERS.put(`user:${targetUid}`, JSON.stringify(targetUser));
  
  // Track analytics event for user deactivation
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'user_deactivated', { 
    targetUserId: targetUid,
    targetUserRole: targetUser.role
  });
  
  return c.json({ ok: true });
});

app.post('/admin/users/:uid/activate', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/admin/users/:uid/activate',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) {
    // Track analytics event for user not found
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_activation',
        error: 'user_not_found',
        uid: uid
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for user not found:', analyticsError);
    }
    return c.json({ error: 'user_not_found' }, 404);
  }
  
  const user = JSON.parse(userRaw);
  if (user.role !== 'superadmin' && user.role !== 'admin') {
    // Track analytics event for insufficient permissions
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_activation',
        error: 'insufficient_permissions',
        userRole: user.role
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for insufficient permissions:', analyticsError);
    }
    return c.json({ error: 'forbidden' }, 403);
  }
  
  const targetUid = c.req.param('uid');
  const targetUserRaw = await c.env.KV_USERS.get(`user:${targetUid}`);
  if (!targetUserRaw) {
    // Track analytics event for target user not found
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_activation',
        error: 'target_user_not_found',
        targetUid: targetUid
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for target user not found:', analyticsError);
    }
    return c.json({ error: 'target_user_not_found' }, 404);
  }
  
  const targetUser = JSON.parse(targetUserRaw);
  targetUser.status = 'active';
  
  await c.env.KV_USERS.put(`user:${targetUid}`, JSON.stringify(targetUser));
  
  // Track analytics event for user activation
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'user_activated', { 
    targetUserId: targetUid,
    targetUserRole: targetUser.role
  });
  
  return c.json({ ok: true });
});

// Delete user completely (superadmin only)
app.delete('/admin/users/:uid', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/admin/users/:uid',
        method: 'DELETE'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) {
    // Track analytics event for user not found
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_deletion',
        error: 'user_not_found',
        uid: uid
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for user not found:', analyticsError);
    }
    return c.json({ error: 'user_not_found' }, 404);
  }
  
  const user = JSON.parse(userRaw);
  if (user.role !== 'superadmin') {
    // Track analytics event for insufficient permissions
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_deletion',
        error: 'insufficient_permissions',
        userRole: user.role
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for insufficient permissions:', analyticsError);
    }
    return c.json({ error: 'insufficient_permissions' }, 403);
  }
  
  const targetUid = c.req.param('uid');
  const targetUserRaw = await c.env.KV_USERS.get(`user:${targetUid}`);
  if (!targetUserRaw) {
    // Track analytics event for target user not found
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_deletion',
        error: 'target_user_not_found',
        targetUid: targetUid
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for target user not found:', analyticsError);
    }
    return c.json({ error: 'target_user_not_found' }, 404);
  }
  const targetUser = JSON.parse(targetUserRaw);
  
  // Cannot delete superadmin
  if (targetUser.role === 'superadmin') {
    // Track analytics event for cannot delete superadmin
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_deletion',
        error: 'cannot_delete_superadmin',
        targetUserRole: targetUser.role
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for cannot delete superadmin:', analyticsError);
    }
    return c.json({ error: 'cannot_delete_superadmin' }, 400);
  }
  
  // Cannot delete self
  if (targetUid === uid) {
    // Track analytics event for cannot delete self
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'error_occurred', { 
        context: 'admin_user_deletion',
        error: 'cannot_delete_self'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for cannot delete self:', analyticsError);
    }
    return c.json({ error: 'cannot_delete_self' }, 400);
  }
  
  console.log(`Superadmin ${uid} deleting user ${targetUid} (${targetUser.email}) completely`);
  
  // Delete all user data from KV
  await c.env.KV_USERS.delete(`user:${targetUid}`);
  
  // Delete by-name index if exists
  if (targetUser.name) {
    await c.env.KV_USERS.delete(`user:byname:${targetUser.name}`);
  }
  
  // Delete by-email index if exists
  if (targetUser.email) {
    await c.env.KV_USERS.delete(`user:byemail:${targetUser.email}`);
  }
  
  // Delete all user's snapshots
  const snapshots = await c.env.KV_SNAPS.list({ prefix: `snap:${targetUid}:` });
  for (const key of snapshots.keys) {
    await c.env.KV_SNAPS.delete(key.name);
  }
  
  // Delete all user's PATs
  const pats = await c.env.KV_USERS.list({ prefix: `pat:${targetUid}:` });
  for (const key of pats.keys) {
    await c.env.KV_USERS.delete(key.name);
  }
  
  // Delete all user's comments
  const comments = await c.env.KV_USERS.list({ prefix: `comment:${targetUid}:` });
  for (const key of comments.keys) {
    await c.env.KV_USERS.delete(key.name);
  }
  
  // Track analytics event for user deletion
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'user_deleted', { 
    targetUserId: targetUid,
    targetUserRole: targetUser.role,
    targetUserPlan: targetUser.subscription?.status || 'unknown',
    snapshotsDeleted: snapshots.keys.length,
    patsDeleted: pats.keys.length,
    commentsDeleted: comments.keys.length
  });
  
  return c.json({ 
    success: true, 
    message: 'User completely deleted from system',
    deletedUser: {
      uid: targetUser.uid,
      email: targetUser.email,
      name: targetUser.name
    }
  });
});

// Create superadmin user (one-time setup)
app.post('/admin/setup-superadmin', async (c: any) => {
  const { name, email, password } = await c.req.json();
  if (!name || !email || !password) {
    // Track analytics event for missing fields
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'error_occurred', { 
        context: 'superadmin_setup',
        error: 'missing_fields',
        providedFields: { name: !!name, email: !!email, password: !!password }
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for missing fields:', analyticsError);
    }
    return c.json({ error: 'missing_fields' }, 400);
  }
  
  // Check if superadmin already exists
  let cursor: string | undefined = undefined;
  let superadminExists = false;
  
  do {
    const list = await c.env.KV_USERS.list({ prefix: 'user:', cursor });
    cursor = list.cursor as string | undefined;
    
    for (const key of list.keys) {
      // Filter for actual user records (user:uid) vs other keys (user:byemail:*, user:uid:snapshots, etc.)
      if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
        const userDataRaw = await c.env.KV_USERS.get(key.name);
        if (userDataRaw) {
          const userData = JSON.parse(userDataRaw);
          if (userData.role === 'superadmin') {
            superadminExists = true;
            break;
          }
        }
      }
    }
  } while (cursor && !superadminExists);
  
  if (superadminExists) {
    // Track analytics event for superadmin already exists
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'error_occurred', { 
        context: 'superadmin_setup',
        error: 'superadmin_already_exists'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for superadmin already exists:', analyticsError);
    }
    return c.json({ error: 'superadmin_already_exists' }, 400);
  }
  
  // Check if user already exists
  const existingUser = await getUserByName(c, name);
  if (existingUser) {
    // Track analytics event for user already exists
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'error_occurred', { 
        context: 'superadmin_setup',
        error: 'user_exists',
        attemptedName: name
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for user already exists:', analyticsError);
    }
    return c.json({ error: 'user_exists' }, 400);
  }
  
  const existingEmail = await c.env.KV_USERS.get(`user:byemail:${email}`);
  if (existingEmail) {
    // Track analytics event for email already exists
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'error_occurred', { 
        context: 'superadmin_setup',
        error: 'email_exists',
        attemptedEmail: email
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for email already exists:', analyticsError);
    }
    return c.json({ error: 'email_exists' }, 400);
  }
  
  // Hash password
  const salt = randomHex(16);
  const hashedPassword = await hashPasswordArgon2id(password, salt);
  
  // Create superadmin user
  const uid = generateIdBase62(16);
  const user: UserRecord = createNewUserWithSchema(
    uid,
    name,
    email,
    'superadmin',
    'pro',
    hashedPassword
  );
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  await c.env.KV_USERS.put(`user:byname:${name}`, uid);
  await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
  
  // Track analytics event for new superadmin user
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'user_registered', { 
    method: 'admin', 
    role: 'superadmin',
    isFirstSuperadmin: true
  });
  
  return c.json({ ok: true, user: { uid, name, email, role: 'superadmin' } });
});



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
async function getUidFromPAT(c: any, token: string): Promise<string | null> {
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

// Comments endpoints
app.get('/comments/:snapshotId', async (c: any) => {
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
    
  } catch (error) {
    console.error('❌ Error getting comments:', error);
    return c.json({ error: 'internal_error' }, 500);
  }
});

app.post('/comments/:snapshotId', async (c: any) => {
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
    
    // Track analytics event for comment posting
    // Note: We don't have user ID here, so we'll track it as a system event
    // In a real implementation, you'd want to pass user context
    console.log(`💬 Comment posted to snapshot: ${snapshotId} by ${author}`);
    
    return c.json(data);
    
  } catch (error) {
    console.error('❌ Error adding comment:', error);
    return c.json({ error: 'internal_error' }, 500);
  }
});

// Original web app serving (keep as primary)
// Extension is served directly from web app public directory

async function purgeExpired(env: Bindings) {
  let cursor: string | undefined = undefined;
  do {
    const list: any = await env.KV_SNAPS.list({ prefix: 'snap:', cursor });
    cursor = list.cursor as string | undefined;
    for (const k of list.keys as any[]) {
      const metaRaw = await env.KV_SNAPS.get(k.name as string);
      if (!metaRaw) continue;
      try {
        const meta = JSON.parse(metaRaw);
        if (meta.expiresAt && meta.expiresAt < Date.now()) {
          // delete R2 objects under snap/id/
          const id = meta.id as string;
          let r2cursor: string | undefined = undefined;
          do {
            const objs: any = await env.R2_SNAPSHOTS.list({ prefix: `snap/${id}/`, cursor: r2cursor });
            r2cursor = objs.cursor as string | undefined;
            if (objs.objects.length) {
              await env.R2_SNAPSHOTS.delete((objs.objects as any[]).map((o: any) => o.key as string));
            }
          } while (r2cursor);
          // Don't delete from KV - keep metadata for dashboard display
          // Don't remove from user's list - keep expired snapshots visible when "All" is selected
          // Only clean up R2 objects to save storage
        }
      } catch {}
    }
  } while (cursor);
}

const worker = {
  fetch: app.fetch,
  scheduled: async (_event: any, env: Bindings) => {
    await purgeExpired(env);
  },
};

// Get analytics events (superadmin only)
app.get('/debug/analytics/events', async (c: any) => {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    const limit = parseInt(c.req.query('limit') || '100');
    const cursor = c.req.query('cursor');
    
    const list = await c.env.KV_ANALYTICS.list({ 
      prefix: 'event:', 
      cursor: cursor || undefined,
      limit: Math.min(limit, 1000) // Cap at 1000 for safety
    });
    
    const events = [];
    for (const key of list.keys) {
      if (key.name.startsWith('event:')) {
        const eventRaw = await c.env.KV_ANALYTICS.get(key.name);
        if (eventRaw) {
          const event = JSON.parse(eventRaw);
          events.push(event);
        }
      }
    }
    
    // Sort by timestamp descending (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    return c.json({
      events,
      cursor: list.cursor,
      truncated: list.list_complete === false,
      total: events.length
    });
  } catch (error: any) {
    console.error('Debug analytics events error:', error);
    
    // Track analytics event for debug analytics events error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_analytics_events',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug analytics events error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to fetch analytics events' }, 500);
  }
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
app.post('/billing/checkout', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user = JSON.parse(userRaw);
  
  try {
    // Check if Stripe secret key is available
    if (!c.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not found in environment');
      return c.json({ error: 'stripe_configuration_error' }, 500);
    }
    
    // Check if Stripe price ID is available
    if (!c.env.STRIPE_PRICE_ID) {
      console.error('STRIPE_PRICE_ID not found in environment');
      return c.json({ error: 'stripe_configuration_error' }, 500);
    }
    
    // Initialize Stripe client with environment variables
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    console.log(`Creating checkout session for user ${uid} with price ${c.env.STRIPE_PRICE_ID}`);
    
    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      console.log(`Creating new Stripe customer for user ${uid}`);
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { uid }
      });
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      user.stripeCustomerId = customerId;
      await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
      console.log(`Created Stripe customer ${customerId} for user ${uid}`);
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: c.env.STRIPE_PRICE_ID, // Your $6/mo price ID
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `https://quickstage.tech/dashboard?success=true`,
      cancel_url: `https://quickstage.tech/dashboard?canceled=true`,
      subscription_data: {
        trial_period_days: 7, // 7-day trial
        metadata: { uid: user.uid }
      },
      metadata: { uid: user.uid }
    });
    
    console.log(`Created checkout session ${session.id} for user ${uid}`);
    return c.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'checkout_failed', details: errorMessage }, 500);
  }
});

// Change payment method endpoint
app.post('/billing/change-payment', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user = JSON.parse(userRaw);
  
  if (!user.stripeCustomerId) {
    return c.json({ error: 'no_subscription' }, 400);
  }
  
  try {
    // Check if Stripe secret key is available
    if (!c.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not found in environment');
      return c.json({ error: 'stripe_configuration_error' }, 500);
    }
    
    // Initialize Stripe client with environment variables
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    console.log(`Creating payment method update session for user ${uid}`);
    
    // Create a checkout session for updating payment method
    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
      payment_method_types: ['card'],
      mode: 'setup', // Setup mode for updating payment method
      success_url: `https://quickstage.tech/settings?payment_updated=true`,
      cancel_url: `https://quickstage.tech/settings?payment_canceled=true`,
      metadata: { uid: user.uid, action: 'change_payment' }
    });
    
    console.log(`Created payment method update session ${session.id} for user ${uid}`);
    return c.json({ url: session.url });
  } catch (error) {
    console.error('Stripe payment method update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'payment_update_failed', details: errorMessage }, 500);
  }
});

app.post('/billing/portal', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/billing/portal',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user = JSON.parse(userRaw);
  
  if (!user.stripeCustomerId) {
    return c.json({ error: 'no_subscription' }, 400);
  }
  
  try {
    // Check if Stripe secret key is available
    if (!c.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not found in environment');
      return c.json({ error: 'stripe_configuration_error' }, 500);
    }
    
    // Initialize Stripe client with environment variables
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    console.log(`Creating billing portal session for user ${uid}`);
    
    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `https://quickstage.tech/dashboard`,
    });
    
    console.log(`Created billing portal session ${session.id} for user ${uid}`);
    return c.json({ url: session.url });
  } catch (error) {
    console.error('Stripe billing portal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'portal_failed', details: errorMessage }, 500);
  }
});

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
        await handleCheckoutSessionCompleted(c, event.data.object);
        break;
        
      case 'customer.created':
        console.log('Handling customer.created event');
        await handleCustomerCreated(c, event.data.object);
        break;
        
      case 'customer.subscription.created':
        console.log('Handling customer.subscription.created event');
        await handleSubscriptionCreated(c, event.data.object);
        break;
        
      case 'customer.subscription.updated':
        console.log('Handling customer.subscription.updated event');
        await handleSubscriptionUpdated(c, event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        console.log('Handling customer.subscription.deleted event');
        await handleSubscriptionDeleted(c, event.data.object);
        break;
        
      case 'customer.deleted':
        console.log('Handling customer.deleted event');
        await handleCustomerDeleted(c, event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        console.log('Handling invoice.payment_succeeded event');
        await handlePaymentSucceeded(c, event.data.object);
        break;
        
      case 'invoice.payment_failed':
        console.log('Handling invoice.payment_failed event');
        await handlePaymentFailed(c, event.data.object);
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
app.post('/billing/cancel', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) return c.json({ error: 'unauthorized' }, 401);
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user = JSON.parse(userRaw);
  
  if (!user.stripeSubscriptionId) {
    return c.json({ error: 'no_subscription' }, 400);
  }
  
  try {
    // Check if Stripe secret key is available
    if (!c.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not found in environment');
      return c.json({ error: 'stripe_configuration_error' }, 500);
    }
    
    // Initialize Stripe client with environment variables
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    console.log(`Cancelling subscription ${user.stripeSubscriptionId} for user ${uid}`);
    
    // Cancel the subscription at period end (user keeps access until paid period ends)
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true
    });
    
    // Update user status
    user.subscriptionStatus = 'cancelled';
    await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
    
    console.log(`Subscription ${user.stripeSubscriptionId} cancelled for user ${uid}`);
    return c.json({ 
      ok: true, 
      message: 'Subscription cancelled. You will retain access until the end of your current billing period.',
      cancelAt: subscription.cancel_at
    });
  } catch (error) {
    console.error('Stripe cancel subscription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'cancel_failed', details: errorMessage }, 500);
  }
});

// Helper function to start a trial for a user
async function startTrialForUser(c: any, user: UserRecord): Promise<void> {
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

// Helper function to check and update trial status
async function checkAndUpdateTrialStatus(c: any, user: UserRecord): Promise<UserRecord> {
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
app.post('/admin/cleanup-corrupted-users', async (c: any) => {
  const uid = await getUidFromSession(c);
  if (!uid) {
    // Track analytics event for unauthorized access attempt
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('anonymous', 'unauthorized_access', { 
        endpoint: '/admin/cleanup-corrupted-users',
        method: 'POST'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for unauthorized access:', analyticsError);
    }
    return c.json({ error: 'unauthorized' }, 401);
  }
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  const user = JSON.parse(userRaw);
  if (user.role !== 'superadmin') return c.json({ error: 'insufficient_permissions' }, 403);
  
  console.log(`Superadmin ${uid} running cleanup of corrupted users`);
  
  let cursor: string | undefined = undefined;
  let totalUsers = 0;
  let fixedUsers = 0;
  let deletedUsers = 0;
  const results: any[] = [];
  
  do {
    const list = await c.env.KV_USERS.list({ prefix: 'user:', cursor });
    cursor = list.cursor as string | undefined;
    
    for (const key of list.keys) {
      // Filter for actual user records (user:uid) vs other keys (user:byemail:*, user:uid:snapshots, etc.)
      if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
        const userDataRaw = await c.env.KV_USERS.get(key.name);
        if (userDataRaw) {
          totalUsers++;
          const userData = JSON.parse(userDataRaw);
          
          // Check for corrupted subscription data - use new schema with fallbacks
          const subscriptionStatus = userData.subscription?.status || userData.subscriptionStatus || 'none';
          const hasStripe = !!(userData.subscription?.stripeCustomerId || userData.stripeCustomerId || userData.subscription?.stripeSubscriptionId || userData.stripeSubscriptionId);
          
          if (subscriptionStatus === 'trial' && !hasStripe) {
            // Fix corrupted trial status - update new schema
            if (userData.subscription) {
              userData.subscription.status = 'none';
            }
            // Update legacy fields for backward compatibility
            userData.subscriptionStatus = 'none';
            userData.plan = 'free';
            userData.trialEndsAt = null;
            userData.subscriptionStartedAt = null;
            
            await c.env.KV_USERS.put(key.name, JSON.stringify(userData));
            fixedUsers++;
            
            results.push({
              uid: userData.uid,
              email: userData.email,
              action: 'fixed',
              before: { subscriptionStatus: 'trial', plan: 'pro' },
              after: { subscriptionStatus: 'none', plan: 'free' }
            });
            
            console.log(`Fixed user ${userData.uid}: reset corrupted trial status`);
          }
          
          // Check for users with 'pro' plan but no subscription
          if (userData.plan === 'pro' && !hasStripe && userData.role !== 'superadmin') {
            // Fix corrupted pro plan - update new schema
            if (userData.subscription) {
              userData.subscription.status = 'none';
            }
            // Update legacy fields for backward compatibility
            userData.plan = 'free';
            userData.subscriptionStatus = 'none';
            userData.trialEndsAt = null;
            userData.subscriptionStartedAt = null;
            
            await c.env.KV_USERS.put(key.name, JSON.stringify(userData));
            fixedUsers++;
            
            results.push({
              uid: userData.uid,
              email: userData.email,
              action: 'fixed',
              before: { plan: 'pro', subscriptionStatus: userData.subscriptionStatus },
              after: { plan: 'free', subscriptionStatus: 'none' }
            });
            
            console.log(`Fixed user ${userData.uid}: reset corrupted pro plan`);
          }
        }
      }
    }
  } while (cursor);
  
  // Track analytics event for cleanup completion
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'cleanup_completed', { 
    totalUsers,
    fixedUsers,
    deletedUsers,
    resultsCount: results.length
  });
  
  return c.json({
    success: true,
    message: 'Cleanup completed',
    summary: {
      totalUsers,
      fixedUsers,
      deletedUsers
    },
    results
  });
});

// Webhook handler functions
async function handleCustomerCreated(c: any, customer: any) {
  console.log(`Processing customer creation: ${customer.id}`);
  
  // Find user by Stripe customer ID to track analytics
  const uid = await getUidByStripeCustomerId(c, customer.id);
  if (uid) {
    // Track analytics event for customer creation
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'customer_created', { 
      stripeCustomerId: customer.id,
      email: customer.email
    });
  }
  
  // Customer created event doesn't require immediate action
  // The subscription creation will handle the user status update
}

async function handleCheckoutSessionCompleted(c: any, session: any) {
  const uid = session.metadata?.uid;
  if (!uid) {
    console.error('No UID in checkout session metadata');
    return;
  }
  
  console.log(`Processing checkout session completion for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) {
    console.error(`User ${uid} not found for checkout session`);
    return;
  }
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update user with Stripe customer ID - update both new and legacy fields
  if (session.customer) {
    user.subscription.stripeCustomerId = session.customer;
    user.stripeCustomerId = session.customer;
  }
  
  // Update user with subscription ID if available - update both new and legacy fields
  if (session.subscription) {
    user.subscription.stripeSubscriptionId = session.subscription;
    user.stripeSubscriptionId = session.subscription;
  }
  
  // Set user to trial status when checkout is completed - update both new and legacy fields
  user.subscription.status = 'trial';
  user.subscriptionStatus = 'trial';
  user.plan = 'pro';
  user.subscription.trialEnd = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
  user.trialEndsAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
  if (!user.subscriptionStartedAt) {
    user.subscriptionStartedAt = Date.now();
  }
  
  // Save updated user
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for checkout completion
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'subscription_started', { 
    method: 'checkout_session',
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription
  });
  
  console.log(`Updated user ${uid} to trial status with checkout session data`);
}

async function handleSubscriptionCreated(c: any, subscription: any) {
  const customerId = subscription.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }
  
  console.log(`Processing subscription creation for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update new schema
  user.subscription.stripeSubscriptionId = subscription.id;
  
  // Update legacy fields for backward compatibility
  user.stripeSubscriptionId = subscription.id;
  
  if (subscription.status === 'trialing') {
    user.subscription.status = 'trial';
    user.subscriptionStatus = 'trial';
    user.plan = 'pro';
    if (!user.subscriptionStartedAt) {
      user.subscriptionStartedAt = Date.now();
    }
    console.log(`User ${uid} marked as trial`);
  } else if (subscription.status === 'active') {
    user.subscription.status = 'active';
    user.subscriptionStatus = 'active';
    user.plan = 'pro';
    if (!user.subscriptionStartedAt) {
      user.subscriptionStartedAt = Date.now();
    }
    console.log(`User ${uid} marked as active subscription`);
  }
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for subscription creation
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'subscription_started', { 
    method: 'stripe_webhook',
    subscriptionId: subscription.id,
    status: subscription.status,
    trialEnd: subscription.trial_end
  });
}

async function handleSubscriptionUpdated(c: any, subscription: any) {
  const customerId = subscription.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing subscription update for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  if (subscription.status === 'trialing') {
    user.subscription.status = 'trial';
    user.subscriptionStatus = 'trial';
    user.plan = 'pro';
  } else if (subscription.status === 'active') {
    user.subscription.status = 'active';
    user.subscriptionStatus = 'active';
    user.plan = 'pro';
  } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    user.subscription.status = 'cancelled';
    user.subscriptionStatus = 'cancelled';
    user.plan = 'free';
  } else if (subscription.status === 'past_due') {
    user.subscription.status = 'past_due';
    user.subscriptionStatus = 'past_due';
  }
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for subscription update
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'subscription_renewed', { 
    method: 'stripe_webhook',
    subscriptionId: subscription.id,
    status: subscription.status,
    previousStatus: user.subscriptionStatus
  });
}

async function handleSubscriptionDeleted(c: any, subscription: any) {
  const customerId = subscription.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing subscription deletion for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update both new and legacy fields
  user.subscription.status = 'cancelled';
  user.subscriptionStatus = 'cancelled';
  user.plan = 'free';
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for subscription deletion
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'subscription_cancelled', { 
    method: 'stripe_webhook',
    subscriptionId: subscription.id
  });
}

async function handleCustomerDeleted(c: any, customer: any) {
  const customerId = customer.id;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing customer deletion for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  user.stripeCustomerId = undefined;
  user.stripeSubscriptionId = undefined;
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for customer deletion
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'customer_deleted', { 
    stripeCustomerId: customer.id
  });
}

async function handlePaymentSucceeded(c: any, invoice: any) {
  const customerId = invoice.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing payment success for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update both new and legacy fields
  user.subscription.lastPaymentAt = Date.now();
  user.lastPaymentAt = Date.now();
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for successful payment
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'payment_succeeded', { 
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency
  });
}

async function handlePaymentFailed(c: any, invoice: any) {
  const customerId = invoice.customer;
  const uid = await getUidByStripeCustomerId(c, customerId);
  
  if (!uid) return;
  
  console.log(`Processing payment failure for user ${uid}`);
  
  const raw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!raw) return;
  
  const user = JSON.parse(raw);
  
  // Initialize subscription object if it doesn't exist
  if (!user.subscription) {
    user.subscription = { status: 'none' };
  }
  
  // Update both new and legacy fields
  user.subscription.status = 'past_due';
  user.subscriptionStatus = 'past_due';
  
  await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
  
  // Track analytics event for failed payment
  const analytics = getAnalyticsManager(c);
  await analytics.trackEvent(uid, 'payment_failed', { 
    invoiceId: invoice.id,
    amount: invoice.amount_due,
    currency: invoice.currency,
    attemptCount: invoice.attempt_count
  });
}

async function getUidByStripeCustomerId(c: any, customerId: string): Promise<string | null> {
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

// ============================================================================
// DEBUG ENDPOINTS - Superadmin Only Access
// ============================================================================

// Helper function to check if user is superadmin
async function isSuperadmin(c: any): Promise<boolean> {
  const uid = await getUidFromSession(c);
  if (!uid) return false;
  
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return false;
  
  const user = JSON.parse(userRaw);
  return user.role === 'superadmin';
}

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


