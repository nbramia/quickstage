const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://quickstage.tech/api').replace(/\/$/, '');
// Global session token storage - not needed since we use httpOnly cookies
let globalSessionToken = null;
export function setSessionToken(token) {
    globalSessionToken = token;
}
export function getSessionToken() {
    // Since cookies are httpOnly, we can't access them from JavaScript
    // The backend will handle authentication via cookies automatically
    return null;
}
export async function devLogin(uid) {
    const res = await fetch(`${BASE_URL}/auth/dev-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid }), credentials: 'include' });
    if (!res.ok)
        throw new Error('login failed');
}
// API client for making authenticated requests
export const api = {
    async get(endpoint) {
        const headers = {
            'Content-Type': 'application/json',
        };
        // No need to manually add Authorization header - cookies handle auth
        console.log('Making request to:', `${BASE_URL}${endpoint}`);
        console.log('Headers:', headers);
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            credentials: 'include',
            headers,
        });
        if (!response.ok) {
            console.error('Request failed:', response.status, response.statusText);
            throw new Error(`API request failed: ${response.status}`);
        }
        return response.json();
    },
    async post(endpoint, data) {
        const headers = {
            'Content-Type': 'application/json',
        };
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: data ? JSON.stringify(data) : undefined,
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        return response.json();
    },
    async put(endpoint, data) {
        const headers = {
            'Content-Type': 'application/json',
        };
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
    async delete(endpoint) {
        const headers = {
            'Content-Type': 'application/json',
        };
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
