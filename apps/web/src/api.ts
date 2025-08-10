export async function devLogin(uid: string) {
  const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid }), credentials: 'include' });
  if (!res.ok) throw new Error('login failed');
}

