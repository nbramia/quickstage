import { z } from 'zod';

export const SnapshotFileSchema = z.object({
  p: z.string(),
  ct: z.string(),
  sz: z.number().int().nonnegative(),
  h: z.string().min(32),
});

export const SnapshotCapsSchema = z.object({
  maxBytes: z.number().int().positive(),
  maxFile: z.number().int().positive(),
  maxDays: z.number().int().positive(),
});

export const SnapshotMetadataSchema = z.object({
  id: z.string(),
  ownerUid: z.string(),
  createdAt: z.number().int(),
  expiresAt: z.number().int(),
  passwordHash: z.string(),
  totalBytes: z.number().int(),
  files: z.array(SnapshotFileSchema),
  views: z.object({ m: z.string(), n: z.number().int() }),
  commentsCount: z.number().int(),
  public: z.boolean(),
  caps: SnapshotCapsSchema,
  status: z.enum(['creating', 'active', 'expired']).optional(),
});

// Snapshot creation schema
export const CreateSnapshotBodySchema = z.object({
  expiryDays: z.number().min(1).max(90).optional().default(7),
  password: z.string().optional(),
  public: z.boolean().optional().default(false),
});

// Snapshot finalization schema
export const FinalizeSnapshotBodySchema = z.object({
  id: z.string(),
  totalBytes: z.number().positive(),
  files: z.array(z.object({
    p: z.string(), // path
    ct: z.string(), // content-type
    sz: z.number().positive(), // size
    h: z.string(), // sha256 hash
  })),
});

// Comment submission schema
export const CommentSubmissionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(1000),
  nick: z.string().max(40).optional(),
});

// Password verification schema
export const PasswordVerificationSchema = z.object({
  password: z.string().min(1),
});

// User authentication schema
export const UserAuthSchema = z.object({
  name: z.string().min(1).max(100),
});

// WebAuthn response schema
export const WebAuthnResponseSchema = z.object({
  name: z.string(),
  response: z.any(), // WebAuthn credential
});

export type CreateSnapshotBody = z.infer<typeof CreateSnapshotBodySchema>;
export type FinalizeSnapshotBody = z.infer<typeof FinalizeSnapshotBodySchema>;
export type CommentSubmission = z.infer<typeof CommentSubmissionSchema>;
export type PasswordVerification = z.infer<typeof PasswordVerificationSchema>;
export type UserAuth = z.infer<typeof UserAuthSchema>;
export type WebAuthnResponse = z.infer<typeof WebAuthnResponseSchema>;


