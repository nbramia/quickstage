import { isSuperadmin } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
import { canAccessProFeatures, getSubscriptionDisplayStatus } from '../user';

// Debug route handlers
export async function handleDebugAnalyticsEvents(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    const limit = parseInt(c.req.query('limit') || '500'); // Increase default limit
    const cursor = c.req.query('cursor');
    const startTime = c.req.query('startTime') ? parseInt(c.req.query('startTime')) : undefined;
    
    console.log(`🔍 DEBUG ANALYTICS EVENTS: Requested limit: ${limit}`);
    console.log(`🔍 DEBUG ANALYTICS EVENTS: KV.list() limit will be: ${Math.min(limit, 1000)}`);
    
    const list = await c.env.KV_ANALYTICS.list({ 
      prefix: 'event:', 
      cursor: cursor || undefined,
      limit: Math.min(limit, 1000) // Cap at 1000 for safety
    });
    
    console.log(`🔍 DEBUG ANALYTICS EVENTS: Found ${list.keys.length} keys in KV`);
    console.log(`🔍 DEBUG ANALYTICS EVENTS: First few keys:`, list.keys.slice(0, 5).map((k: any) => k.name));
    console.log(`🔍 DEBUG ANALYTICS EVENTS: Last few keys:`, list.keys.slice(-5).map((k: any) => k.name));
    console.log(`🔍 DEBUG ANALYTICS EVENTS: StartTime filter: ${startTime} (${startTime ? new Date(startTime).toISOString() : 'none'})`);
    
    const events = [];
    let processedCount = 0;
    let skippedByTime = 0;
    
    for (const key of list.keys) {
      if (key.name.startsWith('event:')) {
        const eventRaw = await c.env.KV_ANALYTICS.get(key.name);
        if (eventRaw) {
          const event = JSON.parse(eventRaw);
          
          processedCount++;
          
          // Filter by startTime if provided
          if (startTime && event.timestamp < startTime) {
            skippedByTime++;
            continue; // Skip events older than startTime
          }
          
          // Normalize event fields for frontend compatibility
          const normalizedEvent = {
            ...event,
            type: event.eventType || event.type || 'unknown', // Map eventType to type
            page: event.eventData?.page || event.page, // Extract page from eventData
            metadata: event.eventData || event.metadata || {} // Extract metadata from eventData
          };
          
          // Enhance event with user details if userId is not 'system' or 'anonymous'
          if (normalizedEvent.userId && normalizedEvent.userId !== 'system' && normalizedEvent.userId !== 'anonymous') {
            try {
              const userRaw = await c.env.KV_USERS.get(`user:${normalizedEvent.userId}`);
              if (userRaw) {
                const user = JSON.parse(userRaw);
                normalizedEvent.userName = user.name || 'Unknown';
                normalizedEvent.userEmail = user.email || 'No email';
              }
            } catch (userError) {
              console.error('Failed to fetch user details for event:', userError);
              normalizedEvent.userName = 'Error loading user';
              normalizedEvent.userEmail = 'Error loading email';
            }
          }
          
          events.push(normalizedEvent);
        }
      }
    }
    
    // Sort by timestamp descending (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`🔍 DEBUG ANALYTICS EVENTS: Processed ${processedCount} events, skipped ${skippedByTime} by time filter`);
    console.log(`🔍 DEBUG ANALYTICS EVENTS: Returning ${events.length} events after filtering`);
    if (events.length > 0) {
      console.log(`🔍 DEBUG ANALYTICS EVENTS: Newest event: ${events[0].id} at ${new Date(events[0].timestamp).toISOString()}`);
      console.log(`🔍 DEBUG ANALYTICS EVENTS: Oldest event: ${events[events.length-1].id} at ${new Date(events[events.length-1].timestamp).toISOString()}`);
    }
    
    return c.json({
      events,
      cursor: list.cursor,
      truncated: list.list_complete === false,
      total: events.length,
      debug: {
        totalKeysFound: list.keys.length,
        processedEvents: processedCount,
        skippedByTimeFilter: skippedByTime,
        finalEventCount: events.length,
        startTimeFilter: startTime ? new Date(startTime).toISOString() : null
      }
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
}

export async function handleDebugMigrationStats(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    const { MigrationSystem } = await import('../migration-system');
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
}

export async function handleDebugMigrationRun(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    const body = await c.req.json();
    const { dryRun = false, batchSize = 50, skipErrors = true, verbose = false } = body;
    
    const { MigrationSystem } = await import('../migration-system');
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
}

export async function handleDebugMigrationUsers(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    const body = await c.req.json();
    const { dryRun = false, batchSize = 50, skipErrors = true, verbose = false } = body;
    
    const { MigrationSystem } = await import('../migration-system');
    const migrationSystem = new MigrationSystem(c.env, {
      dryRun,
      batchSize,
      skipErrors,
      verbose
    });
    
    console.log(`🔄 Starting user migration with options:`, { dryRun, batchSize, skipErrors, verbose });
    
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
    
    // Track analytics event for user migration error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'user_migration',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for user migration error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to run user migration' }, 500);
  }
}

export async function handleDebugMigrationSnapshots(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    const body = await c.req.json();
    const { dryRun = false, batchSize = 50, skipErrors = true, verbose = false } = body;
    
    const { MigrationSystem } = await import('../migration-system');
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
    
    // Track analytics event for snapshot migration error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'snapshot_migration',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for snapshot migration error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to run snapshot migration' }, 500);
  }
}

export async function handleDebugFixSubscription(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  const uid = c.req.param('uid');
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) return c.json({ error: 'user_not_found' }, 404);
  
  const user = JSON.parse(userRaw);
  const hasStripe = !!(user.subscription?.stripeCustomerId || user.stripeCustomerId || user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId);
  
  // Fix corrupt subscription data
  if (user.subscriptionStatus === 'trial' && !hasStripe) {
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
  
  return c.json({ 
    ok: true, 
    fixed: true,
    subscriptionStatus: user.subscription?.status || user.subscriptionStatus,
    hasStripe: !!(user.subscription?.stripeCustomerId || user.stripeCustomerId || user.subscription?.stripeSubscriptionId || user.stripeSubscriptionId)
  });
}

export async function handleDebugUser(c: any) {
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
}

export async function handleDebugUserByEmail(c: any) {
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
}

export async function handleDebugUsers(c: any) {
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
    for (const key of list.keys as any[]) {
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
}

export async function handleDebugUserDetail(c: any) {
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
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug user error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
}

export async function handleDebugSearchEmail(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  const email = c.req.param('email');
  
  try {
    // Look for user by email
    const uid = await c.env.KV_USERS.get(`user:byemail:${email}`);
    if (!uid) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw) {
      return c.json({ error: 'User data not found' }, 404);
    }
    
    const user = JSON.parse(userRaw);
    // Remove sensitive fields
    delete user.googleId;
    delete user.passwordHash;
    
    return c.json(user);
  } catch (error: any) {
    console.error('Debug search error:', error);
    
    // Track analytics event for debug search error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_search',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug search error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to search user' }, 500);
  }
}

export async function handleDebugSnapshots(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  const cursor = c.req.query('cursor');
  const limit = parseInt(c.req.query('limit') || '100');
  
  try {
    const list = await c.env.KV_SNAPS.list({ 
      prefix: 'snap:', 
      cursor: cursor || undefined,
      limit: Math.min(limit, 1000) // Cap at 1000 for safety
    });
    
    const snapshots = [];
    for (const key of list.keys) {
      const snapRaw = await c.env.KV_SNAPS.get(key.name);
      if (snapRaw) {
        const snapshot = JSON.parse(snapRaw);
        snapshots.push(snapshot);
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
}

export async function handleDebugSnapshot(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  const id = c.req.param('id');
  
  try {
    const snapRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!snapRaw) {
      return c.json({ error: 'Snapshot not found' }, 404);
    }
    
    return c.json(JSON.parse(snapRaw));
  } catch (error: any) {
    console.error('Debug snapshot error:', error);
    
    // Track analytics event for debug snapshot error
    try {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent('system', 'error_occurred', { 
        context: 'debug_snapshot',
        error: error.message || 'Unknown error'
      });
    } catch (analyticsError) {
      console.error('Failed to track analytics for debug snapshot error:', analyticsError);
    }
    
    return c.json({ error: 'Failed to fetch snapshot' }, 500);
  }
}

export async function handleDebugStats(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    // Get user count
    const usersList = await c.env.KV_USERS.list({ prefix: 'user:' });
    const userKeys = usersList.keys.filter((key: any) => key.name.startsWith('user:') && !key.name.includes(':', 5));
    const userCount = userKeys.length;
    
    // Get snapshot count
    const snapsList = await c.env.KV_SNAPS.list({ prefix: 'snap:' });
    const snapshotCount = snapsList.keys.length;
    
    // Get analytics event count
    const eventsList = await c.env.KV_ANALYTICS.list({ prefix: 'event:' });
    const eventsCount = eventsList.keys.length;
    
    // Sample some users to calculate plan distribution
    const sampleSize = Math.min(100, userCount);
    let freePlan = 0, proPlan = 0, trialPlan = 0;
    
    for (let i = 0; i < sampleSize && i < userKeys.length; i++) {
      const userRaw = await c.env.KV_USERS.get(userKeys[i].name);
      if (userRaw) {
        const user = JSON.parse(userRaw);
        const plan = user.plan || 'free';
        const status = user.subscription?.status || user.subscriptionStatus || 'none';
        
        if (status === 'trial' || (plan === 'free' && user.trialEndsAt)) {
          trialPlan++;
        } else if (plan === 'pro' || status === 'active') {
          proPlan++;
        } else {
          freePlan++;
        }
      }
    }
    
    return c.json({
      users: {
        total: userCount,
        sample: sampleSize,
        plans: {
          free: freePlan,
          pro: proPlan,
          trial: trialPlan
        }
      },
      snapshots: {
        total: snapshotCount
      },
      analytics: {
        events: eventsCount
      },
      timestamp: new Date().toISOString()
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
    
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
}

export async function handleDebugExport(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    const exportData: any = {
      users: [],
      snapshots: [],
      analytics: []
    };
    
    // Export users
    const usersList = await c.env.KV_USERS.list({ prefix: 'user:' });
    for (const key of usersList.keys) {
      if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
        const userRaw = await c.env.KV_USERS.get(key.name);
        if (userRaw) {
          const user = JSON.parse(userRaw);
          // Remove sensitive fields
          delete user.googleId;
          delete user.passwordHash;
          exportData.users.push(user);
        }
      }
    }
    
    // Export snapshots (limit to 1000 for safety)
    const snapsList = await c.env.KV_SNAPS.list({ prefix: 'snap:', limit: 1000 });
    for (const key of snapsList.keys) {
      const snapRaw = await c.env.KV_SNAPS.get(key.name);
      if (snapRaw) {
        const snapshot = JSON.parse(snapRaw);
        exportData.snapshots.push(snapshot);
      }
    }
    
    // Export analytics events (limit to 1000 for safety)
    const eventsList = await c.env.KV_ANALYTICS.list({ prefix: 'event:', limit: 1000 });
    for (const key of eventsList.keys) {
      const eventRaw = await c.env.KV_ANALYTICS.get(key.name);
      if (eventRaw) {
        const event = JSON.parse(eventRaw);
        exportData.analytics.push(event);
      }
    }
    
    return c.json({
      export: exportData,
      counts: {
        users: exportData.users.length,
        snapshots: exportData.snapshots.length,
        analytics: exportData.analytics.length
      },
      timestamp: new Date().toISOString()
    });
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
}

export async function handleDebugHealth(c: any) {
  try {
    // Basic health check
    const now = Date.now();
    
    // Test KV access
    const testKey = `health-check-${now}`;
    await c.env.KV_USERS.put(testKey, JSON.stringify({ test: true, timestamp: now }));
    const testValue = await c.env.KV_USERS.get(testKey);
    await c.env.KV_USERS.delete(testKey);
    
    if (!testValue) {
      throw new Error('KV test failed');
    }
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        kv: 'operational'
      }
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    
    return c.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
}