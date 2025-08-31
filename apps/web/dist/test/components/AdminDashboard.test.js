import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import AdminDashboard from '../../routes/AdminDashboard';
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
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
    adminApi: {
        getUsers: vi.fn(),
        createUser: vi.fn(),
        deactivateUser: vi.fn(),
        activateUser: vi.fn(),
        deleteUser: vi.fn(),
    },
}));
describe('AdminDashboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.user = null;
        mockUseAuth.loading = false;
        mockUseAuth.error = null;
    });
    describe('Access Control', () => {
        it('shows access denied for non-superadmin users', () => {
            mockUseAuth.user = { role: 'user' };
            render(_jsx(AdminDashboard, {}));
            expect(screen.getByText('Access Denied')).toBeInTheDocument();
            expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });
        it('shows access denied for admin users', () => {
            mockUseAuth.user = { role: 'admin' };
            render(_jsx(AdminDashboard, {}));
            expect(screen.getByText('Access Denied')).toBeInTheDocument();
            expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });
        it('allows superadmin users to access admin dashboard', async () => {
            mockUseAuth.user = {
                role: 'superadmin',
                uid: 'superadmin',
                name: 'Test Admin',
                email: 'admin@test.com'
            };
            render(_jsx(AdminDashboard, {}));
            // Initially shows loading
            expect(screen.getByText('Loading users...')).toBeInTheDocument();
            // Wait for loading to complete and content to appear
            await waitFor(() => {
                expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
            });
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });
    describe('Core Actions', () => {
        it('shows back to dashboard link', async () => {
            mockUseAuth.user = {
                role: 'superadmin',
                uid: 'superadmin',
                name: 'Test Admin',
                email: 'admin@test.com'
            };
            render(_jsx(AdminDashboard, {}));
            // Wait for loading to complete
            await waitFor(() => {
                expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
            });
            const backLink = screen.getByRole('link', { name: /back to dashboard/i });
            expect(backLink).toBeInTheDocument();
            expect(backLink).toHaveAttribute('href', '/dashboard');
        });
        it('shows admin dashboard content for superadmin users', async () => {
            mockUseAuth.user = {
                role: 'superadmin',
                uid: 'superadmin',
                name: 'Test Admin',
                email: 'admin@test.com'
            };
            render(_jsx(AdminDashboard, {}));
            // Wait for loading to complete
            await waitFor(() => {
                expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
            });
            // Check for key admin dashboard elements
            expect(screen.getByText('Manage QuickStage users and accounts')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /users \(0\)/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /create new user/i })).toBeInTheDocument();
        });
    });
});
