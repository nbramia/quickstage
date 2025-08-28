import { Context } from 'hono';

// Request validation utilities
export function validateRequired(fields: Record<string, any>, requiredFields: string[]): { valid: boolean; missing?: string[] } {
  const missing = requiredFields.filter(field => !fields[field]);
  return { valid: missing.length === 0, missing: missing.length > 0 ? missing : undefined };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  return { valid: true };
}

export function parseLimit(limitStr: string | undefined, defaultLimit: number = 100, maxLimit: number = 1000): number {
  if (!limitStr) return defaultLimit;
  const limit = parseInt(limitStr);
  if (isNaN(limit) || limit <= 0) return defaultLimit;
  return Math.min(limit, maxLimit);
}

export function parseExpiryDays(days: any, defaultDays: number = 7, maxDays: number = 365): number {
  const parsed = Number(days);
  if (isNaN(parsed) || parsed < 1) return defaultDays;
  return Math.min(parsed, maxDays);
}