import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
import { api, setSessionToken } from '../api';
const AuthContext = createContext(undefined);
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refreshUser = async () => {
        try {
            setError(null);
            setLoading(true);
            const response = await api.get('/me');
            if (response.user) {
                setUser(response.user);
            }
            else {
                setUser(null);
            }
        }
        catch (error) {
            console.error('Failed to fetch user:', error);
            setUser(null);
            // Don't set error for failed auth check - user might just not be logged in
        }
        finally {
            setLoading(false);
        }
    };
    const login = async (uid) => {
        try {
            setError(null);
            setLoading(true);
            await api.post('/auth/dev-login', { uid });
            await refreshUser();
        }
        catch (error) {
            const errorMessage = error.message || 'Login failed';
            setError(errorMessage);
            setUser(null);
            throw error;
        }
        finally {
            setLoading(false);
        }
    };
    const loginWithEmailPassword = async (email, password) => {
        try {
            setError(null);
            setLoading(true);
            const response = await api.post('/auth/login', { email, password });
            if (response.ok && response.user) {
                // Store session token for cross-origin requests
                if (response.sessionToken) {
                    setSessionToken(response.sessionToken);
                }
                // Get complete user data from /me endpoint
                await refreshUser();
            }
            else {
                await refreshUser();
            }
        }
        catch (error) {
            const errorMessage = error.message || 'Login failed';
            setError(errorMessage);
            setUser(null);
            throw error;
        }
        finally {
            setLoading(false);
        }
    };
    const loginWithGoogle = async (idToken) => {
        try {
            setError(null);
            setLoading(true);
            const response = await api.post('/auth/google', { idToken });
            if (response.ok && response.user) {
                // Store session token for cross-origin requests
                if (response.sessionToken) {
                    setSessionToken(response.sessionToken);
                }
                // Get complete user data from /me endpoint
                await refreshUser();
            }
            else {
                await refreshUser();
            }
        }
        catch (error) {
            const errorMessage = error.message || 'Google login failed';
            setError(errorMessage);
            setUser(null);
            throw error;
        }
        finally {
            setLoading(false);
        }
    };
    const registerWithEmailPassword = async (email, password, name) => {
        try {
            setError(null);
            setLoading(true);
            const response = await api.post('/auth/register', { email, password, name });
            if (response.ok && response.user) {
                // Store session token for cross-origin requests
                if (response.sessionToken) {
                    setSessionToken(response.sessionToken);
                }
                // Get complete user data from /me endpoint
                await refreshUser();
            }
            else {
                await refreshUser();
            }
        }
        catch (error) {
            const errorMessage = error.message || 'Registration failed';
            setError(errorMessage);
            setUser(null);
            throw error;
        }
        finally {
            setLoading(false);
        }
    };
    const logout = async () => {
        try {
            setError(null);
            // Call backend logout endpoint to clear session
            await api.post('/auth/logout');
        }
        catch (error) {
            console.error('Logout error:', error);
            // Continue with logout even if backend call fails
        }
        finally {
            // Clear session token only
            setSessionToken(null);
            setUser(null);
            setError(null);
        }
    };
    const updateProfile = async (updates) => {
        try {
            setError(null);
            setLoading(true);
            await api.put('/auth/profile', updates);
            await refreshUser();
        }
        catch (error) {
            const errorMessage = error.message || 'Profile update failed';
            setError(errorMessage);
            throw error;
        }
        finally {
            setLoading(false);
        }
    };
    const changePassword = async (currentPassword, newPassword) => {
        try {
            setError(null);
            setLoading(true);
            await api.post('/auth/change-password', { currentPassword, newPassword });
        }
        catch (error) {
            const errorMessage = error.message || 'Password change failed';
            setError(errorMessage);
            throw error;
        }
        finally {
            setLoading(false);
        }
    };
    const cancelSubscription = async () => {
        try {
            setError(null);
            setLoading(true);
            const response = await api.post('/billing/cancel');
            if (response.ok) {
                await refreshUser();
                return { ok: true, message: response.message || 'Subscription cancelled successfully.' };
            }
            else {
                return { ok: false, error: response.message || 'Failed to cancel subscription.' };
            }
        }
        catch (error) {
            const errorMessage = error.message || 'Subscription cancellation failed';
            setError(errorMessage);
            return { ok: false, error: errorMessage };
        }
        finally {
            setLoading(false);
        }
    };
    const clearError = () => {
        setError(null);
    };
    useEffect(() => {
        // Check if user is already authenticated via localStorage token
        const existingToken = localStorage.getItem('quickstage_session_token');
        if (existingToken) {
            // Token exists, try to refresh user data
            refreshUser();
        }
        else {
            // No token found, user is not authenticated
            setLoading(false);
        }
    }, []);
    const value = {
        user,
        loading,
        error,
        login,
        loginWithEmailPassword,
        loginWithGoogle,
        registerWithEmailPassword,
        logout,
        refreshUser,
        clearError,
        isAuthenticated: !!user,
        updateProfile,
        changePassword,
        cancelSubscription,
    };
    return (_jsx(AuthContext.Provider, { value: value, children: children }));
}
