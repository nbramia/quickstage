import React, { useEffect, useState } from 'react';
import { devLogin } from '../api';

type Snap = { id: string; createdAt: number; expiresAt: number; totalBytes: number; status: string };

export function Dashboard() {
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await devLogin('devuser');
      } catch {}
    })();
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    try {
      const response = await fetch('/api/snapshots/list', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setSnaps(data.snapshots || []);
      }
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async (id: string, days: number = 7) => {
    try {
      const response = await fetch(`/api/snapshots/${id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
        credentials: 'include'
      });
      if (response.ok) {
        await fetchSnapshots(); // Refresh the list
      } else {
        alert('Failed to extend snapshot');
      }
    } catch (error) {
      console.error('Failed to extend snapshot:', error);
      alert('Failed to extend snapshot');
    }
  };

  const handleExpire = async (id: string) => {
    if (!confirm('Are you sure you want to expire this snapshot? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/snapshots/${id}/expire`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        await fetchSnapshots(); // Refresh the list
      } else {
        alert('Failed to expire snapshot');
      }
    } catch (error) {
      console.error('Failed to expire snapshot:', error);
      alert('Failed to expire snapshot');
    }
  };

  const handleView = (id: string) => {
    window.open(`/app/s/${id}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, -apple-system', padding: '40px 20px' }}>
        <div>Loading snapshots...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, -apple-system' }}>
      {/* Navigation Header */}
      <div style={{ 
        borderBottom: '1px solid #ddd', 
        padding: '20px 0', 
        marginBottom: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0 }}>QuickStage</h1>
        <nav style={{ display: 'flex', gap: '16px' }}>
          <a 
            href="/" 
            style={{ 
              color: '#2563eb', 
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              backgroundColor: '#f0f8ff'
            }}
          >
            Dashboard
          </a>
          <a 
            href="/app/settings" 
            style={{ 
              color: '#666', 
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          >
            Settings
          </a>
        </nav>
      </div>

      <p>Manage your staged snapshots.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={async () => {
          const r = await fetch('/api/billing/checkout', { method: 'POST', credentials: 'include' });
          if (!r.ok) { alert('Checkout failed'); return; }
          const j = await r.json();
          if (j.url) window.location.href = j.url;
        }}>Go Pro</button>
      </div>
      <details style={{ marginBottom: 12 }}>
        <summary>Passkey login</summary>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input id="name" placeholder="Display name" />
          <button onClick={beginRegister}>Register</button>
          <button onClick={beginLogin}>Login</button>
        </div>
      </details>
      <div style={{ margin: '12px 0' }}>
        <button onClick={() => devLogin('devuser')}>Dev login</button>
      </div>
      
      {snaps.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          border: '1px solid #eee'
        }}>
          <h3 style={{ color: '#666', marginBottom: '16px' }}>No snapshots yet</h3>
          <p style={{ color: '#888', margin: 0 }}>
            Use the QuickStage extension in VS Code to create your first snapshot.
          </p>
        </div>
      ) : (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th align="left" style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>ID</th>
                <th align="left" style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>Created</th>
                <th align="left" style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>Expires</th>
                <th align="right" style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>Size</th>
                <th align="left" style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>Status</th>
                <th align="center" style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <code style={{ fontSize: '12px' }}>{s.id}</code>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ 
                      color: s.expiresAt < Date.now() + 24 * 60 * 60 * 1000 ? '#dc2626' : '#059669'
                    }}>
                      {new Date(s.expiresAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {Math.round((s.totalBytes || 0) / 1024)} KB
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: s.status === 'active' ? '#dcfce7' : s.status === 'expired' ? '#fee2e2' : '#fef3c7',
                      color: s.status === 'active' ? '#166534' : s.status === 'expired' ? '#991b1b' : '#92400e'
                    }}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleView(s.id)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        View
                      </button>
                      {s.status === 'active' && (
                        <>
                          <button
                            onClick={() => handleExtend(s.id, 7)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              backgroundColor: '#059669',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            +7d
                          </button>
                          <button
                            onClick={() => handleExpire(s.id)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Expire
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function beginRegister() {
  const input = document.getElementById('name') as HTMLInputElement | null;
  const name = input?.value?.trim();
  if (!name) return alert('Enter name');
  const begin = await fetch('/api/auth/register-passkey/begin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), credentials: 'include' }).then((r) => r.json());
  // Using WebAuthn API (simplified for MVP; production needs proper conversions)
  // @ts-ignore
  const cred: any = await navigator.credentials.create({ publicKey: begin });
  const finish = await fetch('/api/auth/register-passkey/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, response: cred }), credentials: 'include' });
  if (!finish.ok) alert('Registration failed');
}

async function beginLogin() {
  const input = document.getElementById('name') as HTMLInputElement | null;
  const name = input?.value?.trim();
  if (!name) return alert('Enter name');
  const begin = await fetch('/api/auth/login-passkey/begin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), credentials: 'include' }).then((r) => r.json());
  // @ts-ignore
  const cred: any = await navigator.credentials.get({ publicKey: begin });
  const finish = await fetch('/api/auth/login-passkey/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, response: cred }), credentials: 'include' });
  if (!finish.ok) alert('Login failed');
}


