import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

export function Settings() {
  const { user, logout, loading: authLoading, cancelSubscription } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      setError(null);
      const response = await api.post('/billing/checkout');
      if (response.url) {
        window.location.href = response.url;
      } else {
        setError('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setError('Checkout failed');
    } finally {
      setUpgrading(false);
    }
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">QuickStage</h1>
            </div>
            
            <nav className="flex items-center space-x-8">
              <Link
                to="/dashboard"
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/settings"
                className="text-blue-600 border-b-2 border-blue-600 px-3 py-2 text-sm font-medium"
              >
                Settings
              </Link>
              
              {/* User Menu */}
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{user.subscriptionDisplay || 'Pro'}</span>
                  <span className="text-gray-500 ml-2">Plan</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="px-4 sm:px-0 mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Account Settings</h2>
          <p className="mt-2 text-gray-600">
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

        {/* User Info Card */}
        <div className="px-4 sm:px-0 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">User ID</label>
                <p className="mt-1 text-sm text-gray-900 font-mono">{user.uid}</p>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
                  <span className="text-gray-600">Current Plan:</span>
                  <span className="font-semibold text-gray-900">{user.subscriptionDisplay || 'Pro'}</span>
                </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Member Since</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              {user.lastLoginAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Login</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(user.lastLoginAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plan Management */}
        <div className="px-4 sm:px-0 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Plan Management</h3>
            
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
            ) : !user.subscriptionStatus || user.subscriptionStatus === 'none' ? (
              <div>
                <p className="text-gray-600 mb-4">
                  Upgrade to Pro for unlimited snapshots, larger file sizes, and extended expiry times.
                </p>
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {upgrading ? 'Processing...' : 'Upgrade to Pro'}
                </button>
              </div>
            ) : user.subscriptionStatus === 'trial' ? (
              <div>
                <div className="mb-4">
                  <p className="text-blue-600 font-medium mb-2">
                    ✓ Pro (Trial) - Active
                  </p>
                  <p className="text-gray-600 text-sm">
                    You're currently on a 7-day free trial of the Pro plan. Enjoy unlimited snapshots, 100MB per snapshot, and up to 90-day expiry times.
                  </p>
                  {user.trialEndsAt && (
                    <p className="text-sm text-gray-500 mt-2">
                      Trial ends: {new Date(user.trialEndsAt).toLocaleDateString()}
                    </p>
                  )}
                  {user.nextBillingDate && (
                    <p className="text-sm text-gray-500 mt-2">
                      Next billing date: {new Date(user.nextBillingDate).toLocaleDateString()}
                    </p>
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
            ) : user.subscriptionStatus === 'active' ? (
              <div>
                <div className="mb-4">
                  <p className="text-green-600 font-medium mb-2">
                    ✓ Pro - Active Subscription
                  </p>
                  <p className="text-gray-600 text-sm">
                    You have full access to all Pro features: unlimited snapshots, 100MB per snapshot, and up to 90-day expiry times.
                  </p>
                  {user.nextBillingDate && (
                    <p className="text-sm text-gray-500 mt-2">
                      Next billing date: {new Date(user.nextBillingDate).toLocaleDateString()}
                    </p>
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
            ) : user.subscriptionStatus === 'cancelled' ? (
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
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {upgrading ? 'Processing...' : 'Reactivate Pro'}
                </button>
              </div>
            ) : user.subscriptionStatus === 'past_due' ? (
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
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {upgrading ? 'Processing...' : 'Upgrade to Pro'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Passkeys */}
        <div className="px-4 sm:px-0 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Passkeys</h3>
            {user.passkeys && user.passkeys.length > 0 ? (
              <div>
                <p className="text-gray-600 mb-4">
                  You have {user.passkeys.length} passkey{user.passkeys.length !== 1 ? 's' : ''} registered.
                </p>
                <div className="space-y-2">
                  {user.passkeys.map((passkey, index) => (
                    <div key={passkey.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          Passkey {index + 1}
                        </span>
                        <p className="text-xs text-gray-500">
                          Last used: {passkey.counter} times
                        </p>
                      </div>
                      <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">
                  No passkeys registered yet. You can register one from the login page.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Register Passkey
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 sm:px-0">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Actions</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Sign Out
              </button>
              <button className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
