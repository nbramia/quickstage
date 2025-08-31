import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
export default function CommentModeToggle({ isCommentMode, onCommentModeChange, showPins, onShowPinsChange, commentCount, className = '' }) {
    const [isExpanded, setIsExpanded] = useState(false);
    // Auto-collapse after interaction
    useEffect(() => {
        if (isExpanded && !isCommentMode) {
            const timer = setTimeout(() => setIsExpanded(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isExpanded, isCommentMode]);
    const toggleCommentMode = () => {
        const newMode = !isCommentMode;
        onCommentModeChange(newMode);
        // If entering comment mode, also show pins by default
        if (newMode && !showPins) {
            onShowPinsChange(true);
        }
    };
    return (_jsxs("div", { className: `fixed top-4 right-4 z-40 ${className}`, children: [isCommentMode && (_jsx("div", { className: "sm:hidden fixed inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-none -z-10" })), _jsxs("div", { className: "flex items-center space-x-2", children: [commentCount > 0 && (_jsxs("button", { onClick: () => onShowPinsChange(!showPins), className: `
              flex items-center space-x-2 px-3 py-2.5 sm:py-2 rounded-lg font-medium text-sm
              transition-all duration-200 shadow-lg backdrop-blur-sm
              min-h-[44px] sm:min-h-0 touch-manipulation
              ${showPins
                            ? 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 shadow-blue-200'
                            : 'bg-white/90 text-gray-700 hover:bg-white active:bg-gray-50 border border-gray-200 shadow-gray-200'}
            `, title: showPins ? 'Hide comment pins' : 'Show comment pins', "aria-label": `${showPins ? 'Hide' : 'Show'} comment pins on page`, children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: showPins
                                        ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                        : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" }) }), _jsx("span", { className: "hidden sm:inline", children: showPins ? 'Hide Pins' : 'Show Pins' }), _jsx("span", { className: "bg-white/20 px-1.5 py-0.5 rounded text-xs", children: commentCount })] })), _jsxs("button", { onClick: toggleCommentMode, className: `
            flex items-center space-x-2 px-4 py-2.5 sm:py-2 rounded-lg font-medium text-sm
            transition-all duration-200 shadow-lg backdrop-blur-sm
            min-h-[44px] sm:min-h-0 touch-manipulation
            ${isCommentMode
                            ? 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-red-200'
                            : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 shadow-blue-200'}
          `, title: isCommentMode ? 'Exit comment mode' : 'Add comments to this page', "aria-label": isCommentMode ? 'Exit comment mode' : 'Enter comment mode', children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: isCommentMode
                                        ? "M6 18L18 6M6 6l12 12"
                                        : "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }) }), _jsx("span", { children: isCommentMode ? 'Exit' : 'Comment' })] })] }), isCommentMode && (_jsx("div", { className: "mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-lg animate-in slide-in-from-top duration-200", children: _jsxs("div", { className: "flex items-start space-x-2", children: [_jsx("svg", { className: "w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-blue-900", children: "Comment Mode Active" }), _jsx("p", { className: "text-xs text-blue-700 mt-1", children: "Click anywhere on the page to add a comment at that location" })] })] }) })), isCommentMode && (_jsx("style", { dangerouslySetInnerHTML: {
                    __html: `
            * {
              cursor: crosshair !important;
            }
            .comment-pin,
            .comment-controls,
            .comment-modal {
              cursor: default !important;
            }
          `
                } }))] }));
}
