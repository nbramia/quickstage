import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Review, ReviewParticipant } from '../types/dashboard';
import { ReviewRequestModal } from './ReviewRequestModal';
import { ReviewCard } from './ReviewCard';

interface ReviewPanelProps {
  snapshotId: string;
  isOwner: boolean;
  onReviewUpdate?: (reviews: Review[]) => void;
}

export function ReviewPanel({ snapshotId, isOwner, onReviewUpdate }: ReviewPanelProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load reviews for the snapshot
  const loadReviews = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/snapshots/${snapshotId}/reviews`);
      const reviewsData = response.reviews || [];
      setReviews(reviewsData);
      
      if (onReviewUpdate) {
        onReviewUpdate(reviewsData);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
      setError('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  // Create new review
  const handleCreateReview = async (reviewData: {
    reviewers: Array<{ userId: string; userName: string; userEmail: string }>;
    deadline?: string;
    notes?: string;
  }) => {
    try {
      await api.post(`/api/snapshots/${snapshotId}/reviews`, {
        reviewers: reviewData.reviewers,
        deadline: reviewData.deadline,
        notes: reviewData.notes
      });
      
      // Track analytics for review creation
      try {
        await api.post('/analytics/track', {
          eventType: 'review_requested',
          eventData: {
            snapshotId,
            reviewerCount: reviewData.reviewers.length,
            hasDeadline: !!reviewData.deadline,
            hasNotes: !!reviewData.notes,
            deadlineInDays: reviewData.deadline ? Math.ceil((new Date(reviewData.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
          }
        });
      } catch (error) {
        console.error('Failed to track review creation analytics:', error);
      }
      
      setShowRequestModal(false);
      await loadReviews();
    } catch (error) {
      console.error('Failed to create review:', error);
      setError('Failed to create review');
    }
  };

  // Cancel review
  const handleCancelReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to cancel this review?')) {
      return;
    }
    
    try {
      await api.delete(`/api/reviews/${reviewId}`);
      await loadReviews();
      
      // Track analytics for review cancellation
      try {
        await api.post('/analytics/track', {
          eventType: 'review_cancelled',
          eventData: {
            snapshotId,
            reviewId
          }
        });
      } catch (error) {
        console.error('Failed to track review cancellation analytics:', error);
      }
    } catch (error) {
      console.error('Failed to cancel review:', error);
      setError('Failed to cancel review');
    }
  };

  // Submit review feedback
  const handleSubmitReview = async (reviewId: string, feedback: string, status: 'approved' | 'changes_requested') => {
    try {
      await api.post(`/api/reviews/${reviewId}/submit`, {
        feedback,
        status
      });
      await loadReviews();
      
      // Track analytics for review submission
      try {
        await api.post('/analytics/track', {
          eventType: status === 'approved' ? 'review_approved' : 'review_rejected',
          eventData: {
            snapshotId,
            reviewId,
            feedbackLength: feedback.length,
            hasFeedback: feedback.length > 0
          }
        });
      } catch (error) {
        console.error('Failed to track review submission analytics:', error);
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
      setError('Failed to submit review');
    }
  };

  useEffect(() => {
    loadReviews();
  }, [snapshotId]);

  if (loading && reviews.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-center text-gray-500 mt-4">Loading reviews...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Reviews</h3>
        {isOwner && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Request Review
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 text-sm underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg">No reviews yet</p>
          <p className="text-gray-400 text-sm mt-1">
            {isOwner ? 'Request feedback from your team' : 'The owner hasn\'t requested any reviews'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isOwner={isOwner}
              onCancel={() => handleCancelReview(review.id)}
              onSubmitFeedback={(feedback, status) => handleSubmitReview(review.id, feedback, status)}
            />
          ))}
        </div>
      )}

      {showRequestModal && (
        <ReviewRequestModal
          onClose={() => setShowRequestModal(false)}
          onSubmit={handleCreateReview}
        />
      )}
    </div>
  );
}