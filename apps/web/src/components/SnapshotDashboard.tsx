import React, { useState, useEffect } from 'react';
import { Project, Snapshot } from '../types/dashboard';
import SnapshotTable from './SnapshotTable';
import DashboardWidgets from './DashboardWidgets';
import BulkOperations from './BulkOperations';

interface SnapshotDashboardProps {
  snapshots: Snapshot[];
  projects: Project[];
  onRefresh: () => void;
  onExtendSnapshot: (snapshotId: string) => void;
  selectedProjectId?: string;
  onSelectProject?: (projectId: string | undefined) => void;
  showWidgets?: boolean;
  showExtensionSection?: boolean;
  user?: any;
  title?: string;
  subtitle?: string;
}

export default function SnapshotDashboard({
  snapshots,
  projects,
  onRefresh,
  onExtendSnapshot,
  selectedProjectId,
  onSelectProject,
  showWidgets = true,
  showExtensionSection = false,
  user,
  title = 'Dashboard',
  subtitle
}: SnapshotDashboardProps) {
  // State
  const [selectedSnapshots, setSelectedSnapshots] = useState<Set<string>>(new Set());

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

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-inconsolata">
            {selectedProjectId 
              ? projects.find(p => p.id === selectedProjectId)?.name || 'Project'
              : title
            }
          </h1>
          {subtitle && (
            <p className="text-gray-600">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Dashboard Widgets - only show if viewing all snapshots and showWidgets is true */}
      {!selectedProjectId && showWidgets && (
        <DashboardWidgets
          snapshots={snapshots}
          onExtend={onExtendSnapshot}
        />
      )}

      {/* Snapshots Table */}
      <SnapshotTable
        snapshots={filteredSnapshots}
        onRefresh={onRefresh}
        selectedSnapshots={selectedSnapshots}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      {/* Bulk Operations */}
      <BulkOperations
        selectedSnapshots={selectedSnapshots}
        snapshots={filteredSnapshots}
        projects={projects}
        onClearSelection={handleClearSelection}
        onRefresh={onRefresh}
      />
    </>
  );
}
