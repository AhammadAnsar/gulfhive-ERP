/**
 * GulfHive ERP - React Auth & Authorization Context
 * Provides client-side session state, permission evaluation (`can`), and token persistence.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

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
  logout: () => Promise<void>;
  can: (permissionCode: string) => boolean;
  hasCompanyAccess: (companyId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserContext | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('gulfhive_session_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session on mount
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = localStorage.getItem('gulfhive_session_token');
      if (!storedToken) {
        // Fallback default admin for local preview
        fetchMe('system');
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(storedToken);
        } else {
          localStorage.removeItem('gulfhive_session_token');
          setToken(null);
          fetchMe('system');
        }
      } catch (err) {
        console.error('Failed to verify session', err);
        fetchMe('system');
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const fetchMe = async (_fallbackMode?: string) => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to fetch default user context', err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Login failed');
      }

      const data = await res.json();
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('gulfhive_session_token', data.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.error('Logout request error', err);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('gulfhive_session_token');
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
