import { getUidFromSession, getUidFromPAT } from '../auth';
import { ALLOW_MIME_PREFIXES } from '@quickstage/shared/index';
import { presignR2PutURL } from '../s3presign';
// Upload route handlers
export async function handleUploadUrl(c) {
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.query('id');
    const p = c.req.query('path');
    const ct = c.req.query('ct') || 'application/octet-stream';
    const sz = Number(c.req.query('sz') || '0');
    if (!id || !p)
        return c.json({ error: 'bad_request' }, 400);
    if (p.includes('..'))
        return c.json({ error: 'bad_path' }, 400);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'forbidden' }, 403);
    // Defensive check for caps property
    if (!meta.caps || typeof meta.caps !== 'object') {
        console.error('Missing or invalid caps in snapshot metadata:', { id: meta.id, caps: meta.caps });
        // Fallback to default caps if missing
        meta.caps = {
            maxBytes: 20 * 1024 * 1024,
            maxFile: 5 * 1024 * 1024,
            maxDays: 14,
        };
        console.log('Applied fallback caps:', meta.caps);
    }
    if (sz > meta.caps.maxFile)
        return c.json({ error: 'file_too_large' }, 400);
    if (!ALLOW_MIME_PREFIXES.some((x) => String(ct).startsWith(x)))
        return c.json({ error: 'type_not_allowed' }, 400);
    const url = await presignR2PutURL({
        accountId: c.env.R2_ACCOUNT_ID,
        bucket: 'snapshots',
        key: `snap/${id}/${p}`,
        accessKeyId: c.env.R2_ACCESS_KEY_ID,
        secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
        contentType: String(ct),
        expiresSeconds: 600,
    });
    return c.json({ url });
}
export async function handleUpload(c) {
    let uid = await getUidFromSession(c);
    if (!uid) {
        // Try PAT authentication as fallback
        const authHeader = c.req.header('authorization') || c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            uid = await getUidFromPAT(c, token);
        }
    }
    if (!uid)
        return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.query('id');
    const p = c.req.query('path');
    const ct = c.req.header('content-type') || 'application/octet-stream';
    const sz = Number(c.req.header('content-length') || '0');
    const h = c.req.query('h') || '';
    if (!id || !p)
        return c.json({ error: 'bad_request' }, 400);
    if (p.includes('..'))
        return c.json({ error: 'bad_path' }, 400);
    const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
    if (!metaRaw)
        return c.json({ error: 'not_found' }, 404);
    const meta = JSON.parse(metaRaw);
    if (meta.ownerUid !== uid)
        return c.json({ error: 'forbidden' }, 403);
    // Defensive check for caps property
    if (!meta.caps || typeof meta.caps !== 'object') {
        console.error('Missing or invalid caps in snapshot metadata:', { id: meta.id, caps: meta.caps });
        // Fallback to default caps if missing
        meta.caps = {
            maxBytes: 20 * 1024 * 1024,
            maxFile: 5 * 1024 * 1024,
            maxDays: 14,
        };
        console.log('Applied fallback caps:', meta.caps);
    }
    if (sz > meta.caps.maxFile)
        return c.json({ error: 'file_too_large' }, 400);
    if (!ALLOW_MIME_PREFIXES.some((prefix) => ct.startsWith(prefix)))
        return c.json({ error: 'type_not_allowed' }, 400);
    const objectKey = `snap/${id}/${p}`;
    const body = c.req.raw.body;
    if (!body)
        return c.json({ error: 'no_body' }, 400);
    // Add retry logic for R2 operations to handle rate limiting
    const maxRetriesR2 = 3;
    let retryCountR2 = 0;
    while (retryCountR2 < maxRetriesR2) {
        try {
            await c.env.R2_SNAPSHOTS.put(objectKey, body, { httpMetadata: { contentType: ct } });
            return c.json({ ok: true });
        }
        catch (error) {
            retryCountR2++;
            const errorMessage = String(error);
            // Check if this is a rate limiting error
            if (errorMessage.includes('10058') || errorMessage.includes('concurrent request rate') || errorMessage.includes('429')) {
                if (retryCountR2 < maxRetriesR2) {
                    console.log(`R2 upload rate limited, retrying (${retryCountR2}/${maxRetriesR2})...`);
                    // Wait with exponential backoff: 1s, 2s, 4s
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCountR2 - 1) * 1000));
                    continue;
                }
            }
            console.error('R2 upload failed:', error);
            return c.json({ error: 'upload_failed', details: errorMessage }, 500);
        }
    }
}
export async function handleApiUpload(c) {
    try {
        console.log('API upload endpoint called');
        let uid = await getUidFromSession(c);
        if (!uid) {
            // Try PAT authentication as fallback
            const authHeader = c.req.header('authorization') || c.req.header('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.slice(7);
                uid = await getUidFromPAT(c, token);
            }
        }
        if (!uid)
            return c.json({ error: 'unauthorized' }, 401);
        const id = c.req.query('id');
        const p = c.req.query('path');
        const ct = c.req.header('content-type') || 'application/octet-stream';
        const sz = Number(c.req.header('content-length') || '0');
        const h = c.req.query('h') || '';
        console.log('Upload params:', { id, path: p, contentType: ct, size: sz });
        if (!id || !p)
            return c.json({ error: 'bad_request', details: 'Missing id or path' }, 400);
        if (p.includes('..'))
            return c.json({ error: 'bad_path', details: 'Path contains invalid characters' }, 400);
        const metaRaw = await c.env.KV_SNAPS.get(`snap:${id}`);
        if (!metaRaw)
            return c.json({ error: 'not_found', details: 'Snapshot not found' }, 404);
        console.log('Raw snapshot data from KV:', metaRaw);
        const meta = JSON.parse(metaRaw);
        console.log('Parsed snapshot meta:', { id: meta.id, ownerUid: meta.ownerUid, caps: meta.caps, hasCaps: !!meta.caps, capsType: typeof meta.caps });
        if (meta.ownerUid !== uid)
            return c.json({ error: 'forbidden', details: 'Not owner of snapshot' }, 403);
        // Defensive check for caps property
        if (!meta.caps || typeof meta.caps !== 'object') {
            console.error('Missing or invalid caps in snapshot metadata:', { id: meta.id, caps: meta.caps });
            // Fallback to default caps if missing
            meta.caps = {
                maxBytes: 20 * 1024 * 1024,
                maxFile: 5 * 1024 * 1024,
                maxDays: 14,
            };
            console.log('Applied fallback caps:', meta.caps);
        }
        if (sz > meta.caps.maxFile)
            return c.json({ error: 'file_too_large', details: `File size ${sz} exceeds limit ${meta.caps.maxFile}` }, 400);
        if (!ALLOW_MIME_PREFIXES.some((prefix) => ct.startsWith(prefix)))
            return c.json({ error: 'type_not_allowed', details: `Content type ${ct} not allowed` }, 400);
        const objectKey = `snap/${id}/${p}`;
        const body = c.req.raw.body;
        if (!body)
            return c.json({ error: 'no_body', details: 'No request body' }, 400);
        console.log('Attempting R2 upload to:', objectKey);
        // Add retry logic for R2 operations to handle rate limiting
        const maxRetriesR2 = 3;
        let retryCountR2 = 0;
        while (retryCountR2 < maxRetriesR2) {
            try {
                await c.env.R2_SNAPSHOTS.put(objectKey, body, { httpMetadata: { contentType: ct } });
                console.log('R2 upload successful');
                return c.json({ ok: true });
            }
            catch (error) {
                retryCountR2++;
                const errorMessage = String(error);
                // Check if this is a rate limiting error
                if (errorMessage.includes('10058') || errorMessage.includes('concurrent request rate') || errorMessage.includes('429')) {
                    if (retryCountR2 < maxRetriesR2) {
                        console.log(`R2 upload rate limited, retrying (${retryCountR2}/${maxRetriesR2})...`);
                        // Wait with exponential backoff: 1s, 2s, 4s
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCountR2 - 1) * 1000));
                        continue;
                    }
                }
                console.error('R2 upload failed:', error);
                return c.json({ error: 'upload_failed', details: errorMessage }, 500);
            }
        }
    }
    catch (error) {
        console.error('Unexpected error in upload endpoint:', error);
        return c.json({ error: 'internal_error', details: String(error) }, 500);
    }
}
