import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
export default function Dashboard() {
    const { user, logout } = useAuth();
    const [snapshots, setSnapshots] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        loadSnapshots();
    }, []);
    const loadSnapshots = async () => {
        try {
            const response = await api.get('/snapshots/list');
            setSnapshots(response.data.snapshots || []);
        }
        catch (err) {
            setError('Failed to load snapshots');
            console.error(err);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleLogout = () => {
        logout();
    };
    const handleExtendSnapshot = async (snapshotId) => {
        try {
            await api.post(`/snapshots/${snapshotId}/extend`, { days: 7 });
            // Reload snapshots to get updated expiry dates
            loadSnapshots();
        }
        catch (err) {
            setError('Failed to extend snapshot');
            console.error(err);
        }
    };
    const handleExpireSnapshot = async (snapshotId) => {
        try {
            await api.post(`/snapshots/${snapshotId}/expire`);
            // Reload snapshots to get updated list
            loadSnapshots();
        }
        catch (err) {
            setError('Failed to expire snapshot');
            console.error(err);
        }
    };
    const handleRotatePassword = async (snapshotId) => {
        try {
            const response = await api.post(`/snapshots/${snapshotId}/rotate-password`);
            // Show the new password to the user
            alert(`New password: ${response.password}`);
        }
        catch (err) {
            setError('Failed to rotate password');
            console.error(err);
        }
    };
    const handleCopyUrl = async (snapshotId) => {
        try {
            const url = `${window.location.origin}/s/${snapshotId}`;
            await navigator.clipboard.writeText(url);
            // Show a brief success message
            setError(''); // Clear any existing errors
            // You could add a success state here if you want
        }
        catch (err) {
            setError('Failed to copy URL');
            console.error(err);
        }
    };
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };
    const getDaysUntilExpiry = (expiryString) => {
        const expiry = new Date(expiryString);
        const now = new Date();
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };
    const getExpiryColor = (days) => {
        if (days <= 1)
            return 'text-red-600';
        if (days <= 3)
            return 'text-orange-600';
        return 'text-green-600';
    };
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600", children: "Loading your snapshots..." })] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("header", { className: "bg-white shadow-sm border-b", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between items-center h-16", children: [_jsx("div", { className: "flex items-center", children: _jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "QuickStage" }) }), _jsxs("nav", { className: "flex items-center space-x-8", children: [_jsx(Link, { to: "/dashboard", className: "text-blue-600 border-b-2 border-blue-600 px-3 py-2 text-sm font-medium", children: "Dashboard" }), _jsx(Link, { to: "/settings", className: "text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium", children: "Settings" }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("div", { className: "text-sm text-gray-700", children: [_jsx("span", { className: "font-medium", children: user?.plan === 'pro' ? 'Pro' : 'Free' }), _jsx("span", { className: "text-gray-500 ml-2", children: "Plan" })] }), _jsx("button", { onClick: handleLogout, className: "text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-gray-400 transition-colors", children: "Sign Out" })] })] })] }) }) }), _jsxs("main", { className: "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8", children: [_jsx("div", { className: "px-4 sm:px-0 mb-8", children: _jsx("div", { className: "bg-white rounded-lg shadow p-6", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900 mb-2", children: "Welcome back!" }), _jsx("p", { className: "text-gray-600", children: "Manage your staged snapshots and create new ones from VS Code." }), user && (_jsxs("p", { className: "text-sm text-gray-500 mt-2", children: ["User ID: ", user.uid.slice(0, 8), "... \u2022 Member since ", new Date(user.createdAt).toLocaleDateString()] }))] }), user?.plan === 'free' && (_jsx(Link, { to: "/settings", className: "bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Go Pro" }))] }) }) }), _jsx("div", { className: "px-4 sm:px-0", children: _jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsxs("h3", { className: "text-lg font-medium text-gray-900", children: ["Your Snapshots (", snapshots.length, ")"] }) }), error && (_jsx("div", { className: "px-6 py-4", children: _jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg", children: error }) })), snapshots.length === 0 ? (_jsxs("div", { className: "px-6 py-12 text-center", children: [_jsx("div", { className: "text-gray-400 mb-4", children: _jsx("svg", { className: "mx-auto h-12 w-12", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }) }), _jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "No snapshots yet" }), _jsx("p", { className: "text-gray-500 mb-4", children: "Use the QuickStage extension in VS Code to create your first snapshot." }), _jsxs("div", { className: "text-sm text-gray-400", children: [_jsx("p", { children: "1. Install the QuickStage extension" }), _jsx("p", { children: "2. Open your project in VS Code" }), _jsx("p", { children: "3. Click \"QuickStage: Stage\" in the command palette" })] })] })) : (_jsx("div", { className: "overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Snapshot" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Created" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Expires" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Views" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Password" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: snapshots.map((snapshot) => {
                                                    const daysUntilExpiry = getDaysUntilExpiry(snapshot.expiresAt);
                                                    const expiryColor = getExpiryColor(daysUntilExpiry);
                                                    return (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: snapshot.name }), _jsxs("div", { className: "text-sm text-gray-500", children: ["ID: ", snapshot.id] })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: formatDate(snapshot.createdAt) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: `text-sm ${expiryColor}`, children: daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : 'Expired' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: snapshot.viewCount }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${snapshot.isPublic
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'bg-gray-100 text-gray-800'}`, children: snapshot.isPublic ? 'Public' : 'Private' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: snapshot.password ? (_jsx("code", { className: "bg-gray-100 px-2 py-1 rounded text-xs", children: snapshot.password })) : (_jsx("span", { className: "text-gray-500", children: "No password" })) }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: [_jsx("a", { href: `/s/${snapshot.id}`, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-900 mr-2", children: "View" }), _jsx("button", { onClick: () => handleCopyUrl(snapshot.id), className: "text-green-600 hover:text-green-900 mr-2", children: "Copy URL" }), _jsx("button", { onClick: () => handleExtendSnapshot(snapshot.id), className: "text-gray-600 hover:text-gray-900 mr-2", children: "Extend" }), _jsx("button", { onClick: () => handleExpireSnapshot(snapshot.id), className: "text-red-600 hover:text-red-900 mr-2", children: "Expire" }), _jsx("button", { onClick: () => handleRotatePassword(snapshot.id), className: "text-purple-600 hover:text-purple-900", children: "New Password" })] })] }, snapshot.id));
                                                }) })] }) }))] }) })] })] }));
}
