import { http, HttpResponse } from 'msw';
// Test data
const testUsers = {
    free: {
        uid: 'user-free-123',
        email: 'free@example.com',
        name: 'Free User',
        plan: 'free',
        role: 'user',
        subscriptionStatus: 'none',
        canAccessPro: false,
        subscriptionDisplay: 'Free',
        createdAt: Date.now() - 86400000, // 1 day ago
        lastLoginAt: Date.now() - 3600000, // 1 hour ago
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
        createdAt: Date.now() - 172800000, // 2 days ago
        lastLoginAt: Date.now() - 1800000, // 30 minutes ago
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
        createdAt: Date.now() - 259200000, // 3 days ago
        lastLoginAt: Date.now() - 900000, // 15 minutes ago
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
        createdAt: Date.now() - 345600000, // 4 days ago
        lastLoginAt: Date.now() - 600000, // 10 minutes ago
    },
};
const testSnapshots = [
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
// Helper function to get user from token
function getUserFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.slice(7);
    // Simple token mapping for testing
    switch (token) {
        case 'token-free':
            return testUsers.free;
        case 'token-pro':
            return testUsers.pro;
        case 'token-admin':
            return testUsers.admin;
        case 'token-superadmin':
            return testUsers.superadmin;
        default:
            return null;
    }
}
export const handlers = [
    // Authentication endpoints
    http.post('*/auth/google', () => {
        return HttpResponse.json({
            user: testUsers.pro,
            sessionToken: 'token-pro',
        });
    }),
    http.post('*/auth/register', () => {
        return HttpResponse.json({
            user: testUsers.free,
            sessionToken: 'token-free',
        });
    }),
    http.post('*/auth/login', () => {
        return HttpResponse.json({
            user: testUsers.free,
            sessionToken: 'token-free',
        });
    }),
    http.post('*/auth/dev-login', ({ request }) => {
        return HttpResponse.json({
            user: testUsers.free,
            sessionToken: 'token-free',
        });
    }),
    // User endpoints
    http.get('*/me', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ user });
    }),
    http.put('*/me', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            user: { ...user, name: 'Updated Name' },
            message: 'Profile updated successfully'
        });
    }),
    http.post('*/me/change-password', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            message: 'Password changed successfully'
        });
    }),
    // Snapshot endpoints
    http.get('*/snapshots/list', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ snapshots: testSnapshots });
    }),
    http.post('*/snapshots/create', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            id: 'snap-new-123',
            password: 'newpass456',
        });
    }),
    http.post('*/snapshots/:id/expire', ({ request, params }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            message: 'Snapshot expired successfully',
            snapshotId: params.id,
        });
    }),
    http.post('*/snapshots/:id/extend', ({ request, params }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            message: 'Snapshot extended successfully',
            snapshotId: params.id,
            newExpiry: new Date(Date.now() + 604800000).toISOString(),
        });
    }),
    http.post('*/snapshots/:id/rotate-password', ({ request, params }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            message: 'Password rotated successfully',
            snapshotId: params.id,
            newPassword: 'rotated789',
        });
    }),
    http.post('*/upload-url', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            uploadUrl: 'https://test-upload.example.com/upload',
            expiresAt: new Date(Date.now() + 600000).toISOString(),
        });
    }),
    http.post('*/snapshots/finalize', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            message: 'Snapshot finalized successfully',
            snapshotId: 'snap-new-123',
        });
    }),
    // Admin endpoints
    http.get('*/admin/users', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
            return new HttpResponse(null, { status: 403 });
        }
        return HttpResponse.json({
            users: Object.values(testUsers),
            total: Object.keys(testUsers).length,
        });
    }),
    http.post('*/admin/users', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
            return new HttpResponse(null, { status: 403 });
        }
        return HttpResponse.json({
            message: 'User created successfully',
            user: {
                uid: 'user-new-999',
                email: 'new@example.com',
                name: 'New User',
                plan: 'free',
                role: 'user',
            },
        });
    }),
    http.put('*/admin/users/:uid/deactivate', ({ request, params }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
            return new HttpResponse(null, { status: 403 });
        }
        return HttpResponse.json({
            message: 'User deactivated successfully',
            uid: params.uid,
        });
    }),
    http.put('*/admin/users/:uid/activate', ({ request, params }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
            return new HttpResponse(null, { status: 403 });
        }
        return HttpResponse.json({
            message: 'User activated successfully',
            uid: params.uid,
        });
    }),
    // Subscription endpoints
    http.post('*/billing/create-portal-session', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            url: 'https://billing-portal.example.com/session',
        });
    }),
    http.post('*/billing/create-checkout-session', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            url: 'https://checkout.example.com/session',
        });
    }),
    http.post('*/billing/cancel-subscription', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user) {
            return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({
            message: 'Subscription cancelled successfully',
        });
    }),
    // Extension endpoints
    http.get('*/extensions/version', () => {
        return HttpResponse.json({
            version: '0.0.31',
            latestVersion: '0.0.31',
            updateAvailable: false,
            downloadUrl: '/quickstage.vsix',
        });
    }),
    // Debug endpoints (superadmin only)
    http.get('*/debug/stats', ({ request }) => {
        const user = getUserFromToken(request.headers.get('authorization'));
        if (!user || user.role !== 'superadmin') {
            return new HttpResponse(null, { status: 403 });
        }
        return HttpResponse.json({
            system: {
                totalUsers: 4,
                totalSnapshots: 3,
                activeSessions: 2,
                timestamp: new Date().toISOString(),
            },
            subscriptions: {
                free: 1,
                trial: 0,
                active: 3,
                cancelled: 0,
                pastDue: 0,
                superadmin: 1,
            },
        });
    }),
    // Health check (public)
    http.get('*/debug/health', () => {
        return HttpResponse.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                kv_users: 'operational',
                kv_snapshots: 'operational',
                worker: 'operational',
            },
        });
    }),
    // Catch-all handler for unmatched requests
    http.all('*', () => {
        return new HttpResponse(null, { status: 404 });
    }),
];
