import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreateToken, handleListTokens, handleDeleteToken } from '../../routes/tokens';
import { createMockContext } from '../mocks/context';
// Mock dependencies
vi.mock('../../auth', () => ({
    getUidFromSession: vi.fn()
}));
vi.mock('../../utils', () => ({
    generateIdBase62: vi.fn(() => 'mock_token_id')
}));
vi.mock('../../worker-utils', () => ({
    getAnalyticsManager: vi.fn(() => ({
        trackEvent: vi.fn()
    }))
}));
import { getUidFromSession } from '../../auth';
import { getAnalyticsManager } from '../../worker-utils';
describe('Token Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock Date.now to return consistent timestamp
        vi.spyOn(Date, 'now').mockReturnValue(1640995200000); // Jan 1, 2022
    });
    describe('handleCreateToken', () => {
        it('should create a new PAT successfully', async () => {
            const mockContext = createMockContext();
            getUidFromSession.mockResolvedValue('user_123');
            mockContext.env.KV_USERS.get.mockResolvedValue('[]'); // Empty PAT list
            await handleCreateToken(mockContext);
            expect(mockContext.env.KV_USERS.put).toHaveBeenCalledWith('pat:qs_pat_mock_token_id', expect.stringContaining('"token":"qs_pat_mock_token_id"'));
            expect(mockContext.env.KV_USERS.put).toHaveBeenCalledWith('user:user_123:pats', '["qs_pat_mock_token_id"]');
            expect(mockContext.json).toHaveBeenCalledWith({
                token: 'qs_pat_mock_token_id',
                expiresAt: 1640995200000 + (90 * 24 * 60 * 60 * 1000), // 90 days later
                message: 'Store this token securely. It will not be shown again.'
            });
        });
        it('should return unauthorized for unauthenticated user', async () => {
            const mockContext = createMockContext();
            getUidFromSession.mockResolvedValue(null);
            await handleCreateToken(mockContext);
            expect(mockContext.json).toHaveBeenCalledWith({ error: 'unauthorized' }, 401);
        });
        it('should add token to existing PAT list', async () => {
            const mockContext = createMockContext();
            getUidFromSession.mockResolvedValue('user_123');
            mockContext.env.KV_USERS.get.mockResolvedValue('["existing_token"]');
            await handleCreateToken(mockContext);
            expect(mockContext.env.KV_USERS.put).toHaveBeenCalledWith('user:user_123:pats', '["existing_token","qs_pat_mock_token_id"]');
        });
        it('should track analytics event for token creation', async () => {
            const mockContext = createMockContext();
            const mockAnalytics = { trackEvent: vi.fn() };
            getUidFromSession.mockResolvedValue('user_123');
            getAnalyticsManager.mockReturnValue(mockAnalytics);
            mockContext.env.KV_USERS.get.mockResolvedValue('[]');
            await handleCreateToken(mockContext);
            expect(mockAnalytics.trackEvent).toHaveBeenCalledWith('user_123', 'api_call', {
                action: 'token_created',
                tokenType: 'PAT',
                expiresIn: 90
            });
        });
    });
    describe('handleListTokens', () => {
        it('should list user PATs successfully', async () => {
            const mockContext = createMockContext();
            const mockPATData = {
                id: 'token_123',
                createdAt: 1640995200000,
                expiresAt: 1640995200000 + (90 * 24 * 60 * 60 * 1000),
                lastUsed: null,
                description: 'VS Code/Cursor Extension'
            };
            getUidFromSession.mockResolvedValue('user_123');
            mockContext.env.KV_USERS.get
                .mockResolvedValueOnce('["qs_pat_token_123"]') // PAT list
                .mockResolvedValueOnce(JSON.stringify(mockPATData)); // PAT data
            await handleListTokens(mockContext);
            expect(mockContext.json).toHaveBeenCalledWith({
                pats: [mockPATData]
            });
        });
        it('should return empty list for user with no PATs', async () => {
            const mockContext = createMockContext();
            getUidFromSession.mockResolvedValue('user_123');
            mockContext.env.KV_USERS.get.mockResolvedValue('[]');
            await handleListTokens(mockContext);
            expect(mockContext.json).toHaveBeenCalledWith({
                pats: []
            });
        });
        it('should handle missing PAT list gracefully', async () => {
            const mockContext = createMockContext();
            getUidFromSession.mockResolvedValue('user_123');
            mockContext.env.KV_USERS.get.mockResolvedValue(null);
            await handleListTokens(mockContext);
            expect(mockContext.json).toHaveBeenCalledWith({
                pats: []
            });
        });
        it('should return unauthorized for unauthenticated user', async () => {
            const mockContext = createMockContext();
            getUidFromSession.mockResolvedValue(null);
            await handleListTokens(mockContext);
            expect(mockContext.json).toHaveBeenCalledWith({ error: 'unauthorized' }, 401);
        });
        it('should skip invalid PAT entries', async () => {
            const mockContext = createMockContext();
            getUidFromSession.mockResolvedValue('user_123');
            mockContext.env.KV_USERS.get
                .mockResolvedValueOnce('["valid_token", "invalid_token"]')
                .mockResolvedValueOnce(JSON.stringify({ id: 'valid', description: 'Valid' })) // valid token
                .mockResolvedValueOnce(null); // invalid token
            await handleListTokens(mockContext);
            expect(mockContext.json).toHaveBeenCalledWith({
                pats: [{ id: 'valid', description: 'Valid' }]
            });
        });
    });
    describe('handleDeleteToken', () => {
        it('should delete PAT successfully', async () => {
            const mockContext = createMockContext();
            const mockPATData = {
                id: 'token_123',
                userId: 'user_123',
                token: 'qs_pat_token_123'
            };
            mockContext.req.param.mockReturnValue('token_123');
            getUidFromSession.mockResolvedValue('user_123');
            mockContext.env.KV_USERS.get
                .mockResolvedValueOnce(JSON.stringify(mockPATData)) // PAT data
                .mockResolvedValueOnce('["qs_pat_token_123", "other_token"]'); // PAT list
            await handleDeleteToken(mockContext);
            expect(mockContext.env.KV_USERS.delete).toHaveBeenCalledWith('pat:qs_pat_token_123');
            expect(mockContext.env.KV_USERS.put).toHaveBeenCalledWith('user:user_123:pats', '["other_token"]');
            expect(mockContext.json).toHaveBeenCalledWith({
                message: 'PAT revoked successfully'
            });
        });
        it('should return unauthorized for unauthenticated user', async () => {
            const mockContext = createMockContext();
            const mockAnalytics = { trackEvent: vi.fn() };
            mockContext.req.param.mockReturnValue('token_123');
            getUidFromSession.mockResolvedValue(null);
            getAnalyticsManager.mockReturnValue(mockAnalytics);
            await handleDeleteToken(mockContext);
            expect(mockContext.json).toHaveBeenCalledWith({ error: 'unauthorized' }, 401);
            expect(mockAnalytics.trackEvent).toHaveBeenCalledWith('anonymous', 'unauthorized_access', {
                endpoint: '/tokens/:tokenId',
                method: 'DELETE'
            });
        });
        it('should return not found for non-existent token', async () => {
            const mockContext = createMockContext();
            mockContext.req.param.mockReturnValue('nonexistent_token');
            getUidFromSession.mockResolvedValue('user_123');
            mockContext.env.KV_USERS.get.mockResolvedValue(null);
            await handleDeleteToken(mockContext);
            expect(mockContext.json).toHaveBeenCalledWith({ error: 'not_found' }, 404);
        });
        it('should return forbidden for token owned by different user', async () => {
            const mockContext = createMockContext();
            const mockPATData = {
                id: 'token_123',
                userId: 'other_user',
                token: 'qs_pat_token_123'
            };
            mockContext.req.param.mockReturnValue('token_123');
            getUidFromSession.mockResolvedValue('user_123');
            mockContext.env.KV_USERS.get.mockResolvedValue(JSON.stringify(mockPATData));
            await handleDeleteToken(mockContext);
            expect(mockContext.json).toHaveBeenCalledWith({ error: 'forbidden' }, 403);
        });
        it('should track analytics event for token deletion', async () => {
            const mockContext = createMockContext();
            const mockAnalytics = { trackEvent: vi.fn() };
            const mockPATData = {
                id: 'token_123',
                userId: 'user_123',
                token: 'qs_pat_token_123'
            };
            mockContext.req.param.mockReturnValue('token_123');
            getUidFromSession.mockResolvedValue('user_123');
            getAnalyticsManager.mockReturnValue(mockAnalytics);
            mockContext.env.KV_USERS.get
                .mockResolvedValueOnce(JSON.stringify(mockPATData))
                .mockResolvedValueOnce('["qs_pat_token_123"]');
            await handleDeleteToken(mockContext);
            expect(mockAnalytics.trackEvent).toHaveBeenCalledWith('user_123', 'api_call', {
                action: 'token_deleted',
                tokenType: 'PAT'
            });
        });
    });
});
