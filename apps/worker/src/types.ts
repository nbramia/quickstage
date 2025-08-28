export type Bindings = {
  KV_USERS: KVNamespace;
  KV_SNAPS: KVNamespace;
  KV_ANALYTICS: KVNamespace; // New analytics namespace
  R2_SNAPSHOTS: R2Bucket;
  COMMENTS_DO: DurableObjectNamespace;
  SESSION_HMAC_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  PUBLIC_BASE_URL: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  RP_ID: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ID: string;
  STRIPE_WEBHOOK_SECRET: string;
};

// Enhanced User Schema with Analytics
export interface UserRecord {
  uid: string;
  name?: string;
  email?: string;
  passwordHash?: string;
  googleId?: string;
  
  // Core fields
  plan: 'free' | 'pro';
  role: 'user' | 'admin' | 'superadmin';
  status: 'active' | 'deactivated';
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  lastActivityAt?: number;
  
  // Enhanced Subscription fields
  subscription: {
    status: 'none' | 'trial' | 'active' | 'cancelled' | 'past_due';
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodStart?: number;
    currentPeriodEnd?: number;
    trialStart?: number;
    trialEnd?: number;
    cancelAtPeriodEnd?: boolean;
    lastPaymentAt?: number;
  };
  
  // Analytics & Usage Tracking
  analytics: {
    totalSnapshotsCreated: number;
    totalSnapshotsViewed: number;
    totalDownloads: number;
    totalPageVisits: number;
    lastActiveAt: number;
    sessionCount: number;
    averageSessionDuration: number;
    totalCommentsPosted: number;
    totalCommentsReceived: number;
  };
  
  // Legacy fields for backward compatibility
  subscriptionStatus?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialStartedAt?: number;
  trialEndsAt?: number;
  subscriptionStartedAt?: number;
  subscriptionEndsAt?: number;
  lastPaymentAt?: number;
  licenseKey?: string;
}

// Enhanced Snapshot Schema with Analytics
export interface SnapshotRecord {
  id: string;
  name?: string;
  ownerUid: string;
  passwordHash: string;
  password?: string; // Plain text for display
  
  // Core metadata
  totalBytes: number;
  files: SnapshotFile[];
  public: boolean;
  status: 'creating' | 'active' | 'expired';
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  lastAccessedAt?: number;
  
  // Enhanced analytics
  analytics: {
    viewCount: number;
    uniqueViewers: number;
    downloadCount: number;
    commentCount: number;
    averageTimeOnPage: number;
    lastViewedAt: number;
    viewerCountries: string[];
    viewerIPs: string[]; // For unique viewer tracking
    viewSessions: ViewSession[];
  };
  
  // Enhanced metadata
  metadata: {
    fileCount: number;
    framework?: string; // Auto-detected from files
    hasComments: boolean;
    tags?: string[];
    description?: string;
    thumbnail?: string;
  };
  
  // Legacy fields for backward compatibility
  views?: { m: string; n: number };
  commentsCount?: number;
  caps?: SnapshotCaps;
  gateVersion?: number;
}

// Snapshot file structure
export interface SnapshotFile {
  p: string; // path
  ct: string; // content-type
  sz: number; // size bytes
  h: string; // sha256 hex
  name?: string; // normalized name
  type?: string; // normalized type
  size?: number; // normalized size
  hash?: string; // normalized hash
}

// Snapshot capabilities
export interface SnapshotCaps {
  maxBytes: number;
  maxFile: number;
  maxDays: number;
}

// View session tracking
export interface ViewSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  userAgent: string;
  ipAddress?: string;
  country?: string;
  referrer?: string;
}

// Analytics Event Schema
export interface AnalyticsEvent {
  id: string;
  userId: string;
  eventType: AnalyticsEventType;
  eventData: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userAgent: string;
  ipAddress?: string;
  referrer?: string;
  country?: string;
  userAgentParsed?: {
    browser: string;
    os: string;
    device: string;
  };
}

// Analytics Event Types
export type AnalyticsEventType = 
  | 'page_view'
  | 'snapshot_created'
  | 'snapshot_viewed'
  | 'snapshot_downloaded'
  | 'snapshot_expired'
  | 'snapshot_extended'
  | 'comment_posted'
  | 'comment_viewed'
  | 'comment_deleted'
  | 'user_login'
  | 'user_logout'
  | 'user_registered'
  | 'user_deleted'
  | 'profile_updated'
  | 'password_changed'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'subscription_renewed'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'customer_created'
  | 'customer_deleted'
  | 'unauthorized_access'
  | 'cleanup_completed'
  | 'user_activated'
  | 'user_deactivated'
  | 'extension_downloaded'
  | 'extension_upgraded'
  | 'api_call'
  | 'error_occurred'
  | 'migration_completed'
  | 'user_migration_completed'
  | 'snapshot_migration_completed'
  | 'system_backup'
  | 'system_maintenance'
  | 'rate_limit_exceeded';

// Analytics Aggregation Types
export interface UserAnalytics {
  userId: string;
  period: 'day' | 'week' | 'month' | 'year';
  startDate: number;
  endDate: number;
  metrics: {
    pageViews: number;
    snapshotsCreated: number;
    snapshotsViewed: number;
    downloads: number;
    commentsPosted: number;
    sessionCount: number;
    totalSessionTime: number;
    averageSessionTime: number;
  };
  lastUpdated: number;
}

export interface SnapshotAnalytics {
  snapshotId: string;
  period: 'day' | 'week' | 'month' | 'year';
  startDate: number;
  endDate: number;
  metrics: {
    views: number;
    uniqueViewers: number;
    downloads: number;
    comments: number;
    averageTimeOnPage: number;
    bounceRate: number;
  };
  lastUpdated: number;
}

// System Analytics
export interface SystemAnalytics {
  period: 'day' | 'week' | 'month' | 'year';
  startDate: number;
  endDate: number;
  metrics: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    totalSnapshots: number;
    activeSnapshots: number;
    totalViews: number;
    totalDownloads: number;
    totalComments: number;
    averageSessionDuration: number;
    subscriptionConversionRate: number;
  };
  lastUpdated: number;
}

// Framework detection types
export type DetectedFramework = 
  | 'vite'
  | 'nextjs'
  | 'sveltekit'
  | 'create-react-app'
  | 'vue'
  | 'angular'
  | 'static'
  | 'unknown';

// Comment system types
export interface Comment {
  id: string;
  snapshotId: string;
  text: string;
  author: string;
  createdAt: number;
  updatedAt?: number;
  file?: string;
  line?: number;
  parentId?: string; // For threaded comments
  replies?: Comment[];
}

// Session management
export interface UserSession {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastActivityAt: number;
  userAgent: string;
  ipAddress?: string;
  country?: string;
  isActive: boolean;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor?: string;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Default values
export const DEFAULT_USER_ANALYTICS = {
  totalSnapshotsCreated: 0,
  totalSnapshotsViewed: 0,
  totalDownloads: 0,
  totalPageVisits: 0,
  lastActiveAt: Date.now(),
  sessionCount: 0,
  averageSessionDuration: 0,
  totalCommentsPosted: 0,
  totalCommentsReceived: 0,
};

export const DEFAULT_SNAPSHOT_ANALYTICS = {
  viewCount: 0,
  uniqueViewers: 0,
  downloadCount: 0,
  commentCount: 0,
  averageTimeOnPage: 0,
  lastViewedAt: Date.now(),
  viewerCountries: [],
  viewerIPs: [],
  viewSessions: [],
};

export const DEFAULT_SNAPSHOT_METADATA = {
  fileCount: 0,
  hasComments: false,
  tags: [],
};

export const DEFAULT_SUBSCRIPTION = {
  status: 'none' as const,
};


