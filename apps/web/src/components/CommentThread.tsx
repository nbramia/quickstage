import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface Comment {
  id: string;
  content: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  status: 'draft' | 'published' | 'resolved' | 'archived';
  createdAt: number;
  updatedAt?: number;
  resolvedAt?: number;
  resolvedBy?: string;
  parentId?: string;
  attachments?: CommentAttachment[];
  replies?: Comment[];
  position?: { x: number; y: number };
  elementSelector?: string;
  elementText?: string;
}

interface CommentAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  uploadedAt: number;
}

interface CommentThreadProps {
  snapshotId: string;
  commentId?: string;
  onClose: () => void;
  isOwner?: boolean;
}

export default function CommentThread({ 
  snapshotId, 
  commentId, 
  onClose, 
  isOwner = false 
}: CommentThreadProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = async () => {
    try {
      setLoading(true);
      let url = `/snapshots/${snapshotId}/comments`;
      if (commentId) {
        url += `/${commentId}/thread`;
      }
      
      const response = await api.get(url);
      setComments(response.comments || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [snapshotId, commentId]);

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/snapshots/${snapshotId}/comments`, {
        content: replyContent.trim(),
        parentId,
        status: 'published'
      });
      
      setReplyContent('');
      setReplyingTo(null);
      await loadComments();
    } catch (error) {
      console.error('Failed to post reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      await api.put(`/snapshots/${snapshotId}/comments/${commentId}`, {
        status: 'resolved'
      });
      await loadComments();
    } catch (error) {
      console.error('Failed to resolve comment:', error);
    }
  };

  const handleReopen = async (commentId: string) => {
    try {
      await api.put(`/snapshots/${snapshotId}/comments/${commentId}`, {
        status: 'published'
      });
      await loadComments();
    } catch (error) {
      console.error('Failed to reopen comment:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType === 'application/pdf') return '📄';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('text')) return '📄';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex items-center justify-center">
        <div className="text-gray-500">Loading comments...</div>
      </div>
    );
  }

  const mainComment = comments.find(c => !c.parentId);
  const replies = comments.filter(c => c.parentId);

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Comment Thread
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Comment List */}
      <div className="flex-1 overflow-y-auto p-4">
        {comments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No comments found
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main Comment */}
            {mainComment && (
              <CommentItem
                comment={mainComment}
                onReply={() => setReplyingTo(mainComment.id)}
                onResolve={handleResolve}
                onReopen={handleReopen}
                isOwner={isOwner}
                currentUserId={user?.uid}
              />
            )}

            {/* Replies */}
            {replies.length > 0 && (
              <div className="ml-6 space-y-4 border-l-2 border-gray-200 pl-4">
                {replies.map(reply => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    onReply={() => setReplyingTo(reply.parentId || mainComment?.id || null)}
                    onResolve={handleResolve}
                    onReopen={handleReopen}
                    isOwner={isOwner}
                    currentUserId={user?.uid}
                    isReply
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reply Form */}
      {replyingTo && (
        <div className="border-t border-gray-200 p-4">
          <div className="space-y-3">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none h-20 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent('');
                }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => replyingTo && handleReply(replyingTo)}
                disabled={submitting || !replyContent.trim()}
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Posting...' : 'Reply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Comment Item Component
interface CommentItemProps {
  comment: Comment;
  onReply: () => void;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  isOwner: boolean;
  currentUserId?: string;
  isReply?: boolean;
}

function CommentItem({ 
  comment, 
  onReply, 
  onResolve, 
  onReopen, 
  isOwner, 
  currentUserId,
  isReply = false 
}: CommentItemProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType === 'application/pdf') return '📄';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('text')) return '📄';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isResolved = comment.status === 'resolved';
  const canResolve = isOwner || comment.userId === currentUserId;

  return (
    <div className={`${isResolved ? 'opacity-75' : ''}`}>
      {/* Comment Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">
              {comment.userName?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">
              {comment.userName || 'Anonymous'}
            </div>
            <div className="text-xs text-gray-500">
              {formatDate(comment.createdAt)}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        {isResolved && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            ✓ Resolved
          </span>
        )}
      </div>

      {/* Element Context */}
      {comment.elementText && !isReply && (
        <div className="mb-3 p-2 bg-blue-50 border-l-4 border-blue-200 rounded">
          <div className="text-xs text-blue-600 font-medium">Referenced Element:</div>
          <div className="text-sm text-blue-800 mt-1">
            "{comment.elementText.substring(0, 100)}{comment.elementText.length > 100 ? '...' : ''}"
          </div>
          {comment.position && (
            <div className="text-xs text-blue-500 mt-1">
              Position: ({comment.position.x}, {comment.position.y})
            </div>
          )}
        </div>
      )}

      {/* Comment Content */}
      <div className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">
        {comment.content}
      </div>

      {/* Attachments */}
      {comment.attachments && comment.attachments.length > 0 && (
        <div className="mb-3 space-y-2">
          {comment.attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
              <span className="text-lg">{getFileIcon(attachment.fileType)}</span>
              <div className="flex-1 min-w-0">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate block"
                >
                  {attachment.fileName}
                </a>
                <div className="text-xs text-gray-500">
                  {formatFileSize(attachment.fileSize)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-4">
        {!isResolved && (
          <button
            onClick={onReply}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Reply
          </button>
        )}
        
        {canResolve && !isResolved && (
          <button
            onClick={() => onResolve(comment.id)}
            className="text-xs text-green-600 hover:text-green-800 transition-colors"
          >
            Resolve
          </button>
        )}
        
        {canResolve && isResolved && (
          <button
            onClick={() => onReopen(comment.id)}
            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            Reopen
          </button>
        )}
      </div>
    </div>
  );
}