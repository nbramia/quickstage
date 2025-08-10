import { z } from 'zod';
export declare const SnapshotFileSchema: z.ZodObject<{
    p: z.ZodString;
    ct: z.ZodString;
    sz: z.ZodNumber;
    h: z.ZodString;
}, "strip", z.ZodTypeAny, {
    p: string;
    ct: string;
    sz: number;
    h: string;
}, {
    p: string;
    ct: string;
    sz: number;
    h: string;
}>;
export declare const SnapshotCapsSchema: z.ZodObject<{
    maxBytes: z.ZodNumber;
    maxFile: z.ZodNumber;
    maxDays: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    maxBytes: number;
    maxFile: number;
    maxDays: number;
}, {
    maxBytes: number;
    maxFile: number;
    maxDays: number;
}>;
export declare const SnapshotMetadataSchema: z.ZodObject<{
    id: z.ZodString;
    ownerUid: z.ZodString;
    createdAt: z.ZodNumber;
    expiresAt: z.ZodNumber;
    passwordHash: z.ZodString;
    totalBytes: z.ZodNumber;
    files: z.ZodArray<z.ZodObject<{
        p: z.ZodString;
        ct: z.ZodString;
        sz: z.ZodNumber;
        h: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        p: string;
        ct: string;
        sz: number;
        h: string;
    }, {
        p: string;
        ct: string;
        sz: number;
        h: string;
    }>, "many">;
    views: z.ZodObject<{
        m: z.ZodString;
        n: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        m: string;
        n: number;
    }, {
        m: string;
        n: number;
    }>;
    commentsCount: z.ZodNumber;
    public: z.ZodBoolean;
    caps: z.ZodObject<{
        maxBytes: z.ZodNumber;
        maxFile: z.ZodNumber;
        maxDays: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxBytes: number;
        maxFile: number;
        maxDays: number;
    }, {
        maxBytes: number;
        maxFile: number;
        maxDays: number;
    }>;
    status: z.ZodOptional<z.ZodEnum<["creating", "active", "expired"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    ownerUid: string;
    createdAt: number;
    expiresAt: number;
    passwordHash: string;
    totalBytes: number;
    files: {
        p: string;
        ct: string;
        sz: number;
        h: string;
    }[];
    views: {
        m: string;
        n: number;
    };
    commentsCount: number;
    public: boolean;
    caps: {
        maxBytes: number;
        maxFile: number;
        maxDays: number;
    };
    status?: "creating" | "active" | "expired" | undefined;
}, {
    id: string;
    ownerUid: string;
    createdAt: number;
    expiresAt: number;
    passwordHash: string;
    totalBytes: number;
    files: {
        p: string;
        ct: string;
        sz: number;
        h: string;
    }[];
    views: {
        m: string;
        n: number;
    };
    commentsCount: number;
    public: boolean;
    caps: {
        maxBytes: number;
        maxFile: number;
        maxDays: number;
    };
    status?: "creating" | "active" | "expired" | undefined;
}>;
export declare const CreateSnapshotBodySchema: z.ZodObject<{
    expiryDays: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    password: z.ZodOptional<z.ZodString>;
    public: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    public: boolean;
    expiryDays: number;
    password?: string | undefined;
}, {
    public?: boolean | undefined;
    expiryDays?: number | undefined;
    password?: string | undefined;
}>;
export declare const FinalizeSnapshotBodySchema: z.ZodObject<{
    id: z.ZodString;
    totalBytes: z.ZodNumber;
    files: z.ZodArray<z.ZodObject<{
        p: z.ZodString;
        ct: z.ZodString;
        sz: z.ZodNumber;
        h: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        p: string;
        ct: string;
        sz: number;
        h: string;
    }, {
        p: string;
        ct: string;
        sz: number;
        h: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    totalBytes: number;
    files: {
        p: string;
        ct: string;
        sz: number;
        h: string;
    }[];
}, {
    id: string;
    totalBytes: number;
    files: {
        p: string;
        ct: string;
        sz: number;
        h: string;
    }[];
}>;
export declare const CommentSubmissionSchema: z.ZodObject<{
    id: z.ZodString;
    text: z.ZodString;
    nick: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    text: string;
    nick?: string | undefined;
}, {
    id: string;
    text: string;
    nick?: string | undefined;
}>;
export declare const PasswordVerificationSchema: z.ZodObject<{
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
}, {
    password: string;
}>;
export declare const UserAuthSchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export declare const WebAuthnResponseSchema: z.ZodObject<{
    name: z.ZodString;
    response: z.ZodAny;
}, "strip", z.ZodTypeAny, {
    name: string;
    response?: any;
}, {
    name: string;
    response?: any;
}>;
export type CreateSnapshotBody = z.infer<typeof CreateSnapshotBodySchema>;
export type FinalizeSnapshotBody = z.infer<typeof FinalizeSnapshotBodySchema>;
export type CommentSubmission = z.infer<typeof CommentSubmissionSchema>;
export type PasswordVerification = z.infer<typeof PasswordVerificationSchema>;
export type UserAuth = z.infer<typeof UserAuthSchema>;
export type WebAuthnResponse = z.infer<typeof WebAuthnResponseSchema>;
