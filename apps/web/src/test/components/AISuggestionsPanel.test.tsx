import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import AISuggestionsPanel from '../../components/AISuggestionsPanel';

// Mock the API module
vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const mockApi = await import('../../api');

describe('AISuggestionsPanel Component', () => {
  const defaultProps = {
    snapshotId: 'test-snapshot-123',
    isVisible: true,
    onClose: vi.fn(),
  };

  const mockSuggestions = [
    {
      id: 'suggestion-1',
      snapshotId: 'test-snapshot-123',
      type: 'accessibility_missing_alt',
      title: 'Add Alt Text to Images',
      description: 'Images should have descriptive alt text for screen readers.',
      severity: 'medium' as const,
      category: 'accessibility' as const,
      actionable: true,
      actionSteps: [
        'Identify all img elements in your HTML',
        'Add descriptive alt attributes to each image',
        'Use empty alt="" for decorative images',
        'Test with a screen reader or accessibility tool'
      ],
      confidence: 0.9,
      generatedAt: Date.now(),
      status: 'active' as const,
      resources: [
        { title: 'WebAIM Alt Text Guide', url: 'https://webaim.org/articles/alt/', type: 'guide' }
      ]
    },
    {
      id: 'suggestion-2',
      snapshotId: 'test-snapshot-123',
      type: 'usability_button_size',
      title: 'Ensure Adequate Button Size',
      description: 'Interactive elements should be at least 44x44px for easy touch interaction.',
      severity: 'low' as const,
      category: 'usability' as const,
      actionable: true,
      actionSteps: ['Review all buttons', 'Ensure 44x44px minimum size'],
      confidence: 0.8,
      generatedAt: Date.now(),
      status: 'applied' as const,
    }
  ];

  const mockAnalysis = {
    snapshotId: 'test-snapshot-123',
    totalSuggestions: 2,
    suggestionsByCategory: { accessibility: 1, usability: 1 },
    suggestionsBySeverity: { medium: 1, low: 1 },
    overallScore: 85,
    lastAnalyzedAt: Date.now(),
    analysisVersion: '1.0'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockApi.api.get).mockResolvedValue({
      success: true,
      data: { suggestions: mockSuggestions, analysis: mockAnalysis }
    });
    vi.mocked(mockApi.api.post).mockResolvedValue({
      success: true,
      data: { suggestions: mockSuggestions, analysis: mockAnalysis }
    });
    vi.mocked(mockApi.api.put).mockResolvedValue({ success: true });
  });

  describe('Visibility', () => {
    it('renders nothing when isVisible is false', () => {
      render(<AISuggestionsPanel {...defaultProps} isVisible={false} />);
      
      expect(screen.queryByText('🤖 AI UX Assistant')).not.toBeInTheDocument();
    });

    it('renders panel when isVisible is true', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      expect(screen.getByText('🤖 AI UX Assistant')).toBeInTheDocument();
    });
  });

  describe('Initial State', () => {
    it('loads suggestions on mount', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockApi.api.get).toHaveBeenCalledWith('/api/snapshots/test-snapshot-123/ai-chat');
      });
    });

    it('shows welcome screen initially', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      expect(screen.getByText('🚀 Start AI Analysis')).toBeInTheDocument();
      expect(screen.getByText('AI-Powered UX Analysis')).toBeInTheDocument();
    });

    it('shows AI UX Assistant title', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      expect(screen.getByText('🤖 AI UX Assistant')).toBeInTheDocument();
      expect(screen.getByText('Get expert UI/UX feedback and suggestions')).toBeInTheDocument();
    });
  });

  describe('Start Analysis', () => {
    it('shows start analysis button initially', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      expect(screen.getByText('🚀 Start AI Analysis')).toBeInTheDocument();
    });

    it('calls start API when start button is clicked', async () => {
      vi.mocked(mockApi.api.post).mockResolvedValue({
        data: { success: true, data: { messages: [] } }
      });
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      const startButton = screen.getByText('🚀 Start AI Analysis');
      fireEvent.click(startButton);
      
      // Wait for the API call to happen (component has a 100ms delay)
      await waitFor(() => {
        expect(mockApi.api.post).toHaveBeenCalledWith('/api/snapshots/test-snapshot-123/ai-chat/start');
      });
    });

    it('shows loading state during initialization', async () => {
      vi.mocked(mockApi.api.post).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('🚀 Start AI Analysis'));
      
      expect(screen.getByText('Analyzing your prototype...')).toBeInTheDocument();
    });
  });

  describe('Chat Interface', () => {
    beforeEach(() => {
      vi.mocked(mockApi.api.post).mockResolvedValue({
        data: { success: true, data: { messages: [{ role: 'assistant', content: 'Hello! I can help analyze your prototype.' }] } }
      });
    });

    it('shows chat interface after starting analysis', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('🚀 Start AI Analysis'));
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...')).toBeInTheDocument();
      });
    });

    it('displays AI messages', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('🚀 Start AI Analysis'));
      
      await waitFor(() => {
        expect(screen.getByText('Hello! I can help analyze your prototype.')).toBeInTheDocument();
      });
    });

    it('allows sending messages', async () => {
      vi.mocked(mockApi.api.post)
        .mockResolvedValueOnce({ data: { success: true, data: { messages: [] } } })
        .mockResolvedValueOnce({ data: { success: true, data: { response: 'AI response' } } });
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('🚀 Start AI Analysis'));
      
      await waitFor(() => {
        const textInput = screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...');
        expect(textInput).toBeInTheDocument();
      });
      
      const textInput = screen.getByPlaceholderText('Ask about accessibility, mobile design, user flow...');
      fireEvent.change(textInput, { target: { value: 'Test message' } });
      
      const sendButton = screen.getByRole('button', { name: '' }); // Send button with SVG icon
      fireEvent.click(sendButton);
      
      expect(mockApi.api.post).toHaveBeenCalledWith('/api/snapshots/test-snapshot-123/ai-chat/message', {
        message: 'Test message'
      });
    });
  });

  describe('Features Display', () => {
    it('shows AI analysis features in welcome screen', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      expect(screen.getByText('Accessibility & WCAG compliance')).toBeInTheDocument();
      expect(screen.getByText('Mobile responsiveness analysis')).toBeInTheDocument();
      expect(screen.getByText('Visual hierarchy & typography')).toBeInTheDocument();
      expect(screen.getByText('Interactive Q&A with AI expert')).toBeInTheDocument();
    });
  });

  describe('Message Interaction', () => {
    it('shows character count', async () => {
      vi.mocked(mockApi.api.post).mockResolvedValue({ data: { success: true, data: { messages: [] } } });
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('🚀 Start AI Analysis'));
      
      await waitFor(() => {
        expect(screen.getByText('0/1000')).toBeInTheDocument();
      });
    });

    it('shows keyboard shortcuts hint', async () => {
      vi.mocked(mockApi.api.post).mockResolvedValue({ data: { success: true, data: { messages: [] } } });
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('🚀 Start AI Analysis'));
      
      await waitFor(() => {
        expect(screen.getByText('Press Enter to send, Shift+Enter for new line')).toBeInTheDocument();
      });
    });
  });

  describe('Loading Conversation', () => {
    it('loads existing conversation when available', async () => {
      vi.mocked(mockApi.api.get).mockResolvedValue({
        data: { success: true, data: { exists: true, messages: [{ role: 'assistant', content: 'Previous message' }] } }
      });
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Previous message')).toBeInTheDocument();
      });
    });
  });


  describe('Close Functionality', () => {
    it('calls onClose when close button is clicked', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Welcome State', () => {
    it('shows welcome state when no conversation exists', () => {
      vi.mocked(mockApi.api.get).mockResolvedValue({
        data: { success: true, data: { exists: false } }
      });
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      expect(screen.getByText('🎨')).toBeInTheDocument();
      expect(screen.getByText('AI-Powered UX Analysis')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      vi.mocked(mockApi.api.get).mockRejectedValue(new Error('API Error'));
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        // Should not crash and should show empty state or error state
        expect(screen.getByText('🤖 AI UX Assistant')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible buttons', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('has proper heading structure', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });
  });
});