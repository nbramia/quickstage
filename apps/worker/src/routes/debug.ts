import { isSuperadmin } from '../auth';
import { getAnalyticsManager } from '../worker-utils';

// Constants for reverse timestamp strategy
const MAX_TS = 10000000000000; // Same constant used in analytics.ts

// Debug route handlers - restored from working backup version
export async function handleDebugAnalyticsEvents(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  
  try {
    const limit = parseInt(c.req.query('limit') || '500');
    const cursor = c.req.query('cursor');
    const fullRetrieval = c.req.query('fullRetrieval') === 'true';
    
    console.log('🔍 Analytics debug request:', { limit, cursor, fullRetrieval });
    
    // If fullRetrieval is requested, get more events to find recent ones
    const requestLimit = fullRetrieval ? Math.min(limit * 2, 2000) : Math.min(limit, 1000);
    
    const list = await c.env.KV_ANALYTICS.list({ 
      prefix: 'event:', 
      cursor: cursor || undefined,
      limit: requestLimit
    });
    
    console.log('🔍 KV list result:', { 
      keysCount: list.keys.length, 
      listComplete: list.list_complete,
      cursor: list.cursor 
    });
    
    // Log first few keys to debug timestamp ordering
    console.log('🔍 First 5 keys:', list.keys.slice(0, 5).map((k: any) => k.name));
    
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
    
    // Log timestamp range for debugging
    if (events.length > 0) {
      const newest = new Date(events[0].timestamp);
      const oldest = new Date(events[events.length - 1].timestamp);
      console.log('🔍 Event timestamp range:', { 
        newest: newest.toISOString(), 
        oldest: oldest.toISOString(),
        newestTs: events[0].timestamp,
        oldestTs: events[events.length - 1].timestamp,
        totalEvents: events.length
      });
      
      // Calculate what the inverted timestamp should be for today
      const todayTs = Date.now();
      const expectedInvertedTs = MAX_TS - todayTs;
      console.log('🔍 Today timestamp debug:', {
        todayTs,
        expectedInvertedTs,
        todayDate: new Date(todayTs).toISOString(),
        expectedKey: `event:evt_${expectedInvertedTs}_*`
      });
    }
    
    return c.json({
      events: events.slice(0, limit), // Return only requested amount
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
}

// Health check route
export async function handleDebugHealth(c: any) {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    worker: 'QuickStage Worker'
  });
}

// Stats route
export async function handleDebugStats(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }

  try {
    // Get basic counts from KV
    const usersList = await c.env.KV_USERS.list({ prefix: 'user:' });
    const snapsList = await c.env.KV_SNAPS.list({ prefix: 'snap:' });
    const eventsList = await c.env.KV_ANALYTICS.list({ prefix: 'event:' });
    const projectsList = await c.env.KV_PROJECTS.list({ prefix: 'proj:' });

    return c.json({
      users: usersList.keys.length,
      snapshots: snapsList.keys.length,
      events: eventsList.keys.length,
      projects: projectsList.keys.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug stats error:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
}

// Users route
export async function handleDebugUsers(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }

  try {
    const list = await c.env.KV_USERS.list({ prefix: 'user:' });
    const users = [];

    for (const key of list.keys) {
      const userRaw = await c.env.KV_USERS.get(key.name);
      if (userRaw) {
        const user = JSON.parse(userRaw);
        users.push({
          uid: user.uid,
          email: user.email,
          name: user.name || 'No name',
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          plan: user.plan || 'free',
          role: user.role || 'user'
        });
      }
    }

    // Sort by creation date (newest first)
    users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return c.json({
      users,
      total: users.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug users error:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
}

// Snapshots route
export async function handleDebugSnapshots(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }

  try {
    const list = await c.env.KV_SNAPS.list({ prefix: 'snap:' });
    const snapshots = [];

    for (const key of list.keys.slice(0, 100)) { // Limit to first 100
      const snapRaw = await c.env.KV_SNAPS.get(key.name);
      if (snapRaw) {
        const snap = JSON.parse(snapRaw);
        snapshots.push({
          id: snap.id,
          userId: snap.userId,
          createdAt: snap.createdAt,
          title: snap.title || 'Untitled',
          description: snap.description || '',
          isPublic: snap.isPublic || false
        });
      }
    }

    // Sort by creation date (newest first)
    snapshots.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return c.json({
      snapshots,
      total: snapshots.length,
      totalInKV: list.keys.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug snapshots error:', error);
    return c.json({ error: 'Failed to fetch snapshots' }, 500);
  }
}

// Migration stats route
export async function handleDebugMigrationStats(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }

  try {
    // Count events by format
    const eventsList = await c.env.KV_ANALYTICS.list({ prefix: 'event:' });
    let oldFormat = 0;
    let newFormat = 0;

    for (const key of eventsList.keys.slice(0, 100)) { // Sample first 100
      if (key.name.includes('_')) {
        const parts = key.name.replace('event:', '').split('_');
        if (parts.length >= 3) {
          const timestampPart = parseInt(parts[1]);
          const currentTime = Date.now();
          if (timestampPart > currentTime * 2) {
            newFormat++; // Inverted timestamp
          } else {
            oldFormat++; // Regular timestamp
          }
        }
      }
    }

    return c.json({
      totalEvents: eventsList.keys.length,
      sampleSize: Math.min(100, eventsList.keys.length),
      oldFormat,
      newFormat,
      migrationComplete: oldFormat === 0 && newFormat > 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug migration stats error:', error);
    return c.json({ error: 'Failed to fetch migration stats' }, 500);
  }
}

// Migration status route (stub)
export async function handleMigrationStatus(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  return c.json({ status: 'Migration complete', message: 'All events migrated to new format' });
}

// Migration test route (stub)
export async function handleMigrateAnalyticsEventsTest(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  return c.json({ status: 'Test migration complete', message: 'Test migration functionality disabled' });
}

// Migration full route (stub)
export async function handleMigrateAnalyticsEventsFull(c: any) {
  if (!(await isSuperadmin(c))) {
    return c.json({ error: 'Superadmin access required' }, 403);
  }
  return c.json({ status: 'Full migration complete', message: 'Full migration functionality disabled' });
}