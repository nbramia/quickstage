import { DEFAULT_USER_ANALYTICS, DEFAULT_SNAPSHOT_ANALYTICS, DEFAULT_SNAPSHOT_METADATA, DEFAULT_SUBSCRIPTION } from './types';
// Migration script to update existing users and snapshots to new schema
export async function migrateAllUsersToNewSchema(env) {
    console.log('Starting user migration to new schema...');
    try {
        // Get all user keys
        const userKeys = await env.KV_USERS.list({ prefix: 'user:' });
        let migratedCount = 0;
        let errorCount = 0;
        for (const key of userKeys.keys) {
            if (key.name === 'user:' || key.name.startsWith('user:byname:') || key.name.startsWith('user:byemail:')) {
                continue; // Skip index keys
            }
            try {
                const userRaw = await env.KV_USERS.get(key.name);
                if (!userRaw)
                    continue;
                const user = JSON.parse(userRaw);
                // Check if already migrated
                if (user.analytics && user.subscription && user.status && user.updatedAt) {
                    continue;
                }
                // Migrate user to new schema
                const migratedUser = migrateUserToNewSchema(user);
                // Save migrated user
                await env.KV_USERS.put(key.name, JSON.stringify(migratedUser));
                migratedCount++;
                if (migratedCount % 10 === 0) {
                    console.log(`Migrated ${migratedCount} users...`);
                }
            }
            catch (error) {
                console.error(`Error migrating user ${key.name}:`, error);
                errorCount++;
            }
        }
        console.log(`User migration complete: ${migratedCount} migrated, ${errorCount} errors`);
    }
    catch (error) {
        console.error('User migration failed:', error);
    }
}
export async function migrateAllSnapshotsToNewSchema(env) {
    console.log('Starting snapshot migration to new schema...');
    try {
        // Get all snapshot keys
        const snapshotKeys = await env.KV_SNAPS.list({ prefix: 'snap:' });
        let migratedCount = 0;
        let errorCount = 0;
        for (const key of snapshotKeys.keys) {
            try {
                const snapshotRaw = await env.KV_SNAPS.get(key.name);
                if (!snapshotRaw)
                    continue;
                const snapshot = JSON.parse(snapshotRaw);
                // Check if already migrated
                if (snapshot.analytics && snapshot.metadata && snapshot.updatedAt) {
                    continue;
                }
                // Migrate snapshot to new schema
                const migratedSnapshot = migrateSnapshotToNewSchema(snapshot);
                // Save migrated snapshot
                await env.KV_SNAPS.put(key.name, JSON.stringify(migratedSnapshot));
                migratedCount++;
                if (migratedCount % 10 === 0) {
                    console.log(`Migrated ${migratedCount} snapshots...`);
                }
            }
            catch (error) {
                console.error(`Error migrating snapshot ${key.name}:`, error);
                errorCount++;
            }
        }
        console.log(`Snapshot migration complete: ${migratedCount} migrated, ${errorCount} errors`);
    }
    catch (error) {
        console.error('Snapshot migration failed:', error);
    }
}
// Migrate individual user to new schema
export function migrateUserToNewSchema(user) {
    const now = Date.now();
    // Initialize new fields
    if (!user.analytics) {
        user.analytics = { ...DEFAULT_USER_ANALYTICS };
        user.analytics.lastActiveAt = user.lastLoginAt || user.createdAt;
    }
    if (!user.subscription) {
        user.subscription = { ...DEFAULT_SUBSCRIPTION };
        // Migrate legacy subscription fields
        if (user.subscriptionStatus) {
            user.subscription.status = user.subscriptionStatus;
        }
        if (user.stripeCustomerId) {
            user.subscription.stripeCustomerId = user.stripeCustomerId;
        }
        if (user.stripeSubscriptionId) {
            user.subscription.stripeSubscriptionId = user.stripeSubscriptionId;
        }
        if (user.trialStartedAt) {
            user.subscription.trialStart = user.trialStartedAt;
        }
        if (user.trialEndsAt) {
            user.subscription.trialEnd = user.trialEndsAt;
        }
        if (user.subscriptionStartedAt) {
            user.subscription.currentPeriodStart = user.subscriptionStartedAt;
        }
        if (user.subscriptionEndsAt) {
            user.subscription.currentPeriodEnd = user.subscriptionEndsAt;
        }
        if (user.lastPaymentAt) {
            user.subscription.lastPaymentAt = user.lastPaymentAt;
        }
    }
    // Add missing timestamp fields
    if (!user.updatedAt)
        user.updatedAt = user.createdAt;
    if (!user.lastActivityAt)
        user.lastActivityAt = user.lastLoginAt || user.createdAt;
    if (!user.status)
        user.status = 'active';
    return user;
}
// Migrate individual snapshot to new schema
export function migrateSnapshotToNewSchema(snapshot) {
    const now = Date.now();
    // Initialize new fields
    if (!snapshot.analytics) {
        snapshot.analytics = { ...DEFAULT_SNAPSHOT_ANALYTICS };
        // Migrate legacy view data
        if (snapshot.views) {
            snapshot.analytics.viewCount = snapshot.views.n || 0;
            snapshot.analytics.lastViewedAt = snapshot.createdAt;
        }
        if (snapshot.commentsCount) {
            snapshot.analytics.commentCount = snapshot.commentsCount;
        }
    }
    if (!snapshot.metadata) {
        snapshot.metadata = { ...DEFAULT_SNAPSHOT_METADATA };
        snapshot.metadata.fileCount = snapshot.files?.length || 0;
        snapshot.metadata.hasComments = (snapshot.commentsCount || 0) > 0;
        snapshot.metadata.framework = detectFramework(snapshot.files || []);
    }
    // Add missing timestamp fields
    if (!snapshot.updatedAt)
        snapshot.updatedAt = snapshot.createdAt;
    if (!snapshot.lastAccessedAt)
        snapshot.lastAccessedAt = snapshot.createdAt;
    return snapshot;
}
// Detect framework from snapshot files
function detectFramework(files) {
    const filePaths = files.map(f => f.p || f.name || '').join(' ').toLowerCase();
    if (filePaths.includes('dist') && filePaths.includes('index.html'))
        return 'vite';
    if (filePaths.includes('out') && filePaths.includes('index.html'))
        return 'nextjs';
    if (filePaths.includes('.svelte-kit'))
        return 'sveltekit';
    if (filePaths.includes('build') && filePaths.includes('index.html'))
        return 'create-react-app';
    if (filePaths.includes('vue') || filePaths.includes('.vue'))
        return 'vue';
    if (filePaths.includes('angular') || filePaths.includes('.ng'))
        return 'angular';
    if (filePaths.includes('index.html') && files.length <= 5)
        return 'static';
    return 'unknown';
}
// Helper function to create new user with proper schema
export function createNewUserWithSchema(uid, name, email, role = 'user', plan = 'free', passwordHash, googleId) {
    const now = Date.now();
    return {
        uid,
        name,
        email,
        passwordHash,
        googleId,
        plan,
        role,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        subscription: { status: 'none' },
        analytics: {
            totalSnapshotsCreated: 0,
            totalSnapshotsViewed: 0,
            totalDownloads: 0,
            totalPageVisits: 0,
            lastActiveAt: now,
            sessionCount: 0,
            averageSessionDuration: 0,
            totalCommentsPosted: 0,
            totalCommentsReceived: 0,
        }
    };
}
// Helper function to create new snapshot with proper schema
export function createNewSnapshotWithSchema(id, ownerUid, passwordHash, password, expiryDays = 7, isPublic = false) {
    const now = Date.now();
    const expiresAt = now + (expiryDays * 24 * 60 * 60 * 1000);
    return {
        id,
        ownerUid,
        passwordHash,
        password,
        totalBytes: 0,
        files: [],
        public: isPublic,
        status: 'creating',
        createdAt: now,
        updatedAt: now,
        expiresAt,
        lastAccessedAt: now,
        analytics: {
            viewCount: 0,
            uniqueViewers: 0,
            downloadCount: 0,
            commentCount: 0,
            averageTimeOnPage: 0,
            lastViewedAt: now,
            viewerCountries: [],
            viewerIPs: [],
            viewSessions: [],
        },
        metadata: {
            fileCount: 0,
            hasComments: false,
            tags: [],
        }
    };
}
