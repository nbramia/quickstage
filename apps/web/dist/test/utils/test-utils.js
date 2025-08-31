import { jsx as _jsx } from "react/jsx-runtime";
import { render, waitFor, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, expect } from 'vitest';
import { AuthProvider } from '../../contexts/AuthContext';
// Custom render function that includes all necessary providers
const AllTheProviders = ({ children }) => {
    return (_jsx(BrowserRouter, { children: _jsx(AuthProvider, { children: children }) }));
};
const customRender = (ui, options) => render(ui, { wrapper: AllTheProviders, ...options });
// Re-export everything
export * from '@testing-library/react';
// Override render method
export { customRender as render };
// Test user data
export const testUsers = {
    free: {
        uid: 'user-free-123',
        email: 'free@example.com',
        name: 'Free User',
        plan: 'free',
        role: 'user',
        subscriptionStatus: 'none',
        canAccessPro: false,
        subscriptionDisplay: 'Free',
        createdAt: Date.now() - 86400000,
        lastLoginAt: Date.now() - 3600000,
    },
    pro: {
        uid: 'user-pro-456',
        email: 'pro@example.com',
        name: 'Pro User',
        plan: 'pro',
        role: 'user',
        subscriptionStatus: 'active',
        canAccessPro: true,
        subscriptionDisplay: 'Pro',
        createdAt: Date.now() - 172800000,
        lastLoginAt: Date.now() - 1800000,
        stripeCustomerId: 'cus_test123',
        stripeSubscriptionId: 'sub_test456',
    },
    admin: {
        uid: 'user-admin-789',
        email: 'admin@example.com',
        name: 'Admin User',
        plan: 'pro',
        role: 'admin',
        subscriptionStatus: 'active',
        canAccessPro: true,
        subscriptionDisplay: 'Pro (Admin)',
        createdAt: Date.now() - 259200000,
        lastLoginAt: Date.now() - 900000,
    },
    superadmin: {
        uid: 'user-superadmin-012',
        email: 'superadmin@example.com',
        name: 'Super Admin',
        plan: 'pro',
        role: 'superadmin',
        subscriptionStatus: 'active',
        canAccessPro: true,
        subscriptionDisplay: 'Pro (Superadmin)',
        createdAt: Date.now() - 345600000,
        lastLoginAt: Date.now() - 600000,
    },
};
// Test snapshot data
export const testSnapshots = [
    {
        id: 'snap-123',
        name: 'My First Project',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        expiresAt: new Date(Date.now() + 518400000).toISOString(),
        password: 'abc123def',
        isPublic: false,
        viewCount: 5,
        files: ['index.html', 'main.js', 'style.css'],
        totalBytes: 1024000,
    },
    {
        id: 'snap-456',
        name: 'React App Demo',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        expiresAt: new Date(Date.now() + 345600000).toISOString(),
        password: 'xyz789ghi',
        isPublic: true,
        viewCount: 12,
        files: ['index.html', 'app.js', 'styles.css'],
        totalBytes: 2048000,
    },
    {
        id: 'snap-789',
        name: 'Expired Project',
        createdAt: new Date(Date.now() - 604800000).toISOString(),
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
        password: 'expired123',
        isPublic: false,
        viewCount: 3,
        files: ['index.html'],
        totalBytes: 512000,
    },
];
// Helper to mock localStorage
export const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
// Helper to set up authenticated user
export const setupAuthenticatedUser = (userType) => {
    const user = testUsers[userType];
    const token = `token-${userType}`;
    // Mock localStorage to return the token
    mockLocalStorage.getItem.mockReturnValue(token);
    return { user, token };
};
// Helper to clear authentication
export const clearAuthentication = () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.removeItem.mockClear();
    mockLocalStorage.setItem.mockClear();
};
// Helper to wait for loading states
export const waitForLoadingToFinish = async () => {
    await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
};
// Helper to wait for API calls
export const waitForApiCall = async (endpoint) => {
    await waitFor(() => {
        // This will wait for the MSW handler to be called
        // You can add more specific assertions here if needed
    });
};
