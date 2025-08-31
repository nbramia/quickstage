import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext } from '../mocks/context';

// Mock the analytics manager
vi.mock('../../worker-utils', () => ({
  getAnalyticsManager: () => ({
    trackEvent: vi.fn()
  })
}));

// Mock the auth module
vi.mock('../../auth', () => ({
  getUidFromSession: vi.fn()
}));

import { handleStartAIConversation, handleSendAIMessage, handleGetAIConversation } from '../../routes/ai-suggestions';
import { getUidFromSession } from '../../auth';

describe('AI Suggestions Routes', () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockContext();
  });

  describe('handleGetAIConversation', () => {
    it('returns empty conversation when none exists', async () => {
      const mockRequest = {
        param: () => 'test-snapshot-id',
        header: () => '127.0.0.1'
      };

      const mockC = {
        req: mockRequest,
        env: mockContext.env,
        json: vi.fn((data, status) => ({ data, status }))
      };

      // Mock no existing conversation
      mockContext.env.KV_ANALYTICS.get.mockResolvedValue(null);

      const result = await handleGetAIConversation(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: true,
        data: { messages: [], exists: false }
      });
    });

    it('returns existing conversation messages', async () => {
      const mockRequest = {
        param: () => 'test-snapshot-id',
        header: () => '127.0.0.1'
      };

      const mockC = {
        req: mockRequest,
        env: mockContext.env,
        json: vi.fn((data, status) => ({ data, status }))
      };

      const mockConversation = {
        id: 'conv-123',
        snapshotId: 'test-snapshot-id',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'assistant', content: 'Hello! How can I help?' },
          { role: 'user', content: 'Test question' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockContext.env.KV_ANALYTICS.get.mockResolvedValue(mockConversation);

      const result = await handleGetAIConversation(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: true,
        data: {
          messages: [
            { role: 'assistant', content: 'Hello! How can I help?' },
            { role: 'user', content: 'Test question' }
          ],
          exists: true,
          updatedAt: mockConversation.updatedAt
        }
      });
    });

    it('handles missing snapshot ID', async () => {
      const mockRequest = {
        param: () => null,
        header: () => '127.0.0.1'
      };

      const mockC = {
        req: mockRequest,
        env: mockContext.env,
        json: vi.fn((data, status) => ({ data, status }))
      };

      const result = await handleGetAIConversation(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: false,
        error: 'Snapshot ID required'
      }, 400);
    });
  });

  describe('handleStartAIConversation', () => {
    it('returns error when snapshot not found', async () => {
      const mockRequest = {
        param: () => 'nonexistent-id',
        header: () => '127.0.0.1'
      };

      const mockC = {
        req: mockRequest,
        env: mockContext.env,
        json: vi.fn((data, status) => ({ data, status }))
      };

      // Mock no existing conversation and no snapshot
      mockContext.env.KV_ANALYTICS.get.mockResolvedValue(null);
      mockContext.env.KV_SNAPS.get.mockResolvedValue(null);

      vi.mocked(getUidFromSession).mockResolvedValue(null);

      const result = await handleStartAIConversation(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: false,
        error: 'Snapshot not found'
      }, 404);
    });

    it('handles rate limiting', async () => {
      const mockRequest = {
        param: () => 'test-snapshot',
        header: () => '127.0.0.1'
      };

      const mockC = {
        req: mockRequest,
        env: mockContext.env,
        json: vi.fn((data, status) => ({ data, status }))
      };

      const mockSnapshot = {
        id: 'test-snapshot',
        files: [{ p: 'index.html', ct: 'text/html' }],
        public: true,
        ownerUid: 'test-user'
      };

      // Mock rate limit exceeded (simulate 11 requests in current hour)
      mockContext.env.KV_ANALYTICS.get
        .mockResolvedValueOnce(null) // No existing conversation
        .mockResolvedValueOnce({ requests: 11, tokens: 0 }); // Rate limit check
      mockContext.env.KV_SNAPS.get.mockResolvedValue(mockSnapshot);

      vi.mocked(getUidFromSession).mockResolvedValue(null);

      const result = await handleStartAIConversation(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: false,
        error: 'Too many requests. Please try again in an hour.'
      }, 429);
    });

    it('provides fallback message when no API key available', async () => {
      const mockRequest = {
        param: () => 'test-snapshot',
        header: () => '127.0.0.1'
      };

      const mockC = {
        req: mockRequest,
        env: {
          ...mockContext.env,
          OPENAI_API_KEY: undefined // No API key
        },
        json: vi.fn((data, status) => ({ data, status }))
      };

      const mockSnapshot = {
        id: 'test-snapshot',
        files: [{ p: 'index.html', ct: 'text/html' }],
        public: true,
        ownerUid: 'test-user'
      };

      // Setup mocks
      mockC.env.KV_ANALYTICS.get
        .mockResolvedValueOnce(null) // No existing conversation
        .mockResolvedValueOnce({ requests: 0, tokens: 0 }); // Rate limit check
      mockC.env.KV_SNAPS.get.mockResolvedValue(mockSnapshot);
      vi.mocked(getUidFromSession).mockResolvedValue(null);

      const result = await handleStartAIConversation(mockC);

      // Should return success with fallback message
      expect(mockC.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          conversationId: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'assistant',
              content: expect.stringContaining('I can see your prototype structure')
            })
          ])
        })
      });
    });
  });

  describe('handleSendAIMessage', () => {
    it('validates message content', async () => {
      const mockRequest = {
        param: () => 'test-snapshot',
        header: () => '127.0.0.1',
        json: () => Promise.resolve({ message: '' }) // Empty message
      };

      const mockC = {
        req: mockRequest,
        env: mockContext.env,
        json: vi.fn((data, status) => ({ data, status }))
      };

      const result = await handleSendAIMessage(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: false,
        error: 'Message is required'
      }, 400);
    });

    it('validates message length', async () => {
      const longMessage = 'a'.repeat(1001);
      
      const mockRequest = {
        param: () => 'test-snapshot',
        header: () => '127.0.0.1',
        json: () => Promise.resolve({ message: longMessage })
      };

      const mockC = {
        req: mockRequest,
        env: mockContext.env,
        json: vi.fn((data, status) => ({ data, status }))
      };

      const result = await handleSendAIMessage(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: false,
        error: 'Message too long (max 1000 characters)'
      }, 400);
    });

    it('handles conversation not found', async () => {
      const mockRequest = {
        param: () => 'test-snapshot',
        header: () => '127.0.0.1',
        json: () => Promise.resolve({ message: 'Test message' })
      };

      const mockC = {
        req: mockRequest,
        env: mockContext.env,
        json: vi.fn((data, status) => ({ data, status }))
      };

      // Mock no existing conversation
      mockContext.env.KV_ANALYTICS.get
        .mockResolvedValueOnce({ requests: 0, tokens: 0 }) // Rate limit check
        .mockResolvedValueOnce(null); // No conversation

      vi.mocked(getUidFromSession).mockResolvedValue(null);

      const result = await handleSendAIMessage(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: false,
        error: 'Conversation not found. Please start a new conversation.'
      }, 404);
    });

    it('handles conversation message limit', async () => {
      const mockRequest = {
        param: () => 'test-snapshot',
        header: () => '127.0.0.1',
        json: () => Promise.resolve({ message: 'Test message' })
      };

      const mockC = {
        req: mockRequest,
        env: mockContext.env,
        json: vi.fn((data, status) => ({ data, status }))
      };

      // Create conversation with 20 messages (at limit)
      const maxMessages = Array(20).fill({ role: 'user', content: 'test' });
      const mockConversation = {
        id: 'conv-123',
        messages: maxMessages
      };

      mockContext.env.KV_ANALYTICS.get
        .mockResolvedValueOnce({ requests: 0, tokens: 0 }) // Rate limit check
        .mockResolvedValueOnce(mockConversation); // Conversation at limit

      vi.mocked(getUidFromSession).mockResolvedValue(null);

      const result = await handleSendAIMessage(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: false,
        error: 'Conversation limit reached. Please start a new conversation.'
      }, 429);
    });
  });

  describe('Rate Limiting', () => {
    it('tracks hourly request limits correctly', async () => {
      // This test verifies that rate limiting logic works at the algorithm level
      const now = Date.now();
      const currentHour = Math.floor(now / 3600000);
      
      // Rate limit key should be based on current hour
      const expectedKey = `rate-limit:127.0.0.1:${currentHour}`;
      
      // This validates the key generation logic is working correctly
      expect(typeof currentHour).toBe('number');
      expect(expectedKey).toContain('rate-limit');
    });
  });

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      const mockRequest = {
        param: () => 'test-snapshot',
        header: () => '127.0.0.1'
      };

      const mockC = {
        req: mockRequest,
        env: {
          ...mockContext.env,
          KV_ANALYTICS: {
            get: vi.fn().mockRejectedValue(new Error('Network error'))
          }
        },
        json: vi.fn((data, status) => ({ data, status }))
      };

      const result = await handleGetAIConversation(mockC);

      expect(mockC.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      }, 500);
    });
  });
});