import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import config from '../config';
import '../fonts.css';
export default function Dashboard() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, logout, refreshUser } = useAuth();
    const [snapshots, setSnapshots] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showInstallInstructions, setShowInstallInstructions] = useState(false);
    const [showAIInstructions, setShowAIInstructions] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    // Debug logging
    useEffect(() => {
        console.log('Dashboard - Current user object:', user);
        console.log('Dashboard - User subscription details:', {
            plan: user?.plan,
            subscriptionStatus: user?.subscriptionStatus,
            subscriptionDisplay: user?.subscriptionDisplay,
            canAccessPro: user?.canAccessPro,
            role: user?.role
        });
    }, [user]);
    const [currentVersion, setCurrentVersion] = useState('');
    const [lastDownloadedVersion, setLastDownloadedVersion] = useState('');
    const [needsUpdate, setNeedsUpdate] = useState(false);
    const [showPATModal, setShowPATModal] = useState(false);
    const [newPAT, setNewPAT] = useState('');
    const [existingPATs, setExistingPATs] = useState([]);
    const [isGeneratingPAT, setIsGeneratingPAT] = useState(false);
    const [filterType, setFilterType] = useState('active');
    const [showSuccessMessage, setShowSuccessMessage] = useState('');
    const [showErrorMessage, setShowErrorMessage] = useState('');
    const [isLoadingBilling, setIsLoadingBilling] = useState(false);
    // Handle post-checkout URL parameters and refresh user data
    useEffect(() => {
        const trialParam = searchParams.get('trial');
        const billingParam = searchParams.get('billing');
        const successParam = searchParams.get('success');
        // If user just completed checkout, refresh their user data immediately
        if (trialParam === 'started' || billingParam === 'success' || successParam === 'true') {
            console.log('Post-checkout detected, refreshing user data...');
            refreshUser?.();
            // Clear URL parameters after handling them
            setSearchParams({});
            // Show success message
            if (trialParam === 'started') {
                setShowSuccessMessage('Welcome to your Pro trial! You now have access to all Pro features.');
            }
            else if (billingParam === 'success' || successParam === 'true') {
                setShowSuccessMessage('Subscription activated! You now have full access to Pro features.');
            }
            // Clear success message after 5 seconds
            setTimeout(() => setShowSuccessMessage(''), 5000);
        }
    }, [searchParams, refreshUser, setSearchParams]);
    useEffect(() => {
        loadSnapshots();
        // Load saved user preferences
        const downloadedVersion = localStorage.getItem('quickstage-downloaded-version');
        if (downloadedVersion) {
            setLastDownloadedVersion(downloadedVersion);
        }
        // Check for updates
        checkForUpdates();
        // Track page view
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
    const checkForUpdates = async () => {
        try {
            const response = await fetch(config.VERSION_INFO_URL);
            if (response.ok) {
                const versionInfo = await response.json();
                setCurrentVersion(versionInfo.version);
                // Check if user needs to update
                if (lastDownloadedVersion && lastDownloadedVersion !== versionInfo.version) {
                    setNeedsUpdate(true);
                }
            }
        }
        catch (error) {
            console.error('Failed to check for updates:', error);
        }
    };
    const loadSnapshots = async () => {
        try {
            const response = await api.get('/api/snapshots/list');
            setSnapshots(response.snapshots || []);
        }
        catch (err) {
            setError('Failed to load snapshots');
            console.error(err);
        }
        finally {
            setIsLoading(false);
        }
    };
    // Filter snapshots based on filter type
    const filteredSnapshots = snapshots.filter(snapshot => {
        if (filterType === 'active') {
            return new Date(snapshot.expiresAt) > new Date();
        }
        return true; // Show all snapshots
    });
    // Check if snapshot is expired
    const isExpired = (expiresAt) => {
        return new Date(expiresAt) <= new Date();
    };
    // Show success message
    const showSuccess = (message) => {
        setShowSuccessMessage(message);
        setTimeout(() => setShowSuccessMessage(''), 3000);
    };
    // Show error message
    const showError = (message) => {
        setShowErrorMessage(message);
        setTimeout(() => setShowErrorMessage(''), 3000);
    };
    // Billing functions
    const handleUpgradeToPro = () => {
        // Navigate to pricing page to select plan
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
        if (!user)
            return 'None';
        // Use the subscriptionDisplay field from the user object
        return user.subscriptionDisplay || 'Pro';
    };
    const getSubscriptionStatusColor = (status) => {
        switch (status) {
            case 'Pro':
                return 'text-green-600 bg-green-100';
            case 'Pro (Trial)':
                return 'text-blue-600 bg-blue-100';
            case 'Pro (Cancelled)':
                return 'text-orange-600 bg-orange-100';
            case 'Pro (Past Due)':
                return 'text-red-600 bg-red-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };
    const canUpgrade = () => {
        // Superadmin accounts never need to upgrade
        if (user?.role === 'superadmin')
            return false;
        // Use new schema with fallbacks to legacy fields
        const subscriptionStatus = user?.subscription?.status || user?.subscriptionStatus || 'none';
        // Trial users don't need to upgrade - they already have Pro access
        if (subscriptionStatus === 'trial')
            return false;
        // User can upgrade if they have no subscription status or are on a cancelled/past due subscription
        return user && (!subscriptionStatus ||
            subscriptionStatus === 'none' ||
            subscriptionStatus === 'cancelled' ||
            subscriptionStatus === 'past_due');
    };
    const canManageBilling = () => {
        // Superadmin accounts don't have billing to manage
        if (user?.role === 'superadmin')
            return false;
        // Use new schema with fallbacks to legacy fields
        const subscriptionStatus = user?.subscription?.status || user?.subscriptionStatus || 'none';
        // User can manage billing if they have an active subscription or trial
        return user && (subscriptionStatus === 'active' || subscriptionStatus === 'trial');
    };
    const handleLogout = () => {
        logout();
    };
    const handleExtendSnapshot = async (snapshotId) => {
        try {
            await api.post(`/api/snapshots/${snapshotId}/extend`, { days: 7 });
            // Reload snapshots to get updated expiry dates
            loadSnapshots();
            showSuccess('Snapshot extended successfully!');
        }
        catch (err) {
            showError('Failed to extend snapshot');
            console.error(err);
        }
    };
    const handleExpireSnapshot = async (snapshotId) => {
        try {
            await api.post(`/api/snapshots/${snapshotId}/expire`);
            // Reload snapshots to get updated list
            loadSnapshots();
            showSuccess('Snapshot expired successfully!');
        }
        catch (err) {
            showError('Failed to expire snapshot');
            console.error(err);
        }
    };
    const handleRotatePassword = async (snapshotId) => {
        try {
            const response = await api.post(`/api/snapshots/${snapshotId}/rotate-password`);
            const newPassword = response.password;
            // Copy to clipboard
            try {
                await navigator.clipboard.writeText(newPassword);
                showSuccess('New password copied to clipboard!');
            }
            catch (clipboardErr) {
                showSuccess(`New password: ${newPassword}`);
            }
            // Reload snapshots to get updated password
            loadSnapshots();
        }
        catch (err) {
            showError('Failed to rotate password');
            console.error(err);
        }
    };
    const handleCopyUrl = async (snapshotId) => {
        try {
            const url = config.getSnapshotUrl(snapshotId);
            await navigator.clipboard.writeText(url);
            showSuccess('URL copied to clipboard!');
        }
        catch (err) {
            showError('Failed to copy URL');
            console.error(err);
        }
    };
    const handleDownloadExtension = () => {
        // Primary download URL: direct from web app public directory
        const primaryUrl = `${window.location.origin}${config.EXTENSION_DOWNLOAD_URL}`;
        // Backup download URL: through web app API
        const backupUrl = `${window.location.origin}${config.API_BASE_URL}/extensions/download`;
        // Simple download to Downloads folder
        downloadToDefaultLocation(primaryUrl, backupUrl);
        // Show instructions after delay
        setTimeout(() => {
            setShowInstallInstructions(true);
        }, 1000);
    };
    const handleShowInstructions = () => {
        setShowInstallInstructions(true);
    };
    const handleShowAIInstructions = () => {
        setShowAIInstructions(true);
    };
    const handleShowPATModal = async () => {
        try {
            // Load existing PATs
            const response = await api.get('/tokens/list');
            setExistingPATs(response.pats || []);
            setShowPATModal(true);
        }
        catch (error) {
            console.error('Failed to load PATs:', error);
            setShowPATModal(true);
        }
    };
    const handleGeneratePAT = async () => {
        setIsGeneratingPAT(true);
        try {
            const data = await api.post('/tokens/create', {});
            setNewPAT(data.token);
            // Reload existing PATs
            const listData = await api.get('/tokens/list');
            setExistingPATs(listData.pats || []);
        }
        catch (error) {
            console.error('Failed to generate PAT:', error);
        }
        finally {
            setIsGeneratingPAT(false);
        }
    };
    const handleRevokePAT = async (patId) => {
        try {
            await api.delete(`/tokens/${patId}`);
            // Reload existing PATs
            const listData = await api.get('/tokens/list');
            setExistingPATs(listData.pats || []);
        }
        catch (error) {
            console.error('Failed to revoke PAT:', error);
        }
    };
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            // Show a brief success message
            const button = document.getElementById('copy-ai-instructions');
            if (button) {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.classList.add('bg-green-600', 'hover:bg-green-700');
                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('bg-green-600', 'hover:bg-green-700');
                }, 2000);
            }
        }
        catch (err) {
            console.error('Failed to copy to clipboard:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    };
    const copyPasswordToClipboard = async (password) => {
        try {
            await navigator.clipboard.writeText(password);
            showSuccess('Password copied to clipboard!');
        }
        catch (err) {
            console.error('Failed to copy password to clipboard:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = password;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showSuccess('Password copied to clipboard!');
        }
    };
    const downloadToDefaultLocation = async (primaryUrl, backupUrl) => {
        try {
            // First try to validate the primary URL
            const response = await fetch(primaryUrl, { method: 'HEAD' });
            let downloadUrl = primaryUrl;
            // If primary fails and backup available, use backup
            if (!response.ok && backupUrl) {
                console.warn('Primary download URL failed, using backup');
                const backupResponse = await fetch(backupUrl, { method: 'HEAD' });
                if (backupResponse.ok) {
                    downloadUrl = backupUrl;
                }
            }
            // Perform the download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `quickstage-${currentVersion}.vsix`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Track version when downloading
            if (currentVersion) {
                localStorage.setItem('quickstage-downloaded-version', currentVersion);
                setLastDownloadedVersion(currentVersion);
                setNeedsUpdate(false);
                // Track the download event
                const isUpgrade = lastDownloadedVersion && lastDownloadedVersion !== currentVersion;
                const eventType = isUpgrade ? 'extension_upgraded' : 'extension_downloaded';
                try {
                    await api.post('/analytics/track', {
                        eventType,
                        eventData: {
                            page: '/dashboard',
                            version: currentVersion,
                            previousVersion: lastDownloadedVersion || null,
                            isUpgrade
                        }
                    });
                }
                catch (error) {
                    console.error('Failed to track extension download:', error);
                }
            }
        }
        catch (error) {
            console.error('Download failed:', error);
            // If all else fails, try the primary URL anyway (browser might handle it)
            const a = document.createElement('a');
            a.href = primaryUrl;
            a.download = `quickstage-${currentVersion}.vsix`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
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
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center font-poppins", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600", children: "Loading your snapshots..." })] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50 font-poppins", children: [_jsx("header", { className: "bg-white shadow-lg border-b border-gray-200", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "flex justify-between items-center h-16 sm:h-20", children: [_jsx("div", { className: "flex items-center", children: _jsx("h1", { className: "text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent font-share-tech-mono", children: "QuickStage" }) }), _jsxs("nav", { className: "hidden sm:flex items-center space-x-4", children: [_jsxs(Link, { to: "/dashboard", className: "relative text-blue-600 px-4 py-2 text-sm font-semibold transition-colors", children: ["Dashboard", _jsx("div", { className: "absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full" })] }), _jsx(Link, { to: "/settings", className: "text-gray-600 hover:text-gray-900 px-4 py-2 text-sm font-medium transition-colors", children: "Settings" }), user?.role === 'superadmin' && (_jsx(Link, { to: "/admin", className: "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-md", children: "\uD83D\uDEE1\uFE0F Admin Panel" })), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsx("div", { className: "bg-gradient-to-r from-green-100 to-blue-100 px-4 py-2 rounded-full", children: _jsxs("div", { className: "text-sm text-gray-700", children: [_jsx("span", { className: "font-semibold", children: user?.subscriptionDisplay || 'Free' }), _jsx("span", { className: "text-gray-500 ml-2", children: "Plan" })] }) }), _jsx("button", { onClick: handleLogout, className: "bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-md", children: "Sign Out" })] })] }), _jsx("div", { className: "sm:hidden", children: _jsx("button", { onClick: () => setIsMobileMenuOpen(!isMobileMenuOpen), className: "text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500", children: _jsx("svg", { className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h16" }) }) }) })] }), isMobileMenuOpen && (_jsx("div", { className: "sm:hidden", children: _jsxs("div", { className: "px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200", children: [_jsx("div", { className: "px-3 py-2", children: _jsx("div", { className: "bg-gradient-to-r from-green-100 to-blue-100 px-4 py-2 rounded-full text-center", children: _jsxs("div", { className: "text-sm text-gray-700", children: [_jsx("span", { className: "font-semibold", children: user?.subscriptionDisplay || 'Free' }), _jsx("span", { className: "text-gray-500 ml-2", children: "Plan" })] }) }) }), _jsx(Link, { to: "/dashboard", onClick: () => setIsMobileMenuOpen(false), className: "block px-3 py-2 text-base font-medium text-blue-600 border-l-4 border-blue-600 bg-blue-50", children: "Dashboard" }), _jsx(Link, { to: "/settings", onClick: () => setIsMobileMenuOpen(false), className: "block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50", children: "Settings" }), user?.role === 'superadmin' && (_jsx(Link, { to: "/admin", onClick: () => setIsMobileMenuOpen(false), className: "block px-3 py-2 text-base font-medium text-red-600 hover:text-red-900 hover:bg-red-50", children: "\uD83D\uDEE1\uFE0F Admin Panel" })), _jsx("button", { onClick: () => {
                                            setIsMobileMenuOpen(false);
                                            handleLogout();
                                        }, className: "block w-full text-left px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50", children: "Sign Out" })] }) }))] }) }), _jsxs("main", { className: "max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8", children: [_jsx("div", { className: "mb-6 sm:mb-8", children: _jsx("div", { className: "bg-gradient-to-r from-white to-blue-50 rounded-2xl shadow-xl border border-blue-100 p-4 sm:p-8", children: _jsxs("div", { className: "flex flex-col sm:flex-row justify-between items-start space-y-4 sm:space-y-0", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 mb-3 sm:mb-2", children: [_jsx("div", { className: "bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl flex-shrink-0", children: _jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" }) }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent font-inconsolata", children: "Welcome back!" }), _jsx("p", { className: "text-sm sm:text-base text-gray-600 font-poppins", children: "Deploy working prototypes directly from VS Code and Cursor. Share with your team to get quick feedback." })] })] }) }), canUpgrade() && (_jsxs("button", { onClick: handleUpgradeToPro, disabled: isLoadingBilling, className: "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-4 sm:px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed font-poppins w-full sm:w-auto", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" }) }), _jsx("span", { children: "Go Pro" })] }))] }) }) }), canUpgrade() && (_jsx("div", { className: "mb-6 sm:mb-8", children: _jsxs("div", { className: "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-xl border border-blue-100 p-4 sm:p-8", children: [_jsxs("div", { className: "text-center mb-6 sm:mb-8", children: [_jsx("div", { className: "inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-3 sm:mb-4", children: _jsx("svg", { className: "w-6 h-6 sm:w-8 sm:h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }) }), _jsx("h2", { className: "text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2 font-inconsolata", children: "Unlock Your Development Superpowers" }), _jsx("p", { className: "text-base sm:text-lg text-gray-600 max-w-2xl mx-auto", children: "Transform collaboration on product development teams with one-click deployment of working prototypes" })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8", children: [_jsxs("div", { className: "bg-white rounded-xl p-4 sm:p-6 shadow-md border border-blue-100", children: [_jsxs("div", { className: "flex items-center mb-3 sm:mb-4", children: [_jsx("div", { className: "w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0", children: _jsx("svg", { className: "w-5 h-5 sm:w-6 sm:h-6 text-blue-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }) }), _jsx("h3", { className: "text-base md:text-xl font-semibold text-gray-900 font-inconsolata", children: "VS Code & Cursor Extension" })] }), _jsx("p", { className: "text-gray-600 text-xs sm:text-sm", children: "Install the QuickStage extension directly in your code editor to deploy a working protoype of your project in seconds" })] }), _jsxs("div", { className: "bg-white rounded-xl p-4 sm:p-6 shadow-md border border-purple-100", children: [_jsxs("div", { className: "flex items-center mb-3 sm:mb-4", children: [_jsx("div", { className: "w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0", children: _jsx("svg", { className: "w-5 h-5 sm:w-6 sm:h-6 text-purple-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" }) }) }), _jsx("h3", { className: "text-base md:text-xl font-semibold text-gray-900 font-inconsolata", children: "Share live prototypes with your team" })] }), _jsx("p", { className: "text-gray-600 text-xs sm:text-sm", children: "Share password-protected URLs with your team. If a picture is worth a thousand words..." })] }), _jsxs("div", { className: "bg-white rounded-xl p-4 sm:p-6 shadow-md border border-indigo-100", children: [_jsxs("div", { className: "flex items-center mb-3 sm:mb-4", children: [_jsx("div", { className: "w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0", children: _jsx("svg", { className: "w-5 h-5 sm:w-6 sm:h-6 text-indigo-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) }) }), _jsx("h3", { className: "text-base md:text-xl font-semibold text-gray-900 font-inconsolata", children: "Comments & Feedback" })] }), _jsx("p", { className: "text-gray-600 text-xs sm:text-sm", children: "Share comments to collaborate on next steps and keep everyone on the same page" })] })] }), _jsx("div", { className: "text-center", children: _jsxs("div", { className: "bg-white rounded-xl p-4 sm:p-6 shadow-md border border-blue-100 max-w-md mx-auto", children: [_jsxs("div", { className: "flex items-center justify-center space-x-1 sm:space-x-2 mb-3 sm:mb-4", children: [_jsx("span", { className: "text-xl sm:text-2xl", children: "\u2728" }), _jsx("span", { className: "text-lg sm:text-xl font-semibold text-gray-900", children: "Start Your 7-Day Free Trial" }), _jsx("span", { className: "text-xl sm:text-2xl", children: "\u2728" })] }), _jsx("p", { className: "text-sm sm:text-base text-gray-600 mb-3 sm:mb-4", children: "Cancel anytime \u2022 Full access to all features" }), _jsx("button", { onClick: handleUpgradeToPro, disabled: isLoadingBilling, className: "w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed", children: isLoadingBilling ? (_jsxs("div", { className: "flex items-center justify-center", children: [_jsx("div", { className: "animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" }), "Processing..."] })) : ('Start Free Trial') }), _jsx("p", { className: "text-xs text-gray-500 mt-2", children: "From $5/month (annual) or $6/month \u2022 Cancel anytime" })] }) })] }) })), _jsx("div", { className: "mb-6 sm:mb-8", children: _jsx("div", { className: "bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-8", children: _jsxs("div", { children: [_jsxs("div", { className: "flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 mb-4 sm:mb-6", children: [_jsx("div", { className: "bg-gradient-to-r from-green-500 to-blue-600 p-3 rounded-xl flex-shrink-0", children: _jsx("svg", { className: "w-6 h-6 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent font-inconsolata", children: "QuickStage Extension" }), _jsx("p", { className: "text-sm sm:text-base text-gray-600 font-poppins", children: "Download and install the QuickStage extension to start staging your projects directly from VS Code or Cursor." })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex flex-col lg:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: `border rounded-lg p-3 sm:p-4 h-full flex items-start sm:items-center ${needsUpdate
                                                                ? 'bg-yellow-50 border-yellow-200'
                                                                : lastDownloadedVersion
                                                                    ? 'bg-green-50 border-green-200'
                                                                    : 'bg-blue-50 border-blue-200'}`, children: [_jsx("svg", { className: `w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0 mt-0.5 sm:mt-0 ${needsUpdate
                                                                        ? 'text-yellow-600'
                                                                        : lastDownloadedVersion
                                                                            ? 'text-green-600'
                                                                            : 'text-blue-600'}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: needsUpdate ? (_jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" })) : lastDownloadedVersion ? (_jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" })) : (_jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 6v6m0 0v6m0-6h6m-6 0H6" })) }), _jsxs("div", { children: [_jsx("div", { className: `text-xs sm:text-sm font-medium ${needsUpdate
                                                                                ? 'text-yellow-800'
                                                                                : lastDownloadedVersion
                                                                                    ? 'text-green-800'
                                                                                    : 'text-blue-800'}`, children: needsUpdate ? 'Update Available!' : lastDownloadedVersion ? 'Up to Date!' : 'First Time Install' }), _jsx("div", { className: `text-xs ${needsUpdate
                                                                                ? 'text-yellow-600'
                                                                                : lastDownloadedVersion
                                                                                    ? 'text-green-600'
                                                                                    : 'text-blue-600'}`, children: needsUpdate
                                                                                ? `New version ${currentVersion} available. You have downloaded version ${lastDownloadedVersion}.`
                                                                                : lastDownloadedVersion
                                                                                    ? `You have downloaded the latest version of the extension (${currentVersion}).`
                                                                                    : `Download the extension to get started.` })] })] }) }), _jsx("div", { className: "flex-1", children: _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 h-full flex items-start", children: [_jsx("svg", { className: "w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }), _jsxs("div", { className: "ml-2 sm:ml-3", children: [_jsx("div", { className: "text-xs sm:text-sm font-medium text-blue-800 mb-1", children: "Download Information" }), _jsx("div", { className: "text-xs text-blue-700", children: "After downloading, install in VS Code or Cursor (CMD-Shift-P, \"Install from VSIX\")." })] })] }) })] }), _jsx("div", { className: "mb-6", children: user?.canAccessPro ? (
                                                /* Pro User - Show all buttons in a grid that spans full width */
                                                _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full", children: [_jsxs("button", { onClick: () => handleDownloadExtension(), className: "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3", children: [_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }), _jsx("span", { className: "text-lg font-poppins", children: "Download Extension" })] }), _jsxs("button", { onClick: () => handleShowInstructions(), className: "bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg border border-gray-300 flex items-center justify-center space-x-3", children: [_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }), _jsx("span", { className: "text-lg font-poppins", children: "Quick Installation" })] }), _jsxs("button", { onClick: () => handleShowAIInstructions(), className: "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3", children: [_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) }), _jsx("span", { className: "text-lg font-poppins", children: "AI Dev Instructions" })] }), _jsxs("button", { onClick: () => handleShowPATModal(), className: "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3", children: [_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }), _jsx("span", { className: "text-lg font-poppins", children: "Tokens" })] })] })) : (
                                                /* Free User - Show only the disabled download button, centered */
                                                _jsx("div", { className: "flex justify-center", children: _jsxs("button", { disabled: true, className: "bg-gradient-to-r from-gray-400 to-gray-500 text-white font-semibold py-6 px-8 rounded-xl flex items-center justify-center space-x-3 cursor-not-allowed opacity-75", children: [_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }), _jsx("span", { className: "text-lg font-poppins", children: "Go Pro to Download" })] }) })) })] })] }) }) }), showInstallInstructions && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 font-inconsolata", children: "Installation Instructions" }), _jsx("button", { onClick: () => setShowInstallInstructions(false), className: "text-gray-400 hover:text-gray-600", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Step 1: Install the Extension" }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-lg space-y-3", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "1" }), _jsx("div", { children: _jsx("p", { className: "text-sm text-gray-700", children: "Open VS Code or Cursor" }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "2" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Press ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Ctrl+Shift+P" }), " (Windows/Linux) or ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Cmd+Shift+P" }), " (Mac) to open Command Palette"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "3" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Type ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Extensions: Install from VSIX..." }), " and press Enter"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "4" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Navigate to and select the downloaded ", _jsxs("code", { className: "bg-gray-200 px-1 rounded text-xs", children: ["quickstage-", currentVersion, ".vsix"] }), " file"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "5" }), _jsx("div", { children: _jsx("p", { className: "text-sm text-gray-700", children: "Click \"Install\" when prompted" }) })] })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Step 2: Restart VS Code/Cursor" }), _jsx("div", { className: "bg-gray-50 p-4 rounded-lg", children: _jsx("p", { className: "text-sm text-gray-700", children: "After installation, you'll be prompted to restart VS Code or Cursor. Click \"Reload\" to activate the extension." }) })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Step 3: Configure Authentication Token" }), _jsxs("div", { className: "bg-amber-50 border border-amber-200 p-4 rounded-lg space-y-3", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-medium", children: "1" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Click the ", _jsx("strong", { children: "\"Tokens\"" }), " button above to generate a Personal Access Token (PAT)"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-medium", children: "2" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Copy the generated token (it starts with ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "qs_pat_" }), ")"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-medium", children: "3" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["In VS Code/Cursor, open Command Palette and type ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "QuickStage: Set Token" })] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-sm font-medium", children: "4" }), _jsx("div", { children: _jsx("p", { className: "text-sm text-gray-700", children: "Paste your token when prompted and press Enter" }) })] }), _jsx("div", { className: "bg-amber-100 p-3 rounded-md", children: _jsxs("p", { className: "text-xs text-amber-800", children: [_jsx("strong", { children: "\u26A0\uFE0F Important:" }), " Keep your token secure! It provides access to your QuickStage account."] }) })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Step 4: Use QuickStage" }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-lg space-y-3", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium", children: "1" }), _jsx("div", { children: _jsx("p", { className: "text-sm text-gray-700", children: "Open your project folder in VS Code/Cursor" }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium", children: "2" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Press ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Ctrl+Shift+P" }), " (Windows/Linux) or ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Cmd+Shift+P" }), " (Mac)"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium", children: "3" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Type ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "QuickStage: Stage" }), " and press Enter"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium", children: "4" }), _jsx("div", { children: _jsx("p", { className: "text-sm text-gray-700", children: "The extension will build your project and create a shareable snapshot" }) })] })] })] }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "\uD83D\uDCA1 Pro Tip" }), _jsxs("p", { className: "text-sm text-blue-800", children: ["Make sure your project has a build script in ", _jsx("code", { className: "bg-blue-100 px-1 rounded text-xs", children: "package.json" }), ". QuickStage supports Vite, Create React App, SvelteKit, and Next.js projects."] })] }), _jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-yellow-900 mb-2", children: "\u26A0\uFE0F Important Notes" }), _jsxs("ul", { className: "text-sm text-yellow-800 space-y-1", children: [_jsx("li", { children: "\u2022 The extension requires Node.js 18+ with corepack enabled" }), _jsx("li", { children: "\u2022 Your project must have a valid build script" }), _jsx("li", { children: "\u2022 Snapshots are password-protected by default" }), _jsx("li", { children: "\u2022 Files are automatically cleaned up after 7 days" })] })] })] }), _jsx("div", { className: "mt-6 flex justify-end", children: _jsx("button", { onClick: () => setShowInstallInstructions(false), className: "bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Got it!" }) })] }) }) })), showAIInstructions && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 font-inconsolata", children: "AI Assistant Instructions" }), _jsx("button", { onClick: () => setShowAIInstructions(false), className: "text-gray-400 hover:text-gray-600", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-purple-50 border border-purple-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-purple-900 mb-2", children: "\uD83C\uDFAF How to Use This" }), _jsx("p", { className: "text-sm text-purple-800", children: "Copy the instructions below and paste them into your AI assistant (like ChatGPT, Claude, or Cursor's AI). This will give the AI the perfect context to help you build an interactive prototype." })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Copy-Paste Instructions for AI Assistant" }), _jsxs("div", { className: "bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm leading-relaxed", children: [_jsx("div", { className: "mb-4", children: "I want to build and deploy an interactive prototype using QuickStage. Here's what I need:" }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Project Goal:" }), " [DESCRIBE YOUR PROTOTYPE HERE - what functionality, user experience, or concept you want to demonstrate]"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Target Users:" }), " [WHO will use this prototype - stakeholders, engineers, designers, etc.]"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Key Features:" }), " [LIST the main interactive elements, pages, or functionality you want to showcase]"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Design Preferences:" }), " [MENTION any specific design style, framework preferences, or visual requirements]"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Technical Requirements:" }), "\u2022 Must be a web-based prototype that can be built and deployed \u2022 Should use modern web technologies (React, Vue, Svelte, or vanilla HTML/CSS/JS) \u2022 Must have a build script in package.json for QuickStage compatibility \u2022 Should be lightweight and fast-loading \u2022 Must work in modern browsers"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "QuickStage Integration:" }), "\u2022 The prototype will be deployed using QuickStage for easy sharing \u2022 Should generate static files that can be served from a CDN \u2022 Must be compatible with QuickStage's build and deployment process \u2022 Should include all necessary assets (CSS, JS, images) in the build output"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Expected Output:" }), "\u2022 A complete, working web application \u2022 Clear build instructions \u2022 All source code and assets \u2022 Instructions for testing the prototype locally"] }), _jsx("div", { children: "Please create this prototype step by step, ensuring it's production-ready and can be easily built and deployed. Focus on creating a polished, interactive experience that clearly demonstrates the concept." })] })] }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "\uD83D\uDCA1 Pro Tips for AI Collaboration" }), _jsxs("ul", { className: "text-sm text-blue-800 space-y-1", children: [_jsx("li", { children: "\u2022 Be specific about the user experience you want to create" }), _jsx("li", { children: "\u2022 Mention any existing design systems or brand guidelines" }), _jsx("li", { children: "\u2022 Specify if you want mobile-responsive design" }), _jsx("li", { children: "\u2022 Ask the AI to explain any technical decisions it makes" }), _jsx("li", { children: "\u2022 Request step-by-step build instructions" })] })] }), _jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-yellow-900 mb-2", children: "\u26A0\uFE0F Important Notes" }), _jsxs("ul", { className: "text-sm text-yellow-800 space-y-1", children: [_jsx("li", { children: "\u2022 The AI will create the code, but you'll need to build and deploy it" }), _jsx("li", { children: "\u2022 Make sure the project has a valid build script in package.json" }), _jsx("li", { children: "\u2022 Test the prototype locally before staging with QuickStage" }), _jsx("li", { children: "\u2022 The AI should focus on functionality, not complex backend features" })] })] })] }), _jsxs("div", { className: "mt-6 flex justify-between", children: [_jsxs("button", { id: "copy-ai-instructions", onClick: () => copyToClipboard(`I want to build and deploy an interactive prototype using QuickStage. Here's what I need:

Project Goal: [DESCRIBE YOUR PROTOTYPE HERE - what functionality, user experience, or concept you want to demonstrate]

Target Users: [WHO will use this prototype - stakeholders, engineers, designers, etc.]

Key Features: [LIST the main interactive elements, pages, or functionality you want to showcase]

Design Preferences: [MENTION any specific design style, framework preferences, or visual requirements]

Technical Requirements:
• Must be a web-based prototype that can be built and deployed
• Should use modern web technologies (React, Vue, Svelte, or vanilla HTML/CSS/JS)
• Must have a build script in package.json for QuickStage compatibility
• Should be lightweight and fast-loading
• Must work in modern browsers

QuickStage Integration:
• The prototype will be deployed using QuickStage for easy sharing
• Should generate static files that can be served from a CDN
• Must be compatible with QuickStage's build and deployment process
• Should include all necessary assets (CSS, JS, images) in the build output

Expected Output:
• A complete, working web application
• Clear build instructions
• All source code and assets
• Instructions for testing the prototype locally

Please create this prototype step by step, ensuring it's production-ready and can be easily built and deployed. Focus on creating a polished, interactive experience that clearly demonstrates the concept.`), className: "bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center space-x-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" }) }), _jsx("span", { children: "Copy Instructions" })] }), _jsx("button", { onClick: () => setShowAIInstructions(false), className: "bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Got it!" })] })] }) }) })), _jsx("div", { children: _jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsx("div", { className: "px-4 sm:px-6 py-4 border-b border-gray-200", children: _jsxs("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0", children: [_jsxs("h3", { className: "text-lg sm:text-xl font-medium text-gray-900 font-inconsolata", children: ["Your Snapshots (", filteredSnapshots.length, ")"] }), _jsxs("div", { className: "flex items-center space-x-3", children: [_jsx("span", { className: "text-sm text-gray-600", children: "Filter:" }), _jsxs("div", { className: "flex bg-gray-100 rounded-lg p-1", children: [_jsx("button", { onClick: () => setFilterType('active'), className: `px-2 sm:px-3 py-1 text-sm font-medium rounded-md transition-colors ${filterType === 'active'
                                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                                    : 'text-gray-600 hover:text-gray-900'}`, children: "Active" }), _jsx("button", { onClick: () => setFilterType('all'), className: `px-2 sm:px-3 py-1 text-sm font-medium rounded-md transition-colors ${filterType === 'all'
                                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                                    : 'text-gray-600 hover:text-gray-900'}`, children: "All" })] })] })] }) }), showSuccessMessage && (_jsx("div", { className: "px-6 py-4", children: _jsx("div", { className: "bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg", children: showSuccessMessage }) })), showErrorMessage && (_jsx("div", { className: "px-6 py-4", children: _jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg", children: showErrorMessage }) })), error && (_jsx("div", { className: "px-6 py-4", children: _jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg", children: error }) })), snapshots.length === 0 ? (_jsxs("div", { className: "px-4 sm:px-6 py-8 sm:py-12 text-center", children: [_jsx("div", { className: "text-gray-400 mb-3 sm:mb-4", children: _jsx("svg", { className: "mx-auto h-8 w-8 sm:h-12 sm:w-12", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }) }), _jsx("h3", { className: "text-base sm:text-lg font-medium text-gray-900 mb-2", children: "No snapshots yet" }), _jsx("p", { className: "text-sm sm:text-base text-gray-500 mb-3 sm:mb-4", children: "Use the QuickStage extension in VS Code to create your first snapshot." }), _jsxs("div", { className: "text-xs sm:text-sm text-gray-400", children: [_jsx("p", { children: "1. Install the QuickStage extension" }), _jsx("p", { children: "2. Open your project in VS Code" }), _jsx("p", { children: "3. Click \"QuickStage: Stage\" in the command palette" })] })] })) : (_jsx("div", { className: "overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Snapshot" }), _jsx("th", { className: "hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Created" }), _jsx("th", { className: "px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Expires" }), _jsx("th", { className: "hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Views" }), _jsx("th", { className: "px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Password" }), _jsx("th", { className: "px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: filteredSnapshots.map((snapshot) => {
                                                    const daysUntilExpiry = getDaysUntilExpiry(snapshot.expiresAt);
                                                    const expiryColor = getExpiryColor(daysUntilExpiry);
                                                    const expired = isExpired(snapshot.expiresAt);
                                                    return (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-3 sm:px-6 py-4 whitespace-nowrap", children: _jsxs("div", { children: [_jsxs("div", { className: "text-sm font-medium text-gray-900", children: ["Snapshot ", snapshot.id.slice(0, 8)] }), _jsxs("button", { onClick: () => handleCopyUrl(snapshot.id), className: "text-green-600 hover:text-green-900 text-sm flex items-center space-x-1 transition-colors", children: [_jsx("span", { children: "Copy URL" }), _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" }) })] })] }) }), _jsx("td", { className: "hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: formatDate(snapshot.createdAt) }), _jsx("td", { className: "px-3 sm:px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: `text-sm ${expired ? 'text-red-600' : expiryColor}`, children: expired ? 'Expired' : `${daysUntilExpiry} days` }) }), _jsx("td", { className: "hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: snapshot.viewCount }), _jsx("td", { className: "px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: snapshot.password ? (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("button", { onClick: () => copyPasswordToClipboard(snapshot.password), className: "bg-gray-100 px-2 py-1 rounded text-xs hover:bg-gray-200 transition-colors cursor-pointer font-mono", title: "Click to copy password", children: snapshot.password }), _jsx("button", { onClick: () => copyPasswordToClipboard(snapshot.password), className: "text-gray-500 hover:text-gray-700 transition-colors", title: "Copy password", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" }) }) })] })) : (_jsx("span", { className: "text-gray-500", children: "No password" })) }), _jsx("td", { className: "px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsxs("div", { className: "flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2", children: [_jsx("a", { href: snapshot.password ? `${config.getSnapshotUrl(snapshot.id)}?p=${encodeURIComponent(snapshot.password)}` : config.getSnapshotUrl(snapshot.id), target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-900", children: "View" }), _jsx("button", { onClick: () => handleExtendSnapshot(snapshot.id), className: "text-gray-600 hover:text-gray-900", children: expired ? 'Renew' : 'Extend' }), _jsx("button", { onClick: () => handleExpireSnapshot(snapshot.id), className: "text-red-600 hover:text-red-900", children: "Expire" }), _jsx("button", { onClick: () => handleRotatePassword(snapshot.id), className: "text-purple-600 hover:text-purple-900", children: "New Password" })] }) })] }, snapshot.id));
                                                }) })] }) })), showPATModal && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900 font-inconsolata", children: "Personal Access Tokens for VS Code/Cursor Extension" }), _jsx("button", { onClick: () => {
                                                                setShowPATModal(false);
                                                                setNewPAT(''); // Clear the new token when closing modal
                                                            }, className: "text-gray-400 hover:text-gray-600", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "\uD83D\uDD11 How to Use PATs" }), _jsx("p", { className: "text-sm text-blue-800", children: "Generate a Personal Access Token and use it in your VS Code/Cursor extension. This will authenticate your extension with QuickStage permanently." })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-3", children: "Generate New Token" }), _jsx("button", { onClick: handleGeneratePAT, disabled: isGeneratingPAT, className: "bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2", children: isGeneratingPAT ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin h-5 w-5", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), _jsx("span", { children: "Generating..." })] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 6v6m0 0v6m0-6h6m-6 0H6" }) }), _jsx("span", { children: "Generate New Token" })] })) })] }), newPAT && (_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "New Token Generated" }), _jsx("div", { className: "bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm break-all", children: newPAT }), _jsx("p", { className: "text-sm text-red-600 mt-2", children: "\u26A0\uFE0F Copy this token now! It won't be shown again." }), _jsxs("button", { onClick: () => copyToClipboard(newPAT), className: "mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" }) }), _jsx("span", { children: "Copy Token" })] })] })), existingPATs.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-3", children: "Existing Tokens" }), _jsx("div", { className: "space-y-3", children: existingPATs.map((pat) => (_jsx("div", { className: "border rounded-lg p-3 bg-gray-50", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: pat.description }), _jsxs("p", { className: "text-xs text-gray-500", children: ["Created: ", new Date(pat.createdAt).toLocaleDateString()] }), _jsxs("p", { className: "text-xs text-gray-500", children: ["Expires: ", new Date(pat.expiresAt).toLocaleDateString()] }), pat.lastUsed && (_jsxs("p", { className: "text-xs text-gray-500", children: ["Last used: ", new Date(pat.lastUsed).toLocaleDateString()] }))] }), _jsx("button", { onClick: () => handleRevokePAT(pat.id), className: "text-red-600 hover:text-red-800 text-sm font-medium", children: "Revoke" })] }) }, pat.id))) })] })), _jsx("div", { className: "mt-6 flex justify-end", children: _jsx("button", { onClick: () => {
                                                                    setShowPATModal(false);
                                                                    setNewPAT(''); // Clear the new token when closing modal
                                                                }, className: "bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Close" }) })] })] }) }) }))] }) })] })] }));
}
