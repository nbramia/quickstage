import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
export default function CommentThread({ snapshotId, commentId, onClose, isOwner = false }) {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyContent, setReplyContent] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
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
        }
        catch (error) {
            console.error('Failed to load comments:', error);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadComments();
    }, [snapshotId, commentId]);
    const handleReply = async (parentId) => {
        if (!replyContent.trim())
            return;
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
        }
        catch (error) {
            console.error('Failed to post reply:', error);
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleResolve = async (commentId) => {
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
    const handleReopen = async (commentId) => {
        try {
            await api.put(`/snapshots/${snapshotId}/comments/${commentId}`, {
                status: 'published'
            });
            await loadComments();
        }
        catch (error) {
            console.error('Failed to reopen comment:', error);
        }
    };
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        else if (diffDays === 1) {
            return 'Yesterday';
        }
        else if (diffDays < 7) {
            return `${diffDays} days ago`;
        }
        else {
            return date.toLocaleDateString();
        }
    };
    const getFileIcon = (fileType) => {
        if (fileType.startsWith('image/'))
            return '🖼️';
        if (fileType === 'application/pdf')
            return '📄';
        if (fileType.includes('word'))
            return '📝';
        if (fileType.includes('text'))
            return '📄';
        return '📎';
    };
    const formatFileSize = (bytes) => {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0)
            return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };
    if (loading) {
        return (_jsx("div", { className: "fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex items-center justify-center", children: _jsx("div", { className: "text-gray-500", children: "Loading comments..." }) }));
    }
    const mainComment = comments.find(c => !c.parentId);
    const replies = comments.filter(c => c.parentId);
    return (_jsxs("div", { className: "fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-gray-200", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Comment Thread" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 transition-colors", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: comments.length === 0 ? (_jsx("div", { className: "text-center text-gray-500 py-8", children: "No comments found" })) : (_jsxs("div", { className: "space-y-4", children: [mainComment && (_jsx(CommentItem, { comment: mainComment, onReply: () => setReplyingTo(mainComment.id), onResolve: handleResolve, onReopen: handleReopen, isOwner: isOwner, currentUserId: user?.uid })), replies.length > 0 && (_jsx("div", { className: "ml-6 space-y-4 border-l-2 border-gray-200 pl-4", children: replies.map(reply => (_jsx(CommentItem, { comment: reply, onReply: () => setReplyingTo(reply.parentId || mainComment?.id || null), onResolve: handleResolve, onReopen: handleReopen, isOwner: isOwner, currentUserId: user?.uid, isReply: true }, reply.id))) }))] })) }), replyingTo && (_jsx("div", { className: "border-t border-gray-200 p-4", children: _jsxs("div", { className: "space-y-3", children: [_jsx("textarea", { value: replyContent, onChange: (e) => setReplyContent(e.target.value), placeholder: "Write a reply...", className: "w-full p-3 border border-gray-300 rounded-lg resize-none h-20 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" }), _jsxs("div", { className: "flex justify-end space-x-2", children: [_jsx("button", { onClick: () => {
                                        setReplyingTo(null);
                                        setReplyContent('');
                                    }, className: "px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors", children: "Cancel" }), _jsx("button", { onClick: () => replyingTo && handleReply(replyingTo), disabled: submitting || !replyContent.trim(), className: "px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: submitting ? 'Posting...' : 'Reply' })] })] }) }))] }));
}
function CommentItem({ comment, onReply, onResolve, onReopen, isOwner, currentUserId, isReply = false }) {
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        else if (diffDays === 1) {
            return 'Yesterday';
        }
        else if (diffDays < 7) {
            return `${diffDays} days ago`;
        }
        else {
            return date.toLocaleDateString();
        }
    };
    const getFileIcon = (fileType) => {
        if (fileType.startsWith('image/'))
            return '🖼️';
        if (fileType === 'application/pdf')
            return '📄';
        if (fileType.includes('word'))
            return '📝';
        if (fileType.includes('text'))
            return '📄';
        return '📎';
    };
    const formatFileSize = (bytes) => {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0)
            return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };
    const isResolved = comment.status === 'resolved';
    const canResolve = isOwner || comment.userId === currentUserId;
    return (_jsxs("div", { className: `${isResolved ? 'opacity-75' : ''}`, children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center", children: _jsx("span", { className: "text-xs font-medium text-gray-700", children: comment.userName?.charAt(0).toUpperCase() || '?' }) }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: comment.userName || 'Anonymous' }), _jsx("div", { className: "text-xs text-gray-500", children: formatDate(comment.createdAt) })] })] }), isResolved && (_jsx("span", { className: "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800", children: "\u2713 Resolved" }))] }), comment.elementText && !isReply && (_jsxs("div", { className: "mb-3 p-2 bg-blue-50 border-l-4 border-blue-200 rounded", children: [_jsx("div", { className: "text-xs text-blue-600 font-medium", children: "Referenced Element:" }), _jsxs("div", { className: "text-sm text-blue-800 mt-1", children: ["\"", comment.elementText.substring(0, 100), comment.elementText.length > 100 ? '...' : '', "\""] }), comment.position && (_jsxs("div", { className: "text-xs text-blue-500 mt-1", children: ["Position: (", comment.position.x, ", ", comment.position.y, ")"] }))] })), _jsx("div", { className: "text-sm text-gray-800 mb-3 whitespace-pre-wrap", children: comment.content }), comment.attachments && comment.attachments.length > 0 && (_jsx("div", { className: "mb-3 space-y-2", children: comment.attachments.map((attachment) => (_jsxs("div", { className: "flex items-center space-x-2 p-2 bg-gray-50 rounded-lg", children: [_jsx("span", { className: "text-lg", children: getFileIcon(attachment.fileType) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("a", { href: attachment.url, target: "_blank", rel: "noopener noreferrer", className: "text-sm font-medium text-blue-600 hover:text-blue-800 truncate block", children: attachment.fileName }), _jsx("div", { className: "text-xs text-gray-500", children: formatFileSize(attachment.fileSize) })] })] }, attachment.id))) })), _jsxs("div", { className: "flex items-center space-x-4", children: [!isResolved && (_jsx("button", { onClick: onReply, className: "text-xs text-gray-500 hover:text-gray-700 transition-colors", children: "Reply" })), canResolve && !isResolved && (_jsx("button", { onClick: () => onResolve(comment.id), className: "text-xs text-green-600 hover:text-green-800 transition-colors", children: "Resolve" })), canResolve && isResolved && (_jsx("button", { onClick: () => onReopen(comment.id), className: "text-xs text-blue-600 hover:text-blue-800 transition-colors", children: "Reopen" }))] })] }));
}
