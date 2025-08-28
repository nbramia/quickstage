import { getAnalyticsManager } from '../worker-utils';
import { getUidFromSession } from '../auth';

// Analytics tracking endpoint (public, no auth required)
export async function handleAnalyticsTrack(c: any) {
  try {
    let uid = 'anonymous';
    if (c.req.header('authorization')) {
      uid = await getUidFromSession(c) || 'anonymous';
    }
    
    const body = await c.req.json();
    const { eventType, eventData } = body;
    
    if (!eventType) {
      return c.json({ error: 'eventType is required' }, 400);
    }
    
    // Track the event
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, eventType as any, eventData || {});
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Analytics tracking error:', error);
    return c.json({ error: 'Failed to track event' }, 500);
  }
}
