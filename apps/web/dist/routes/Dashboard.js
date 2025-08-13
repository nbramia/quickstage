import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
export default function Dashboard() {
    const { user, logout } = useAuth();
    const [snapshots, setSnapshots] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showInstallInstructions, setShowInstallInstructions] = useState(false);
    const [showAIInstructions, setShowAIInstructions] = useState(false);
    const [saveLocation, setSaveLocation] = useState('downloads');
    const [customPath, setCustomPath] = useState('');
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [currentVersion, setCurrentVersion] = useState('');
    const [lastDownloadedVersion, setLastDownloadedVersion] = useState('');
    const [needsUpdate, setNeedsUpdate] = useState(false);
    const [showPATModal, setShowPATModal] = useState(false);
    const [newPAT, setNewPAT] = useState('');
    const [existingPATs, setExistingPATs] = useState([]);
    const [isGeneratingPAT, setIsGeneratingPAT] = useState(false);
    useEffect(() => {
        loadSnapshots();
        // Load saved user preferences
        const savedLocation = localStorage.getItem('quickstage-save-location');
        const savedCustomPath = localStorage.getItem('quickstage-custom-path');
        const downloadedVersion = localStorage.getItem('quickstage-downloaded-version');
        if (savedLocation) {
            setSaveLocation(savedLocation);
            if (savedCustomPath) {
                setCustomPath(savedCustomPath);
            }
        }
        if (downloadedVersion) {
            setLastDownloadedVersion(downloadedVersion);
        }
        // Check for updates
        checkForUpdates();
    }, []);
    const checkForUpdates = async () => {
        try {
            const response = await fetch('/api/extensions/version');
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
    const handleDownloadExtension = () => {
        // Primary download URL: direct from web app public directory
        const primaryUrl = `${window.location.origin}/quickstage.vsix`;
        // Backup download URL: through Worker API with explicit headers
        const backupUrl = `${window.location.origin}/api/extensions/download`;
        // Try to use File System Access API if available and custom location selected
        if (saveLocation === 'custom' && customPath && 'showSaveFilePicker' in window) {
            // Use modern file picker API
            downloadToCustomLocation(primaryUrl, customPath, backupUrl);
        }
        else {
            // Fallback to traditional download
            downloadToDefaultLocation(primaryUrl, backupUrl);
        }
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
            const response = await fetch('/api/tokens/list', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                setExistingPATs(data.pats || []);
            }
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
            const response = await fetch('/api/tokens/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setNewPAT(data.token);
                // Reload existing PATs
                const listResponse = await fetch('/api/tokens/list', { credentials: 'include' });
                if (listResponse.ok) {
                    const listData = await listResponse.json();
                    setExistingPATs(listData.pats || []);
                }
            }
            else {
                console.error('Failed to generate PAT');
            }
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
            const response = await fetch(`/api/tokens/${patId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (response.ok) {
                // Reload existing PATs
                const listResponse = await fetch('/api/tokens/list', { credentials: 'include' });
                if (listResponse.ok) {
                    const listData = await listResponse.json();
                    setExistingPATs(listData.pats || []);
                }
            }
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
    const downloadToCustomLocation = async (primaryUrl, path, backupUrl) => {
        try {
            let response = await fetch(primaryUrl);
            // If primary fails, try backup
            if (!response.ok) {
                console.warn('Primary download failed, trying backup URL');
                response = await fetch(backupUrl);
            }
            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`);
            }
            const blob = await response.blob();
            // Validate file size (should be > 5KB for a valid VSIX)
            if (blob.size < 5000) {
                throw new Error('Downloaded file appears to be corrupted (too small)');
            }
            // Use File System Access API
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `quickstage-${currentVersion}.vsix`,
                    types: [{
                            description: 'VS Code Extension',
                            accept: { 'application/octet-stream': ['.vsix'] }
                        }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                // Save user preference and track version
                localStorage.setItem('quickstage-save-location', 'custom');
                localStorage.setItem('quickstage-custom-path', path);
                localStorage.setItem('quickstage-downloaded-version', currentVersion);
                setLastDownloadedVersion(currentVersion);
                setNeedsUpdate(false);
            }
            else {
                throw new Error('File System Access API not supported');
            }
        }
        catch (error) {
            console.error('Failed to save to custom location:', error);
            // Fallback to default download
            downloadToDefaultLocation(primaryUrl, backupUrl);
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
    const getPlatformInfo = () => {
        const platform = navigator.platform;
        const isWindows = platform.indexOf('Win') > -1;
        const isMac = platform.indexOf('Mac') > -1;
        const isLinux = platform.indexOf('Linux') > -1;
        return {
            isWindows,
            isMac,
            isLinux,
            platform
        };
    };
    const getExtensionPaths = () => {
        const { isWindows, isMac, isLinux } = getPlatformInfo();
        if (isWindows) {
            return {
                vscode: '%USERPROFILE%\\.vscode\\extensions\\',
                cursor: '%USERPROFILE%\\.cursor\\extensions\\',
                downloads: '%USERPROFILE%\\Downloads\\'
            };
        }
        else if (isMac) {
            return {
                vscode: '~/Library/Application Support/Code/User/extensions/',
                cursor: '~/Library/Application Support/Cursor/User/extensions/',
                downloads: '~/Downloads/'
            };
        }
        else if (isLinux) {
            return {
                vscode: '~/.vscode/extensions/',
                cursor: '~/.cursor/extensions/',
                downloads: '~/Downloads/'
            };
        }
        return {
            vscode: '~/.vscode/extensions/',
            cursor: '~/.cursor/extensions/',
            downloads: '~/Downloads/'
        };
    };
    const handleLocationChange = (newLocation) => {
        setSaveLocation(newLocation);
        localStorage.setItem('quickstage-save-location', newLocation);
        // Clear custom path if not using custom location
        if (newLocation !== 'custom') {
            setCustomPath('');
            localStorage.removeItem('quickstage-custom-path');
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
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("header", { className: "bg-white shadow-sm border-b", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between items-center h-16", children: [_jsx("div", { className: "flex items-center", children: _jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "QuickStage" }) }), _jsxs("nav", { className: "flex items-center space-x-8", children: [_jsx(Link, { to: "/dashboard", className: "text-blue-600 border-b-2 border-blue-600 px-3 py-2 text-sm font-medium", children: "Dashboard" }), _jsx(Link, { to: "/settings", className: "text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium", children: "Settings" }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("div", { className: "text-sm text-gray-700", children: [_jsx("span", { className: "font-medium", children: user?.plan === 'pro' ? 'Pro' : 'Free' }), _jsx("span", { className: "text-gray-500 ml-2", children: "Plan" })] }), _jsx("button", { onClick: handleLogout, className: "text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-gray-400 transition-colors", children: "Sign Out" })] })] })] }) }) }), _jsxs("main", { className: "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8", children: [_jsx("div", { className: "px-4 sm:px-0 mb-8", children: _jsx("div", { className: "bg-white rounded-lg shadow p-6", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900 mb-2", children: "Welcome back!" }), _jsx("p", { className: "text-gray-600", children: "Manage your staged snapshots and create new ones from VS Code." }), user && (_jsxs("p", { className: "text-sm text-gray-500 mt-2", children: ["User ID: ", user.uid.slice(0, 8), "... \u2022 Member since ", new Date(user.createdAt).toLocaleDateString()] }))] }), user?.plan === 'free' && (_jsx(Link, { to: "/settings", className: "bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Go Pro" }))] }) }) }), _jsx("div", { className: "px-4 sm:px-0 mb-8", children: _jsx("div", { className: "bg-white rounded-lg shadow p-6", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-900 mb-2", children: "QuickStage Extension" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Download and install the QuickStage extension to start staging your projects directly from VS Code or Cursor." }), currentVersion && (_jsx("div", { className: "mb-4", children: needsUpdate ? (_jsx("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-3", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-yellow-600 mr-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-yellow-800", children: "Update Available!" }), _jsxs("div", { className: "text-xs text-yellow-600", children: ["New version ", currentVersion, " available. You have version ", lastDownloadedVersion, "."] })] })] }) })) : lastDownloadedVersion ? (_jsx("div", { className: "bg-green-50 border border-green-200 rounded-lg p-3", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-green-600 mr-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-green-800", children: "Up to Date!" }), _jsxs("div", { className: "text-xs text-green-600", children: ["You have the latest version (", currentVersion, ") installed."] })] })] }) })) : (_jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-3", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-blue-600 mr-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 6v6m0 0v6m0-6h6m-6 0H6" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-blue-800", children: "First Time Install" }), _jsxs("div", { className: "text-xs text-blue-600", children: ["Download version ", currentVersion, " to get started."] })] })] }) })) })), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Save Location" }), _jsxs("select", { value: saveLocation, onChange: (e) => handleLocationChange(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "downloads", children: "Downloads Folder" }), _jsx("option", { value: "vscode", children: "VS Code Extensions Folder" }), _jsx("option", { value: "cursor", children: "Cursor Extensions Folder" }), _jsx("option", { value: "custom", children: "Custom Location..." })] }), saveLocation !== 'downloads' && saveLocation !== 'custom' && (_jsxs("div", { className: "mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded", children: [_jsx("strong", { children: "Suggested path:" }), " ", getExtensionPaths()[saveLocation], _jsx("br", {}), _jsxs("span", { className: "text-gray-500", children: [getPlatformInfo().isWindows ? 'Windows' : getPlatformInfo().isMac ? 'macOS' : 'Linux', " detected"] })] })), saveLocation === 'custom' && (_jsxs("div", { className: "mt-2", children: [_jsx("input", { type: "text", value: customPath, onChange: (e) => {
                                                                    setCustomPath(e.target.value);
                                                                    localStorage.setItem('quickstage-custom-path', e.target.value);
                                                                }, placeholder: "Enter custom path...", className: "w-full px-3 py-2 border border-gray-300 rounded-md" }), _jsx("button", { onClick: () => setShowLocationPicker(true), className: "mt-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded", children: "Browse..." })] }))] }), _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("button", { onClick: () => handleDownloadExtension(), className: "bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center space-x-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }), _jsx("span", { children: "Download Extension" })] }), _jsxs("button", { onClick: checkForUpdates, className: "bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors flex items-center space-x-2", title: "Check for updates", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) }), _jsx("span", { children: "Check Updates" })] }), _jsxs("button", { onClick: () => handleShowInstructions(), className: "bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors flex items-center space-x-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }), _jsx("span", { children: "View Instructions" })] }), _jsxs("button", { onClick: () => handleShowAIInstructions(), className: "bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium py-3 px-6 rounded-lg transition-colors flex items-center space-x-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) }), _jsx("span", { children: "AI Instructions" })] }), _jsxs("button", { onClick: () => handleShowPATModal(), className: "bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-3 px-6 rounded-lg transition-colors flex items-center space-x-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }), _jsx("span", { children: "Manage PATs" })] }), _jsx("span", { className: "text-sm text-gray-500", children: "Version 0.0.1 \u2022 VS Code & Cursor Compatible \u2022 Consistent Naming" })] })] }), _jsx("div", { className: "text-right", children: _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-3", children: [_jsx("div", { className: "text-sm text-blue-800 font-medium", children: "Ready to Install" }), _jsx("div", { className: "text-xs text-blue-600", children: "All systems operational" })] }) })] }) }) }), showInstallInstructions && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Installation Instructions" }), _jsx("button", { onClick: () => setShowInstallInstructions(false), className: "text-gray-400 hover:text-gray-600", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Step 1: Install the Extension" }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-lg space-y-3", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "1" }), _jsx("div", { children: _jsx("p", { className: "text-sm text-gray-700", children: "Open VS Code or Cursor" }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "2" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Press ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Ctrl+Shift+P" }), " (Windows/Linux) or ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Cmd+Shift+P" }), " (Mac) to open Command Palette"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "3" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Type ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Extensions: Install from VSIX..." }), " and press Enter"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "4" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Navigate to and select the downloaded ", _jsxs("code", { className: "bg-gray-200 px-1 rounded text-xs", children: ["quickstage-", currentVersion, ".vsix"] }), " file"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium", children: "5" }), _jsx("div", { children: _jsx("p", { className: "text-sm text-gray-700", children: "Click \"Install\" when prompted" }) })] })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Step 2: Restart VS Code/Cursor" }), _jsx("div", { className: "bg-gray-50 p-4 rounded-lg", children: _jsx("p", { className: "text-sm text-gray-700", children: "After installation, you'll be prompted to restart VS Code or Cursor. Click \"Reload\" to activate the extension." }) })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Step 3: Use QuickStage" }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-lg space-y-3", children: [_jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium", children: "1" }), _jsx("div", { children: _jsx("p", { className: "text-sm text-gray-700", children: "Open your project folder in VS Code/Cursor" }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium", children: "2" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Press ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Ctrl+Shift+P" }), " (Windows/Linux) or ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "Cmd+Shift+P" }), " (Mac)"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium", children: "3" }), _jsx("div", { children: _jsxs("p", { className: "text-sm text-gray-700", children: ["Type ", _jsx("code", { className: "bg-gray-200 px-1 rounded text-xs", children: "QuickStage: Stage" }), " and press Enter"] }) })] }), _jsxs("div", { className: "flex items-start space-x-3", children: [_jsx("div", { className: "flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium", children: "4" }), _jsx("div", { children: _jsx("p", { className: "text-sm text-gray-700", children: "The extension will build your project and create a shareable snapshot" }) })] })] })] }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "\uD83D\uDCA1 Pro Tip" }), _jsxs("p", { className: "text-sm text-blue-800", children: ["Make sure your project has a build script in ", _jsx("code", { className: "bg-blue-100 px-1 rounded text-xs", children: "package.json" }), ". QuickStage supports Vite, Create React App, SvelteKit, and Next.js projects."] })] }), _jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-yellow-900 mb-2", children: "\u26A0\uFE0F Important Notes" }), _jsxs("ul", { className: "text-sm text-yellow-800 space-y-1", children: [_jsx("li", { children: "\u2022 The extension requires Node.js 18+ with corepack enabled" }), _jsx("li", { children: "\u2022 Your project must have a valid build script" }), _jsx("li", { children: "\u2022 Snapshots are password-protected by default" }), _jsx("li", { children: "\u2022 Files are automatically cleaned up after 7 days" })] })] })] }), _jsx("div", { className: "mt-6 flex justify-end", children: _jsx("button", { onClick: () => setShowInstallInstructions(false), className: "bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Got it!" }) })] }) }) })), showAIInstructions && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "AI Assistant Instructions" }), _jsx("button", { onClick: () => setShowAIInstructions(false), className: "text-gray-400 hover:text-gray-600", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-purple-50 border border-purple-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-purple-900 mb-2", children: "\uD83C\uDFAF How to Use This" }), _jsx("p", { className: "text-sm text-purple-800", children: "Copy the instructions below and paste them into your AI assistant (like ChatGPT, Claude, or Cursor's AI). This will give the AI the perfect context to help you build an interactive prototype." })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "Copy-Paste Instructions for AI Assistant" }), _jsxs("div", { className: "bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm leading-relaxed", children: [_jsx("div", { className: "mb-4", children: "I want to build and deploy an interactive prototype using QuickStage. Here's what I need:" }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Project Goal:" }), " [DESCRIBE YOUR PROTOTYPE HERE - what functionality, user experience, or concept you want to demonstrate]"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Target Users:" }), " [WHO will use this prototype - stakeholders, engineers, designers, etc.]"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Key Features:" }), " [LIST the main interactive elements, pages, or functionality you want to showcase]"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Design Preferences:" }), " [MENTION any specific design style, framework preferences, or visual requirements]"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Technical Requirements:" }), "\u2022 Must be a web-based prototype that can be built and deployed \u2022 Should use modern web technologies (React, Vue, Svelte, or vanilla HTML/CSS/JS) \u2022 Must have a build script in package.json for QuickStage compatibility \u2022 Should be lightweight and fast-loading \u2022 Must work in modern browsers"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "QuickStage Integration:" }), "\u2022 The prototype will be deployed using QuickStage for easy sharing \u2022 Should generate static files that can be served from a CDN \u2022 Must be compatible with QuickStage's build and deployment process \u2022 Should include all necessary assets (CSS, JS, images) in the build output"] }), _jsxs("div", { className: "mb-4", children: [_jsx("strong", { children: "Expected Output:" }), "\u2022 A complete, working web application \u2022 Clear build instructions \u2022 All source code and assets \u2022 Instructions for testing the prototype locally"] }), _jsx("div", { children: "Please create this prototype step by step, ensuring it's production-ready and can be easily built and deployed. Focus on creating a polished, interactive experience that clearly demonstrates the concept." })] })] }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "\uD83D\uDCA1 Pro Tips for AI Collaboration" }), _jsxs("ul", { className: "text-sm text-blue-800 space-y-1", children: [_jsx("li", { children: "\u2022 Be specific about the user experience you want to create" }), _jsx("li", { children: "\u2022 Mention any existing design systems or brand guidelines" }), _jsx("li", { children: "\u2022 Specify if you want mobile-responsive design" }), _jsx("li", { children: "\u2022 Ask the AI to explain any technical decisions it makes" }), _jsx("li", { children: "\u2022 Request step-by-step build instructions" })] })] }), _jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-yellow-900 mb-2", children: "\u26A0\uFE0F Important Notes" }), _jsxs("ul", { className: "text-sm text-yellow-800 space-y-1", children: [_jsx("li", { children: "\u2022 The AI will create the code, but you'll need to build and deploy it" }), _jsx("li", { children: "\u2022 Make sure the project has a valid build script in package.json" }), _jsx("li", { children: "\u2022 Test the prototype locally before staging with QuickStage" }), _jsx("li", { children: "\u2022 The AI should focus on functionality, not complex backend features" })] })] })] }), _jsxs("div", { className: "mt-6 flex justify-between", children: [_jsxs("button", { id: "copy-ai-instructions", onClick: () => copyToClipboard(`I want to build and deploy an interactive prototype using QuickStage. Here's what I need:

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

Please create this prototype step by step, ensuring it's production-ready and can be easily built and deployed. Focus on creating a polished, interactive experience that clearly demonstrates the concept.`), className: "bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center space-x-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" }) }), _jsx("span", { children: "Copy Instructions" })] }), _jsx("button", { onClick: () => setShowAIInstructions(false), className: "bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Got it!" })] })] }) }) })), _jsx("div", { className: "px-4 sm:px-0", children: _jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsx("div", { className: "px-6 py-4 border-b border-gray-200", children: _jsxs("h3", { className: "text-lg font-medium text-gray-900", children: ["Your Snapshots (", snapshots.length, ")"] }) }), error && (_jsx("div", { className: "px-6 py-4", children: _jsx("div", { className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg", children: error }) })), snapshots.length === 0 ? (_jsxs("div", { className: "px-6 py-12 text-center", children: [_jsx("div", { className: "text-gray-400 mb-4", children: _jsx("svg", { className: "mx-auto h-12 w-12", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }) }), _jsx("h3", { className: "text-lg font-medium text-gray-900 mb-2", children: "No snapshots yet" }), _jsx("p", { className: "text-gray-500 mb-4", children: "Use the QuickStage extension in VS Code to create your first snapshot." }), _jsxs("div", { className: "text-sm text-gray-400", children: [_jsx("p", { children: "1. Install the QuickStage extension" }), _jsx("p", { children: "2. Open your project in VS Code" }), _jsx("p", { children: "3. Click \"QuickStage: Stage\" in the command palette" })] })] })) : (_jsx("div", { className: "overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Snapshot" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Created" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Expires" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Views" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Password" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: snapshots.map((snapshot) => {
                                                    const daysUntilExpiry = getDaysUntilExpiry(snapshot.expiresAt);
                                                    const expiryColor = getExpiryColor(daysUntilExpiry);
                                                    return (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: snapshot.name }), _jsxs("div", { className: "text-sm text-gray-500", children: ["ID: ", snapshot.id] })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: formatDate(snapshot.createdAt) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: `text-sm ${expiryColor}`, children: daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : 'Expired' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: snapshot.viewCount }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${snapshot.isPublic
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'bg-gray-100 text-gray-800'}`, children: snapshot.isPublic ? 'Public' : 'Private' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: snapshot.password ? (_jsx("code", { className: "bg-gray-100 px-2 py-1 rounded text-xs", children: snapshot.password })) : (_jsx("span", { className: "text-gray-500", children: "No password" })) }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: [_jsx("a", { href: `/s/${snapshot.id}`, target: "_blank", rel: "noopener noreferrer", className: "text-blue-600 hover:text-blue-900 mr-2", children: "View" }), _jsx("button", { onClick: () => handleCopyUrl(snapshot.id), className: "text-green-600 hover:text-green-900 mr-2", children: "Copy URL" }), _jsx("button", { onClick: () => handleExtendSnapshot(snapshot.id), className: "text-gray-600 hover:text-gray-900 mr-2", children: "Extend" }), _jsx("button", { onClick: () => handleExpireSnapshot(snapshot.id), className: "text-red-600 hover:text-red-900 mr-2", children: "Expire" }), _jsx("button", { onClick: () => handleRotatePassword(snapshot.id), className: "text-purple-600 hover:text-purple-900", children: "New Password" })] })] }, snapshot.id));
                                                }) })] }) })), showPATModal && (_jsx("div", { className: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50", children: _jsx("div", { className: "relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white", children: _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-lg font-medium text-gray-900", children: "Personal Access Tokens for VS Code/Cursor Extension" }), _jsx("button", { onClick: () => setShowPATModal(false), className: "text-gray-400 hover:text-gray-600", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-medium text-blue-900 mb-2", children: "\uD83D\uDD11 How to Use PATs" }), _jsx("p", { className: "text-sm text-blue-800", children: "Generate a Personal Access Token and use it in your VS Code/Cursor extension. This will authenticate your extension with QuickStage permanently." })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-3", children: "Generate New Token" }), _jsx("button", { onClick: handleGeneratePAT, disabled: isGeneratingPAT, className: "bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2", children: isGeneratingPAT ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin h-5 w-5", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), _jsx("span", { children: "Generating..." })] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 6v6m0 0v6m0-6h6m-6 0H6" }) }), _jsx("span", { children: "Generate New Token" })] })) })] }), newPAT && (_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-2", children: "New Token Generated" }), _jsx("div", { className: "bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm break-all", children: newPAT }), _jsx("p", { className: "text-sm text-red-600 mt-2", children: "\u26A0\uFE0F Copy this token now! It won't be shown again." }), _jsxs("button", { onClick: () => copyToClipboard(newPAT), className: "mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2", children: [_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" }) }), _jsx("span", { children: "Copy Token" })] })] })), existingPATs.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-gray-900 mb-3", children: "Existing Tokens" }), _jsx("div", { className: "space-y-3", children: existingPATs.map((pat) => (_jsx("div", { className: "border rounded-lg p-3 bg-gray-50", children: _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-900", children: pat.description }), _jsxs("p", { className: "text-xs text-gray-500", children: ["Created: ", new Date(pat.createdAt).toLocaleDateString()] }), _jsxs("p", { className: "text-xs text-gray-500", children: ["Expires: ", new Date(pat.expiresAt).toLocaleDateString()] }), pat.lastUsed && (_jsxs("p", { className: "text-xs text-gray-500", children: ["Last used: ", new Date(pat.lastUsed).toLocaleDateString()] }))] }), _jsx("button", { onClick: () => handleRevokePAT(pat.id), className: "text-red-600 hover:text-red-800 text-sm font-medium", children: "Revoke" })] }) }, pat.id))) })] })), _jsx("div", { className: "mt-6 flex justify-end", children: _jsx("button", { onClick: () => setShowPATModal(false), className: "bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors", children: "Close" }) })] })] }) }) }))] }) })] })] }));
}
