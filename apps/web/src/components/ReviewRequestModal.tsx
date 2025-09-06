import React, { useState } from 'react';

interface ReviewRequestModalProps {
  onClose: () => void;
  onSubmit: (data: {
    reviewers: Array<{ userId: string; userName: string; userEmail: string }>;
    deadline?: string;
    notes?: string;
  }) => void;
}

export function ReviewRequestModal({ onClose, onSubmit }: ReviewRequestModalProps) {
  const [reviewers, setReviewers] = useState<Array<{ userId: string; userName: string; userEmail: string }>>([]);
  const [newReviewerEmail, setNewReviewerEmail] = useState('');
  const [newReviewerName, setNewReviewerName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddReviewer = () => {
    if (!newReviewerEmail.trim() || !newReviewerName.trim()) {
      setError('Please enter both name and email');
      return;
    }

    if (reviewers.some(r => r.userEmail === newReviewerEmail)) {
      setError('This reviewer is already added');
      return;
    }

    // Generate a simple user ID based on email
    const userId = `user_${newReviewerEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    setReviewers([
      ...reviewers,
      {
        userId,
        userName: newReviewerName,
        userEmail: newReviewerEmail
      }
    ]);

    setNewReviewerEmail('');
    setNewReviewerName('');
    setError(null);
  };

  const handleRemoveReviewer = (email: string) => {
    setReviewers(reviewers.filter(r => r.userEmail !== email));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (reviewers.length === 0) {
      setError('Please add at least one reviewer');
      return;
    }

    const deadlineDate = deadline ? new Date(deadline).toISOString() : undefined;
    
    onSubmit({
      reviewers,
      deadline: deadlineDate,
      notes: notes.trim() || undefined
    });
  };

  return (
    <div>
      <div className="mb-4">
        <h4 className="text-md font-medium text-gray-900">Add Reviewers</h4>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Add Reviewers */}
        <div>
          <div className="space-y-2 mb-2">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Reviewer name"
                value={newReviewerName}
                onChange={(e) => setNewReviewerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="reviewer@example.com"
                value={newReviewerEmail}
                onChange={(e) => setNewReviewerEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={handleAddReviewer}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </div>

          {/* Reviewers List */}
          {reviewers.length > 0 && (
            <div className="space-y-2">
              {reviewers.map((reviewer) => (
                <div key={reviewer.userEmail} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                  <div>
                    <p className="font-medium text-gray-900">{reviewer.userName}</p>
                    <p className="text-sm text-gray-600">{reviewer.userEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveReviewer(reviewer.userEmail)}
                    className="text-red-500 hover:text-red-700 p-1 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deadline (optional)
          </label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any specific instructions or context for reviewers..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Send Request
          </button>
        </div>
      </form>
    </div>
  );
}