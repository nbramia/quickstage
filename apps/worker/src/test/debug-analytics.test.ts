import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsManager } from '../analytics';

/**
 * ANALYTICS DEBUGGING TESTS
 * 
 * These tests are specifically designed to debug the live analytics issues
 * you're experiencing with extension downloads and real-time updates.
 * 
 * Run with: npm run test src/test/debug-analytics.test.ts
 */

describe('Analytics Debugging - Extension Downloads', () => {
  let mockEnv: any;
  let analytics: AnalyticsManager;
  
  beforeEach(() => {
    // Create mock environment that simulates your real KV stores
    const mockKVStore = {
      get: async (key: string) => {
        // Mock some real user data
        if (key === 'user:test_user_123') {
          return JSON.stringify({
            uid: 'test_user_123',
            name: 'Test User',
            email: 'test@example.com',
            plan: 'pro',
            analytics: {
              totalSnapshotsCreated: 5,
              totalDownloads: 2,
              lastActiveAt: Date.now()
            }
          });
        }
        return null;
      },
      put: async (key: string, value: string) => {
        console.log(`KV PUT: ${key}`);
        console.log(`VALUE: ${value.substring(0, 200)}...`);
        return;
      },
      list: async () => ({ keys: [], cursor: null })
    };

    mockEnv = {
      KV_USERS: mockKVStore,
      KV_ANALYTICS: mockKVStore,
      KV_SNAPS: mockKVStore
    };
    
    analytics = new AnalyticsManager(mockEnv);
  });

  it('should track extension_downloaded events correctly', async () => {
    console.log('\n🧪 Testing extension_downloaded event tracking...');
    
    await analytics.trackEvent(
      'test_user_123',
      'extension_downloaded',
      {
        version: '1.0.0',
        filename: 'quickstage-1.0.0.vsix',
        userAgent: 'Chrome/91.0',
        downloadMethod: 'dashboard'
      }
    );

    // This test will show us if the event gets stored correctly
    // and if the updateRealTimeAnalytics method handles extension_downloaded
  });

  it('should handle multiple extension downloads from same user', async () => {
    console.log('\n🧪 Testing multiple extension downloads...');
    
    // Simulate multiple downloads
    for (let i = 0; i < 3; i++) {
      await analytics.trackEvent(
        'test_user_123',
        'extension_downloaded',
        {
          version: '1.0.0',
          filename: 'quickstage-1.0.0.vsix',
          downloadNumber: i + 1
        }
      );
    }
  });

  it('should track events with proper timestamps for real-time feeds', async () => {
    console.log('\n🧪 Testing timestamp accuracy for real-time feeds...');
    
    const beforeTime = Date.now();
    
    await analytics.trackEvent(
      'test_user_123',
      'extension_downloaded',
      {
        version: '1.0.0',
        testType: 'timestamp_test'
      }
    );
    
    const afterTime = Date.now();
    
    console.log(`Event should have timestamp between ${beforeTime} and ${afterTime}`);
    console.log(`Current time: ${Date.now()}`);
    console.log(`Time difference: ${afterTime - beforeTime}ms`);
  });

  it('should identify why events are not showing in admin dashboard', async () => {
    console.log('\n🔍 Debugging admin dashboard event visibility...');
    
    // Track multiple event types to see which ones work
    const eventTypes = [
      'user_login',
      'page_view', 
      'extension_downloaded',
      'snapshot_created',
      'snapshot_viewed'
    ];
    
    for (const eventType of eventTypes) {
      await analytics.trackEvent(
        'test_user_123',
        eventType as any,
        {
          testEvent: true,
          eventType: eventType,
          timestamp: Date.now()
        }
      );
      console.log(`✅ Tracked ${eventType} event`);
    }
  });
});

describe('Analytics Real-Time Updates', () => {
  let mockEnv: any;
  let analytics: AnalyticsManager;
  
  beforeEach(() => {
    const mockKVStore = {
      get: async (key: string) => {
        console.log(`KV GET: ${key}`);
        if (key.startsWith('user:')) {
          return JSON.stringify({
            uid: 'test_user',
            analytics: { totalDownloads: 0, lastActiveAt: Date.now() }
          });
        }
        return null;
      },
      put: async (key: string, value: string) => {
        console.log(`KV PUT: ${key} = ${JSON.parse(value).eventType || 'user_data'}`);
        return;
      },
      list: async (options: any) => {
        console.log(`KV LIST: prefix=${options?.prefix}, cursor=${options?.cursor}`);
        return { 
          keys: [
            { name: 'event:evt_123_abc' },
            { name: 'event:evt_456_def' }
          ], 
          cursor: null 
        };
      }
    };

    mockEnv = {
      KV_USERS: mockKVStore,
      KV_ANALYTICS: mockKVStore,
      KV_SNAPS: mockKVStore
    };
    
    analytics = new AnalyticsManager(mockEnv);
  });

  it('should reveal why real-time analytics are not updating', async () => {
    console.log('\n🕐 Testing real-time analytics updates...');
    
    // Track an event that should update user metrics
    await analytics.trackEvent(
      'test_user',
      'extension_downloaded',
      { version: '1.0.0' }
    );
    
    // This should show us if the updateRealTimeAnalytics method
    // is being called and if it's updating user metrics correctly
  });
});

/**
 * HOW TO USE THESE TESTS FOR DEBUGGING:
 * 
 * 1. Run: npm run test src/test/debug-analytics.test.ts
 * 2. Look at the console output to see:
 *    - Which KV operations are happening
 *    - If events are being stored correctly
 *    - If real-time updates are working
 * 
 * 3. Based on the output, you'll know:
 *    - Are events being tracked at all?
 *    - Are they being stored in the right KV keys?
 *    - Are real-time metrics being updated?
 *    - What's the exact timestamp format?
 * 
 * 4. You can then ask me to fix the specific issues found.
 */