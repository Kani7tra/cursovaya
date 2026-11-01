// Контекст авторизации: текущий пользователь, вход, выход
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';
import type { User } from './types';

export const ROLES = { ADMIN: 1, SMITH: 2, CUSTOMER: 3 } as const;

type AuthState = {
  user: User | null;
  ready: boolean;
  unread: number;
  login: (email: string, password: string) => Promise<User>;
  register: (data: Record<string, string>) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  refreshUnread: () => void;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); return; }
    try { setUser(await api.get<User>('/auth/me')); }
    catch { tokenStore.set(null); setUser(null); }
  }, []);

  const refreshUnread = useCallback(() => {
    if (!tokenStore.get()) return setUnread(0);
    api.get<{ count: number }>('/messages/unread').then((r) => setUnread(r.count)).catch(() => setUnread(0));
  }, []);

  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);

  // Проверка новых сообщений раз в 20 секунд (уведомления)
  useEffect(() => {
    if (!user || user.role_id === ROLES.ADMIN) return;
    refreshUnread();
    const t = window.setInterval(refreshUnread, 20000);
    return () => window.clearInterval(t);
  }, [user, refreshUnread]);

  const login = async (email: string, password: string) => {
    const r = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    tokenStore.set(r.token);
    setUser(r.user);
    return r.user;
  };

  const register = async (data: Record<string, string>) => {
    const r = await api.post<{ token: string; user: User }>('/auth/register', data);
    tokenStore.set(r.token);
    setUser(r.user);
    return r.user;
  };

  const logout = () => { tokenStore.set(null); setUser(null); setUnread(0); };

  return (
    <AuthContext.Provider value={{ user, ready, unread, login, register, logout, refresh, refreshUnread, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
