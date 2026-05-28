'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, clearTokens } from './api';
import type { User, AuthResponse } from './types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, password2: string, company_name?: string, phone?: string) => Promise<{ email: string; activated: boolean }>;
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
    // Tokens are now in HttpOnly cookies — only persist user info
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (username: string, email: string, password: string, password2: string, company_name?: string, phone?: string) => {
    const resp = await auth.register({ username, email, password, password2, company_name: company_name || '', phone: phone || '' });
    const data = resp.data as any;
    if (data.user) {
      // First user — activated immediately, cookies set by backend
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { email: data.user.email as string, activated: true };
    }
    // Needs email verification
    return { email: data.email as string, activated: false };
  };

  const logout = async () => {
    // Backend reads refresh token from cookie and blacklists it
    try { await auth.logout(''); } catch {}
    clearTokens();
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
