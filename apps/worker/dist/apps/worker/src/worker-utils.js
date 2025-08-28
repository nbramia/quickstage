import { AnalyticsManager } from './analytics';
/**
 * Worker utility functions for the QuickStage Worker
 * Handles analytics manager initialization and other shared utilities
 */
// Initialize analytics manager when environment is available
let analyticsManager;
/**
 * Get or create analytics manager instance
 */
export function getAnalyticsManager(c) {
    if (!analyticsManager) {
        analyticsManager = new AnalyticsManager(c.env);
    }
    return analyticsManager;
}
