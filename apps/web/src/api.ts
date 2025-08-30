import { config } from './config';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || config.WORKER_BASE_URL).replace(/\/$/, '');

// Global session token storage for cross-origin requests
let globalSessionToken: string | null = localStorage.getItem('quickstage_session_token');

export function setSessionToken(token: string | null) {
  globalSessionToken = token;
  if (token) {
    localStorage.setItem('quickstage_session_token', token);
  } else {
    localStorage.removeItem('quickstage_session_token');
  }
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
    
    // Add Authorization header for cross-origin requests
    const token = getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    console.log('Making request to:', `${BASE_URL}${endpoint}`);
    console.log('Headers:', headers);
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      credentials: 'include',
      headers,
    });
    
    if (!response.ok) {
      console.error('Request failed:', response.status, response.statusText);
      
      // Handle authentication errors by clearing invalid tokens
      if (response.status === 401) {
        console.log('Token invalid, clearing session...');
        setSessionToken(null);
        // Redirect to login page
        window.location.href = '/login';
        throw new Error('Authentication failed - please log in again');
      }
      
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`API GET ${endpoint} response:`, data);
    return data;
  },

  async post(endpoint: string, data?: any) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add Authorization header for cross-origin requests
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
    
    if (!response.ok) {
      // Handle authentication errors by clearing invalid tokens
      if (response.status === 401) {
        console.log('Token invalid, clearing session...');
        setSessionToken(null);
        // Redirect to login page
        window.location.href = '/login';
        throw new Error('Authentication failed - please log in again');
      }
      
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },

  async put(endpoint: string, data?: any) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add Authorization header for cross-origin requests
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
      // Handle authentication errors by clearing invalid tokens
      if (response.status === 401) {
        console.log('Token invalid, clearing session...');
        setSessionToken(null);
        // Redirect to login page
        window.location.href = '/login';
        throw new Error('Authentication failed - please log in again');
      }
      
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },

  async delete(endpoint: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add Authorization header for cross-origin requests
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
      // Handle authentication errors by clearing invalid tokens
      if (response.status === 401) {
        console.log('Token invalid, clearing session...');
        setSessionToken(null);
        // Redirect to login page
        window.location.href = '/login';
        throw new Error('Authentication failed - please log in again');
      }
      
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return response.json();
  },
};

// Admin-specific API functions
export const adminApi = {
  async deleteUser(uid: string) {
    return api.delete(`/admin/users/${uid}`);
  },
  
  async deactivateUser(uid: string) {
    return api.post(`/admin/users/${uid}/deactivate`);
  },
  
  async activateUser(uid: string) {
    return api.post(`/admin/users/${uid}/activate`);
  },
  
  async cleanupCorruptedUsers() {
    return api.post('/admin/cleanup-corrupted-users');
  }
};

