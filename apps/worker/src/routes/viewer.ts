import { getCookie, setCookie } from 'hono/cookie';
import { VIEWER_COOKIE_PREFIX } from '@quickstage/shared/index';
import { nowMs, verifyPasswordHash } from '../utils';
import { incrementUniqueViewCount } from '../snapshot';
import { getUidFromSession } from '../auth';

// Viewer route handlers for snapshot display and access

// Inject viewer overlay components into HTML
function injectViewerOverlay(html: string, snapshotId: string, isOwner: boolean = false): string {
  const overlayCSS = `
<style id="quickstage-overlay-styles">
/* QuickStage Viewer Overlay - Designed to work with any app */
#quickstage-viewer-overlay {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 999999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  font-size: 14px;
  line-height: 1.4;
  --qs-primary: #4f46e5;
  --qs-primary-hover: #4338ca;
  --qs-bg: rgba(255, 255, 255, 0.95);
  --qs-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --qs-border: rgba(0, 0, 0, 0.1);
}

#quickstage-viewer-toggle {
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: white;
  border: none;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  box-shadow: var(--qs-shadow);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  backdrop-filter: blur(8px);
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 999999;
}

#quickstage-viewer-toggle.hidden {
  display: none;
}

#quickstage-viewer-toggle:hover {
  background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
  transform: translateY(-1px);
}

#quickstage-viewer-panel {
  background: var(--qs-bg);
  border: 1px solid var(--qs-border);
  border-radius: 12px;
  padding: 16px;
  margin-top: 8px;
  box-shadow: var(--qs-shadow);
  backdrop-filter: blur(12px);
  min-width: 250px;
  max-width: 300px;
  display: none;
  animation: slideIn 0.2s ease;
}

#quickstage-viewer-panel.show {
  display: block;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.qs-panel-header {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.qs-button {
  background: white;
  border: 1px solid #e5e7eb;
  color: #374151;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  justify-content: flex-start;
  margin-bottom: 6px;
}

.qs-button:hover {
  background: #f9fafb;
  border-color: #d1d5db;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.qs-button:last-child {
  margin-bottom: 0;
}

.qs-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 12px 0;
}

/* Ensure overlay doesn't interfere with app content */
#quickstage-viewer-overlay * {
  box-sizing: border-box;
}

/* Hide overlay on small screens to avoid interference */
@media (max-width: 640px) {
  #quickstage-viewer-overlay {
    top: 8px;
    right: 8px;
  }
  #quickstage-viewer-panel {
    min-width: 200px;
    max-width: calc(100vw - 32px);
  }
}
</style>`;

  const overlayHTML = `
<div id="quickstage-viewer-overlay">
  <button id="quickstage-viewer-toggle">
    <span>💬</span>
    <span>Comments</span>
  </button>
  
  <div id="quickstage-viewer-panel">
    <div class="qs-panel-header">
      <span>🎯</span>
      <span>Snapshot Tools</span>
    </div>
    
    <button class="qs-button" onclick="window.qsShowCommentThread?.()">
      <span>💬</span>
      <span>Comments & Thread</span>
    </button>
    
    <button class="qs-button" onclick="window.qsShowCommentModal?.()">
      <span>➕</span>
      <span>Add Comment</span>
    </button>
    
    ${isOwner ? `
    <button class="qs-button" onclick="window.qsRequestReview?.()">
      <span>🔍</span>
      <span>Request Review</span>
    </button>
    ` : ''}
    
    <button class="qs-button" onclick="window.qsShowAIAssistant?.()">
      <span>🤖</span>
      <span>AI UX Assistant</span>
    </button>
    
    <div class="qs-divider"></div>
    
    <a href="https://quickstage.tech/dashboard" target="_blank" class="qs-button">
      <span>🏠</span>
      <span>Dashboard</span>
    </a>
  </div>
</div>`;

  const overlayJS = `
<script id="quickstage-overlay-script">
(function() {
  'use strict';
  
  // Wait for DOM to be ready
  function initOverlay() {
    const toggle = document.getElementById('quickstage-viewer-toggle');
    const panel = document.getElementById('quickstage-viewer-panel');
    
    if (!toggle || !panel) return;
    
    let isOpen = false;
    
    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      isOpen = !isOpen;
      panel.classList.toggle('show', isOpen);
      
      // Hide/show toggle button
      toggle.classList.toggle('hidden', isOpen);
      
      // Update toggle appearance
      toggle.style.background = isOpen 
        ? 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)' 
        : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)';
    });
    
    // Close panel when clicking outside
    document.addEventListener('click', function(e) {
      if (!toggle.contains(e.target) && !panel.contains(e.target)) {
        isOpen = false;
        panel.classList.remove('show');
        toggle.classList.remove('hidden');
        toggle.style.background = 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)';
      }
    });
    
    // Global functions for enhanced interactions
    window.qsShowCommentThread = function() {
      // Show full comment thread in embedded iframe
      createEmbeddedViewer('${snapshotId}', 'comments');
    };
    
    window.qsShowCommentModal = function() {
      // Create inline comment modal for quick comments
      createInlineCommentModal('${snapshotId}');
    };
    
    window.qsRequestReview = function() {
      // Show review system in embedded iframe
      createEmbeddedViewer('${snapshotId}', 'reviews');
    };
    
    window.qsShowAIAssistant = function() {
      // Show AI assistant in embedded iframe
      createEmbeddedViewer('${snapshotId}', 'ai');
    };
    
    // Create embedded viewer sidebar
    function createEmbeddedViewer(snapshotId, section) {
      // Remove any existing embedded viewer
      const existing = document.getElementById('qs-embedded-viewer');
      if (existing) existing.remove();
      
      const sidebar = document.createElement('div');
      sidebar.id = 'qs-embedded-viewer';
      sidebar.style.cssText = \`
        position: fixed; top: 0; right: 0; bottom: 0; 
        width: 450px; background: white; z-index: 1000000;
        box-shadow: -5px 0 25px rgba(0, 0, 0, 0.15);
        transform: translateX(100%); transition: transform 0.3s ease;
        border-left: 1px solid #e5e7eb;
      \`;
      
      // Header
      const header = document.createElement('div');
      header.style.cssText = \`
        padding: 16px; border-bottom: 1px solid #e5e7eb; background: #f9fafb;
        display: flex; align-items: center; justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      \`;
      
      const title = document.createElement('h3');
      title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600; color: #374151;';
      title.textContent = section === 'comments' ? 'Comments & Thread' : 
                         section === 'reviews' ? 'Review System' : 'AI UX Assistant';
      
      const closeBtn = document.createElement('button');
      closeBtn.style.cssText = \`
        background: none; border: none; color: #6b7280; cursor: pointer;
        padding: 4px; border-radius: 4px; font-size: 18px;
      \`;
      closeBtn.innerHTML = '×';
      closeBtn.onclick = function() {
        sidebar.style.transform = 'translateX(100%)';
        setTimeout(() => sidebar.remove(), 300);
      };
      
      header.appendChild(title);
      header.appendChild(closeBtn);
      
      // Iframe container
      const iframeContainer = document.createElement('div');
      iframeContainer.style.cssText = 'height: calc(100% - 64px); overflow: hidden;';
      
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
      
      let viewerUrl = \`https://quickstage.tech/viewer/\${snapshotId}\`;
      if (section === 'comments') viewerUrl += '#comments';
      else if (section === 'reviews') viewerUrl += '#reviews';  
      else if (section === 'ai') viewerUrl += '#ai';
      
      iframe.src = viewerUrl;
      
      // Loading state
      const loading = document.createElement('div');
      loading.style.cssText = \`
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        text-align: center; color: #6b7280; font-size: 14px;
      \`;
      loading.innerHTML = \`
        <div style="width: 32px; height: 32px; border: 2px solid #e5e7eb; border-top: 2px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 8px;"></div>
        Loading...
        <style>
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      \`;
      
      iframeContainer.appendChild(loading);
      iframeContainer.appendChild(iframe);
      
      iframe.onload = function() {
        loading.style.display = 'none';
      };
      
      sidebar.appendChild(header);
      sidebar.appendChild(iframeContainer);
      document.body.appendChild(sidebar);
      
      // Animate in
      setTimeout(() => {
        sidebar.style.transform = 'translateX(0)';
      }, 50);
      
      // Close on escape key
      const escapeHandler = function(e) {
        if (e.key === 'Escape') {
          closeBtn.click();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }

    // Inline modal creators (keep for quick comment)
    function createInlineCommentModal(snapshotId) {
      const modal = createModal('Add Comment', \`
        <form id="qs-comment-form" style="display: flex; flex-direction: column; gap: 12px;">
          <textarea id="qs-comment-text" placeholder="Enter your comment..." 
                    style="min-height: 100px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; resize: vertical;"></textarea>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" onclick="closeQSModal()" 
                    style="padding: 8px 16px; border: 1px solid #e5e7eb; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button type="submit" 
                    style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer;">Post Comment</button>
          </div>
        </form>
      \`);
      
      document.getElementById('qs-comment-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const text = document.getElementById('qs-comment-text').value.trim();
        if (!text) return;
        
        try {
          const response = await fetch(\`/comments/\${snapshotId}\`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, author: 'Anonymous' })
          });
          
          if (response.ok) {
            closeQSModal();
            showQSNotification('Comment posted successfully!', 'success');
          } else {
            showQSNotification('Failed to post comment', 'error');
          }
        } catch (error) {
          showQSNotification('Failed to post comment', 'error');
        }
      });
    }
    
    
    function createModal(title, content) {
      // Remove any existing modal
      const existing = document.getElementById('qs-modal-overlay');
      if (existing) existing.remove();
      
      const overlay = document.createElement('div');
      overlay.id = 'qs-modal-overlay';
      overlay.style.cssText = \`
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
        background: rgba(0, 0, 0, 0.5); z-index: 1000000; 
        display: flex; align-items: center; justify-content: center; 
        padding: 20px; backdrop-filter: blur(4px);
      \`;
      
      const modal = document.createElement('div');
      modal.style.cssText = \`
        background: white; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      \`;
      
      modal.innerHTML = \`
        <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0; color: #1f2937; font-size: 18px;">\${title}</h3>
        </div>
        <div style="padding: 20px;">
          \${content}
        </div>
      \`;
      
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      
      // Close on overlay click
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeQSModal();
      });
      
      // Close on escape key
      document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
          closeQSModal();
          document.removeEventListener('keydown', escapeHandler);
        }
      });
      
      return modal;
    }
    
    window.closeQSModal = function() {
      const modal = document.getElementById('qs-modal-overlay');
      if (modal) modal.remove();
    };
    
    function showQSNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.style.cssText = \`
        position: fixed; top: 20px; right: 20px; z-index: 1000001;
        background: \${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white; padding: 12px 16px; border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        font-size: 14px; max-width: 300px;
      \`;
      notification.textContent = message;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    }
    
    console.log('QuickStage viewer overlay initialized');
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOverlay);
  } else {
    initOverlay();
  }
})();
</script>`;

  // Insert CSS in head, HTML and JS before closing body
  let modifiedHtml = html;
  
  // Insert CSS in head (or create head if missing)
  if (modifiedHtml.includes('</head>')) {
    modifiedHtml = modifiedHtml.replace('</head>', overlayCSS + '\n</head>');
  } else if (modifiedHtml.includes('<head>')) {
    modifiedHtml = modifiedHtml.replace('<head>', '<head>\n' + overlayCSS);
  } else {
    // No head tag, insert at beginning of HTML
    modifiedHtml = overlayCSS + '\n' + modifiedHtml;
  }
  
  // Insert HTML and JS before closing body (or at end if no body)
  if (modifiedHtml.includes('</body>')) {
    modifiedHtml = modifiedHtml.replace('</body>', overlayHTML + '\n' + overlayJS + '\n</body>');
  } else {
    // No body tag, append at end
    modifiedHtml = modifiedHtml + '\n' + overlayHTML + '\n' + overlayJS;
  }
  
  return modifiedHtml;
}

// Generate password gate HTML form
function getPasswordGateHTML(id: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Protected Snapshot - QuickStage</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      max-width: 400px;
      width: 100%;
      margin: 1rem;
    }
    h1 {
      text-align: center;
      color: #333;
      margin-bottom: 0.5rem;
      font-size: 1.8rem;
      font-weight: 600;
    }
    p {
      text-align: center;
      color: #666;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    input[type="password"] {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e1e5e9;
      border-radius: 8px;
      font-size: 1rem;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      background: #667eea;
      color: white;
      border: none;
      padding: 0.75rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    button:hover {
      background: #5a67d8;
    }
    button:disabled {
      background: #cbd5e0;
      cursor: not-allowed;
    }
    .error {
      color: #e53e3e;
      font-size: 0.875rem;
      margin-top: 0.5rem;
      text-align: center;
    }
    .loading {
      opacity: 0.7;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔒 Password Protected</h1>
    <p>This snapshot is password protected. Please enter the password to continue.</p>
    
    <form id="passwordForm">
      <div class="form-group">
        <input 
          type="password" 
          id="password" 
          placeholder="Enter password" 
          required 
          autofocus
        />
      </div>
      <button type="submit" id="submitBtn">View Snapshot</button>
      <div id="error" class="error" style="display: none;"></div>
    </form>
  </div>

  <script>
    const form = document.getElementById('passwordForm');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const password = passwordInput.value.trim();
      if (!password) return;

      // Show loading state
      form.classList.add('loading');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';
      errorDiv.style.display = 'none';

      try {
        const response = await fetch('/s/${id}/gate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ password })
        });

        if (response.ok) {
          // Password correct, reload page to show snapshot
          window.location.reload();
        } else {
          const data = await response.json();
          errorDiv.textContent = data.error || 'Invalid password';
          errorDiv.style.display = 'block';
        }
      } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.style.display = 'block';
      } finally {
        // Reset loading state
        form.classList.remove('loading');
        submitBtn.disabled = false;
        submitBtn.textContent = 'View Snapshot';
      }
    });
  </script>
</body>
</html>`;
}

export async function handleViewerById(c: any) {
  const id = c.req.param('id');
  console.log(`🔍 Worker: /s/:id route hit - Serving full-screen snapshot: ${id}`);
  
  // Verify snapshot exists and is accessible
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) return c.text('Snapshot not found', 404);
  
  const meta = JSON.parse(metaRaw);
  if (meta.status === 'expired' || meta.expiresAt < nowMs()) {
    return c.text('Snapshot expired', 410);
  }
  
  // Check if password protected
  if (!meta.public) {
    // First check if user is authenticated and owns this snapshot
    const uid = await getUidFromSession(c);
    if (uid && meta.ownerUid === uid) {
      // Owner can access directly
    } else {
      // Non-owners need password gate cookie
      const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
      if (!gateCookie || gateCookie !== 'ok') {
        // Return password gate form
        return new Response(getPasswordGateHTML(id), {
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
      }
    }
  }
  
  // Increment view count
  await incrementUniqueViewCount(c, id, meta);
  
  // Serve the main HTML file full-screen
  return handleSnapshotFile(c, id, 'index.html');
}

// Handle password gate for protected snapshots
export async function handleSnapshotGate(c: any) {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { password } = body;
  
  if (!password) {
    return c.json({ error: 'Password required' }, 400);
  }
  
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
  if (!metaRaw) {
    return c.json({ error: 'Snapshot not found' }, 404);
  }
  
  const meta = JSON.parse(metaRaw);
  if (meta.status === 'expired' || meta.expiresAt < nowMs()) {
    return c.json({ error: 'Snapshot expired' }, 410);
  }
  
  // Verify password
  const isValid = await verifyPasswordHash(password, meta.passwordHash);
  if (!isValid) {
    return c.json({ error: 'Invalid password' }, 401);
  }
  
  // Set gate cookie
  setCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`, 'ok', {
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
    secure: true,
    sameSite: 'Lax'
  });
  
  return c.json({ success: true });
}


// Handle file serving for snapshots
export async function handleSnapshotFile(c: any, id?: string, fileName?: string) {
  // Extract snapshot ID - prioritize passed ID, then URL param, then extract from URL path
  let snapshotId = id || c.req.param('id');
  
  // Debug logging
  console.log(`🔧 DEBUG: handleSnapshotFile called with id=${id}, fileName=${fileName}`);
  console.log(`🔧 DEBUG: c.req.param('id')=${c.req.param('id')}`);
  console.log(`🔧 DEBUG: c.req.url=${c.req.url}`);
  
  // If no snapshot ID found, extract from URL path
  if (!snapshotId) {
    const url = new URL(c.req.url);
    const pathParts = url.pathname.split('/');
    console.log(`🔧 DEBUG: pathParts=${JSON.stringify(pathParts)}`);
    // URL format is /s/{id}/{file...}, so get the ID part
    const sIndex = pathParts.indexOf('s');
    if (sIndex >= 0 && sIndex + 1 < pathParts.length) {
      snapshotId = pathParts[sIndex + 1];
      console.log(`🔧 DEBUG: extracted snapshotId from URL=${snapshotId}`);
    }
  }
  
  console.log(`🔧 DEBUG: final snapshotId=${snapshotId}`);
  
  // Handle file path extraction
  let actualFilePath = fileName || c.req.param('*');
  if (!actualFilePath) {
    const url = new URL(c.req.url);
    const pathParts = url.pathname.split('/');
    // URL format is /s/{id}/{file...}, so get everything after /s/{id}/
    const sIndex = pathParts.indexOf('s');
    if (sIndex >= 0 && sIndex + 2 < pathParts.length) {
      actualFilePath = pathParts.slice(sIndex + 2).join('/');
    }
  }
  
  // If still no file path, default to index.html for direct snapshot access
  if (!actualFilePath) {
    actualFilePath = 'index.html';
  }
  
  console.log(`📁 Worker: Serving file ${actualFilePath} for snapshot ${snapshotId}`);
  
  // Verify snapshot exists and is accessible
  const metaRaw = await c.env.KV_SNAPS.get(`snap:${snapshotId}`);
  if (!metaRaw) return c.text('Snapshot not found', 404);
  
  const meta = JSON.parse(metaRaw);
  if (meta.status === 'expired' || meta.expiresAt < nowMs()) {
    return c.text('Snapshot expired', 410);
  }
  
  // Check if password protected
  if (!meta.public) {
    // First check if user is authenticated and owns this snapshot
    const uid = await getUidFromSession(c);
    if (uid && meta.ownerUid === uid) {
      // Owner can access files directly
    } else {
      // Non-owners need password gate cookie
      const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${snapshotId}`);
      if (!gateCookie || gateCookie !== 'ok') {
        return c.text('Unauthorized', 401);
      }
    }
  }
  
  // Get file from R2
  const fileObj = await c.env.R2_SNAPSHOTS.get(`snap/${snapshotId}/${actualFilePath}`);
  if (!fileObj) {
    return c.text('File not found', 404);
  }
  
  // Determine content type
  let contentType = 'application/octet-stream';
  if (actualFilePath.endsWith('.html')) contentType = 'text/html';
  else if (actualFilePath.endsWith('.js')) contentType = 'application/javascript';
  else if (actualFilePath.endsWith('.css')) contentType = 'text/css';
  else if (actualFilePath.endsWith('.json')) contentType = 'application/json';
  else if (actualFilePath.endsWith('.png')) contentType = 'image/png';
  else if (actualFilePath.endsWith('.jpg') || actualFilePath.endsWith('.jpeg')) contentType = 'image/jpeg';
  else if (actualFilePath.endsWith('.svg')) contentType = 'image/svg+xml';
  else if (actualFilePath.endsWith('.ico')) contentType = 'image/x-icon';
  
  // For HTML, CSS, and JS files, rewrite asset paths to include snapshot ID
  if (actualFilePath.endsWith('.html') || actualFilePath.endsWith('.css') || actualFilePath.endsWith('.js')) {
    let content = await fileObj.text();
    
    // Comprehensive asset path rewriting from /path to /s/{id}/path
    content = content
      // CSS and JS assets with href and src attributes
      .replace(/href="\/([^"]+)"/g, `href="/s/${snapshotId}/$1"`)
      .replace(/src="\/([^"]+)"/g, `src="/s/${snapshotId}/$1"`)
      // Single quotes
      .replace(/href='\/([^']+)'/g, `href='/s/${snapshotId}/$1'`)
      .replace(/src='\/([^']+)'/g, `src='/s/${snapshotId}/$1'`)
      // Import statements and other asset references  
      .replace(/import\s+.*from\s+["']\/([^"']+)["']/g, (match: string, path: string) => match.replace(`"/${path}"`, `"/s/${snapshotId}/${path}"`))
      .replace(/import\s+.*from\s+['"]\/([^"']+)["']/g, (match: string, path: string) => match.replace(`'/${path}'`, `'/s/${snapshotId}/${path}'`))
      // URL() references in CSS
      .replace(/url\(["']?\/([^"')]+)["']?\)/g, `url("/s/${snapshotId}/$1")`)
      // Background images and other CSS url references
      .replace(/background-image:\s*url\(["']?\/([^"')]+)["']?\)/g, `background-image: url("/s/${snapshotId}/$1")`)
      // Dynamic imports in JS
      .replace(/import\(['"]\/([^'"]+)['"]\)/g, `import("/s/${snapshotId}/$1")`)
      // Fetch and other dynamic asset loading
      .replace(/fetch\(['"]\/([^'"]+)['"]\)/g, `fetch("/s/${snapshotId}/$1")`)
      // New URL construction
      .replace(/new\s+URL\(['"]\/([^'"]+)['"]/g, `new URL("/s/${snapshotId}/$1"`);
    
    // For HTML files, inject viewer overlay components
    if (actualFilePath.endsWith('.html')) {
      // Check if user is authenticated and owns this snapshot
      const uid = await getUidFromSession(c);
      const isOwner = !!(uid && meta.ownerUid === uid);
      content = injectViewerOverlay(content, snapshotId, isOwner);
    }
    
    console.log(`🔧 ${actualFilePath} asset paths rewritten for snapshot ${snapshotId}`);
    
    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        // Don't cache HTML files since we do server-side rewriting - cache assets for longer
        'Cache-Control': actualFilePath.endsWith('.html') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000',
        // Fix CSP to allow our overlay scripts
        ...(actualFilePath.endsWith('.html') ? {
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://quickstage.tech; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://quickstage.tech; font-src 'self' data:",
          'Pragma': 'no-cache',
          'Expires': '0',
          'ETag': `"${Date.now()}-${Math.random()}"` // Force unique ETag for every request
        } : {})
      }
    });
  }
  
  return new Response(fileObj.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000'
    }
  });
}

// Legacy exports for compatibility with index.ts
export async function handleViewerByIdWithPath(c: any) {
  const id = c.req.param('id');
  const filePath = c.req.param('*');
  console.log(`🔧 ROUTE DEBUG: handleViewerByIdWithPath called - id=${id}, filePath=${filePath}`);
  return handleSnapshotFile(c, id, filePath);
}

export async function handleSnapByIdWithPath(c: any) {
  const id = c.req.param('id');
  const filePath = c.req.param('*');
  console.log(`🔧 ROUTE DEBUG: handleSnapByIdWithPath called - id=${id}, filePath=${filePath}`);
  return handleSnapshotFile(c, id, filePath);
}

export const handleSnapById = handleViewerById;  
export const handleViewerGate = handleSnapshotGate;