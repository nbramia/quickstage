import { getUidFromSession } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
// Comments route handlers
// GET /api/snapshots/:id/comments
export async function handleGetSnapshotComments(c) {
    const id = c.req.param('id');
    if (!id)
        return c.json({ error: 'bad_request' }, 400);
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(id));
    const res = await stub.fetch(new URL(`/comments?id=${encodeURIComponent(id)}`, 'http://do').toString());
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
}
// GET /comments/:snapshotId (public endpoint)
export async function handleGetComments(c) {
    const snapshotId = c.req.param('snapshotId');
    if (!snapshotId)
        return c.json({ error: 'bad_request' }, 400);
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(snapshotId));
    const res = await stub.fetch(new URL(`/comments?id=${encodeURIComponent(snapshotId)}`, 'http://do').toString());
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
}
// POST /api/snapshots/:id/comments
export async function handlePostSnapshotComment(c) {
    const id = c.req.param('id');
    if (!id)
        return c.json({ error: 'bad_request' }, 400);
    const body = await c.req.json();
    if (!body || !body.text)
        return c.json({ error: 'bad_request' }, 400);
    // Turnstile verification
    const token = body.turnstileToken || '';
    if (!token)
        return c.json({ error: 'turnstile_required' }, 400);
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson.success)
        return c.json({ error: 'turnstile_failed' }, 403);
    // Get user info for author
    const uid = await getUidFromSession(c);
    const author = uid ? `User-${uid.slice(0, 8)}` : 'Anonymous';
    const commentData = {
        text: body.text,
        file: body.file,
        line: body.line,
        author: author
    };
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(id));
    const res = await stub.fetch('http://do/comments', {
        method: 'POST',
        body: JSON.stringify(commentData),
        headers: { 'Content-Type': 'application/json' }
    });
    // Increment comments count
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (metaRaw) {
        try {
            const meta = JSON.parse(metaRaw);
            meta.commentsCount = (meta.commentsCount || 0) + 1;
            await c.env.KV_SNAPS.put(`snap:${id}`, JSON.stringify(meta));
        }
        catch { }
    }
    // Track analytics event for comment posting
    if (uid) {
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'comment_posted', {
            snapshotId: id,
            commentLength: body.text.length,
            hasFile: !!body.file,
            hasLine: !!body.line
        });
    }
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
}
// GET /comments (legacy endpoint for backward compatibility)
export async function handleGetCommentsLegacy(c) {
    const id = c.req.query('id');
    if (!id)
        return c.json({ error: 'bad_request' }, 400);
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(id));
    const res = await stub.fetch(new URL(`/comments?id=${encodeURIComponent(id)}`, 'http://do').toString());
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
}
// POST /comments (legacy endpoint for backward compatibility)
export async function handlePostCommentLegacy(c) {
    const body = await c.req.json();
    if (!body || !body.id || !body.text)
        return c.json({ error: 'bad_request' }, 400);
    // Turnstile verification
    const token = c.req.header('cf-turnstile-token') || c.req.header('x-turnstile-token') || '';
    if (!token)
        return c.json({ error: 'turnstile_required' }, 400);
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const verifyJson = await verifyRes.json();
    if (!verifyJson.success)
        return c.json({ error: 'turnstile_failed' }, 403);
    const stub = c.env.COMMENTS_DO.get(c.env.COMMENTS_DO.idFromName(body.id));
    const res = await stub.fetch('http://do/comments', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    // Increment comments count eventually
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${body.id}`);
    if (metaRaw) {
        try {
            const meta = JSON.parse(metaRaw);
            meta.commentsCount = (meta.commentsCount || 0) + 1;
            await c.env.KV_SNAPS.put(`snap:${body.id}`, JSON.stringify(meta));
        }
        catch { }
    }
    // Track analytics event for comment posting (legacy endpoint)
    // Note: We don't have user ID here, so we'll track it as a system event
    console.log(`💬 Comment posted to snapshot: ${body.id} by ${body.author || 'Anonymous'}`);
    return new Response(res.body, { headers: { 'Content-Type': 'application/json' } });
}
// GET /comments/:snapshotId (alternative implementation)
export async function handleGetSnapshotCommentsAlt(c) {
    try {
        const snapshotId = c.req.param('snapshotId');
        console.log(`💬 Getting comments for snapshot: ${snapshotId}`);
        // Get the Durable Object for this snapshot
        const id = c.env.COMMENTS_DO.idFromName(snapshotId);
        const obj = c.env.COMMENTS_DO.get(id);
        // Call the getComments method
        const response = await obj.fetch('https://dummy.com/comments', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            console.error(`❌ Failed to get comments for snapshot: ${snapshotId}`);
            return c.json({ error: 'failed_to_get_comments' }, 500);
        }
        const data = await response.json();
        console.log(`✅ Retrieved ${data.comments?.length || 0} comments for snapshot: ${snapshotId}`);
        return c.json(data);
    }
    catch (error) {
        console.error('❌ Error getting comments:', error);
        return c.json({ error: 'internal_error' }, 500);
    }
}
// POST /comments/:snapshotId (alternative implementation)
export async function handlePostSnapshotCommentAlt(c) {
    try {
        const snapshotId = c.req.param('snapshotId');
        const { text, author = 'Anonymous' } = await c.req.json();
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return c.json({ error: 'invalid_comment' }, 400);
        }
        console.log(`💬 Adding comment to snapshot: ${snapshotId}, author: ${author}`);
        // Get the Durable Object for this snapshot
        const id = c.env.COMMENTS_DO.idFromName(snapshotId);
        const obj = c.env.COMMENTS_DO.get(id);
        // Call the addComment method
        const response = await obj.fetch('https://dummy.com/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim(), author: author.trim() || 'Anonymous' })
        });
        if (!response.ok) {
            console.error(`❌ Failed to add comment to snapshot: ${snapshotId}`);
            return c.json({ error: 'failed_to_add_comment' }, 500);
        }
        const data = await response.json();
        console.log(`✅ Comment added successfully to snapshot: ${snapshotId}`);
        // Track analytics event for comment posting
        // Note: We don't have user ID here, so we'll track it as a system event
        // In a real implementation, you'd want to pass user context
        console.log(`💬 Comment posted to snapshot: ${snapshotId} by ${author}`);
        return c.json(data);
    }
    catch (error) {
        console.error('❌ Error adding comment:', error);
        return c.json({ error: 'internal_error' }, 500);
    }
}
