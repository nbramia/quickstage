import React, { useState, useEffect } from 'react';
import { Project } from '../types/dashboard';
import { api } from '../api';

interface ProjectSidebarProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject: (projectId?: string) => void;
  onRefreshProjects: () => void;
}

export default function ProjectSidebar({ 
  projects, 
  selectedProjectId, 
  onSelectProject,
  onRefreshProjects 
}: ProjectSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#4F46E5');
  const [isLoading, setIsLoading] = useState(false);

  const colors = [
    '#4F46E5', // Indigo
    '#7C3AED', // Purple
    '#EC4899', // Pink
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#6B7280', // Gray
  ];

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsLoading(true);
    try {
      await api.post('/api/projects', {
        name: newProjectName,
        color: newProjectColor
      });
      setNewProjectName('');
      setIsCreating(false);
      onRefreshProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/api/projects/${projectId}`);
      if (selectedProjectId === projectId) {
        onSelectProject(undefined);
      }
      onRefreshProjects();
    } catch (error: any) {
      alert(error.error || 'Failed to delete project');
    }
  };

  // Count active (non-archived) projects
  const activeProjects = projects.filter(p => !p.isArchived);
  const archivedProjects = projects.filter(p => p.isArchived);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            title="New Project"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* All Snapshots */}
        <button
          onClick={() => onSelectProject(undefined)}
          className={`w-full text-left px-3 py-2 rounded-lg mb-2 transition-colors ${
            !selectedProjectId 
              ? 'bg-indigo-50 text-indigo-700' 
              : 'hover:bg-gray-50 text-gray-700'
          }`}
        >
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="font-medium">All Snapshots</span>
          </div>
        </button>

        {/* Create new project form */}
        {isCreating && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 text-sm"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
            />
            
            {/* Color picker */}
            <div className="flex gap-1 mb-2">
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setNewProjectColor(color)}
                  className={`w-6 h-6 rounded ${
                    newProjectColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateProject}
                disabled={isLoading || !newProjectName.trim()}
                className="flex-1 px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewProjectName('');
                }}
                className="flex-1 px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Active Projects */}
        <div className="space-y-1 mb-4">
          {activeProjects.map(project => (
            <div
              key={project.id}
              className={`group relative flex items-center px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                selectedProjectId === project.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
              onClick={() => onSelectProject(project.id)}
            >
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: project.color || '#6B7280' }}
              />
              <span className="flex-1 font-medium truncate">{project.name}</span>
              <span className="text-xs text-gray-500">{project.snapshotCount}</span>
              
              {/* Delete button (only show if empty) */}
              {project.snapshotCount === 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(project.id);
                  }}
                  className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete project"
                >
                  <svg className="w-4 h-4 text-red-500 hover:text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Archived Projects */}
        {archivedProjects.length > 0 && (
          <>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 mt-4">Archived</div>
            <div className="space-y-1">
              {archivedProjects.map(project => (
                <div
                  key={project.id}
                  className={`flex items-center px-3 py-2 rounded-lg cursor-pointer transition-colors opacity-50 ${
                    selectedProjectId === project.id
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: project.color || '#6B7280' }}
                  />
                  <span className="flex-1 text-gray-600 truncate">{project.name}</span>
                  <span className="text-xs text-gray-400">{project.snapshotCount}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}