import { isSuperadmin } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
import { canAccessProFeatures, getSubscriptionDisplayStatus } from '../user';
// Constants for reverse timestamp strategy
const MAX_TS = 10000000000000; // Same constant used in analytics.ts
// Helper function to extract original timestamp from inverted event key
function extractTimestampFromKey(eventKey) {
    try {
        // Handle both old (evt_timestamp_id) and new (evt_inverted_id) formats
        const keyParts = eventKey.replace('event:', '').split('_');
        if (keyParts.length >= 2 && keyParts[0] === 'evt' && keyParts[1]) {
            const timestampPart = parseInt(keyParts[1]);
            // Detect if this is an inverted timestamp (much larger than current time)
            const currentTime = Date.now();
            if (timestampPart > currentTime * 2) {
                // This is an inverted timestamp - convert back to original
                return MAX_TS - timestampPart;
            }
            else {
                // This is a regular timestamp from old format
                return timestampPart;
            }
        }
        return null;
    }
    catch (e) {
        return null;
    }
}
// Smart retrieval for recent events - now simplified with inverted timestamps
async function handleSmartRecentEventsRetrieval(c, requestedLimit, startTime) {
    console.log(`🔍 SMART RETRIEVAL: Starting smart recent events retrieval with inverted timestamps...`);
    const allEvents = [];
    const userCache = new Map();
    let processedCount = 0;
    let skippedByTime = 0;
    const startExecutionTime = Date.now();
    try {
        // With inverted timestamps, the first results from KV.list() are the newest events!
        // No need for complex time-range searching - just paginate until we have enough
        let cursor = undefined;
        let totalKeysChecked = 0;
        const maxKeysToCheck = 2000; // Reasonable limit to prevent timeout
        while (totalKeysChecked < maxKeysToCheck && allEvents.length < requestedLimit) {
            const list = await c.env.KV_ANALYTICS.list({
                prefix: 'event:evt_',
                limit: 500,
                cursor: cursor
            });
            console.log(`🔍 SMART RETRIEVAL: Checking batch of ${list.keys.length} keys (total checked: ${totalKeysChecked})`);
            totalKeysChecked += list.keys.length;
            // Process keys in order (newest first due to inverted timestamps)
            for (const key of list.keys) {
                if (key.name.startsWith('event:evt_')) {
                    // Extract original timestamp from key
                    const originalTimestamp = extractTimestampFromKey(key.name);
                    if (originalTimestamp) {
                        // Check if this event falls within our time window
                        if (startTime && originalTimestamp < startTime) {
                            skippedByTime++;
                            continue;
                        }
                        // Fetch and process the event
                        const eventRaw = await c.env.KV_ANALYTICS.get(key.name);
                        if (eventRaw) {
                            const event = JSON.parse(eventRaw);
                            processedCount++;
                            console.log(`🔍 SMART RETRIEVAL: Processing event ${event.id} with timestamp ${originalTimestamp}`);
                            // Normalize event fields for frontend compatibility
                            const normalizedEvent = {
                                ...event,
                                type: event.eventType || event.type || 'unknown',
                                page: event.eventData?.page || event.page,
                                metadata: event.eventData || event.metadata || {}
                            };
                            // Enhance event with user details
                            if (normalizedEvent.userId && normalizedEvent.userId !== 'system' && normalizedEvent.userId !== 'anonymous') {
                                if (userCache.has(normalizedEvent.userId)) {
                                    const cachedUser = userCache.get(normalizedEvent.userId);
                                    normalizedEvent.userName = cachedUser.name;
                                    normalizedEvent.userEmail = cachedUser.email;
                                }
                                else {
                                    try {
                                        const userRaw = await c.env.KV_USERS.get(`user:${normalizedEvent.userId}`);
                                        if (userRaw) {
                                            const user = JSON.parse(userRaw);
                                            const userData = {
                                                name: user.name || 'Unknown',
                                                email: user.email || 'No email'
                                            };
                                            userCache.set(normalizedEvent.userId, userData);
                                            normalizedEvent.userName = userData.name;
                                            normalizedEvent.userEmail = userData.email;
                                        }
                                        else {
                                            userCache.set(normalizedEvent.userId, { name: 'User Not Found', email: 'No email' });
                                            normalizedEvent.userName = 'User Not Found';
                                            normalizedEvent.userEmail = 'No email';
                                        }
                                    }
                                    catch (userError) {
                                        console.error('Failed to fetch user details for event:', userError);
                                        const errorData = { name: 'Error loading user', email: 'Error loading email' };
                                        userCache.set(normalizedEvent.userId, errorData);
                                        normalizedEvent.userName = errorData.name;
                                        normalizedEvent.userEmail = errorData.email;
                                    }
                                }
                            }
                            allEvents.push(normalizedEvent);
                            // Break if we have enough events
                            if (allEvents.length >= requestedLimit)
                                break;
                        }
                    }
                }
            }
            // Check if we should continue or stop
            if (list.list_complete || !list.cursor || allEvents.length >= requestedLimit) {
                console.log(`🔍 SMART RETRIEVAL: Stopping - complete: ${list.list_complete}, cursor: ${!!list.cursor}, events: ${allEvents.length}`);
                break;
            }
            cursor = list.cursor;
        }
        // Events are already in chronological order (newest first) due to inverted timestamps
        // Just apply the requested limit
        const events = allEvents.slice(0, requestedLimit);
        console.log(`🔍 SMART RETRIEVAL: Final result: ${events.length} events (processed ${processedCount} total)`);
        if (events.length > 0) {
            console.log(`🔍 SMART RETRIEVAL: Newest event: ${events[0].id} at ${new Date(events[0].timestamp).toISOString()}`);
            console.log(`🔍 SMART RETRIEVAL: Oldest returned event: ${events[events.length - 1].id} at ${new Date(events[events.length - 1].timestamp).toISOString()}`);
        }
        return c.json({
            events,
            cursor: null,
            truncated: allEvents.length > events.length,
            total: events.length,
            debug: {
                totalEventsFound: allEvents.length,
                totalKeysChecked: totalKeysChecked,
                processedEvents: processedCount,
                skippedByTimeFilter: skippedByTime,
                finalEventCount: events.length,
                smartRetrievalWithInvertedTimestamps: true,
                startTimeFilter: startTime ? new Date(startTime).toISOString() : null,
                executionTimeMs: Date.now() - startExecutionTime,
                userCacheSize: userCache.size
            }
        });
    }
    catch (error) {
        console.error('Smart retrieval error:', error);
        throw error;
    }
}
// Helper function to search for events in a specific timestamp range
async function searchEventsByTimestampRange(c, startTime, endTime) {
    const events = [];
    // Try to find events by searching for likely prefixes in this time range
    // We'll search in chunks to avoid API limits
    const timeChunks = [];
    const chunkSize = 60 * 60 * 1000; // 1 hour chunks
    for (let t = startTime; t <= endTime; t += chunkSize) {
        timeChunks.push({
            start: t,
            end: Math.min(t + chunkSize - 1, endTime)
        });
    }
    for (const chunk of timeChunks.slice(0, 10)) { // Limit to 10 chunks to avoid timeout
        // Look for events that would have been created in this time chunk
        const chunkEvents = await searchEventChunk(c, chunk.start, chunk.end);
        events.push(...chunkEvents);
        if (events.length > 1000)
            break; // Prevent memory issues
    }
    return events;
}
// Search for events in a specific time chunk using KV list with prefixes
async function searchEventChunk(c, startTime, endTime) {
    const events = [];
    try {
        // The issue is that KV.list() returns keys in alphabetical order, not chronological
        // Recent events with high timestamps like 1757082192005 won't be in the first 200 keys
        // We need to use a different approach - search through more keys or use cursor pagination
        let cursor = undefined;
        let totalKeysChecked = 0;
        const maxKeysToCheck = 2000; // Check up to 2000 keys to find recent events
        let found = 0;
        while (totalKeysChecked < maxKeysToCheck) {
            const list = await c.env.KV_ANALYTICS.list({
                prefix: 'event:evt_',
                limit: 500, // Larger batch size
                cursor: cursor
            });
            console.log(`🔍 SMART RETRIEVAL: Checking batch of ${list.keys.length} keys (total checked: ${totalKeysChecked})`);
            // Process all keys to find events in our time range
            for (const key of list.keys) {
                if (key.name.startsWith('event:evt_')) {
                    try {
                        // Extract timestamp from key name: event:evt_1757082192005_randomid
                        const keyParts = key.name.split('_');
                        if (keyParts.length >= 2) {
                            const keyTimestamp = parseInt(keyParts[1]);
                            // Only fetch events that fall within our time range
                            if (keyTimestamp >= startTime && keyTimestamp <= endTime) {
                                console.log(`🔍 SMART RETRIEVAL: Found matching key: ${key.name} (timestamp: ${keyTimestamp})`);
                                const eventRaw = await c.env.KV_ANALYTICS.get(key.name);
                                if (eventRaw) {
                                    const event = JSON.parse(eventRaw);
                                    events.push(event);
                                    found++;
                                }
                            }
                        }
                    }
                    catch (e) {
                        // Skip malformed keys
                        continue;
                    }
                }
            }
            totalKeysChecked += list.keys.length;
            // If we found some events or we've reached the end, stop
            if (found > 0 || list.list_complete || !list.cursor) {
                console.log(`🔍 SMART RETRIEVAL: Stopping search - found ${found} events after checking ${totalKeysChecked} keys`);
                break;
            }
            cursor = list.cursor;
        }
        console.log(`🔍 SMART RETRIEVAL: Final result for time range ${startTime}-${endTime}: ${events.length} events`);
        return events;
    }
    catch (error) {
        console.error('Error searching event chunk:', error);
        return [];
    }
}
// Debug route handlers
export async function handleDebugAnalyticsEvents(c) {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        const requestedLimit = parseInt(c.req.query('limit') || '500');
        const startTime = c.req.query('startTime') ? parseInt(c.req.query('startTime')) : undefined;
        const fullRetrieval = c.req.query('fullRetrieval') === 'true';
        console.log(`🔍 DEBUG ANALYTICS EVENTS: Requested limit: ${requestedLimit}`);
        console.log(`🔍 DEBUG ANALYTICS EVENTS: StartTime filter: ${startTime} (${startTime ? new Date(startTime).toISOString() : 'none'})`);
        console.log(`🔍 DEBUG ANALYTICS EVENTS: Full retrieval mode: ${fullRetrieval}`);
        if (fullRetrieval) {
            // Use the new smart retrieval strategy for full retrieval mode
            return await handleSmartRecentEventsRetrieval(c, requestedLimit, startTime);
        }
        else {
            // Fast path: Now optimized with inverted timestamps - first results are newest!
            console.log(`🔍 DEBUG ANALYTICS EVENTS: Using fast retrieval with inverted timestamps (limited to ${requestedLimit} events)`);
            const list = await c.env.KV_ANALYTICS.list({
                prefix: 'event:evt_', // More specific prefix for efficiency
                limit: Math.min(requestedLimit, 500)
            });
            console.log(`🔍 DEBUG ANALYTICS EVENTS: Found ${list.keys.length} keys in KV (fast mode)`);
            const events = [];
            let processedCount = 0;
            let skippedByTime = 0;
            const userCache = new Map();
            // Process keys in order - they're already newest-first due to inverted timestamps
            for (const key of list.keys) {
                if (key.name.startsWith('event:evt_')) {
                    // Extract original timestamp from key for filtering
                    const originalTimestamp = extractTimestampFromKey(key.name);
                    if (originalTimestamp) {
                        // Filter by time window if provided
                        if (startTime && originalTimestamp < startTime) {
                            skippedByTime++;
                            continue; // Skip events older than startTime
                        }
                        const eventRaw = await c.env.KV_ANALYTICS.get(key.name);
                        if (eventRaw) {
                            const event = JSON.parse(eventRaw);
                            processedCount++;
                            // Normalize event fields for frontend compatibility
                            const normalizedEvent = {
                                ...event,
                                type: event.eventType || event.type || 'unknown',
                                page: event.eventData?.page || event.page,
                                metadata: event.eventData || event.metadata || {}
                            };
                            // Enhance event with user details
                            if (normalizedEvent.userId && normalizedEvent.userId !== 'system' && normalizedEvent.userId !== 'anonymous') {
                                if (userCache.has(normalizedEvent.userId)) {
                                    const cachedUser = userCache.get(normalizedEvent.userId);
                                    normalizedEvent.userName = cachedUser.name;
                                    normalizedEvent.userEmail = cachedUser.email;
                                }
                                else {
                                    try {
                                        const userRaw = await c.env.KV_USERS.get(`user:${normalizedEvent.userId}`);
                                        if (userRaw) {
                                            const user = JSON.parse(userRaw);
                                            const userData = {
                                                name: user.name || 'Unknown',
                                                email: user.email || 'No email'
                                            };
                                            userCache.set(normalizedEvent.userId, userData);
                                            normalizedEvent.userName = userData.name;
                                            normalizedEvent.userEmail = userData.email;
                                        }
                                        else {
                                            userCache.set(normalizedEvent.userId, { name: 'User Not Found', email: 'No email' });
                                            normalizedEvent.userName = 'User Not Found';
                                            normalizedEvent.userEmail = 'No email';
                                        }
                                    }
                                    catch (userError) {
                                        console.error('Failed to fetch user details for event:', userError);
                                        const errorData = { name: 'Error loading user', email: 'Error loading email' };
                                        userCache.set(normalizedEvent.userId, errorData);
                                        normalizedEvent.userName = errorData.name;
                                        normalizedEvent.userEmail = errorData.email;
                                    }
                                }
                            }
                            events.push(normalizedEvent);
                        }
                    }
                }
            }
            // Events are already in correct order (newest first) due to inverted timestamps
            // No need to sort - just limit if needed
            const finalEvents = events.slice(0, requestedLimit);
            console.log(`🔍 DEBUG ANALYTICS EVENTS: Fast mode result: ${finalEvents.length} events`);
            if (finalEvents.length > 0) {
                console.log(`🔍 DEBUG ANALYTICS EVENTS: Newest event: ${finalEvents[0].id} at ${new Date(finalEvents[0].timestamp).toISOString()}`);
                console.log(`🔍 DEBUG ANALYTICS EVENTS: Oldest returned event: ${finalEvents[finalEvents.length - 1].id} at ${new Date(finalEvents[finalEvents.length - 1].timestamp).toISOString()}`);
            }
            return c.json({
                events: finalEvents,
                cursor: list.cursor,
                truncated: list.list_complete === false,
                total: finalEvents.length,
                debug: {
                    totalKeysFound: list.keys.length,
                    processedEvents: processedCount,
                    skippedByTimeFilter: skippedByTime,
                    finalEventCount: finalEvents.length,
                    fastModeWithInvertedTimestamps: true,
                    startTimeFilter: startTime ? new Date(startTime).toISOString() : null,
                    userCacheSize: userCache.size
                }
            });
        }
    }
    catch (error) {
        console.error('Debug analytics events error:', error);
        // Track analytics event for debug analytics events error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_analytics_events',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug analytics events error:', analyticsError);
        }
        return c.json({ error: 'Failed to fetch analytics events' }, 500);
    }
}
export async function handleDebugMigrationStats(c) {
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
    }
    catch (error) {
        console.error('Migration stats error:', error);
        return c.json({ error: 'Failed to get migration stats' }, 500);
    }
}
export async function handleDebugMigrationRun(c) {
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
}
export async function handleDebugMigrationUsers(c) {
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
        // Track analytics event for user migration error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'user_migration',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for user migration error:', analyticsError);
        }
        return c.json({ error: 'Failed to run user migration' }, 500);
    }
}
export async function handleDebugMigrationSnapshots(c) {
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
        // Track analytics event for snapshot migration error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'snapshot_migration',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for snapshot migration error:', analyticsError);
        }
        return c.json({ error: 'Failed to run snapshot migration' }, 500);
    }
}
export async function handleDebugFixSubscription(c) {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    const uid = c.req.param('uid');
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
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
export async function handleDebugUser(c) {
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
}
export async function handleDebugUserByEmail(c) {
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
}
export async function handleDebugUsers(c) {
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
}
export async function handleDebugUserDetail(c) {
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
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug user error:', analyticsError);
        }
        return c.json({ error: 'Failed to fetch user' }, 500);
    }
}
export async function handleDebugSearchEmail(c) {
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
    }
    catch (error) {
        console.error('Debug search error:', error);
        // Track analytics event for debug search error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_search',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug search error:', analyticsError);
        }
        return c.json({ error: 'Failed to search user' }, 500);
    }
}
export async function handleDebugSnapshots(c) {
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
}
export async function handleDebugSnapshot(c) {
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
    }
    catch (error) {
        console.error('Debug snapshot error:', error);
        // Track analytics event for debug snapshot error
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('system', 'error_occurred', {
                context: 'debug_snapshot',
                error: error.message || 'Unknown error'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for debug snapshot error:', analyticsError);
        }
        return c.json({ error: 'Failed to fetch snapshot' }, 500);
    }
}
export async function handleDebugStats(c) {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        // Get user count
        const usersList = await c.env.KV_USERS.list({ prefix: 'user:' });
        const userKeys = usersList.keys.filter((key) => key.name.startsWith('user:') && !key.name.includes(':', 5));
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
                }
                else if (plan === 'pro' || status === 'active') {
                    proPlan++;
                }
                else {
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
        return c.json({ error: 'Failed to fetch stats' }, 500);
    }
}
export async function handleDebugExport(c) {
    if (!(await isSuperadmin(c))) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    try {
        const exportData = {
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
}
export async function handleDebugHealth(c) {
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
    }
    catch (error) {
        console.error('Health check error:', error);
        return c.json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        }, 500);
    }
}
