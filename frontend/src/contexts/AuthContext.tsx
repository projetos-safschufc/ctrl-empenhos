import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, AuthUser } from '../api/client';
import { AppCacheContext } from './AppCacheContext';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const appCache = useContext(AppCacheContext);
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? (JSON.parse(s) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    appCache?.invalidateAll();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, [appCache]);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    const { data, status } = await authApi.me();
    if (status === 401) {
      logout();
      setLoading(false);
      return;
    }
    if (data) {
      setUser(data);
      localStorage.setItem(USER_KEY, JSON.stringify(data));
    }
    setLoading(false);
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error, status } = await authApi.login(email, password);
      if (status === 401 || !data) {
        return { ok: false, error: error ?? 'Credenciais inválidas' };
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return { ok: true };
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const { data, error, status } = await authApi.register(email, password, name);
      if (status === 409) {
        return { ok: false, error: 'E-mail já cadastrado' };
      }
      if (status >= 400 || !data) {
        return { ok: false, error: error ?? 'Erro ao cadastrar' };
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return { ok: true };
    },
    []
  );

  const value: AuthContextValue = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
