// MIME type utilities for file type detection
export const MIME_TYPES = {
    // HTML
    '.html': 'text/html',
    '.htm': 'text/html',
    // CSS
    '.css': 'text/css',
    // JavaScript
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    // JSON
    '.json': 'application/json',
    // Images
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    // Fonts
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    // Other
    '.wasm': 'application/wasm',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.xml': 'application/xml',
};
export function getMimeType(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return MIME_TYPES[ext] || 'application/octet-stream';
}
export function isAllowedMimeType(mimeType) {
    const allowedPrefixes = [
        'text/',
        'application/javascript',
        'application/json',
        'image/',
        'font/',
        'application/wasm'
    ];
    return allowedPrefixes.some(prefix => mimeType.startsWith(prefix));
}
