import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api';

type UserPlan = 'free' | 'pro';

interface User {
  uid: string;
  email: string;
  name: string;
  plan: UserPlan;
  createdAt: number;
  lastLoginAt?: number;
  hasPasskeys?: boolean;
  hasPassword?: boolean;
  hasGoogle?: boolean;
  passkeys?: Array<{
    id: string;
    publicKey: string;
    counter: number;
    transports?: string[];
  }>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (uid: string) => Promise<void>;
  loginWithEmailPassword: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  registerWithEmailPassword: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
  updateProfile: (updates: { name?: string; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  removePasskey: (credentialId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await api.get('/me');
      if (response.user) {
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch (error: any) {
      console.error('Failed to fetch user:', error);
      setUser(null);
      // Don't set error for failed auth check - user might just not be logged in
    } finally {
      setLoading(false);
    }
  };

  const login = async (uid: string) => {
    try {
      setError(null);
      setLoading(true);
      await api.post('/auth/dev-login', { uid });
      await refreshUser();
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      setError(errorMessage);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmailPassword = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      const response = await api.post('/auth/login', { email, password });
      if (response.user) {
        setUser(response.user);
      } else {
        await refreshUser();
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      setError(errorMessage);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    try {
      setError(null);
      setLoading(true);
      const response = await api.post('/auth/google', { idToken });
      if (response.user) {
        setUser(response.user);
      } else {
        await refreshUser();
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Google login failed';
      setError(errorMessage);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmailPassword = async (email: string, password: string, name: string) => {
    try {
      setError(null);
      setLoading(true);
      const response = await api.post('/auth/register', { email, password, name });
      if (response.user) {
        setUser(response.user);
      } else {
        await refreshUser();
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed';
      setError(errorMessage);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      // Call backend logout endpoint to clear session
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with logout even if backend call fails
    } finally {
      // Clear session by setting cookie to expired
      document.cookie = 'ps_sess=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      setUser(null);
      setError(null);
    }
  };

  const updateProfile = async (updates: { name?: string; email?: string }) => {
    try {
      setError(null);
      setLoading(true);
      await api.put('/auth/profile', updates);
      await refreshUser();
    } catch (error: any) {
      const errorMessage = error.message || 'Profile update failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setError(null);
      setLoading(true);
      await api.post('/auth/change-password', { currentPassword, newPassword });
    } catch (error: any) {
      const errorMessage = error.message || 'Password change failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removePasskey = async (credentialId: string) => {
    try {
      setError(null);
      setLoading(true);
      await api.delete(`/auth/passkeys/${credentialId}`);
      await refreshUser();
    } catch (error: any) {
      const errorMessage = error.message || 'Passkey removal failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    // Check if user is already authenticated
    if (document.cookie.includes('ps_sess=')) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, []);

  const value: AuthContextType = {
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
    removePasskey,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
