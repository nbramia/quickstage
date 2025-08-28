import { vi } from 'vitest';

// Mock Cloudflare Worker context
export const createMockContext = (overrides: any = {}) => {
  const mockEnv = {
    KV_USERS: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    },
    KV_SNAPS: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    },
    KV_ANALYTICS: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    },
    R2_BUCKET: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    },
    SESSION_HMAC_SECRET: 'test-secret',
    ARGON2_SALT: 'test-salt',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    ...overrides.env
  };

  return {
    env: mockEnv,
    req: {
      json: vi.fn(),
      text: vi.fn(),
      param: vi.fn(),
      query: vi.fn(),
      header: vi.fn(),
      ...overrides.req
    },
    json: vi.fn((data, status = 200) => ({ data, status })),
    text: vi.fn((text, status = 200) => ({ text, status })),
    redirect: vi.fn(),
    ...overrides
  };
};

// Mock analytics manager
export const createMockAnalytics = () => ({
  trackEvent: vi.fn(),
  getEvents: vi.fn(),
  getStats: vi.fn()
});

// Mock user data
export const mockUsers = {
  freeUser: {
    uid: 'user_123',
    name: 'Test User',
    email: 'test@example.com',
    plan: 'free',
    role: 'user',
    passwordHash: 'mock_password_hash',
    subscription: { status: 'none' },
    analytics: {
      totalSnapshotsCreated: 0,
      totalSnapshotsViewed: 0,
      totalDownloads: 0,
      totalPageVisits: 0,
      lastActiveAt: Date.now(),
      sessionCount: 0,
      averageSessionDuration: 0,
      totalCommentsPosted: 0,
      totalCommentsReceived: 0
    }
  },
  proUser: {
    uid: 'user_456',
    name: 'Pro User',
    email: 'pro@example.com',
    plan: 'pro',
    role: 'user',
    subscription: { 
      status: 'active',
      stripeCustomerId: 'cus_test_123',
      stripeSubscriptionId: 'sub_test_123'
    },
    analytics: {
      totalSnapshotsCreated: 5,
      totalSnapshotsViewed: 20,
      totalDownloads: 3,
      totalPageVisits: 15,
      lastActiveAt: Date.now(),
      sessionCount: 10,
      averageSessionDuration: 300,
      totalCommentsPosted: 2,
      totalCommentsReceived: 1
    }
  },
  adminUser: {
    uid: 'user_789',
    name: 'Admin User',
    email: 'admin@example.com',
    plan: 'pro',
    role: 'superadmin',
    subscription: { status: 'active' },
    analytics: {
      totalSnapshotsCreated: 10,
      totalSnapshotsViewed: 50,
      totalDownloads: 8,
      totalPageVisits: 100,
      lastActiveAt: Date.now(),
      sessionCount: 25,
      averageSessionDuration: 450,
      totalCommentsPosted: 5,
      totalCommentsReceived: 3
    }
  }
};

// Mock snapshot data
export const mockSnapshots = {
  activeSnapshot: {
    id: 'snap_123',
    ownerUid: 'user_123',
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    status: 'active',
    public: false,
    totalBytes: 1024,
    files: ['index.html', 'style.css'],
    views: { m: '2024-01', n: 5 },
    commentsCount: 2,
    caps: { maxBytes: 10485760, maxFiles: 100, maxDays: 365 }
  },
  expiredSnapshot: {
    id: 'snap_456',
    ownerUid: 'user_456',
    createdAt: Date.now() - 48 * 60 * 60 * 1000,
    expiresAt: Date.now() - 24 * 60 * 60 * 1000,
    status: 'expired',
    public: true,
    totalBytes: 2048,
    files: ['index.html'],
    views: { m: '2024-12', n: 12 },
    commentsCount: 0,
    caps: { maxBytes: 10485760, maxFiles: 100, maxDays: 365 }
  }
};