import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import SnapshotTable from '../../components/SnapshotTable';
import { Snapshot } from '../../types/dashboard';

// Mock the API module
const mockApiPost = vi.fn();
vi.mock('../../api', () => ({
  api: {
    post: mockApiPost,
  },
}));

// Mock config
vi.mock('../../config', () => ({
  default: {
    PUBLIC_BASE_URL: 'https://quickstage.tech'
  }
}));

const mockSnapshots: Snapshot[] = [
  {
    id: 'snap1',
    name: 'Homepage Redesign',
    projectId: 'proj1',
    createdAt: Date.now() - 2000,
    updatedAt: Date.now() - 1000,
    expiresAt: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5 days from now
    lastModifiedAt: Date.now() - 1000,
    password: 'test123',
    isPublic: false,
    viewCount: 15,
    uniqueViewers: 8,
    commentCount: 3,
    status: 'active',
    tags: ['ui', 'redesign'],
    description: 'New homepage layout',
    version: 'v2.1',
    clientName: 'ACME Corp',
    milestone: 'Sprint 3',
    review: {
      isRequested: true,
      reviewId: 'rev1',
      checkedOffCount: 2,
      totalReviewers: 3,
      deadline: Date.now() + 2 * 24 * 60 * 60 * 1000,
      status: 'in_progress'
    }
  },
  {
    id: 'snap2',
    name: 'Login Flow Update',
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 500,
    expiresAt: Date.now() + 1 * 24 * 60 * 60 * 1000, // 1 day from now
    lastModifiedAt: Date.now() - 500,
    password: 'secure456',
    isPublic: true,
    viewCount: 42,
    uniqueViewers: 25,
    commentCount: 7,
    status: 'active',
    tags: ['auth', 'security'],
    description: 'Updated authentication flow',
    version: 'v1.5'
  },
  {
    id: 'snap3',
    name: 'Old Dashboard',
    createdAt: Date.now() - 10000,
    updatedAt: Date.now() - 10000,
    expiresAt: Date.now() - 1000, // Expired
    password: 'old789',
    isPublic: false,
    viewCount: 5,
    uniqueViewers: 3,
    commentCount: 1,
    status: 'expired',
    tags: ['legacy'],
    description: 'Deprecated dashboard design'
  }
];

describe('SnapshotTable Component', () => {
  const mockOnRefresh = vi.fn();
  const mockOnToggleSelect = vi.fn();
  const mockOnSelectAll = vi.fn();
  const selectedSnapshots = new Set(['snap1']);

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('Snapshot Display', () => {
    it('renders all snapshots by default', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      expect(screen.getByText('Homepage Redesign')).toBeInTheDocument();
      expect(screen.getByText('Login Flow Update')).toBeInTheDocument();
      expect(screen.getByText('Old Dashboard')).toBeInTheDocument();
    });

    it('displays snapshot metadata correctly', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // Check view counts
      expect(screen.getByText('15')).toBeInTheDocument(); // view count for snap1
      expect(screen.getByText('42')).toBeInTheDocument(); // view count for snap2

      // Check unique viewers
      expect(screen.getByText('(8 unique)')).toBeInTheDocument();
      expect(screen.getByText('(25 unique)')).toBeInTheDocument();
    });

    it('shows tags for snapshots that have them', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      expect(screen.getByText('ui')).toBeInTheDocument();
      expect(screen.getByText('redesign')).toBeInTheDocument();
      expect(screen.getByText('auth')).toBeInTheDocument();
      expect(screen.getByText('security')).toBeInTheDocument();
    });

    it('displays review status correctly', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // Should show review progress for snap1
      expect(screen.getByText('2/3')).toBeInTheDocument();
    });

    it('shows expiry status with appropriate colors', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // Should show "Expired" for expired snapshot
      expect(screen.getByText('Expired')).toBeInTheDocument();
      
      // Should show days remaining for active snapshots
      expect(screen.getByText(/\d+ days/)).toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('filters snapshots by search query', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search snapshots...');
      fireEvent.change(searchInput, { target: { value: 'homepage' } });

      // Should only show matching snapshot
      expect(screen.getByText('Homepage Redesign')).toBeInTheDocument();
      expect(screen.queryByText('Login Flow Update')).not.toBeInTheDocument();
    });

    it('searches by tags', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search snapshots...');
      fireEvent.change(searchInput, { target: { value: 'auth' } });

      // Should show snapshot with 'auth' tag
      expect(screen.getByText('Login Flow Update')).toBeInTheDocument();
      expect(screen.queryByText('Homepage Redesign')).not.toBeInTheDocument();
    });

    it('searches by description and client name', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search snapshots...');
      fireEvent.change(searchInput, { target: { value: 'ACME' } });

      // Should show snapshot with ACME client
      expect(screen.getByText('Homepage Redesign')).toBeInTheDocument();
      expect(screen.queryByText('Login Flow Update')).not.toBeInTheDocument();
    });

    it('shows/hides expired snapshots based on toggle', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // By default, expired snapshots should be hidden
      expect(screen.queryByText('Old Dashboard')).not.toBeInTheDocument();

      // Toggle to show expired
      const showExpiredCheckbox = screen.getByLabelText('Show expired');
      fireEvent.click(showExpiredCheckbox);

      // Now expired snapshot should be visible
      expect(screen.getByText('Old Dashboard')).toBeInTheDocument();
    });

    it('displays correct result count', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // Should show "2 of 3 snapshots" (expired one is hidden by default)
      expect(screen.getByText('2 of 3 snapshots')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('sorts by name when name column is clicked', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);

      // Should show sort icon
      const sortIcon = nameHeader!.querySelector('svg');
      expect(sortIcon).toBeInTheDocument();
    });

    it('reverses sort direction on second click', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const nameHeader = screen.getByText('Name').closest('th');
      
      // First click - ascending
      fireEvent.click(nameHeader!);
      
      // Second click - descending
      fireEvent.click(nameHeader!);

      // Icon should change to indicate descending sort
      const sortIcon = nameHeader!.querySelector('svg');
      expect(sortIcon).toBeInTheDocument();
    });

    it('sorts by different columns', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // Test sorting by created date
      const createdHeader = screen.getByText('Created').closest('th');
      fireEvent.click(createdHeader!);

      // Test sorting by views
      const viewsHeader = screen.getByText('Views').closest('th');
      fireEvent.click(viewsHeader!);

      // Test sorting by expires
      const expiresHeader = screen.getByText('Expires').closest('th');
      fireEvent.click(expiresHeader!);

      // Each should show sort icon when clicked
      expect(expiresHeader!.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('shows individual checkboxes for each snapshot', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={selectedSnapshots}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('calls onToggleSelect when individual checkbox is clicked', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const firstCheckbox = screen.getAllByRole('checkbox')[1]; // Skip header checkbox
      if (firstCheckbox) {
        fireEvent.click(firstCheckbox);
      }

      expect(mockOnToggleSelect).toHaveBeenCalled();
    });

    it('calls onSelectAll when header checkbox is clicked', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const headerCheckbox = screen.getAllByRole('checkbox')[0];
      if (headerCheckbox) {
        fireEvent.click(headerCheckbox);
      }

      expect(mockOnSelectAll).toHaveBeenCalledWith(true);
    });

    it('shows selected snapshots as checked', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={selectedSnapshots}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // The selected snapshot should have its checkbox checked
      const checkboxes = screen.getAllByRole('checkbox');
      const checkedCheckboxes = checkboxes.filter(cb => (cb as HTMLInputElement).checked);
      expect(checkedCheckboxes.length).toBeGreaterThan(0);
    });
  });

  describe('Actions', () => {
    it('shows view, copy, and extend buttons for each snapshot', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // Should have view buttons (eye icons)
      const viewButtons = screen.getAllByTitle('View');
      expect(viewButtons.length).toBeGreaterThan(0);

      // Should have copy buttons (clipboard icons)
      const copyButtons = screen.getAllByTitle('Copy link');
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('copies snapshot link to clipboard when copy button is clicked', async () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const copyButton = screen.getAllByTitle('Copy link')[0];
      if (copyButton) {
        fireEvent.click(copyButton);

        await waitFor(() => {
          expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
            'https://quickstage.tech/s/snap1\nPassword: test123'
          );
        });
      }
    });

    it('extends snapshot expiry when extend button is clicked', async () => {
      mockApiPost.mockResolvedValueOnce({ success: true });

      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // Find extend button for snapshots that expire soon
      const extendButton = screen.getByTitle('Extend expiry');
      if (extendButton) {
        fireEvent.click(extendButton);
      }

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/snapshots/snap2/extend');
      });

      expect(mockOnRefresh).toHaveBeenCalled();
    });

    it('shows extend button only for snapshots expiring soon', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // Should only have one extend button (for snap2 which expires in 1 day)
      const extendButtons = screen.getAllByTitle('Extend expiry');
      expect(extendButtons.length).toBe(1);
    });

    it('has correct links to viewer for each snapshot', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const viewLinks = screen.getAllByTitle('View').map(button => 
        button.closest('a')?.getAttribute('href')
      );

      expect(viewLinks).toContain('/viewer/snap1');
      expect(viewLinks).toContain('/viewer/snap2');
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no snapshots match filters', () => {
      render(
        <SnapshotTable
          snapshots={[]}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      expect(screen.getByText('No snapshots found')).toBeInTheDocument();
      expect(screen.getByText('Get started by creating a new snapshot')).toBeInTheDocument();
    });

    it('shows appropriate empty state message when search has no results', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search snapshots...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No snapshots found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors during extend operation', async () => {
      mockApiPost.mockRejectedValueOnce(new Error('API Error'));

      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const extendButton = screen.getByTitle('Extend expiry');
      if (extendButton) {
        fireEvent.click(extendButton);
      }

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalled();
      });

      // Should not call onRefresh on error
      expect(mockOnRefresh).not.toHaveBeenCalled();
    });

    it('handles clipboard write failures gracefully', async () => {
      // Mock clipboard to reject
      navigator.clipboard.writeText = vi.fn().mockRejectedValueOnce(new Error('Clipboard error'));

      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const copyButton = screen.getAllByTitle('Copy link')[0];
      if (copyButton) {
        fireEvent.click(copyButton);
      }

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
      });

      // Should not crash on clipboard error
    });
  });
});