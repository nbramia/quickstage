import { sha256Hex } from './utils';
import { getAnalyticsManager } from './worker-utils';
/**
 * Snapshot management utilities for the QuickStage Worker
 * Handles view counting, expiration, and cleanup
 */
/**
 * Increment unique view count for a snapshot
 * Uses IP + User-Agent fingerprinting to prevent duplicate counting
 */
export async function incrementUniqueViewCount(c, snapshotId, meta) {
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
        console.log(`🔍 View counting debug for ${snapshotId}: existingView=${!!existingView}, current analytics.viewCount=${meta.analytics?.viewCount || 0}`);
        if (!existingView) {
            // This is a new unique viewer
            // Use a distributed lock to prevent race conditions
            const lockKey = `lock:${snapshotId}:${viewerFingerprint}`;
            const lockValue = JSON.stringify({ timestamp: now, ip, userAgent });
            // Try to acquire lock with 5 second expiration
            const lockAcquired = await c.env.KV_SNAPS.put(lockKey, lockValue, { expirationTtl: 5 });
            if (lockAcquired) {
                // Double-check that we still haven't been counted (race condition protection)
                const doubleCheck = await c.env.KV_SNAPS.get(viewerKey);
                if (doubleCheck) {
                    console.log(`🔍 Race condition detected for ${snapshotId}, skipping double count`);
                    return;
                }
                // Store viewer record with 24-hour expiration to prevent immediate re-counting
                await c.env.KV_SNAPS.put(viewerKey, JSON.stringify({
                    ip,
                    userAgent,
                    timestamp: now,
                    snapshotId
                }), { expirationTtl: 86400 }); // 24 hours
                // Ensure analytics object exists and update it
                if (!meta.analytics) {
                    meta.analytics = {
                        viewCount: 0,
                        uniqueViewers: 0,
                        commentCount: 0,
                        lastViewedAt: 0,
                        createdAt: meta.createdAt || Date.now(),
                        viewerCountries: []
                    };
                }
                // Increment view count and unique viewers in analytics schema
                meta.analytics.viewCount = (meta.analytics.viewCount || 0) + 1;
                meta.analytics.uniqueViewers = (meta.analytics.uniqueViewers || 0) + 1;
                meta.analytics.lastViewedAt = Date.now();
                await c.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(meta));
                // Release the lock
                await c.env.KV_SNAPS.delete(lockKey);
                // Track analytics event for snapshot view
                try {
                    const analytics = getAnalyticsManager(c);
                    await analytics.trackEvent('anonymous', 'snapshot_viewed', {
                        snapshotId,
                        ip,
                        userAgent: userAgent.substring(0, 100), // Truncate for storage
                        isUniqueView: true
                    });
                }
                catch (analyticsError) {
                    console.error('Failed to track snapshot view analytics:', analyticsError);
                    // Don't fail the request if analytics fail
                }
                console.log(`👁️ New unique viewer for snapshot ${snapshotId}: ${ip} (total views: ${meta.analytics.viewCount})`);
            }
            else {
                console.log(`🔍 Lock not acquired for ${snapshotId}, skipping view count (likely concurrent request)`);
            }
        }
        else {
            console.log(`👁️ Returning viewer for snapshot ${snapshotId}: ${ip} (not counted)`);
        }
    }
    catch (error) {
        console.error('Error incrementing view count:', error);
        // Don't fail the request if view counting fails
    }
}
/**
 * Purge expired snapshots from R2 storage
 * Keeps metadata in KV for dashboard display but removes files to save storage
 */
export async function purgeExpired(env) {
    let cursor = undefined;
    do {
        const list = await env.KV_SNAPS.list({ prefix: 'snap:', cursor });
        cursor = list.cursor;
        for (const k of list.keys) {
            const metaRaw = await env.KV_SNAPS.get(k.name);
            if (!metaRaw)
                continue;
            try {
                const meta = JSON.parse(metaRaw);
                if (meta.expiresAt && meta.expiresAt < Date.now()) {
                    const id = meta.id;
                    // Delete R2 objects under snap/id/ (snapshot files)
                    let r2cursor = undefined;
                    do {
                        const objs = await env.R2_SNAPSHOTS.list({ prefix: `snap/${id}/`, cursor: r2cursor });
                        r2cursor = objs.cursor;
                        if (objs.objects.length) {
                            await env.R2_SNAPSHOTS.delete(objs.objects.map((o) => o.key));
                        }
                    } while (r2cursor);
                    // Delete comment attachments under attachments/snapshotId/
                    r2cursor = undefined;
                    do {
                        const objs = await env.R2_SNAPSHOTS.list({ prefix: `attachments/${id}/`, cursor: r2cursor });
                        r2cursor = objs.cursor;
                        if (objs.objects.length) {
                            await env.R2_SNAPSHOTS.delete(objs.objects.map((o) => o.key));
                        }
                    } while (r2cursor);
                    // Don't delete from KV - keep metadata for dashboard display
                    // Don't remove from user's list - keep expired snapshots visible when "All" is selected
                    // Only clean up R2 objects to save storage
                }
            }
            catch { }
        }
    } while (cursor);
}
