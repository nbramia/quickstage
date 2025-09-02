import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '../types/dashboard';
import { api } from '../api';

export function useSidebar() {
  const navigate = useNavigate();
  
  // Sidebar state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load projects for sidebar
  const loadProjects = async () => {
    try {
      const response = await api.get('/api/projects');
      setProjects(response.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  // Sidebar navigation handlers
  const handleSelectProject = (projectId?: string) => {
    setSelectedProjectId(projectId);
    if (projectId) {
      navigate('/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  return {
    projects,
    selectedProjectId,
    isSidebarCollapsed,
    loadProjects,
    handleSelectProject,
    handleToggleSidebar,
    setSelectedProjectId
  };
}