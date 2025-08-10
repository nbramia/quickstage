import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';
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
    const logout = () => {
        // Clear session by setting cookie to expired
        document.cookie = 'ps_sess=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        setUser(null);
        setError(null);
    };
    const clearError = () => {
        setError(null);
    };
    useEffect(() => {
        // Check if user is already authenticated
        if (document.cookie.includes('ps_sess=')) {
            refreshUser();
        }
        else {
            setLoading(false);
        }
    }, []);
    const value = {
        user,
        loading,
        error,
        login,
        logout,
        refreshUser,
        clearError,
        isAuthenticated: !!user,
    };
    return (_jsx(AuthContext.Provider, { value: value, children: children }));
}
