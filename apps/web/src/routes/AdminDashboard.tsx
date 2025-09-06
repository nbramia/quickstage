import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, adminApi } from '../api';
import { useSidebar } from '../hooks/useSidebar';
import ProjectSidebar from '../components/ProjectSidebar';
import NotificationBell from '../components/NotificationBell';
import SnapshotDashboard from '../components/SnapshotDashboard';
import { Project, Snapshot } from '../types/dashboard';
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
  
  // Use centralized sidebar logic
  const {
    projects,
    selectedProjectId,
    isSidebarCollapsed,
    loadProjects,
    handleSelectProject,
    handleToggleSidebar
  } = useSidebar();
  
  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'snapshots'>('users');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Snapshots state
  const [adminSnapshots, setAdminSnapshots] = useState<Snapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [isUserFilterOpen, setIsUserFilterOpen] = useState(false);
  
  // Additional analytics data
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [snapshotAnalytics, setSnapshotAnalytics] = useState<any>(null);
  const [systemAnalytics, setSystemAnalytics] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  
  // Sorting state for user table
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sort function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort users based on current sort settings
  const sortedUsers = React.useMemo(() => {
    if (!sortField || !users.length) return users;

    return [...users].sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'email':
          aValue = a.email?.toLowerCase() || '';
          bValue = b.email?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'plan':
          aValue = a.plan || '';
          bValue = b.plan || '';
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
        case 'lastLoginAt':
          aValue = new Date(a.lastLoginAt || 0).getTime();
          bValue = new Date(b.lastLoginAt || 0).getTime();
          break;
        case 'totalSnapshots':
          aValue = a.totalSnapshots || 0;
          bValue = b.totalSnapshots || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, sortField, sortDirection]);

  // Sortable header component
  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            {sortDirection === 'asc' ? (
              <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
            ) : (
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            )}
          </svg>
        )}
        {sortField !== field && (
          <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        )}
      </div>
    </th>
  );
  
  // Activity feed filtering
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [pageFilter, setPageFilter] = useState<string>('all');
  
  // Time filtering
  const [timeFilterType, setTimeFilterType] = useState<'all' | 'before' | 'after' | 'between'>('all');
  const [timeFilterBefore, setTimeFilterBefore] = useState<string>('');
  const [timeFilterAfter, setTimeFilterAfter] = useState<string>('');
  const [timeFilterStart, setTimeFilterStart] = useState<string>('');
  const [timeFilterEnd, setTimeFilterEnd] = useState<string>('');
  
  // Dropdown open states
  const [isEventTypeOpen, setIsEventTypeOpen] = useState(false);
  const [isPageFilterOpen, setIsPageFilterOpen] = useState(false);
  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false);
  
  // Close all dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.custom-dropdown')) {
        setIsEventTypeOpen(false);
        setIsUserFilterOpen(false);
        setIsPageFilterOpen(false);
        setIsTimeFilterOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
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
    loadSnapshots();
    
    // Track page view
    const trackPageView = async () => {
      try {
        await api.post('/analytics/track', {
          eventType: 'page_view',
          eventData: { page: 'Admin Dashboard' }
        });
      } catch (error) {
        console.error('Failed to track page view:', error);
      }
    };
    
    trackPageView();
  }, []);
  
  // Reload analytics when timeframe changes
  useEffect(() => {
    if (analyticsTimeframe) {
      loadAnalytics();
    }
  }, [analyticsTimeframe]);

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

  const loadSnapshots = async () => {
    try {
      setSnapshotsLoading(true);
      setSnapshotsError(null);
      const response = await api.get('/admin/snapshots');
      setAdminSnapshots(response.snapshots || []);
    } catch (error: any) {
      setSnapshotsError(error.message || 'Failed to load snapshots');
    } finally {
      setSnapshotsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      
      // Load basic analytics data
      const [statsResponse, usersResponse, snapshotsResponse] = await Promise.all([
        api.get('/debug/stats'),
        api.get('/debug/users'),
        api.get('/debug/snapshots')
      ]);
      
      setAnalytics(statsResponse);
      setUserAnalytics(usersResponse);
      setSnapshotAnalytics(snapshotsResponse);
      setSystemAnalytics(statsResponse);
      
      // Simply get the most recent events - backend handles chronological ordering
      console.log('Loading most recent analytics events...');
      const eventsResponse = await api.get(`/debug/analytics/events?limit=500`);
      const foundEvents = eventsResponse?.events || [];
      console.log(`Loaded ${foundEvents.length} recent events`);
      
      setRecentEvents(foundEvents);
      
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

  // Filter events based on current filters
  const filteredEvents = recentEvents.filter(event => {
    // Skip malformed events
    if (!event || !event.eventType) {
      return false;
    }
    
    // Event type filter
    if (eventTypeFilter !== 'all' && event.eventType !== eventTypeFilter) {
      return false;
    }
    
    // User filter - handle both email format and direct userId
    if (userFilter !== 'all') {
      if (userFilter.includes('(') && userFilter.includes(')')) {
        // Extract userId from "email (userId)" format
        const userIdMatch = userFilter.match(/\(([^)]+)\)/);
        if (userIdMatch && event.userId !== userIdMatch[1]) {
          console.log('Filtered out by user filter (email format):', event.userId, 'vs', userIdMatch[1]);
          return false;
        }
      } else if (event.userId !== userFilter) {
        console.log('Filtered out by user filter:', event.userId, 'vs', userFilter);
        return false;
      }
    }
    
    // Page filter - check both event.page and event.eventData.page
    if (pageFilter !== 'all') {
      const eventPage = event.page || event.eventData?.page;
      if (eventPage !== pageFilter) {
        console.log('Filtered out by page filter:', eventPage, 'vs', pageFilter);
        return false;
      }
    }
    
    // Time filtering
    if (timeFilterType !== 'all' && event.timestamp) {
      const eventTime = event.timestamp;
      
      switch (timeFilterType) {
        case 'before':
          if (timeFilterBefore && eventTime >= new Date(timeFilterBefore).getTime()) {
            console.log('Filtered out by time (before):', eventTime, 'vs', new Date(timeFilterBefore).getTime());
            return false;
          }
          break;
        case 'after':
          if (timeFilterAfter && eventTime <= new Date(timeFilterAfter).getTime()) {
            console.log('Filtered out by time (after):', eventTime, 'vs', new Date(timeFilterAfter).getTime());
            return false;
          }
          break;
        case 'between':
          if (timeFilterStart && eventTime < new Date(timeFilterStart).getTime()) {
            console.log('Filtered out by time (between start):', eventTime, 'vs', new Date(timeFilterStart).getTime());
            return false;
          }
          if (timeFilterEnd && eventTime > new Date(timeFilterEnd).getTime()) {
            console.log('Filtered out by time (between end):', eventTime, 'vs', new Date(timeFilterEnd).getTime());
            return false;
          }
          break;
      }
    }
    
    return true;
  });
  
  // Debug logging
  console.log('Recent Events Debug:');
  console.log('- Total recentEvents:', recentEvents.length);
  console.log('- Filtered events:', filteredEvents.length);
  console.log('- Current filters:', { eventTypeFilter, userFilter, pageFilter, timeFilterType });
  if (recentEvents.length > 0) {
    console.log('- Sample event:', recentEvents[0]);
  }
  


  // Custom dropdown component
  const CustomDropdown = ({ 
    label, 
    value, 
    options, 
    onChange, 
    isOpen, 
    setIsOpen 
  }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
  }) => {
    const selectedOption = options.find(opt => opt.value === value);
    
    return (
      <div className="relative custom-dropdown">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-between w-full px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 min-w-[200px]"
        >
          <span className="text-gray-700">{selectedOption?.label || label}</span>
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
            <div className="py-1 max-h-60 overflow-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg ${
                    option.value === value 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Get event color scheme
  const getEventColor = (eventType: string) => {
    switch (eventType) {
      // User actions
      case 'user_login':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'user_logout':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'user_registered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'user_deleted':
        return 'bg-red-100 text-red-800 border-red-200';
      
      // Snapshot actions
      case 'snapshot_created':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'snapshot_viewed':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'snapshot_downloaded':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'snapshot_deleted':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'snapshot_expired':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      
      // Page views
      case 'page_view':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      
      // Comments
      case 'comment_created':
      case 'comment_posted':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'comment_replied':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'comment_edited':
      case 'comment_updated':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'comment_deleted':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'comment_resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'comment_archived':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'comments_bulk_resolved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'comment_subscription_added':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'comment_subscription_removed':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'comment_subscription_activated':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'comment_subscription_paused':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      
      // Project management
      case 'project_created':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'project_updated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'project_deleted':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'project_archived':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'project_unarchived':
        return 'bg-lime-100 text-lime-800 border-lime-200';
      
      // Review workflows
      case 'review_requested':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'review_approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'review_rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'review_submitted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'review_cancelled':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'review_reminder_sent':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      
      // Subscription & payments
      case 'subscription_started':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'subscription_cancelled':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'subscription_expired':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'payment_succeeded':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'payment_failed':
        return 'bg-red-100 text-red-800 border-red-200';
      
      // System events
      case 'migration_completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'user_migration_completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'snapshot_migration_completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'system_backup':
        return 'bg-violet-100 text-violet-800 border-violet-200';
      case 'system_maintenance':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      
      // Extension downloads
      case 'extension_downloaded':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'extension_upgraded':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      
      // Errors & security
      case 'error_occurred':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'unauthorized_access':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'rate_limit_exceeded':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      
      // Default fallback
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Generate human-readable event descriptions
  const getEventDescription = (event: any) => {
    // Safety check for event and event.eventType
    if (!event || !event.eventType) {
      return 'Unknown event';
    }
    
    const baseDescription = event.description;
    if (baseDescription) return baseDescription;
    
    // Generate descriptions based on event type and data
    switch (event.eventType) {
      case 'page_view':
        return `Viewed page: ${event.page || event.eventData?.page || 'Unknown page'}`;
      case 'user_login':
        return 'User logged in';
      case 'user_logout':
        return 'User logged out';
      case 'user_registered':
        return 'New user registered';
      case 'snapshot_created':
        return 'Snapshot created';
      case 'snapshot_viewed':
        return 'Snapshot viewed';
      case 'snapshot_downloaded':
        return 'Snapshot downloaded';
      case 'comment_posted':
        return 'Comment posted';
      case 'comment_updated':
        return 'Comment updated';
      case 'comment_resolved':
        return 'Comment resolved';
      case 'comments_bulk_resolved':
        return 'Multiple comments resolved';
      case 'project_created':
        return `Project created: ${event.eventData?.projectName || 'Unknown project'}`;
      case 'project_updated':
        return `Project updated: ${event.eventData?.projectName || 'Unknown project'}`;
      case 'project_deleted':
        return `Project deleted: ${event.eventData?.projectName || 'Unknown project'}`;
      case 'project_archived':
        return `Project archived: ${event.eventData?.projectName || 'Unknown project'}`;
      case 'project_unarchived':
        return `Project unarchived: ${event.eventData?.projectName || 'Unknown project'}`;
      case 'review_requested':
        return `Review requested for snapshot: ${event.eventData?.snapshotName || event.eventData?.snapshotId || 'Unknown snapshot'}`;
      case 'review_submitted':
        return `Review submitted for snapshot: ${event.eventData?.snapshotName || event.eventData?.snapshotId || 'Unknown snapshot'}`;
      case 'review_cancelled':
        return `Review cancelled for snapshot: ${event.eventData?.snapshotName || event.eventData?.snapshotId || 'Unknown snapshot'}`;
      case 'review_reminder_sent':
        return `Review reminder sent for snapshot: ${event.eventData?.snapshotName || event.eventData?.snapshotId || 'Unknown snapshot'}`;
      case 'subscription_started':
        return 'Subscription started';
      case 'subscription_cancelled':
        return 'Subscription cancelled';
      case 'payment_succeeded':
        return 'Payment successful';
      case 'payment_failed':
        return 'Payment failed';
      case 'extension_downloaded':
        return `Extension downloaded: ${event.metadata?.version || 'Unknown version'}`;
      case 'extension_upgraded':
        return `Extension upgraded: ${event.metadata?.version || 'Unknown version'}`;
      case 'error_occurred':
        return `Error: ${event.metadata?.error || 'Unknown error'}`;
      case 'unauthorized_access':
        return 'Unauthorized access attempt';
      default:
        // Safe fallback for unknown event types
        return `${event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1).replace(/_/g, ' ')}`;
    }
  };

  // Get unique event types, users, and pages for filter options
  const eventTypes = [
    'all',
    // Core user events
    'user_login', 'user_logout', 'user_registered', 'user_deleted',
    // Snapshot events
    'snapshot_created', 'snapshot_viewed', 'snapshot_downloaded', 'snapshot_deleted', 'snapshot_expired',
    // Page views
    'page_view',
    // Comments
    'comment_posted', 'comment_deleted', 'comment_updated', 'comment_resolved', 'comments_bulk_resolved',
    // Project management
    'project_created', 'project_updated', 'project_deleted', 'project_archived', 'project_unarchived',
    // Review workflows
    'review_requested', 'review_submitted', 'review_cancelled', 'review_reminder_sent',
    // Subscription & payments
    'subscription_started', 'subscription_cancelled', 'subscription_expired', 'payment_succeeded', 'payment_failed',
    // System events
    'migration_completed', 'user_migration_completed', 'snapshot_migration_completed', 'system_backup', 'system_maintenance',
    // Extension downloads
    'extension_downloaded', 'extension_upgraded',
    // Errors & security
    'error_occurred', 'unauthorized_access', 'rate_limit_exceeded',
    // Dynamic events from analytics
    ...Array.from(new Set(recentEvents.map(e => e?.type).filter(Boolean)))
  ];
  
  // Get unique users with their emails for better readability
  const eventUsers = ['all', ...Array.from(new Set(recentEvents.map(e => {
    if (e?.userId && e?.userId !== 'system' && e?.userId !== 'anonymous') {
      return `${e.userEmail || 'Unknown'} (${e.userId})`;
    }
    return e?.userId;
  }).filter(Boolean)))];
  
  // Get all available pages from actual analytics data
  const getAllPages = () => {
    const eventPages = recentEvents.map(e => e?.page).filter(Boolean);
    const uniquePages = Array.from(new Set(eventPages));
    
    // Only include 'all' and pages that actually have analytics data
    return ['all', ...uniquePages];
  };
  
  const eventPages = getAllPages();

  // Filter snapshots by selected user
  const filteredSnapshots = React.useMemo(() => {
    if (selectedUserFilter === 'all') {
      return adminSnapshots;
    }
    return adminSnapshots.filter(snapshot => snapshot.ownerUid === selectedUserFilter);
  }, [adminSnapshots, selectedUserFilter]);

  // Get unique users who have snapshots for the filter dropdown
  const usersWithSnapshots = React.useMemo(() => {
    const userMap = new Map();
    adminSnapshots.forEach(snapshot => {
      if (snapshot.ownerUid && snapshot.ownerName) {
        userMap.set(snapshot.ownerUid, {
          uid: snapshot.ownerUid,
          name: snapshot.ownerName,
          email: snapshot.ownerEmail || 'Unknown Email'
        });
      }
    });
    return Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [adminSnapshots]);

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
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    // Add logout handler if needed
  };

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
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Superadmin
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
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 font-inconsolata">Admin Dashboard</h1>
                <p className="mt-2 text-gray-600">Manage QuickStage users and accounts</p>
              </div>
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
              onClick={() => setActiveTab('snapshots')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'snapshots'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📸 Snapshots ({adminSnapshots.length})
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
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900 font-inconsolata">Users ({users.length})</h3>
              <button
                onClick={() => setShowCreateUser(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Create New User
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader field="name">User</SortableHeader>
                  <SortableHeader field="status">Account Status</SortableHeader>
                  <SortableHeader field="plan">Subscription</SortableHeader>
                  <SortableHeader field="createdAt">First Login</SortableHeader>
                  <SortableHeader field="lastLoginAt">Last Login</SortableHeader>
                  <SortableHeader field="totalSnapshots">Snapshots</SortableHeader>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedUsers.map((user) => (
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
                      <div className="flex flex-col">
                        <span>{user.activeSnapshots}/{user.totalSnapshots}</span>
                        {user.totalSnapshots > 0 && user.activeSnapshots === 0 && (
                          <span className="text-xs text-amber-600" title="Debug: Check snapshot status and expiration">
                            ⚠️ All snapshots show as inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-col space-y-2">
                        {user.status === 'active' ? (
                          <button
                            onClick={() => handleDeactivateUser(user.uid)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors"
                            title="Temporarily disable user account (reversible)"
                          >
                            ⏸️ Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateUser(user.uid)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 border border-green-300 transition-colors"
                            title="Re-enable user account"
                          >
                            ▶️ Activate
                          </button>
                        )}
                        
                        {/* Delete button - only show for non-superadmin users */}
                        {user.role !== 'superadmin' && (
                          <button
                            onClick={() => handleDeleteUser(user.uid, user.name)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors"
                            title="Permanently delete user and all their data (irreversible)"
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

        ) : activeTab === 'snapshots' ? (
          /* Snapshots Tab */
          <div className="space-y-6">
            {snapshotsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : snapshotsError ? (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">{snapshotsError}</div>
                <button
                  onClick={loadSnapshots}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* User Filter Dropdown - Only for superadmin */}
                {user?.role === 'superadmin' && (
                  <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 font-inconsolata">Filter by User</h3>
                      <span className="text-sm text-gray-500">
                        Showing {filteredSnapshots.length} of {adminSnapshots.length} snapshots
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="relative custom-dropdown">
                        <button
                          type="button"
                          onClick={() => setIsUserFilterOpen(!isUserFilterOpen)}
                          className="inline-flex items-center justify-between w-full px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 min-w-[300px]"
                        >
                          <span className="text-gray-700">
                            {selectedUserFilter === 'all' 
                              ? 'All Users' 
                              : usersWithSnapshots.find(u => u.uid === selectedUserFilter)?.name || 'Unknown User'
                            }
                          </span>
                          <svg 
                            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isUserFilterOpen ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {isUserFilterOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                            <div className="py-1 max-h-60 overflow-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserFilter('all');
                                  setIsUserFilterOpen(false);
                                }}
                                className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors duration-150 first:rounded-t-lg ${
                                  selectedUserFilter === 'all' 
                                    ? 'bg-blue-50 text-blue-700 font-medium' 
                                    : 'text-gray-700'
                                }`}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">All Users</span>
                                  <span className="text-xs text-gray-500">Show all snapshots</span>
                                </div>
                              </button>
                              
                              {usersWithSnapshots.map((user) => (
                                <button
                                  key={user.uid}
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserFilter(user.uid);
                                    setIsUserFilterOpen(false);
                                  }}
                                  className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors duration-150 last:rounded-b-lg ${
                                    selectedUserFilter === user.uid 
                                      ? 'bg-blue-50 text-blue-700 font-medium' 
                                      : 'text-gray-700'
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{user.name}</span>
                                    <span className="text-xs text-gray-500">{user.email}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {selectedUserFilter !== 'all' && (
                        <button
                          onClick={() => setSelectedUserFilter('all')}
                          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <SnapshotDashboard
                  snapshots={filteredSnapshots}
                  projects={projects}
                  onRefresh={loadSnapshots}
                  onExtendSnapshot={async (snapshotId: string) => {
                    try {
                      await api.post(`/api/snapshots/${snapshotId}/extend`);
                      loadSnapshots(); // Refresh data
                      setShowSuccess('Snapshot extended successfully');
                    } catch (error) {
                      setError('Failed to extend snapshot');
                    }
                  }}
                  selectedProjectId={selectedProjectId}
                  onSelectProject={handleSelectProject}
                  showWidgets={true}
                  showExtensionSection={false}
                  user={user}
                  title="All Snapshots"
                />
              </>
            )}
          </div>

        ) : (
          /* Analytics Content */
          <div className="space-y-6">


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
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 font-inconsolata">💳 Subscription Analytics</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">Detailed subscription breakdown and revenue insights</p>
                  </div>
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
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 font-inconsolata">📋 Recent Activity Feed</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">Live feed of system events and user activities</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        setAnalyticsLoading(true);
                        
                        // Simply get the most recent events with full retrieval for completeness
                        console.log('Refreshing with most recent events...');
                        const response = await api.get(`/debug/analytics/events?limit=500&fullRetrieval=true`);
                        const foundEvents = response?.events || [];
                        console.log(`Refresh found ${foundEvents.length} recent events`);
                        
                        setRecentEvents(foundEvents);
                      } catch (error) {
                        console.error('Failed to refresh activity feed:', error);
                      } finally {
                        setAnalyticsLoading(false);
                      }
                    }}
                    disabled={analyticsLoading}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyticsLoading ? (
                      <>
                        <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh All
                      </>
                    )}
                  </button>
                </div>
                
                {/* Activity Feed Filters */}
                <div className="mt-4 space-y-4">
                  {/* Basic Filters Row */}
                  <div className="flex flex-wrap gap-3">
                    <CustomDropdown
                      label="All Event Types"
                      value={eventTypeFilter}
                      options={eventTypes.map(type => ({
                        value: type,
                        label: type === 'all' ? 'All Event Types' : type
                      }))}
                      onChange={setEventTypeFilter}
                      isOpen={isEventTypeOpen}
                      setIsOpen={setIsEventTypeOpen}
                    />
                    
                    <CustomDropdown
                      label="All Users"
                      value={userFilter}
                      options={eventUsers.map(user => ({
                        value: user,
                        label: user === 'all' ? 'All Users' : user
                      }))}
                      onChange={setUserFilter}
                      isOpen={isUserFilterOpen}
                      setIsOpen={setIsUserFilterOpen}
                    />
                    
                    <CustomDropdown
                      label="All Pages"
                      value={pageFilter}
                      options={eventPages.map(page => ({
                        value: page,
                        label: page === 'all' ? 'All Pages' : page
                      }))}
                      onChange={setPageFilter}
                      isOpen={isPageFilterOpen}
                      setIsOpen={setIsPageFilterOpen}
                    />
                  </div>
                  
                  {/* Time Filters Row */}
                  <div className="flex flex-wrap items-center gap-3">
                    <CustomDropdown
                      label="All Time"
                      value={timeFilterType}
                      options={[
                        { value: 'all', label: 'All Time' },
                        { value: 'before', label: 'Before' },
                        { value: 'after', label: 'After' },
                        { value: 'between', label: 'Between' }
                      ]}
                      onChange={(value) => setTimeFilterType(value as any)}
                      isOpen={isTimeFilterOpen}
                      setIsOpen={setIsTimeFilterOpen}
                    />
                    
                    {timeFilterType === 'before' && (
                      <input
                        type="datetime-local"
                        value={timeFilterBefore}
                        onChange={(e) => setTimeFilterBefore(e.target.value)}
                        className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Select date and time"
                      />
                    )}
                    
                    {timeFilterType === 'after' && (
                      <input
                        type="datetime-local"
                        value={timeFilterAfter}
                        onChange={(e) => setTimeFilterAfter(e.target.value)}
                        className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        placeholder="Select date and time"
                      />
                    )}
                    
                    {timeFilterType === 'between' && (
                      <>
                        <input
                          type="datetime-local"
                          value={timeFilterStart}
                          onChange={(e) => setTimeFilterStart(e.target.value)}
                          className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Start date and time"
                        />
                        <span className="text-sm text-gray-500 font-medium">to</span>
                        <input
                          type="datetime-local"
                          value={timeFilterEnd}
                          onChange={(e) => setTimeFilterEnd(e.target.value)}
                          className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="End date and time"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                {analyticsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center">
                      <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                      <span className="text-gray-600">Loading recent activity...</span>
                    </div>
                  </div>
                ) : filteredEvents.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredEvents.map((event, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getEventColor(event.eventType)}`}>
                          {event.eventType}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 font-medium">
                                {getEventDescription(event)}
                              </p>
                              {event.userId && event.userId !== 'system' && event.userId !== 'anonymous' && (
                                <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                                  <span>User: {event.userName || 'Unknown'}</span>
                                  <span>ID: {event.userId}</span>
                                  {event.userEmail && <span>Email: {event.userEmail}</span>}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 ml-4">
                              {new Date(event.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600">
                      {recentEvents.length === 0 ? 'No recent events available' : 'No events match the current filters'}
                    </p>
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
                  <button
                    onClick={async () => {
                      try {
                        const response = await api.get('/debug/stats');
                        const newWindow = window.open('', '_blank');
                        if (newWindow) {
                          newWindow.document.write(`
                            <html>
                              <head><title>Raw Stats API</title></head>
                              <body>
                                <h1>Raw Stats API Response</h1>
                                <pre>${JSON.stringify(response, null, 2)}</pre>
                              </body>
                            </html>
                          `);
                        }
                      } catch (error) {
                        alert('Failed to fetch stats: ' + error);
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                  >
                    📊 Raw Stats API
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        const response = await api.get('/debug/analytics/events?limit=500');
                        const newWindow = window.open('', '_blank');
                        if (newWindow) {
                          newWindow.document.write(`
                            <html>
                              <head><title>Analytics Events</title></head>
                              <body>
                                <h1>Analytics Events</h1>
                                <pre>${JSON.stringify(response, null, 2)}</pre>
                              </body>
                            </html>
                          `);
                        }
                      } catch (error) {
                        alert('Failed to fetch analytics events: ' + error);
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors"
                  >
                    📊 Analytics Events
                  </button>
                  
                  <button
                    onClick={async () => {
                      try {
                        const response = await api.get('/debug/health');
                        const newWindow = window.open('', '_blank');
                        if (newWindow) {
                          newWindow.document.write(`
                            <html>
                              <head><title>System Health</title></head>
                              <body>
                                <h1>System Health</h1>
                                <pre>${JSON.stringify(response, null, 2)}</pre>
                              </body>
                            </html>
                          `);
                        }
                      } catch (error) {
                        alert('Failed to fetch system health: ' + error);
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors"
                  >
                    🏥 System Health
                  </button>
                  
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
        </main>
      </div>
    </div>
  );
}
