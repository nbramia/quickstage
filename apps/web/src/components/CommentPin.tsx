import React, { useState } from 'react';
import { Comment } from '../types/dashboard';

interface CommentPinProps {
  id: string;
  x: number;
  y: number;
  comments: Comment[];
  isResolved: boolean;
  onClick: (pinId: string) => void;
  onHover?: (pinId: string, isHovering: boolean) => void;
  className?: string;
}

export default function CommentPin({ 
  id, 
  x, 
  y, 
  comments, 
  isResolved, 
  onClick, 
  onHover,
  className = '' 
}: CommentPinProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile device
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window && window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const commentCount = comments.length;
  const hasUnresolved = comments.some(c => c.state !== 'resolved');
  
  // Determine pin state and styling
  const pinState = isResolved && !hasUnresolved ? 'resolved' : 'unresolved';
  
  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.(id, true);
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
    onHover?.(id, false);
  };
  
  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(id);
  };
  
  // Get preview text from most recent comment
  const previewText = comments[0]?.text ? 
    comments[0].text.slice(0, 100) + (comments[0].text.length > 100 ? '...' : '') : 
    '';
  
  return (
    <>
      {/* Main Comment Pin */}
      <div
        className={`absolute pointer-events-auto cursor-pointer transform-gpu transition-all duration-200 ${className}`}
        style={{
          left: `${x}px`,
          top: `${y}px`,
          transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1.0)'}`
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        role="button"
        aria-label={`${commentCount} comment${commentCount !== 1 ? 's' : ''} - ${isResolved ? 'Resolved' : 'Unresolved'}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e);
          }
        }}
      >
        <div
          className={`
            relative flex items-center justify-center
            bg-gradient-to-b from-yellow-300 to-amber-400 
            border-2 border-amber-500
            text-amber-900 font-bold text-xs sm:text-sm
            shadow-lg transition-all duration-200
            touch-manipulation select-none
            ${isHovered ? 'shadow-xl scale-110' : 'shadow-lg'}
            ${pinState === 'resolved' 
              ? 'opacity-70' // Dimmed for resolved comments
              : ''
            }
          `}
          style={{
            borderRadius: '12px 12px 12px 2px', // Speech bubble shape
            minWidth: '24px',
            minHeight: '24px',
            padding: '4px 8px'
          }}
        >
          {pinState === 'resolved' ? (
            // Checkmark for resolved comments - smaller and integrated
            <div className="flex items-center space-x-1">
              <svg 
                className="w-3 h-3" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path 
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-bold">
                {commentCount}
              </span>
            </div>
          ) : (
            // Comment count for unresolved
            <span className="font-bold">
              {commentCount > 99 ? '99+' : commentCount}
            </span>
          )}
          
          {/* Subtle glow for unresolved comments */}
          {pinState === 'unresolved' && (
            <div 
              className="absolute inset-0 bg-amber-300 animate-pulse opacity-30 pointer-events-none" 
              style={{ borderRadius: '12px 12px 12px 2px' }}
            />
          )}
        </div>
      </div>

      {/* Hover/Touch Tooltip */}
      {isHovered && previewText && (
        <div
          className="absolute pointer-events-none z-50 transform-gpu transition-opacity duration-200"
          style={{
            left: `${x}px`,
            top: `${y - (isMobile ? 80 : 60)}px`, // Higher positioning on mobile for better visibility
            transform: 'translateX(-50%)',
            maxWidth: isMobile ? '280px' : '320px'
          }}
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">
                {commentCount} comment{commentCount !== 1 ? 's' : ''}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                pinState === 'resolved' ? 'bg-amber-700 text-amber-100' : 'bg-amber-600 text-amber-100'
              }`}>
                {pinState === 'resolved' ? 'Resolved' : 'Open'}
              </span>
            </div>
            {!isMobile && (
              <div className="text-gray-300 line-clamp-3">
                {previewText}
              </div>
            )}
            {isMobile && (
              <div className="text-gray-300 text-xs mt-1">
                Tap to view comments
              </div>
            )}
            
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-2 h-2 bg-gray-900 rotate-45" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}