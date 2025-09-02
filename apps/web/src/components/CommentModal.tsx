import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { Comment } from '../types/dashboard';
import { useAuth } from '../contexts/AuthContext';
import CommentThread from './CommentThread';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: { text: string; attachments?: File[]; subscribe?: boolean; state?: string; parentId?: string }) => Promise<void>;
  snapshotId: string;
  position?: { x: number; y: number; elementSelector?: string };
  existingComments?: Comment[];
  isSubscribed?: boolean;
  onSubscriptionChange?: (subscribed: boolean) => Promise<void>;
  className?: string;
  replyToComment?: Comment;
  showThread?: boolean;
  isOwner?: boolean;
}

export default function CommentModal({
  isOpen,
  onClose,
  onSubmit,
  snapshotId,
  position,
  existingComments = [],
  isSubscribed = false,
  onSubscriptionChange,
  className = '',
  replyToComment,
  showThread = false,
  isOwner = false
}: CommentModalProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [subscribeToUpdates, setSubscribeToUpdates] = useState(false);
  const [commentState, setCommentState] = useState<'draft' | 'published'>('published');
  const [view, setView] = useState<'form' | 'thread'>(showThread ? 'thread' : 'form');
  const [previewMode, setPreviewMode] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const { user, isAuthenticated } = useAuth();
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [content]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current && !showThread) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, showThread]);

  // Close modal on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      // Submit on Ctrl/Cmd + Enter
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        handleSubmit();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, content]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit({
          text: content.trim(),
          attachments: attachments.length > 0 ? attachments : undefined,
          subscribe: subscribeToUpdates,
          state: commentState,
          parentId: replyToComment?.id
        });
      } else {
        // Default API submission
        const formData = new FormData();
        formData.append('text', content.trim());
        formData.append('state', commentState);
        
        if (replyToComment) {
          formData.append('parentId', replyToComment.id);
        }
        
        if (position) {
          if (position.elementSelector) {
            formData.append('elementSelector', position.elementSelector);
          }
          formData.append('elementCoordinates', JSON.stringify({
            x: position.x,
            y: position.y
          }));
        }
        
        // Add attachments
        attachments.forEach(file => {
          formData.append('attachments', file);
        });

        if (subscribeToUpdates) {
          formData.append('subscribe', 'true');
        }

        await api.post(`/api/snapshots/${snapshotId}/comments`, formData);
        
        // Track analytics for comment creation
        try {
          await api.post('/analytics/track', {
            eventType: replyToComment ? 'comment_replied' : 'comment_created',
            eventData: {
              snapshotId,
              hasAttachments: attachments.length > 0,
              attachmentCount: attachments.length,
              attachmentTypes: attachments.map(f => f.type),
              commentState,
              isReply: !!replyToComment,
              parentCommentId: replyToComment?.id,
              subscribed: subscribeToUpdates,
              hasElementSelector: !!position?.elementSelector,
              contentLength: content.trim().length
            }
          });
        } catch (error) {
          console.error('Failed to track comment analytics:', error);
        }
      }
      
      // Reset form
      setContent('');
      setAttachments([]);
      setSubscribeToUpdates(false);
      setCommentState('published');
      onClose();
    } catch (error) {
      console.error('Failed to create comment:', error);
      alert('Failed to create comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // File handling
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
      'text/plain', 'text/markdown', 'text/csv',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md', 'csv', 'pdf', 'doc', 'docx'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
      return { valid: false, error: 'File type not supported' };
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return { valid: false, error: 'File too large (max 10MB)' };
    }
    
    return { valid: true };
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    
    if (type.startsWith('image/')) {
      return '🖼️';
    } else if (type.includes('pdf')) {
      return '📄';
    } else if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) {
      return '📝';
    } else if (type.includes('text') || name.endsWith('.txt') || name.endsWith('.md')) {
      return '📄';
    } else {
      return '📎';
    }
  };

  // Thread view component
  if (view === 'thread') {
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40" 
          onClick={onClose}
        />
        
        <CommentThread
          snapshotId={snapshotId}
          onClose={onClose}
          isOwner={isOwner}
          comments={existingComments}
        />
      </>
    );
  }

  // Form view
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <div 
            ref={modalRef}
            className={`relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg ${className}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 font-inconsolata">
                  {replyToComment ? `Reply to ${replyToComment.authorName || 'comment'}` : 'Add Comment'}
                </h3>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* View toggle */}
                {existingComments.length > 0 && (
                  <button
                    onClick={() => setView(view === 'form' ? 'thread' : 'form')}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {view === 'form' ? 'Show Thread' : 'Show Form'}
                  </button>
                )}
                
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Reply context */}
              {replyToComment && (
                <div className="p-3 bg-blue-50 border-l-4 border-blue-200 rounded">
                  <div className="flex items-center space-x-2 mb-1">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span className="text-sm font-medium text-blue-700">
                      Replying to {replyToComment.authorName}
                    </span>
                  </div>
                  <p className="text-sm text-blue-800 line-clamp-2">
                    {(replyToComment.text || '').substring(0, 100)}
                    {(replyToComment.text || '').length > 100 ? '...' : ''}
                  </p>
                </div>
              )}

              {/* Position context */}
              {position && position.elementSelector && (
                <div className="p-3 bg-green-50 border-l-4 border-green-200 rounded">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-green-700">
                      Pinned to element at ({position.x}, {position.y})
                    </span>
                  </div>
                </div>
              )}

              {/* Main textarea */}
              <div className={`relative ${dragOver ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
                   onDragOver={handleDragOver}
                   onDragLeave={handleDragLeave}
                   onDrop={handleDrop}>
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={replyToComment ? 'Write your reply...' : position ? 'Comment on this element...' : 'Write your comment...'}
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  maxLength={5000}
                />
                
                {/* Character count */}
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {content.length}/5000
                </div>

                {/* Drag overlay */}
                {dragOver && (
                  <div className="absolute inset-0 bg-blue-50 bg-opacity-75 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <svg className="mx-auto h-12 w-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-blue-600 font-medium">Drop files here</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex items-center space-x-3">
                  {/* File upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv,.pdf,.doc,.docx"
                  />
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                    </svg>
                    Attach
                  </button>

                  {/* Comment state */}
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-700">Status:</label>
                    <select
                      value={commentState}
                      onChange={(e) => setCommentState(e.target.value as 'draft' | 'published')}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>

                  {/* Preview toggle */}
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className={`text-sm px-2 py-1 rounded ${previewMode ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
                  >
                    Preview
                  </button>
                </div>

                {/* Keyboard shortcut hint */}
                <div className="text-xs text-gray-500">
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + Enter to submit
                </div>
              </div>

              {/* Attachments preview */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Attached files:</h4>
                  <div className="space-y-1">
                    {attachments.map((file, index) => {
                      const validation = validateFile(file);
                      return (
                        <div key={index} className={`flex items-center justify-between p-2 rounded border ${
                          validation.valid ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <span className="text-lg">{getFileIcon(file)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                              <div className="flex items-center space-x-2 text-xs">
                                <span className="text-gray-500">{formatFileSize(file.size)}</span>
                                {!validation.valid && (
                                  <span className="text-red-600">{validation.error}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="ml-2 text-red-500 hover:text-red-700 font-bold text-sm"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview */}
              {previewMode && content.trim() && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Preview:</h4>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-gray-700">{content}</p>
                  </div>
                </div>
              )}

              {/* Subscription */}
              {isAuthenticated && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={subscribeToUpdates}
                          onChange={(e) => setSubscribeToUpdates(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Subscribe to notifications</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Get notified when someone replies to your comment or this thread
                      </p>
                    </div>
                  </div>

                  {/* Current subscription status */}
                  {existingComments.length > 0 && (
                    <div className="mt-3 p-2 bg-gray-50 rounded">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <svg className={`w-4 h-4 ${isSubscribed ? 'text-green-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2L3 7v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V7l-7-5z"/>
                          </svg>
                          <span className="text-xs text-gray-600">
                            {isSubscribed ? 'You\'ll receive notifications for new comments' : 'You won\'t receive notifications for new comments'}
                          </span>
                        </div>
                        {onSubscriptionChange && (
                          <button
                            type="button"
                            onClick={() => onSubscriptionChange(!isSubscribed)}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                              isSubscribed 
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || submitting || attachments.some(f => !validateFile(f).valid)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : (replyToComment ? 'Reply' : 'Comment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}