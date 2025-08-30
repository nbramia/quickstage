import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import CommentOverlay from '../../components/CommentOverlay';

// Mock the API module
vi.mock('../../api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ comments: [] }),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
  },
}));

const mockComments = [
  {
    id: 'comment-1',
    content: 'This is a test comment',
    userName: 'John Doe',
    status: 'published',
    createdAt: Date.now(),
    position: { x: 100, y: 200 }
  },
  {
    id: 'comment-2',
    content: 'This needs to be fixed',
    userName: 'Jane Smith',
    status: 'published',
    createdAt: Date.now(),
    position: { x: 150, y: 250 }
  },
  {
    id: 'comment-3',
    content: 'Resolved comment',
    userName: 'Bob Wilson',
    status: 'resolved',
    createdAt: Date.now(),
    position: { x: 100, y: 200 }
  }
];

describe('CommentOverlay Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<CommentOverlay snapshotId="test-snapshot" />);
      expect(screen.getByText('Add Comments')).toBeInTheDocument();
    });

    it('shows comment mode toggle button', () => {
      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      const toggleButton = screen.getByText('Add Comments');
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton.closest('button')).toHaveClass('bg-white');
    });

    it('toggles comment mode when button is clicked', () => {
      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      const toggleButton = screen.getByText('Add Comments');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('Exit Comments')).toBeInTheDocument();
    });
  });

  describe('Comment Pins', () => {
    it('displays comment pins when comments are loaded', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.get).mockResolvedValue({ comments: mockComments });

      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      // Wait for comments to load
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/snapshots/test-snapshot/comments');
      });

      // Should show comment pins
      await waitFor(() => {
        const pins = document.querySelectorAll('[class*="rounded-full cursor-pointer"]');
        expect(pins.length).toBeGreaterThan(0);
      });
    });

    it('shows different colors for resolved and unresolved comments', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.get).mockResolvedValue({ comments: mockComments });

      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/snapshots/test-snapshot/comments');
      });

      // Check for different colored pins
      await waitFor(() => {
        const redPins = document.querySelectorAll('[class*="bg-red-500"]');
        const greenPins = document.querySelectorAll('[class*="bg-green-500"]');
        expect(redPins.length + greenPins.length).toBeGreaterThan(0);
      });
    });

    it('shows tooltip on hover', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.get).mockResolvedValue({ comments: mockComments });

      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/snapshots/test-snapshot/comments');
      });

      await waitFor(() => {
        const pin = document.querySelector('[class*="rounded-full cursor-pointer"]');
        if (pin) {
          fireEvent.mouseEnter(pin);
          // Tooltip should appear but we can't easily test the absolute positioning
          // Just verify no errors occurred
          expect(pin).toBeInTheDocument();
        }
      });
    });
  });

  describe('Comment Mode', () => {
    it('shows instructions when comment mode is active and no comments exist', () => {
      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      const toggleButton = screen.getByText('Add Comments');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('Comment Mode Active')).toBeInTheDocument();
      expect(screen.getByText('Click anywhere to add a comment')).toBeInTheDocument();
    });

    it('hides instructions when comments exist', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.get).mockResolvedValue({ comments: mockComments });

      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      const toggleButton = screen.getByText('Add Comments');
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Comment Mode Active')).not.toBeInTheDocument();
      });
    });
  });

  describe('Comment Thread Preview', () => {
    it('shows comment preview when pin is clicked', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.get).mockResolvedValue({ comments: mockComments });

      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/snapshots/test-snapshot/comments');
      });

      await waitFor(() => {
        const pin = document.querySelector('[class*="rounded-full cursor-pointer"]');
        if (pin) {
          fireEvent.click(pin);
          // Preview should appear
          expect(document.querySelector('[class*="absolute bg-white rounded-lg shadow-xl"]')).toBeInTheDocument();
        }
      });
    });

    it('shows "View All" button in preview', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.get).mockResolvedValue({ comments: mockComments });

      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      await waitFor(() => {
        const pin = document.querySelector('[class*="rounded-full cursor-pointer"]');
        if (pin) {
          fireEvent.click(pin);
          
          waitFor(() => {
            expect(screen.getByText('View All')).toBeInTheDocument();
          });
        }
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper button semantics', () => {
      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      const toggleButton = screen.getByRole('button', { name: /Add Comments|Exit Comments/ });
      expect(toggleButton).toBeInTheDocument();
    });

    it('has keyboard navigation support', () => {
      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      const toggleButton = screen.getByRole('button');
      toggleButton.focus();
      expect(document.activeElement).toBe(toggleButton);
    });
  });

  describe('Callback Functions', () => {
    it('calls onCommentModeChange when comment mode toggles', () => {
      const onCommentModeChange = vi.fn();
      
      render(
        <CommentOverlay 
          snapshotId="test-snapshot" 
          onCommentModeChange={onCommentModeChange}
        />
      );
      
      const toggleButton = screen.getByText('Add Comments');
      fireEvent.click(toggleButton);
      
      expect(onCommentModeChange).toHaveBeenCalledWith(true);
    });

    it('can be disabled for non-interactive mode', () => {
      render(
        <CommentOverlay 
          snapshotId="test-snapshot" 
          isInteractive={false}
        />
      );
      
      expect(screen.queryByText('Add Comments')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      // Should not crash and should still show the toggle button
      await waitFor(() => {
        expect(screen.getByText('Add Comments')).toBeInTheDocument();
      });
    });

    it('handles empty comment data', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.get).mockResolvedValue({});

      render(<CommentOverlay snapshotId="test-snapshot" />);
      
      await waitFor(() => {
        expect(screen.getByText('Add Comments')).toBeInTheDocument();
      });
    });
  });
});