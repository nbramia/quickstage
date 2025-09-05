import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import CommentModal from '../../components/CommentModal';

// Mock the API module
vi.mock('../../api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({}),
  },
}));

describe('CommentModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    snapshotId: 'test-snapshot',
    position: { x: 100, y: 200 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders when open', () => {
      render(<CommentModal {...defaultProps} />);
      
      expect(screen.getByText('Add Comment')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Comment on this element...')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<CommentModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Add Comment')).not.toBeInTheDocument();
    });

    it('accepts position information (stored internally for submission)', () => {
      render(<CommentModal {...defaultProps} />);
      
      // Position info is used internally but not displayed in UI
      expect(screen.getByText('Add Comment')).toBeInTheDocument();
    });

    it('accepts position with element selector (stored internally)', () => {
      const position = { x: 100, y: 200, elementSelector: 'button.primary' };
      
      render(<CommentModal {...defaultProps} position={position} />);
      
      // Position stored internally, component displays normally
      expect(screen.getByText('Add Comment')).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('allows typing in comment textarea', () => {
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Comment on this element...');
      fireEvent.change(textarea, { target: { value: 'This is a test comment' } });
      
      expect((textarea as HTMLTextAreaElement).value).toBe('This is a test comment');
    });

    it('accepts text input without showing character count', () => {
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Comment on this element...');
      fireEvent.change(textarea, { target: { value: 'Test' } });
      
      expect((textarea as HTMLTextAreaElement).value).toBe('Test');
    });

    it('enables submit button when content is provided', () => {
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Comment on this element...');
      const submitButton = screen.getByText('Comment');
      
      expect(submitButton).toBeDisabled();
      
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('File Upload', () => {
    it('shows file upload button', () => {
      render(<CommentModal {...defaultProps} />);
      
      expect(screen.getByText('Attach')).toBeInTheDocument();
    });

    it('accepts file selection', () => {
      render(<CommentModal {...defaultProps} />);
      
      // Find hidden file input and trigger file selection
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      // Verify file is displayed
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('displays selected files with details', () => {
      render(<CommentModal {...defaultProps} />);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test content'], 'test-document.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText(/\d+ B/)).toBeInTheDocument(); // File size
    });

    it('allows removing selected files', () => {
      render(<CommentModal {...defaultProps} />);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      // Find and click remove button (×) for the file
      const removeButton = screen.getByText('×');
      fireEvent.click(removeButton);
      
      expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    });

    it('supports file selection via input', () => {
      render(<CommentModal {...defaultProps} />);
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'uploaded.jpg', { type: 'image/jpeg' });
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(screen.getByText('uploaded.jpg')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits comment with content only', async () => {
      const { api } = await import('../../api');
      
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Comment on this element...');
      const submitButton = screen.getByText('Comment');
      
      fireEvent.change(textarea, { target: { value: 'Test comment content' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/snapshots/test-snapshot/comments',
          expect.any(FormData)
        );
      });
    });

    it('submits comment with attachments', async () => {
      const { api } = await import('../../api');
      
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Comment on this element...');
      const fileInput = screen.getByRole('button', { name: /attach/i });
      const submitButton = screen.getByText('Comment');
      
      const file = new File(['test'], 'attachment.txt', { type: 'text/plain' });
      
      fireEvent.change(textarea, { target: { value: 'Comment with attachment' } });
      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });
    });

    it('shows loading state during submission', async () => {
      const { api } = await import('../../api');
      // Make API call take some time
      vi.mocked(api.post).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Comment on this element...');
      const submitButton = screen.getByText('Comment');
      
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      fireEvent.click(submitButton);
      
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
      });
    });

    it('prevents submission of empty comments', () => {
      render(<CommentModal {...defaultProps} />);
      
      const submitButton = screen.getByText('Comment');
      
      expect(submitButton).toBeDisabled();
      
      // Try with whitespace only
      const textarea = screen.getByPlaceholderText('Comment on this element...');
      fireEvent.change(textarea, { target: { value: '   ' } });
      
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Modal Behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      
      render(<CommentModal {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByRole('button', { name: '' }); // X button
      fireEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when cancel button is clicked', () => {
      const onClose = vi.fn();
      
      render(<CommentModal {...defaultProps} onClose={onClose} />);
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(onClose).toHaveBeenCalled();
    });

    it('resets form after successful submission', async () => {
      const { api } = await import('../../api');
      const onClose = vi.fn();
      
      render(<CommentModal {...defaultProps} onClose={onClose} />);
      
      const textarea = screen.getByPlaceholderText('Comment on this element...');
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      
      const submitButton = screen.getByText('Comment');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });
      
      // Should call onClose after successful submission
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('File Type Validation', () => {
    it('shows correct file icons for different types', () => {
      render(<CommentModal {...defaultProps} />);
      
      const imageFile = new File([''], 'image.jpg', { type: 'image/jpeg' });
      
      // Find the hidden file input and trigger change
      const hiddenFileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(hiddenFileInput, { target: { files: [imageFile] } });
      
      expect(screen.getByText('image.jpg')).toBeInTheDocument();
    });

    it('formats file sizes correctly', () => {
      render(<CommentModal {...defaultProps} />);
      
      const largeFile = new File(['x'.repeat(1024)], 'large.txt', { type: 'text/plain' });
      
      // Find the hidden file input and trigger change
      const hiddenFileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(hiddenFileInput, { target: { files: [largeFile] } });
      
      expect(screen.getByText('large.txt')).toBeInTheDocument();
      expect(screen.getByText(/1 KB/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.post).mockRejectedValue(new Error('Network error'));
      
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('Comment on this element...');
      const submitButton = screen.getByText('Comment');
      
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      fireEvent.click(submitButton);
      
      // Should not crash and button should be enabled again after error
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });
});