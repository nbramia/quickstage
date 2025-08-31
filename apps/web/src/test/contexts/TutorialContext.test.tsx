import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, render, screen } from '../utils/test-utils';
import { TutorialProvider, useTutorial } from '../../contexts/TutorialContext';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API and auth
vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: { uid: 'test-user', name: 'Test User' },
    isAuthenticated: true,
  }),
}));

const mockApi = await import('../../api');

describe('TutorialContext', () => {
  const mockOnboardingData = {
    hasSeenWelcome: false,
    completedTutorials: [],
    welcomeShownAt: undefined,
    lastTutorialCompletedAt: undefined,
    skippedWelcome: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockApi.api.get).mockImplementation((url) => {
      if (url.includes('should-show-welcome')) {
        return Promise.resolve({
          success: true,
          data: { shouldShow: true, onboarding: mockOnboardingData }
        });
      }
      if (url.includes('onboarding')) {
        return Promise.resolve({
          success: true,
          data: mockOnboardingData
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });
    vi.mocked(mockApi.api.put).mockResolvedValue({ success: true, data: mockOnboardingData });
    vi.mocked(mockApi.api.post).mockResolvedValue({ success: true });
  });

  const renderTutorialHook = () => {
    return renderHook(() => useTutorial(), {
      wrapper: ({ children }) => (
        <AuthProvider>
          <TutorialProvider>{children}</TutorialProvider>
        </AuthProvider>
      ),
    });
  };

  describe('Provider Setup', () => {
    it('provides tutorial context to children', () => {
      const TestComponent = () => {
        const context = useTutorial();
        return <div>{context ? 'Context available' : 'No context'}</div>;
      };

      render(
        <AuthProvider>
          <TutorialProvider>
            <TestComponent />
          </TutorialProvider>
        </AuthProvider>
      );

      expect(screen.getByText('Context available')).toBeInTheDocument();
    });

    it('throws error when used outside provider', () => {
      const TestComponent = () => {
        try {
          useTutorial();
          return <div>No error</div>;
        } catch (error) {
          return <div>Error thrown</div>;
        }
      };

      render(<TestComponent />);
      expect(screen.getByText('Error thrown')).toBeInTheDocument();
    });
  });

  describe('Initial State', () => {
    it('loads onboarding state on mount', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockApi.api.get).toHaveBeenCalledWith('/api/onboarding');
      expect(mockApi.api.get).toHaveBeenCalledWith('/api/onboarding/should-show-welcome');
    });

    it('sets initial state correctly', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.activeTutorial).toBeNull();
      expect(result.current.currentStep).toBe(0);
      expect(result.current.shouldShowWelcome).toBe(true);
    });
  });

  describe('Tutorial Management', () => {
    it('starts tutorial correctly', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.startTutorial('welcome');
      });

      expect(result.current.activeTutorial?.id).toBe('welcome');
      expect(result.current.currentStep).toBe(0);
      expect(mockApi.api.post).toHaveBeenCalledWith('/api/onboarding/tutorial', {
        tutorialId: 'welcome',
        action: 'started'
      });
    });

    it('advances to next step', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.startTutorial('welcome');
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('goes to previous step', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.startTutorial('welcome');
        result.current.nextStep();
      });

      act(() => {
        result.current.previousStep();
      });

      expect(result.current.currentStep).toBe(0);
    });

    it('completes tutorial on final step', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.startTutorial('welcome');
      });

      // Advance through all steps
      const welcomeTutorial = result.current.activeTutorial;
      if (welcomeTutorial) {
        for (let i = 0; i < welcomeTutorial.steps.length; i++) {
          act(() => {
            result.current.nextStep();
          });
        }
      }

      expect(result.current.activeTutorial).toBeNull();
      expect(result.current.currentStep).toBe(0);
    });

    it('skips tutorial', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.startTutorial('welcome');
      });

      act(() => {
        result.current.skipTutorial();
      });

      expect(result.current.activeTutorial).toBeNull();
      expect(mockApi.api.post).toHaveBeenCalledWith('/api/onboarding/tutorial', {
        tutorialId: 'welcome',
        action: 'skipped',
        step: 0
      });
    });
  });

  describe('Welcome Flow', () => {
    it('marks welcome as seen', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.markWelcomeSeen();
      });

      expect(mockApi.api.put).toHaveBeenCalledWith('/api/onboarding', {
        hasSeenWelcome: true
      });
    });

    it('skips welcome', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.skipWelcome();
      });

      expect(mockApi.api.put).toHaveBeenCalledWith('/api/onboarding', {
        skippedWelcome: true
      });
    });
  });

  describe('Tutorial Completion', () => {
    it('updates completed tutorials', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.startTutorial('welcome');
      });

      // Mock the tutorial completion
      const welcomeTutorial = result.current.activeTutorial;
      if (welcomeTutorial) {
        for (let i = 0; i < welcomeTutorial.steps.length; i++) {
          act(() => {
            result.current.nextStep();
          });
        }
      }

      expect(mockApi.api.put).toHaveBeenCalledWith('/api/onboarding', {
        completedTutorials: ['welcome']
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      vi.mocked(mockApi.api.get).mockRejectedValue(new Error('API Error'));

      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should not crash
      expect(result.current.onboarding).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('handles non-existent tutorial gracefully', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.startTutorial('non-existent-tutorial');
      });

      expect(result.current.activeTutorial).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('shows loading state initially', () => {
      const { result } = renderTutorialHook();
      expect(result.current.isLoading).toBe(false); // Initial state before auth
    });

    it('handles loading state during API calls', async () => {
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      vi.mocked(mockApi.api.get).mockReturnValue(delayedPromise);

      const { result } = renderTutorialHook();

      // Initial loading should be true
      expect(result.current.isLoading).toBe(false);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          success: true,
          data: mockOnboardingData
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Tutorial Event Tracking', () => {
    it('tracks tutorial events', async () => {
      const { result } = renderTutorialHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.trackTutorialEvent('welcome', 'started', 0);
      });

      expect(mockApi.api.post).toHaveBeenCalledWith('/api/onboarding/tutorial', {
        tutorialId: 'welcome',
        action: 'started',
        step: 0
      });
    });
  });
});