import { sha256Hex } from './utils';
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
                    // delete R2 objects under snap/id/
                    const id = meta.id;
                    let r2cursor = undefined;
                    do {
                        const objs = await env.R2_SNAPSHOTS.list({ prefix: `snap/${id}/`, cursor: r2cursor });
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
