import { getAnalyticsManager } from '../worker-utils';
import { getUidFromSession } from '../auth';

// Analytics tracking endpoint (public, no auth required)
export async function handleAnalyticsTrack(c: any) {
  try {
    console.log('🎯 ANALYTICS TRACK: Received analytics tracking request');
    
    let uid = 'anonymous';
    
    // Try to get user ID from session (not just authorization header)
    try {
      uid = await getUidFromSession(c) || 'anonymous';
      console.log(`🎯 ANALYTICS TRACK: User ID resolved to: ${uid}`);
    } catch (authError) {
      console.warn('🎯 ANALYTICS TRACK: Failed to get UID from session, using anonymous:', authError);
      uid = 'anonymous';
    }
    
    let body;
    try {
      body = await c.req.json();
      console.log('🎯 ANALYTICS TRACK: Successfully parsed request body:', JSON.stringify(body));
    } catch (bodyError) {
      console.error('🎯 ANALYTICS TRACK: Failed to parse request body:', bodyError);
      return c.json({ error: 'Invalid JSON in request body' }, 400);
    }
    
    const { eventType, eventData } = body;
    
    console.log(`🎯 ANALYTICS TRACK: Event type: ${eventType}`);
    console.log(`🎯 ANALYTICS TRACK: Event data:`, eventData);
    
    if (!eventType) {
      console.error('🎯 ANALYTICS TRACK: Missing eventType');
      return c.json({ error: 'eventType is required' }, 400);
    }
    
    // Track the event with additional context
    console.log(`🎯 ANALYTICS TRACK: Starting event tracking for user ${uid}`);
    const analytics = getAnalyticsManager(c);
    
    // Add additional context from request
    const enhancedEventData = {
      ...(eventData || {}),
      userAgent: c.req.header('user-agent') || 'unknown',
      referer: c.req.header('referer') || c.req.header('referrer') || undefined,
      timestamp: Date.now()
    };
    
    await analytics.trackEvent(
      uid, 
      eventType as any, 
      enhancedEventData,
      undefined, // sessionId
      c.req.header('user-agent') || 'unknown',
      c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || undefined,
      c.req.header('referer') || c.req.header('referrer') || undefined
    );
    console.log(`✅ ANALYTICS TRACK: Event tracking completed successfully`);
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ ANALYTICS TRACK: Analytics tracking error:', error);
    console.error('❌ ANALYTICS TRACK: Error details:', {
      message: error.message,
      stack: error.stack
    });
    return c.json({ error: 'Failed to track event' }, 500);
  }
}
