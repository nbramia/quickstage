import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import config from '../config';
import { Project, Snapshot } from '../types/dashboard';
import NotificationBell from '../components/NotificationBell';
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [selectedSnapshots, setSelectedSnapshots] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState('');
  const [showErrorMessage, setShowErrorMessage] = useState('');
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Extension and PAT state
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [showAIInstructions, setShowAIInstructions] = useState(false);
  const [showPATModal, setShowPATModal] = useState(false);
  const [newPAT, setNewPAT] = useState('');
  const [existingPATs, setExistingPATs] = useState<any[]>([]);
  const [isGeneratingPAT, setIsGeneratingPAT] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');
  const [lastDownloadedVersion, setLastDownloadedVersion] = useState('');
  const [needsUpdate, setNeedsUpdate] = useState(false);

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
      } else if (billingParam === 'success' || successParam === 'true') {
        setShowSuccessMessage('Subscription activated! You now have full access to Pro features.');
      }
      
      setTimeout(() => setShowSuccessMessage(''), 5000);
    }
  }, [searchParams, refreshUser, setSearchParams]);

  useEffect(() => {
    loadData();
    loadExtensionData();
  }, []);

  // Track analytics
  useEffect(() => {
    const trackPageView = async () => {
      try {
        await api.post('/analytics/track', {
          eventType: 'page_view',
          eventData: { page: 'Dashboard' }
        });
      } catch (error) {
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
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExtensionData = async () => {
    // Load saved user preferences
    const downloadedVersion = localStorage.getItem('quickstage-downloaded-version');
    if (downloadedVersion) {
      setLastDownloadedVersion(downloadedVersion);
    }
    
    // Check for updates
    try {
      const response = await fetch(config.VERSION_INFO_URL);
      if (response.ok) {
        const versionInfo = await response.json();
        setCurrentVersion(versionInfo.version);
        
        if (lastDownloadedVersion && lastDownloadedVersion !== versionInfo.version) {
          setNeedsUpdate(true);
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  };

  const handleExtendSnapshot = async (snapshotId: string) => {
    try {
      await api.post(`/api/snapshots/${snapshotId}/extend`);
      loadData(); // Refresh data
      showSuccess('Snapshot extended successfully');
    } catch (error) {
      showError('Failed to extend snapshot');
    }
  };

  // Filter snapshots by selected project
  const filteredSnapshots = selectedProjectId 
    ? snapshots.filter(s => s.projectId === selectedProjectId)
    : snapshots;

  // Bulk selection handlers
  const handleToggleSelect = (snapshotId: string) => {
    const newSelected = new Set(selectedSnapshots);
    if (newSelected.has(snapshotId)) {
      newSelected.delete(snapshotId);
    } else {
      newSelected.add(snapshotId);
    }
    setSelectedSnapshots(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedSnapshots(new Set(filteredSnapshots.map(s => s.id)));
    } else {
      setSelectedSnapshots(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedSnapshots(new Set());
  };

  // Helper functions
  const showSuccess = (message: string) => {
    setShowSuccessMessage(message);
    setTimeout(() => setShowSuccessMessage(''), 3000);
  };

  const showError = (message: string) => {
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
    } catch (error: any) {
      showError(error.message || 'Failed to open billing portal');
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const getSubscriptionStatus = () => {
    return user?.subscriptionDisplay || 'Pro';
  };

  const canUpgrade = () => {
    // Superadmin accounts never need to upgrade
    if (user?.role === 'superadmin') return false;
    
    // Use new schema with fallbacks to legacy fields
    const subscriptionStatus = user?.subscription?.status || user?.subscriptionStatus || 'none';
    
    // Trial users don't need to upgrade - they already have Pro access
    if (subscriptionStatus === 'trial') return false;
    
    // User can upgrade if they have no subscription status or are on a cancelled/past due subscription
    return user && (!subscriptionStatus || 
                   subscriptionStatus === 'none' || 
                   subscriptionStatus === 'cancelled' || 
                   subscriptionStatus === 'past_due');
  };

  // Extension management functions
  const handleDownloadExtension = () => {
    const primaryUrl = `${window.location.origin}${config.EXTENSION_DOWNLOAD_URL}`;
    const backupUrl = `${window.location.origin}${config.API_BASE_URL}/extensions/download`;
    
    downloadToDefaultLocation(primaryUrl, backupUrl);
    
    setTimeout(() => {
      setShowInstallInstructions(true);
    }, 1000);
  };

  const downloadToDefaultLocation = async (primaryUrl: string, backupUrl?: string) => {
    try {
      const response = await fetch(primaryUrl, { method: 'HEAD' });
      
      let downloadUrl = primaryUrl;
      
      if (!response.ok && backupUrl) {
        console.warn('Primary download URL failed, using backup');
        const backupResponse = await fetch(backupUrl, { method: 'HEAD' });
        if (backupResponse.ok) {
          downloadUrl = backupUrl;
        }
      }
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `quickstage-${currentVersion}.vsix`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      if (currentVersion) {
        localStorage.setItem('quickstage-downloaded-version', currentVersion);
        setLastDownloadedVersion(currentVersion);
        setNeedsUpdate(false);
        
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
        } catch (error) {
          console.error('Failed to track extension download:', error);
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleShowPATModal = async () => {
    try {
      const response = await api.get('/tokens/list');
      setExistingPATs(response.pats || []);
      setShowPATModal(true);
    } catch (error) {
      console.error('Failed to load PATs:', error);
      setShowPATModal(true);
    }
  };

  const handleGeneratePAT = async () => {
    setIsGeneratingPAT(true);
    try {
      const data = await api.post('/tokens/create', {});
      setNewPAT(data.token);
      const listData = await api.get('/tokens/list');
      setExistingPATs(listData.pats || []);
    } catch (error) {
      console.error('Failed to generate PAT:', error);
    } finally {
      setIsGeneratingPAT(false);
    }
  };

  const handleRevokePAT = async (patId: string) => {
    try {
      await api.delete(`/tokens/${patId}`);
      const listData = await api.get('/tokens/list');
      setExistingPATs(listData.pats || []);
    } catch (error) {
      console.error('Failed to revoke PAT:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  QuickStage
                </span>
              </Link>
              
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="ml-4 p-2 rounded-md text-gray-600 hover:bg-gray-100 lg:hidden"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Navigation Links */}
              <nav className="hidden md:flex items-center space-x-4">
                <Link
                  to="/dashboard"
                  className="text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  to="/settings"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Settings
                </Link>
                {user?.role === 'superadmin' && (
                  <Link
                    to="/admin"
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                  >
                    🛡️ Admin
                  </Link>
                )}
              </nav>

              {/* Notifications */}
              <NotificationBell className="relative" />

              {/* Subscription Status */}
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {getSubscriptionStatus()}
              </div>
              
              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-700">Welcome back, {user.name}!</span>
                <button
                  onClick={logout}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Success/Error Messages */}
      {(showSuccessMessage || showErrorMessage) && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`p-4 rounded-md ${
            showSuccessMessage ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {showSuccessMessage || showErrorMessage}
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Project Sidebar */}
        <div className={`${sidebarCollapsed ? 'hidden' : 'block'} lg:block flex-shrink-0`}>
          <ProjectSidebar
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onRefreshProjects={loadData}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">{error}</div>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* Page Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {selectedProjectId 
                        ? projects.find(p => p.id === selectedProjectId)?.name || 'Project'
                        : 'Dashboard'
                      }
                    </h1>
                    <p className="text-gray-600">
                      {filteredSnapshots.length} snapshot{filteredSnapshots.length !== 1 ? 's' : ''}
                      {selectedProjectId && projects.find(p => p.id === selectedProjectId)?.description && (
                        <span> • {projects.find(p => p.id === selectedProjectId)?.description}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    {canUpgrade() && (
                      <button
                        onClick={handleUpgradeToPro}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700"
                      >
                        Upgrade to Pro
                      </button>
                    )}
                  </div>
                </div>

                {/* Extension Download Section - Only show if viewing all snapshots */}
                {!selectedProjectId && (
                  <div className="mb-6">
                    <div className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">QuickStage Extension</h3>
                          <p className="text-sm text-gray-600">
                            Download the VS Code/Cursor extension to start staging your projects
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          {user?.canAccessPro ? (
                            <>
                              <button
                                onClick={handleDownloadExtension}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
                              >
                                Download Extension
                              </button>
                              <button
                                onClick={() => setShowInstallInstructions(true)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg"
                              >
                                Instructions
                              </button>
                              <button
                                onClick={() => setShowAIInstructions(true)}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg"
                              >
                                AI Assistant
                              </button>
                              <button
                                onClick={handleShowPATModal}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg"
                              >
                                Tokens
                              </button>
                            </>
                          ) : (
                            <button
                              disabled
                              className="bg-gray-400 text-white font-medium py-2 px-4 rounded-lg cursor-not-allowed"
                            >
                              Go Pro to Download
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Version Status */}
                      {currentVersion && (
                        <div className="mt-4 text-sm text-gray-600">
                          <span>Current version: {currentVersion}</span>
                          {needsUpdate && (
                            <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                              Update Available
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dashboard Widgets - only show if viewing all snapshots */}
                {!selectedProjectId && (
                  <DashboardWidgets
                    snapshots={snapshots}
                    onExtend={handleExtendSnapshot}
                  />
                )}

                {/* Snapshots Table */}
                <SnapshotTable
                  snapshots={filteredSnapshots}
                  onRefresh={loadData}
                  selectedSnapshots={selectedSnapshots}
                  onToggleSelect={handleToggleSelect}
                  onSelectAll={handleSelectAll}
                />

                {/* Bulk Operations */}
                <BulkOperations
                  selectedSnapshots={selectedSnapshots}
                  projects={projects}
                  onClearSelection={handleClearSelection}
                  onRefresh={loadData}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Installation Instructions Modal */}
      {showInstallInstructions && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Installation Instructions</h3>
                <button
                  onClick={() => setShowInstallInstructions(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Step 1: Install the Extension</h4>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                    <li>Open VS Code or Cursor</li>
                    <li>Press Ctrl+Shift+P (Windows/Linux) or Cmd+Shift+P (Mac)</li>
                    <li>Type "Extensions: Install from VSIX..." and press Enter</li>
                    <li>Select the downloaded quickstage-{currentVersion}.vsix file</li>
                    <li>Click "Install" when prompted</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Step 2: Configure Token</h4>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                    <li>Generate a Personal Access Token using the "Tokens" button</li>
                    <li>Copy the generated token (starts with qs_pat_)</li>
                    <li>In VS Code/Cursor, run "QuickStage: Set Token"</li>
                    <li>Paste your token when prompted</li>
                  </ol>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Step 3: Start Staging</h4>
                  <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
                    <li>Open your project folder</li>
                    <li>Run "QuickStage: Stage" from the command palette</li>
                    <li>Your project will be built and deployed automatically</li>
                  </ol>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowInstallInstructions(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg"
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
                <h3 className="text-lg font-medium text-gray-900">AI Assistant Instructions</h3>
                <button
                  onClick={() => setShowAIInstructions(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-2">🎯 How to Use This</h4>
                  <p className="text-sm text-purple-800">
                    Copy the instructions below and paste them into your AI assistant (ChatGPT, Claude, or Cursor's AI). 
                    This gives the AI perfect context to help you build interactive prototypes.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Copy-Paste Instructions</h4>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm">
                    <div className="whitespace-pre-line">
{`I want to build and deploy an interactive prototype using QuickStage. Here's what I need:

Project Goal: [DESCRIBE YOUR PROTOTYPE]
Target Users: [WHO will use this prototype]
Key Features: [LIST main interactive elements]
Design Preferences: [MENTION design style/framework preferences]

Technical Requirements:
• Web-based prototype that can be built and deployed
• Modern web technologies (React, Vue, Svelte, or vanilla HTML/CSS/JS)
• Build script in package.json for QuickStage compatibility
• Lightweight and fast-loading
• Modern browser compatibility

QuickStage Integration:
• Generate static files that can be served from CDN
• Compatible with QuickStage's build and deployment process
• Include all necessary assets in build output

Expected Output:
• Complete, working web application
• Clear build instructions
• All source code and assets
• Instructions for testing locally

Please create this step by step, ensuring it's production-ready and can be easily built and deployed.`}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => copyToClipboard(`I want to build and deploy an interactive prototype using QuickStage. Here's what I need:

Project Goal: [DESCRIBE YOUR PROTOTYPE]
Target Users: [WHO will use this prototype]
Key Features: [LIST main interactive elements]
Design Preferences: [MENTION design style/framework preferences]

Technical Requirements:
• Web-based prototype that can be built and deployed
• Modern web technologies (React, Vue, Svelte, or vanilla HTML/CSS/JS)
• Build script in package.json for QuickStage compatibility
• Lightweight and fast-loading
• Modern browser compatibility

QuickStage Integration:
• Generate static files that can be served from CDN
• Compatible with QuickStage's build and deployment process
• Include all necessary assets in build output

Expected Output:
• Complete, working web application
• Clear build instructions
• All source code and assets
• Instructions for testing locally

Please create this step by step, ensuring it's production-ready and can be easily built and deployed.`)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg"
                  >
                    Copy Instructions
                  </button>
                  
                  <button
                    onClick={() => setShowAIInstructions(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAT Management Modal */}
      {showPATModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Personal Access Tokens</h3>
                <button
                  onClick={() => {
                    setShowPATModal(false);
                    setNewPAT('');
                  }}
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
                    This authenticates your extension with QuickStage permanently.
                  </p>
                </div>

                {/* Generate New PAT */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Generate New Token</h4>
                  <button
                    onClick={handleGeneratePAT}
                    disabled={isGeneratingPAT}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
                  >
                    {isGeneratingPAT ? 'Generating...' : 'Generate New Token'}
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
                      className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
                    >
                      Copy Token
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

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowPATModal(false);
                      setNewPAT('');
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg"
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
  );
}