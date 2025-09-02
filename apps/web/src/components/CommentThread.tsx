import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Comment } from '../types/dashboard';

interface CommentThreadProps {
  snapshotId: string;
  commentId?: string;
  onClose: () => void;
  isOwner?: boolean;
  comments?: Comment[];
  onCommentsUpdate?: (comments: Comment[]) => void;
}

interface CommentItemProps {
  comment: Comment;
  replies: Comment[];
  depth: number;
  onReply: (parentId: string, text: string, attachments?: File[]) => Promise<void>;
  onResolve: (commentId: string) => Promise<void>;
  onArchive: (commentId: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onUpdate: (commentId: string, text: string) => Promise<void>;
  showActions?: boolean;
  maxDepth?: number;
  isOwner: boolean;
  currentUserId?: string;
}

function CommentItem({ 
  comment, 
  replies, 
  depth, 
  onReply, 
  onResolve, 
  onArchive, 
  onDelete, 
  onUpdate,
  showActions = true,
  maxDepth = 5,
  isOwner,
  currentUserId
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [editText, setEditText] = useState(comment.text || '');
  const [isExpanded, setIsExpanded] = useState(depth < 3);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [replyText]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setShowActionMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReply = async () => {
    if (!replyText.trim() || submitting) return;
    
    setSubmitting(true);
    try {
      await onReply(comment.id, replyText.trim(), attachments.length > 0 ? attachments : undefined);
      setReplyText('');
      setAttachments([]);
      setIsReplying(false);
    } catch (error) {
      console.error('Failed to reply:', error);
      alert('Failed to post reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editText.trim() || submitting) return;
    
    setSubmitting(true);
    try {
      await onUpdate(comment.id, editText.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update comment:', error);
      alert('Failed to update comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'resolved': return 'text-green-700 bg-green-100 border-green-200';
      case 'archived': return 'text-gray-700 bg-gray-100 border-gray-200';
      case 'draft': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      default: return 'text-blue-700 bg-blue-100 border-blue-200';
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'resolved':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'archived':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
            <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'draft':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const canEdit = currentUserId && (comment.author === currentUserId || isOwner);
  const canModerate = isOwner;
  const commentText = comment.text || '';
  const commentAuthor = comment.authorName || 'Anonymous';
  const commentState = comment.state || 'published';

  return (
    <div className={`comment-item relative ${depth > 0 ? 'ml-6' : ''}`}>
      {/* Thread connector line for nested comments */}
      {depth > 0 && (
        <>
          <div className="absolute -left-6 top-0 w-px bg-gray-300 h-full" />
          <div className="absolute -left-6 top-4 w-4 h-px bg-gray-300" />
        </>
      )}
      
      <div className={`bg-white border rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-all duration-200 ${
        commentState === 'resolved' ? 'opacity-75 bg-gray-50' : ''
      } ${commentState === 'archived' ? 'opacity-50 bg-gray-50' : ''}`}>
        
        {/* Comment header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 flex-1">
            {/* Avatar */}
            <div className="w-7 h-7 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
              {commentAuthor.charAt(0)?.toUpperCase() || 'U'}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-gray-900 truncate">{commentAuthor}</p>
                <p className="text-xs text-gray-500 flex-shrink-0">{formatTime(comment.createdAt || 0)}</p>
                
                {/* State badge */}
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1 border ${getStateColor(commentState)}`}>
                  {getStateIcon(commentState)}
                  <span className="capitalize">{commentState}</span>
                </div>
              </div>
              
              {/* Element reference */}
              {comment.elementSelector && (
                <div className="text-xs text-gray-500 flex items-center space-x-1 mt-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span>Pinned to element</span>
                </div>
              )}
            </div>
          </div>

          {/* Action menu button */}
          {showActions && (canEdit || canModerate) && (
            <div className="relative" ref={actionMenuRef}>
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
                title="Comment actions"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {/* Action menu dropdown */}
              {showActionMenu && (
                <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  {canEdit && (
                    <button
                      onClick={() => {
                        setIsEditing(!isEditing);
                        setShowActionMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                  )}
                  
                  {commentState !== 'resolved' && (canEdit || canModerate) && (
                    <button
                      onClick={() => {
                        onResolve(comment.id);
                        setShowActionMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Resolve</span>
                    </button>
                  )}
                  
                  {commentState === 'resolved' && (canEdit || canModerate) && (
                    <button
                      onClick={() => {
                        onUpdate(comment.id, commentText); // Reopen by updating state
                        setShowActionMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Reopen</span>
                    </button>
                  )}
                  
                  {commentState !== 'archived' && canModerate && (
                    <button
                      onClick={() => {
                        onArchive(comment.id);
                        setShowActionMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-yellow-700 hover:bg-yellow-50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                        <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>Archive</span>
                    </button>
                  )}
                  
                  {(canEdit || canModerate) && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
                          onDelete(comment.id);
                        }
                        setShowActionMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comment content */}
        <div className="mb-3">
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Edit your comment..."
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(commentText);
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={!editText.trim() || submitting}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{commentText}</p>
            </div>
          )}
        </div>

        {/* Attachments */}
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">Attachments:</h4>
            <div className="space-y-1">
              {comment.attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center space-x-2 text-sm bg-gray-50 rounded p-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                  </svg>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex-1 truncate"
                  >
                    {attachment.filename}
                  </a>
                  <span className="text-gray-500 text-xs flex-shrink-0">
                    ({Math.round(attachment.size / 1024)}KB)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
          <div className="flex items-center space-x-4">
            {!isReplying && commentState !== 'archived' && (
              <button
                onClick={() => setIsReplying(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span>Reply</span>
              </button>
            )}
            
            {replies.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center space-x-1"
              >
                <svg 
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span>
                  {isExpanded ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </span>
              </button>
            )}
          </div>

          {/* Depth and ID info */}
          <div className="text-xs text-gray-400">
            {depth > 0 && <span>Level {depth + 1}</span>}
          </div>
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md border-l-4 border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span className="text-sm font-medium text-blue-700">Replying to {commentAuthor}</span>
            </div>
            
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
              placeholder="Write a reply..."
            />
            
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.txt,.md,.pdf,.doc,.docx"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                  </svg>
                  <span>Attach</span>
                </button>

                {attachments.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
                  </span>
                )}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setIsReplying(false);
                    setReplyText('');
                    setAttachments([]);
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim() || submitting}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Replying...' : 'Reply'}
                </button>
              </div>
            </div>

            {/* Attached files preview */}
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                    <span className="truncate flex-1">{file.name}</span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="ml-2 text-red-500 hover:text-red-700 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nested replies */}
      {isExpanded && replies.length > 0 && depth < maxDepth && (
        <div className="replies-container">
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={[]} // Flatten for now, or implement deeper nesting
              depth={depth + 1}
              onReply={onReply}
              onResolve={onResolve}
              onArchive={onArchive}
              onDelete={onDelete}
              onUpdate={onUpdate}
              showActions={showActions}
              maxDepth={maxDepth}
              isOwner={isOwner}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
      
      {/* Max depth reached indicator */}
      {depth >= maxDepth && replies.length > 0 && (
        <div className="ml-6 p-3 bg-gray-50 rounded-md border-l-4 border-gray-200 text-sm text-gray-600 italic">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>Thread continues with {replies.length} more {replies.length === 1 ? 'reply' : 'replies'}...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommentThread({ 
  snapshotId, 
  commentId, 
  onClose, 
  isOwner = false,
  comments: externalComments,
  onCommentsUpdate
}: CommentThreadProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(externalComments || []);
  const [loading, setLoading] = useState(!externalComments);

  const loadComments = async () => {
    if (externalComments) return; // Use external comments if provided
    
    try {
      setLoading(true);
      let url = `/api/snapshots/${snapshotId}/comments`;
      if (commentId) {
        url += `/${commentId}/thread`;
      }
      
      const response = await api.get(url);
      const loadedComments = response.comments || response.data?.comments || [];
      setComments(loadedComments);
      if (onCommentsUpdate) {
        onCommentsUpdate(loadedComments);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (externalComments) {
      setComments(externalComments);
    } else {
      loadComments();
    }
  }, [snapshotId, commentId, externalComments]);

  // Build comment tree structure
  const buildCommentTree = (comments: Comment[]) => {
    const commentMap = new Map<string, Comment & { replies: Comment[] }>();
    const rootComments: (Comment & { replies: Comment[] })[] = [];
    
    // First pass: create comment objects with empty replies
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });
    
    // Second pass: build the tree structure
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      
      if (comment.parentId && commentMap.has(comment.parentId)) {
        // This is a reply, add to parent's replies
        commentMap.get(comment.parentId)!.replies.push(commentWithReplies);
      } else {
        // This is a root comment
        rootComments.push(commentWithReplies);
      }
    });
    
    // Sort by creation time (newest first for root, oldest first for replies)
    rootComments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    const sortReplies = (comment: Comment & { replies: Comment[] }) => {
      comment.replies.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      comment.replies.forEach(reply => {
        if (reply.replies && reply.replies.length > 0) {
          sortReplies(reply as Comment & { replies: Comment[] });
        }
      });
    };
    
    rootComments.forEach(sortReplies);
    
    return rootComments;
  };

  const handleReply = async (parentId: string, text: string, attachments?: File[]) => {
    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('parentId', parentId);
      formData.append('state', 'published');
      
      if (attachments && attachments.length > 0) {
        attachments.forEach(file => {
          formData.append('attachments', file);
        });
      }

      const response = await api.post(`/api/snapshots/${snapshotId}/comments`, formData);
      
      // Reload comments to show the new reply
      await loadComments();
    } catch (error) {
      console.error('Failed to post reply:', error);
      throw error;
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      await api.put(`/api/snapshots/${snapshotId}/comments/${commentId}`, {
        state: 'resolved'
      });
      await loadComments();
      
      // Track analytics for comment resolution
      try {
        await api.post('/analytics/track', {
          eventType: 'comment_resolved',
          eventData: {
            snapshotId,
            commentId
          }
        });
      } catch (error) {
        console.error('Failed to track comment resolution analytics:', error);
      }
    } catch (error) {
      console.error('Failed to resolve comment:', error);
      throw error;
    }
  };

  const handleArchive = async (commentId: string) => {
    try {
      await api.put(`/api/snapshots/${snapshotId}/comments/${commentId}`, {
        state: 'archived'
      });
      await loadComments();
      
      // Track analytics for comment archival
      try {
        await api.post('/analytics/track', {
          eventType: 'comment_archived',
          eventData: {
            snapshotId,
            commentId
          }
        });
      } catch (error) {
        console.error('Failed to track comment archival analytics:', error);
      }
    } catch (error) {
      console.error('Failed to archive comment:', error);
      throw error;
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await api.delete(`/api/snapshots/${snapshotId}/comments/${commentId}`);
      await loadComments();
      
      // Track analytics for comment deletion
      try {
        await api.post('/analytics/track', {
          eventType: 'comment_deleted',
          eventData: {
            snapshotId,
            commentId
          }
        });
      } catch (error) {
        console.error('Failed to track comment deletion analytics:', error);
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
      throw error;
    }
  };

  const handleUpdate = async (commentId: string, text: string) => {
    try {
      await api.put(`/api/snapshots/${snapshotId}/comments/${commentId}`, {
        text
      });
      await loadComments();
      
      // Track analytics for comment update
      try {
        await api.post('/analytics/track', {
          eventType: 'comment_edited',
          eventData: {
            snapshotId,
            commentId,
            newContentLength: text.length
          }
        });
      } catch (error) {
        console.error('Failed to track comment edit analytics:', error);
      }
    } catch (error) {
      console.error('Failed to update comment:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading comments...</p>
        </div>
      </div>
    );
  }

  const commentTree = buildCommentTree(comments);

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 font-inconsolata">
            Comments ({comments.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Comment List */}
      <div className="flex-1 overflow-y-auto">
        {commentTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2 font-inconsolata">No comments yet</h3>
            <p className="text-gray-500 text-sm mb-4">Start the conversation by adding the first comment!</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {commentTree.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={comment.replies}
                depth={0}
                onReply={handleReply}
                onResolve={handleResolve}
                onArchive={handleArchive}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                showActions={true}
                maxDepth={5}
                isOwner={isOwner}
                currentUserId={user?.uid}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with summary stats */}
      {commentTree.length > 0 && (
        <div className="border-t border-gray-200 p-3 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              {commentTree.length} thread{commentTree.length !== 1 ? 's' : ''}
            </span>
            <span>
              {comments.length} total comment{comments.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}