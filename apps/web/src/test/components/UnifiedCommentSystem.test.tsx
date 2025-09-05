import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import UnifiedCommentSystem from '../../components/UnifiedCommentSystem';

// Mock the API module
vi.mock('../../api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ comments: [] }),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

// Mock the auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-user' },
  }),
}));

describe('UnifiedCommentSystem Component', () => {
  const defaultProps = {
    snapshotId: 'test-snapshot',
    isOwner: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders comment system with empty state', async () => {
      render(<UnifiedCommentSystem {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Comments (0)')).toBeInTheDocument();
        expect(screen.getByText('Add Comment')).toBeInTheDocument();
      });
    });

    it('shows add comment form when button is clicked', async () => {
      render(<UnifiedCommentSystem {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Add Comment')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Add Comment'));
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Write your comment...')).toBeInTheDocument();
    });
  });

  describe('Comment Interaction', () => {
    it('allows adding a new comment', async () => {
      const { api } = await import('../../api');
      render(<UnifiedCommentSystem {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Add Comment')).toBeInTheDocument();
      });
      
      // Click add comment button
      fireEvent.click(screen.getByText('Add Comment'));
      
      // Fill in comment text
      const textarea = screen.getByPlaceholderText('Write your comment...');
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      
      // Submit comment
      fireEvent.click(screen.getByText('Post Comment'));
      
      expect(api.post).toHaveBeenCalledWith(
        '/api/snapshots/test-snapshot/comments',
        expect.any(FormData)
      );
    });

    it('cancels comment form when cancel is clicked', async () => {
      render(<UnifiedCommentSystem {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Add Comment')).toBeInTheDocument();
      });
      
      // Click add comment button
      fireEvent.click(screen.getByText('Add Comment'));
      
      // Click cancel
      fireEvent.click(screen.getByText('Cancel'));
      
      // Form should be hidden
      expect(screen.queryByPlaceholderText('Write your comment...')).not.toBeInTheDocument();
    });
  });
});
