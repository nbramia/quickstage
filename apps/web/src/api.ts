const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://quickstage-worker.nbramia.workers.dev').replace(/\/$/, '');

// Global session token storage
let globalSessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  globalSessionToken = token;
}

export function getSessionToken() {
  return globalSessionToken;
}

export async function devLogin(uid: string) {
  const res = await fetch(`${BASE_URL}/auth/dev-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid }), credentials: 'include' });
  if (!res.ok) throw new Error('login failed');
}

// API client for making authenticated requests
export const api = {
  async get(endpoint: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add session token if available
    if (globalSessionToken) {
      headers['Authorization'] = `Bearer ${globalSessionToken}`;
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      credentials: 'include',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },

  async post(endpoint: string, data?: any) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add session token if available
    if (globalSessionToken) {
      headers['Authorization'] = `Bearer ${globalSessionToken}`;
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    
    // Extract session token from Set-Cookie header for auth endpoints
    if (endpoint.includes('/auth/') && response.ok) {
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const tokenMatch = setCookie.match(/ps_sess=([^;]+)/);
        if (tokenMatch && tokenMatch[1]) {
          globalSessionToken = tokenMatch[1];
        }
      }
    }
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },

  async put(endpoint: string, data?: any) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add session token if available
    if (globalSessionToken) {
      headers['Authorization'] = `Bearer ${globalSessionToken}`;
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      credentials: 'include',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },

  async delete(endpoint: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add session token if available
    if (globalSessionToken) {
      headers['Authorization'] = `Bearer ${globalSessionToken}`;
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },
};

