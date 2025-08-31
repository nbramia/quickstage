import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import '../fonts.css';
export function Viewer() {
    const navigate = useNavigate();
    const [snapshot, setSnapshot] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [password, setPassword] = useState('');
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const { id: snapshotId } = useParams();
    useEffect(() => {
        if (!snapshotId) {
            setError('No snapshot ID provided');
            setLoading(false);
            return;
        }
        fetchSnapshot();
    }, [snapshotId]);
    useEffect(() => {
        if (snapshot && !snapshot.password) {
            fetchComments();
        }
    }, [snapshot]);
    // Check for password in URL query parameters
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const passwordParam = urlParams.get('p');
        if (passwordParam) {
            setPassword(decodeURIComponent(passwordParam));
            // If we have a password in the URL, try to submit it automatically
            if (passwordParam && snapshotId) {
                // Small delay to ensure the component is fully mounted
                setTimeout(() => {
                    handlePasswordSubmitWithPassword(decodeURIComponent(passwordParam));
                }, 100);
            }
        }
    }, [snapshotId]);
    const fetchSnapshot = async () => {
        try {
            setError(null);
            const response = await api.get(`/snapshots/${snapshotId}`);
            setSnapshot(response.snapshot);
            if (response.snapshot.files.length > 0) {
                setSelectedFile(response.snapshot.files[0].name);
            }
        }
        catch (error) {
            if (error.message.includes('401')) {
                setShowPasswordForm(true);
            }
            else {
                console.error('Failed to fetch snapshot:', error);
                setError('Failed to fetch snapshot');
            }
        }
        finally {
            setLoading(false);
        }
    };
    const fetchComments = async () => {
        try {
            const response = await api.get(`/comments?id=${snapshotId}`);
            setComments(response.comments || []);
        }
        catch (error) {
            console.error('Failed to fetch comments:', error);
        }
    };
    const handlePasswordSubmit = async () => {
        try {
            setError(null);
            // Gate cookie is set by this non-API endpoint
            const res = await fetch(`/s/${snapshotId}/gate`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (!res.ok)
                throw new Error(res.status.toString());
            setShowPasswordForm(false);
            // Refresh snapshot details (now accessible) and comments
            await fetchSnapshot();
            fetchComments();
        }
        catch (error) {
            console.error('Password verification failed:', error);
            setError(error.message || 'Invalid password');
        }
    };
    const handlePasswordSubmitWithPassword = async (passwordToUse) => {
        try {
            setError(null);
            // Gate cookie is set by this non-API endpoint
            const res = await fetch(`/s/${snapshotId}/gate`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: passwordToUse })
            });
            if (!res.ok)
                throw new Error(res.status.toString());
            setShowPasswordForm(false);
            // Refresh snapshot details (now accessible) and comments
            await fetchSnapshot();
            fetchComments();
        }
        catch (error) {
            console.error('Password verification failed:', error);
            setError(error.message || 'Invalid password');
        }
    };
    const handleCommentSubmit = async () => {
        if (!newComment.trim() || !turnstileToken)
            return;
        try {
            setSubmittingComment(true);
            setError(null);
            await api.post('/comments', {
                snapshotId: snapshotId,
                text: newComment,
                turnstileToken
            });
            setNewComment('');
            setTurnstileToken(null);
            // Reset Turnstile widget
            if (window.turnstile) {
                window.turnstile.reset();
            }
            // Fetch updated comments
            fetchComments();
        }
        catch (error) {
            console.error('Failed to post comment:', error);
            setError(error.message || 'Failed to post comment');
        }
        finally {
            setSubmittingComment(false);
        }
    };
    const handleTurnstileSuccess = (token) => {
        setTurnstileToken(token);
    };
    const formatFileSize = (bytes) => {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };
    if (loading) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center font-poppins", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600", children: "Loading snapshot..." })] }) }));
    }
    if (error && !showPasswordForm) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center px-6 font-poppins", children: _jsx("div", { className: "max-w-md w-full", children: _jsxs("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg", children: [_jsx("h2", { className: "text-lg font-semibold mb-2 font-inconsolata", children: "Error" }), _jsx("p", { className: "mb-4", children: error }), _jsx("button", { onClick: () => navigate('/'), className: "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Back to Dashboard" })] }) }) }));
    }
    if (showPasswordForm) {
        return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-6 font-poppins", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2 font-inconsolata", children: "Password Protected" }), _jsx("p", { className: "text-gray-600", children: "This snapshot is password protected. Please enter the password to continue." })] }), _jsxs("div", { className: "bg-white rounded-2xl shadow-lg p-8", children: [error && (_jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6", children: error })), _jsx("div", { className: "mb-6", children: _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Enter password", className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent", onKeyPress: (e) => e.key === 'Enter' && handlePasswordSubmit() }) }), _jsx("button", { onClick: handlePasswordSubmit, className: "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors w-full", children: "View Snapshot" })] })] }) }));
    }
    if (!snapshot) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center font-poppins", children: _jsxs("div", { className: "text-center", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-4 font-inconsolata", children: "Snapshot Not Found" }), _jsx("p", { className: "text-gray-600 mb-6", children: "The requested snapshot could not be found." }), _jsx("button", { onClick: () => navigate('/'), className: "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Back to Dashboard" })] }) }));
    }
    const currentFile = snapshot.files.find(f => f.name === selectedFile);
    return (_jsxs("div", { className: "min-h-screen bg-gray-50 font-poppins", children: [_jsx("header", { className: "bg-white shadow-sm border-b", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between items-center h-16", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-xl font-bold text-gray-900 font-inconsolata", children: ["Snapshot: ", snapshot.id] }), _jsxs("div", { className: "text-sm text-gray-500", children: ["Created: ", formatDate(snapshot.createdAt), " | Expires: ", formatDate(snapshot.expiresAt), " | Size: ", formatFileSize(snapshot.totalBytes)] })] }), _jsx("nav", { children: _jsx("button", { onClick: () => navigate('/'), className: "text-gray-600 hover:text-gray-700 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-gray-400 transition-colors", children: "Dashboard" }) })] }) }) }), _jsx("main", { className: "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-12 gap-6", children: [_jsx("div", { className: "lg:col-span-3", children: _jsxs("div", { className: "bg-white rounded-lg shadow p-4", children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900 mb-4 font-inconsolata", children: ["Files (", snapshot.files.length, ")"] }), _jsx("div", { className: "space-y-2", children: snapshot.files.map((file) => (_jsxs("button", { onClick: () => setSelectedFile(file.name), className: `w-full text-left p-3 rounded-lg border transition-colors ${selectedFile === file.name
                                                ? 'bg-blue-50 border-blue-200 text-blue-900'
                                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`, children: [_jsx("div", { className: "font-medium text-sm", children: file.name }), _jsxs("div", { className: "text-xs text-gray-500 mt-1", children: [formatFileSize(file.size), " \u2022 ", file.type] })] }, file.name))) })] }) }), _jsx("div", { className: "lg:col-span-6", children: _jsxs("div", { className: "bg-white rounded-lg shadow p-2 min-h-[600px]", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2 border-b", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 font-inconsolata", children: "Preview" }), _jsx("a", { href: `https://quickstage.tech/s/${snapshotId}/index.html`, target: "_blank", rel: "noreferrer", className: "text-sm text-blue-600 hover:underline", children: "Open in new tab" })] }), _jsx("iframe", { src: `https://quickstage.tech/s/${snapshotId}/index.html`, className: "w-full h-[70vh] border-0", title: "Snapshot Preview" }, snapshotId)] }) }), _jsx("div", { className: "lg:col-span-3", children: _jsxs("div", { className: "bg-white rounded-lg shadow p-4", children: [_jsxs("h3", { className: "text-lg font-medium text-gray-900 mb-4 font-inconsolata", children: ["Comments (", comments.length, ")"] }), _jsxs("div", { className: "mb-6", children: [_jsx("textarea", { value: newComment, onChange: (e) => setNewComment(e.target.value), placeholder: "Add a comment...", className: "w-full min-h-[80px] p-3 border border-gray-300 rounded-lg resize-vertical font-inherit text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" }), _jsx("div", { className: "cf-turnstile", "data-sitekey": "1x00000000000000000000AA", "data-callback": handleTurnstileSuccess }), _jsx("button", { onClick: handleCommentSubmit, disabled: !newComment.trim() || !turnstileToken || submittingComment, className: `w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors ${!newComment.trim() || !turnstileToken || submittingComment
                                                    ? 'bg-gray-400 text-white cursor-not-allowed'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'}`, children: submittingComment ? 'Posting...' : 'Post Comment' })] }), _jsx("div", { className: "space-y-3", children: comments.length === 0 ? (_jsx("div", { className: "text-center text-gray-500 text-sm py-4", children: "No comments yet. Be the first to comment!" })) : (comments.map((comment) => (_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-3 mb-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("span", { className: "font-medium text-gray-900 text-sm", children: comment.author }), _jsx("span", { className: "text-xs text-gray-500", children: formatDate(comment.createdAt) })] }), comment.file && comment.line && (_jsxs("div", { className: "inline-block text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-2", children: [comment.file, ":", comment.line] })), _jsx("div", { className: "text-gray-700 text-sm mt-2", children: comment.text })] }, comment.id)))) })] }) })] }) })] }));
}
