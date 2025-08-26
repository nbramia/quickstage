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

        {/* Users Table */}
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
      </div>
    </div>
  );
}
