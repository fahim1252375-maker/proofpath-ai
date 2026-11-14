import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setCsrfToken } from '../lib/api';
import type { SafeUser, StudentProfile } from '../types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface AuthContextValue {
  user: SafeUser | null;
  profile: StudentProfile | null;
  unreadNotifications: number;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  refreshSession: () => Promise<void>;
  setProfileState: (p: StudentProfile | null) => void;
  setUnreadNotifications: React.Dispatch<React.SetStateAction<number>>;
  logout: () => Promise<void>;
  toasts: ToastMessage[];
  addToast: (t: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('proofpath_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('proofpath_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const addToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiRequest<{
        user: SafeUser | null;
        csrfToken: string | null;
        unreadNotifications: number;
        profile: StudentProfile | null;
      }>('/api/auth/me');
      setUser(data.user);
      setCsrfToken(data.csrfToken);
      setUnreadNotifications(data.unreadNotifications || 0);
      setProfile(data.profile || null);
    } catch {
      setUser(null);
      setCsrfToken(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setUser(null);
    setProfile(null);
    setCsrfToken(null);
    setUnreadNotifications(0);
    addToast({ type: 'info', title: 'Signed out successfully' });
  }, [addToast]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        unreadNotifications,
        loading,
        theme,
        toggleTheme,
        refreshSession,
        setProfileState: setProfile,
        setUnreadNotifications,
        logout,
        toasts,
        addToast,
        dismissToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
