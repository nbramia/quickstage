import { UserRecord } from '../types';
import { getUidFromSession } from '../auth';
import { canAccessProFeatures, getSubscriptionDisplayStatus } from '../user';
import { getAnalyticsManager } from '../worker-utils';
import { getExtensionVersion } from '../version-info';

// Extensions route handlers
export async function handleApiExtensionVersion(c: any) {
  try {
    const versionInfo = getExtensionVersion();
    return c.json({
      version: versionInfo.version,
      buildDate: versionInfo.buildDate,
      checksum: 'direct-serve', // No longer serving VSIX content
      downloadUrl: '/quickstage.vsix', // Direct from web app
      filename: 'quickstage.vsix'
    });
  } catch (error) {
    console.error('Error serving version info:', error);
    return c.json({ error: 'version_info_unavailable' }, 500);
  }
}

export async function handleApiExtensionDownload(c: any) {
  // Check authentication first
  const uid = await getUidFromSession(c);
  if (!uid) {
    return c.json({ error: 'unauthorized', message: 'Please log in to download the extension' }, 401);
  }
  
  // Check subscription status
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) {
    return c.json({ error: 'user_not_found' }, 404);
  }
  
  const user: UserRecord = JSON.parse(userRaw);
  if (!canAccessProFeatures(user)) {
    return c.json({ 
      error: 'subscription_required', 
      message: 'Active subscription or trial required to download extension',
      subscriptionStatus: getSubscriptionDisplayStatus(user)
    }, 403);
  }
  
  try {
    // Fetch the VSIX from the web app's public directory
    const vsixUrl = `https://quickstage.tech/quickstage.vsix`;
    
    const response = await fetch(vsixUrl);
    if (!response.ok) {
      console.error('Failed to fetch VSIX from web app:', response.status);
      return c.json({ error: 'download_unavailable' }, 500);
    }
    
    const vsixData = await response.arrayBuffer();
    
    // Get version for dynamic filename
    const versionInfo = getExtensionVersion();
    const filename = `quickstage-${versionInfo.version}.vsix`;
    
    // Serve with explicit headers to ensure proper download
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Length', vsixData.byteLength.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    
    console.log(`VSIX download authorized for user ${uid} (${getSubscriptionDisplayStatus(user)})`);
    
    // Track analytics event
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'extension_downloaded', { 
      version: getExtensionVersion().version,
      filename: filename
    });
    
    return new Response(vsixData, { headers });
    
  } catch (error) {
    console.error('Error serving VSIX download:', error);
    return c.json({ error: 'download_failed' }, 500);
  }
}

export async function handleExtensionVersion(c: any) {
  try {
    const versionInfo = getExtensionVersion();
    return c.json({
      version: versionInfo.version,
      buildDate: versionInfo.buildDate,
      checksum: 'direct-serve', // No longer serving VSIX content
      downloadUrl: '/quickstage.vsix', // Direct from web app
      filename: 'quickstage.vsix'
    });
  } catch (error) {
    console.error('Error serving version info:', error);
    return c.json({ error: 'version_info_unavailable' }, 500);
  }
}

export async function handleExtensionDownload(c: any) {
  // Check authentication first
  const uid = await getUidFromSession(c);
  if (!uid) {
    return c.json({ error: 'unauthorized', message: 'Please log in to download the extension' }, 401);
  }
  
  // Check subscription status
  const userRaw = await c.env.KV_USERS.get(`user:${uid}`);
  if (!userRaw) {
    return c.json({ error: 'user_not_found' }, 404);
  }
  
  const user: UserRecord = JSON.parse(userRaw);
  if (!canAccessProFeatures(user)) {
    return c.json({ 
      error: 'subscription_required', 
      message: 'Active subscription or trial required to download extension',
      subscriptionStatus: getSubscriptionDisplayStatus(user)
    }, 403);
  }
  
  try {
    // Fetch the VSIX from the web app's public directory
    const vsixUrl = `https://quickstage.tech/quickstage.vsix`;
    
    const response = await fetch(vsixUrl);
    if (!response.ok) {
      console.error('Failed to fetch VSIX from web app:', response.status);
      return c.json({ error: 'download_unavailable' }, 500);
    }
    
    const vsixData = await response.arrayBuffer();
    
    // Get version for dynamic filename
    const versionInfo = getExtensionVersion();
    const filename = `quickstage-${versionInfo.version}.vsix`;
    
    // Serve with explicit headers to ensure proper download
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Length', vsixData.byteLength.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    
    // Track analytics event
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'extension_downloaded', { 
      version: versionInfo.version,
      filename: filename
    });
    
    return new Response(vsixData, { headers });
    
  } catch (error) {
    console.error('Error serving VSIX download:', error);
    return c.json({ error: 'download_failed' }, 500);
  }
}