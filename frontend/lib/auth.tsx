'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, setTokens, clearTokens } from './api';
import type { User, AuthResponse } from './types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, password2: string) => Promise<{ email: string; activated: boolean }>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const resp = await auth.login({ username, password });
    const data: AuthResponse = resp.data;
    setTokens(data.access, data.refresh);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (username: string, email: string, password: string, password2: string) => {
    const resp = await auth.register({ username, email, password, password2 });
    const data = resp.data as any;
    if (data.access) {
      // First user — activated immediately
      setTokens(data.access, data.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { email: data.user.email as string, activated: true };
    }
    // Needs email verification
    return { email: data.email as string, activated: false };
  };

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token') || '';
    try { await auth.logout(refresh); } catch {}
    clearTokens();
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (updated: User) => {
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      isAuthenticated: !!user,
      login, register, logout,
      setUser: updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
