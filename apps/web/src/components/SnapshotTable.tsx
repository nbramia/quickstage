import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Snapshot, SortField, SortDirection, FilterOptions } from '../types/dashboard';
import { api } from '../api';
import config from '../config';

interface SnapshotTableProps {
  snapshots: Snapshot[];
  onRefresh: () => void;
  selectedSnapshots: Set<string>;
  onToggleSelect: (snapshotId: string) => void;
  onSelectAll: (selected: boolean) => void;
}

export default function SnapshotTable({
  snapshots,
  onRefresh,
  selectedSnapshots,
  onToggleSelect,
  onSelectAll
}: SnapshotTableProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExpired, setShowExpired] = useState(false);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort snapshots
  const processedSnapshots = useMemo(() => {
    let filtered = [...snapshots];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.clientName?.toLowerCase().includes(query) ||
        s.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter expired
    if (!showExpired) {
      filtered = filtered.filter(s => new Date(s.expiresAt) > new Date());
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'name':
          aVal = a.name || `Snapshot ${a.id.slice(0, 8)}`;
          bVal = b.name || `Snapshot ${b.id.slice(0, 8)}`;
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          aVal = new Date(a.lastModifiedAt || a.updatedAt || a.createdAt).getTime();
          bVal = new Date(b.lastModifiedAt || b.updatedAt || b.createdAt).getTime();
          break;
        case 'expiresAt':
          aVal = new Date(a.expiresAt).getTime();
          bVal = new Date(b.expiresAt).getTime();
          break;
        case 'viewCount':
          aVal = a.viewCount || 0;
          bVal = b.viewCount || 0;
          break;
        case 'commentCount':
          aVal = a.commentCount || 0;
          bVal = b.commentCount || 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortDirection === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });

    return filtered;
  }, [snapshots, sortField, sortDirection, searchQuery, showExpired]);

  // Copy link to clipboard
  const handleCopyLink = async (snapshotId: string, password?: string) => {
    const url = `${config.PUBLIC_BASE_URL}/s/${snapshotId}`;
    const textToCopy = password ? `${url}\nPassword: ${password}` : url;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      // TODO: Show success toast
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Extend snapshot expiry
  const handleExtend = async (snapshotId: string) => {
    try {
      await api.post(`/api/snapshots/${snapshotId}/extend`);
      onRefresh();
    } catch (error) {
      console.error('Failed to extend snapshot:', error);
    }
  };

  // Format date
  const formatDate = (date: string | number) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get days until expiry
  const getDaysUntilExpiry = (expiresAt: string | number) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get expiry color
  const getExpiryColor = (days: number) => {
    if (days < 0) return 'text-gray-500';
    if (days <= 1) return 'text-red-600';
    if (days <= 3) return 'text-orange-600';
    if (days <= 7) return 'text-yellow-600';
    return 'text-green-600';
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Search and filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search snapshots..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showExpired}
                onChange={(e) => setShowExpired(e.target.checked)}
                className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Show expired</span>
            </label>
            
            <div className="text-sm text-gray-600">
              {processedSnapshots.length} of {snapshots.length} snapshots
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={processedSnapshots.length > 0 && processedSnapshots.every(s => selectedSnapshots.has(s.id))}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  <SortIcon field="name" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-1">
                  Created
                  <SortIcon field="createdAt" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('expiresAt')}
              >
                <div className="flex items-center gap-1">
                  Expires
                  <SortIcon field="expiresAt" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('viewCount')}
              >
                <div className="flex items-center gap-1">
                  Views
                  <SortIcon field="viewCount" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Review
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedSnapshots.map((snapshot) => {
              const daysUntilExpiry = getDaysUntilExpiry(snapshot.expiresAt);
              const expiryColor = getExpiryColor(daysUntilExpiry);
              const isExpired = daysUntilExpiry < 0;

              return (
                <tr key={snapshot.id} className={`hover:bg-gray-50 ${isExpired ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedSnapshots.has(snapshot.id)}
                      onChange={() => onToggleSelect(snapshot.id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {snapshot.name || `Snapshot ${snapshot.id.slice(0, 8)}`}
                      </div>
                      {snapshot.tags && snapshot.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {snapshot.tags.map(tag => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(snapshot.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${expiryColor}`}>
                      {isExpired ? 'Expired' : `${daysUntilExpiry} days`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-900">{snapshot.viewCount || 0}</span>
                      {snapshot.uniqueViewers && snapshot.uniqueViewers > 0 && (
                        <span className="text-xs text-gray-500">({snapshot.uniqueViewers} unique)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {snapshot.review?.isRequested ? (
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          snapshot.review.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : snapshot.review.status === 'overdue'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {snapshot.review.checkedOffCount}/{snapshot.review.totalReviewers}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/viewer/${snapshot.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="View"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      
                      <button
                        onClick={() => handleCopyLink(snapshot.id, snapshot.password)}
                        className="text-gray-600 hover:text-gray-900"
                        title="Copy link"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>

                      {!isExpired && daysUntilExpiry <= 3 && (
                        <button
                          onClick={() => handleExtend(snapshot.id)}
                          className="text-orange-600 hover:text-orange-900"
                          title="Extend expiry"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {processedSnapshots.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No snapshots found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery ? 'Try adjusting your search' : 'Get started by creating a new snapshot'}
          </p>
        </div>
      )}
    </div>
  );
}