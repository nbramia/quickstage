import React, { useState } from 'react';
import { Review } from '../types/dashboard';

interface ReviewCardProps {
  review: Review;
  isOwner: boolean;
  onCancel: () => void;
  onSubmitFeedback: (feedback: string, status: 'approved' | 'changes_requested') => void;
}

export function ReviewCard({ review, isOwner, onCancel, onSubmitFeedback }: ReviewCardProps) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getParticipantStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-gray-600';
      case 'reviewing': return 'text-blue-600';
      case 'approved': return 'text-green-600';
      case 'changes_requested': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const handleSubmitFeedback = async (status: 'approved' | 'changes_requested') => {
    if (!feedback.trim()) {
      alert('Please provide feedback before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitFeedback(feedback, status);
      setShowFeedbackForm(false);
      setFeedback('');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = review.deadline && Date.now() > review.deadline;

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(review.status)}`}>
              {review.status.replace('_', ' ').toUpperCase()}
            </span>
            {isOverdue && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                OVERDUE
              </span>
            )}
          </div>
          
          <p className="text-sm text-gray-600">
            Requested {formatDate(review.requestedAt)}
            {review.deadline && (
              <span className="ml-2">
                • Due {formatDate(review.deadline)}
              </span>
            )}
          </p>
          
          {review.notes && (
            <p className="text-sm text-gray-700 mt-2 italic">"{review.notes}"</p>
          )}
        </div>

        {isOwner && review.status !== 'completed' && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-red-600 ml-4"
            title="Cancel review"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Reviewers */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-900">Reviewers ({review.reviewers.length})</h4>
        
        {review.reviewers.map((participant) => (
          <div key={participant.userId} className="flex items-start justify-between bg-gray-50 p-3 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-gray-900">{participant.userName}</p>
                <span className={`text-xs font-medium ${getParticipantStatusColor(participant.status)}`}>
                  {participant.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600">{participant.userEmail}</p>
              
              {participant.feedback && (
                <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                  <p className="text-sm text-gray-700">{participant.feedback}</p>
                  {participant.reviewedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Reviewed {formatDate(participant.reviewedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Current user can submit feedback */}
            {participant.status === 'pending' && !isOwner && (
              <button
                onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Review
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-3">Submit Your Review</h5>
          
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Provide your feedback on this design..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="flex justify-end gap-3 mt-3">
            <button
              onClick={() => setShowFeedbackForm(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmitFeedback('changes_requested')}
              disabled={isSubmitting || !feedback.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              Request Changes
            </button>
            <button
              onClick={() => handleSubmitFeedback('approved')}
              disabled={isSubmitting || !feedback.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>
            {review.reviewers.filter(r => r.status === 'approved' || r.status === 'changes_requested').length} / {review.reviewers.length} completed
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(review.reviewers.filter(r => r.status === 'approved' || r.status === 'changes_requested').length / review.reviewers.length) * 100}%`
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}