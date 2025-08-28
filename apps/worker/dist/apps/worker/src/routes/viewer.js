import { getCookie, setCookie } from 'hono/cookie';
import { VIEWER_COOKIE_PREFIX } from '@quickstage/shared/index';
import { nowMs, verifyPasswordHash } from '../utils';
import { incrementUniqueViewCount } from '../snapshot';
// Viewer route handlers for snapshot display and access
export async function handleViewerById(c) {
    const id = c.req.param('id');
    console.log(`🔍 Worker: /s/:id route hit - id: ${id}`);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.text('Snapshot not found', 404);
    const meta = JSON.parse(metaRaw);
    if (meta.status === 'expired' || meta.expiresAt < nowMs()) {
        return c.text('Snapshot expired', 410);
    }
    // Check if password protected
    if (!meta.public) {
        const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (!gateCookie || gateCookie !== 'ok') {
            // Serve a password prompt page instead of 401
            const passwordPromptHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enter Password - QuickStage</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
        h1 { margin: 0 0 1rem 0; font-size: 1.5rem; color: #333; text-align: center; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555; }
        input[type="password"] { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
        button { width: 100%; padding: 0.75rem; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
        button:hover { background: #0056b3; }
        .error { color: #dc3545; margin-top: 0.5rem; font-size: 0.875rem; }
        .footer { text-align: center; margin-top: 1rem; font-size: 0.875rem; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 Password Required</h1>
        <form onsubmit="submitPassword(event)">
            <div class="form-group">
                <label for="password">Enter the password to view this snapshot:</label>
                <input type="password" id="password" name="password" required autofocus>
            </div>
            <button type="submit">Access Snapshot</button>
            <div id="error" class="error" style="display: none;"></div>
        </form>
        <div class="footer">
            <a href="https://quickstage.tech" target="_blank">Powered by QuickStage</a>
        </div>
    </div>
    
    <script>
        async function submitPassword(event) {
            event.preventDefault();
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            
            try {
                const response = await fetch('/s/${id}/gate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                
                if (response.ok) {
                    // Password accepted, reload page
                    window.location.reload();
                } else {
                    // Password rejected
                    errorDiv.textContent = 'Incorrect password. Please try again.';
                    errorDiv.style.display = 'block';
                    document.getElementById('password').value = '';
                    document.getElementById('password').focus();
                }
            } catch (error) {
                errorDiv.textContent = 'Error verifying password. Please try again.';
                errorDiv.style.display = 'block';
            }
        }
    </script>
</body>
</html>`;
            return new Response(passwordPromptHTML, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                status: 200
            });
        }
    }
    // Increment view count for unique viewers
    await incrementUniqueViewCount(c, id, meta);
    // Track analytics event for snapshot viewing
    // Note: We don't have user ID here for anonymous viewers, so we'll track it as a system event
    // In a real implementation, you'd want to pass user context when available
    console.log(`👁️ Snapshot viewed: ${id} (public: ${meta.public}, password protected: ${!meta.public})`);
    // Get the main index.html file
    const indexObj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/index.html`);
    if (!indexObj) {
        return c.text('Snapshot index not found', 404);
    }
    // Read and modify the HTML content to fix asset paths
    let htmlContent = await indexObj.text();
    console.log(`🔍 Original HTML content preview:`, htmlContent.substring(0, 500));
    // Replace absolute asset paths with relative ones scoped to this snapshot
    const beforeReplace = htmlContent;
    // Use a single, comprehensive replacement that handles all cases at once
    // This prevents double-replacement by doing everything in one pass
    htmlContent = htmlContent.replace(/(href|src)=["']\/([^"']*)/g, (match, attr, path) => {
        // Only replace if it looks like an asset path
        if (path.startsWith('assets/') || /\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/.test(path)) {
            return `${attr}="/s/${id}/${path}"`;
        }
        return match; // Keep original if not an asset
    });
    // Inject the QuickStage commenting overlay
    const commentsOverlay = `
    <!-- QuickStage Comments Overlay -->
    <div id="quickstage-comments-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <!-- Comments Button -->
      <div id="quickstage-comments-button" style="position: fixed; top: 20px; right: 20px; pointer-events: auto; background: #007bff; color: white; border: none; border-radius: 8px; padding: 12px 20px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.2s ease;">
        💬 Comments
      </div>
      
      <!-- Comments Side Panel -->
      <div id="quickstage-comments-panel" style="position: fixed; top: 0; right: -400px; width: 400px; height: 100%; background: white; box-shadow: -4px 0 20px rgba(0,0,0,0.1); pointer-events: auto; transition: right 0.3s ease; display: flex; flex-direction: column;">
        <!-- Panel Header -->
        <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: #333; font-size: 18px;">💬 Comments</h3>
          <button id="quickstage-close-panel" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
        
        <!-- Comment Form -->
        <div style="padding: 20px; border-bottom: 1px solid #eee;">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Your Name:</label>
            <input type="text" id="quickstage-comment-name" placeholder="Anonymous" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #555;">Comment:</label>
            <textarea id="quickstage-comment-text" placeholder="Share your thoughts..." rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; resize: vertical;"></textarea>
          </div>
          <button id="quickstage-submit-comment" style="background: #007bff; color: white; border: none; border-radius: 4px; padding: 10px 20px; font-size: 14px; cursor: pointer; width: 100%; transition: background 0.2s ease;">Post Comment</button>
        </div>
        
        <!-- Comments List -->
        <div id="quickstage-comments-list" style="flex: 1; overflow-y: auto; padding: 20px;">
          <div id="quickstage-loading" style="text-align: center; color: #666; padding: 20px;">Loading comments...</div>
        </div>
      </div>
    </div>
    
    <script>
      (function() {
        const overlay = document.getElementById('quickstage-comments-overlay');
        const button = document.getElementById('quickstage-comments-button');
        const panel = document.getElementById('quickstage-comments-panel');
        const closeBtn = document.getElementById('quickstage-close-panel');
        const commentForm = document.getElementById('quickstage-submit-comment');
        const nameInput = document.getElementById('quickstage-comment-name');
        const textInput = document.getElementById('quickstage-comment-text');
        const commentsList = document.getElementById('quickstage-comments-list');
        const loading = document.getElementById('quickstage-loading');
        
        const snapshotId = '${id}';
        
        // Toggle panel
        button.addEventListener('click', () => {
          panel.style.right = '0';
          loadComments();
        });
        
        closeBtn.addEventListener('click', () => {
          panel.style.right = '-400px';
        });
        
        // Close panel when clicking outside
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            panel.style.right = '-400px';
          }
        });
        
        // Load comments
        async function loadComments() {
          try {
            loading.style.display = 'block';
            const response = await fetch(\`/comments/\${snapshotId}\`);
            const data = await response.json();
            
            if (data.comments && data.comments.length > 0) {
              loading.style.display = 'none';
              commentsList.innerHTML = data.comments.map(comment => \`
                <div style="padding: 15px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 15px; background: #f9f9f9;">
                  <div style="font-weight: 500; color: #333; margin-bottom: 5px;">\${comment.author || 'Anonymous'}</div>
                  <div style="color: #555; line-height: 1.4;">\${comment.text}</div>
                  <div style="font-size: 12px; color: #999; margin-top: 8px;">\${new Date(comment.createdAt).toLocaleString()}</div>
                </div>
              \`).join('');
            } else {
              loading.style.display = 'none';
              commentsList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No comments yet. Be the first to comment!</div>';
            }
          } catch (error) {
            loading.style.display = 'none';
            commentsList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Error loading comments.</div>';
          }
        }
        
        // Submit comment
        commentForm.addEventListener('click', async () => {
          const name = nameInput.value.trim() || 'Anonymous';
          const text = textInput.value.trim();
          
          if (!text) {
            alert('Please enter a comment.');
            return;
          }
          
          try {
            commentForm.disabled = true;
            commentForm.textContent = 'Posting...';
            
            const response = await fetch(\`/comments/\${snapshotId}\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, author: name })
            });
            
            if (response.ok) {
              nameInput.value = '';
              textInput.value = '';
              loadComments();
              commentForm.textContent = 'Comment Posted!';
              setTimeout(() => {
                commentForm.textContent = 'Post Comment';
                commentForm.disabled = false;
              }, 2000);
            } else {
              throw new Error('Failed to post comment');
            }
          } catch (error) {
            commentForm.textContent = 'Error - Try Again';
            commentForm.disabled = false;
            setTimeout(() => {
              commentForm.textContent = 'Post Comment';
            }, 2000);
          }
        });
        
        // Enter key to submit
        textInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commentForm.click();
          }
        });
      })();
    </script>
  `;
    // Insert the overlay before the closing </body> tag, or at the end if no body tag
    if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', commentsOverlay + '</body>');
    }
    else {
        htmlContent += commentsOverlay;
    }
    console.log(`🔍 HTML content after replacement:`, htmlContent.substring(0, 500));
    console.log(`🔍 Asset path replacements made:`, {
        before: beforeReplace.includes('/assets/'),
        after: htmlContent.includes(`/s/${id}/assets/`),
        id: id
    });
    // Return the modified HTML with proper headers
    const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
    return new Response(htmlContent, { headers });
}
// Asset serving with password gate - for individual files (CSS, JS, images, etc.)
export async function handleViewerByIdWithPath(c) {
    const id = c.req.param('id');
    let path = c.req.param('*') || '';
    // If Hono wildcard fails, extract path manually from URL
    if (!path) {
        const url = new URL(c.req.url);
        const pathMatch = url.pathname.match(`^/s/${id}/(.+)$`);
        path = pathMatch ? pathMatch[1] : '';
    }
    console.log(`🔍 Worker: /s/:id/* route hit - id: ${id}, path: "${path}", url: ${c.req.url}`);
    if (!path) {
        console.log(`❌ No path extracted from URL: ${c.req.url}`);
        return c.text('Not found', 404);
    }
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.text('Gone', 410);
    const meta = JSON.parse(metaRaw);
    if (meta.status === 'expired' || meta.expiresAt < nowMs())
        return c.text('Gone', 410);
    if (!meta.public) {
        const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (!gateCookie || gateCookie !== 'ok')
            return c.json({ error: 'unauthorized' }, 401);
    }
    console.log(`🔍 Looking for asset: snap/${id}/${path}`);
    const r2obj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/${path}`);
    if (!r2obj) {
        console.log(`❌ Asset not found: snap/${id}/${path}`);
        return c.text('Not found', 404);
    }
    console.log(`✅ Asset found: snap/${id}/${path}, size: ${r2obj.size}, type: ${r2obj.httpMetadata?.contentType}`);
    const headers = {
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
    const ct = r2obj.httpMetadata?.contentType;
    if (ct)
        headers['Content-Type'] = ct;
    return new Response(r2obj.body, { headers });
}
// Alternative /snap/* routes for better Pages compatibility
export async function handleSnapByIdWithPath(c) {
    const id = c.req.param('id');
    const path = c.req.param('*') || '';
    console.log(`🔍 Worker: /snap/:id/* route hit - id: ${id}, path: ${path}`);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.text('Gone', 410);
    const meta = JSON.parse(metaRaw);
    if (meta.status === 'expired' || meta.expiresAt < nowMs())
        return c.text('Gone', 410);
    if (!meta.public) {
        const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (!gateCookie || gateCookie !== 'ok')
            return c.json({ error: 'unauthorized' }, 401);
    }
    const r2obj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/${path}`);
    if (!r2obj) {
        return c.text('Not found', 404);
    }
    const headers = {
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
    const ct = r2obj.httpMetadata?.contentType;
    if (ct)
        headers['Content-Type'] = ct;
    return new Response(r2obj.body, { headers });
}
// Alternative /snap/:id route for better Pages compatibility
export async function handleSnapById(c) {
    const id = c.req.param('id');
    console.log(`🔍 Worker: /snap/:id route hit - id: ${id}`);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.text('Snapshot not found', 404);
    const meta = JSON.parse(metaRaw);
    if (meta.status === 'expired' || meta.expiresAt < nowMs()) {
        return c.text('Snapshot expired', 410);
    }
    // Check if password protected
    if (!meta.public) {
        const gateCookie = getCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`);
        if (!gateCookie || gateCookie !== 'ok') {
            return c.text('Password required', 401);
        }
    }
    // Increment view count for unique viewers
    await incrementUniqueViewCount(c, id, meta);
    // Get the main index.html file
    const indexObj = await c.env.R2_SNAPSHOTS.get(`snap/${id}/index.html`);
    if (!indexObj) {
        return c.text('Snapshot index not found', 404);
    }
    // Return the HTML with proper headers
    const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
    return new Response(indexObj.body, { headers });
}
// Gate - Password verification endpoint
export async function handleViewerGate(c) {
    try {
        const id = c.req.param('id');
        console.log(`🔐 Gate endpoint called for snapshot: ${id}`);
        const body = await c.req.json();
        const password = String(body?.password || '');
        console.log(`🔐 Password received: ${password ? '***' : 'empty'}`);
        const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
        if (!metaRaw) {
            console.log(`❌ Snapshot metadata not found for: ${id}`);
            return c.json({ error: 'not_found' }, 404);
        }
        const meta = JSON.parse(metaRaw);
        console.log(`🔐 Snapshot metadata found:`, {
            id: meta.id,
            hasPasswordHash: !!meta.passwordHash,
            passwordHashLength: meta.passwordHash?.length || 0
        });
        // Handle both old and new metadata structures
        let passwordToVerify = meta.passwordHash;
        let isLegacy = false;
        if (!passwordToVerify && meta.password) {
            // Legacy structure - use plain text password
            passwordToVerify = meta.password;
            isLegacy = true;
            console.log(`🔐 Using legacy password structure for: ${id}`);
        }
        if (!passwordToVerify) {
            console.log(`❌ No password found in metadata (neither passwordHash nor password)`);
            return c.json({ error: 'no_password_set' }, 400);
        }
        let ok = false;
        if (isLegacy) {
            // Legacy: direct string comparison
            ok = password === passwordToVerify;
            console.log(`🔐 Legacy password verification result: ${ok}`);
        }
        else {
            // New: hash verification
            ok = await verifyPasswordHash(password, passwordToVerify);
            console.log(`🔐 Hash password verification result: ${ok}`);
        }
        if (!ok)
            return c.json({ error: 'forbidden' }, 403);
        setCookie(c, `${VIEWER_COOKIE_PREFIX}${id}`, 'ok', {
            secure: true,
            sameSite: 'None',
            path: `/s/${id}`,
            maxAge: 60 * 60,
        });
        console.log(`✅ Password verified, cookie set for: ${id}`);
        // Track analytics event for password verification
        // Note: We don't have user ID here for anonymous viewers, so we'll track it as a system event
        console.log(`🔐 Password verified for snapshot: ${id}`);
        return c.json({ ok: true });
    }
    catch (error) {
        console.error(`❌ Error in gate endpoint:`, error);
        return c.json({ error: 'internal_error', details: String(error) }, 500);
    }
}
