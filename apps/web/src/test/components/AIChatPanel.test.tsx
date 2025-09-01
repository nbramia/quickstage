import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AISuggestionsPanel from '../../components/AISuggestionsPanel';
import { api } from '../../api';

// Mock the api module
vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApi = vi.mocked(api);

describe('AISuggestionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for conversation loading
    mockApi.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          exists: false,
          messages: []
        }
      }
    });
  });

  it('renders welcome screen when panel is visible and not started', () => {
    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    expect(screen.getByText('🤖 AI UX Assistant')).toBeInTheDocument();
    expect(screen.getByText('AI-Powered UX Analysis')).toBeInTheDocument();
    expect(screen.getByText('🚀 Start AI Analysis')).toBeInTheDocument();
    expect(screen.getByText('Accessibility & WCAG compliance')).toBeInTheDocument();
    expect(screen.getByText('Mobile responsiveness analysis')).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={false} 
        onClose={() => {}} 
      />
    );

    expect(screen.queryByText('🤖 AI UX Assistant')).not.toBeInTheDocument();
  });

  it('loads existing conversation on mount', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          exists: true,
          messages: [
            { role: 'assistant', content: 'Hello! I\'ve analyzed your prototype.' }
          ]
        }
      }
    };
    mockApi.get.mockResolvedValueOnce(mockResponse);

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/api/snapshots/test-snapshot/ai-chat');
    });

    await waitFor(() => {
      expect(screen.getByText('Hello! I\'ve analyzed your prototype.')).toBeInTheDocument();
    });
  });

  it('starts new conversation when button is clicked', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          conversationId: 'conv-123',
          messages: [
            { role: 'assistant', content: 'I\'ve analyzed your prototype and found several areas for improvement.' }
          ]
        }
      }
    };
    mockApi.post.mockResolvedValueOnce(mockResponse);

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    const startButton = screen.getByText('🚀 Start AI Analysis');
    fireEvent.click(startButton);

    expect(screen.getByText('Analyzing your prototype...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/snapshots/test-snapshot/ai-chat/start');
    });

    await waitFor(() => {
      expect(screen.getByText('I\'ve analyzed your prototype and found several areas for improvement.')).toBeInTheDocument();
    });
  });

  it('handles start conversation error gracefully', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Network error'));

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    const startButton = screen.getByText('🚀 Start AI Analysis');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to connect to AI service. Please try again.')).toBeInTheDocument();
    });
  });

  it('handles rate limit error appropriately', async () => {
    const mockError = {
      response: { status: 429 }
    };
    mockApi.post.mockRejectedValueOnce(mockError);

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    const startButton = screen.getByText('🚀 Start AI Analysis');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded. Please try again in an hour.')).toBeInTheDocument();
    });
  });

  it('handles service unavailable error appropriately', async () => {
    const mockError = {
      response: { status: 503 }
    };
    mockApi.post.mockRejectedValueOnce(mockError);

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    const startButton = screen.getByText('🚀 Start AI Analysis');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('AI service is temporarily unavailable. Please try again later.')).toBeInTheDocument();
    });
  });

  it('renders chat interface when conversation exists', async () => {
    const mockGetResponse = {
      data: {
        success: true,
        data: {
          exists: true,
          messages: [
            { role: 'assistant', content: 'Hello! How can I help improve your prototype?' }
          ]
        }
      }
    };
    mockApi.get.mockResolvedValueOnce(mockGetResponse);

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...')).toBeInTheDocument();
    });

    expect(screen.getByText('Press Enter to send, Shift+Enter for new line')).toBeInTheDocument();
    expect(screen.getByText('0/1000')).toBeInTheDocument();
  });

  it('sends message successfully', async () => {
    // Setup existing conversation
    const mockGetResponse = {
      data: {
        success: true,
        data: {
          exists: true,
          messages: [
            { role: 'assistant', content: 'Hello! How can I help?' }
          ]
        }
      }
    };
    mockApi.get.mockResolvedValueOnce(mockGetResponse);

    // Mock message response
    const mockPostResponse = {
      data: {
        success: true,
        data: {
          response: 'Here are some suggestions for improving accessibility...',
          messages: [
            { role: 'assistant', content: 'Hello! How can I help?' },
            { role: 'user', content: 'How can I improve accessibility?' },
            { role: 'assistant', content: 'Here are some suggestions for improving accessibility...' }
          ]
        }
      }
    };
    mockApi.post.mockResolvedValueOnce(mockPostResponse);

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...');
    const sendButton = screen.getByRole('button', { name: '' }); // Send button with SVG

    fireEvent.change(textarea, { target: { value: 'How can I improve accessibility?' } });
    fireEvent.click(sendButton);

    expect(screen.getByText('How can I improve accessibility?')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/snapshots/test-snapshot/ai-chat/message', {
        message: 'How can I improve accessibility?'
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Here are some suggestions for improving accessibility...')).toBeInTheDocument();
    });
  });

  it('validates message length', async () => {
    const mockGetResponse = {
      data: {
        success: true,
        data: {
          exists: true,
          messages: [{ role: 'assistant', content: 'Hello!' }]
        }
      }
    };
    mockApi.get.mockResolvedValueOnce(mockGetResponse);

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...');
    const longMessage = 'a'.repeat(1001); // Over the 1000 character limit
    
    fireEvent.change(textarea, { target: { value: longMessage } });
    
    expect(screen.getByText('1001/1000')).toBeInTheDocument();
  });

  it('handles Enter key for sending messages', async () => {
    const mockGetResponse = {
      data: {
        success: true,
        data: {
          exists: true,
          messages: [{ role: 'assistant', content: 'Hello!' }]
        }
      }
    };
    mockApi.get.mockResolvedValueOnce(mockGetResponse);

    const mockPostResponse = {
      data: {
        success: true,
        data: {
          response: 'Great question!',
          messages: []
        }
      }
    };
    mockApi.post.mockResolvedValueOnce(mockPostResponse);

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...');
    
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyPress(textarea, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/snapshots/test-snapshot/ai-chat/message', {
        message: 'Test message'
      });
    });
  });

  it('closes panel when close button is clicked', () => {
    const mockOnClose = vi.fn();
    
    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={mockOnClose} 
      />
    );

    const closeButton = screen.getByLabelText('Close panel');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state when sending message', async () => {
    const mockGetResponse = {
      data: {
        success: true,
        data: {
          exists: true,
          messages: [{ role: 'assistant', content: 'Hello!' }]
        }
      }
    };
    mockApi.get.mockResolvedValueOnce(mockGetResponse);

    // Mock a slow response
    const mockPostResponse = {
      data: {
        success: true,
        data: { response: 'Response', messages: [] }
      }
    };
    mockApi.post.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve(mockPostResponse), 100))
    );

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...');
    const sendButton = screen.getByRole('button', { name: '' });

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    expect(screen.getByText('AI is thinking...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('AI is thinking...')).not.toBeInTheDocument();
    });
  });

  it('formats AI messages with markdown-like formatting', async () => {
    const mockGetResponse = {
      data: {
        success: true,
        data: {
          exists: true,
          messages: [
            { 
              role: 'assistant', 
              content: '**Main Issue**\n\n- First suggestion\n- Second suggestion\n\nRegular text here' 
            }
          ]
        }
      }
    };
    mockApi.get.mockResolvedValueOnce(mockGetResponse);

    render(
      <AISuggestionsPanel 
        snapshotId="test-snapshot" 
        isVisible={true} 
        onClose={() => {}} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Main Issue')).toBeInTheDocument();
      expect(screen.getByText('• First suggestion')).toBeInTheDocument();
      expect(screen.getByText('• Second suggestion')).toBeInTheDocument();
      expect(screen.getByText('Regular text here')).toBeInTheDocument();
    });
  });
});