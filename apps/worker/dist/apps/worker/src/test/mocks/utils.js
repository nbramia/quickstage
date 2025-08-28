import { vi } from 'vitest';
// Mock all utility functions used in tests
export const generateIdBase62 = vi.fn(() => 'mock_id_123');
export const hashPasswordArgon2id = vi.fn(() => 'mock_hash');
export const verifyPasswordHash = vi.fn(() => true);
export const randomHex = vi.fn(() => 'mock_hex_123');
export const nowMs = vi.fn(() => 1756391518443);
// Mock the entire utils module
vi.mock('../../utils', () => ({
    generateIdBase62: vi.fn(() => 'mock_id_123'),
    hashPasswordArgon2id: vi.fn(() => 'mock_hash'),
    verifyPasswordHash: vi.fn(() => true),
    randomHex: vi.fn(() => 'mock_hex_123'),
    nowMs: vi.fn(() => 1756391518443),
}));
