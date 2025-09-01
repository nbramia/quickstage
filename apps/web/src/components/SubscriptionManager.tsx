import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { CommentSubscription, Snapshot } from '../types/dashboard';
import { Link } from 'react-router-dom';

interface SubscriptionWithDetails extends CommentSubscription {
  snapshotName?: string;
  commentPreview?: string;
}

interface SubscriptionManagerProps {
  className?: string;
}

export default function SubscriptionManager({ className = '' }: SubscriptionManagerProps) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user's subscriptions
  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/subscriptions');
      setSubscriptions(response.subscriptions || []);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      setError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Unsubscribe from a conversation
  const handleUnsubscribe = async (subscriptionId: string) => {
    try {
      await api.delete(`/api/subscriptions/${subscriptionId}`);
      setSubscriptions(prev => prev.filter(sub => sub.id !== subscriptionId));
      
      // Track analytics for unsubscription
      try {
        await api.post('/analytics/track', {
          eventType: 'comment_subscription_removed',
          eventData: {
            subscriptionId,
            method: 'settings_page'
          }
        });
      } catch (error) {
        console.error('Failed to track unsubscription analytics:', error);
      }
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      alert('Failed to unsubscribe. Please try again.');
    }
  };

  // Toggle subscription active status
  const handleToggleActive = async (subscriptionId: string, isActive: boolean) => {
    try {
      await api.patch(`/api/subscriptions/${subscriptionId}`, {
        isActive: !isActive
      });
      setSubscriptions(prev => prev.map(sub => 
        sub.id === subscriptionId ? { ...sub, isActive: !isActive } : sub
      ));
      
      // Track analytics for subscription toggle
      try {
        await api.post('/analytics/track', {
          eventType: !isActive ? 'comment_subscription_activated' : 'comment_subscription_paused',
          eventData: {
            subscriptionId,
            method: 'settings_page',
            newState: !isActive ? 'active' : 'paused'
          }
        });
      } catch (error) {
        console.error('Failed to track subscription toggle analytics:', error);
      }
    } catch (err) {
      console.error('Failed to toggle subscription:', err);
      alert('Failed to update subscription. Please try again.');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={loadSubscriptions}
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Comment Subscriptions</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage your subscriptions to comment threads and snapshots
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="divide-y divide-gray-200">
        {subscriptions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-3.405-3.405A9.048 9.048 0 0118 9a9 9 0 10-18 0 9.048 9.048 0 001.405 4.595L2 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No subscriptions yet</h3>
            <p className="text-gray-600 mb-4">
              You're not following any comment conversations. Start a conversation or follow existing ones to get notifications.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Snapshots
            </Link>
          </div>
        ) : (
          subscriptions.map((subscription) => (
            <div key={subscription.id} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {subscription.snapshotName || `Snapshot ${subscription.snapshotId}`}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      subscription.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {subscription.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  
                  {subscription.commentPreview && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      "{subscription.commentPreview}"
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Subscribed {formatDate(subscription.createdAt)}</span>
                    {subscription.lastNotified && (
                      <span>Last notification {formatDate(subscription.lastNotified)}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  {/* Toggle Active/Inactive */}
                  <button
                    onClick={() => handleToggleActive(subscription.id, subscription.isActive)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      subscription.isActive
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title={subscription.isActive ? 'Pause notifications' : 'Resume notifications'}
                  >
                    {subscription.isActive ? 'Pause' : 'Resume'}
                  </button>
                  
                  {/* View Snapshot */}
                  <Link
                    to={`/view/${subscription.snapshotId}`}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                    title="View snapshot"
                  >
                    View
                  </Link>
                  
                  {/* Unsubscribe */}
                  <button
                    onClick={() => handleUnsubscribe(subscription.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                    title="Unsubscribe from this conversation"
                  >
                    Unsubscribe
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Footer */}
      {subscriptions.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <p className="text-xs text-gray-600">
            You'll receive email notifications when new comments are added to conversations you're following.
            You can pause or unsubscribe from individual conversations at any time.
          </p>
        </div>
      )}
    </div>
  );
}