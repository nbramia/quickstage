import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
export default function CommentSystem({ snapshotId, isOwner = false, className = '' }) {
    const [comments, setComments] = useState([]);
    const [commentBubbles, setCommentBubbles] = useState([]);
    const [isCommentMode, setIsCommentMode] = useState(false);
    const [selectedComment, setSelectedComment] = useState(null);
    const [showCommentPanel, setShowCommentPanel] = useState(false);
    const [newCommentPosition, setNewCommentPosition] = useState(null);
    const [loading, setLoading] = useState(true);
    const iframeRef = useRef(null);
    const overlayRef = useRef(null);
    // Load comments from API
    const loadComments = useCallback(async () => {
        try {
            const response = await api.get(`/snapshots/${snapshotId}/comments`);
            const commentsData = response.comments || [];
            setComments(commentsData);
            // Create comment bubbles from comments
            const bubbles = [];
            commentsData.forEach((comment) => {
                if (comment.position && comment.status !== 'archived') {
                    const existingBubble = bubbles.find(b => Math.abs(b.x - comment.position.x) < 20 &&
                        Math.abs(b.y - comment.position.y) < 20);
                    if (existingBubble) {
                        existingBubble.count++;
                        if (comment.status === 'resolved') {
                            existingBubble.resolved = true;
                        }
                    }
                    else {
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
        }
        catch (error) {
            console.error('Failed to load comments:', error);
        }
        finally {
            setLoading(false);
        }
    }, [snapshotId]);
    useEffect(() => {
        loadComments();
    }, [loadComments]);
    // Handle element click for creating comments
    const handleElementClick = useCallback((event) => {
        if (!isCommentMode)
            return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.target.getBoundingClientRect();
        const iframeRect = iframeRef.current?.getBoundingClientRect();
        if (iframeRect) {
            setNewCommentPosition({
                x: rect.left - iframeRect.left + rect.width / 2,
                y: rect.top - iframeRect.top + rect.height / 2,
                elementId: event.target.id || undefined
            });
            setShowCommentPanel(true);
        }
    }, [isCommentMode]);
    // Add event listeners to iframe content
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe)
            return;
        const handleIframeLoad = () => {
            const iframeDoc = iframe.contentDocument;
            if (iframeDoc) {
                // Add click listeners to all interactive elements
                const elements = iframeDoc.querySelectorAll('*');
                elements.forEach(el => {
                    el.addEventListener('click', handleElementClick);
                });
            }
        };
        iframe.addEventListener('load', handleIframeLoad);
        return () => {
            iframe.removeEventListener('load', handleIframeLoad);
        };
    }, [handleElementClick]);
    // Create new comment
    const createComment = async (content, attachments) => {
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
        }
        catch (error) {
            console.error('Failed to create comment:', error);
        }
    };
    // Reply to comment
    const replyToComment = async (parentId, content, attachments) => {
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
        }
        catch (error) {
            console.error('Failed to reply to comment:', error);
        }
    };
    // Resolve comment
    const resolveComment = async (commentId) => {
        try {
            await api.put(`/snapshots/${snapshotId}/comments/${commentId}`, {
                status: 'resolved'
            });
            await loadComments();
        }
        catch (error) {
            console.error('Failed to resolve comment:', error);
        }
    };
    // Handle bubble click
    const handleBubbleClick = (bubble) => {
        const relatedComments = comments.filter(comment => comment.position &&
            Math.abs(comment.position.x - bubble.x) < 20 &&
            Math.abs(comment.position.y - bubble.y) < 20);
        if (relatedComments.length > 0) {
            setSelectedComment(relatedComments[0] || null);
            setShowCommentPanel(true);
        }
    };
    if (loading) {
        return _jsx("div", { className: "flex items-center justify-center p-4", children: "Loading comments..." });
    }
    return (_jsxs("div", { className: `comment-system relative ${className}`, children: [_jsx("div", { className: "fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-2", children: _jsx("button", { onClick: () => setIsCommentMode(!isCommentMode), className: `px-4 py-2 rounded-lg font-medium transition-colors ${isCommentMode
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: isCommentMode ? 'Exit Comment Mode' : 'Add Comments' }) }), _jsxs("div", { ref: overlayRef, className: "absolute inset-0 pointer-events-none z-10", style: { pointerEvents: isCommentMode ? 'auto' : 'none' }, children: [commentBubbles.map((bubble) => (_jsx("div", { className: `absolute w-8 h-8 rounded-full cursor-pointer pointer-events-auto transition-all hover:scale-110 ${bubble.resolved
                            ? 'bg-green-500 border-2 border-green-600'
                            : 'bg-blue-500 border-2 border-blue-600'}`, style: {
                            left: `${bubble.x - 16}px`,
                            top: `${bubble.y - 16}px`,
                        }, onClick: () => handleBubbleClick(bubble), children: _jsx("div", { className: "flex items-center justify-center w-full h-full", children: _jsx("span", { className: "text-xs font-bold text-white", children: bubble.count }) }) }, bubble.id))), newCommentPosition && (_jsx("div", { className: "absolute w-4 h-4 bg-yellow-400 border-2 border-yellow-500 rounded-full", style: {
                            left: `${newCommentPosition.x - 8}px`,
                            top: `${newCommentPosition.y - 8}px`,
                        } }))] }), showCommentPanel && (_jsx(CommentPanel, { comment: selectedComment, comments: comments.filter(c => selectedComment ?
                    (c.id === selectedComment.id || c.parentId === selectedComment.id) :
                    false), onClose: () => {
                    setShowCommentPanel(false);
                    setSelectedComment(null);
                    setNewCommentPosition(null);
                }, onCreateComment: createComment, onReply: replyToComment, onResolve: resolveComment, isOwner: isOwner }))] }));
}
function CommentPanel({ comment, comments, onClose, onCreateComment, onReply, onResolve, isOwner }) {
    const [newCommentText, setNewCommentText] = useState('');
    const [replyText, setReplyText] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const handleCreateComment = async () => {
        if (!newCommentText.trim())
            return;
        setSubmitting(true);
        try {
            await onCreateComment(newCommentText, attachments);
            setNewCommentText('');
            setAttachments([]);
        }
        catch (error) {
            console.error('Failed to create comment:', error);
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleReply = async (parentId) => {
        if (!replyText.trim())
            return;
        setSubmitting(true);
        try {
            await onReply(parentId, replyText);
            setReplyText('');
        }
        catch (error) {
            console.error('Failed to reply:', error);
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleFileSelect = (e) => {
        if (e.target.files) {
            setAttachments(Array.from(e.target.files));
        }
    };
    return (_jsxs("div", { className: "fixed inset-y-0 right-0 w-96 bg-white shadow-lg z-50 overflow-y-auto", children: [_jsx("div", { className: "p-4 border-b border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold", children: comment ? 'Comment Thread' : 'New Comment' }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600", children: "\u00D7" })] }) }), _jsxs("div", { className: "p-4 space-y-4", children: [!comment && (_jsxs("div", { className: "space-y-3", children: [_jsx("textarea", { value: newCommentText, onChange: (e) => setNewCommentText(e.target.value), placeholder: "Add your comment...", className: "w-full p-3 border border-gray-300 rounded-lg resize-none h-24" }), _jsx("input", { type: "file", multiple: true, accept: ".jpg,.jpeg,.png,.txt,.md,.doc,.docx,.pdf", onChange: handleFileSelect, className: "text-sm" }), attachments.length > 0 && (_jsxs("div", { className: "text-sm text-gray-600", children: [attachments.length, " file(s) selected"] })), _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-gray-600 hover:text-gray-800", children: "Cancel" }), _jsx("button", { onClick: handleCreateComment, disabled: submitting || !newCommentText.trim(), className: "px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50", children: submitting ? 'Posting...' : 'Post Comment' })] })] })), comment && comments.map((c) => (_jsxs("div", { className: "border-b border-gray-100 pb-4", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: c.userName || 'Anonymous' }), _jsx("div", { className: "text-xs text-gray-500", children: new Date(c.createdAt).toLocaleString() }), _jsx("div", { className: "mt-2 text-sm text-gray-700", children: c.content }), c.attachments && c.attachments.length > 0 && (_jsx("div", { className: "mt-2 space-y-1", children: c.attachments.map((attachment) => (_jsx("div", { className: "text-xs", children: _jsxs("a", { href: attachment.url, target: "_blank", rel: "noopener noreferrer", className: "text-blue-500 hover:text-blue-700", children: ["\uD83D\uDCCE ", attachment.fileName] }) }, attachment.id))) }))] }), (isOwner || c.status !== 'resolved') && (_jsxs("div", { className: "flex space-x-2 ml-2", children: [c.status !== 'resolved' && (_jsx("button", { onClick: () => onResolve(c.id), className: "text-xs bg-green-100 text-green-700 px-2 py-1 rounded", children: "Resolve" })), c.status === 'resolved' && (_jsx("span", { className: "text-xs bg-green-100 text-green-700 px-2 py-1 rounded", children: "\u2713 Resolved" }))] }))] }), c.status !== 'resolved' && (_jsxs("div", { className: "mt-3 pl-4 border-l-2 border-gray-200", children: [_jsx("textarea", { value: replyText, onChange: (e) => setReplyText(e.target.value), placeholder: "Reply to this comment...", className: "w-full p-2 text-sm border border-gray-300 rounded resize-none h-16" }), _jsx("div", { className: "flex justify-end mt-2", children: _jsx("button", { onClick: () => handleReply(c.id), disabled: submitting || !replyText.trim(), className: "px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50", children: submitting ? 'Replying...' : 'Reply' }) })] }))] }, c.id)))] })] }));
}
