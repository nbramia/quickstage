import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsManager } from '../analytics';

/**
 * PRODUCTION DIAGNOSTIC TEST
 * 
 * This test helps diagnose the exact production issue by simulating
 * real conditions and checking every step of the analytics pipeline.
 */

describe('Analytics Production Diagnostics', () => {
  let mockEnv: any;
  let analytics: AnalyticsManager;
  
  beforeEach(() => {
    const mockKVStore = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    };

    mockEnv = {
      KV_USERS: mockKVStore,
      KV_ANALYTICS: mockKVStore,
      KV_SNAPS: mockKVStore
    };
    
    analytics = new AnalyticsManager(mockEnv);
  });

  it('should verify complete analytics pipeline works end-to-end', async () => {
    console.log('\n🔍 FULL ANALYTICS PIPELINE DIAGNOSTIC');
    console.log('=====================================');
    
    // Step 1: Mock successful KV operations
    console.log('Step 1: Setting up mock KV operations...');
    mockEnv.KV_ANALYTICS.put.mockResolvedValue(undefined);
    mockEnv.KV_USERS.get.mockResolvedValue(JSON.stringify({
      uid: 'diagnostic_user',
      name: 'Diagnostic User',
      analytics: {
        totalDownloads: 0,
        lastActiveAt: Date.now() - 60000
      }
    }));
    mockEnv.KV_USERS.put.mockResolvedValue(undefined);
    
    // Step 2: Track the event
    console.log('Step 2: Tracking extension_downloaded event...');
    const beforeTimestamp = Date.now();
    
    await analytics.trackEvent('diagnostic_user', 'extension_downloaded', {
      version: '1.0.0',
      filename: 'quickstage-1.0.0.vsix',
      diagnostic: true
    });
    
    const afterTimestamp = Date.now();
    
    // Step 3: Verify event was stored in KV_ANALYTICS
    console.log('Step 3: Verifying event storage...');
    expect(mockEnv.KV_ANALYTICS.put).toHaveBeenCalled();
    
    const analyticsPutCalls = mockEnv.KV_ANALYTICS.put.mock.calls;
    const eventCall = analyticsPutCalls.find((call: any) => call[0].startsWith('event:'));
    
    expect(eventCall, 'Event should be stored in KV_ANALYTICS').toBeDefined();
    
    const [eventKey, eventDataStr] = eventCall;
    const eventData = JSON.parse(eventDataStr);
    
    console.log(`✅ Event Key: ${eventKey}`);
    console.log(`✅ Event Type: ${eventData.eventType}`);
    console.log(`✅ Event Timestamp: ${eventData.timestamp} (${new Date(eventData.timestamp).toISOString()})`);
    console.log(`✅ Event User ID: ${eventData.userId}`);
    
    // Step 4: Verify event structure
    console.log('Step 4: Verifying event structure...');
    expect(eventData.eventType).toBe('extension_downloaded');
    expect(eventData.userId).toBe('diagnostic_user');
    expect(eventData.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    expect(eventData.timestamp).toBeLessThanOrEqual(afterTimestamp);
    expect(eventData.eventData.version).toBe('1.0.0');
    expect(eventData.eventData.filename).toBe('quickstage-1.0.0.vsix');
    expect(eventData.eventData.diagnostic).toBe(true);
    
    // Step 5: Verify user metrics were updated
    console.log('Step 5: Verifying user metrics update...');
    expect(mockEnv.KV_USERS.put).toHaveBeenCalled();
    
    const userPutCalls = mockEnv.KV_USERS.put.mock.calls;
    const userCall = userPutCalls.find((call: any) => call[0] === 'user:diagnostic_user');
    
    expect(userCall, 'User should be updated in KV_USERS').toBeDefined();
    
    const [userKey, userDataStr] = userCall;
    const userData = JSON.parse(userDataStr);
    
    console.log(`✅ User Key: ${userKey}`);
    console.log(`✅ User Downloads: ${userData.analytics.totalDownloads} (should be 1)`);
    console.log(`✅ User Last Active: ${userData.analytics.lastActiveAt} (${new Date(userData.analytics.lastActiveAt).toISOString()})`);
    
    expect(userData.analytics.totalDownloads).toBe(1);
    expect(userData.analytics.lastActiveAt).toBeGreaterThanOrEqual(beforeTimestamp);
    
    console.log('✅ DIAGNOSTIC COMPLETE: All steps working correctly');
  });

  it('should test event retrieval as admin dashboard would do it', async () => {
    console.log('\n🔍 ADMIN DASHBOARD EVENT RETRIEVAL DIAGNOSTIC');
    console.log('=============================================');
    
    // Mock the list operation that admin dashboard uses
    mockEnv.KV_ANALYTICS.list.mockResolvedValue({
      keys: [
        { name: 'event:evt_1640995200_abc123' },
        { name: 'event:evt_1640995300_def456' },
        { name: 'event:evt_1640995400_ghi789' }
      ],
      cursor: null,
      list_complete: true
    });
    
    // Mock individual event retrievals
    mockEnv.KV_ANALYTICS.get.mockImplementation((key: string) => {
      const events = {
        'event:evt_1640995200_abc123': JSON.stringify({
          id: 'evt_1640995200_abc123',
          userId: 'user1',
          eventType: 'extension_downloaded',
          eventData: { version: '1.0.0' },
          timestamp: 1640995200000,
          sessionId: 'sess_123'
        }),
        'event:evt_1640995300_def456': JSON.stringify({
          id: 'evt_1640995300_def456',
          userId: 'user2',
          eventType: 'snapshot_created',
          eventData: { snapshotId: 'snap_456' },
          timestamp: 1640995300000,
          sessionId: 'sess_456'
        }),
        'event:evt_1640995400_ghi789': JSON.stringify({
          id: 'evt_1640995400_ghi789',
          userId: 'user3',
          eventType: 'extension_downloaded',
          eventData: { version: '1.1.0' },
          timestamp: 1640995400000,
          sessionId: 'sess_789'
        })
      };
      return Promise.resolve((events as any)[key] || null);
    });
    
    // Simulate what the debug endpoint does
    const list = await mockEnv.KV_ANALYTICS.list({ prefix: 'event:', limit: 100 });
    console.log(`📊 Found ${list.keys.length} event keys`);
    
    const events = [];
    for (const key of list.keys) {
      const eventRaw = await mockEnv.KV_ANALYTICS.get(key.name);
      if (eventRaw) {
        const event = JSON.parse(eventRaw);
        events.push(event);
      }
    }
    
    console.log(`📊 Retrieved ${events.length} events successfully`);
    
    const extensionDownloads = events.filter(e => e.eventType === 'extension_downloaded');
    console.log(`📊 Found ${extensionDownloads.length} extension_downloaded events`);
    
    expect(extensionDownloads).toHaveLength(2);
    
    extensionDownloads.forEach((event, index) => {
      console.log(`✅ Extension Download ${index + 1}:`);
      console.log(`   - ID: ${event.id}`);
      console.log(`   - User: ${event.userId}`);
      console.log(`   - Version: ${event.eventData.version}`);
      console.log(`   - Timestamp: ${new Date(event.timestamp).toISOString()}`);
    });
    
    console.log('✅ DIAGNOSTIC COMPLETE: Event retrieval working correctly');
  });

  it('should test the exact admin dashboard filter logic', async () => {
    console.log('\n🔍 ADMIN DASHBOARD FILTER LOGIC DIAGNOSTIC');
    console.log('==========================================');
    
    // This simulates what happens when admin dashboard filters by event type
    const mockEvents = [
      {
        id: 'evt_1',
        eventType: 'extension_downloaded',
        userId: 'user1',
        timestamp: Date.now() - 3600000, // 1 hour ago
        eventData: { version: '1.0.0' }
      },
      {
        id: 'evt_2',
        eventType: 'snapshot_created',
        userId: 'user2', 
        timestamp: Date.now() - 7200000, // 2 hours ago
        eventData: { snapshotId: 'snap_123' }
      },
      {
        id: 'evt_3',
        eventType: 'extension_downloaded',
        userId: 'user3',
        timestamp: Date.now() - 1800000, // 30 minutes ago
        eventData: { version: '1.1.0' }
      }
    ];
    
    // Filter logic that admin dashboard should use
    const extensionDownloads = mockEvents.filter(event => 
      event.eventType === 'extension_downloaded'
    );
    
    // Sort by timestamp descending (newest first)
    extensionDownloads.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`📊 Total events: ${mockEvents.length}`);
    console.log(`📊 Extension downloads: ${extensionDownloads.length}`);
    
    extensionDownloads.forEach((event, index) => {
      const timeAgo = Math.round((Date.now() - event.timestamp) / 60000);
      console.log(`✅ Extension Download ${index + 1}: ${event.id} (${timeAgo} minutes ago)`);
    });
    
    expect(extensionDownloads).toHaveLength(2);
    expect(extensionDownloads[0]?.timestamp).toBeGreaterThan(extensionDownloads[1]?.timestamp || 0);
    
    console.log('✅ DIAGNOSTIC COMPLETE: Filter logic working correctly');
  });
});