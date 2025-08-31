// Default values
export const DEFAULT_USER_ANALYTICS = {
    totalSnapshotsCreated: 0,
    totalSnapshotsViewed: 0,
    totalDownloads: 0,
    totalPageVisits: 0,
    lastActiveAt: Date.now(),
    sessionCount: 0,
    averageSessionDuration: 0,
    totalCommentsPosted: 0,
    totalCommentsReceived: 0,
};
export const DEFAULT_SNAPSHOT_ANALYTICS = {
    viewCount: 0,
    uniqueViewers: 0,
    downloadCount: 0,
    commentCount: 0,
    averageTimeOnPage: 0,
    lastViewedAt: Date.now(),
    viewerCountries: [],
    viewerIPs: [],
    viewSessions: [],
};
export const DEFAULT_SNAPSHOT_METADATA = {
    fileCount: 0,
    hasComments: false,
    tags: [],
};
export const DEFAULT_SUBSCRIPTION = {
    status: 'none',
};
export const DEFAULT_ONBOARDING = {
    hasSeenWelcome: false,
    completedTutorials: [],
};
