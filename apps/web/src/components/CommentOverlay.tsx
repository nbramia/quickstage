import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface CommentPin {
  id: string;
  x: number;
  y: number;
  commentCount: number;
  hasUnresolved: boolean;
  lastActivity: number;
}

interface Comment {
  id: string;
  content: string;
  userName?: string;
  status: 'published' | 'resolved';
  createdAt: number;
  position?: { x: number; y: number };
  parentId?: string;
  replies?: Comment[];
}

interface CommentOverlayProps {
  snapshotId: string;
  isInteractive?: boolean;
  onCommentModeChange?: (enabled: boolean) => void;
  className?: string;
}

export default function CommentOverlay({ 
  snapshotId, 
  isInteractive = true, 
  onCommentModeChange,
  className = '' 
}: CommentOverlayProps) {
  const [commentPins, setCommentPins] = useState<CommentPin[]>([]);
  const [isCommentMode, setIsCommentMode] = useState(false);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  // Load comments and create pins
  const loadComments = useCallback(async () => {
    try {
      const response = await api.get(`/snapshots/${snapshotId}/comments`);
      const commentsData = response.comments || [];
      setComments(commentsData);
      
      // Group comments by position to create pins
      const pinMap = new Map<string, CommentPin>();
      
      commentsData.forEach((comment: Comment) => {
        if (comment.position) {
          const key = `${Math.round(comment.position.x / 10) * 10}-${Math.round(comment.position.y / 10) * 10}`;
          const existing = pinMap.get(key);
          
          if (existing) {
            existing.commentCount++;
            if (comment.status !== 'resolved') {
              existing.hasUnresolved = true;
            }
            existing.lastActivity = Math.max(existing.lastActivity, comment.createdAt);
          } else {
            pinMap.set(key, {
              id: comment.id,
              x: comment.position.x,
              y: comment.position.y,
              commentCount: 1,
              hasUnresolved: comment.status !== 'resolved',
              lastActivity: comment.createdAt
            });
          }
        }
      });
      
      setCommentPins(Array.from(pinMap.values()));
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  }, [snapshotId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const toggleCommentMode = () => {
    const newMode = !isCommentMode;
    setIsCommentMode(newMode);
    onCommentModeChange?.(newMode);
  };

  const handlePinClick = (pinId: string) => {
    setActivePin(activePin === pinId ? null : pinId);
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (isCommentMode && event.target === event.currentTarget) {
      // Create new comment at click position
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Show comment creation UI
      console.log('Create comment at', { x, y });
    }
  };

  if (loading) {
    return null;
  }

  return (
    <>
      {/* Comment Mode Toggle */}
      {isInteractive && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={toggleCommentMode}
            className={`px-4 py-2 rounded-lg font-medium shadow-lg transition-all ${
              isCommentMode 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              {isCommentMode ? 'Exit Comments' : 'Add Comments'}
            </span>
          </button>
        </div>
      )}

      {/* Comment Overlay */}
      <div 
        className={`absolute inset-0 pointer-events-none z-30 ${className}`}
        onClick={handleOverlayClick}
        style={{ pointerEvents: isCommentMode ? 'auto' : 'none' }}
      >
        {/* Comment Pins */}
        {commentPins.map((pin) => (
          <div key={pin.id} className="absolute pointer-events-auto">
            <div
              className={`relative w-8 h-8 rounded-full cursor-pointer transition-all transform hover:scale-110 ${
                pin.hasUnresolved 
                  ? 'bg-red-500 border-2 border-red-600 shadow-red-200' 
                  : 'bg-green-500 border-2 border-green-600 shadow-green-200'
              } shadow-lg`}
              style={{
                left: `${pin.x - 16}px`,
                top: `${pin.y - 16}px`,
              }}
              onClick={() => handlePinClick(pin.id)}
              onMouseEnter={() => setShowTooltip(pin.id)}
              onMouseLeave={() => setShowTooltip(null)}
            >
              {/* Comment Count */}
              <div className="flex items-center justify-center w-full h-full">
                <span className="text-xs font-bold text-white">
                  {pin.commentCount}
                </span>
              </div>

              {/* Pulse Animation for Unresolved */}
              {pin.hasUnresolved && (
                <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
              )}

              {/* Tooltip */}
              {showTooltip === pin.id && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  {pin.commentCount} comment{pin.commentCount !== 1 ? 's' : ''}
                  {pin.hasUnresolved ? ' • Unresolved' : ' • Resolved'}
                </div>
              )}
            </div>

            {/* Comment Thread Preview */}
            {activePin === pin.id && (
              <div 
                className="absolute bg-white rounded-lg shadow-xl border p-4 w-80 z-40"
                style={{
                  left: `${pin.x + 20}px`,
                  top: `${pin.y - 100}px`,
                  maxHeight: '300px',
                  overflow: 'auto'
                }}
              >
                <div className="space-y-3">
                  {comments
                    .filter(c => c.position && 
                      Math.abs(c.position.x - pin.x) < 20 && 
                      Math.abs(c.position.y - pin.y) < 20
                    )
                    .slice(0, 3) // Show first 3 comments
                    .map((comment) => (
                      <div key={comment.id} className="text-sm">
                        <div className="font-medium text-gray-900">
                          {comment.userName || 'Anonymous'}
                        </div>
                        <div className="text-gray-600 mt-1 line-clamp-2">
                          {comment.content}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-xs text-gray-500">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </div>
                          {comment.status === 'resolved' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              ✓ Resolved
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  
                  {pin.commentCount > 3 && (
                    <div className="text-xs text-gray-500 text-center border-t pt-2">
                      +{pin.commentCount - 3} more comments
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-2 mt-4 pt-3 border-t">
                    <button
                      onClick={() => setActivePin(null)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                    <button className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
                      View All
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Comment Mode Instructions */}
        {isCommentMode && commentPins.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center pointer-events-none">
            <div className="text-blue-600 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-blue-700">
              <div className="font-medium">Comment Mode Active</div>
              <div className="mt-1">Click anywhere to add a comment</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}