import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsManager } from '../analytics';
import { handleApiExtensionDownload } from '../routes/extensions';
import { createMockContext } from './mocks/context';

describe('Extension Analytics Integration', () => {
  let mockEnv: any;
  let analytics: AnalyticsManager;
  let mockContext: any;
  
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
    mockContext = createMockContext();
  });

  it('should store extension_downloaded event in KV_ANALYTICS', async () => {
    console.log('\n🔍 Testing extension_downloaded event storage...');
    
    // Mock user data
    mockEnv.KV_USERS.get.mockResolvedValue(JSON.stringify({
      uid: 'test_user_123',
      name: 'Test User',
      email: 'test@example.com',
      plan: 'pro',
      subscription: { status: 'active' },
      analytics: {
        totalDownloads: 5,
        lastActiveAt: Date.now()
      }
    }));
    
    await analytics.trackEvent('test_user_123', 'extension_downloaded', {
      version: '1.0.0',
      filename: 'quickstage-1.0.0.vsix'
    });
    
    // Check if event was stored in KV_ANALYTICS
    expect(mockEnv.KV_ANALYTICS.put).toHaveBeenCalled();
    
    const putCalls = mockEnv.KV_ANALYTICS.put.mock.calls;
    const eventCall = putCalls.find((call: any) => call[0].startsWith('event:'));
    
    expect(eventCall).toBeDefined();
    expect(eventCall[0]).toMatch(/^event:evt_\d+_[a-z0-9]+$/);
    
    const storedEvent = JSON.parse(eventCall[1]);
    expect(storedEvent).toMatchObject({
      userId: 'test_user_123',
      eventType: 'extension_downloaded',
      eventData: {
        version: '1.0.0',
        filename: 'quickstage-1.0.0.vsix'
      }
    });
    
    console.log(`✅ Event stored with key: ${eventCall[0]}`);
    console.log(`✅ Event data:`, JSON.stringify(storedEvent, null, 2));
  });

  it('should update user totalDownloads metric', async () => {
    console.log('\n🔍 Testing user metrics update...');
    
    const mockUser = {
      uid: 'test_user_123',
      name: 'Test User',
      analytics: {
        totalDownloads: 2,
        lastActiveAt: Date.now() - 10000
      }
    };
    
    mockEnv.KV_USERS.get.mockResolvedValue(JSON.stringify(mockUser));
    
    await analytics.trackEvent('test_user_123', 'extension_downloaded', {
      version: '1.0.0'
    });
    
    // Check if user was updated
    expect(mockEnv.KV_USERS.put).toHaveBeenCalled();
    
    const userUpdateCalls = mockEnv.KV_USERS.put.mock.calls;
    const userCall = userUpdateCalls.find((call: any) => call[0] === 'user:test_user_123');
    
    expect(userCall).toBeDefined();
    
    const updatedUser = JSON.parse(userCall[1]);
    expect(updatedUser.analytics.totalDownloads).toBe(3); // Should increment
    expect(updatedUser.analytics.lastActiveAt).toBeGreaterThan(mockUser.analytics.lastActiveAt);
    
    console.log(`✅ User totalDownloads updated: ${mockUser.analytics.totalDownloads} → ${updatedUser.analytics.totalDownloads}`);
    console.log(`✅ User lastActiveAt updated: ${mockUser.analytics.lastActiveAt} → ${updatedUser.analytics.lastActiveAt}`);
  });

  it('should track extension downloads with proper session and user agent', async () => {
    console.log('\n🔍 Testing extension download with session tracking...');
    
    await analytics.trackEvent(
      'test_user_123', 
      'extension_downloaded', 
      { version: '1.0.0' },
      'sess_123456789',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
    
    expect(mockEnv.KV_ANALYTICS.put).toHaveBeenCalled();
    
    const putCalls = mockEnv.KV_ANALYTICS.put.mock.calls;
    const eventCall = putCalls.find((call: any) => call[0].startsWith('event:'));
    const storedEvent = JSON.parse(eventCall[1]);
    
    expect(storedEvent.sessionId).toBe('sess_123456789');
    expect(storedEvent.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    expect(storedEvent.userAgentParsed).toEqual({
      browser: 'chrome',
      os: 'windows', 
      device: 'desktop'
    });
    
    console.log(`✅ Session ID tracked: ${storedEvent.sessionId}`);
    console.log(`✅ User agent parsed:`, storedEvent.userAgentParsed);
  });

  it('should verify events can be retrieved via debug endpoint format', async () => {
    console.log('\n🔍 Testing event retrieval format...');
    
    // Store an event
    await analytics.trackEvent('test_user_123', 'extension_downloaded', {
      version: '1.0.0',
      filename: 'quickstage-1.0.0.vsix'
    });
    
    // Verify the event would be retrievable by the debug endpoint
    const putCalls = mockEnv.KV_ANALYTICS.put.mock.calls;
    const eventCall = putCalls.find((call: any) => call[0].startsWith('event:'));
    const storedEvent = JSON.parse(eventCall[1]);
    
    // Simulate what the debug endpoint does
    const normalizedEvent = {
      ...storedEvent,
      type: storedEvent.eventType || 'unknown',
      page: storedEvent.eventData?.page || undefined,
      metadata: storedEvent.eventData || {}
    };
    
    expect(normalizedEvent.type).toBe('extension_downloaded');
    expect(normalizedEvent.metadata.version).toBe('1.0.0');
    expect(normalizedEvent.metadata.filename).toBe('quickstage-1.0.0.vsix');
    expect(normalizedEvent.timestamp).toBeTypeOf('number');
    
    console.log(`✅ Event normalized for debug endpoint:`, normalizedEvent);
  });
});