import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Project } from '../types/dashboard';
import { api } from '../api';

interface ProjectSidebarProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject: (projectId?: string) => void;
  onRefreshProjects: () => void;
  user?: any;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function ProjectSidebar({ 
  projects, 
  selectedProjectId, 
  onSelectProject,
  onRefreshProjects,
  user,
  isCollapsed = false,
  onToggleCollapse
}: ProjectSidebarProps) {
  const location = useLocation();
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

  // Count active (non-archived) projects - "No project" is always active
  const activeProjects = projects.filter(p => !p.isArchived || p.id === '__no_project__');
  const archivedProjects = projects.filter(p => p.isArchived && p.id !== '__no_project__');

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 h-full overflow-y-auto transition-all duration-300 flex flex-col`}>

      {/* Main Navigation Section */}
      <div className="p-4 flex-1">
        <nav className="space-y-1">
          {/* Dashboard */}
          <button
            onClick={() => onSelectProject(undefined)}
            className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
              location.pathname === '/dashboard' && !selectedProjectId 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'hover:bg-gray-50 text-gray-700'
            }`}
            title={isCollapsed ? 'Dashboard' : ''}
          >
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0" />
            </svg>
            {!isCollapsed && <span className="font-medium">Dashboard</span>}
          </button>

          {/* Projects */}
          <div className="pt-2">
            <div className={`flex items-center px-3 py-2 rounded-lg transition-colors hover:bg-gray-50 text-gray-700`}>
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {!isCollapsed && (
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">Projects</span>
                  <button
                    onClick={() => setIsCreating(true)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="New Project"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              )}
            </div>


            {/* Create new project form */}
            {isCreating && !isCollapsed && (
              <div className="ml-6 mt-2 mb-3 p-3 bg-gray-50 rounded-lg">
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

            {/* Individual Projects - Indented */}
            {!isCollapsed && (
              <div className="ml-6 space-y-1">
                {activeProjects.map(project => (
                  <div
                    key={project.id}
                    className={`group relative flex items-center px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedProjectId === project.id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                    onClick={() => onSelectProject(project.id)}
                    title={project.name}
                  >
                    {project.id === '__no_project__' ? (
                      // Special icon for "No project"
                      <svg className="w-3 h-3 mr-2 flex-shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    ) : (
                      <div
                        className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: project.color || '#6B7280' }}
                      />
                    )}
                    <span className="flex-1 text-sm truncate">{project.name}</span>
                    <span className="text-xs text-gray-500">{project.snapshotCount}</span>
                    
                    {/* Delete button (only show if empty and not the No project) */}
                    {project.snapshotCount === 0 && project.id !== '__no_project__' && (
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
            )}
          </div>

          {/* Settings */}
          <Link
            to="/settings"
            className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
              location.pathname === '/settings' 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'hover:bg-gray-50 text-gray-700'
            }`}
            title={isCollapsed ? 'Settings' : ''}
          >
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {!isCollapsed && <span className="font-medium">Settings</span>}
          </Link>

          {/* Admin (only for superadmin) */}
          {user?.role === 'superadmin' && (
            <Link
              to="/admin"
              className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                location.pathname === '/admin' 
                  ? 'bg-red-50 text-red-700' 
                  : 'hover:bg-red-50 text-red-600'
              }`}
              title={isCollapsed ? 'Admin Panel' : ''}
            >
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {!isCollapsed && <span className="font-medium">Admin</span>}
            </Link>
          )}
        </nav>

      </div>

      {/* Archived Projects (only show when not collapsed) */}
      {!isCollapsed && archivedProjects.length > 0 && (
        <div className="px-4 pb-4">
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
        </div>
      )}

      {/* Collapse Toggle */}
      {onToggleCollapse && (
        <div className="mt-auto border-t border-gray-200">
          <div className="flex justify-center p-4">
            <button
              onClick={onToggleCollapse}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg 
                className={`w-4 h-4 text-gray-600 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}