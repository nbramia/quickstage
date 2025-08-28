import { DEFAULT_USER_ANALYTICS, DEFAULT_SNAPSHOT_ANALYTICS, DEFAULT_SNAPSHOT_METADATA, DEFAULT_SUBSCRIPTION } from './types';
// Analytics utility functions
export class AnalyticsManager {
    env;
    constructor(env) {
        this.env = env;
    }
    // Generate unique analytics event ID
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // Generate session ID
    generateSessionId() {
        return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // Parse user agent for analytics
    parseUserAgent(userAgent) {
        // Simple user agent parsing - you can enhance this with a proper library
        const ua = userAgent.toLowerCase();
        let browser = 'unknown';
        let os = 'unknown';
        let device = 'desktop';
        // Browser detection
        if (ua.includes('chrome'))
            browser = 'chrome';
        else if (ua.includes('firefox'))
            browser = 'firefox';
        else if (ua.includes('safari'))
            browser = 'safari';
        else if (ua.includes('edge'))
            browser = 'edge';
        // OS detection
        if (ua.includes('windows'))
            os = 'windows';
        else if (ua.includes('mac'))
            os = 'macos';
        else if (ua.includes('linux'))
            os = 'linux';
        else if (ua.includes('android'))
            os = 'android';
        else if (ua.includes('ios'))
            os = 'ios';
        // Device detection
        if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) {
            device = 'mobile';
        }
        else if (ua.includes('tablet')) {
            device = 'tablet';
        }
        return { browser, os, device };
    }
    // Detect framework from snapshot files
    detectFramework(files) {
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
    // Track analytics event
    async trackEvent(userId, eventType, eventData = {}, sessionId, userAgent, ipAddress, referrer) {
        try {
            const event = {
                id: this.generateEventId(),
                userId,
                eventType,
                eventData,
                timestamp: Date.now(),
                sessionId: sessionId || this.generateSessionId(),
                userAgent: userAgent || 'unknown',
                ipAddress,
                referrer,
                userAgentParsed: userAgent ? this.parseUserAgent(userAgent) : undefined
            };
            // Store event in analytics KV
            await this.env.KV_ANALYTICS.put(`event:${event.id}`, JSON.stringify(event));
            // Update real-time analytics based on event type
            await this.updateRealTimeAnalytics(event);
            console.log(`Analytics event tracked: ${eventType} for user ${userId}`);
        }
        catch (error) {
            console.error('Failed to track analytics event:', error);
        }
    }
    // Update real-time analytics when events occur
    async updateRealTimeAnalytics(event) {
        try {
            switch (event.eventType) {
                case 'page_view':
                    await this.incrementUserMetric(event.userId, 'totalPageVisits');
                    await this.updateUserLastActivity(event.userId);
                    break;
                case 'snapshot_created':
                    await this.incrementUserMetric(event.userId, 'totalSnapshotsCreated');
                    break;
                case 'snapshot_viewed':
                    await this.incrementUserMetric(event.userId, 'totalSnapshotsViewed');
                    if (event.eventData.snapshotId) {
                        await this.incrementSnapshotMetric(event.eventData.snapshotId, 'viewCount');
                        await this.updateSnapshotLastViewed(event.eventData.snapshotId);
                    }
                    break;
                case 'snapshot_downloaded':
                    await this.incrementUserMetric(event.userId, 'totalDownloads');
                    if (event.eventData.snapshotId) {
                        await this.incrementSnapshotMetric(event.eventData.snapshotId, 'downloadCount');
                    }
                    break;
                case 'comment_posted':
                    await this.incrementUserMetric(event.userId, 'totalCommentsPosted');
                    if (event.eventData.snapshotId) {
                        await this.incrementSnapshotMetric(event.eventData.snapshotId, 'commentCount');
                    }
                    break;
                case 'user_login':
                    await this.incrementUserMetric(event.userId, 'sessionCount');
                    await this.updateUserLastActivity(event.userId);
                    break;
            }
        }
        catch (error) {
            console.error('Failed to update real-time analytics:', error);
        }
    }
    // Increment user metric
    async incrementUserMetric(userId, metric) {
        try {
            const userRaw = await this.env.KV_USERS.get(`user:${userId}`);
            if (!userRaw)
                return;
            const user = JSON.parse(userRaw);
            // Initialize analytics if not present
            if (!user.analytics) {
                user.analytics = { ...DEFAULT_USER_ANALYTICS };
            }
            // Increment metric
            if (typeof user.analytics[metric] === 'number') {
                user.analytics[metric]++;
            }
            // Update last activity
            user.analytics.lastActiveAt = Date.now();
            user.lastActivityAt = Date.now();
            user.updatedAt = Date.now();
            await this.env.KV_USERS.put(`user:${userId}`, JSON.stringify(user));
        }
        catch (error) {
            console.error(`Failed to increment user metric ${metric}:`, error);
        }
    }
    // Increment snapshot metric
    async incrementSnapshotMetric(snapshotId, metric) {
        try {
            const snapshotRaw = await this.env.KV_SNAPS.get(`snap:${snapshotId}`);
            if (!snapshotRaw)
                return;
            const snapshot = JSON.parse(snapshotRaw);
            // Initialize analytics if not present
            if (!snapshot.analytics) {
                snapshot.analytics = { ...DEFAULT_SNAPSHOT_ANALYTICS };
            }
            // Increment metric
            if (typeof snapshot.analytics[metric] === 'number') {
                snapshot.analytics[metric]++;
            }
            // Update last viewed
            snapshot.analytics.lastViewedAt = Date.now();
            snapshot.lastAccessedAt = Date.now();
            snapshot.updatedAt = Date.now();
            await this.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(snapshot));
        }
        catch (error) {
            console.error(`Failed to increment snapshot metric ${metric}:`, error);
        }
    }
    // Update user last activity
    async updateUserLastActivity(userId) {
        try {
            const userRaw = await this.env.KV_USERS.get(`user:${userId}`);
            if (!userRaw)
                return;
            const user = JSON.parse(userRaw);
            user.lastActivityAt = Date.now();
            user.updatedAt = Date.now();
            if (user.analytics) {
                user.analytics.lastActiveAt = Date.now();
            }
            await this.env.KV_USERS.put(`user:${userId}`, JSON.stringify(user));
        }
        catch (error) {
            console.error('Failed to update user last activity:', error);
        }
    }
    // Update snapshot last viewed
    async updateSnapshotLastViewed(snapshotId) {
        try {
            const snapshotRaw = await this.env.KV_SNAPS.get(`snap:${snapshotId}`);
            if (!snapshotRaw)
                return;
            const snapshot = JSON.parse(snapshotRaw);
            snapshot.lastAccessedAt = Date.now();
            snapshot.updatedAt = Date.now();
            if (snapshot.analytics) {
                snapshot.analytics.lastViewedAt = Date.now();
            }
            await this.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(snapshot));
        }
        catch (error) {
            console.error('Failed to update snapshot last viewed:', error);
        }
    }
    // Track view session
    async trackViewSession(snapshotId, userId, userAgent, ipAddress, referrer) {
        try {
            const sessionId = this.generateSessionId();
            const startTime = Date.now();
            const session = {
                sessionId,
                startTime,
                userAgent,
                ipAddress,
                referrer
            };
            // Store session in snapshot analytics
            const snapshotRaw = await this.env.KV_SNAPS.get(`snap:${snapshotId}`);
            if (snapshotRaw) {
                const snapshot = JSON.parse(snapshotRaw);
                if (!snapshot.analytics) {
                    snapshot.analytics = { ...DEFAULT_SNAPSHOT_ANALYTICS };
                }
                // Add session to view sessions
                snapshot.analytics.viewSessions.push(session);
                // Keep only last 100 sessions to prevent KV size issues
                if (snapshot.analytics.viewSessions.length > 100) {
                    snapshot.analytics.viewSessions = snapshot.analytics.viewSessions.slice(-100);
                }
                // Update unique viewers count
                if (ipAddress && !snapshot.analytics.viewerIPs.includes(ipAddress)) {
                    snapshot.analytics.viewerIPs.push(ipAddress);
                    snapshot.analytics.uniqueViewers = snapshot.analytics.viewerIPs.length;
                }
                await this.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(snapshot));
            }
            return sessionId;
        }
        catch (error) {
            console.error('Failed to track view session:', error);
            return this.generateSessionId();
        }
    }
    // End view session
    async endViewSession(snapshotId, sessionId) {
        try {
            const snapshotRaw = await this.env.KV_SNAPS.get(`snap:${snapshotId}`);
            if (!snapshotRaw)
                return;
            const snapshot = JSON.parse(snapshotRaw);
            if (snapshot.analytics && snapshot.analytics.viewSessions) {
                const session = snapshot.analytics.viewSessions.find(s => s.sessionId === sessionId);
                if (session) {
                    session.endTime = Date.now();
                    session.duration = session.endTime - session.startTime;
                    // Update average time on page
                    const completedSessions = snapshot.analytics.viewSessions.filter(s => s.duration);
                    if (completedSessions.length > 0) {
                        const totalDuration = completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
                        snapshot.analytics.averageTimeOnPage = totalDuration / completedSessions.length;
                    }
                    await this.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(snapshot));
                }
            }
        }
        catch (error) {
            console.error('Failed to end view session:', error);
        }
    }
    // Get user analytics
    async getUserAnalytics(userId, period = 'month') {
        try {
            const now = Date.now();
            const startDate = this.getPeriodStartDate(now, period);
            // Get events for the period
            const events = await this.getEventsForPeriod(userId, startDate, now);
            // Calculate metrics
            const metrics = {
                pageViews: events.filter(e => e.eventType === 'page_view').length,
                snapshotsCreated: events.filter(e => e.eventType === 'snapshot_created').length,
                snapshotsViewed: events.filter(e => e.eventType === 'snapshot_viewed').length,
                downloads: events.filter(e => e.eventType === 'snapshot_downloaded').length,
                commentsPosted: events.filter(e => e.eventType === 'comment_posted').length,
                sessionCount: events.filter(e => e.eventType === 'user_login').length,
                totalSessionTime: 0, // Would need session tracking to calculate this
                averageSessionTime: 0
            };
            const analytics = {
                userId,
                period,
                startDate,
                endDate: now,
                metrics,
                lastUpdated: now
            };
            // Cache analytics
            await this.env.KV_ANALYTICS.put(`user_analytics:${userId}:${period}`, JSON.stringify(analytics));
            return analytics;
        }
        catch (error) {
            console.error('Failed to get user analytics:', error);
            return {
                userId,
                period,
                startDate: Date.now(),
                endDate: Date.now(),
                metrics: {
                    pageViews: 0,
                    snapshotsCreated: 0,
                    snapshotsViewed: 0,
                    downloads: 0,
                    commentsPosted: 0,
                    sessionCount: 0,
                    totalSessionTime: 0,
                    averageSessionTime: 0
                },
                lastUpdated: Date.now()
            };
        }
    }
    // Get snapshot analytics
    async getSnapshotAnalytics(snapshotId, period = 'month') {
        try {
            const now = Date.now();
            const startDate = this.getPeriodStartDate(now, period);
            // Get snapshot data
            const snapshotRaw = await this.env.KV_SNAPS.get(`snap:${snapshotId}`);
            if (!snapshotRaw) {
                throw new Error('Snapshot not found');
            }
            const snapshot = JSON.parse(snapshotRaw);
            if (!snapshot.analytics) {
                return {
                    snapshotId,
                    period,
                    startDate,
                    endDate: now,
                    metrics: {
                        views: 0,
                        uniqueViewers: 0,
                        downloads: 0,
                        comments: 0,
                        averageTimeOnPage: 0,
                        bounceRate: 0
                    },
                    lastUpdated: now
                };
            }
            const metrics = {
                views: snapshot.analytics.viewCount,
                uniqueViewers: snapshot.analytics.uniqueViewers,
                downloads: snapshot.analytics.downloadCount,
                comments: snapshot.analytics.commentCount,
                averageTimeOnPage: snapshot.analytics.averageTimeOnPage,
                bounceRate: this.calculateBounceRate(snapshot.analytics.viewSessions)
            };
            const analytics = {
                snapshotId,
                period,
                startDate,
                endDate: now,
                metrics,
                lastUpdated: now
            };
            // Cache analytics
            await this.env.KV_ANALYTICS.put(`snapshot_analytics:${snapshotId}:${period}`, JSON.stringify(analytics));
            return analytics;
        }
        catch (error) {
            console.error('Failed to get snapshot analytics:', error);
            return {
                snapshotId,
                period,
                startDate: Date.now(),
                endDate: Date.now(),
                metrics: {
                    views: 0,
                    uniqueViewers: 0,
                    downloads: 0,
                    comments: 0,
                    averageTimeOnPage: 0,
                    bounceRate: 0
                },
                lastUpdated: Date.now()
            };
        }
    }
    // Get system analytics
    async getSystemAnalytics(period = 'month') {
        try {
            const now = Date.now();
            const startDate = this.getPeriodStartDate(now, period);
            // This would require scanning all users and snapshots
            // For now, return basic structure - implement full aggregation later
            const analytics = {
                period,
                startDate,
                endDate: now,
                metrics: {
                    totalUsers: 0,
                    activeUsers: 0,
                    newUsers: 0,
                    totalSnapshots: 0,
                    activeSnapshots: 0,
                    totalViews: 0,
                    totalDownloads: 0,
                    totalComments: 0,
                    averageSessionDuration: 0,
                    subscriptionConversionRate: 0
                },
                lastUpdated: now
            };
            // Cache analytics
            await this.env.KV_ANALYTICS.put(`system_analytics:${period}`, JSON.stringify(analytics));
            return analytics;
        }
        catch (error) {
            console.error('Failed to get system analytics:', error);
            return {
                period,
                startDate: Date.now(),
                endDate: Date.now(),
                metrics: {
                    totalUsers: 0,
                    activeUsers: 0,
                    newUsers: 0,
                    totalSnapshots: 0,
                    activeSnapshots: 0,
                    totalViews: 0,
                    totalDownloads: 0,
                    totalComments: 0,
                    averageSessionDuration: 0,
                    subscriptionConversionRate: 0
                },
                lastUpdated: Date.now()
            };
        }
    }
    // Helper: Get period start date
    getPeriodStartDate(now, period) {
        const date = new Date(now);
        switch (period) {
            case 'day':
                date.setHours(0, 0, 0, 0);
                break;
            case 'week':
                date.setDate(date.getDate() - date.getDay());
                date.setHours(0, 0, 0, 0);
                break;
            case 'month':
                date.setDate(1);
                date.setHours(0, 0, 0, 0);
                break;
            case 'year':
                date.setMonth(0, 1);
                date.setHours(0, 0, 0, 0);
                break;
        }
        return date.getTime();
    }
    // Helper: Get events for period
    async getEventsForPeriod(userId, startDate, endDate) {
        // This would require scanning all events for the user in the time period
        // For now, return empty array - implement full event retrieval later
        return [];
    }
    // Helper: Calculate bounce rate
    calculateBounceRate(viewSessions) {
        if (viewSessions.length === 0)
            return 0;
        const singlePageSessions = viewSessions.filter(s => s.duration && s.duration < 10000); // Less than 10 seconds
        return (singlePageSessions.length / viewSessions.length) * 100;
    }
    // Migrate existing user to new schema
    async migrateUserToNewSchema(userId) {
        try {
            const userRaw = await this.env.KV_USERS.get(`user:${userId}`);
            if (!userRaw)
                return;
            const user = JSON.parse(userRaw);
            // Check if already migrated
            if (user.analytics && user.subscription)
                return;
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
            // Save migrated user
            await this.env.KV_USERS.put(`user:${userId}`, JSON.stringify(user));
            console.log(`User ${userId} migrated to new schema`);
        }
        catch (error) {
            console.error(`Failed to migrate user ${userId}:`, error);
        }
    }
    // Migrate existing snapshot to new schema
    async migrateSnapshotToNewSchema(snapshotId) {
        try {
            const snapshotRaw = await this.env.KV_SNAPS.get(`snap:${snapshotId}`);
            if (!snapshotRaw)
                return;
            const snapshot = JSON.parse(snapshotRaw);
            // Check if already migrated
            if (snapshot.analytics && snapshot.metadata)
                return;
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
                snapshot.metadata.framework = this.detectFramework(snapshot.files || []);
            }
            // Add missing timestamp fields
            if (!snapshot.updatedAt)
                snapshot.updatedAt = snapshot.createdAt;
            if (!snapshot.lastAccessedAt)
                snapshot.lastAccessedAt = snapshot.createdAt;
            // Save migrated snapshot
            await this.env.KV_SNAPS.put(`snap:${snapshotId}`, JSON.stringify(snapshot));
            console.log(`Snapshot ${snapshotId} migrated to new schema`);
        }
        catch (error) {
            console.error(`Failed to migrate snapshot ${snapshotId}:`, error);
        }
    }
}
// Export singleton instance
export const analyticsManager = new AnalyticsManager(globalThis);
