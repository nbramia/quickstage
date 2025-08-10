// Minimal AWS SigV4 presign for R2 S3 API
// URL format: https://<accountid>.r2.cloudflarestorage.com/<bucket>/<key>
function toISO8601Basic(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}
function hmac(key, data) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']).then((k) => crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
async function hmacChain(key, parts) {
    let k = key.buffer.slice(0);
    for (const p of parts) {
        k = await hmac(k, p);
    }
    return new Uint8Array(k);
}
async function sha256Hex(data) {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(data));
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function presignR2PutURL(params) {
    const { accountId, bucket, key, accessKeyId, secretAccessKey, contentType, expiresSeconds = 600 } = params;
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const method = 'PUT';
    const now = new Date();
    const amzDate = toISO8601Basic(now);
    const datestamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${datestamp}/${region}/${service}/aws4_request`;
    const canonicalUri = `/${bucket}/${encodeURIComponent(key)}`;
    // Build signed headers and canonical headers
    const headers = {
        host: host,
    };
    if (contentType && contentType.trim() !== '') {
        headers['content-type'] = contentType;
    }
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
        .sort()
        .map(k => `${k}:${headers[k]}`)
        .join('\n') + '\n';
    const query = {
        'X-Amz-Algorithm': algorithm,
        'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(expiresSeconds),
        'X-Amz-SignedHeaders': signedHeaders,
    };
    const canonicalQuery = Object.keys(query)
        .sort()
        .map((k) => `${k}=${encodeURIComponent(query[k])}`)
        .join('&');
    const payloadHash = await sha256Hex('');
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;
    const signingKey = await hmacChain(new TextEncoder().encode('AWS4' + secretAccessKey), [datestamp, region, service, 'aws4_request']);
    const sigBuf = await hmac(signingKey.buffer.slice(0), stringToSign);
    const signature = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
