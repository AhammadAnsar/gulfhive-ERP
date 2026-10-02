/**
 * GulfHive ERP - React Auth & Authorization Context
 * Provides client-side session state, permission evaluation (`can`), and token persistence.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../../lib/api-client';

export interface UserContext {
  userId: number;
  uid: string;
  email: string;
  displayName: string | null;
  activeCompanyId: string;
  activeBranchId: string | null;
  roles: string[];
  permissions: string[];
  dataScopes: Record<string, string>;
  authorizedCompanyIds: string[];
  authorizedBranchIds: string[];
}

interface AuthContextType {
  user: UserContext | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  setAuthSession: (user: UserContext, token: string) => void;
  switchCompany: (companyId: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permissionCode: string) => boolean;
  hasCompanyAccess: (companyId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserContext | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('gulfhive_session_token');
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session on mount
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('gulfhive_session_token') : null;
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      try {
        const data = await apiClient.get('/api/auth/me');
        if (data && data.user) {
          setUser(data.user);
          setToken(storedToken);
        } else {
          localStorage.removeItem('gulfhive_session_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('[GulfHive Auth] Active session verification rejected:', err);
        localStorage.removeItem('gulfhive_session_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Listen for unauthorized 401 events dispatched by API client
    const handleUnauthorized = () => {
      console.warn('[GulfHive Auth] Received 401 Unauthorized event. Clearing session.');
      setUser(null);
      setToken(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('gulfhive_session_token');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('gulfhive:unauthorized', handleUnauthorized);
      return () => {
        window.removeEventListener('gulfhive:unauthorized', handleUnauthorized);
      };
    }
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiClient.post('/api/auth/login', { username, password });
      if (!data || !data.token || !data.user) {
        throw new Error('Invalid login response from server.');
      }
      setUser(data.user);
      setToken(data.token);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('gulfhive_session_token', data.token);
      }
    } catch (err: any) {
      throw new Error(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const setAuthSession = (newUser: UserContext, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gulfhive_session_token', newToken);
    }
    setIsLoading(false);
  };

  const switchCompany = async (companyId: string) => {
    if (!user || !user.authorizedCompanyIds.includes(companyId)) {
      throw new Error('Access denied to requested company context.');
    }
    setUser((prev) => (prev ? { ...prev, activeCompanyId: companyId } : null));
  };

  const logout = async () => {
    try {
      if (token) {
        await apiClient.post('/api/auth/logout');
      }
    } catch (err) {
      console.warn('[GulfHive Auth] Logout request error', err);
    } finally {
      setUser(null);
      setToken(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('gulfhive_session_token');
      }
    }
  };

  const can = (permissionCode: string): boolean => {
    if (!user) return false;
    if (user.roles.includes('COMPANY_ADMIN') || user.roles.includes('SUPER_ADMIN')) return true;
    return user.permissions.includes(permissionCode);
  };

  const hasCompanyAccess = (companyId: string): boolean => {
    if (!user) return false;
    if (user.roles.includes('SUPER_ADMIN')) return true;
    return user.authorizedCompanyIds.includes(companyId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        setAuthSession,
        switchCompany,
        can,
        hasCompanyAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
