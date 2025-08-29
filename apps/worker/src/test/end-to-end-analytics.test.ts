import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsManager } from '../analytics';

/**
 * END-TO-END ANALYTICS TEST
 * 
 * This test simulates the complete analytics flow:
 * 1. Event is tracked via /analytics/track
 * 2. Event is stored in KV_ANALYTICS  
 * 3. Event can be retrieved via /debug/analytics/events
 */

describe('End-to-End Analytics Flow', () => {
  let mockEnv: any;
  let analytics: AnalyticsManager;
  let storedEvents: Record<string, string> = {};
  
  beforeEach(() => {
    storedEvents = {};
    
    const mockKVAnalytics = {
      get: vi.fn().mockImplementation((key: string) => {
        console.log(`KV GET: ${key}`);
        return Promise.resolve(storedEvents[key] || null);
      }),
      put: vi.fn().mockImplementation((key: string, value: string) => {
        console.log(`KV PUT: ${key} = ${value.substring(0, 100)}...`);
        storedEvents[key] = value;
        return Promise.resolve();
      }),
      list: vi.fn().mockImplementation((options: any) => {
        const prefix = options?.prefix || '';
        const keys = Object.keys(storedEvents)
          .filter(key => key.startsWith(prefix))
          .map(key => ({ name: key }));
        
        console.log(`KV LIST: prefix=${prefix}, found ${keys.length} keys`);
        return Promise.resolve({
          keys,
          cursor: null,
          list_complete: true
        });
      })
    };

    const mockKVUsers = {
      get: vi.fn().mockResolvedValue(JSON.stringify({
        uid: 'test_user_123',
        name: 'Test User',
        analytics: { totalDownloads: 5 }
      })),
      put: vi.fn().mockResolvedValue(undefined)
    };

    mockEnv = {
      KV_USERS: mockKVUsers,
      KV_ANALYTICS: mockKVAnalytics,
      KV_SNAPS: { get: vi.fn(), put: vi.fn(), list: vi.fn() }
    };
    
    analytics = new AnalyticsManager(mockEnv);
  });

  it('should complete full analytics flow from track to retrieval', async () => {
    console.log('\n🔄 TESTING COMPLETE ANALYTICS FLOW');
    console.log('==================================');
    
    // Step 1: Track extension_downloaded event (simulating /analytics/track endpoint)
    console.log('Step 1: Tracking extension_downloaded event...');
    
    await analytics.trackEvent('test_user_123', 'extension_downloaded', {
      page: '/dashboard',
      version: '1.0.0', 
      filename: 'quickstage-1.0.0.vsix',
      isUpgrade: false
    });
    
    console.log(`✅ Event tracked. KV operations: ${mockEnv.KV_ANALYTICS.put.mock.calls.length} puts`);
    
    // Step 2: Verify event was stored
    console.log('Step 2: Verifying event storage...');
    
    const putCalls = mockEnv.KV_ANALYTICS.put.mock.calls;
    expect(putCalls.length).toBeGreaterThan(0);
    
    const eventCall = putCalls.find((call: any) => call[0].startsWith('event:'));
    expect(eventCall).toBeDefined();
    
    const [eventKey, eventDataStr] = eventCall;
    const eventData = JSON.parse(eventDataStr);
    
    console.log(`✅ Event stored with key: ${eventKey}`);
    console.log(`✅ Event type: ${eventData.eventType}`);
    console.log(`✅ Event page: ${eventData.eventData.page}`);
    
    // Step 3: Simulate /debug/analytics/events retrieval
    console.log('Step 3: Simulating admin dashboard event retrieval...');
    
    const listResult = await mockEnv.KV_ANALYTICS.list({ prefix: 'event:', limit: 100 });
    console.log(`✅ Found ${listResult.keys.length} event keys`);
    
    expect(listResult.keys.length).toBeGreaterThan(0);
    
    // Step 4: Retrieve and process events (like debug endpoint does)
    console.log('Step 4: Retrieving and processing events...');
    
    const events = [];
    for (const key of listResult.keys) {
      const eventRaw = await mockEnv.KV_ANALYTICS.get(key.name);
      if (eventRaw) {
        const event = JSON.parse(eventRaw);
        
        // Normalize event fields for frontend compatibility (like debug endpoint)
        const normalizedEvent = {
          ...event,
          type: event.eventType || event.type || 'unknown',
          page: event.eventData?.page || event.page,
          metadata: event.eventData || event.metadata || {}
        };
        
        events.push(normalizedEvent);
      }
    }
    
    console.log(`✅ Retrieved and processed ${events.length} events`);
    expect(events.length).toBeGreaterThan(0);
    
    // Step 5: Verify the extension_downloaded event is properly formatted
    console.log('Step 5: Verifying extension_downloaded event format...');
    
    const extensionDownloadEvents = events.filter(e => e.type === 'extension_downloaded');
    expect(extensionDownloadEvents.length).toBe(1);
    
    const downloadEvent = extensionDownloadEvents[0];
    expect(downloadEvent.type).toBe('extension_downloaded');
    expect(downloadEvent.userId).toBe('test_user_123');
    expect(downloadEvent.page).toBe('/dashboard');
    expect(downloadEvent.metadata.version).toBe('1.0.0');
    expect(downloadEvent.metadata.page).toBe('/dashboard');
    
    console.log(`✅ Extension download event properly formatted:`);
    console.log(`   - Type: ${downloadEvent.type}`);
    console.log(`   - User: ${downloadEvent.userId}`);  
    console.log(`   - Page: ${downloadEvent.page}`);
    console.log(`   - Version: ${downloadEvent.metadata.version}`);
    console.log(`   - Timestamp: ${new Date(downloadEvent.timestamp).toISOString()}`);
    
    console.log('\n🎉 COMPLETE ANALYTICS FLOW SUCCESSFUL!');
  });

  it('should handle page filtering correctly', async () => {
    console.log('\n🔍 TESTING PAGE FILTERING');
    console.log('=========================');
    
    // Track events from different pages
    await analytics.trackEvent('user1', 'extension_downloaded', { page: '/dashboard' });
    await analytics.trackEvent('user2', 'page_view', { page: '/settings' });  
    await analytics.trackEvent('user3', 'user_login', { page: '/login' });
    
    // Retrieve all events
    const listResult = await mockEnv.KV_ANALYTICS.list({ prefix: 'event:' });
    const events = [];
    
    for (const key of listResult.keys) {
      const eventRaw = await mockEnv.KV_ANALYTICS.get(key.name);
      if (eventRaw) {
        const event = JSON.parse(eventRaw);
        events.push({
          ...event,
          type: event.eventType,
          page: event.eventData?.page || event.page
        });
      }
    }
    
    // Test filtering by page (as admin dashboard does)
    const dashboardEvents = events.filter(e => e.page === '/dashboard');
    const settingsEvents = events.filter(e => e.page === '/settings');
    const loginEvents = events.filter(e => e.page === '/login');
    
    console.log(`✅ Total events: ${events.length}`);
    console.log(`✅ Dashboard events: ${dashboardEvents.length}`);
    console.log(`✅ Settings events: ${settingsEvents.length}`);
    console.log(`✅ Login events: ${loginEvents.length}`);
    
    expect(dashboardEvents.length).toBe(1);
    expect(settingsEvents.length).toBe(1); 
    expect(loginEvents.length).toBe(1);
    
    expect(dashboardEvents[0].type).toBe('extension_downloaded');
    expect(settingsEvents[0].type).toBe('page_view');
    expect(loginEvents[0].type).toBe('user_login');
  });
});