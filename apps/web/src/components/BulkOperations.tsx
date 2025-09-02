import React, { useState } from 'react';
import { Project } from '../types/dashboard';
import { api } from '../api';

interface BulkOperationsProps {
  selectedSnapshots: Set<string>;
  projects: Project[];
  snapshots: any[]; // Add snapshots to get current snapshot data
  onClearSelection: () => void;
  onRefresh: () => void;
}

export default function BulkOperations({
  selectedSnapshots,
  projects,
  snapshots,
  onClearSelection,
  onRefresh
}: BulkOperationsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newName, setNewName] = useState('');
  
  if (selectedSnapshots.size === 0) return null;

  // Get the selected snapshot for rename functionality
  const selectedSnapshot = selectedSnapshots.size === 1 
    ? snapshots.find(s => selectedSnapshots.has(s.id))
    : null;

  const handleBulkExtend = async () => {
    setIsLoading(true);
    try {
      const promises = Array.from(selectedSnapshots).map(id =>
        api.post(`/api/snapshots/${id}/extend`, { days: 7 })
      );
      await Promise.all(promises);
      onRefresh();
      onClearSelection();
    } catch (error) {
      console.error('Failed to extend snapshots:', error);
      alert('Some snapshots could not be extended');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkMove = async () => {
    if (!selectedProjectId) return;

    setIsLoading(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedSnapshots).map(id =>
          api.put(`/api/snapshots/${id}`, { 
            projectId: selectedProjectId === '__no_project__' ? null : selectedProjectId 
          })
        )
      );
      
      const failed = results.filter(result => result.status === 'rejected');
      if (failed.length > 0) {
        console.error('Failed to move some snapshots:', failed);
        alert(`${failed.length} snapshot(s) could not be moved. They may have been deleted or you may not have permission.`);
      }
      
      onRefresh();
      onClearSelection();
      setShowMoveDialog(false);
    } catch (error) {
      console.error('Failed to move snapshots:', error);
      alert('Failed to move snapshots');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedSnapshots.size;
    if (!confirm(`Are you sure you want to delete ${count} snapshot${count !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const promises = Array.from(selectedSnapshots).map(id =>
        api.delete(`/api/snapshots/${id}`)
      );
      await Promise.all(promises);
      onRefresh();
      onClearSelection();
    } catch (error) {
      console.error('Failed to delete snapshots:', error);
      alert('Some snapshots could not be deleted');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRename = async () => {
    if (!selectedSnapshot || !newName.trim()) return;

    setIsLoading(true);
    try {
      await api.put(`/api/snapshots/${selectedSnapshot.id}`, {
        name: newName.trim()
      });
      onRefresh();
      onClearSelection();
      setShowRenameDialog(false);
      setNewName('');
    } catch (error) {
      console.error('Failed to rename snapshot:', error);
      alert('Failed to rename snapshot');
    } finally {
      setIsLoading(false);
    }
  };

  const openRenameDialog = () => {
    if (selectedSnapshot) {
      setNewName(selectedSnapshot.name || '');
      setShowRenameDialog(true);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              {selectedSnapshots.size} snapshot{selectedSnapshots.size !== 1 ? 's' : ''} selected
            </span>
            
            <div className="flex gap-2">
              {selectedSnapshots.size === 1 && (
                <button
                  onClick={openRenameDialog}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  Rename
                </button>
              )}
              
              <button
                onClick={() => setShowMoveDialog(true)}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Move to Project
              </button>
              
              <button
                onClick={handleBulkExtend}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Extend Expiry
              </button>
              
              <button
                onClick={handleBulkDelete}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
              
              <button
                onClick={onClearSelection}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
          
          {isLoading && (
            <div className="mt-2 flex items-center text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Processing...
            </div>
          )}
        </div>
      </div>

      {/* Move to Project Dialog */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Move to Project
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Move {selectedSnapshots.size} snapshot{selectedSnapshots.size !== 1 ? 's' : ''} to:
            </p>
            
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4"
            >
              <option value="">Select project...</option>
              {projects
                .filter(p => !p.isArchived)
                .map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
            
            <div className="flex gap-3">
              <button
                onClick={handleBulkMove}
                disabled={!selectedProjectId || isLoading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? 'Moving...' : 'Move'}
              </button>
              <button
                onClick={() => {
                  setShowMoveDialog(false);
                  setSelectedProjectId('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {showRenameDialog && selectedSnapshot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Rename Snapshot
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Enter a new name for "{selectedSnapshot.name}":
            </p>
            
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  handleRename();
                } else if (e.key === 'Escape') {
                  setShowRenameDialog(false);
                  setNewName('');
                }
              }}
              placeholder="Snapshot name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button
                onClick={handleRename}
                disabled={!newName.trim() || isLoading}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {isLoading ? 'Renaming...' : 'Rename'}
              </button>
              <button
                onClick={() => {
                  setShowRenameDialog(false);
                  setNewName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}