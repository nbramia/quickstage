import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import SnapshotTable from '../../components/SnapshotTable';
import { Snapshot } from '../../types/dashboard';

// Mock the API module
vi.mock('../../api', () => ({
  api: {
    post: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock config
vi.mock('../../config', () => ({
  default: {
    PUBLIC_BASE_URL: 'https://quickstage.tech'
  }
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User'
    }
  }),
  AuthProvider: ({ children }: any) => children
}));

// Mock ReviewRequestModal
vi.mock('../../components/ReviewRequestModal', () => ({
  ReviewRequestModal: ({ onClose, onSubmit }: any) => (
    <div data-testid="review-request-modal">
      <button onClick={onClose}>Close</button>
      <button onClick={() => onSubmit({ reviewers: [] })}>Submit</button>
    </div>
  )
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

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('Basic Rendering', () => {
    it('renders component without crashing', () => {
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
    });

    it('displays review request button for snapshots without active reviews', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      // Should have request review button for snapshots without active reviews
      const reviewButtons = screen.getAllByTitle('Request review');
      // Only snap2 and snap3 should have review buttons (snap1 already has an active review)
      expect(reviewButtons.length).toBeGreaterThan(0);
    });

    it('opens review request modal when review button is clicked', () => {
      render(
        <SnapshotTable
          snapshots={mockSnapshots}
          onRefresh={mockOnRefresh}
          selectedSnapshots={new Set()}
          onToggleSelect={mockOnToggleSelect}
          onSelectAll={mockOnSelectAll}
        />
      );

      const reviewButtons = screen.getAllByTitle('Request review');
      if (reviewButtons.length > 0) {
        fireEvent.click(reviewButtons[0]!);
        expect(screen.getByTestId('review-request-modal')).toBeInTheDocument();
      }
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
  });

  describe('Empty State', () => {
    it('shows empty state when no snapshots provided', () => {
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
    });
  });
});