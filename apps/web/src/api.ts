export async function devLogin(uid: string) {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/dev-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid }), credentials: 'include' });
  if (!res.ok) throw new Error('login failed');
}

// API client for making authenticated requests
export const api = {
  async get(endpoint: string) {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },

  async post(endpoint: string, data?: any) {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },

  async put(endpoint: string, data?: any) {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },

  async delete(endpoint: string) {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },
};

