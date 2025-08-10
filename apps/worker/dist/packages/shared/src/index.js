export const DEFAULT_CAPS = {
    maxBytes: 20 * 1024 * 1024,
    maxFile: 5 * 1024 * 1024,
    maxDays: 14,
};
export const ALLOW_MIME_PREFIXES = [
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/json',
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/gif',
    'image/webp',
    'font/woff2',
    'application/wasm',
];
export const VIEWER_COOKIE_PREFIX = 'ps_gate_';
export const SESSION_COOKIE_NAME = 'ps_sess';
