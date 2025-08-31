import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import CommentPin from './CommentPin';
import CommentModeToggle from './CommentModeToggle';
import CommentModal from './CommentModal';
import { Comment } from '../types/dashboard';

interface CommentPinData {
  id: string;
  x: number;
  y: number;
  elementSelector?: string;
  comments: Comment[];
  isVisible: boolean;
  isResolved: boolean;
  lastActivity: number;
}

interface PendingComment {
  x: number;
  y: number;
  elementSelector?: string;
  element?: HTMLElement;
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
  const [commentPins, setCommentPins] = useState<CommentPinData[]>([]);
  const [isCommentMode, setIsCommentMode] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Generate CSS selector for an element
  const generateSelector = useCallback((element: HTMLElement): string => {
    const path: string[] = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      // Add ID if present
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      // Add classes if present
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).slice(0, 2);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }
      
      // Add nth-child if needed for uniqueness
      const siblings = Array.from(current.parentNode?.children || []).filter(el => 
        el.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      current = current.parentElement!;
    }
    
    return path.join(' > ');
  }, []);

  // Check if an element is visible in viewport
  const isElementVisible = useCallback((selector: string): boolean => {
    try {
      const element = document.querySelector(selector);
      if (!element) return false;
      
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const windowWidth = window.innerWidth || document.documentElement.clientWidth;
      
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= windowHeight &&
        rect.right <= windowWidth
      );
    } catch (error) {
      return false;
    }
  }, []);

  // Load comments and create pins
  const loadComments = useCallback(async () => {
    try {
      const response = await api.get(`/api/snapshots/${snapshotId}/comments`);
      const commentsData = response.comments || [];
      setComments(commentsData);
      
      // Group comments by position to create pins
      const pinMap = new Map<string, CommentPinData>();
      
      commentsData.forEach((comment: Comment) => {
        if (comment.elementCoordinates || comment.position) {
          const x = comment.elementCoordinates?.x || comment.position?.x || 0;
          const y = comment.elementCoordinates?.y || comment.position?.y || 0;
          const key = `${Math.round(x / 15) * 15}-${Math.round(y / 15) * 15}`; // Group within 15px
          
          const existing = pinMap.get(key);
          const isVisible = comment.elementSelector ? isElementVisible(comment.elementSelector) : true;
          
          if (existing) {
            existing.comments.push(comment);
            existing.lastActivity = Math.max(existing.lastActivity, comment.createdAt || 0);
            existing.isResolved = existing.isResolved && comment.state === 'resolved';
          } else {
            pinMap.set(key, {
              id: `pin-${key}`,
              x,
              y,
              elementSelector: comment.elementSelector,
              comments: [comment],
              isVisible,
              isResolved: comment.state === 'resolved',
              lastActivity: comment.createdAt || Date.now()
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
  }, [snapshotId, isElementVisible]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Update pin visibility based on their elements
  const updatePinVisibility = useCallback(() => {
    setCommentPins(pins => pins.map(pin => ({
      ...pin,
      isVisible: pin.elementSelector ? isElementVisible(pin.elementSelector) : true
    })));
  }, [isElementVisible]);

  // Update pin visibility on scroll/resize
  useEffect(() => {
    const handleScroll = () => updatePinVisibility();
    const handleResize = () => updatePinVisibility();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [updatePinVisibility]);

  const handleCommentModeChange = (enabled: boolean) => {
    setIsCommentMode(enabled);
    onCommentModeChange?.(enabled);
    if (!enabled) {
      setPendingComment(null);
    }
  };

  const handlePinClick = (pinId: string) => {
    const pin = commentPins.find(p => p.id === pinId);
    if (pin && pin.comments.length > 0) {
      // Open comment modal with existing comments
      setActivePin(pinId);
      setShowCommentModal(true);
    }
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (!isCommentMode) return;
    
    // Avoid triggering on pins or UI elements
    if ((event.target as HTMLElement).closest('.comment-pin, .comment-controls, .comment-modal')) {
      return;
    }

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Get the actual clicked element (beneath the overlay)
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    if (!elementBelow || elementBelow === overlayRef.current) return;
    
    // Generate selector for the clicked element
    const elementSelector = generateSelector(elementBelow as HTMLElement);
    const elementRect = elementBelow.getBoundingClientRect();
    const relativeX = event.clientX - elementRect.left;
    const relativeY = event.clientY - elementRect.top;
    
    // Set up new comment
    setPendingComment({
      x,
      y,
      elementSelector,
      element: elementBelow as HTMLElement
    });
    
    setShowCommentModal(true);
    setIsCommentMode(false); // Exit comment mode after placing
  };

  const handleCommentSubmit = async (commentData: { text: string; attachments?: File[] }) => {
    if (!pendingComment) return;
    
    try {
      const formData = new FormData();
      formData.append('text', commentData.text);
      formData.append('elementSelector', pendingComment.elementSelector || '');
      formData.append('elementCoordinates', JSON.stringify({
        x: pendingComment.x,
        y: pendingComment.y
      }));
      
      if (commentData.attachments) {
        commentData.attachments.forEach(file => {
          formData.append('attachments', file);
        });
      }
      
      await api.post(`/api/snapshots/${snapshotId}/comments`, formData);
      
      // Reload comments to show new pin
      await loadComments();
      
      // Close modal and clear pending
      setShowCommentModal(false);
      setPendingComment(null);
    } catch (error) {
      console.error('Failed to create comment:', error);
      alert('Failed to create comment. Please try again.');
    }
  };

  const handleCloseModal = () => {
    setShowCommentModal(false);
    setPendingComment(null);
    setActivePin(null);
  };

  // Get total comment count for all visible pins
  const totalCommentCount = commentPins.reduce((total, pin) => total + pin.comments.length, 0);
  
  // Get visible pins (only show pins if their elements are visible)
  const visiblePins = showPins ? commentPins.filter(pin => pin.isVisible) : [];

  if (loading) {
    return null;
  }

  return (
    <>
      {/* Comment Mode Toggle */}
      {isInteractive && (
        <CommentModeToggle
          isCommentMode={isCommentMode}
          onCommentModeChange={handleCommentModeChange}
          showPins={showPins}
          onShowPinsChange={setShowPins}
          commentCount={totalCommentCount}
          className="comment-controls"
        />
      )}

      {/* Comment Overlay - Only active in comment mode */}
      {isCommentMode && (
        <div 
          ref={overlayRef}
          className={`absolute inset-0 pointer-events-auto z-30 cursor-crosshair ${className}`}
          onClick={handleOverlayClick}
        >
          {/* Overlay instructions */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="bg-blue-50/90 border border-blue-200 rounded-lg p-3 text-center backdrop-blur-sm">
              <div className="text-sm text-blue-700 font-medium">Comment Mode Active</div>
              <div className="text-xs text-blue-600 mt-1">Click anywhere to add a comment</div>
            </div>
          </div>
        </div>
      )}

      {/* Comment Pins Container - Always present but only shows pins when showPins is true */}
      <div className={`absolute inset-0 pointer-events-none z-30 ${className}`}>
        {/* Comment Pins */}
        {visiblePins.map((pin) => (
          <CommentPin
            key={pin.id}
            id={pin.id}
            x={pin.x}
            y={pin.y}
            comments={pin.comments}
            isResolved={pin.isResolved}
            onClick={handlePinClick}
            className="comment-pin"
          />
        ))}


      </div>
      
      {/* Comment Modal */}
      {showCommentModal && (
        <CommentModal
          isOpen={showCommentModal}
          onClose={handleCloseModal}
          onSubmit={handleCommentSubmit}
          snapshotId={snapshotId}
          existingComments={activePin ? 
            commentPins.find(p => p.id === activePin)?.comments || [] : 
            []
          }
          position={pendingComment ? {
            x: pendingComment.x,
            y: pendingComment.y,
            elementSelector: pendingComment.elementSelector
          } : undefined}
          className="comment-modal"
        />
      )}
    </>
  );
}