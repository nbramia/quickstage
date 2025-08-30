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
      expect(screen.getByPlaceholderText('What would you like to comment about this element?')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<CommentModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Add Comment')).not.toBeInTheDocument();
    });

    it('shows position information', () => {
      render(<CommentModal {...defaultProps} />);
      
      expect(screen.getByText('Comment Position')).toBeInTheDocument();
      expect(screen.getByText('x: 100, y: 200')).toBeInTheDocument();
    });

    it('shows element information when provided', () => {
      const elementInfo = {
        text: 'Button text content',
        selector: 'button.primary',
        tagName: 'BUTTON'
      };
      
      render(<CommentModal {...defaultProps} elementInfo={elementInfo} />);
      
      expect(screen.getByText(/Element: "Button text content"/)).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('allows typing in comment textarea', () => {
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('What would you like to comment about this element?');
      fireEvent.change(textarea, { target: { value: 'This is a test comment' } });
      
      expect((textarea as HTMLTextAreaElement).value).toBe('This is a test comment');
    });

    it('shows character count', () => {
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('What would you like to comment about this element?');
      fireEvent.change(textarea, { target: { value: 'Test' } });
      
      expect(screen.getByText('4/1000 characters')).toBeInTheDocument();
    });

    it('enables submit button when content is provided', () => {
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('What would you like to comment about this element?');
      const submitButton = screen.getByText('Post Comment');
      
      expect(submitButton).toBeDisabled();
      
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('File Upload', () => {
    it('shows file upload area', () => {
      render(<CommentModal {...defaultProps} />);
      
      expect(screen.getByText('Attachments (optional)')).toBeInTheDocument();
      expect(screen.getByText('Click to upload')).toBeInTheDocument();
    });

    it('accepts file selection', () => {
      render(<CommentModal {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/Click to upload/);
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(screen.getByText('1 file(s) selected')).toBeInTheDocument();
    });

    it('displays selected files with details', () => {
      render(<CommentModal {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/Click to upload/);
      const file = new File(['test content'], 'test-document.pdf', { type: 'application/pdf' });
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText(/\d+ Bytes/)).toBeInTheDocument(); // File size
    });

    it('allows removing selected files', () => {
      render(<CommentModal {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/Click to upload/);
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      const removeButton = screen.getByRole('button', { name: '' }); // X button
      fireEvent.click(removeButton);
      
      expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    });

    it('handles drag and drop', () => {
      render(<CommentModal {...defaultProps} />);
      
      const dropArea = screen.getByText(/Click to upload/).closest('div');
      const file = new File(['content'], 'dropped.jpg', { type: 'image/jpeg' });
      
      fireEvent.dragOver(dropArea!);
      fireEvent.drop(dropArea!, {
        dataTransfer: {
          files: [file]
        }
      });
      
      expect(screen.getByText('dropped.jpg')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits comment with content only', async () => {
      const { api } = await import('../../api');
      const onSuccess = vi.fn();
      
      render(<CommentModal {...defaultProps} onSuccess={onSuccess} />);
      
      const textarea = screen.getByPlaceholderText('What would you like to comment about this element?');
      const submitButton = screen.getByText('Post Comment');
      
      fireEvent.change(textarea, { target: { value: 'Test comment content' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/snapshots/test-snapshot/comments',
          expect.any(FormData),
          expect.objectContaining({
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          })
        );
      });
      
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('submits comment with attachments', async () => {
      const { api } = await import('../../api');
      
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('What would you like to comment about this element?');
      const fileInput = screen.getByLabelText(/Click to upload/);
      const submitButton = screen.getByText('Post Comment');
      
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
      
      const textarea = screen.getByPlaceholderText('What would you like to comment about this element?');
      const submitButton = screen.getByText('Post Comment');
      
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      fireEvent.click(submitButton);
      
      expect(screen.getByText('Posting...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText('Posting...')).not.toBeInTheDocument();
      });
    });

    it('prevents submission of empty comments', () => {
      render(<CommentModal {...defaultProps} />);
      
      const submitButton = screen.getByText('Post Comment');
      
      expect(submitButton).toBeDisabled();
      
      // Try with whitespace only
      const textarea = screen.getByPlaceholderText('What would you like to comment about this element?');
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
      
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('What would you like to comment about this element?');
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      
      const submitButton = screen.getByText('Post Comment');
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });
      
      // Form should be reset (component would close, but we can test the intent)
      expect((textarea as HTMLTextAreaElement).value).toBe(''); // This might not work due to component state
    });
  });

  describe('File Type Validation', () => {
    it('shows correct file icons for different types', () => {
      render(<CommentModal {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/Click to upload/);
      
      // Test different file types
      const imageFile = new File([''], 'image.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [imageFile] } });
      
      expect(screen.getByText('🖼️')).toBeInTheDocument();
    });

    it('formats file sizes correctly', () => {
      render(<CommentModal {...defaultProps} />);
      
      const fileInput = screen.getByLabelText(/Click to upload/);
      const largeFile = new File(['x'.repeat(1024)], 'large.txt', { type: 'text/plain' });
      
      fireEvent.change(fileInput, { target: { files: [largeFile] } });
      
      expect(screen.getByText(/1 KB/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      const { api } = await import('../../api');
      vi.mocked(api.post).mockRejectedValue(new Error('Network error'));
      
      render(<CommentModal {...defaultProps} />);
      
      const textarea = screen.getByPlaceholderText('What would you like to comment about this element?');
      const submitButton = screen.getByText('Post Comment');
      
      fireEvent.change(textarea, { target: { value: 'Test comment' } });
      fireEvent.click(submitButton);
      
      // Should not crash and button should be enabled again after error
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });
});