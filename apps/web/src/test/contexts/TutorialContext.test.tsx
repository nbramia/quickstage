import React from 'react';
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Simple mocks that resolve immediately
    vi.mocked(mockApi.api.get).mockResolvedValue({ success: true, data: {} });
    vi.mocked(mockApi.api.put).mockResolvedValue({ success: true, data: {} });
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
    it('provides initial context values', () => {
      const { result } = renderTutorialHook();

      expect(result.current.activeTutorial).toBeNull();
      expect(result.current.currentStep).toBe(0);
      expect(typeof result.current.startTutorial).toBe('function');
    });
  });

  describe('Tutorial Management', () => {
    it('provides tutorial management functions', () => {
      const { result } = renderTutorialHook();

      expect(typeof result.current.startTutorial).toBe('function');
      expect(typeof result.current.nextStep).toBe('function');
      expect(typeof result.current.previousStep).toBe('function');
      expect(typeof result.current.skipTutorial).toBe('function');
    });
  });

  describe('Welcome Flow', () => {
    it('provides welcome flow functions', () => {
      const { result } = renderTutorialHook();

      expect(typeof result.current.markWelcomeSeen).toBe('function');
      expect(typeof result.current.skipWelcome).toBe('function');
    });
  });

  describe('Tutorial Completion', () => {
    it('provides tutorial completion tracking', () => {
      const { result } = renderTutorialHook();

      expect(result.current.onboarding).toBeNull();
      expect(typeof result.current.trackTutorialEvent).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('handles invalid tutorial IDs gracefully', () => {
      const { result } = renderTutorialHook();

      act(() => {
        result.current.startTutorial('non-existent-tutorial');
      });

      expect(result.current.activeTutorial).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('provides loading state', () => {
      const { result } = renderTutorialHook();
      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });

  describe('Tutorial Event Tracking', () => {
    it('provides event tracking function', () => {
      const { result } = renderTutorialHook();

      expect(typeof result.current.trackTutorialEvent).toBe('function');
    });
  });
});