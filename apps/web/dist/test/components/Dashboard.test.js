import { jsx as _jsx } from "react/jsx-runtime";
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
    user: null,
    loading: false,
    error: null,
    logout: vi.fn(),
};
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth,
    AuthProvider: ({ children }) => _jsx("div", { "data-testid": "auth-provider", children: children }),
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
            mockUseAuth.loading = true;
            render(_jsx(Dashboard, {}));
            expect(screen.getByText(/loading/i)).toBeInTheDocument();
        });
        it('shows dashboard content when user is loaded', async () => {
            mockUseAuth.user = {
                role: 'user',
                uid: 'test-uid',
                name: 'Test User',
                email: 'user@test.com',
                plan: 'free'
            };
            render(_jsx(Dashboard, {}));
            // Initially shows loading
            expect(screen.getByText('Loading your snapshots...')).toBeInTheDocument();
            // Wait for loading to complete and content to appear
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
            render(_jsx(Dashboard, {}));
            // Wait for loading to complete
            await waitFor(() => {
                expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
            });
            const signOutButton = screen.getByRole('button', { name: /sign out/i });
            expect(signOutButton).toBeInTheDocument();
            fireEvent.click(signOutButton);
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
            render(_jsx(Dashboard, {}));
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
            render(_jsx(Dashboard, {}));
            // Wait for loading to complete
            await waitFor(() => {
                expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
            });
            expect(screen.getByText(/admin panel/i)).toBeInTheDocument();
        });
    });
});
