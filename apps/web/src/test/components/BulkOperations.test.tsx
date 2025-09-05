import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import BulkOperations from '../../components/BulkOperations';
import { Project } from '../../types/dashboard';
import { api } from '../../api';

// Mock the API module
vi.mock('../../api', () => ({
  api: {
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockApi = api as any;

describe('BulkOperations Component', () => {
  const mockOnClearSelection = vi.fn();
  const mockOnRefresh = vi.fn();
  
  const mockProjects: Project[] = [
    {
      id: 'project1',
      name: 'Project Alpha',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      snapshotCount: 5
    },
    {
      id: 'project2',
      name: 'Project Beta',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      snapshotCount: 3
    }
  ];

  const mockSnapshots = [
    { id: 'snap1', name: 'Test Snapshot 1' },
    { id: 'snap2', name: 'Test Snapshot 2' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.post.mockResolvedValue({});
    mockApi.put.mockResolvedValue({});
    mockApi.delete.mockResolvedValue({});
  });

  describe('Visibility', () => {
    it('renders nothing when no snapshots are selected', () => {
      render(
        <BulkOperations 
          selectedSnapshots={new Set()} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.queryByText(/snapshots selected/)).not.toBeInTheDocument();
    });

    it('renders bulk operations when snapshots are selected', () => {
      const selectedSnapshots = new Set(['snap1', 'snap2']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('2 snapshots selected')).toBeInTheDocument();
    });

    it('displays correct count for selected snapshots', () => {
      const selectedSnapshots = new Set(['snap1', 'snap2', 'snap3']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('3 snapshots selected')).toBeInTheDocument();
    });
  });

  describe('Clear Selection', () => {
    it('calls onClearSelection when clear button is clicked', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      const clearButton = screen.getByText('Cancel');
      fireEvent.click(clearButton);
      
      expect(mockOnClearSelection).toHaveBeenCalled();
    });
  });

  describe('Bulk Extend', () => {
    it('renders extend button', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('Extend Expiry')).toBeInTheDocument();
    });

    it('calls API to extend snapshots when extend button is clicked', async () => {
      const selectedSnapshots = new Set(['snap1', 'snap2']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      const extendButton = screen.getByText('Extend Expiry');
      fireEvent.click(extendButton);
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledTimes(2);
        expect(mockApi.post).toHaveBeenCalledWith('/api/snapshots/snap1/extend', { days: 7 });
        expect(mockApi.post).toHaveBeenCalledWith('/api/snapshots/snap2/extend', { days: 7 });
      });
    });

    it('clears selection and refreshes after successful extend', async () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      const extendButton = screen.getByText('Extend Expiry');
      fireEvent.click(extendButton);
      
      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalled();
        expect(mockOnClearSelection).toHaveBeenCalled();
      });
    });

    it('shows error message when extend fails', async () => {
      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Mock window.alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));
      
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      const extendButton = screen.getByText('Extend Expiry');
      fireEvent.click(extendButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to extend snapshots:', expect.any(Error));
        expect(alertSpy).toHaveBeenCalledWith('Some snapshots could not be extended');
      });
      
      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });
  });

  describe('Bulk Move', () => {
    it('renders move button', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('Move to Project')).toBeInTheDocument();
    });

    it('shows move dialog when move button is clicked', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      const moveButton = screen.getByRole('button', { name: 'Move to Project' });
      fireEvent.click(moveButton);
      
      expect(screen.getByRole('heading', { name: 'Move to Project' })).toBeInTheDocument();
      expect(screen.getByText(/Move .* snapshot/)).toBeInTheDocument();
    });

    it('shows project options in move dialog', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      const moveButton = screen.getByRole('button', { name: 'Move to Project' });
      fireEvent.click(moveButton);
      
      expect(screen.getByText('Select project...')).toBeInTheDocument();
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    it('can select a project and move snapshots', async () => {
      const selectedSnapshots = new Set(['snap1', 'snap2']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Open move dialog
      const moveButton = screen.getByRole('button', { name: 'Move to Project' });
      fireEvent.click(moveButton);
      
      // Select a project
      const projectSelect = screen.getByDisplayValue('Select project...');
      fireEvent.change(projectSelect, { target: { value: 'project1' } });
      
      // Confirm move
      const confirmButton = screen.getByText('Move');
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledTimes(2);
        expect(mockApi.put).toHaveBeenCalledWith('/api/snapshots/snap1', { projectId: 'project1' });
        expect(mockApi.put).toHaveBeenCalledWith('/api/snapshots/snap2', { projectId: 'project1' });
      });
    });

    it('can move snapshots to no project', async () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Open move dialog
      const moveButton = screen.getByRole('button', { name: 'Move to Project' });
      fireEvent.click(moveButton);
      
      // Select no project (empty value)
      const projectSelect = screen.getByDisplayValue('Select project...');
      fireEvent.change(projectSelect, { target: { value: '__no_project__' } });
      
      // Confirm move
      const confirmButton = screen.getByText('Move');
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/api/snapshots/snap1', { projectId: null });
      });
    });

    it('can cancel move dialog', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Open move dialog
      const moveButton = screen.getByRole('button', { name: 'Move to Project' });
      fireEvent.click(moveButton);
      
      // Cancel using the dialog cancel button (not the bulk operations cancel)
      const dialogCancelButtons = screen.getAllByText('Cancel');
      const dialogCancelButton = dialogCancelButtons.find(button => 
        button.className.includes('flex-1')
      );
      fireEvent.click(dialogCancelButton!);
      
      // Dialog should be closed - only button should remain, not the dialog heading
      expect(screen.getByRole('button', { name: 'Move to Project' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Move to Project' })).not.toBeInTheDocument();
    });
  });

  describe('Bulk Delete', () => {
    it('renders delete button', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('shows confirmation dialog when delete button is clicked', () => {
      // Mock window.confirm to return false (cancel)
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);
      
      // Should show browser confirm dialog
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete 1 snapshot? This action cannot be undone.');
      
      confirmSpy.mockRestore();
    });

    it('can confirm delete operation', async () => {
      const selectedSnapshots = new Set(['snap1', 'snap2']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete 2 snapshots? This action cannot be undone.');
        expect(mockApi.delete).toHaveBeenCalledTimes(2);
        expect(mockApi.delete).toHaveBeenCalledWith('/api/snapshots/snap1');
        expect(mockApi.delete).toHaveBeenCalledWith('/api/snapshots/snap2');
      });
      
      confirmSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    it('disables buttons when operations are in progress', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Start an operation
      const extendButton = screen.getByText('Extend Expiry');
      fireEvent.click(extendButton);
      
      // All buttons should be disabled during operation
      expect(screen.getByText('Extend Expiry')).toBeDisabled();
      expect(screen.getByText('Move to Project')).toBeDisabled();
      expect(screen.getByText('Delete')).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible buttons and labels', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('has proper modal structure when dialogs are open', () => {
      const selectedSnapshots = new Set(['snap1']);
      render(
        <BulkOperations 
          selectedSnapshots={selectedSnapshots} 
          projects={mockProjects}
          snapshots={mockSnapshots}
          onClearSelection={mockOnClearSelection}
          onRefresh={mockOnRefresh}
        />
      );
      
      // Open move dialog
      const moveButton = screen.getByRole('button', { name: 'Move to Project' });
      fireEvent.click(moveButton);
      
      // Check for dialog heading
      expect(screen.getByRole('heading', { name: 'Move to Project' })).toBeInTheDocument();
    });
  });
});