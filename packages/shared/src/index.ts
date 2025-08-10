export type SnapshotFile = {
  p: string; // path
  ct: string; // content-type
  sz: number; // size bytes
  h: string; // sha256 hex
};

export type SnapshotCaps = {
  maxBytes: number;
  maxFile: number;
  maxDays: number;
};

export type SnapshotMetadata = {
  id: string;
  ownerUid: string;
  createdAt: number;
  expiresAt: number;
  passwordHash: string;
  totalBytes: number;
  files: SnapshotFile[];
  views: { m: string; n: number };
  commentsCount: number;
  public: boolean;
  spaFallback?: boolean;
  caps: SnapshotCaps;
  status?: 'creating' | 'active' | 'expired';
};

export const DEFAULT_CAPS: SnapshotCaps = {
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


