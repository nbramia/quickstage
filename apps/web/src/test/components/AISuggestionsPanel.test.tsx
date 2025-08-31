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
      
      expect(screen.queryByText('AI Suggestions')).not.toBeInTheDocument();
    });

    it('renders panel when isVisible is true', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      expect(screen.getByText('AI Suggestions')).toBeInTheDocument();
    });
  });

  describe('Initial State', () => {
    it('loads suggestions on mount', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockApi.api.get).toHaveBeenCalledWith('/api/snapshots/test-snapshot-123/ai-suggestions');
      });
    });

    it('shows loading state initially', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      expect(screen.getByRole('status', { name: /loading/i }) || screen.getByText(/loading/i)).toBeDefined();
    });

    it('displays UX score when analysis is available', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/UX Score: 85\/100/)).toBeInTheDocument();
      });
    });
  });

  describe('Generate Suggestions', () => {
    beforeEach(() => {
      vi.mocked(mockApi.api.get).mockResolvedValue({
        success: true,
        data: { suggestions: [], analysis: null }
      });
    });

    it('shows generate button when no suggestions exist', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Generate AI Suggestions')).toBeInTheDocument();
      });
    });

    it('calls generate API when generate button is clicked', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Generate AI Suggestions')).toBeInTheDocument();
      });
      
      const generateButton = screen.getByText('Generate AI Suggestions');
      fireEvent.click(generateButton);
      
      expect(mockApi.api.post).toHaveBeenCalledWith('/api/snapshots/test-snapshot-123/ai-suggestions/generate');
    });

    it('shows analyzing state during generation', async () => {
      vi.mocked(mockApi.api.post).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Generate AI Suggestions')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Generate AI Suggestions'));
      
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    });
  });

  describe('Suggestions Display', () => {
    it('displays suggestions list', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Add Alt Text to Images')).toBeInTheDocument();
        expect(screen.getByText('Ensure Adequate Button Size')).toBeInTheDocument();
      });
    });

    it('shows suggestion details', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Images should have descriptive alt text for screen readers.')).toBeInTheDocument();
      });
    });

    it('displays severity badges', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('medium')).toBeInTheDocument();
        expect(screen.getByText('low')).toBeInTheDocument();
      });
    });

    it('shows category icons', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('♿')).toBeInTheDocument(); // accessibility
        expect(screen.getByText('🎯')).toBeInTheDocument(); // usability
      });
    });

    it('displays action steps', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Identify all img elements in your HTML')).toBeInTheDocument();
        expect(screen.getByText('Add descriptive alt attributes to each image')).toBeInTheDocument();
      });
    });

    it('shows confidence score', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Confidence: 90%')).toBeInTheDocument();
        expect(screen.getByText('Confidence: 80%')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('shows filter dropdown', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        const filterSelect = screen.getByRole('combobox');
        expect(filterSelect).toBeInTheDocument();
      });
    });

    it('filters suggestions by category', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        const filterSelect = screen.getByRole('combobox');
        fireEvent.change(filterSelect, { target: { value: 'accessibility' } });
      });
      
      // Should show only accessibility suggestions
      expect(screen.getByText('Add Alt Text to Images')).toBeInTheDocument();
      expect(screen.queryByText('Ensure Adequate Button Size')).not.toBeInTheDocument();
    });

    it('filters by active status', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        const filterSelect = screen.getByRole('combobox');
        fireEvent.change(filterSelect, { target: { value: 'active' } });
      });
      
      // Should show only active suggestions
      expect(screen.getByText('Add Alt Text to Images')).toBeInTheDocument();
      expect(screen.queryByText('Ensure Adequate Button Size')).not.toBeInTheDocument();
    });
  });

  describe('Suggestion Actions', () => {
    it('shows action buttons for active suggestions', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Applied ✓')).toBeInTheDocument();
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
      });
    });

    it('calls API when suggestion is marked as applied', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        const applyButton = screen.getByText('Applied ✓');
        fireEvent.click(applyButton);
      });
      
      expect(mockApi.api.put).toHaveBeenCalledWith(
        '/api/snapshots/test-snapshot-123/ai-suggestions/suggestion-1',
        { status: 'applied', feedback: 'helpful' }
      );
    });

    it('calls API when suggestion is dismissed', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        const dismissButton = screen.getByText('Dismiss');
        fireEvent.click(dismissButton);
      });
      
      expect(mockApi.api.put).toHaveBeenCalledWith(
        '/api/snapshots/test-snapshot-123/ai-suggestions/suggestion-1',
        { status: 'dismissed', feedback: 'not_helpful' }
      );
    });

    it('shows status for completed suggestions', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('✓ Applied')).toBeInTheDocument();
      });
    });
  });

  describe('Analysis Summary', () => {
    it('displays analysis summary when available', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Analysis Summary')).toBeInTheDocument();
        expect(screen.getByText('Total: 2')).toBeInTheDocument();
        expect(screen.getByText('Score: 85/100')).toBeInTheDocument();
      });
    });
  });

  describe('Regenerate Functionality', () => {
    it('shows regenerate button when suggestions exist', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Regenerate Suggestions')).toBeInTheDocument();
      });
    });

    it('calls generate API when regenerate is clicked', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        const regenerateButton = screen.getByText('Regenerate Suggestions');
        fireEvent.click(regenerateButton);
      });
      
      expect(mockApi.api.post).toHaveBeenCalledWith('/api/snapshots/test-snapshot-123/ai-suggestions/generate');
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

  describe('Empty State', () => {
    beforeEach(() => {
      vi.mocked(mockApi.api.get).mockResolvedValue({
        success: true,
        data: { suggestions: [], analysis: null }
      });
    });

    it('shows empty state when no suggestions exist', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('No Suggestions Yet')).toBeInTheDocument();
        expect(screen.getByText('🔍')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      vi.mocked(mockApi.api.get).mockRejectedValue(new Error('API Error'));
      
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        // Should not crash and should show empty state or error state
        expect(screen.getByText('AI Suggestions')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible buttons', async () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          expect(button).toHaveAccessibleName();
        });
      });
    });

    it('has proper heading structure', () => {
      render(<AISuggestionsPanel {...defaultProps} />);
      
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });
  });
});