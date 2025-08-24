// QuickStage Web App Configuration
// This file centralizes all configuration values to avoid hardcoding

export const config = {
  // Worker API base URL - change this when you get clean URLs working
  WORKER_BASE_URL: 'https://quickstage-worker.nbramia.workers.dev',
  
  // Web app base URL
  WEB_BASE_URL: 'https://quickstage.tech',
  
  // API endpoints
  API_BASE_URL: '/api',
  
  // Snapshot viewer URL template
  getSnapshotUrl: (snapshotId: string) => `${config.WORKER_BASE_URL}/s/${snapshotId}`,
  
  // Extension download URL
  EXTENSION_DOWNLOAD_URL: '/quickstage.vsix',
  
  // Version info endpoint
  VERSION_INFO_URL: '/api/extensions/version'
};

export default config;
