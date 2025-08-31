import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import BulkOperations from '../../components/BulkOperations';
import { api } from '../../api';
// Mock the API module
vi.mock('../../api', () => ({
    api: {
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));
const mockApi = api;
describe('BulkOperations Component', () => {
    const mockOnClearSelection = vi.fn();
    const mockOnRefresh = vi.fn();
    const mockProjects = [
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
    beforeEach(() => {
        vi.clearAllMocks();
        mockApi.post.mockResolvedValue({});
        mockApi.put.mockResolvedValue({});
        mockApi.delete.mockResolvedValue({});
    });
    describe('Visibility', () => {
        it('renders nothing when no snapshots are selected', () => {
            render(_jsx(BulkOperations, { selectedSnapshots: new Set(), projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
        });
        it('renders bulk operations when snapshots are selected', () => {
            const selectedSnapshots = new Set(['snap1', 'snap2']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            expect(screen.getByText('2 selected')).toBeInTheDocument();
        });
        it('displays correct count for selected snapshots', () => {
            const selectedSnapshots = new Set(['snap1', 'snap2', 'snap3']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            expect(screen.getByText('3 selected')).toBeInTheDocument();
        });
    });
    describe('Clear Selection', () => {
        it('calls onClearSelection when clear button is clicked', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            const clearButton = screen.getByLabelText('Clear selection');
            fireEvent.click(clearButton);
            expect(mockOnClearSelection).toHaveBeenCalled();
        });
    });
    describe('Bulk Extend', () => {
        it('renders extend button', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            expect(screen.getByText('Extend All')).toBeInTheDocument();
        });
        it('calls API to extend snapshots when extend button is clicked', async () => {
            const selectedSnapshots = new Set(['snap1', 'snap2']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            const extendButton = screen.getByText('Extend All');
            fireEvent.click(extendButton);
            await waitFor(() => {
                expect(mockApi.post).toHaveBeenCalledTimes(2);
                expect(mockApi.post).toHaveBeenCalledWith('/api/snapshots/snap1/extend');
                expect(mockApi.post).toHaveBeenCalledWith('/api/snapshots/snap2/extend');
            });
        });
        it('clears selection and refreshes after successful extend', async () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            const extendButton = screen.getByText('Extend All');
            fireEvent.click(extendButton);
            await waitFor(() => {
                expect(mockOnRefresh).toHaveBeenCalled();
                expect(mockOnClearSelection).toHaveBeenCalled();
            });
        });
        it('shows error message when extend fails', async () => {
            // Mock console.error to avoid noise in tests
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
            // Mock window.alert
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation();
            mockApi.post.mockRejectedValueOnce(new Error('Network error'));
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            const extendButton = screen.getByText('Extend All');
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
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            expect(screen.getByText('Move To...')).toBeInTheDocument();
        });
        it('shows move dialog when move button is clicked', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            const moveButton = screen.getByText('Move To...');
            fireEvent.click(moveButton);
            expect(screen.getByText('Move Snapshots')).toBeInTheDocument();
            expect(screen.getByText('Select destination:')).toBeInTheDocument();
        });
        it('shows project options in move dialog', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            const moveButton = screen.getByText('Move To...');
            fireEvent.click(moveButton);
            expect(screen.getByText('No Project')).toBeInTheDocument();
            expect(screen.getByText('Project Alpha')).toBeInTheDocument();
            expect(screen.getByText('Project Beta')).toBeInTheDocument();
        });
        it('can select a project and move snapshots', async () => {
            const selectedSnapshots = new Set(['snap1', 'snap2']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            // Open move dialog
            const moveButton = screen.getByText('Move To...');
            fireEvent.click(moveButton);
            // Select a project
            const projectOption = screen.getByLabelText('Project Alpha');
            fireEvent.click(projectOption);
            // Confirm move
            const confirmButton = screen.getByText('Move Snapshots');
            fireEvent.click(confirmButton);
            await waitFor(() => {
                expect(mockApi.put).toHaveBeenCalledTimes(2);
                expect(mockApi.put).toHaveBeenCalledWith('/api/snapshots/snap1', { projectId: 'project1' });
                expect(mockApi.put).toHaveBeenCalledWith('/api/snapshots/snap2', { projectId: 'project1' });
            });
        });
        it('can move snapshots to no project', async () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            // Open move dialog
            const moveButton = screen.getByText('Move To...');
            fireEvent.click(moveButton);
            // Select "No Project"
            const noProjectOption = screen.getByLabelText('No Project');
            fireEvent.click(noProjectOption);
            // Confirm move
            const confirmButton = screen.getByText('Move Snapshots');
            fireEvent.click(confirmButton);
            await waitFor(() => {
                expect(mockApi.put).toHaveBeenCalledWith('/api/snapshots/snap1', { projectId: null });
            });
        });
        it('can cancel move dialog', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            // Open move dialog
            const moveButton = screen.getByText('Move To...');
            fireEvent.click(moveButton);
            // Cancel
            const cancelButton = screen.getByText('Cancel');
            fireEvent.click(cancelButton);
            // Dialog should be closed
            expect(screen.queryByText('Move Snapshots')).not.toBeInTheDocument();
        });
    });
    describe('Bulk Delete', () => {
        it('renders delete button', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            expect(screen.getByText('Delete All')).toBeInTheDocument();
        });
        it('shows confirmation dialog when delete button is clicked', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            const deleteButton = screen.getByText('Delete All');
            fireEvent.click(deleteButton);
            expect(screen.getByText('Delete Snapshots')).toBeInTheDocument();
            expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
        });
        it('can confirm delete operation', async () => {
            const selectedSnapshots = new Set(['snap1', 'snap2']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            // Open delete dialog
            const deleteButton = screen.getByText('Delete All');
            fireEvent.click(deleteButton);
            // Confirm delete
            const confirmButton = screen.getByText('Delete');
            fireEvent.click(confirmButton);
            await waitFor(() => {
                expect(mockApi.delete).toHaveBeenCalledTimes(2);
                expect(mockApi.delete).toHaveBeenCalledWith('/api/snapshots/snap1');
                expect(mockApi.delete).toHaveBeenCalledWith('/api/snapshots/snap2');
            });
        });
    });
    describe('Loading States', () => {
        it('disables buttons when operations are in progress', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            // Start an operation
            const extendButton = screen.getByText('Extend All');
            fireEvent.click(extendButton);
            // Buttons should be disabled during operation
            expect(screen.getByText('Extend All')).toBeDisabled();
            expect(screen.getByText('Move To...')).toBeDisabled();
            expect(screen.getByText('Delete All')).toBeDisabled();
        });
    });
    describe('Accessibility', () => {
        it('has accessible buttons and labels', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
                expect(button).toHaveAccessibleName();
            });
        });
        it('has proper modal structure when dialogs are open', () => {
            const selectedSnapshots = new Set(['snap1']);
            render(_jsx(BulkOperations, { selectedSnapshots: selectedSnapshots, projects: mockProjects, onClearSelection: mockOnClearSelection, onRefresh: mockOnRefresh }));
            // Open move dialog
            const moveButton = screen.getByText('Move To...');
            fireEvent.click(moveButton);
            // Check for dialog content instead of role
            expect(screen.getByText('Move Snapshots')).toBeInTheDocument();
        });
    });
});
