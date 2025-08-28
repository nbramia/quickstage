import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, adminApi } from '../api';
import '../fonts.css';

interface AdminUser {
  uid: string;
  name: string;
  email: string;
  plan: 'free' | 'pro';
  role: 'user' | 'admin' | 'superadmin';
  createdAt: number;
  lastLoginAt?: number;
  totalSnapshots: number;
  activeSnapshots: number;
  status: 'active' | 'deactivated';
  
  // Subscription fields
  subscriptionStatus: 'Free Trial' | 'Pro' | 'Cancelled' | 'Past Due' | 'None' | 'Superadmin';
  canAccessPro: boolean;
  trialEndsAt?: number;
  subscriptionStartedAt?: number;
  lastPaymentAt?: number;
  stripeCustomerId?: string;
}

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserData, setCreateUserData] = useState<CreateUserData>({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  
  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'analytics'>('users');
  
  // Additional analytics data
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [snapshotAnalytics, setSnapshotAnalytics] = useState<any>(null);
  const [systemAnalytics, setSystemAnalytics] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  
  // Migration state
  const [migrationStats, setMigrationStats] = useState<any>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  // Check if user is superadmin
  if (!user || user.role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-poppins">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 font-inconsolata">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadUsers();
    loadAnalytics();
    loadMigrationStats();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/users');
      setUsers(response.users);
    } catch (error: any) {
      setError(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      
      // Load comprehensive analytics data
      const [statsResponse, usersResponse, snapshotsResponse, eventsResponse] = await Promise.all([
        api.get('/debug/stats'),
        api.get('/debug/users'),
        api.get('/debug/snapshots'),
        api.get('/debug/analytics/events?limit=50')
      ]);
      
      setAnalytics(statsResponse);
      setUserAnalytics(usersResponse);
      setSnapshotAnalytics(snapshotsResponse);
      setSystemAnalytics(statsResponse);
      
      // Process recent events from analytics events endpoint
      if (eventsResponse.events) {
        setRecentEvents(eventsResponse.events);
      }
      
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await api.post('/admin/users', createUserData);
      setShowSuccess('User created successfully!');
      setShowCreateUser(false);
      setCreateUserData({ name: '', email: '', password: '', role: 'user' });
      loadUsers();
    } catch (error: any) {
      setError(error.message || 'Failed to create user');
    }
  };

  const handleDeactivateUser = async (uid: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    
    try {
      setError(null);
      await api.post(`/admin/users/${uid}/deactivate`);
      setShowSuccess('User deactivated successfully!');
      loadUsers();
    } catch (error: any) {
      setError(error.message || 'Failed to deactivate user');
    }
  };

  const handleActivateUser = async (uid: string) => {
    try {
      setError(null);
      await api.post(`/admin/users/${uid}/activate`);
      setShowSuccess('User activated successfully!');
      loadUsers();
    } catch (error: any) {
      setError(error.message || 'Failed to activate user');
    }
  };

  const handleDeleteUser = async (uid: string, userName: string) => {
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
    } catch (error: any) {
      setError(error.message || 'Failed to delete user');
    }
  };

  const handleCleanupCorruptedUsers = async () => {
    if (!confirm('This will scan all users and fix any corrupted subscription data. Continue?')) {
      return;
    }
    
    try {
      setError(null);
      setLoading(true);
      const response = await adminApi.cleanupCorruptedUsers();
      setShowSuccess(`Cleanup completed! Fixed ${response.summary.fixedUsers} users with corrupted data.`);
      loadUsers(); // Refresh the user list
    } catch (error: any) {
      setError(error.message || 'Failed to cleanup corrupted users');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getPlanDisplay = (plan: string) => {
    switch (plan) {
      case 'pro':
        return 'Pro Monthly';
      case 'free':
        return 'Trial';
      default:
        return plan;
    }
  };

  const getSubscriptionStatusColor = (status: string) => {
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

  const getSubscriptionDisplay = (user: AdminUser) => {
    if (user.canAccessPro) {
      return (
        <div className="flex flex-col space-y-1">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionStatusColor(user.subscriptionStatus)}`}>
            {user.subscriptionStatus}
          </span>
          {user.trialEndsAt && (
            <span className="text-xs text-gray-500">
              Trial ends: {formatDate(user.trialEndsAt)}
            </span>
          )}
          {user.subscriptionStartedAt && (
            <span className="text-xs text-gray-500">
              Started: {formatDate(user.subscriptionStartedAt)}
            </span>
          )}
        </div>
      );
    }
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionStatusColor(user.subscriptionStatus)}`}>
        {user.subscriptionStatus}
      </span>
    );
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'text-green-600' : 'text-red-600';
  };

  // Analytics helper functions
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getTimeframeLabel = (timeframe: string) => {
    const labels = { '24h': 'Last 24 Hours', '7d': 'Last 7 Days', '30d': 'Last 30 Days' };
    return labels[timeframe as keyof typeof labels] || timeframe;
  };

  const loadMigrationStats = async () => {
    try {
      const response = await api.get('/debug/migration/stats');
      setMigrationStats(response);
    } catch (error: any) {
      console.error('Failed to load migration stats:', error);
    }
  };

  const runMigration = async (type: 'full' | 'users' | 'snapshots', dryRun: boolean = true) => {
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
      
    } catch (error: any) {
      setError(error.message || `Failed to run ${type} migration`);
    } finally {
      setMigrationLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-poppins">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-poppins">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-inconsolata">Admin Dashboard</h1>
              <p className="mt-2 text-gray-600">Manage QuickStage users and accounts</p>
            </div>
            <a
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>

        {/* Success/Error Messages */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{showSuccess}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setShowSuccess(null)}
                  className="inline-flex bg-green-50 rounded-md p-1.5 text-green-500 hover:bg-green-100"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Admin Actions */}
        <div className="mb-6 flex space-x-3">
          <button
            onClick={handleCleanupCorruptedUsers}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            title="Fix users with corrupted subscription data"
          >
            🔧 Cleanup Corrupted Users
          </button>
          <button
            onClick={() => setShowCreateUser(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Create New User
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Analytics & System Stats
            </button>
          </nav>
        </div>

        {/* Create User Modal */}
        {showCreateUser && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4 font-inconsolata">Create New User</h3>
                <form onSubmit={handleCreateUser}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={createUserData.name}
                      onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={createUserData.email}
                      onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={createUserData.password}
                      onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <select
                      value={createUserData.role}
                      onChange={(e) => setCreateUserData({ ...createUserData, role: e.target.value as 'user' | 'admin' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateUser(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                      Create User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' ? (
          /* Users Table */
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 font-inconsolata">Users ({users.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Snapshots
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.uid}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-xs text-gray-400">Role: {user.role}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}>
                        {user.status === 'active' ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSubscriptionDisplay(user)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.activeSnapshots}/{user.totalSnapshots}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-col space-y-2">
                        {user.status === 'active' ? (
                          <button
                            onClick={() => handleDeactivateUser(user.uid)}
                            className="text-red-600 hover:text-red-900 text-xs"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateUser(user.uid)}
                            className="text-green-600 hover:text-green-900 text-xs"
                          >
                            Activate
                          </button>
                        )}
                        
                        {/* Delete button - only show for non-superadmin users */}
                        {user.role !== 'superadmin' && (
                          <button
                            onClick={() => handleDeleteUser(user.uid, user.name)}
                            className="text-red-800 hover:text-red-900 text-xs font-bold border border-red-300 px-2 py-1 rounded bg-red-50 hover:bg-red-100"
                            title="Permanently delete user and all their data"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        ) : (
          /* Analytics Content */
          <div className="space-y-6">
            {/* Timeframe Selector */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 font-inconsolata">Analytics Timeframe</h3>
                <div className="flex space-x-2">
                  {(['24h', '7d', '30d'] as const).map((timeframe) => (
                    <button
                      key={timeframe}
                      onClick={() => setAnalyticsTimeframe(timeframe)}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        analyticsTimeframe === timeframe
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {getTimeframeLabel(timeframe)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* System Overview - Enhanced */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 font-inconsolata">🚀 System Overview</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Real-time system statistics and performance metrics</p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                {analyticsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading comprehensive analytics...</p>
                  </div>
                ) : analytics ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* System Health */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-500 rounded-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-blue-600 font-inconsolata">Total Users</p>
                          <p className="text-2xl font-bold text-blue-900">{formatNumber(analytics.system?.totalUsers || 0)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Snapshots */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center">
                        <div className="p-2 bg-purple-500 rounded-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6l.586-.586a2 2 0 012.828 0L20 8m-6-6L12.586 1.586a2 2 0 00-2.828 0L6 2m-6-6L1.586 1.586a2 2 0 00-2.828 0L2 2" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-purple-600 font-inconsolata">Total Snapshots</p>
                          <p className="text-2xl font-bold text-purple-900">{formatNumber(analytics.system?.totalSnapshots || 0)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Active Sessions */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-500 rounded-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-green-600 font-inconsolata">Active Sessions</p>
                          <p className="text-2xl font-bold text-green-900">{formatNumber(analytics.system?.activeSessions || 0)}</p>
                        </div>
                      </div>
                    </div>

                    {/* System Health */}
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                      <div className="flex items-center">
                        <div className="p-2 bg-orange-500 rounded-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-orange-600 font-inconsolata">System Health</p>
                          <p className="text-2xl font-bold text-orange-900">
                            {analyticsLoading ? '⏳ Loading...' : analytics ? '🟢 Healthy' : '❌ Error'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No analytics data available</p>
                    <button
                      onClick={loadAnalytics}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Refresh Analytics
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Subscription Analytics - Enhanced */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 font-inconsolata">💳 Subscription Analytics</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Detailed subscription breakdown and revenue insights</p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                {analytics ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Subscription Status */}
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
                      <h4 className="text-sm font-medium text-emerald-900 font-inconsolata mb-3">📊 Subscription Status</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-emerald-700">🆓 Free:</span>
                          <span className="font-semibold text-emerald-900 text-lg">{analytics.subscriptions?.free || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-emerald-700">🧪 Trial:</span>
                          <span className="font-semibold text-emerald-900 text-lg">{analytics.subscriptions?.trial || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-emerald-700">✅ Active:</span>
                          <span className="font-semibold text-emerald-900 text-lg">{analytics.subscriptions?.active || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-emerald-700">❌ Cancelled:</span>
                          <span className="font-semibold text-emerald-900 text-lg">{analytics.subscriptions?.cancelled || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-emerald-700">⚠️ Past Due:</span>
                          <span className="font-semibold text-emerald-900 text-lg">{analytics.subscriptions?.pastDue || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-emerald-700">👑 Superadmin:</span>
                          <span className="font-semibold text-emerald-900 text-lg">{analytics.subscriptions?.superadmin || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Revenue Metrics */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <h4 className="text-sm font-medium text-blue-900 font-inconsolata mb-3">💰 Revenue Metrics</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-700">Trial Users:</span>
                          <span className="font-semibold text-blue-900">{analytics.subscriptions?.trial || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-700">Conversion Rate:</span>
                          <span className="font-semibold text-blue-900">
                            {analytics.subscriptions?.active && analytics.subscriptions?.trial 
                              ? Math.round((analytics.subscriptions.active / (analytics.subscriptions.active + analytics.subscriptions.trial)) * 100)
                              : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-blue-700">Churn Rate:</span>
                          <span className="font-semibold text-blue-900">
                            {analytics.subscriptions?.cancelled && analytics.subscriptions?.active
                              ? Math.round((analytics.subscriptions.cancelled / (analytics.subscriptions.active + analytics.subscriptions.cancelled)) * 100)
                              : 0}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Growth Trends */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <h4 className="text-sm font-medium text-purple-900 font-inconsolata mb-3">📈 Growth Trends</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-purple-700">Total Users:</span>
                          <span className="font-semibold text-purple-900">{analytics.system?.totalUsers || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-purple-700">Active Subscriptions:</span>
                          <span className="font-semibold text-purple-900">{analytics.subscriptions?.active || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-purple-700">Trial Users:</span>
                          <span className="font-semibold text-purple-900">{analytics.subscriptions?.trial || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 font-inconsolata">📋 Recent Activity Feed</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Live feed of system events and user activities</p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                {recentEvents.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {recentEvents.map((event, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          event.type === 'user_login' ? 'bg-blue-100 text-blue-800' :
                          event.type === 'user_registered' ? 'bg-green-100 text-green-800' :
                          event.type === 'snapshot_created' ? 'bg-purple-100 text-purple-800' :
                          event.type === 'snapshot_viewed' ? 'bg-indigo-100 text-indigo-800' :
                          event.type === 'payment_succeeded' ? 'bg-emerald-100 text-emerald-800' :
                          event.type === 'error_occurred' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.type}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">
                            {event.description || `Event: ${event.type}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {event.userId ? `User: ${event.userId}` : 'System Event'}
                          </p>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No recent events available</p>
                    <button
                      onClick={loadAnalytics}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Refresh Events
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Data Migration System */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 font-inconsolata">🔄 Data Migration System</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Migrate legacy user and snapshot data to new schema</p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                {migrationStats ? (
                  <div className="space-y-6">
                    {/* Migration Status */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <h4 className="text-sm font-medium text-blue-900 font-inconsolata mb-3">📊 Migration Status</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-blue-700 mb-2">Users</div>
                          <div className="text-2xl font-bold text-blue-900">
                            {migrationStats.stats.migratedUsers}/{migrationStats.stats.totalUsers}
                          </div>
                          <div className="text-xs text-blue-600">
                            {migrationStats.stats.legacyUsers} legacy users remaining
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-blue-700 mb-2">Snapshots</div>
                          <div className="text-2xl font-bold text-blue-900">
                            {migrationStats.stats.migratedSnapshots}/{migrationStats.stats.totalSnapshots}
                          </div>
                          <div className="text-xs text-blue-600">
                            {migrationStats.stats.legacySnapshots} legacy snapshots remaining
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-sm text-blue-700 mb-1">
                          <span>Overall Progress</span>
                          <span>{migrationStats.summary.migrationProgress}%</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${migrationStats.summary.migrationProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Migration Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <button
                        onClick={() => runMigration('users', true)}
                        disabled={migrationLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 transition-colors"
                      >
                        {migrationLoading ? '⏳' : '👥'} Test User Migration
                      </button>
                      <button
                        onClick={() => runMigration('snapshots', true)}
                        disabled={migrationLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 transition-colors"
                      >
                        {migrationLoading ? '⏳' : '📸'} Test Snapshot Migration
                      </button>
                      <button
                        onClick={() => runMigration('full', true)}
                        disabled={migrationLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50 transition-colors"
                      >
                        {migrationLoading ? '⏳' : '🚀'} Test Full Migration
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('⚠️  FINAL CONFIRMATION: This will run the ACTUAL migration and update all legacy data to the new schema. This action cannot be undone. Are you absolutely sure?')) {
                            if (confirm('🚨 LAST CHANCE: This will permanently modify your database. Type "MIGRATE" to confirm:')) {
                              const confirmation = prompt('Type "MIGRATE" to confirm actual migration:');
                              if (confirmation === 'MIGRATE') {
                                runMigration('full', false);
                              } else {
                                alert('Migration cancelled. Data is safe.');
                              }
                            }
                          }
                        }}
                        disabled={migrationLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50 transition-colors font-bold"
                      >
                        {migrationLoading ? '⏳' : '🔥'} RUN ACTUAL MIGRATION
                      </button>
                    </div>

                    {/* Migration Results */}
                    {migrationResult && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 font-inconsolata mb-3">📋 Migration Results</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Migrated:</span>
                            <span className="font-semibold text-green-600">{migrationResult.result.migrated}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Errors:</span>
                            <span className="font-semibold text-red-600">{migrationResult.result.errors}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Duration:</span>
                            <span className="font-semibold text-gray-900">{migrationResult.result.duration}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Success:</span>
                            <span className={`font-semibold ${migrationResult.result.success ? 'text-green-600' : 'text-red-600'}`}>
                              {migrationResult.result.success ? '✅ Yes' : '❌ No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Loading migration statistics...</p>
                    <button
                      onClick={loadMigrationStats}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Refresh Migration Stats
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 font-inconsolata">🚀 Quick Actions & Debug Tools</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Direct access to system tools and data export</p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <a
                    href="/debug/stats"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                  >
                    📊 Raw Stats API
                  </a>
                  <a
                    href="/debug/export"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                  >
                    📥 Data Export
                  </a>
                  <a
                    href="/debug/analytics/events"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors"
                  >
                    📊 Analytics Events
                  </a>
                  <a
                    href="/debug/health"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors"
                  >
                    🏥 System Health
                  </a>
                  <button
                    onClick={loadAnalytics}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 transition-colors"
                  >
                    🔄 Refresh All Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
