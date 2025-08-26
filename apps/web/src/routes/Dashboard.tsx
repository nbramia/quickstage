import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import config from '../config';

type Snapshot = {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  password?: string;
  isPublic: boolean;
  viewCount: number;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [showAIInstructions, setShowAIInstructions] = useState(false);

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
  const [existingPATs, setExistingPATs] = useState<any[]>([]);
  const [isGeneratingPAT, setIsGeneratingPAT] = useState(false);
  const [filterType, setFilterType] = useState<'active' | 'all'>('active');
  const [showSuccessMessage, setShowSuccessMessage] = useState('');
  const [showErrorMessage, setShowErrorMessage] = useState('');
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);

  useEffect(() => {
    loadSnapshots();
    
    // Load saved user preferences
    const downloadedVersion = localStorage.getItem('quickstage-downloaded-version');
    
    if (downloadedVersion) {
      setLastDownloadedVersion(downloadedVersion);
    }
    
    // Check for updates
    checkForUpdates();
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
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  };

  const loadSnapshots = async () => {
    try {
      const response = await api.get('/api/snapshots/list');
      setSnapshots(response.snapshots || []);
    } catch (err) {
      setError('Failed to load snapshots');
      console.error(err);
    } finally {
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
  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) <= new Date();
  };

  // Show success message
  const showSuccess = (message: string) => {
    setShowSuccessMessage(message);
    setTimeout(() => setShowSuccessMessage(''), 3000);
  };

  // Show error message
  const showError = (message: string) => {
    setShowErrorMessage(message);
    setTimeout(() => setShowErrorMessage(''), 3000);
  };

  // Billing functions
  const handleUpgradeToPro = async () => {
    try {
      setIsLoadingBilling(true);
      const response = await api.post('/billing/checkout');
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (error: any) {
      showError(error.message || 'Failed to start checkout');
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setIsLoadingBilling(true);
      const response = await api.post('/billing/portal');
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (error: any) {
      showError(error.message || 'Failed to open billing portal');
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const getSubscriptionStatus = () => {
    if (!user) return 'None';
    
    // Use the subscriptionDisplay field from the user object
    return user.subscriptionDisplay || 'Pro';
  };

  const getSubscriptionStatusColor = (status: string) => {
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
    if (user?.role === 'superadmin') return false;
    
    // Trial users don't need to upgrade - they already have Pro access
    if (user?.subscriptionStatus === 'trial') return false;
    
    // User can upgrade if they have no subscription status or are on a cancelled/past due subscription
    return user && (!user.subscriptionStatus || 
                   user.subscriptionStatus === 'none' || 
                   user.subscriptionStatus === 'cancelled' || 
                   user.subscriptionStatus === 'past_due');
  };

  const canManageBilling = () => {
    // Superadmin accounts don't have billing to manage
    if (user?.role === 'superadmin') return false;
    
    // User can manage billing if they have an active subscription or trial
    return user && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial');
  };

  const handleLogout = () => {
    logout();
  };

  const handleExtendSnapshot = async (snapshotId: string) => {
    try {
      await api.post(`/api/snapshots/${snapshotId}/extend`, { days: 7 });
      // Reload snapshots to get updated expiry dates
      loadSnapshots();
      showSuccess('Snapshot extended successfully!');
    } catch (err) {
      showError('Failed to extend snapshot');
      console.error(err);
    }
  };

  const handleExpireSnapshot = async (snapshotId: string) => {
    try {
      await api.post(`/api/snapshots/${snapshotId}/expire`);
      // Reload snapshots to get updated list
      loadSnapshots();
      showSuccess('Snapshot expired successfully!');
    } catch (err) {
      showError('Failed to expire snapshot');
      console.error(err);
    }
  };

  const handleRotatePassword = async (snapshotId: string) => {
    try {
      const response = await api.post(`/api/snapshots/${snapshotId}/rotate-password`);
      const newPassword = response.password;
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(newPassword);
        showSuccess('New password copied to clipboard!');
      } catch (clipboardErr) {
        showSuccess(`New password: ${newPassword}`);
      }
      
      // Reload snapshots to get updated password
      loadSnapshots();
    } catch (err) {
      showError('Failed to rotate password');
      console.error(err);
    }
  };

  const handleCopyUrl = async (snapshotId: string) => {
    try {
      const url = config.getSnapshotUrl(snapshotId);
      await navigator.clipboard.writeText(url);
      showSuccess('URL copied to clipboard!');
    } catch (err) {
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
      const response = await fetch(`${config.API_BASE_URL}/tokens/list`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setExistingPATs(data.pats || []);
      }
      setShowPATModal(true);
    } catch (error) {
      console.error('Failed to load PATs:', error);
      setShowPATModal(true);
    }
  };

  const handleGeneratePAT = async () => {
    setIsGeneratingPAT(true);
    try {
      const response = await fetch('/tokens/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setNewPAT(data.token);
        // Reload existing PATs
        const listResponse = await fetch('/tokens/list', { credentials: 'include' });
        if (listResponse.ok) {
          const listData = await listResponse.json();
          setExistingPATs(listData.pats || []);
        }
      } else {
        console.error('Failed to generate PAT');
      }
    } catch (error) {
      console.error('Failed to generate PAT:', error);
    } finally {
      setIsGeneratingPAT(false);
    }
  };

  const handleRevokePAT = async (patId: string) => {
    try {
      const response = await fetch(`/tokens/${patId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Reload existing PATs
        const listResponse = await fetch('/tokens/list', { credentials: 'include' });
        if (listResponse.ok) {
          const listData = await listResponse.json();
          setExistingPATs(listData.pats || []);
        }
      }
    } catch (error) {
      console.error('Failed to revoke PAT:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
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
    } catch (err) {
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

  const copyPasswordToClipboard = async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      showSuccess('Password copied to clipboard!');
    } catch (err) {
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


  
  const downloadToDefaultLocation = async (primaryUrl: string, backupUrl?: string) => {
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
      
    } catch (error) {
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



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysUntilExpiry = (expiryString: string) => {
    const expiry = new Date(expiryString);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryColor = (days: number) => {
    if (days <= 1) return 'text-red-600';
    if (days <= 3) return 'text-orange-600';
    return 'text-green-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your snapshots...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg mr-3">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                QuickStage
              </h1>
            </div>
            
            <nav className="flex items-center space-x-8">
              <Link
                to="/dashboard"
                className="relative text-blue-600 px-4 py-2 text-sm font-semibold transition-colors"
              >
                Dashboard
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
              </Link>
              <Link
                to="/settings"
                className="text-gray-600 hover:text-gray-900 px-4 py-2 text-sm font-medium transition-colors"
              >
                Settings
              </Link>
              {user?.role === 'superadmin' && (
                <Link
                  to="/admin"
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-md"
                >
                  🛡️ Admin Panel
                </Link>
              )}
              
              {/* User Menu */}
              <div className="flex items-center space-x-4">
                <div className="bg-gradient-to-r from-green-100 to-blue-100 px-4 py-2 rounded-full">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{user?.subscriptionDisplay || 'Free'}</span>
                    <span className="text-gray-500 ml-2">Plan</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-md"
                >
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="px-4 sm:px-0 mb-8">
          <div className="bg-gradient-to-r from-white to-blue-50 rounded-2xl shadow-xl border border-blue-100 p-8">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-full">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Welcome back!
                  </h2>
                </div>
                <p className="text-lg text-gray-700 mb-4">
                  Deploy working prototypes directly from VS Code and Cursor. Share with your team to get quick feedback.
                </p>

              </div>
              {canUpgrade() && (
                <button
                  onClick={handleUpgradeToPro}
                  disabled={isLoadingBilling}
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span>Go Pro</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Why Go Pro Section - Only show for users who need to upgrade */}
        {canUpgrade() && (
          <div className="px-4 sm:px-0 mb-8">
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl shadow-xl border border-blue-100 p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  Unlock Your Development Superpowers
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Transform collaboration on product development teams with one-click deployment of working prototypes
                </p>
              </div>
              
              {/* Value Propositions */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* Feature 1 */}
                <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">VS Code & Cursor Extension</h3>
                  <p className="text-gray-600 text-sm">
                    Install the QuickStage extension directly in your code editor to deploy a working protoype of your project in seconds
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Share live prototypes with your team</h3>
                  <p className="text-gray-600 text-sm">
                    Share password-protected URLs with your team. If a picture is worth a thousand words...
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="bg-white rounded-xl p-6 shadow-md border border-indigo-100">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Comments & Feedback</h3>
                  <p className="text-gray-600 text-sm">
                    Share comments to collaborate on next steps and keep everyone on the same page
                  </p>
                </div>
              </div>

              {/* CTA Section */}
              <div className="text-center">
                <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100 max-w-md mx-auto">
                  <div className="flex items-center justify-center space-x-2 mb-4">
                    <span className="text-2xl">✨</span>
                    <span className="text-xl font-semibold text-gray-900">Start Your 7-Day Free Trial</span>
                    <span className="text-2xl">✨</span>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Cancel anytime • Full access to all features
                  </p>
                  <button
                    onClick={handleUpgradeToPro}
                    disabled={isLoadingBilling}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingBilling ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      'Start Free Trial'
                    )}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    After trial: $6/month • Billed monthly • Cancel anytime
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extension Download Section */}
        <div className="px-4 sm:px-0 mb-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-gradient-to-r from-green-500 to-blue-600 p-3 rounded-xl">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    QuickStage Extension
                  </h2>
                  <p className="text-gray-600">
                    Download and install the QuickStage extension to start staging your projects directly from VS Code or Cursor.
                  </p>
                </div>
              </div>
              
              <div className="space-y-6">
                

                
                {/* Status and Download Info on same row */}
                <div className="flex flex-col lg:flex-row gap-4 mb-6">
                  {/* Status Section (Dynamic Color) */}
                  <div className="flex-1">
                    <div className={`border rounded-lg p-4 h-full flex items-center ${
                      needsUpdate 
                        ? 'bg-yellow-50 border-yellow-200' 
                        : lastDownloadedVersion 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-blue-50 border-blue-200'
                    }`}>
                      <svg className={`w-5 h-5 mr-2 flex-shrink-0 ${
                        needsUpdate 
                          ? 'text-yellow-600' 
                          : lastDownloadedVersion 
                            ? 'text-green-600' 
                            : 'text-blue-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {needsUpdate ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        ) : lastDownloadedVersion ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        )}
                      </svg>
                      <div>
                        <div className={`text-sm font-medium ${
                          needsUpdate 
                            ? 'text-yellow-800' 
                            : lastDownloadedVersion 
                              ? 'text-green-800' 
                              : 'text-blue-800'
                        }`}>
                          {needsUpdate ? 'Update Available!' : lastDownloadedVersion ? 'Up to Date!' : 'First Time Install'}
                        </div>
                        <div className={`text-xs ${
                          needsUpdate 
                            ? 'text-yellow-600' 
                            : lastDownloadedVersion 
                              ? 'text-green-600' 
                              : 'text-blue-600'
                        }`}>
                          {needsUpdate 
                            ? `New version ${currentVersion} available. You have downloaded version ${lastDownloadedVersion}.`
                            : lastDownloadedVersion 
                              ? `You have downloaded the latest version (${currentVersion}).`
                              : `Download version ${currentVersion} to get started.`
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Download Info Section (Blue) */}
                  <div className="flex-1">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 h-full flex items-start">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-blue-800 mb-1">Download Information</div>
                        <div className="text-xs text-blue-700">
                          After downloading the extension, you can install it in VS Code or Cursor.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center mb-6">
                  {user?.canAccessPro ? (
                    /* Pro User - Show all buttons in a grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* VSIX Download Button */}
                      <button
                        onClick={() => handleDownloadExtension()}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-lg">Download Extension</span>
                      </button>

                      {/* Installation Instructions Button */}
                      <button
                        onClick={() => handleShowInstructions()}
                        className="bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg border border-gray-300 flex items-center justify-center space-x-3"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-lg">Installation Instructions</span>
                      </button>

                      {/* AI Dev Instructions Button */}
                      <button
                        onClick={() => handleShowAIInstructions()}
                        className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="text-lg">AI Dev Instructions</span>
                      </button>

                      {/* Tokens Button */}
                      <button
                        onClick={() => handleShowPATModal()}
                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="text-lg">Tokens</span>
                      </button>
                    </div>
                  ) : (
                    /* Free User - Show only the disabled download button, centered */
                    <button
                      disabled
                      className="bg-gradient-to-r from-gray-400 to-gray-500 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center space-x-3 cursor-not-allowed opacity-75"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-lg">Go Pro to Download</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Instructions Modal */}
        {showInstallInstructions && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Installation Instructions
                  </h3>
                  <button
                    onClick={() => setShowInstallInstructions(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Step 1: Install the Extension</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</div>
                        <div>
                          <p className="text-sm text-gray-700">Open VS Code or Cursor</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">2</div>
                        <div>
                          <p className="text-sm text-gray-700">Press <code className="bg-gray-200 px-1 rounded text-xs">Ctrl+Shift+P</code> (Windows/Linux) or <code className="bg-gray-200 px-1 rounded text-xs">Cmd+Shift+P</code> (Mac) to open Command Palette</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</div>
                        <div>
                          <p className="text-sm text-gray-700">Type <code className="bg-gray-200 px-1 rounded text-xs">Extensions: Install from VSIX...</code> and press Enter</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">4</div>
                        <div>
                          <p className="text-sm text-gray-700">Navigate to and select the downloaded <code className="bg-gray-200 px-1 rounded text-xs">quickstage-{currentVersion}.vsix</code> file</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">5</div>
                        <div>
                          <p className="text-sm text-gray-700">Click "Install" when prompted</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Step 2: Restart VS Code/Cursor</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-700">After installation, you'll be prompted to restart VS Code or Cursor. Click "Reload" to activate the extension.</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Step 3: Use QuickStage</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">1</div>
                        <div>
                          <p className="text-sm text-gray-700">Open your project folder in VS Code/Cursor</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">2</div>
                        <div>
                          <p className="text-sm text-gray-700">Press <code className="bg-gray-200 px-1 rounded text-xs">Ctrl+Shift+P</code> (Windows/Linux) or <code className="bg-gray-200 px-1 rounded text-xs">Cmd+Shift+P</code> (Mac)</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">3</div>
                        <div>
                          <p className="text-sm text-gray-700">Type <code className="bg-gray-200 px-1 rounded text-xs">QuickStage: Stage</code> and press Enter</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">4</div>
                        <div>
                          <p className="text-sm text-gray-700">The extension will build your project and create a shareable snapshot</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Pro Tip</h4>
                    <p className="text-sm text-blue-800">
                      Make sure your project has a build script in <code className="bg-blue-100 px-1 rounded text-xs">package.json</code>. 
                      QuickStage supports Vite, Create React App, SvelteKit, and Next.js projects.
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-2">⚠️ Important Notes</h4>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      <li>• The extension requires Node.js 18+ with corepack enabled</li>
                      <li>• Your project must have a valid build script</li>
                      <li>• Snapshots are password-protected by default</li>
                      <li>• Files are automatically cleaned up after 7 days</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowInstallInstructions(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Instructions Modal */}
        {showAIInstructions && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    AI Assistant Instructions
                  </h3>
                  <button
                    onClick={() => setShowAIInstructions(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 mb-2">🎯 How to Use This</h4>
                    <p className="text-sm text-purple-800">
                      Copy the instructions below and paste them into your AI assistant (like ChatGPT, Claude, or Cursor's AI). 
                      This will give the AI the perfect context to help you build an interactive prototype.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Copy-Paste Instructions for AI Assistant</h4>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm leading-relaxed">
                      <div className="mb-4">
                        I want to build and deploy an interactive prototype using QuickStage. Here's what I need:
                      </div>
                      
                      <div className="mb-4">
                        <strong>Project Goal:</strong> [DESCRIBE YOUR PROTOTYPE HERE - what functionality, user experience, or concept you want to demonstrate]
                      </div>
                      
                      <div className="mb-4">
                        <strong>Target Users:</strong> [WHO will use this prototype - stakeholders, engineers, designers, etc.]
                      </div>
                      
                      <div className="mb-4">
                        <strong>Key Features:</strong> [LIST the main interactive elements, pages, or functionality you want to showcase]
                      </div>
                      
                      <div className="mb-4">
                        <strong>Design Preferences:</strong> [MENTION any specific design style, framework preferences, or visual requirements]
                      </div>
                      
                      <div className="mb-4">
                        <strong>Technical Requirements:</strong>
                        • Must be a web-based prototype that can be built and deployed
                        • Should use modern web technologies (React, Vue, Svelte, or vanilla HTML/CSS/JS)
                        • Must have a build script in package.json for QuickStage compatibility
                        • Should be lightweight and fast-loading
                        • Must work in modern browsers
                      </div>
                      
                      <div className="mb-4">
                        <strong>QuickStage Integration:</strong>
                        • The prototype will be deployed using QuickStage for easy sharing
                        • Should generate static files that can be served from a CDN
                        • Must be compatible with QuickStage's build and deployment process
                        • Should include all necessary assets (CSS, JS, images) in the build output
                      </div>
                      
                      <div className="mb-4">
                        <strong>Expected Output:</strong>
                        • A complete, working web application
                        • Clear build instructions
                        • All source code and assets
                        • Instructions for testing the prototype locally
                      </div>
                      
                      <div>
                        Please create this prototype step by step, ensuring it's production-ready and can be easily built and deployed. Focus on creating a polished, interactive experience that clearly demonstrates the concept.
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">💡 Pro Tips for AI Collaboration</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Be specific about the user experience you want to create</li>
                      <li>• Mention any existing design systems or brand guidelines</li>
                      <li>• Specify if you want mobile-responsive design</li>
                      <li>• Ask the AI to explain any technical decisions it makes</li>
                      <li>• Request step-by-step build instructions</li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-2">⚠️ Important Notes</h4>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      <li>• The AI will create the code, but you'll need to build and deploy it</li>
                      <li>• Make sure the project has a valid build script in package.json</li>
                      <li>• Test the prototype locally before staging with QuickStage</li>
                      <li>• The AI should focus on functionality, not complex backend features</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <button
                    id="copy-ai-instructions"
                    onClick={() => copyToClipboard(`I want to build and deploy an interactive prototype using QuickStage. Here's what I need:

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

Please create this prototype step by step, ensuring it's production-ready and can be easily built and deployed. Focus on creating a polished, interactive experience that clearly demonstrates the concept.`)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy Instructions</span>
                  </button>
                  
                  <button
                    onClick={() => setShowAIInstructions(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Snapshots Section */}
        <div className="px-4 sm:px-0">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Your Snapshots ({filteredSnapshots.length})
                </h3>
                
                {/* Filter Toggle */}
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">Filter:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setFilterType('active')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        filterType === 'active'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        filterType === 'all'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      All
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Success Message */}
            {showSuccessMessage && (
              <div className="px-6 py-4">
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {showSuccessMessage}
                </div>
              </div>
            )}

            {/* Error Message */}
            {showErrorMessage && (
              <div className="px-6 py-4">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {showErrorMessage}
                </div>
              </div>
            )}

            {error && (
              <div className="px-6 py-4">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              </div>
            )}

            {snapshots.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No snapshots yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Use the QuickStage extension in VS Code to create your first snapshot.
                </p>
                <div className="text-sm text-gray-400">
                  <p>1. Install the QuickStage extension</p>
                  <p>2. Open your project in VS Code</p>
                  <p>3. Click "QuickStage: Stage" in the command palette</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Snapshot
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Views
                      </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Password
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSnapshots.map((snapshot) => {
                      const daysUntilExpiry = getDaysUntilExpiry(snapshot.expiresAt);
                      const expiryColor = getExpiryColor(daysUntilExpiry);
                      const expired = isExpired(snapshot.expiresAt);
                      
                      return (
                        <tr key={snapshot.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Snapshot {snapshot.id.slice(0, 8)}
                              </div>
                              <button
                                onClick={() => handleCopyUrl(snapshot.id)}
                                className="text-green-600 hover:text-green-900 text-sm flex items-center space-x-1 transition-colors"
                              >
                                <span>Copy URL</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(snapshot.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${expired ? 'text-red-600' : expiryColor}`}>
                              {expired ? 'Expired' : `${daysUntilExpiry} days`}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {snapshot.viewCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {snapshot.password ? (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => copyPasswordToClipboard(snapshot.password!)}
                                  className="bg-gray-100 px-2 py-1 rounded text-xs hover:bg-gray-200 transition-colors cursor-pointer font-mono"
                                  title="Click to copy password"
                                >
                                  {snapshot.password}
                                </button>
                                <button
                                  onClick={() => copyPasswordToClipboard(snapshot.password!)}
                                  className="text-gray-500 hover:text-gray-700 transition-colors"
                                  title="Copy password"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-500">No password</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <a
                              href={snapshot.password ? `${config.getSnapshotUrl(snapshot.id)}?p=${encodeURIComponent(snapshot.password)}` : config.getSnapshotUrl(snapshot.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-900 mr-2"
                            >
                              View
                            </a>

                            <button 
                              onClick={() => handleExtendSnapshot(snapshot.id)}
                              className="text-gray-600 hover:text-gray-900 mr-2"
                            >
                              {expired ? 'Renew' : 'Extend'}
                            </button>
                            <button 
                              onClick={() => handleExpireSnapshot(snapshot.id)}
                              className="text-red-600 hover:text-red-900 mr-2"
                            >
                              Expire
                            </button>
                            <button 
                              onClick={() => handleRotatePassword(snapshot.id)}
                              className="text-purple-600 hover:text-purple-900"
                            >
                              New Password
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAT Management Modal */}
            {showPATModal && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        Personal Access Tokens for VS Code/Cursor Extension
                      </h3>
                      <button
                        onClick={() => setShowPATModal(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2">🔑 How to Use PATs</h4>
                        <p className="text-sm text-blue-800">
                          Generate a Personal Access Token and use it in your VS Code/Cursor extension. 
                          This will authenticate your extension with QuickStage permanently.
                        </p>
                      </div>

                      {/* Generate New PAT */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Generate New Token</h4>
                        <button
                          onClick={handleGeneratePAT}
                          disabled={isGeneratingPAT}
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                        >
                          {isGeneratingPAT ? (
                            <>
                              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <span>Generate New Token</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* New PAT Display */}
                      {newPAT && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">New Token Generated</h4>
                          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm break-all">
                            {newPAT}
                          </div>
                          <p className="text-sm text-red-600 mt-2">
                            ⚠️ Copy this token now! It won't be shown again.
                          </p>
                          <button
                            onClick={() => copyToClipboard(newPAT)}
                            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy Token</span>
                          </button>
                        </div>
                      )}

                      {/* Existing PATs */}
                      {existingPATs.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3">Existing Tokens</h4>
                          <div className="space-y-3">
                            {existingPATs.map((pat) => (
                              <div key={pat.id} className="border rounded-lg p-3 bg-gray-50">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {pat.description}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Created: {new Date(pat.createdAt).toLocaleDateString()}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Expires: {new Date(pat.expiresAt).toLocaleDateString()}
                                    </p>
                                    {pat.lastUsed && (
                                      <p className="text-xs text-gray-500">
                                        Last used: {new Date(pat.lastUsed).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleRevokePAT(pat.id)}
                                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  >
                                    Revoke
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={() => setShowPATModal(false)}
                          className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


