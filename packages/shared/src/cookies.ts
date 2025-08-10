function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return b64;
}

function stringToBase64Url(s: string): string {
  const enc = new TextEncoder();
  return bytesToBase64Url(enc.encode(s));
}

async function hmacSha256Base64Url(message: string, secretBase64: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = base64ToBytes(secretBase64);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function signSession(payload: object, secret: string, ttlSeconds: number): Promise<string> {
  const data = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const json = JSON.stringify(data);
  const b64 = stringToBase64Url(json);
  const sig = await hmacSha256Base64Url(b64, secret);
  return `${b64}.${sig}`;
}

export async function verifySession(token: string, secret: string): Promise<null | any> {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const expected = await hmacSha256Base64Url(b64, secret);
  if (sig !== expected) return null;
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  let json = '';
  for (let i = 0; i < bin.length; i++) json += String.fromCharCode(bin.charCodeAt(i));
  const data = JSON.parse(json);
  if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null;
  return data;
}

export function generatePassword(length = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) {
    const val = buf[i] ?? 0;
    const idx = val % alphabet.length;
    out += alphabet.charAt(idx);
  }
  return out;
}


