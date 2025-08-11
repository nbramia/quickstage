const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://quickstage-worker.nbramia.workers.dev').replace(/\/$/, '');

// Global session token storage
let globalSessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  globalSessionToken = token;
}

export function getSessionToken() {
  // If no global token, try to extract from cookies as fallback
  if (!globalSessionToken) {
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(cookie => cookie.trim().startsWith('ps_sess='));
    if (sessionCookie) {
      const token = sessionCookie.split('=')[1];
      if (token) {
        globalSessionToken = token;
      }
    }
  }
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
    const token = getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
    const token = getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    
    // Extract session token from cookies for auth endpoints
    if (endpoint.includes('/auth/') && response.ok) {
      const cookies = document.cookie.split(';');
      const sessionCookie = cookies.find(cookie => cookie.trim().startsWith('ps_sess='));
      if (sessionCookie) {
        const token = sessionCookie.split('=')[1];
        if (token) {
          globalSessionToken = token;
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
    const token = getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
    const token = getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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

