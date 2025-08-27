import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '../utils/test-utils';
import { Settings } from '../../routes/Settings';

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
  cancelSubscription: vi.fn(),
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
}));

// Mock the API module
vi.mock('../../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.user = null;
    mockUseAuth.loading = false;
    mockUseAuth.error = null;
  });

  describe('Access Control', () => {
    it('shows loading state when user is not loaded', () => {
      mockUseAuth.loading = true;
      render(<Settings />);
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows settings content when user is loaded', () => {
      mockUseAuth.user = { 
        role: 'user',
        uid: 'test-uid',
        name: 'Test User',
        email: 'user@test.com',
        plan: 'free'
      };
      
      render(<Settings />);
      
      expect(screen.getByText(/account settings/i)).toBeInTheDocument();
    });
  });

  describe('Core Actions', () => {
    it('shows sign out button and calls logout when clicked', () => {
      mockUseAuth.user = { 
        role: 'user',
        uid: 'test-uid',
        name: 'Test User',
        email: 'user@test.com',
        plan: 'free'
      };
      
      render(<Settings />);
      
      // There are multiple sign out buttons, so use getAllByRole and click the first one
      const signOutButtons = screen.getAllByRole('button', { name: /sign out/i });
      expect(signOutButtons.length).toBeGreaterThan(0);
      
      const firstSignOutButton = signOutButtons[0];
      if (firstSignOutButton) {
        fireEvent.click(firstSignOutButton);
        expect(mockUseAuth.logout).toHaveBeenCalled();
      }
    });

    it('shows navigation links', () => {
      mockUseAuth.user = { 
        role: 'user',
        uid: 'test-uid',
        name: 'Test User',
        email: 'user@test.com',
        plan: 'free'
      };
      
      render(<Settings />);
      
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    it('shows superadmin-specific content for superadmin users', () => {
      mockUseAuth.user = { 
        role: 'superadmin',
        uid: 'test-uid',
        name: 'Test Admin',
        email: 'admin@test.com',
        plan: 'free'
      };
      
      render(<Settings />);
      
      // Check for superadmin-specific content
      expect(screen.getByText(/pro \(superadmin\) - permanent access/i)).toBeInTheDocument();
    });

    it('shows delete account button', () => {
      mockUseAuth.user = { 
        role: 'user',
        uid: 'test-uid',
        name: 'Test User',
        email: 'user@test.com',
        plan: 'free'
      };
      
      render(<Settings />);
      
      expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
    });
  });
});
