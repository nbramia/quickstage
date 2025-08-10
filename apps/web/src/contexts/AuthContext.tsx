import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api';

type UserPlan = 'free' | 'pro';

interface User {
  uid: string;
  plan: UserPlan;
  createdAt: number;
  lastLoginAt?: number;
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
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
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
    } else {
      setLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    refreshUser,
    clearError,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
