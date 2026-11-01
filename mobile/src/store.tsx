// Состояние приложения: пользователь, навигация (стек экранов), уведомления
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler } from 'react-native';
import { api, loadSettings, setToken, ROLES, type User } from './api';

export type Route = { name: string; params?: any };

type Store = {
  ready: boolean;
  user: User | null;
  unread: number;
  stack: Route[];
  toast: { text: string; kind: 'ok' | 'error' } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, string>) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;
  refreshUnread: () => void;
  push: (name: string, params?: any) => void;
  back: () => boolean;
  reset: (name: string, params?: any) => void;
  notify: (text: string, kind?: 'ok' | 'error') => void;
};

const Ctx = createContext<Store>(null as unknown as Store);
export const useStore = () => useContext(Ctx);

export const homeFor = (u: User | null) => (u?.role_id === ROLES.SMITH ? 'SmithOrders' : 'Catalog');

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUserState] = useState<User | null>(null);
  const [unread, setUnread] = useState(0);
  const [stack, setStack] = useState<Route[]>([{ name: 'Login' }]);
  const [toast, setToast] = useState<Store['toast']>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUnread = useRef(0);

  const notify = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const push = useCallback((name: string, params?: any) => setStack((s) => [...s, { name, params }]), []);
  const reset = useCallback((name: string, params?: any) => setStack([{ name, params }]), []);
  const back = useCallback(() => {
    let handled = false;
    setStack((s) => { if (s.length > 1) { handled = true; return s.slice(0, -1); } return s; });
    return handled;
  }, []);

  const enter = (u: User) => {
    if (u.role_id === ROLES.ADMIN) throw new Error('Администратор работает через веб-приложение');
    setUserState(u);
    reset(homeFor(u));
  };

  // Восстановление сессии при запуске
  useEffect(() => {
    (async () => {
      const { token } = await loadSettings();
      if (token) {
        try { enter(await api.get<User>('/auth/me')); }
        catch { await setToken(null); }
      }
      setReady(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Аппаратная кнопка «Назад» на Android
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (stack.length > 1 ? (back(), true) : false));
    return () => sub.remove();
  }, [stack.length, back]);

  const refreshUnread = useCallback(() => {
    api.get<{ count: number }>('/messages/unread').then((r) => {
      if (r.count > lastUnread.current) notify('🔔 Новое сообщение или изменение статуса заказа');
      lastUnread.current = r.count;
      setUnread(r.count);
    }).catch(() => {});
  }, [notify]);

  // Уведомления: проверка новых сообщений каждые 15 секунд
  useEffect(() => {
    if (!user) return;
    api.get<{ count: number }>('/messages/unread').then((r) => { lastUnread.current = r.count; setUnread(r.count); }).catch(() => {});
    const t = setInterval(refreshUnread, 15000);
    return () => clearInterval(t);
  }, [user, refreshUnread]);

  const login = async (email: string, password: string) => {
    const r = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    if (r.user.role_id === ROLES.ADMIN) throw new Error('Администратор работает через веб-приложение');
    await setToken(r.token);
    enter(r.user);
  };

  const register = async (data: Record<string, string>) => {
    const r = await api.post<{ token: string; user: User }>('/auth/register', data);
    await setToken(r.token);
    enter(r.user);
  };

  const logout = () => {
    setToken(null);
    setUserState(null);
    setUnread(0);
    lastUnread.current = 0;
    reset('Login');
  };

  const refreshUser = async () => {
    try { setUserState(await api.get<User>('/auth/me')); } catch { /* сеть */ }
  };

  return (
    <Ctx.Provider value={{ ready, user, unread, stack, toast, login, register, logout, refreshUser, setUser: setUserState, refreshUnread, push, back, reset, notify }}>
      {children}
    </Ctx.Provider>
  );
}

// Загрузка данных для экрана
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    return loader().then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}
