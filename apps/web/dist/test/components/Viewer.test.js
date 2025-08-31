import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '../utils/test-utils';
import { Viewer } from '../../routes/Viewer';
// Mock the useParams hook
const mockParams = { id: 'test-snapshot-id' };
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useParams: () => mockParams,
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
        get: vi.fn().mockResolvedValue({
            snapshot: {
                id: 'test-snapshot-id',
                name: 'Test Snapshot',
                files: ['index.html', 'main.js'],
                totalBytes: 1024,
                createdAt: Date.now(),
                expiresAt: Date.now() + 86400000
            }
        }),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));
describe('Viewer Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.user = null;
        mockUseAuth.loading = false;
        mockUseAuth.error = null;
    });
    describe('Access Control', () => {
        it('shows loading state when user is not loaded', () => {
            mockUseAuth.loading = true;
            render(_jsx(Viewer, {}));
            expect(screen.getByText(/loading/i)).toBeInTheDocument();
        });
        it('shows viewer content when user is loaded', async () => {
            mockUseAuth.user = {
                role: 'user',
                uid: 'test-uid',
                name: 'Test User',
                email: 'user@test.com',
                plan: 'free'
            };
            render(_jsx(Viewer, {}));
            // Initially shows loading
            expect(screen.getByText('Loading snapshot...')).toBeInTheDocument();
            // Wait for loading to complete and content to appear
            await waitFor(() => {
                expect(screen.getByText(/snapshot: test-snapshot-id/i)).toBeInTheDocument();
            });
        });
    });
    describe('Core Actions', () => {
        it('shows dashboard navigation button', async () => {
            mockUseAuth.user = {
                role: 'user',
                uid: 'test-uid',
                name: 'Test User',
                email: 'user@test.com',
                plan: 'free'
            };
            render(_jsx(Viewer, {}));
            // Wait for loading to complete
            await waitFor(() => {
                expect(screen.getByText(/snapshot: test-snapshot-id/i)).toBeInTheDocument();
            });
            expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
        });
        it('shows snapshot files', async () => {
            mockUseAuth.user = {
                role: 'user',
                uid: 'test-uid',
                name: 'Test User',
                email: 'user@test.com',
                plan: 'free'
            };
            render(_jsx(Viewer, {}));
            // Wait for loading to complete
            await waitFor(() => {
                expect(screen.getByText(/snapshot: test-snapshot-id/i)).toBeInTheDocument();
            });
            expect(screen.getByText(/files \(2\)/i)).toBeInTheDocument();
        });
        it('shows snapshot preview section', async () => {
            mockUseAuth.user = {
                role: 'user',
                uid: 'test-uid',
                name: 'Test User',
                email: 'user@test.com',
                plan: 'free'
            };
            render(_jsx(Viewer, {}));
            // Wait for loading to complete
            await waitFor(() => {
                expect(screen.getByText(/snapshot: test-snapshot-id/i)).toBeInTheDocument();
            });
            expect(screen.getByText(/preview/i)).toBeInTheDocument();
        });
    });
});
