import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import ProjectSidebar from '../../components/ProjectSidebar';
// Mock the API module
const mockApiPost = vi.fn();
const mockApiDelete = vi.fn();
vi.mock('../../api', () => ({
    api: {
        post: mockApiPost,
        delete: mockApiDelete,
    },
}));
const mockProjects = [
    {
        id: 'proj1',
        name: 'Web Application',
        description: 'Main web app project',
        color: '#4F46E5',
        snapshotCount: 5,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
        isArchived: false
    },
    {
        id: 'proj2',
        name: 'Mobile App',
        description: 'Mobile application',
        color: '#EC4899',
        snapshotCount: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isArchived: false
    },
    {
        id: 'proj3',
        name: 'Legacy System',
        description: 'Old system being sunset',
        color: '#6B7280',
        snapshotCount: 10,
        createdAt: Date.now() - 2000,
        updatedAt: Date.now() - 2000,
        isArchived: true
    }
];
describe('ProjectSidebar Component', () => {
    const mockOnSelectProject = vi.fn();
    const mockOnRefreshProjects = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('Project Display', () => {
        it('renders all active projects', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            expect(screen.getByText('Web Application')).toBeInTheDocument();
            expect(screen.getByText('Mobile App')).toBeInTheDocument();
            expect(screen.getByText('5')).toBeInTheDocument(); // snapshot count for Web Application
            expect(screen.getByText('3')).toBeInTheDocument(); // snapshot count for Mobile App
        });
        it('shows archived projects in separate section', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            expect(screen.getByText('Archived')).toBeInTheDocument();
            expect(screen.getByText('Legacy System')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument(); // snapshot count for archived project
        });
        it('highlights selected project', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: "proj1", onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            const selectedProject = screen.getByText('Web Application').closest('div');
            expect(selectedProject).toHaveClass('bg-indigo-50', 'text-indigo-700');
        });
        it('shows "All Snapshots" option as selected when no project is selected', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            const allSnapshotsButton = screen.getByText('All Snapshots').closest('button');
            expect(allSnapshotsButton).toHaveClass('bg-indigo-50', 'text-indigo-700');
        });
    });
    describe('Project Creation', () => {
        it('shows create form when new project button is clicked', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            const newProjectButton = screen.getByTitle('New Project');
            fireEvent.click(newProjectButton);
            expect(screen.getByPlaceholderText('Project name...')).toBeInTheDocument();
            expect(screen.getByText('Create')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });
        it('creates new project when form is submitted', async () => {
            mockApiPost.mockResolvedValueOnce({ success: true });
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            // Open create form
            fireEvent.click(screen.getByTitle('New Project'));
            // Fill form
            const nameInput = screen.getByPlaceholderText('Project name...');
            fireEvent.change(nameInput, { target: { value: 'New Project' } });
            // Select color
            const firstColorButton = document.querySelector('button[style*="background-color"]');
            if (firstColorButton) {
                fireEvent.click(firstColorButton);
            }
            // Submit
            fireEvent.click(screen.getByText('Create'));
            await waitFor(() => {
                expect(mockApiPost).toHaveBeenCalledWith('/api/projects', {
                    name: 'New Project',
                    color: expect.any(String)
                });
            });
            expect(mockOnRefreshProjects).toHaveBeenCalled();
        });
        it('validates project name is not empty', async () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            // Open create form
            fireEvent.click(screen.getByTitle('New Project'));
            // Try to submit without name
            const createButton = screen.getByText('Create');
            expect(createButton).toBeDisabled();
        });
        it('cancels project creation', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            // Open create form
            fireEvent.click(screen.getByTitle('New Project'));
            expect(screen.getByPlaceholderText('Project name...')).toBeInTheDocument();
            // Cancel
            fireEvent.click(screen.getByText('Cancel'));
            expect(screen.queryByPlaceholderText('Project name...')).not.toBeInTheDocument();
        });
        it('allows color selection during creation', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            // Open create form
            fireEvent.click(screen.getByTitle('New Project'));
            // Check that color buttons are present
            const colorButtons = document.querySelectorAll('button[style*="background-color"]');
            expect(colorButtons.length).toBeGreaterThan(0);
        });
    });
    describe('Project Selection', () => {
        it('calls onSelectProject when project is clicked', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            fireEvent.click(screen.getByText('Web Application'));
            expect(mockOnSelectProject).toHaveBeenCalledWith('proj1');
        });
        it('calls onSelectProject with undefined when "All Snapshots" is clicked', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: "proj1", onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            fireEvent.click(screen.getByText('All Snapshots'));
            expect(mockOnSelectProject).toHaveBeenCalledWith(undefined);
        });
        it('allows selection of archived projects', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            fireEvent.click(screen.getByText('Legacy System'));
            expect(mockOnSelectProject).toHaveBeenCalledWith('proj3');
        });
    });
    describe('Project Deletion', () => {
        const emptyProject = {
            id: 'empty-proj',
            name: 'Empty Project',
            color: '#4F46E5',
            snapshotCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isArchived: false
        };
        it('shows delete button for empty projects on hover', () => {
            render(_jsx(ProjectSidebar, { projects: [emptyProject], selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            const projectElement = screen.getByText('Empty Project').closest('div');
            expect(projectElement?.querySelector('svg[title*="Delete"]')).toBeInTheDocument();
        });
        it('does not show delete button for projects with snapshots', () => {
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            const projectElement = screen.getByText('Web Application').closest('div');
            expect(projectElement?.querySelector('svg[title*="Delete"]')).not.toBeInTheDocument();
        });
        it('deletes project when delete button is clicked and confirmed', async () => {
            // Mock window.confirm
            const originalConfirm = window.confirm;
            window.confirm = vi.fn().mockReturnValue(true);
            mockApiDelete.mockResolvedValueOnce({ success: true });
            render(_jsx(ProjectSidebar, { projects: [emptyProject], selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            const deleteButton = document.querySelector('svg[title*="Delete"]')?.closest('button');
            if (deleteButton) {
                fireEvent.click(deleteButton);
            }
            await waitFor(() => {
                expect(mockApiDelete).toHaveBeenCalledWith('/api/projects/empty-proj');
            });
            expect(mockOnRefreshProjects).toHaveBeenCalled();
            // Restore original confirm
            window.confirm = originalConfirm;
        });
        it('does not delete project when deletion is cancelled', async () => {
            // Mock window.confirm to return false
            const originalConfirm = window.confirm;
            window.confirm = vi.fn().mockReturnValue(false);
            render(_jsx(ProjectSidebar, { projects: [emptyProject], selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            const deleteButton = document.querySelector('svg[title*="Delete"]')?.closest('button');
            if (deleteButton) {
                fireEvent.click(deleteButton);
            }
            expect(mockApiDelete).not.toHaveBeenCalled();
            expect(mockOnRefreshProjects).not.toHaveBeenCalled();
            // Restore original confirm
            window.confirm = originalConfirm;
        });
    });
    describe('Error Handling', () => {
        it('handles API errors during project creation', async () => {
            mockApiPost.mockRejectedValueOnce(new Error('API Error'));
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            // Open create form and submit
            fireEvent.click(screen.getByTitle('New Project'));
            const nameInput = screen.getByPlaceholderText('Project name...');
            fireEvent.change(nameInput, { target: { value: 'Test Project' } });
            fireEvent.click(screen.getByText('Create'));
            await waitFor(() => {
                expect(mockApiPost).toHaveBeenCalled();
            });
            // Should not refresh projects on error
            expect(mockOnRefreshProjects).not.toHaveBeenCalled();
        });
        it('handles API errors during project deletion', async () => {
            const originalConfirm = window.confirm;
            window.confirm = vi.fn().mockReturnValue(true);
            mockApiDelete.mockRejectedValueOnce({
                error: 'Cannot delete project with snapshots'
            });
            const emptyProject = {
                id: 'empty-proj',
                name: 'Empty Project',
                color: '#4F46E5',
                snapshotCount: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isArchived: false
            };
            render(_jsx(ProjectSidebar, { projects: [emptyProject], selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            const deleteButton = document.querySelector('svg[title*="Delete"]')?.closest('button');
            if (deleteButton) {
                fireEvent.click(deleteButton);
            }
            await waitFor(() => {
                expect(mockApiDelete).toHaveBeenCalled();
            });
            // Should not refresh projects on error
            expect(mockOnRefreshProjects).not.toHaveBeenCalled();
            window.confirm = originalConfirm;
        });
    });
    describe('Loading States', () => {
        it('shows loading state during project creation', async () => {
            let resolvePromise;
            const createPromise = new Promise((resolve) => {
                resolvePromise = resolve;
            });
            mockApiPost.mockReturnValue(createPromise);
            render(_jsx(ProjectSidebar, { projects: mockProjects, selectedProjectId: undefined, onSelectProject: mockOnSelectProject, onRefreshProjects: mockOnRefreshProjects }));
            // Start creation process
            fireEvent.click(screen.getByTitle('New Project'));
            const nameInput = screen.getByPlaceholderText('Project name...');
            fireEvent.change(nameInput, { target: { value: 'Test Project' } });
            fireEvent.click(screen.getByText('Create'));
            // Should show loading state
            await waitFor(() => {
                expect(screen.getByText('Create')).toBeDisabled();
            });
            // Resolve the promise
            resolvePromise({ success: true });
            await waitFor(() => {
                expect(mockOnRefreshProjects).toHaveBeenCalled();
            });
        });
    });
});
