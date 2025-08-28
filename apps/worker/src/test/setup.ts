import { vi } from 'vitest';

// Mock global crypto for tests
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
    subtle: {
      digest: vi.fn(async (algorithm, data) => {
        // Mock SHA-256 digest
        return new ArrayBuffer(32);
      }),
    },
  },
  writable: true,
  configurable: true
});

// Mock Cloudflare Workers environment
global.Response = class MockResponse {
  constructor(public body: any, public init?: any) {}
  json() { return Promise.resolve(JSON.parse(this.body)); }
  text() { return Promise.resolve(this.body); }
  arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
} as any;

global.Request = class MockRequest {
  constructor(public url: string, public init?: any) {}
  json() { return Promise.resolve({}); }
  text() { return Promise.resolve(''); }
  header() { return ''; }
} as any;

// Mock console methods to reduce noise in tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});