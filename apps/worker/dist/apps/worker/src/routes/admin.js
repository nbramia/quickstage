import { createNewUserWithSchema } from '../migrate-schema';
import { generateIdBase62, hashPasswordArgon2id, randomHex } from '../utils';
import { getUidFromSession } from '../auth';
import { getUserByName, getSubscriptionDisplayStatus, canAccessProFeatures } from '../user';
import { getAnalyticsManager } from '../worker-utils';
// Admin route handlers
export async function handlePurgeExpired(c) {
    // This route will be bound to CRON; iterate KV list
    // Cloudflare KV list requires pagination; for MVP, skip and rely on manual
    return c.json({ ok: true });
}
export async function handleGetUsers(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/admin/users',
                method: 'GET'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    if (user.role !== 'superadmin')
        return c.json({ error: 'forbidden' }, 403);
    // Track analytics event for page view
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'page_view', { page: '/admin/users' });
    // Get all users
    const users = [];
    let cursor = undefined;
    do {
        const list = await c.env.KV_USERS.list({ prefix: 'user:', cursor });
        cursor = list.cursor;
        for (const key of list.keys) {
            // Filter for actual user records (user:uid) vs other keys (user:byemail:*, user:uid:snapshots, etc.)
            if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
                const uid = key.name.replace('user:', '');
                const userDataRaw = await c.env.KV_USERS.get(key.name);
                if (userDataRaw) {
                    const userData = JSON.parse(userDataRaw);
                    // Get user's snapshots
                    const snapshotsList = await c.env.KV_USERS.get(`user:${uid}:snapshots`) || '[]';
                    const snapshotIds = JSON.parse(snapshotsList);
                    // Count active vs total snapshots
                    let totalSnapshots = snapshotIds.length;
                    let activeSnapshots = 0;
                    for (const snapshotId of snapshotIds) {
                        const snapshotRaw = await c.env.KV_SNAPS.get(`snap:${snapshotId}`);
                        if (snapshotRaw) {
                            const snapshot = JSON.parse(snapshotRaw);
                            if (snapshot.status === 'active' && snapshot.expiresAt > Date.now()) {
                                activeSnapshots++;
                            }
                        }
                    }
                    users.push({
                        uid: userData.uid,
                        name: userData.name || 'Unknown',
                        email: userData.email || '',
                        plan: userData.plan || 'free',
                        role: userData.role || 'user',
                        createdAt: userData.createdAt,
                        lastLoginAt: userData.lastLoginAt,
                        totalSnapshots,
                        activeSnapshots,
                        status: userData.status || 'active',
                        // Subscription fields - use new schema with fallbacks
                        subscriptionStatus: getSubscriptionDisplayStatus(userData),
                        canAccessPro: canAccessProFeatures(userData),
                        trialEndsAt: userData.subscription?.trialEnd || userData.trialEndsAt,
                        subscriptionStartedAt: userData.subscription?.currentPeriodStart || userData.subscriptionStartedAt,
                        lastPaymentAt: userData.subscription?.lastPaymentAt || userData.lastPaymentAt,
                        stripeCustomerId: userData.subscription?.stripeCustomerId || userData.stripeCustomerId
                    });
                }
            }
        }
    } while (cursor);
    return c.json({ users });
}
export async function handleCreateUser(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/admin/users',
                method: 'POST'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw) {
        // Track analytics event for user not found
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_creation',
                error: 'user_not_found',
                uid: uid
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for user not found:', analyticsError);
        }
        return c.json({ error: 'user_not_found' }, 404);
    }
    const user = JSON.parse(userRaw);
    if (user.role !== 'superadmin') {
        // Track analytics event for insufficient permissions
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_creation',
                error: 'insufficient_permissions',
                userRole: user.role
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for insufficient permissions:', analyticsError);
        }
        return c.json({ error: 'forbidden' }, 403);
    }
    const { name, email, password, role } = await c.req.json();
    if (!name || !email || !password || !role) {
        // Track analytics event for missing fields
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_creation',
                error: 'missing_fields',
                providedFields: { name: !!name, email: !!email, password: !!password, role: !!role }
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for missing fields:', analyticsError);
        }
        return c.json({ error: 'missing_fields' }, 400);
    }
    // Check if user already exists
    const existingUser = await getUserByName(c, name);
    if (existingUser) {
        // Track analytics event for user already exists
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_creation',
                error: 'user_exists',
                attemptedName: name
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for user already exists:', analyticsError);
        }
        return c.json({ error: 'user_exists' }, 400);
    }
    const existingEmail = await c.env.KV_USERS.get(`user:byemail:${email}`);
    if (existingEmail) {
        // Track analytics event for email already exists
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_creation',
                error: 'email_exists',
                attemptedEmail: email
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for email already exists:', analyticsError);
        }
        return c.json({ error: 'email_exists' }, 400);
    }
    // Hash password
    const salt = randomHex(16);
    const hashedPassword = await hashPasswordArgon2id(password, salt);
    // Create user
    const newUid = generateIdBase62(16);
    const newUser = createNewUserWithSchema(newUid, name, email, role, 'free', hashedPassword);
    await c.env.KV_USERS.put(`user:${newUid}`, JSON.stringify(newUser));
    await c.env.KV_USERS.put(`user:byname:${name}`, newUid);
    await c.env.KV_USERS.put(`user:byemail:${email}`, newUid);
    // Track analytics event
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(newUid, 'user_registered', {
        method: 'admin',
        role: role,
        createdBy: uid
    });
    return c.json({ ok: true, user: { uid: newUid, name, email, role } });
}
export async function handleDeactivateUser(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/admin/users/:uid/deactivate',
                method: 'POST'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw) {
        // Track analytics event for user not found
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_deactivation',
                error: 'user_not_found',
                uid: uid
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for user not found:', analyticsError);
        }
        return c.json({ error: 'user_not_found' }, 404);
    }
    const user = JSON.parse(userRaw);
    if (user.role !== 'superadmin') {
        // Track analytics event for insufficient permissions
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_deactivation',
                error: 'insufficient_permissions',
                userRole: user.role
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for insufficient permissions:', analyticsError);
        }
        return c.json({ error: 'forbidden' }, 403);
    }
    const targetUid = c.req.param('uid');
    const targetUserRaw = await c.env.KV_USERS.get(`user:${targetUid}`);
    if (!targetUserRaw) {
        // Track analytics event for target user not found
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_deactivation',
                error: 'target_user_not_found',
                targetUid: targetUid
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for target user not found:', analyticsError);
        }
        return c.json({ error: 'target_user_not_found' }, 404);
    }
    const targetUser = JSON.parse(targetUserRaw);
    targetUser.status = 'deactivated';
    await c.env.KV_USERS.put(`user:${targetUid}`, JSON.stringify(targetUser));
    // Track analytics event for user deactivation
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'user_deactivated', {
        targetUserId: targetUid,
        targetUserRole: targetUser.role
    });
    return c.json({ ok: true });
}
export async function handleActivateUser(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/admin/users/:uid/activate',
                method: 'POST'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw) {
        // Track analytics event for user not found
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_activation',
                error: 'user_not_found',
                uid: uid
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for user not found:', analyticsError);
        }
        return c.json({ error: 'user_not_found' }, 404);
    }
    const user = JSON.parse(userRaw);
    if (user.role !== 'superadmin' && user.role !== 'admin') {
        // Track analytics event for insufficient permissions
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_activation',
                error: 'insufficient_permissions',
                userRole: user.role
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for insufficient permissions:', analyticsError);
        }
        return c.json({ error: 'forbidden' }, 403);
    }
    const targetUid = c.req.param('uid');
    const targetUserRaw = await c.env.KV_USERS.get(`user:${targetUid}`);
    if (!targetUserRaw) {
        // Track analytics event for target user not found
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_activation',
                error: 'target_user_not_found',
                targetUid: targetUid
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for target user not found:', analyticsError);
        }
        return c.json({ error: 'target_user_not_found' }, 404);
    }
    const targetUser = JSON.parse(targetUserRaw);
    targetUser.status = 'active';
    await c.env.KV_USERS.put(`user:${targetUid}`, JSON.stringify(targetUser));
    // Track analytics event for user activation
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'user_activated', {
        targetUserId: targetUid,
        targetUserRole: targetUser.role
    });
    return c.json({ ok: true });
}
export async function handleDeleteUser(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/admin/users/:uid',
                method: 'DELETE'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw) {
        // Track analytics event for user not found
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_deletion',
                error: 'user_not_found',
                uid: uid
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for user not found:', analyticsError);
        }
        return c.json({ error: 'user_not_found' }, 404);
    }
    const user = JSON.parse(userRaw);
    if (user.role !== 'superadmin') {
        // Track analytics event for insufficient permissions
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_deletion',
                error: 'insufficient_permissions',
                userRole: user.role
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for insufficient permissions:', analyticsError);
        }
        return c.json({ error: 'insufficient_permissions' }, 403);
    }
    const targetUid = c.req.param('uid');
    const targetUserRaw = await c.env.KV_USERS.get(`user:${targetUid}`);
    if (!targetUserRaw) {
        // Track analytics event for target user not found
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_deletion',
                error: 'target_user_not_found',
                targetUid: targetUid
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for target user not found:', analyticsError);
        }
        return c.json({ error: 'target_user_not_found' }, 404);
    }
    const targetUser = JSON.parse(targetUserRaw);
    // Cannot delete superadmin
    if (targetUser.role === 'superadmin') {
        // Track analytics event for cannot delete superadmin
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_deletion',
                error: 'cannot_delete_superadmin',
                targetUserRole: targetUser.role
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for cannot delete superadmin:', analyticsError);
        }
        return c.json({ error: 'cannot_delete_superadmin' }, 400);
    }
    // Cannot delete self
    if (targetUid === uid) {
        // Track analytics event for cannot delete self
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent(uid, 'error_occurred', {
                context: 'admin_user_deletion',
                error: 'cannot_delete_self'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for cannot delete self:', analyticsError);
        }
        return c.json({ error: 'cannot_delete_self' }, 400);
    }
    console.log(`Superadmin ${uid} deleting user ${targetUid} (${targetUser.email}) completely`);
    // Delete all user data from KV
    await c.env.KV_USERS.delete(`user:${targetUid}`);
    // Delete by-name index if exists
    if (targetUser.name) {
        await c.env.KV_USERS.delete(`user:byname:${targetUser.name}`);
    }
    // Delete by-email index if exists
    if (targetUser.email) {
        await c.env.KV_USERS.delete(`user:byemail:${targetUser.email}`);
    }
    // Delete all user's snapshots
    const snapshots = await c.env.KV_SNAPS.list({ prefix: `snap:${targetUid}:` });
    for (const key of snapshots.keys) {
        await c.env.KV_SNAPS.delete(key.name);
    }
    // Delete all user's PATs
    const pats = await c.env.KV_USERS.list({ prefix: `pat:${targetUid}:` });
    for (const key of pats.keys) {
        await c.env.KV_USERS.delete(key.name);
    }
    // Delete all user's comments
    const comments = await c.env.KV_USERS.list({ prefix: `comment:${targetUid}:` });
    for (const key of comments.keys) {
        await c.env.KV_USERS.delete(key.name);
    }
    // Track analytics event for user deletion
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'user_deleted', {
        targetUserId: targetUid,
        targetUserRole: targetUser.role,
        targetUserPlan: targetUser.subscription?.status || 'unknown',
        snapshotsDeleted: snapshots.keys.length,
        patsDeleted: pats.keys.length,
        commentsDeleted: comments.keys.length
    });
    return c.json({
        success: true,
        message: 'User completely deleted from system',
        deletedUser: {
            uid: targetUser.uid,
            email: targetUser.email,
            name: targetUser.name
        }
    });
}
export async function handleSetupSuperadmin(c) {
    const { name, email, password } = await c.req.json();
    if (!name || !email || !password) {
        // Track analytics event for missing fields
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'error_occurred', {
                context: 'superadmin_setup',
                error: 'missing_fields',
                providedFields: { name: !!name, email: !!email, password: !!password }
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for missing fields:', analyticsError);
        }
        return c.json({ error: 'missing_fields' }, 400);
    }
    // Check if superadmin already exists
    let cursor = undefined;
    let superadminExists = false;
    do {
        const list = await c.env.KV_USERS.list({ prefix: 'user:', cursor });
        cursor = list.cursor;
        for (const key of list.keys) {
            // Filter for actual user records (user:uid) vs other keys (user:byemail:*, user:uid:snapshots, etc.)
            if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
                const userDataRaw = await c.env.KV_USERS.get(key.name);
                if (userDataRaw) {
                    const userData = JSON.parse(userDataRaw);
                    if (userData.role === 'superadmin') {
                        superadminExists = true;
                        break;
                    }
                }
            }
        }
    } while (cursor && !superadminExists);
    if (superadminExists) {
        // Track analytics event for superadmin already exists
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'error_occurred', {
                context: 'superadmin_setup',
                error: 'superadmin_already_exists'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for superadmin already exists:', analyticsError);
        }
        return c.json({ error: 'superadmin_already_exists' }, 400);
    }
    // Check if user already exists
    const existingUser = await getUserByName(c, name);
    if (existingUser) {
        // Track analytics event for user already exists
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'error_occurred', {
                context: 'superadmin_setup',
                error: 'user_exists',
                attemptedName: name
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for user already exists:', analyticsError);
        }
        return c.json({ error: 'user_exists' }, 400);
    }
    const existingEmail = await c.env.KV_USERS.get(`user:byemail:${email}`);
    if (existingEmail) {
        // Track analytics event for email already exists
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'error_occurred', {
                context: 'superadmin_setup',
                error: 'email_exists',
                attemptedEmail: email
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for email already exists:', analyticsError);
        }
        return c.json({ error: 'email_exists' }, 400);
    }
    // Hash password
    const salt = randomHex(16);
    const hashedPassword = await hashPasswordArgon2id(password, salt);
    // Create superadmin user
    const uid = generateIdBase62(16);
    const user = createNewUserWithSchema(uid, name, email, 'superadmin', 'pro', hashedPassword);
    await c.env.KV_USERS.put(`user:${uid}`, JSON.stringify(user));
    await c.env.KV_USERS.put(`user:byname:${name}`, uid);
    await c.env.KV_USERS.put(`user:byemail:${email}`, uid);
    // Track analytics event for new superadmin user
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'user_registered', {
        method: 'admin',
        role: 'superadmin',
        isFirstSuperadmin: true
    });
    return c.json({ ok: true, user: { uid, name, email, role: 'superadmin' } });
}
export async function handleCleanupCorruptedUsers(c) {
    const uid = await getUidFromSession(c);
    if (!uid) {
        // Track analytics event for unauthorized access attempt
        try {
            const analytics = getAnalyticsManager(c);
            await analytics.trackEvent('anonymous', 'unauthorized_access', {
                endpoint: '/admin/cleanup-corrupted-users',
                method: 'POST'
            });
        }
        catch (analyticsError) {
            console.error('Failed to track analytics for unauthorized access:', analyticsError);
        }
        return c.json({ error: 'unauthorized' }, 401);
    }
    const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
    if (!userRaw)
        return c.json({ error: 'user_not_found' }, 404);
    const user = JSON.parse(userRaw);
    if (user.role !== 'superadmin')
        return c.json({ error: 'insufficient_permissions' }, 403);
    console.log(`Superadmin ${uid} running cleanup of corrupted users`);
    let cursor = undefined;
    let totalUsers = 0;
    let fixedUsers = 0;
    let deletedUsers = 0;
    const results = [];
    do {
        const list = await c.env.KV_USERS.list({ prefix: 'user:', cursor });
        cursor = list.cursor;
        for (const key of list.keys) {
            // Filter for actual user records (user:uid) vs other keys (user:byemail:*, user:uid:snapshots, etc.)
            if (key.name.startsWith('user:') && !key.name.includes(':', 5)) {
                const userDataRaw = await c.env.KV_USERS.get(key.name);
                if (userDataRaw) {
                    totalUsers++;
                    const userData = JSON.parse(userDataRaw);
                    // Check for corrupted subscription data - use new schema with fallbacks
                    const subscriptionStatus = userData.subscription?.status || userData.subscriptionStatus || 'none';
                    const hasStripe = !!(userData.subscription?.stripeCustomerId || userData.stripeCustomerId || userData.subscription?.stripeSubscriptionId || userData.stripeSubscriptionId);
                    if (subscriptionStatus === 'trial' && !hasStripe) {
                        // Fix corrupted trial status - update new schema
                        if (userData.subscription) {
                            userData.subscription.status = 'none';
                        }
                        // Update legacy fields for backward compatibility
                        userData.subscriptionStatus = 'none';
                        userData.plan = 'free';
                        userData.trialEndsAt = null;
                        userData.subscriptionStartedAt = null;
                        await c.env.KV_USERS.put(key.name, JSON.stringify(userData));
                        fixedUsers++;
                        results.push({
                            uid: userData.uid,
                            email: userData.email,
                            action: 'fixed',
                            before: { subscriptionStatus: 'trial', plan: 'pro' },
                            after: { subscriptionStatus: 'none', plan: 'free' }
                        });
                        console.log(`Fixed user ${userData.uid}: reset corrupted trial status`);
                    }
                    // Check for users with 'pro' plan but no subscription
                    if (userData.plan === 'pro' && !hasStripe && userData.role !== 'superadmin') {
                        // Fix corrupted pro plan - update new schema
                        if (userData.subscription) {
                            userData.subscription.status = 'none';
                        }
                        // Update legacy fields for backward compatibility
                        userData.plan = 'free';
                        userData.subscriptionStatus = 'none';
                        userData.trialEndsAt = null;
                        userData.subscriptionStartedAt = null;
                        await c.env.KV_USERS.put(key.name, JSON.stringify(userData));
                        fixedUsers++;
                        results.push({
                            uid: userData.uid,
                            email: userData.email,
                            action: 'fixed',
                            before: { plan: 'pro', subscriptionStatus: userData.subscriptionStatus },
                            after: { plan: 'free', subscriptionStatus: 'none' }
                        });
                        console.log(`Fixed user ${userData.uid}: reset corrupted pro plan`);
                    }
                }
            }
        }
    } while (cursor);
    // Track analytics event for cleanup completion
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'cleanup_completed', {
        totalUsers,
        fixedUsers,
        deletedUsers,
        resultsCount: results.length
    });
    return c.json({
        success: true,
        message: 'Cleanup completed',
        summary: {
            totalUsers,
            fixedUsers,
            deletedUsers
        },
        results
    });
}
