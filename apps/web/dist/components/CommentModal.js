import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { api } from '../api';
export default function CommentModal({ isOpen, onClose, onSubmit, snapshotId, position, existingComments = [], className = '' }) {
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    if (!isOpen)
        return null;
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim())
            return;
        setSubmitting(true);
        try {
            if (onSubmit) {
                // Use custom submit handler (for contextual comments)
                await onSubmit({
                    text: content.trim(),
                    attachments: attachments.length > 0 ? attachments : undefined
                });
            }
            else {
                // Default API submission (for regular comments)
                const formData = new FormData();
                formData.append('text', content.trim());
                formData.append('state', 'published');
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
                await api.post(`/api/snapshots/${snapshotId}/comments`, formData);
            }
            // Reset form
            setContent('');
            setAttachments([]);
            onClose();
        }
        catch (error) {
            console.error('Failed to create comment:', error);
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleFileSelect = (e) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files);
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOver(false);
    };
    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };
    const getFileIcon = (fileName) => {
        const extension = fileName.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return '🖼️';
            case 'pdf':
                return '📄';
            case 'doc':
            case 'docx':
                return '📝';
            case 'txt':
            case 'md':
                return '📄';
            default:
                return '📎';
        }
    };
    const formatFileSize = (bytes) => {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto \n                    mx-2 sm:mx-0 relative", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b border-gray-200", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: existingComments && existingComments.length > 0 ? 'Comments' : 'Add Comment' }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 transition-colors", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), existingComments && existingComments.length > 0 && (_jsx("div", { className: "border-b border-gray-200 max-h-60 overflow-y-auto", children: _jsx("div", { className: "p-4 space-y-3", children: existingComments.map((comment) => (_jsx("div", { className: "border border-gray-100 rounded-lg p-3", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center space-x-2 mb-1", children: [_jsx("span", { className: "font-medium text-gray-900 text-sm", children: comment.authorName || comment.author || 'Anonymous' }), _jsx("span", { className: "text-xs text-gray-500", children: comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Unknown date' })] }), _jsx("div", { className: "text-sm text-gray-700", children: comment.text }), comment.attachments && comment.attachments.length > 0 && (_jsxs("div", { className: "flex items-center space-x-1 mt-2", children: [_jsx("svg", { className: "w-4 h-4 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" }) }), _jsxs("span", { className: "text-xs text-gray-500", children: [comment.attachments.length, " attachment", comment.attachments.length !== 1 ? 's' : ''] })] }))] }), _jsx("span", { className: `ml-2 px-2 py-1 rounded text-xs font-medium ${comment.state === 'resolved'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-yellow-100 text-yellow-700'}`, children: comment.state === 'resolved' ? 'Resolved' : 'Open' })] }) }, comment.id))) }) })), _jsxs("form", { onSubmit: handleSubmit, className: "p-4 space-y-4", children: [position && (_jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-3", children: _jsxs("div", { className: "text-sm text-blue-700", children: [_jsx("div", { className: "font-medium", children: "Comment Position" }), _jsxs("div", { className: "mt-1", children: ["x: ", position.x, ", y: ", position.y] }), position.elementSelector && (_jsxs("div", { className: "mt-1 text-xs", children: ["Element: ", position.elementSelector] }))] }) })), _jsxs("div", { children: [_jsx("label", { htmlFor: "content", className: "block text-sm font-medium text-gray-700 mb-2", children: "Comment" }), _jsx("textarea", { id: "content", value: content, onChange: (e) => setContent(e.target.value), placeholder: "What would you like to comment about this element?", className: "w-full p-3 border border-gray-300 rounded-lg resize-none h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent", required: true }), _jsxs("div", { className: "text-xs text-gray-500 mt-1", children: [content.length, "/1000 characters"] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Attachments (optional)" }), _jsxs("div", { className: `border-2 border-dashed rounded-lg p-4 text-center transition-colors ${dragOver
                                        ? 'border-blue-400 bg-blue-50'
                                        : 'border-gray-300 hover:border-gray-400'}`, onDrop: handleDrop, onDragOver: handleDragOver, onDragLeave: handleDragLeave, children: [_jsx("input", { type: "file", multiple: true, accept: ".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.md", onChange: handleFileSelect, className: "hidden", id: "file-upload" }), _jsx("label", { htmlFor: "file-upload", className: "cursor-pointer", children: _jsxs("div", { className: "text-gray-600", children: [_jsx("svg", { className: "w-8 h-8 mx-auto mb-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" }) }), _jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "text-blue-500 hover:text-blue-600", children: "Click to upload" }), " or drag and drop"] }), _jsx("div", { className: "text-xs text-gray-500 mt-1", children: "Images, PDFs, Documents up to 10MB" })] }) })] }), attachments.length > 0 && (_jsx("div", { className: "mt-3 space-y-2", children: attachments.map((file, index) => (_jsxs("div", { className: "flex items-center justify-between p-2 bg-gray-50 rounded-lg", children: [_jsxs("div", { className: "flex items-center space-x-2 flex-1 min-w-0", children: [_jsx("span", { className: "text-lg", children: getFileIcon(file.name) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-gray-900 truncate", children: file.name }), _jsx("div", { className: "text-xs text-gray-500", children: formatFileSize(file.size) })] })] }), _jsx("button", { type: "button", onClick: () => removeAttachment(index), className: "text-red-400 hover:text-red-600 ml-2", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }, index))) }))] }), _jsxs("div", { className: "flex justify-end space-x-3 pt-4 border-t border-gray-200", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors", children: "Cancel" }), _jsx("button", { type: "submit", disabled: submitting || !content.trim(), className: "px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: submitting ? (_jsxs("span", { className: "flex items-center", children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-2 h-4 w-4 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Posting..."] })) : ('Post Comment') })] })] })] }) }));
}
