import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import ProjectSidebar from '../components/ProjectSidebar';
import SnapshotTable from '../components/SnapshotTable';
import DashboardWidgets from '../components/DashboardWidgets';
import BulkOperations from '../components/BulkOperations';
import '../fonts.css';
export default function Dashboard() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, logout, refreshUser } = useAuth();
    // State
    const [projects, setProjects] = useState([]);
    const [snapshots, setSnapshots] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState();
    const [selectedSnapshots, setSelectedSnapshots] = useState(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showSuccessMessage, setShowSuccessMessage] = useState('');
    const [showErrorMessage, setShowErrorMessage] = useState('');
    const [isLoadingBilling, setIsLoadingBilling] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    // Handle post-checkout URL parameters and refresh user data
    useEffect(() => {
        const trialParam = searchParams.get('trial');
        const billingParam = searchParams.get('billing');
        const successParam = searchParams.get('success');
        if (trialParam === 'started' || billingParam === 'success' || successParam === 'true') {
            console.log('Post-checkout detected, refreshing user data...');
            refreshUser?.();
            setSearchParams({});
            if (trialParam === 'started') {
                setShowSuccessMessage('Welcome to your Pro trial! You now have access to all Pro features.');
            }
            else if (billingParam === 'success' || successParam === 'true') {
                setShowSuccessMessage('Subscription activated! You now have full access to Pro features.');
            }
            setTimeout(() => setShowSuccessMessage(''), 5000);
        }
    }, [searchParams, refreshUser, setSearchParams]);
    useEffect(() => {
        loadData();
    }, []);
    // Track analytics
    useEffect(() => {
        const trackPageView = async () => {
            try {
                await api.post('/analytics/track', {
                    eventType: 'page_view',
                    eventData: { page: 'Dashboard' }
                });
            }
            catch (error) {
                console.error('Failed to track page view:', error);
            }
        };
        trackPageView();
    }, []);
    const loadData = async () => {
        setIsLoading(true);
        try {
            const [snapshotsResponse, projectsResponse] = await Promise.all([
                api.get('/api/snapshots/list'),
                api.get('/api/projects')
            ]);
            setSnapshots(snapshotsResponse.snapshots || []);
            setProjects(projectsResponse.projects || []);
        }
        catch (err) {
            setError('Failed to load data');
            console.error(err);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleExtendSnapshot = async (snapshotId) => {
        try {
            await api.post(`/api/snapshots/${snapshotId}/extend`);
            loadData(); // Refresh data
            showSuccess('Snapshot extended successfully');
        }
        catch (error) {
            showError('Failed to extend snapshot');
        }
    };
    // Filter snapshots by selected project
    const filteredSnapshots = selectedProjectId
        ? snapshots.filter(s => s.projectId === selectedProjectId)
        : snapshots;
    // Bulk selection handlers
    const handleToggleSelect = (snapshotId) => {
        const newSelected = new Set(selectedSnapshots);
        if (newSelected.has(snapshotId)) {
            newSelected.delete(snapshotId);
        }
        else {
            newSelected.add(snapshotId);
        }
        setSelectedSnapshots(newSelected);
    };
    const handleSelectAll = (selected) => {
        if (selected) {
            setSelectedSnapshots(new Set(filteredSnapshots.map(s => s.id)));
        }
        else {
            setSelectedSnapshots(new Set());
        }
    };
    const handleClearSelection = () => {
        setSelectedSnapshots(new Set());
    };
    // Helper functions
    const showSuccess = (message) => {
        setShowSuccessMessage(message);
        setTimeout(() => setShowSuccessMessage(''), 3000);
    };
    const showError = (message) => {
        setShowErrorMessage(message);
        setTimeout(() => setShowErrorMessage(''), 3000);
    };
    const handleUpgradeToPro = () => {
        navigate('/pricing?mode=trial');
    };
    const handleManageBilling = async () => {
        try {
            setIsLoadingBilling(true);
            const response = await api.post('/billing/portal');
            if (response.url) {
                window.location.href = response.url;
            }
        }
        catch (error) {
            showError(error.message || 'Failed to open billing portal');
        }
        finally {
            setIsLoadingBilling(false);
        }
    };
    const getSubscriptionStatus = () => {
        return user?.subscriptionDisplay || 'Pro';
    };
    const getSubscriptionStatusColor = (status) => {
        switch (status) {
            case 'Pro': return 'text-green-600 bg-green-100';
            case 'Pro (Trial)': return 'text-blue-600 bg-blue-100';
            case 'Pro (Cancelled)': return 'text-orange-600 bg-orange-100';
            case 'Pro (Past Due)': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };
    if (!user) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("nav", { className: "bg-white shadow-sm border-b border-gray-200", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between h-16", children: [_jsxs("div", { className: "flex items-center", children: [_jsx(Link, { to: "/", className: "flex items-center", children: _jsx("span", { className: "text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent", children: "QuickStage" }) }), _jsx("button", { onClick: () => setSidebarCollapsed(!sidebarCollapsed), className: "ml-4 p-2 rounded-md text-gray-600 hover:bg-gray-100 lg:hidden", children: _jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h16" }) }) })] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: `px-3 py-1 rounded-full text-xs font-medium ${getSubscriptionStatusColor(getSubscriptionStatus())}`, children: getSubscriptionStatus() }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsxs("span", { className: "text-sm text-gray-700", children: ["Welcome back, ", user.name, "!"] }), _jsx(Link, { to: "/settings", className: "text-gray-600 hover:text-gray-900", children: _jsxs("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [_jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }), _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })] }) }), _jsx("button", { onClick: logout, className: "text-gray-600 hover:text-gray-900", children: _jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" }) }) })] })] })] }) }) }), (showSuccessMessage || showErrorMessage) && (_jsx("div", { className: "fixed top-4 right-4 z-50", children: _jsx("div", { className: `p-4 rounded-md ${showSuccessMessage ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`, children: showSuccessMessage || showErrorMessage }) })), _jsxs("div", { className: "flex h-[calc(100vh-4rem)]", children: [_jsx("div", { className: `${sidebarCollapsed ? 'hidden' : 'block'} lg:block flex-shrink-0`, children: _jsx(ProjectSidebar, { projects: projects, selectedProjectId: selectedProjectId, onSelectProject: setSelectedProjectId, onRefreshProjects: loadData }) }), _jsx("div", { className: "flex-1 overflow-auto", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6", children: isLoading ? (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" }) })) : error ? (_jsxs("div", { className: "text-center py-12", children: [_jsx("div", { className: "text-red-600 mb-4", children: error }), _jsx("button", { onClick: loadData, className: "px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700", children: "Retry" })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: selectedProjectId
                                                            ? projects.find(p => p.id === selectedProjectId)?.name || 'Project'
                                                            : 'Dashboard' }), _jsxs("p", { className: "text-gray-600", children: [filteredSnapshots.length, " snapshot", filteredSnapshots.length !== 1 ? 's' : '', selectedProjectId && projects.find(p => p.id === selectedProjectId)?.description && (_jsxs("span", { children: [" \u2022 ", projects.find(p => p.id === selectedProjectId)?.description] }))] })] }), user?.canAccessPro === false && (_jsx("button", { onClick: handleUpgradeToPro, className: "px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700", children: "Upgrade to Pro" }))] }), !selectedProjectId && (_jsx(DashboardWidgets, { snapshots: snapshots, onExtend: handleExtendSnapshot })), _jsx(SnapshotTable, { snapshots: filteredSnapshots, onRefresh: loadData, selectedSnapshots: selectedSnapshots, onToggleSelect: handleToggleSelect, onSelectAll: handleSelectAll }), _jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: projects, onClearSelection: handleClearSelection, onRefresh: loadData })] })) }) })] })] }));
}
