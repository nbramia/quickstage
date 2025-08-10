export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  if (typeof input === 'string') {
    input = new TextEncoder().encode(input);
  }
  const buf = input as ArrayBuffer | Uint8Array;
  const hashBuf = await crypto.subtle.digest('SHA-256', buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const bytes = new Uint8Array(hashBuf);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateIdBase62(numBytes = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(numBytes));
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const val = bytes[i] ?? 0;
    const idx = val % 62;
    out += alphabet.charAt(idx);
  }
  return out;
}

export function randomHex(bytesLen: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLen));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPasswordArgon2id(password: string, saltHex: string): Promise<string> {
  // Use WebCrypto scrypt as placeholder since Argon2 is not natively available in Workers.
  // We will use scrypt-js for portability.
  // Import scrypt-js; ensure it is included in dependencies
  const { scrypt } = await import('scrypt-js');
  const N = 1 << 15;
  const r = 8;
  const p = 1;
  const keyLen = 32;
  const pw = new TextEncoder().encode(password);
  const salt = hexToBytes(saltHex);
  const dk = await scrypt(pw, salt, N, r, p, keyLen);
  return 'scrypt$' + bytesToHex(dk) + '$' + saltHex;
}

export async function verifyPasswordHash(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith('scrypt$')) return false;
  const [, hashHex, saltHex] = hash.split('$');
  if (!saltHex) return false;
  const recomputed = await hashPasswordArgon2id(password, saltHex);
  return recomputed === `scrypt$${hashHex}$${saltHex}`;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export function nowMs(): number {
  return Date.now();
}


