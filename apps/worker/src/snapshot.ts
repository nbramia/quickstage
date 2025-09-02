import { sha256Hex } from './utils';
import { Bindings } from './types';

/**
 * Snapshot management utilities for the QuickStage Worker
 * Handles view counting, expiration, and cleanup
 */

/**
 * Increment unique view count for a snapshot
 * Uses IP + User-Agent fingerprinting to prevent duplicate counting
 */
export async function incrementUniqueViewCount(c: any, snapshotId: string, meta: any) {
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
      
      // Increment view count - update both legacy and new schema
      meta.viewCount = (meta.viewCount || 0) + 1;
      
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
      meta.analytics.viewCount = (meta.analytics.viewCount || 0) + 1;
      meta.analytics.lastViewedAt = Date.now();
      
      await c.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(meta));
      
      console.log(`👁️ New unique viewer for snapshot ${snapshotId}: ${ip} (total views: ${meta.analytics.viewCount})`);
    } else {
      console.log(`👁️ Returning viewer for snapshot ${snapshotId}: ${ip} (not counted)`);
    }
  } catch (error) {
    console.error('Error incrementing view count:', error);
    // Don't fail the request if view counting fails
  }
}

/**
 * Purge expired snapshots from R2 storage
 * Keeps metadata in KV for dashboard display but removes files to save storage
 */
export async function purgeExpired(env: Bindings) {
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
          const id = meta.id as string;
          
          // Delete R2 objects under snap/id/ (snapshot files)
          let r2cursor: string | undefined = undefined;
          do {
            const objs: any = await env.R2_SNAPSHOTS.list({ prefix: `snap/${id}/`, cursor: r2cursor });
            r2cursor = objs.cursor as string | undefined;
            if (objs.objects.length) {
              await env.R2_SNAPSHOTS.delete((objs.objects as any[]).map((o: any) => o.key as string));
            }
          } while (r2cursor);
          
          // Delete comment attachments under attachments/snapshotId/
          r2cursor = undefined;
          do {
            const objs: any = await env.R2_SNAPSHOTS.list({ prefix: `attachments/${id}/`, cursor: r2cursor });
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
