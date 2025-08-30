import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import config from '../config';
import { Project, Snapshot } from '../types/dashboard';
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

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case 'Pro': return 'text-green-600 bg-green-100';
      case 'Pro (Trial)': return 'text-blue-600 bg-blue-100';
      case 'Pro (Cancelled)': return 'text-orange-600 bg-orange-100';
      case 'Pro (Past Due)': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
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
              {/* Subscription Status */}
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${getSubscriptionStatusColor(getSubscriptionStatus())}`}>
                {getSubscriptionStatus()}
              </div>
              
              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-700">Welcome back, {user.name}!</span>
                <Link to="/settings" className="text-gray-600 hover:text-gray-900">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
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

                  {user?.canAccessPro === false && (
                    <button
                      onClick={handleUpgradeToPro}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700"
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>

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
    </div>
  );
}