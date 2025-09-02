import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, adminApi } from '../api';
import { useSidebar } from '../hooks/useSidebar';
import ProjectSidebar from '../components/ProjectSidebar';
import NotificationBell from '../components/NotificationBell';
import SubscriptionManager from '../components/SubscriptionManager';
import '../fonts.css';

export function Settings() {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading, cancelSubscription } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Use centralized sidebar logic
  const {
    projects,
    selectedProjectId,
    handleSelectProject,
    loadProjects,
    isSidebarCollapsed,
    handleToggleSidebar
  } = useSidebar();

  // Debug logging
  useEffect(() => {
    console.log('Settings - Current user object:', user);
    console.log('Settings - User subscription details:', {
      plan: user?.plan,
      subscriptionStatus: user?.subscriptionStatus,
      subscriptionDisplay: user?.subscriptionDisplay,
      canAccessPro: user?.canAccessPro,
      role: user?.role
    });
  }, [user]);
  
  // Track page view
  useEffect(() => {
    const trackPageView = async () => {
      try {
        await api.post('/analytics/track', {
          eventType: 'page_view',
          eventData: { page: 'Settings' }
        });
      } catch (error) {
        console.error('Failed to track page view:', error);
      }
    };
    
    trackPageView();
  }, []);

  const handleUpgrade = () => {
    // Navigate to pricing page to select plan
    const mode = (user?.subscription?.status || user?.subscriptionStatus) === 'trial' ? 'upgrade' : 'trial';
    navigate(`/pricing?mode=${mode}`);
  };

  const handleManageBilling = async () => {
    try {
      setError(null);
      const response = await api.post('/billing/portal');
      if (response.url) {
        window.location.href = response.url;
      } else {
        setError('No billing portal URL received');
      }
    } catch (error) {
      console.error('Billing portal error:', error);
      setError('Failed to open billing portal');
    }
  };

  const handleChangePaymentMethod = async () => {
    try {
      setError(null);
      const response = await api.post('/billing/change-payment');
      if (response.url) {
        window.location.href = response.url;
      } else {
        setError('No payment update URL received');
      }
    } catch (error) {
      console.error('Payment method update error:', error);
      setError('Failed to update payment method');
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your Pro subscription? You will retain access until the end of your current billing period.')) {
      return;
    }
    
    try {
      setError(null);
      const result = await cancelSubscription();
      if (result.ok) {
        setSuccessMessage(result.message || 'Subscription cancelled successfully');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(result.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Cancel subscription error:', error);
      setError('Failed to cancel subscription');
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleDeleteAccount = async () => {
    if (!confirm(`⚠️  DANGER: Are you absolutely sure you want to PERMANENTLY DELETE your account "${user?.name || user?.email}"?\n\nThis will:\n• Remove all your data from the system\n• Delete all your snapshots\n• Delete all your PATs\n• Delete all your comments\n• This action CANNOT be undone!\n\nType "DELETE" to confirm:`)) {
      return;
    }
    
    const confirmation = prompt('Type "DELETE" to confirm permanent deletion:');
    if (confirmation !== 'DELETE') {
      alert('Deletion cancelled. Your data is safe.');
      return;
    }
    
    try {
      setError(null);
      await adminApi.deleteUser(user!.uid);
      setSuccessMessage('Your account has been completely deleted from the system. You will be redirected to the login page.');
      
      // Wait a moment for the user to see the success message, then logout and redirect
      setTimeout(() => {
        logout();
        window.location.href = '/login';
      }, 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to delete account');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-poppins">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-poppins">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 font-inconsolata">Authentication Required</h2>
          <p className="text-gray-600 mb-6">You need to be logged in to access your account settings.</p>
          <Link
            to="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-poppins">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="flex items-center">
                <span className="text-xl font-share-tech-mono font-bold text-gray-900">QuickStage</span>
              </Link>
              
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="ml-4 p-2 rounded-md text-gray-600 hover:bg-gray-100 lg:hidden"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-700">{user.name}</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {user.subscriptionDisplay || 'Free'}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-gray-500"
                  title="Sign out"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} lg:block flex-shrink-0`}>
          <ProjectSidebar
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={handleSelectProject}
            onRefreshProjects={loadProjects}
            user={user}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
          />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 font-inconsolata">Account Settings</h2>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            Manage your account, plan, and preferences.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-4 sm:px-0 mb-6">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="px-4 sm:px-0 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">{successMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Account Information Card */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-0 sm:mr-4 flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 font-inconsolata">Account Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Name/Username */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <div className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-gray-900">{user.name || 'Not provided'}</p>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <div className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-gray-900">{user.email}</p>
                </div>
              </div>

              {/* User ID */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">User ID</label>
                <div className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-gray-900">{user.uid}</p>
                </div>
              </div>

              {/* Staging Since */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Staging Since</label>
                <div className="bg-gray-50 rounded-lg px-4 py-3">
                  <p className="text-gray-900">{new Date(user.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>
                </div>
              </div>

              {/* Current Plan */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Current Plan</label>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg px-4 py-3 border border-blue-100">
                  <p className="text-blue-900 font-semibold">{user.subscriptionDisplay || 'Free'}</p>
                </div>
              </div>

              {/* Next Billing Date - Only show for active plans */}
              {((user.subscription?.status || user.subscriptionStatus) === 'active' || (user.subscription?.status || user.subscriptionStatus) === 'trial') && user.nextBillingDate && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Next Billing</label>
                  <div className="bg-green-50 rounded-lg px-4 py-3 border border-green-100">
                    <p className="text-green-900 font-medium">{new Date(user.nextBillingDate).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</p>
                    {user.nextBillingAmount !== null && user.nextBillingAmount !== undefined && (
                      <p className="text-green-700 text-sm mt-1">
                        Amount: {user.nextBillingAmount === 0 ? 'Free' : `$${(user.nextBillingAmount / 100).toFixed(2)}`}
                      </p>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Plan Management */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 font-inconsolata">Plan Management</h3>
            
            {user.role === 'superadmin' ? (
              <div>
                <div className="mb-4">
                  <p className="text-purple-600 font-medium mb-2">
                    ✓ Pro (Superadmin) - Permanent Access
                  </p>
                  <p className="text-gray-600 text-sm">
                    As a superadmin, you have permanent access to all Pro features without any subscription requirements.
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  No billing management needed - your access is permanent.
                </div>
              </div>
            ) : !(user.subscription?.status || user.subscriptionStatus) || (user.subscription?.status || user.subscriptionStatus) === 'none' ? (
              <div>
                <p className="text-gray-600 mb-4">
                  Upgrade to Pro for unlimited snapshots, larger file sizes, and extended expiry times.
                </p>
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {upgrading ? 'Processing...' : 'Upgrade to Pro'}
                </button>
              </div>
            ) : (user.subscription?.status || user.subscriptionStatus) === 'trial' ? (
              <div>
                <div className="mb-4">
                  <p className="text-blue-600 font-medium mb-2">
                    ✓ Pro (Trial) - Active
                  </p>
                  <p className="text-gray-600 text-sm">
                    You're currently on a 7-day free trial of the Pro plan. Enjoy unlimited snapshots, 100MB per snapshot, and up to 90-day expiry times.
                  </p>
                  {(user.subscription?.trialEnd || user.trialEndsAt) && (
                    <p className="text-sm text-gray-500 mt-2">
                      Trial ends: {new Date(user.subscription?.trialEnd || user.trialEndsAt!).toLocaleDateString()}
                    </p>
                  )}
                  {user.nextBillingDate && (
                    <div className="text-sm text-gray-500 mt-2">
                      <p>Next billing: {new Date(user.nextBillingDate).toLocaleDateString()}</p>
                      {user.nextBillingAmount !== null && user.nextBillingAmount !== undefined && (
                        <p>Amount: {user.nextBillingAmount === 0 ? 'Free' : `$${(user.nextBillingAmount / 100).toFixed(2)}`}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleChangePaymentMethod}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Change Payment Method
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>
            ) : (user.subscription?.status || user.subscriptionStatus) === 'active' ? (
              <div>
                <div className="mb-4">
                  <p className="text-green-600 font-medium mb-2">
                    ✓ Pro - Active Subscription
                  </p>
                  <p className="text-gray-600 text-sm">
                    You have full access to all Pro features: unlimited snapshots, 100MB per snapshot, and up to 90-day expiry times.
                  </p>
                  {user.nextBillingDate && (
                    <div className="text-sm text-gray-500 mt-2">
                      <p>Next billing: {new Date(user.nextBillingDate).toLocaleDateString()}</p>
                      {user.nextBillingAmount !== null && user.nextBillingAmount !== undefined && (
                        <p>Amount: {user.nextBillingAmount === 0 ? 'Free' : `$${(user.nextBillingAmount / 100).toFixed(2)}`}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleChangePaymentMethod}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Change Payment Method
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>
            ) : (user.subscription?.status || user.subscriptionStatus) === 'cancelled' ? (
              <div>
                <p className="text-orange-600 font-medium mb-2">
                  ⚠️ Pro (Cancelled)
                </p>
                <p className="text-gray-600 text-sm mb-4">
                  Your subscription has been cancelled. You will retain access to Pro features until the end of your current billing period.
                </p>
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {upgrading ? 'Processing...' : 'Reactivate Pro'}
              </button>
              </div>
            ) : (user.subscription?.status || user.subscriptionStatus) === 'past_due' ? (
              <div>
                <p className="text-red-600 font-medium mb-2">
                  ⚠️ Pro (Payment Past Due)
                </p>
                <p className="text-gray-600 text-sm mb-4">
                  Your subscription payment is past due. Please update your payment method to continue access to Pro features.
                </p>
                <button
                  onClick={handleManageBilling}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Update Payment Method
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">
                  Upgrade to Pro for unlimited snapshots, larger file sizes, and extended expiry times.
                </p>
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {upgrading ? 'Processing...' : 'Upgrade to Pro'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Comment Subscriptions */}
        <div className="mb-6 sm:mb-8">
          <SubscriptionManager className="w-full" />
        </div>

        {/* Account Actions */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-8">
            <div className="flex items-center mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 font-inconsolata">Account Actions</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={handleLogout}
                className="bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors shadow-md flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
              <button 
                onClick={handleDeleteAccount}
                className="bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors shadow-md flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Account
              </button>
            </div>
          </div>
        </div>
        </div>
        </main>
      </div>
    </div>
  );
}
