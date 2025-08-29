import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsManager } from '../analytics';
/**
 * Production Analytics Debugging Test
 *
 * This test simulates the exact conditions that might be causing
 * analytics to fail in production.
 */
describe('Production Analytics Issues', () => {
    let mockEnv;
    let analytics;
    beforeEach(() => {
        // Create more realistic mock that might fail like production
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
    it('should handle KV put failures gracefully', async () => {
        console.log('\n🔍 Testing KV put failure scenarios...');
        // Simulate KV_ANALYTICS.put failing (network issue, quota exceeded, etc.)
        mockEnv.KV_ANALYTICS.put.mockRejectedValue(new Error('KV put failed: quota exceeded'));
        // Mock user exists
        mockEnv.KV_USERS.get.mockResolvedValue(JSON.stringify({
            uid: 'test_user_123',
            analytics: { totalDownloads: 1, lastActiveAt: Date.now() }
        }));
        // This should not throw an error, but should fail silently
        await expect(analytics.trackEvent('test_user_123', 'extension_downloaded', {
            version: '1.0.0'
        })).resolves.not.toThrow();
        console.log('✅ Analytics tracking handles KV failures gracefully');
    });
    it('should handle user update failures', async () => {
        console.log('\n🔍 Testing user update failure scenarios...');
        // KV_ANALYTICS.put succeeds but user update fails
        mockEnv.KV_ANALYTICS.put.mockResolvedValue(undefined);
        mockEnv.KV_USERS.get.mockResolvedValue(JSON.stringify({
            uid: 'test_user_123',
            analytics: { totalDownloads: 1, lastActiveAt: Date.now() }
        }));
        mockEnv.KV_USERS.put.mockRejectedValue(new Error('User update failed'));
        // This should not throw an error
        await expect(analytics.trackEvent('test_user_123', 'extension_downloaded', {
            version: '1.0.0'
        })).resolves.not.toThrow();
        console.log('✅ Analytics tracking handles user update failures gracefully');
    });
    it('should handle missing user scenarios', async () => {
        console.log('\n🔍 Testing missing user scenarios...');
        // User doesn't exist in KV
        mockEnv.KV_USERS.get.mockResolvedValue(null);
        mockEnv.KV_ANALYTICS.put.mockResolvedValue(undefined);
        // Should still track the event even if user doesn't exist
        await analytics.trackEvent('nonexistent_user', 'extension_downloaded', {
            version: '1.0.0'
        });
        // Event should still be stored
        expect(mockEnv.KV_ANALYTICS.put).toHaveBeenCalled();
        const putCalls = mockEnv.KV_ANALYTICS.put.mock.calls;
        const eventCall = putCalls.find((call) => call[0].startsWith('event:'));
        expect(eventCall).toBeDefined();
        console.log('✅ Analytics tracks events even for missing users');
    });
    it('should validate event data structure matches admin dashboard expectations', async () => {
        console.log('\n🔍 Testing event data structure for admin dashboard...');
        mockEnv.KV_ANALYTICS.put.mockResolvedValue(undefined);
        await analytics.trackEvent('test_user_123', 'extension_downloaded', {
            version: '1.0.0',
            filename: 'quickstage-1.0.0.vsix',
            timestamp: Date.now()
        });
        const putCalls = mockEnv.KV_ANALYTICS.put.mock.calls;
        const eventCall = putCalls.find((call) => call[0].startsWith('event:'));
        const storedEvent = JSON.parse(eventCall[1]);
        // Verify all required fields are present
        expect(storedEvent).toHaveProperty('id');
        expect(storedEvent).toHaveProperty('userId');
        expect(storedEvent).toHaveProperty('eventType');
        expect(storedEvent).toHaveProperty('eventData');
        expect(storedEvent).toHaveProperty('timestamp');
        expect(storedEvent).toHaveProperty('sessionId');
        // Verify the event type is exactly what the dashboard expects
        expect(storedEvent.eventType).toBe('extension_downloaded');
        // Verify event data structure
        expect(storedEvent.eventData.version).toBe('1.0.0');
        expect(storedEvent.eventData.filename).toBe('quickstage-1.0.0.vsix');
        console.log(`✅ Event structure valid:`, storedEvent);
        console.log(`✅ Event key format: ${eventCall[0]}`);
    });
    it('should test exact scenario from production extension download', async () => {
        console.log('\n🔍 Testing exact production scenario...');
        // Mock production-like environment
        mockEnv.KV_ANALYTICS.put.mockResolvedValue(undefined);
        mockEnv.KV_USERS.get.mockResolvedValue(JSON.stringify({
            uid: 'production_user',
            name: 'Production User',
            email: 'user@company.com',
            plan: 'pro',
            subscription: { status: 'active' },
            analytics: {
                totalDownloads: 3,
                totalSnapshotsCreated: 10,
                lastActiveAt: Date.now() - 86400000 // 1 day ago
            }
        }));
        mockEnv.KV_USERS.put.mockResolvedValue(undefined);
        // Simulate exact extension download tracking from routes
        const startTime = Date.now();
        await analytics.trackEvent('production_user', 'extension_downloaded', {
            version: '1.2.3',
            filename: 'quickstage-1.2.3.vsix'
        });
        const endTime = Date.now();
        // Verify event was stored
        expect(mockEnv.KV_ANALYTICS.put).toHaveBeenCalled();
        // Verify user was updated
        expect(mockEnv.KV_USERS.put).toHaveBeenCalled();
        const userUpdateCalls = mockEnv.KV_USERS.put.mock.calls;
        const userCall = userUpdateCalls.find((call) => call[0] === 'user:production_user');
        const updatedUser = JSON.parse(userCall[1]);
        expect(updatedUser.analytics.totalDownloads).toBe(4); // Should increment
        expect(updatedUser.analytics.lastActiveAt).toBeGreaterThanOrEqual(startTime);
        expect(updatedUser.analytics.lastActiveAt).toBeLessThanOrEqual(endTime);
        console.log(`✅ Production scenario completed successfully`);
        console.log(`✅ User downloads: 3 → ${updatedUser.analytics.totalDownloads}`);
        console.log(`✅ Last active updated to: ${new Date(updatedUser.analytics.lastActiveAt).toISOString()}`);
    });
});
