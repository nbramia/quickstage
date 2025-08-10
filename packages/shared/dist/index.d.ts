export type SnapshotFile = {
    p: string;
    ct: string;
    sz: number;
    h: string;
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
    views: {
        m: string;
        n: number;
    };
    commentsCount: number;
    public: boolean;
    spaFallback?: boolean;
    caps: SnapshotCaps;
    status?: 'creating' | 'active' | 'expired';
};
export declare const DEFAULT_CAPS: SnapshotCaps;
export declare const ALLOW_MIME_PREFIXES: string[];
export declare const VIEWER_COOKIE_PREFIX = "ps_gate_";
export declare const SESSION_COOKIE_NAME = "ps_sess";
