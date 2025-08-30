import React from 'react';
import { Snapshot } from '../types/dashboard';
import { Link } from 'react-router-dom';

interface DashboardWidgetsProps {
  snapshots: Snapshot[];
  onExtend: (snapshotId: string) => void;
}

export default function DashboardWidgets({ snapshots, onExtend }: DashboardWidgetsProps) {
  // Calculate metrics
  const activeSnapshots = snapshots.filter(s => new Date(s.expiresAt) > new Date());
  const expiringSoon = activeSnapshots.filter(s => {
    const days = Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 3 && days > 0;
  });
  
  const reviewsPending = snapshots.filter(s => 
    s.review?.isRequested && s.review.status === 'pending'
  );
  
  const reviewsOverdue = snapshots.filter(s => 
    s.review?.isRequested && s.review.status === 'overdue'
  );

  const popularSnapshots = [...snapshots]
    .filter(s => s.viewCount > 0)
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 5);

  const recentActivity = [...snapshots]
    .filter(s => s.analytics?.recentViewers && s.analytics.recentViewers.length > 0)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {/* Reviews Widget */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Review Status</h3>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        
        <div className="space-y-2">
          {reviewsPending.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Pending Reviews</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {reviewsPending.length}
              </span>
            </div>
          )}
          
          {reviewsOverdue.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Overdue Reviews</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {reviewsOverdue.length}
              </span>
            </div>
          )}
          
          {reviewsPending.length === 0 && reviewsOverdue.length === 0 && (
            <p className="text-sm text-gray-500">No pending reviews</p>
          )}
          
          {(reviewsPending.length > 0 || reviewsOverdue.length > 0) && (
            <div className="pt-2 mt-2 border-t border-gray-100">
              {[...reviewsOverdue, ...reviewsPending].slice(0, 3).map(snapshot => (
                <Link
                  key={snapshot.id}
                  to={`/viewer/${snapshot.id}`}
                  className="block py-1 text-sm text-indigo-600 hover:text-indigo-800 truncate"
                >
                  {snapshot.name || `Snapshot ${snapshot.id.slice(0, 8)}`}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expiring Soon Widget */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Expiring Soon</h3>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {expiringSoon.length > 0 ? (
          <div className="space-y-2">
            {expiringSoon.slice(0, 5).map(snapshot => {
              const days = Math.ceil((new Date(snapshot.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div key={snapshot.id} className="flex items-center justify-between">
                  <Link
                    to={`/viewer/${snapshot.id}`}
                    className="text-sm text-gray-700 hover:text-indigo-600 truncate flex-1 mr-2"
                  >
                    {snapshot.name || `Snapshot ${snapshot.id.slice(0, 8)}`}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${
                      days <= 1 ? 'text-red-600' : 'text-orange-600'
                    }`}>
                      {days} day{days !== 1 ? 's' : ''}
                    </span>
                    {snapshot.viewCount > 0 && (
                      <button
                        onClick={() => onExtend(snapshot.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Extend
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No snapshots expiring soon</p>
        )}
      </div>

      {/* Popular Snapshots Widget */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Most Viewed</h3>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>

        {popularSnapshots.length > 0 ? (
          <div className="space-y-2">
            {popularSnapshots.map(snapshot => (
              <div key={snapshot.id} className="flex items-center justify-between">
                <Link
                  to={`/viewer/${snapshot.id}`}
                  className="text-sm text-gray-700 hover:text-indigo-600 truncate flex-1 mr-2"
                >
                  {snapshot.name || `Snapshot ${snapshot.id.slice(0, 8)}`}
                </Link>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-xs text-gray-600">{snapshot.viewCount}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No views yet</p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-4 text-white">
        <h3 className="text-sm font-semibold mb-3">Quick Stats</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-2xl font-bold">{activeSnapshots.length}</p>
            <p className="text-xs opacity-90">Active Snapshots</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {snapshots.reduce((sum, s) => sum + (s.viewCount || 0), 0)}
            </p>
            <p className="text-xs opacity-90">Total Views</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {snapshots.reduce((sum, s) => sum + (s.commentCount || 0), 0)}
            </p>
            <p className="text-xs opacity-90">Comments</p>
          </div>
          <div>
            <p className="text-2xl font-bold">
              {snapshots.filter(s => s.review?.isRequested).length}
            </p>
            <p className="text-xs opacity-90">Reviews</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <div className="space-y-2">
            {recentActivity.map(snapshot => (
              <div key={snapshot.id} className="flex items-center justify-between">
                <Link
                  to={`/viewer/${snapshot.id}`}
                  className="text-sm text-gray-700 hover:text-indigo-600 truncate flex-1 mr-2"
                >
                  {snapshot.name || `Snapshot ${snapshot.id.slice(0, 8)}`}
                </Link>
                <span className="text-xs text-gray-500">
                  {snapshot.analytics?.recentViewers?.length} recent viewer{snapshot.analytics?.recentViewers?.length !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}