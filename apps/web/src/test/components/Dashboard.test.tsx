import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import Dashboard from '../../routes/Dashboard';

// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the useAuth hook
const mockUseAuth = {
  user: null as any,
  loading: false,
  error: null,
  logout: vi.fn(),
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
}));

// Mock the API module
vi.mock('../../api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ snapshots: [] }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.user = null;
    mockUseAuth.loading = false;
    mockUseAuth.error = null;
  });

  describe('Access Control', () => {
    it('shows loading state when user is not loaded', () => {
      mockUseAuth.user = null;
      render(<Dashboard />);
      
      // Should show loading spinner with specific class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('rounded-full');
      expect(spinner).toHaveClass('border-b-2');
    });

    it('shows dashboard content when user is loaded', async () => {
      mockUseAuth.user = { 
        role: 'user',
        uid: 'test-uid',
        name: 'Test User',
        email: 'user@test.com',
        plan: 'free'
      };
      
      render(<Dashboard />);
      
      // Wait for content to appear
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      });
      
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Core Actions', () => {
    it('shows sign out button and calls logout when clicked', async () => {
      mockUseAuth.user = { 
        role: 'user',
        uid: 'test-uid',
        name: 'Test User',
        email: 'user@test.com',
        plan: 'free'
      };
      
      render(<Dashboard />);
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      });
      
      // Find the logout button by its SVG content (it's an icon-only button)
      const signOutButtons = screen.getAllByRole('button');
      const logoutButton = signOutButtons.find(button => 
        button.querySelector('svg') && 
        button.querySelector('path')?.getAttribute('d')?.includes('M17 16l4-4')
      );
      expect(logoutButton).toBeInTheDocument();
      
      fireEvent.click(logoutButton!);
      expect(mockUseAuth.logout).toHaveBeenCalled();
    });

    it('shows navigation links', async () => {
      mockUseAuth.user = { 
        role: 'user',
        uid: 'test-uid',
        name: 'Test User',
        email: 'user@test.com',
        plan: 'free'
      };
      
      render(<Dashboard />);
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      });
      
      expect(screen.getByText(/settings/i)).toBeInTheDocument();
    });

    it('shows admin panel link for superadmin users', async () => {
      mockUseAuth.user = { 
        role: 'superadmin',
        uid: 'test-uid',
        name: 'Test Admin',
        email: 'admin@test.com',
        plan: 'free'
      };
      
      render(<Dashboard />);
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      });
      
      expect(screen.getByText(/admin/i)).toBeInTheDocument();
    });
  });
});
