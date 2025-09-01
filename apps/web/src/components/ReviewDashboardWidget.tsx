import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Review } from '../types/dashboard';

interface ReviewDashboardWidgetProps {
  onReviewClick?: (review: Review) => void;
}

export function ReviewDashboardWidget({ onReviewClick }: ReviewDashboardWidgetProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all pending reviews for user's snapshots
  const loadPendingReviews = async () => {
    try {
      setLoading(true);
      
      // Get user's snapshots first
      const snapshotsResponse = await api.get('/api/snapshots/list');
      const snapshots = snapshotsResponse.snapshots || [];
      
      // Get reviews for each snapshot
      const reviewPromises = snapshots.map(async (snapshot: any) => {
        try {
          const reviewsResponse = await api.get(`/api/snapshots/${snapshot.id}/reviews`);
          return (reviewsResponse.reviews || []).map((review: Review) => ({
            ...review,
            snapshotName: snapshot.name || 'Untitled Snapshot'
          }));
        } catch {
          return [];
        }
      });
      
      const allReviews = await Promise.all(reviewPromises);
      const flatReviews = allReviews.flat();
      
      // Filter to pending and in-progress reviews only
      const pendingReviews = flatReviews.filter(
        (review: Review) => review.status === 'pending' || review.status === 'in_progress'
      );
      
      setReviews(pendingReviews);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingReviews();
  }, []);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    return 'Just now';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Pending Reviews</h3>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-gray-500 text-sm">Loading reviews...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Pending Reviews</h3>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {reviews.length} pending
        </span>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500">No pending reviews</p>
          <p className="text-gray-400 text-sm">Reviews you've requested will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.slice(0, 5).map((review) => {
            const isOverdue = review.deadline && Date.now() > review.deadline;
            const completedCount = review.reviewers.filter(r => 
              r.status === 'approved' || r.status === 'changes_requested'
            ).length;
            
            return (
              <div
                key={review.id}
                onClick={() => onReviewClick?.(review)}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {(review as any).snapshotName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {completedCount}/{review.reviewers.length} completed • {formatTimeAgo(review.requestedAt)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isOverdue ? 'bg-red-100 text-red-800' : getStatusColor(review.status)
                  }`}>
                    {isOverdue ? 'OVERDUE' : review.status.toUpperCase()}
                  </span>
                </div>
                
                {review.notes && (
                  <p className="text-sm text-gray-600 mb-2 italic">"{review.notes}"</p>
                )}
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${(completedCount / review.reviewers.length) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
          
          {reviews.length > 5 && (
            <div className="text-center pt-2">
              <p className="text-sm text-gray-500">
                And {reviews.length - 5} more reviews...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}