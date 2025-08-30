import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

interface Comment {
  id: string;
  snapshotId: string;
  userId: string;
  userName?: string;
  content: string;
  elementSelector?: string;
  elementText?: string;
  position?: {
    x: number;
    y: number;
    elementId?: string;
  };
  parentId?: string;
  status: 'draft' | 'published' | 'resolved' | 'archived';
  attachments?: CommentAttachment[];
  replies?: Comment[];
  createdAt: number;
  updatedAt?: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

interface CommentAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
}

interface CommentBubble {
  id: string;
  x: number;
  y: number;
  count: number;
  resolved: boolean;
}

interface CommentSystemProps {
  snapshotId: string;
  isOwner?: boolean;
  className?: string;
}

export default function CommentSystem({ snapshotId, isOwner = false, className = '' }: CommentSystemProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBubbles, setCommentBubbles] = useState<CommentBubble[]>([]);
  const [isCommentMode, setIsCommentMode] = useState(false);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [newCommentPosition, setNewCommentPosition] = useState<{ x: number; y: number; elementId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Load comments from API
  const loadComments = useCallback(async () => {
    try {
      const response = await api.get(`/snapshots/${snapshotId}/comments`);
      const commentsData = response.comments || [];
      setComments(commentsData);
      
      // Create comment bubbles from comments
      const bubbles: CommentBubble[] = [];
      commentsData.forEach((comment: Comment) => {
        if (comment.position && comment.status !== 'archived') {
          const existingBubble = bubbles.find(b => 
            Math.abs(b.x - comment.position!.x) < 20 && 
            Math.abs(b.y - comment.position!.y) < 20
          );
          
          if (existingBubble) {
            existingBubble.count++;
            if (comment.status === 'resolved') {
              existingBubble.resolved = true;
            }
          } else {
            bubbles.push({
              id: comment.id,
              x: comment.position.x,
              y: comment.position.y,
              count: 1,
              resolved: comment.status === 'resolved'
            });
          }
        }
      });
      
      setCommentBubbles(bubbles);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  }, [snapshotId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Handle element click for creating comments
  const handleElementClick = useCallback((event: MouseEvent) => {
    if (!isCommentMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const iframeRect = iframeRef.current?.getBoundingClientRect();
    
    if (iframeRect) {
      setNewCommentPosition({
        x: rect.left - iframeRect.left + rect.width / 2,
        y: rect.top - iframeRect.top + rect.height / 2,
        elementId: (event.target as HTMLElement).id || undefined
      });
      setShowCommentPanel(true);
    }
  }, [isCommentMode]);

  // Add event listeners to iframe content
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleIframeLoad = () => {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc) {
        // Add click listeners to all interactive elements
        const elements = iframeDoc.querySelectorAll('*');
        elements.forEach(el => {
          el.addEventListener('click', handleElementClick as any);
        });
      }
    };

    iframe.addEventListener('load', handleIframeLoad);
    return () => {
      iframe.removeEventListener('load', handleIframeLoad);
    };
  }, [handleElementClick]);

  // Create new comment
  const createComment = async (content: string, attachments?: File[]) => {
    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('status', 'published');
      
      if (newCommentPosition) {
        formData.append('position', JSON.stringify(newCommentPosition));
        if (newCommentPosition.elementId) {
          formData.append('elementId', newCommentPosition.elementId);
        }
      }
      
      if (attachments) {
        attachments.forEach(file => {
          formData.append('attachments', file);
        });
      }

      await api.post(`/snapshots/${snapshotId}/comments`, formData);
      
      // Reload comments
      await loadComments();
      
      // Reset state
      setNewCommentPosition(null);
      setShowCommentPanel(false);
      setIsCommentMode(false);
      
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  // Reply to comment
  const replyToComment = async (parentId: string, content: string, attachments?: File[]) => {
    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('parentId', parentId);
      formData.append('status', 'published');
      
      if (attachments) {
        attachments.forEach(file => {
          formData.append('attachments', file);
        });
      }

      await api.post(`/snapshots/${snapshotId}/comments`, formData);
      await loadComments();
      
    } catch (error) {
      console.error('Failed to reply to comment:', error);
    }
  };

  // Resolve comment
  const resolveComment = async (commentId: string) => {
    try {
      await api.put(`/snapshots/${snapshotId}/comments/${commentId}`, {
        status: 'resolved'
      });
      await loadComments();
    } catch (error) {
      console.error('Failed to resolve comment:', error);
    }
  };

  // Handle bubble click
  const handleBubbleClick = (bubble: CommentBubble) => {
    const relatedComments = comments.filter(comment => 
      comment.position && 
      Math.abs(comment.position.x - bubble.x) < 20 && 
      Math.abs(comment.position.y - bubble.y) < 20
    );
    
    if (relatedComments.length > 0) {
      setSelectedComment(relatedComments[0] || null);
      setShowCommentPanel(true);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-4">Loading comments...</div>;
  }

  return (
    <div className={`comment-system relative ${className}`}>
      {/* Comment Mode Toggle */}
      <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-2">
        <button
          onClick={() => setIsCommentMode(!isCommentMode)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isCommentMode 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isCommentMode ? 'Exit Comment Mode' : 'Add Comments'}
        </button>
      </div>

      {/* Iframe Overlay for Comment Bubbles */}
      <div 
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none z-10"
        style={{ pointerEvents: isCommentMode ? 'auto' : 'none' }}
      >
        {commentBubbles.map((bubble) => (
          <div
            key={bubble.id}
            className={`absolute w-8 h-8 rounded-full cursor-pointer pointer-events-auto transition-all hover:scale-110 ${
              bubble.resolved 
                ? 'bg-green-500 border-2 border-green-600' 
                : 'bg-blue-500 border-2 border-blue-600'
            }`}
            style={{
              left: `${bubble.x - 16}px`,
              top: `${bubble.y - 16}px`,
            }}
            onClick={() => handleBubbleClick(bubble)}
          >
            <div className="flex items-center justify-center w-full h-full">
              <span className="text-xs font-bold text-white">
                {bubble.count}
              </span>
            </div>
          </div>
        ))}
        
        {/* New Comment Position Indicator */}
        {newCommentPosition && (
          <div
            className="absolute w-4 h-4 bg-yellow-400 border-2 border-yellow-500 rounded-full"
            style={{
              left: `${newCommentPosition.x - 8}px`,
              top: `${newCommentPosition.y - 8}px`,
            }}
          />
        )}
      </div>

      {/* Comment Panel */}
      {showCommentPanel && (
        <CommentPanel
          comment={selectedComment}
          comments={comments.filter(c => 
            selectedComment ? 
              (c.id === selectedComment.id || c.parentId === selectedComment.id) :
              false
          )}
          onClose={() => {
            setShowCommentPanel(false);
            setSelectedComment(null);
            setNewCommentPosition(null);
          }}
          onCreateComment={createComment}
          onReply={replyToComment}
          onResolve={resolveComment}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}

// Comment Panel Component
interface CommentPanelProps {
  comment?: Comment | null;
  comments: Comment[];
  onClose: () => void;
  onCreateComment: (content: string, attachments?: File[]) => Promise<void>;
  onReply: (parentId: string, content: string, attachments?: File[]) => Promise<void>;
  onResolve: (commentId: string) => Promise<void>;
  isOwner: boolean;
}

function CommentPanel({ 
  comment, 
  comments, 
  onClose, 
  onCreateComment, 
  onReply, 
  onResolve,
  isOwner 
}: CommentPanelProps) {
  const [newCommentText, setNewCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateComment = async () => {
    if (!newCommentText.trim()) return;
    
    setSubmitting(true);
    try {
      await onCreateComment(newCommentText, attachments);
      setNewCommentText('');
      setAttachments([]);
    } catch (error) {
      console.error('Failed to create comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    
    setSubmitting(true);
    try {
      await onReply(parentId, replyText);
      setReplyText('');
    } catch (error) {
      console.error('Failed to reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-lg z-50 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {comment ? 'Comment Thread' : 'New Comment'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* New Comment Form */}
        {!comment && (
          <div className="space-y-3">
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Add your comment..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24"
            />
            
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.txt,.md,.doc,.docx,.pdf"
              onChange={handleFileSelect}
              className="text-sm"
            />
            
            {attachments.length > 0 && (
              <div className="text-sm text-gray-600">
                {attachments.length} file(s) selected
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateComment}
                disabled={submitting || !newCommentText.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        )}

        {/* Existing Comments */}
        {comment && comments.map((c) => (
          <div key={c.id} className="border-b border-gray-100 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {c.userName || 'Anonymous'}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(c.createdAt).toLocaleString()}
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  {c.content}
                </div>
                
                {c.attachments && c.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {c.attachments.map((attachment) => (
                      <div key={attachment.id} className="text-xs">
                        <a 
                          href={attachment.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          📎 {attachment.fileName}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {(isOwner || c.status !== 'resolved') && (
                <div className="flex space-x-2 ml-2">
                  {c.status !== 'resolved' && (
                    <button
                      onClick={() => onResolve(c.id)}
                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
                    >
                      Resolve
                    </button>
                  )}
                  {c.status === 'resolved' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      ✓ Resolved
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Reply Section */}
            {c.status !== 'resolved' && (
              <div className="mt-3 pl-4 border-l-2 border-gray-200">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply to this comment..."
                  className="w-full p-2 text-sm border border-gray-300 rounded resize-none h-16"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleReply(c.id)}
                    disabled={submitting || !replyText.trim()}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {submitting ? 'Replying...' : 'Reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}