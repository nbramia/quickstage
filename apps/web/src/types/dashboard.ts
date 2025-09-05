// Dashboard and Snapshot types
export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  snapshotCount: number;
  createdAt: number;
  updatedAt: number;
  isArchived?: boolean;
}

export interface Snapshot {
  id: string;
  name?: string;
  ownerUid?: string; // Owner user ID for authorization checks
  ownerName?: string; // Owner name (admin context only)
  ownerEmail?: string; // Owner email (admin context only)
  projectId?: string;
  createdAt: string | number;
  updatedAt?: string | number;
  expiresAt: string | number;
  lastModifiedAt?: string | number;
  password?: string;
  isPublic: boolean;
  viewCount: number;
  uniqueViewers?: number;
  commentCount?: number;
  status?: 'creating' | 'active' | 'expired';
  tags?: string[];
  description?: string;
  version?: string;
  clientName?: string;
  milestone?: string;
  analytics?: {
    recentViewers?: string[];
  };
  review?: {
    isRequested: boolean;
    reviewId?: string;
    checkedOffCount: number;
    totalReviewers: number;
    deadline?: number;
    status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
  };
}

export interface Review {
  id: string;
  snapshotId: string;
  requestedBy: string;
  requestedAt: number;
  reviewers: ReviewParticipant[];
  deadline?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
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

export type SortField = 
  | 'name' 
  | 'createdAt' 
  | 'updatedAt' 
  | 'expiresAt' 
  | 'viewCount' 
  | 'commentCount' 
  | 'project';

export type SortDirection = 'asc' | 'desc';

export interface FilterOptions {
  status: 'all' | 'active' | 'expired';
  projectId?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
  hasReviews?: boolean;
  viewThreshold?: number;
}

export interface DashboardWidget {
  id: string;
  type: 'reviews' | 'expiring' | 'popular' | 'recent';
  title: string;
  visible: boolean;
}

export interface Comment {
  id: string;
  snapshotId: string;
  text: string; // Supports markdown
  author: string;
  authorName?: string;
  createdAt?: number;
  updatedAt?: number;
  
  // Element pinning
  elementSelector?: string; // CSS selector for pinned element
  elementCoordinates?: { x: number; y: number; }; // Relative position
  pageUrl?: string; // For multi-page prototypes
  
  // Legacy position field for backward compatibility
  position?: { x: number; y: number };
  
  // Threading
  parentId?: string; // For threaded comments
  replies?: Comment[];
  
  // State management
  state: 'draft' | 'published' | 'resolved' | 'archived';
  resolvedBy?: string;
  resolvedAt?: number;
  
  // Attachments
  attachments?: CommentAttachment[];
  
  // Subscriptions
  subscribers?: string[]; // User IDs following this comment thread
  isSubscribed?: boolean; // Current user's subscription status
}

export interface CommentAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: number;
}

export interface CommentSubscription {
  id: string;
  userId: string;
  snapshotId: string;
  commentId?: string; // Optional: subscribe to specific comment thread
  createdAt: number;
  lastNotified?: number;
  isActive: boolean;
}

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