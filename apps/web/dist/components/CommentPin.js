import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from 'react';
export default function CommentPin({ id, x, y, comments, isResolved, onClick, onHover, className = '' }) {
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
    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(id);
    };
    // Get preview text from most recent comment
    const previewText = comments[0]?.text ?
        comments[0].text.slice(0, 100) + (comments[0].text.length > 100 ? '...' : '') :
        '';
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: `absolute pointer-events-auto cursor-pointer transform-gpu transition-all duration-200 ${className}`, style: {
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1.0)'}`
                }, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, onClick: handleClick, role: "button", "aria-label": `${commentCount} comment${commentCount !== 1 ? 's' : ''} - ${isResolved ? 'Resolved' : 'Unresolved'}`, tabIndex: 0, onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick(e);
                    }
                }, children: _jsxs("div", { className: `
            relative w-9 h-9 sm:w-11 sm:h-11 md:w-10 md:h-10 rounded-full border-2 
            flex items-center justify-center text-white font-semibold text-xs sm:text-sm
            shadow-lg transition-all duration-200
            ${pinState === 'resolved'
                        ? 'bg-green-500 border-green-600 hover:bg-green-600 hover:shadow-green-200 active:bg-green-700'
                        : 'bg-red-500 border-red-600 hover:bg-red-600 hover:shadow-red-200 active:bg-red-700'}
            ${isHovered ? 'shadow-xl' : 'shadow-lg'}
            touch-manipulation select-none
          `, children: [pinState === 'resolved' ? (
                        // Checkmark for resolved comments
                        _jsx("svg", { className: "w-4 h-4 sm:w-5 sm:h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2.5, d: "M5 13l4 4L19 7" }) })) : (
                        // Comment count for unresolved
                        _jsx("span", { className: "font-bold", children: commentCount > 99 ? '99+' : commentCount })), pinState === 'unresolved' && (_jsx("div", { className: "absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" }))] }) }), isHovered && previewText && (_jsx("div", { className: "absolute pointer-events-none z-50 transform-gpu transition-opacity duration-200", style: {
                    left: `${x}px`,
                    top: `${y - (isMobile ? 80 : 60)}px`, // Higher positioning on mobile for better visibility
                    transform: 'translateX(-50%)',
                    maxWidth: isMobile ? '280px' : '320px'
                }, children: _jsxs("div", { className: "bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsxs("span", { className: "font-medium", children: [commentCount, " comment", commentCount !== 1 ? 's' : ''] }), _jsx("span", { className: `text-xs px-1.5 py-0.5 rounded ${pinState === 'resolved' ? 'bg-green-600' : 'bg-red-600'}`, children: pinState === 'resolved' ? 'Resolved' : 'Open' })] }), !isMobile && (_jsx("div", { className: "text-gray-300 line-clamp-3", children: previewText })), isMobile && (_jsx("div", { className: "text-gray-300 text-xs mt-1", children: "Tap to view comments" })), _jsx("div", { className: "absolute top-full left-1/2 transform -translate-x-1/2", children: _jsx("div", { className: "w-2 h-2 bg-gray-900 rotate-45" }) })] }) }))] }));
}
