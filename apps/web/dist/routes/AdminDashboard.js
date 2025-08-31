import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, adminApi } from '../api';
import '../fonts.css';
export default function AdminDashboard() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [createUserData, setCreateUserData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'user'
    });
    const [showSuccess, setShowSuccess] = useState(null);
    // Analytics state
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('users');
    // Additional analytics data
    const [userAnalytics, setUserAnalytics] = useState(null);
    const [snapshotAnalytics, setSnapshotAnalytics] = useState(null);
    const [systemAnalytics, setSystemAnalytics] = useState(null);
    const [recentEvents, setRecentEvents] = useState([]);
    const [analyticsTimeframe, setAnalyticsTimeframe] = useState('24h');
    // Sorting state for user table
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    // Sort function
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        }
        else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    // Sort users based on current sort settings
    const sortedUsers = React.useMemo(() => {
        if (!sortField || !users.length)
            return users;
        return [...users].sort((a, b) => {
            let aValue, bValue;
            switch (sortField) {
                case 'name':
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
                    break;
                case 'email':
                    aValue = a.email?.toLowerCase() || '';
                    bValue = b.email?.toLowerCase() || '';
                    break;
                case 'status':
                    aValue = a.status || '';
                    bValue = b.status || '';
                    break;
                case 'plan':
                    aValue = a.plan || '';
                    bValue = b.plan || '';
                    break;
                case 'createdAt':
                    aValue = new Date(a.createdAt || 0).getTime();
                    bValue = new Date(b.createdAt || 0).getTime();
                    break;
                case 'lastLoginAt':
                    aValue = new Date(a.lastLoginAt || 0).getTime();
                    bValue = new Date(b.lastLoginAt || 0).getTime();
                    break;
                case 'totalSnapshots':
                    aValue = a.totalSnapshots || 0;
                    bValue = b.totalSnapshots || 0;
                    break;
                default:
                    return 0;
            }
            if (aValue < bValue)
                return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue)
                return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [users, sortField, sortDirection]);
    // Sortable header component
    const SortableHeader = ({ field, children }) => (_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none", onClick: () => handleSort(field), children: _jsxs("div", { className: "flex items-center space-x-1", children: [_jsx("span", { children: children }), sortField === field && (_jsx("svg", { className: "w-4 h-4", fill: "currentColor", viewBox: "0 0 20 20", children: sortDirection === 'asc' ? (_jsx("path", { d: "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" })) : (_jsx("path", { d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" })) })), sortField !== field && (_jsx("svg", { className: "w-4 h-4 text-gray-300", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" }) }))] }) }));
    // Activity feed filtering
    const [eventTypeFilter, setEventTypeFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [pageFilter, setPageFilter] = useState('all');
    // Time filtering
    const [timeFilterType, setTimeFilterType] = useState('all');
    const [timeFilterBefore, setTimeFilterBefore] = useState('');
    const [timeFilterAfter, setTimeFilterAfter] = useState('');
    const [timeFilterStart, setTimeFilterStart] = useState('');
    const [timeFilterEnd, setTimeFilterEnd] = useState('');
    // Dropdown open states
    const [isEventTypeOpen, setIsEventTypeOpen] = useState(false);
    const [isUserFilterOpen, setIsUserFilterOpen] = useState(false);
    const [isPageFilterOpen, setIsPageFilterOpen] = useState(false);
    const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false);
    // Close all dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const target = event.target;
            if (!target.closest('.custom-dropdown')) {
                setIsEventTypeOpen(false);
                setIsUserFilterOpen(false);
                setIsPageFilterOpen(false);
                setIsTimeFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    // Migration state
    const [migrationStats, setMigrationStats] = useState(null);
    const [migrationLoading, setMigrationLoading] = useState(false);
    const [migrationResult, setMigrationResult] = useState(null);
    // Check if user is superadmin
    if (!user || user.role !== 'superadmin') {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center font-poppins", children: _jsxs("div", { className: "text-center", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900 mb-4 font-inconsolata", children: "Access Denied" }), _jsx("p", { className: "text-gray-600", children: "You don't have permission to access this page." })] }) }));
    }
    useEffect(() => {
        loadUsers();
        loadAnalytics();
        loadMigrationStats();
        // Track page view
        const trackPageView = async () => {
            try {
                await api.post('/analytics/track', {
                    eventType: 'page_view',
                    eventData: { page: 'Admin Dashboard' }
                });
            }
            catch (error) {
                console.error('Failed to track page view:', error);
            }
        };
        trackPageView();
    }, []);
    // Reload analytics when timeframe changes
    useEffect(() => {
        if (analyticsTimeframe) {
            loadAnalytics();
        }
    }, [analyticsTimeframe]);
    const loadUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/admin/users');
            setUsers(response.users);
        }
        catch (error) {
            setError(error.message || 'Failed to load users');
        }
        finally {
            setLoading(false);
        }
    };
    const loadAnalytics = async () => {
        try {
            setAnalyticsLoading(true);
            // Calculate time range based on selected timeframe
            const now = Date.now();
            let startTime;
            switch (analyticsTimeframe) {
                case '24h':
                    startTime = now - (24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startTime = now - (7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startTime = now - (30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startTime = now - (7 * 24 * 60 * 60 * 1000); // Default to 7 days
            }
            // Load comprehensive analytics data with timeframe
            const [statsResponse, usersResponse, snapshotsResponse, eventsResponse] = await Promise.all([
                api.get('/debug/stats'),
                api.get('/debug/users'),
                api.get('/debug/snapshots'),
                api.get(`/debug/analytics/events?limit=500&startTime=${startTime}`)
            ]);
            setAnalytics(statsResponse);
            setUserAnalytics(usersResponse);
            setSnapshotAnalytics(snapshotsResponse);
            setSystemAnalytics(statsResponse);
            // Process recent events from analytics events endpoint
            if (eventsResponse.events) {
                setRecentEvents(eventsResponse.events);
            }
        }
        catch (error) {
            console.error('Failed to load analytics:', error);
        }
        finally {
            setAnalyticsLoading(false);
        }
    };
    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            setError(null);
            await api.post('/admin/users', createUserData);
            setShowSuccess('User created successfully!');
            setShowCreateUser(false);
            setCreateUserData({ name: '', email: '', password: '', role: 'user' });
            loadUsers();
        }
        catch (error) {
            setError(error.message || 'Failed to create user');
        }
    };
    const handleDeactivateUser = async (uid) => {
        if (!confirm('Are you sure you want to deactivate this user?'))
            return;
        try {
            setError(null);
            await api.post(`/admin/users/${uid}/deactivate`);
            setShowSuccess('User deactivated successfully!');
            loadUsers();
        }
        catch (error) {
            setError(error.message || 'Failed to deactivate user');
        }
    };
    const handleActivateUser = async (uid) => {
        try {
            setError(null);
            await api.post(`/admin/users/${uid}/activate`);
            setShowSuccess('User activated successfully!');
            loadUsers();
        }
        catch (error) {
            setError(error.message || 'Failed to activate user');
        }
    };
    const handleDeleteUser = async (uid, userName) => {
        if (!confirm(`⚠️  DANGER: Are you absolutely sure you want to PERMANENTLY DELETE user "${userName}"?\n\nThis will:\n• Remove all their data from the system\n• Delete all their snapshots\n• Delete all their PATs\n• Delete all their comments\n• This action CANNOT be undone!\n\nType "DELETE" to confirm:`)) {
            return;
        }
        const confirmation = prompt('Type "DELETE" to confirm permanent deletion:');
        if (confirmation !== 'DELETE') {
            alert('Deletion cancelled. User data is safe.');
            return;
        }
        try {
            setError(null);
            await adminApi.deleteUser(uid);
            setShowSuccess(`User "${userName}" has been completely deleted from the system!`);
            loadUsers();
        }
        catch (error) {
            setError(error.message || 'Failed to delete user');
        }
    };
    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleDateString();
    };
    const getPlanDisplay = (plan) => {
        switch (plan) {
            case 'pro':
                return 'Pro Monthly';
            case 'free':
                return 'Trial';
            default:
                return plan;
        }
    };
    const getSubscriptionStatusColor = (status) => {
        switch (status) {
            case 'Superadmin':
                return 'text-purple-600 bg-purple-100';
            case 'Pro':
                return 'text-green-600 bg-green-100';
            case 'Free Trial':
                return 'text-blue-600 bg-blue-100';
            case 'Cancelled':
                return 'text-red-600 bg-red-100';
            case 'Past Due':
                return 'text-orange-600 bg-orange-100';
            case 'None':
                return 'text-gray-600 bg-gray-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };
    const getSubscriptionDisplay = (user) => {
        if (user.canAccessPro) {
            return (_jsxs("div", { className: "flex flex-col space-y-1", children: [_jsx("span", { className: `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionStatusColor(user.subscriptionStatus)}`, children: user.subscriptionStatus }), user.trialEndsAt && (_jsxs("span", { className: "text-xs text-gray-500", children: ["Trial ends: ", formatDate(user.trialEndsAt)] })), user.subscriptionStartedAt && (_jsxs("span", { className: "text-xs text-gray-500", children: ["Started: ", formatDate(user.subscriptionStartedAt)] }))] }));
        }
        return (_jsx("span", { className: `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionStatusColor(user.subscriptionStatus)}`, children: user.subscriptionStatus }));
    };
    const getStatusColor = (status) => {
        return status === 'active' ? 'text-green-600' : 'text-red-600';
    };
    // Analytics helper functions
    const formatNumber = (num) => {
        if (num >= 1000000)
            return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000)
            return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };
    const getTimeframeLabel = (timeframe) => {
        const labels = { '24h': 'Last 24 Hours', '7d': 'Last 7 Days', '30d': 'Last 30 Days' };
        return labels[timeframe] || timeframe;
    };
    // Filter events based on current filters
    const filteredEvents = recentEvents.filter(event => {
        // Skip malformed events
        if (!event || !event.type)
            return false;
        // Event type filter
        if (eventTypeFilter !== 'all' && event.type !== eventTypeFilter)
            return false;
        // User filter - handle both email format and direct userId
        if (userFilter !== 'all') {
            if (userFilter.includes('(') && userFilter.includes(')')) {
                // Extract userId from "email (userId)" format
                const userIdMatch = userFilter.match(/\(([^)]+)\)/);
                if (userIdMatch && event.userId !== userIdMatch[1])
                    return false;
            }
            else if (event.userId !== userFilter) {
                return false;
            }
        }
        // Page filter
        if (pageFilter !== 'all' && event.page !== pageFilter)
            return false;
        // Time filtering
        if (timeFilterType !== 'all' && event.timestamp) {
            const eventTime = event.timestamp;
            switch (timeFilterType) {
                case 'before':
                    if (timeFilterBefore && eventTime >= new Date(timeFilterBefore).getTime())
                        return false;
                    break;
                case 'after':
                    if (timeFilterAfter && eventTime <= new Date(timeFilterAfter).getTime())
                        return false;
                    break;
                case 'between':
                    if (timeFilterStart && eventTime < new Date(timeFilterStart).getTime())
                        return false;
                    if (timeFilterEnd && eventTime > new Date(timeFilterEnd).getTime())
                        return false;
                    break;
            }
        }
        return true;
    });
    // Custom dropdown component
    const CustomDropdown = ({ label, value, options, onChange, isOpen, setIsOpen }) => {
        const selectedOption = options.find(opt => opt.value === value);
        return (_jsxs("div", { className: "relative custom-dropdown", children: [_jsxs("button", { type: "button", onClick: () => setIsOpen(!isOpen), className: "inline-flex items-center justify-between w-full px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 min-w-[200px]", children: [_jsx("span", { className: "text-gray-700", children: selectedOption?.label || label }), _jsx("svg", { className: `w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })] }), isOpen && (_jsx("div", { className: "absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5", children: _jsx("div", { className: "py-1 max-h-60 overflow-auto", children: options.map((option) => (_jsx("button", { type: "button", onClick: () => {
                                onChange(option.value);
                                setIsOpen(false);
                            }, className: `w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg ${option.value === value
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-700'}`, children: option.label }, option.value))) }) }))] }));
    };
    // Get event color scheme
    const getEventColor = (eventType) => {
        switch (eventType) {
            // User actions
            case 'user_login':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'user_logout':
                return 'bg-slate-100 text-slate-800 border-slate-200';
            case 'user_registered':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'user_deleted':
                return 'bg-red-100 text-red-800 border-red-200';
            // Snapshot actions
            case 'snapshot_created':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'snapshot_viewed':
                return 'bg-indigo-100 text-indigo-800 border-indigo-200';
            case 'snapshot_downloaded':
                return 'bg-cyan-100 text-cyan-800 border-cyan-200';
            case 'snapshot_deleted':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'snapshot_expired':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            // Page views
            case 'page_view':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            // Comments
            case 'comment_posted':
                return 'bg-teal-100 text-teal-800 border-teal-200';
            case 'comment_deleted':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'comment_updated':
                return 'bg-teal-100 text-teal-800 border-teal-200';
            case 'comment_resolved':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'comments_bulk_resolved':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            // Project management
            case 'project_created':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'project_updated':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'project_deleted':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'project_archived':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'project_unarchived':
                return 'bg-lime-100 text-lime-800 border-lime-200';
            // Review workflows
            case 'review_requested':
                return 'bg-indigo-100 text-indigo-800 border-indigo-200';
            case 'review_submitted':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'review_cancelled':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'review_reminder_sent':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            // Subscription & payments
            case 'subscription_started':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'subscription_cancelled':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'subscription_expired':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'payment_succeeded':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'payment_failed':
                return 'bg-red-100 text-red-800 border-red-200';
            // System events
            case 'migration_completed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'user_migration_completed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'snapshot_migration_completed':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'system_backup':
                return 'bg-violet-100 text-violet-800 border-violet-200';
            case 'system_maintenance':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            // Extension downloads
            case 'extension_downloaded':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'extension_upgraded':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            // Errors & security
            case 'error_occurred':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'unauthorized_access':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'rate_limit_exceeded':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            // Default fallback
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };
    // Generate human-readable event descriptions
    const getEventDescription = (event) => {
        // Safety check for event and event.type
        if (!event || !event.type) {
            return 'Unknown event';
        }
        const baseDescription = event.description;
        if (baseDescription)
            return baseDescription;
        // Generate descriptions based on event type and data
        switch (event.type) {
            case 'page_view':
                return `Viewed page: ${event.page || 'Unknown page'}`;
            case 'user_login':
                return 'User logged in';
            case 'user_logout':
                return 'User logged out';
            case 'user_registered':
                return 'New user registered';
            case 'snapshot_created':
                return 'Snapshot created';
            case 'snapshot_viewed':
                return 'Snapshot viewed';
            case 'snapshot_downloaded':
                return 'Snapshot downloaded';
            case 'comment_posted':
                return 'Comment posted';
            case 'comment_updated':
                return 'Comment updated';
            case 'comment_resolved':
                return 'Comment resolved';
            case 'comments_bulk_resolved':
                return 'Multiple comments resolved';
            case 'project_created':
                return `Project created: ${event.eventData?.projectName || 'Unknown project'}`;
            case 'project_updated':
                return `Project updated: ${event.eventData?.projectName || 'Unknown project'}`;
            case 'project_deleted':
                return `Project deleted: ${event.eventData?.projectName || 'Unknown project'}`;
            case 'project_archived':
                return `Project archived: ${event.eventData?.projectName || 'Unknown project'}`;
            case 'project_unarchived':
                return `Project unarchived: ${event.eventData?.projectName || 'Unknown project'}`;
            case 'review_requested':
                return `Review requested for snapshot: ${event.eventData?.snapshotName || event.eventData?.snapshotId || 'Unknown snapshot'}`;
            case 'review_submitted':
                return `Review submitted for snapshot: ${event.eventData?.snapshotName || event.eventData?.snapshotId || 'Unknown snapshot'}`;
            case 'review_cancelled':
                return `Review cancelled for snapshot: ${event.eventData?.snapshotName || event.eventData?.snapshotId || 'Unknown snapshot'}`;
            case 'review_reminder_sent':
                return `Review reminder sent for snapshot: ${event.eventData?.snapshotName || event.eventData?.snapshotId || 'Unknown snapshot'}`;
            case 'subscription_started':
                return 'Subscription started';
            case 'subscription_cancelled':
                return 'Subscription cancelled';
            case 'payment_succeeded':
                return 'Payment successful';
            case 'payment_failed':
                return 'Payment failed';
            case 'extension_downloaded':
                return `Extension downloaded: ${event.metadata?.version || 'Unknown version'}`;
            case 'extension_upgraded':
                return `Extension upgraded: ${event.metadata?.version || 'Unknown version'}`;
            case 'error_occurred':
                return `Error: ${event.metadata?.error || 'Unknown error'}`;
            case 'unauthorized_access':
                return 'Unauthorized access attempt';
            default:
                // Safe fallback for unknown event types
                return `${event.type.charAt(0).toUpperCase() + event.type.slice(1).replace(/_/g, ' ')}`;
        }
    };
    // Get unique event types, users, and pages for filter options
    const eventTypes = [
        'all',
        // Core user events
        'user_login', 'user_logout', 'user_registered', 'user_deleted',
        // Snapshot events
        'snapshot_created', 'snapshot_viewed', 'snapshot_downloaded', 'snapshot_deleted', 'snapshot_expired',
        // Page views
        'page_view',
        // Comments
        'comment_posted', 'comment_deleted', 'comment_updated', 'comment_resolved', 'comments_bulk_resolved',
        // Project management
        'project_created', 'project_updated', 'project_deleted', 'project_archived', 'project_unarchived',
        // Review workflows
        'review_requested', 'review_submitted', 'review_cancelled', 'review_reminder_sent',
        // Subscription & payments
        'subscription_started', 'subscription_cancelled', 'subscription_expired', 'payment_succeeded', 'payment_failed',
        // System events
        'migration_completed', 'user_migration_completed', 'snapshot_migration_completed', 'system_backup', 'system_maintenance',
        // Extension downloads
        'extension_downloaded', 'extension_upgraded',
        // Errors & security
        'error_occurred', 'unauthorized_access', 'rate_limit_exceeded',
        // Dynamic events from analytics
        ...Array.from(new Set(recentEvents.map(e => e?.type).filter(Boolean)))
    ];
    // Get unique users with their emails for better readability
    const eventUsers = ['all', ...Array.from(new Set(recentEvents.map(e => {
            if (e?.userId && e?.userId !== 'system' && e?.userId !== 'anonymous') {
                return `${e.userEmail || 'Unknown'} (${e.userId})`;
            }
            return e?.userId;
        }).filter(Boolean)))];
    // Get all available pages from actual analytics data
    const getAllPages = () => {
        const eventPages = recentEvents.map(e => e?.page).filter(Boolean);
        const uniquePages = Array.from(new Set(eventPages));
        // Only include 'all' and pages that actually have analytics data
        return ['all', ...uniquePages];
    };
    const eventPages = getAllPages();
    const loadMigrationStats = async () => {
        try {
            const response = await api.get('/debug/migration/stats');
            setMigrationStats(response);
        }
        catch (error) {
            console.error('Failed to load migration stats:', error);
        }
    };
    const runMigration = async (type, dryRun = true) => {
        try {
            setMigrationLoading(true);
            setError(null);
            const endpoint = type === 'full' ? '/debug/migration/run' :
                type === 'users' ? '/debug/migration/users' :
                    '/debug/migration/snapshots';
            const response = await api.post(endpoint, {
                dryRun,
                batchSize: 50,
                skipErrors: true,
                verbose: true
            });
            setMigrationResult(response);
            setShowSuccess(`${type} migration ${dryRun ? 'dry run' : 'completed'}: ${response.result.migrated} migrated, ${response.result.errors} errors`);
            // Refresh stats after migration
            await loadMigrationStats();
        }
        catch (error) {
            setError(error.message || `Failed to run ${type} migration`);
        }
        finally {
            setMigrationLoading(false);
        }
    };
    if (loading) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center font-poppins", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600", children: "Loading users..." })] }) }));
    }
    return (_jsx("div", { className: "min-h-screen bg-gray-50 font-poppins", children: _jsxs("div", { className: "max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8", children: [_jsx("div", { className: "mb-8", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 font-inconsolata", children: "Admin Dashboard" }), _jsx("p", { className: "mt-2 text-gray-600", children: "Manage QuickStage users and accounts" })] }), _jsx("a", { href: "/dashboard", className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors", children: "\u2190 Back to Dashboard" })] }) }), showSuccess && (_jsx("div", { className: "mb-6 bg-green-50 border border-green-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-green-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm font-medium text-green-800", children: showSuccess }) }), _jsx("div", { className: "ml-auto pl-3", children: _jsxs("button", { onClick: () => setShowSuccess(null), className: "inline-flex bg-green-50 rounded-md p-1.5 text-green-500 hover:bg-green-100", children: [_jsx("span", { className: "sr-only", children: "Dismiss" }), _jsx("svg", { className: "h-5 w-5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z", clipRule: "evenodd" }) })] }) })] }) })), error && (_jsx("div", { className: "mb-6 bg-red-50 border border-red-200 rounded-md p-4", children: _jsxs("div", { className: "flex", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx("svg", { className: "h-5 w-5 text-red-400", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }) }), _jsx("div", { className: "ml-3", children: _jsx("p", { className: "text-sm font-medium text-red-800", children: error }) }), _jsx("div", { className: "ml-auto pl-3", children: _jsxs("button", { onClick: () => setError(null), className: "inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100", children: [_jsx("span", { className: "sr-only", children: "Dismiss" }), _jsx("svg", { className: "h-5 w-5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z", clipRule: "evenodd" }) })] }) })] }) })), _jsx("div", { className: "mb-6 border-b border-gray-200", children: _jsxs("nav", { className: "-mb-px flex space-x-8", children: [_jsxs("button", { onClick: () => setActiveTab('users'), className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'users'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: ["Users (", users.length, ")"] }), _jsx("button", { onClick: () => setActiveTab('analytics'), className: `py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: "\uD83D\uDCCA Analytics & System Stats" })] }) }), showCreateUser && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 mb-4 font-inconsolata", children: "Create New User" }), _jsxs("form", { onSubmit: handleCreateUser, children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Username" }), _jsx("input", { type: "text", required: true, value: createUserData.name, onChange: (e) => setCreateUserData({ ...createUserData, name: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Email" }), _jsx("input", { type: "email", required: true, value: createUserData.email, onChange: (e) => setCreateUserData({ ...createUserData, email: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Password" }), _jsx("input", { type: "password", required: true, value: createUserData.password, onChange: (e) => setCreateUserData({ ...createUserData, password: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { className: "mb-6", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Role" }), _jsxs("select", { value: createUserData.role, onChange: (e) => setCreateUserData({ ...createUserData, role: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "user", children: "User" }), _jsx("option", { value: "admin", children: "Admin" })] })] }), _jsxs("div", { className: "flex justify-end space-x-3", children: [_jsx("button", { type: "button", onClick: () => setShowCreateUser(false), className: "px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors", children: "Cancel" }), _jsx("button", { type: "submit", className: "px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors", children: "Create User" })] })] })] }) }) })), activeTab === 'users' ? (
                /* Users Table */
                _jsxs("div", { className: "bg-white shadow overflow-hidden sm:rounded-md", children: [_jsx("div", { className: "px-4 py-5 sm:px-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-lg leading-6 font-medium text-gray-900 font-inconsolata", children: ["Users (", users.length, ")"] }), _jsx("button", { onClick: () => setShowCreateUser(true), className: "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors", children: "Create New User" })] }) }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx(SortableHeader, { field: "name", children: "User" }), _jsx(SortableHeader, { field: "status", children: "Account Status" }), _jsx(SortableHeader, { field: "plan", children: "Subscription" }), _jsx(SortableHeader, { field: "createdAt", children: "First Login" }), _jsx(SortableHeader, { field: "lastLoginAt", children: "Last Login" }), _jsx(SortableHeader, { field: "totalSnapshots", children: "Snapshots" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: sortedUsers.map((user) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: user.name }), _jsx("div", { className: "text-sm text-gray-500", children: user.email }), _jsxs("div", { className: "text-xs text-gray-400", children: ["Role: ", user.role] })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`, children: user.status === 'active' ? 'Active' : 'Deactivated' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: getSubscriptionDisplay(user) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: formatDate(user.createdAt) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: _jsxs("div", { className: "flex flex-col", children: [_jsxs("span", { children: [user.activeSnapshots, "/", user.totalSnapshots] }), user.totalSnapshots > 0 && user.activeSnapshots === 0 && (_jsx("span", { className: "text-xs text-amber-600", title: "Debug: Check snapshot status and expiration", children: "\u26A0\uFE0F All snapshots show as inactive" }))] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsxs("div", { className: "flex flex-col space-y-2", children: [user.status === 'active' ? (_jsx("button", { onClick: () => handleDeactivateUser(user.uid), className: "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors", title: "Temporarily disable user account (reversible)", children: "\u23F8\uFE0F Deactivate" })) : (_jsx("button", { onClick: () => handleActivateUser(user.uid), className: "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 border border-green-300 transition-colors", title: "Re-enable user account", children: "\u25B6\uFE0F Activate" })), user.role !== 'superadmin' && (_jsx("button", { onClick: () => handleDeleteUser(user.uid, user.name), className: "inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors", title: "Permanently delete user and all their data (irreversible)", children: "\uD83D\uDDD1\uFE0F Delete" }))] }) })] }, user.uid))) })] }) })] })) : (
                /* Analytics Content */
                _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white shadow overflow-hidden sm:rounded-lg", children: [_jsxs("div", { className: "px-4 py-5 sm:px-6", children: [_jsx("h3", { className: "text-lg leading-6 font-medium text-gray-900 font-inconsolata", children: "\uD83D\uDE80 System Overview" }), _jsx("p", { className: "mt-1 max-w-2xl text-sm text-gray-500", children: "Real-time system statistics and performance metrics" })] }), _jsx("div", { className: "border-t border-gray-200 px-4 py-5 sm:p-6", children: analyticsLoading ? (_jsxs("div", { className: "text-center py-8", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600", children: "Loading comprehensive analytics..." })] })) : analytics ? (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6", children: [_jsx("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "p-2 bg-blue-500 rounded-lg", children: _jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" }) }) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-blue-600 font-inconsolata", children: "Total Users" }), _jsx("p", { className: "text-2xl font-bold text-blue-900", children: formatNumber(analytics.system?.totalUsers || 0) })] })] }) }), _jsx("div", { className: "bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "p-2 bg-purple-500 rounded-lg", children: _jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6l.586-.586a2 2 0 012.828 0L20 8m-6-6L12.586 1.586a2 2 0 00-2.828 0L6 2m-6-6L1.586 1.586a2 2 0 00-2.828 0L2 2" }) }) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-purple-600 font-inconsolata", children: "Total Snapshots" }), _jsx("p", { className: "text-2xl font-bold text-purple-900", children: formatNumber(analytics.system?.totalSnapshots || 0) })] })] }) }), _jsx("div", { className: "bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "p-2 bg-green-500 rounded-lg", children: _jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-green-600 font-inconsolata", children: "Active Sessions" }), _jsx("p", { className: "text-2xl font-bold text-green-900", children: formatNumber(analytics.system?.activeSessions || 0) })] })] }) }), _jsx("div", { className: "bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "p-2 bg-orange-500 rounded-lg", children: _jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }) }), _jsxs("div", { className: "ml-3", children: [_jsx("p", { className: "text-sm font-medium text-orange-600 font-inconsolata", children: "System Health" }), _jsx("p", { className: "text-2xl font-bold text-orange-900", children: analyticsLoading ? '⏳ Loading...' : analytics ? '🟢 Healthy' : '❌ Error' })] })] }) })] })) : (_jsxs("div", { className: "text-center py-8", children: [_jsx("p", { className: "text-gray-600", children: "No analytics data available" }), _jsx("button", { onClick: loadAnalytics, className: "mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700", children: "Refresh Analytics" })] })) })] }), _jsxs("div", { className: "bg-white shadow overflow-hidden sm:rounded-lg", children: [_jsx("div", { className: "px-4 py-5 sm:px-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg leading-6 font-medium text-gray-900 font-inconsolata", children: "\uD83D\uDCB3 Subscription Analytics" }), _jsx("p", { className: "mt-1 max-w-2xl text-sm text-gray-500", children: "Detailed subscription breakdown and revenue insights" })] }), _jsx("div", { className: "flex space-x-2", children: ['24h', '7d', '30d'].map((timeframe) => (_jsx("button", { onClick: () => setAnalyticsTimeframe(timeframe), className: `px-3 py-1 text-sm font-medium rounded-md transition-colors ${analyticsTimeframe === timeframe
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`, children: getTimeframeLabel(timeframe) }, timeframe))) })] }) }), _jsx("div", { className: "border-t border-gray-200 px-4 py-5 sm:p-6", children: analytics ? (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200", children: [_jsx("h4", { className: "text-sm font-medium text-emerald-900 font-inconsolata mb-3", children: "\uD83D\uDCCA Subscription Status" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-emerald-700", children: "\uD83C\uDD93 Free:" }), _jsx("span", { className: "font-semibold text-emerald-900 text-lg", children: analytics.subscriptions?.free || 0 })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-emerald-700", children: "\uD83E\uDDEA Trial:" }), _jsx("span", { className: "font-semibold text-emerald-900 text-lg", children: analytics.subscriptions?.trial || 0 })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-emerald-700", children: "\u2705 Active:" }), _jsx("span", { className: "font-semibold text-emerald-900 text-lg", children: analytics.subscriptions?.active || 0 })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-emerald-700", children: "\u274C Cancelled:" }), _jsx("span", { className: "font-semibold text-emerald-900 text-lg", children: analytics.subscriptions?.cancelled || 0 })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-emerald-700", children: "\u26A0\uFE0F Past Due:" }), _jsx("span", { className: "font-semibold text-emerald-900 text-lg", children: analytics.subscriptions?.pastDue || 0 })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-emerald-700", children: "\uD83D\uDC51 Superadmin:" }), _jsx("span", { className: "font-semibold text-emerald-900 text-lg", children: analytics.subscriptions?.superadmin || 0 })] })] })] }), _jsxs("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200", children: [_jsx("h4", { className: "text-sm font-medium text-blue-900 font-inconsolata mb-3", children: "\uD83D\uDCB0 Revenue Metrics" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-blue-700", children: "Trial Users:" }), _jsx("span", { className: "font-semibold text-blue-900", children: analytics.subscriptions?.trial || 0 })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-blue-700", children: "Conversion Rate:" }), _jsxs("span", { className: "font-semibold text-blue-900", children: [analytics.subscriptions?.active && analytics.subscriptions?.trial
                                                                                ? Math.round((analytics.subscriptions.active / (analytics.subscriptions.active + analytics.subscriptions.trial)) * 100)
                                                                                : 0, "%"] })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-blue-700", children: "Churn Rate:" }), _jsxs("span", { className: "font-semibold text-blue-900", children: [analytics.subscriptions?.cancelled && analytics.subscriptions?.active
                                                                                ? Math.round((analytics.subscriptions.cancelled / (analytics.subscriptions.active + analytics.subscriptions.cancelled)) * 100)
                                                                                : 0, "%"] })] })] })] }), _jsxs("div", { className: "bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200", children: [_jsx("h4", { className: "text-sm font-medium text-purple-900 font-inconsolata mb-3", children: "\uD83D\uDCC8 Growth Trends" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-purple-700", children: "Total Users:" }), _jsx("span", { className: "font-semibold text-purple-900", children: analytics.system?.totalUsers || 0 })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-purple-700", children: "Active Subscriptions:" }), _jsx("span", { className: "font-semibold text-purple-900", children: analytics.subscriptions?.active || 0 })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm text-purple-700", children: "Trial Users:" }), _jsx("span", { className: "font-semibold text-purple-900", children: analytics.subscriptions?.trial || 0 })] })] })] })] })) : null })] }), _jsxs("div", { className: "bg-white shadow overflow-hidden sm:rounded-lg", children: [_jsxs("div", { className: "px-4 py-5 sm:px-6", children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg leading-6 font-medium text-gray-900 font-inconsolata", children: "\uD83D\uDCCB Recent Activity Feed" }), _jsx("p", { className: "mt-1 max-w-2xl text-sm text-gray-500", children: "Live feed of system events and user activities" })] }), _jsx("button", { onClick: async () => {
                                                        try {
                                                            setLoading(true);
                                                            const now = Date.now();
                                                            let startTime;
                                                            switch (analyticsTimeframe) {
                                                                case '24h':
                                                                    startTime = now - (24 * 60 * 60 * 1000);
                                                                    break;
                                                                case '7d':
                                                                    startTime = now - (7 * 24 * 60 * 60 * 1000);
                                                                    break;
                                                                case '30d':
                                                                    startTime = now - (30 * 24 * 60 * 60 * 1000);
                                                                    break;
                                                                default:
                                                                    startTime = now - (24 * 60 * 60 * 1000); // Default to 24h
                                                            }
                                                            const response = await api.get(`/debug/analytics/events?limit=500&startTime=${startTime}&fullRetrieval=true`);
                                                            const events = response?.events || [];
                                                            setRecentEvents(events);
                                                        }
                                                        catch (error) {
                                                            console.error('Failed to refresh activity feed:', error);
                                                        }
                                                        finally {
                                                            setLoading(false);
                                                        }
                                                    }, disabled: loading, className: "inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-gray-300 border-t-gray-900 rounded-full" }), "Refreshing..."] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { className: "-ml-1 mr-2 h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) }), "Refresh All"] })) })] }), _jsxs("div", { className: "mt-4 space-y-4", children: [_jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(CustomDropdown, { label: "All Event Types", value: eventTypeFilter, options: eventTypes.map(type => ({
                                                                value: type,
                                                                label: type === 'all' ? 'All Event Types' : type
                                                            })), onChange: setEventTypeFilter, isOpen: isEventTypeOpen, setIsOpen: setIsEventTypeOpen }), _jsx(CustomDropdown, { label: "All Users", value: userFilter, options: eventUsers.map(user => ({
                                                                value: user,
                                                                label: user === 'all' ? 'All Users' : user
                                                            })), onChange: setUserFilter, isOpen: isUserFilterOpen, setIsOpen: setIsUserFilterOpen }), _jsx(CustomDropdown, { label: "All Pages", value: pageFilter, options: eventPages.map(page => ({
                                                                value: page,
                                                                label: page === 'all' ? 'All Pages' : page
                                                            })), onChange: setPageFilter, isOpen: isPageFilterOpen, setIsOpen: setIsPageFilterOpen })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx(CustomDropdown, { label: "All Time", value: timeFilterType, options: [
                                                                { value: 'all', label: 'All Time' },
                                                                { value: 'before', label: 'Before' },
                                                                { value: 'after', label: 'After' },
                                                                { value: 'between', label: 'Between' }
                                                            ], onChange: (value) => setTimeFilterType(value), isOpen: isTimeFilterOpen, setIsOpen: setIsTimeFilterOpen }), timeFilterType === 'before' && (_jsx("input", { type: "datetime-local", value: timeFilterBefore, onChange: (e) => setTimeFilterBefore(e.target.value), className: "px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200", placeholder: "Select date and time" })), timeFilterType === 'after' && (_jsx("input", { type: "datetime-local", value: timeFilterAfter, onChange: (e) => setTimeFilterAfter(e.target.value), className: "px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200", placeholder: "Select date and time" })), timeFilterType === 'between' && (_jsxs(_Fragment, { children: [_jsx("input", { type: "datetime-local", value: timeFilterStart, onChange: (e) => setTimeFilterStart(e.target.value), className: "px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200", placeholder: "Start date and time" }), _jsx("span", { className: "text-sm text-gray-500 font-medium", children: "to" }), _jsx("input", { type: "datetime-local", value: timeFilterEnd, onChange: (e) => setTimeFilterEnd(e.target.value), className: "px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200", placeholder: "End date and time" })] }))] })] })] }), _jsx("div", { className: "border-t border-gray-200 px-4 py-5 sm:p-6", children: filteredEvents.length > 0 ? (_jsx("div", { className: "space-y-3 max-h-96 overflow-y-auto", children: filteredEvents.map((event, index) => (_jsxs("div", { className: "flex items-center space-x-3 p-3 bg-gray-50 rounded-lg", children: [_jsx("div", { className: `px-2 py-1 rounded-full text-xs font-medium border ${getEventColor(event.type)}`, children: event.type }), _jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm text-gray-900 font-medium", children: getEventDescription(event) }), event.userId && event.userId !== 'system' && event.userId !== 'anonymous' && (_jsxs("div", { className: "mt-1 flex items-center space-x-4 text-xs text-gray-500", children: [_jsxs("span", { children: ["User: ", event.userName || 'Unknown'] }), _jsxs("span", { children: ["ID: ", event.userId] }), event.userEmail && _jsxs("span", { children: ["Email: ", event.userEmail] })] }))] }), _jsx("div", { className: "text-xs text-gray-500 ml-4", children: new Date(event.timestamp).toLocaleString() })] }) })] }, index))) })) : (_jsxs("div", { className: "text-center py-8", children: [_jsx("p", { className: "text-gray-600", children: recentEvents.length === 0 ? 'No recent events available' : 'No events match the current filters' }), _jsx("button", { onClick: loadAnalytics, className: "mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700", children: "Refresh Events" })] })) })] }), _jsxs("div", { className: "bg-white shadow overflow-hidden sm:rounded-lg", children: [_jsxs("div", { className: "px-4 py-5 sm:px-6", children: [_jsx("h3", { className: "text-lg leading-6 font-medium text-gray-900 font-inconsolata", children: "\uD83D\uDD04 Data Migration System" }), _jsx("p", { className: "mt-1 max-w-2xl text-sm text-gray-500", children: "Migrate legacy user and snapshot data to new schema" })] }), _jsx("div", { className: "border-t border-gray-200 px-4 py-5 sm:p-6", children: migrationStats ? (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200", children: [_jsx("h4", { className: "text-sm font-medium text-blue-900 font-inconsolata mb-3", children: "\uD83D\uDCCA Migration Status" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm text-blue-700 mb-2", children: "Users" }), _jsxs("div", { className: "text-2xl font-bold text-blue-900", children: [migrationStats.stats.migratedUsers, "/", migrationStats.stats.totalUsers] }), _jsxs("div", { className: "text-xs text-blue-600", children: [migrationStats.stats.legacyUsers, " legacy users remaining"] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm text-blue-700 mb-2", children: "Snapshots" }), _jsxs("div", { className: "text-2xl font-bold text-blue-900", children: [migrationStats.stats.migratedSnapshots, "/", migrationStats.stats.totalSnapshots] }), _jsxs("div", { className: "text-xs text-blue-600", children: [migrationStats.stats.legacySnapshots, " legacy snapshots remaining"] })] })] }), _jsxs("div", { className: "mt-4", children: [_jsxs("div", { className: "flex justify-between text-sm text-blue-700 mb-1", children: [_jsx("span", { children: "Overall Progress" }), _jsxs("span", { children: [migrationStats.summary.migrationProgress, "%"] })] }), _jsx("div", { className: "w-full bg-blue-200 rounded-full h-2", children: _jsx("div", { className: "bg-blue-600 h-2 rounded-full transition-all duration-300", style: { width: `${migrationStats.summary.migrationProgress}%` } }) })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("button", { onClick: () => runMigration('users', true), disabled: migrationLoading, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 transition-colors", children: [migrationLoading ? '⏳' : '👥', " Test User Migration"] }), _jsxs("button", { onClick: () => runMigration('snapshots', true), disabled: migrationLoading, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 transition-colors", children: [migrationLoading ? '⏳' : '📸', " Test Snapshot Migration"] }), _jsxs("button", { onClick: () => runMigration('full', true), disabled: migrationLoading, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50 transition-colors", children: [migrationLoading ? '⏳' : '🚀', " Test Full Migration"] }), _jsxs("button", { onClick: () => {
                                                            if (confirm('⚠️  FINAL CONFIRMATION: This will run the ACTUAL migration and update all legacy data to the new schema. This action cannot be undone. Are you absolutely sure?')) {
                                                                if (confirm('🚨 LAST CHANCE: This will permanently modify your database. Type "MIGRATE" to confirm:')) {
                                                                    const confirmation = prompt('Type "MIGRATE" to confirm actual migration:');
                                                                    if (confirmation === 'MIGRATE') {
                                                                        runMigration('full', false);
                                                                    }
                                                                    else {
                                                                        alert('Migration cancelled. Data is safe.');
                                                                    }
                                                                }
                                                            }
                                                        }, disabled: migrationLoading, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50 transition-colors font-bold", children: [migrationLoading ? '⏳' : '🔥', " RUN ACTUAL MIGRATION"] })] }), migrationResult && (_jsxs("div", { className: "bg-gray-50 rounded-lg p-4 border border-gray-200", children: [_jsx("h4", { className: "text-sm font-medium text-gray-900 font-inconsolata mb-3", children: "\uD83D\uDCCB Migration Results" }), _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Migrated:" }), _jsx("span", { className: "font-semibold text-green-600", children: migrationResult.result.migrated })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Errors:" }), _jsx("span", { className: "font-semibold text-red-600", children: migrationResult.result.errors })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Duration:" }), _jsxs("span", { className: "font-semibold text-gray-900", children: [migrationResult.result.duration, "ms"] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Success:" }), _jsx("span", { className: `font-semibold ${migrationResult.result.success ? 'text-green-600' : 'text-red-600'}`, children: migrationResult.result.success ? '✅ Yes' : '❌ No' })] })] })] }))] })) : (_jsxs("div", { className: "text-center py-8", children: [_jsx("p", { className: "text-gray-600", children: "Loading migration statistics..." }), _jsx("button", { onClick: loadMigrationStats, className: "mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700", children: "Refresh Migration Stats" })] })) })] }), _jsxs("div", { className: "bg-white shadow overflow-hidden sm:rounded-lg", children: [_jsxs("div", { className: "px-4 py-5 sm:px-6", children: [_jsx("h3", { className: "text-lg leading-6 font-medium text-gray-900 font-inconsolata", children: "\uD83D\uDE80 Quick Actions & Debug Tools" }), _jsx("p", { className: "mt-1 max-w-2xl text-sm text-gray-500", children: "Direct access to system tools and data export" })] }), _jsx("div", { className: "border-t border-gray-200 px-4 py-5 sm:p-6", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx("button", { onClick: async () => {
                                                    try {
                                                        const response = await api.get('/debug/stats');
                                                        const newWindow = window.open('', '_blank');
                                                        if (newWindow) {
                                                            newWindow.document.write(`
                            <html>
                              <head><title>Raw Stats API</title></head>
                              <body>
                                <h1>Raw Stats API Response</h1>
                                <pre>${JSON.stringify(response, null, 2)}</pre>
                              </body>
                            </html>
                          `);
                                                        }
                                                    }
                                                    catch (error) {
                                                        alert('Failed to fetch stats: ' + error);
                                                    }
                                                }, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors", children: "\uD83D\uDCCA Raw Stats API" }), _jsx("button", { onClick: async () => {
                                                    try {
                                                        const response = await api.get('/debug/analytics/events?limit=500');
                                                        const newWindow = window.open('', '_blank');
                                                        if (newWindow) {
                                                            newWindow.document.write(`
                            <html>
                              <head><title>Analytics Events</title></head>
                              <body>
                                <h1>Analytics Events</h1>
                                <pre>${JSON.stringify(response, null, 2)}</pre>
                              </body>
                            </html>
                          `);
                                                        }
                                                    }
                                                    catch (error) {
                                                        alert('Failed to fetch analytics events: ' + error);
                                                    }
                                                }, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors", children: "\uD83D\uDCCA Analytics Events" }), _jsx("button", { onClick: async () => {
                                                    try {
                                                        const response = await api.get('/debug/health');
                                                        const newWindow = window.open('', '_blank');
                                                        if (newWindow) {
                                                            newWindow.document.write(`
                            <html>
                              <head><title>System Health</title></head>
                              <body>
                                <h1>System Health</h1>
                                <pre>${JSON.stringify(response, null, 2)}</pre>
                              </body>
                            </html>
                          `);
                                                        }
                                                    }
                                                    catch (error) {
                                                        alert('Failed to fetch system health: ' + error);
                                                    }
                                                }, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors", children: "\uD83C\uDFE5 System Health" }), _jsx("button", { onClick: loadAnalytics, className: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 transition-colors", children: "\uD83D\uDD04 Refresh All Data" })] }) })] })] }))] }) }));
}
