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