export type Bindings = {
  KV_USERS: KVNamespace;
  KV_SNAPS: KVNamespace;
  KV_ANALYTICS: KVNamespace; // New analytics namespace
  KV_PROJECTS: KVNamespace; // Projects/folders namespace
  KV_REVIEWS: KVNamespace; // Reviews namespace
  R2_SNAPSHOTS: R2Bucket;
  R2_ATTACHMENTS: R2Bucket; // Comment attachments bucket
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
  
  // Onboarding & Tutorial Progress
  onboarding: {
    hasSeenWelcome: boolean;
    completedTutorials: string[]; // List of completed tutorial IDs
    welcomeShownAt?: number;
    lastTutorialCompletedAt?: number;
    skippedWelcome?: boolean;
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
  
  // Project organization
  projectId?: string; // Optional project folder
  
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
  lastModifiedAt?: number; // For sorting by modification
  
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
    recentViewers?: string[]; // Recent unique viewer IDs
  };
  
  // Enhanced metadata
  metadata: {
    fileCount: number;
    framework?: string; // Auto-detected from files
    hasComments: boolean;
    tags?: string[];
    description?: string;
    thumbnail?: string;
    version?: string; // Version number
    clientName?: string; // Client/customer name
    milestone?: string; // Project milestone
    reviewSummary?: string; // Optional text for reviewers
  };
  
  // Review status
  review?: {
    isRequested: boolean;
    reviewId?: string;
    checkedOffCount: number;
    totalReviewers: number;
    deadline?: number;
    status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
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
  | 'comment_updated'
  | 'comment_resolved'
  | 'comments_bulk_resolved'
  | 'comment_subscription_created'
  | 'comment_subscription_cancelled'
  | 'notifications_marked_all_read'
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
  | 'rate_limit_exceeded'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'project_archived'
  | 'project_unarchived'
  | 'review_requested'
  | 'review_submitted'
  | 'review_cancelled'
  | 'review_reminder_sent'
  | 'welcome_shown'
  | 'welcome_dismissed'
  | 'welcome_skipped'
  | 'tutorial_started'
  | 'tutorial_completed'
  | 'tutorial_skipped'
  | 'ai_suggestions_viewed'
  | 'ai_suggestion_applied'
  | 'ai_suggestion_dismissed'
  | 'ai_suggestions_generated';

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

// Project/Folder types
export interface Project {
  id: string;
  ownerUid: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  snapshotCount: number;
  color?: string; // For UI display
  icon?: string; // Optional icon
  isArchived?: boolean;
  sortOrder?: number; // For custom ordering
}

// Enhanced Comment system types
export interface Comment {
  id: string;
  snapshotId: string;
  text: string; // Supports markdown
  author: string;
  authorName?: string;
  createdAt: number;
  updatedAt?: number;
  
  // Element pinning
  elementSelector?: string; // CSS selector for pinned element
  elementCoordinates?: { x: number; y: number; }; // Relative position
  pageUrl?: string; // For multi-page prototypes
  
  // Threading
  parentId?: string; // For threaded comments
  replies?: Comment[];
  
  // State management
  state: 'draft' | 'published' | 'resolved' | 'archived';
  resolvedBy?: string;
  resolvedAt?: number;
  
  // Attachments
  attachments?: CommentAttachment[];
}

export interface CommentAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: number;
}

// Subscription types
export interface CommentSubscription {
  id: string;
  userId: string;
  snapshotId: string;
  commentId?: string; // Optional: subscribe to specific comment thread
  createdAt: number;
  lastNotified?: number;
  isActive: boolean;
  unsubscribedAt?: number;
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  type: 'comment_reply' | 'comment_new' | 'comment_resolved' | 'snapshot_comment';
  title: string;
  message: string;
  snapshotId: string;
  commentId?: string;
  createdAt: number;
  readAt?: number;
  actionUrl?: string;
}

// Review workflow types
export interface Review {
  id: string;
  snapshotId: string;
  requestedBy: string;
  requestedAt: number;
  
  // Review participants
  reviewers: ReviewParticipant[];
  
  // Deadline management
  deadline?: number;
  reminderSent?: boolean;
  
  // Overall status
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  completedAt?: number;
  
  // Optional review notes
  notes?: string;
}

export interface ReviewParticipant {
  userId: string;
  userName?: string;
  userEmail?: string;
  assignedAt: number;
  status: 'pending' | 'reviewing' | 'approved' | 'changes_requested';
  reviewedAt?: number;
  feedback?: string;
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

export const DEFAULT_ONBOARDING = {
  hasSeenWelcome: false,
  completedTutorials: [],
};

// AI Suggestions Types
export interface AISuggestion {
  id: string;
  snapshotId: string;
  type: AISuggestionType;
  title: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high';
  category: 'accessibility' | 'usability' | 'design' | 'performance' | 'mobile';
  elementSelector?: string; // CSS selector for pinning to specific element
  elementCoordinates?: { x: number; y: number; }; // For visual placement
  pageUrl?: string; // For multi-page prototypes
  actionable: boolean; // Whether suggestion has actionable steps
  actionSteps?: string[]; // Specific steps to implement suggestion
  exampleCode?: string; // Example code or markup
  resources?: AISuggestionResource[]; // Related resources/links
  confidence: number; // AI confidence score (0-1)
  generatedAt: number;
  status: 'active' | 'applied' | 'dismissed';
  appliedAt?: number;
  dismissedAt?: number;
  userFeedback?: 'helpful' | 'not_helpful' | 'neutral';
}

export type AISuggestionType = 
  | 'accessibility_missing_alt'
  | 'accessibility_color_contrast'
  | 'accessibility_keyboard_navigation'
  | 'accessibility_focus_indicators'
  | 'accessibility_semantic_html'
  | 'usability_button_size'
  | 'usability_click_targets'
  | 'usability_form_labels'
  | 'usability_error_messages'
  | 'usability_loading_states'
  | 'design_spacing_consistency'
  | 'design_typography_hierarchy'
  | 'design_color_palette'
  | 'design_visual_hierarchy'
  | 'design_alignment'
  | 'performance_image_optimization'
  | 'performance_loading_speed'
  | 'mobile_responsive_design'
  | 'mobile_touch_targets'
  | 'mobile_viewport_scaling';

export interface AISuggestionResource {
  title: string;
  url: string;
  type: 'article' | 'guide' | 'documentation' | 'example' | 'tool';
}

export interface AISuggestionsAnalysis {
  snapshotId: string;
  totalSuggestions: number;
  suggestionsByCategory: Record<string, number>;
  suggestionsBySeverity: Record<string, number>;
  overallScore: number; // Overall UX score (0-100)
  lastAnalyzedAt: number;
  analysisVersion: string; // For tracking AI model updates
}


