import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '../utils/test-utils';
import DashboardWidgets from '../../components/DashboardWidgets';
import { Snapshot } from '../../types/dashboard';

// Mock Link component
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  };
});

describe('DashboardWidgets Component', () => {
  const mockOnExtend = vi.fn();
  
  const mockSnapshots: Snapshot[] = [
    {
      id: 'snap1',
      name: 'Test Snapshot 1',
      createdAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 2, // 2 days from now
      viewCount: 15,
      public: true,
      analytics: {
        recentViewers: ['user1', 'user2']
      },
      review: {
        isRequested: true,
        status: 'pending' as const,
        checkedOffCount: 0,
        totalReviewers: 2
      }
    },
    {
      id: 'snap2',
      name: 'Test Snapshot 2',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days from now
      viewCount: 8,
      public: false,
      analytics: {
        recentViewers: []
      }
    },
    {
      id: 'snap3',
      name: 'Overdue Review Snapshot',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 5, // 5 days from now
      viewCount: 3,
      public: true,
      analytics: {
        recentViewers: ['user3']
      },
      review: {
        isRequested: true,
        status: 'overdue' as const,
        checkedOffCount: 1,
        totalReviewers: 3
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Review Status Widget', () => {
    it('displays review status widget with correct title', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('Review Status')).toBeInTheDocument();
    });

    it('shows pending reviews count', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('Pending Reviews')).toBeInTheDocument();
      const pendingReviewsSection = screen.getByText('Pending Reviews').closest('.flex');
      expect(pendingReviewsSection?.querySelector('.bg-yellow-100')).toHaveTextContent('1');
    });

    it('shows overdue reviews count', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('Overdue Reviews')).toBeInTheDocument();
      const overdueReviewsSection = screen.getByText('Overdue Reviews').closest('.flex');
      expect(overdueReviewsSection?.querySelector('.bg-red-100')).toHaveTextContent('1');
    });

    it('shows no reviews message when no reviews exist', () => {
      const snapshotsWithoutReviews = mockSnapshots.map(s => ({ ...s, review: undefined }));
      render(<DashboardWidgets snapshots={snapshotsWithoutReviews} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('No active reviews')).toBeInTheDocument();
    });
  });

  describe('Expiring Soon Widget', () => {
    it('displays expiring snapshots widget', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
    });

    it('shows snapshots expiring within 3 days', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('Test Snapshot 1')).toBeInTheDocument(); // Expires in 2 days
    });

    it('shows extend buttons for expiring snapshots', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      const extendButtons = screen.getAllByText('Extend');
      expect(extendButtons.length).toBeGreaterThan(0);
    });

    it('calls onExtend when extend button is clicked', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      const extendButton = screen.getAllByText('Extend')[0];
      fireEvent.click(extendButton);
      
      expect(mockOnExtend).toHaveBeenCalledWith('snap1');
    });
  });

  describe('Popular Snapshots Widget', () => {
    it('displays popular snapshots widget', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('shows snapshots sorted by view count', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      // Should show highest view count first
      const snapshots = screen.getAllByText(/Test Snapshot/);
      expect(snapshots[0]).toHaveTextContent('Test Snapshot 1'); // 15 views
    });

    it('shows view counts for popular snapshots', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText(/15 views/)).toBeInTheDocument();
      expect(screen.getByText(/8 views/)).toBeInTheDocument();
    });

    it('shows no popular snapshots message when no views exist', () => {
      const snapshotsWithoutViews = mockSnapshots.map(s => ({ ...s, viewCount: 0 }));
      render(<DashboardWidgets snapshots={snapshotsWithoutViews} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('No views yet')).toBeInTheDocument();
    });
  });

  describe('Recent Activity Widget', () => {
    it('displays recent activity widget', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    it('shows snapshots with recent viewers', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('Test Snapshot 1')).toBeInTheDocument(); // Has recent viewers
      expect(screen.getByText('Overdue Review Snapshot')).toBeInTheDocument(); // Has recent viewers
    });

    it('shows no activity message when no recent viewers exist', () => {
      const snapshotsWithoutActivity = mockSnapshots.map(s => ({ 
        ...s, 
        analytics: { ...s.analytics, recentViewers: [] }
      }));
      render(<DashboardWidgets snapshots={snapshotsWithoutActivity} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });
  });

  describe('Widget Grid Layout', () => {
    it('renders widgets in a responsive grid', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      const container = document.querySelector('.grid');
      expect(container).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
    });

    it('renders all three main widgets', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('Review Status')).toBeInTheDocument();
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
      expect(screen.getByText('Most Popular')).toBeInTheDocument();
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('handles empty snapshots array gracefully', () => {
      render(<DashboardWidgets snapshots={[]} onExtend={mockOnExtend} />);
      
      expect(screen.getByText('No active reviews')).toBeInTheDocument();
      expect(screen.getByText('No snapshots expiring soon')).toBeInTheDocument();
      expect(screen.getByText('No views yet')).toBeInTheDocument();
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings.length).toBeGreaterThan(0);
    });

    it('has accessible buttons', () => {
      render(<DashboardWidgets snapshots={mockSnapshots} onExtend={mockOnExtend} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });
  });
});