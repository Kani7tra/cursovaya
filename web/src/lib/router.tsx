// Минимальный клиентский маршрутизатор на History API
import { createContext, useContext, useEffect, useState, type MouseEvent, type ReactNode } from 'react';

type RouterState = { path: string; search: URLSearchParams };
const RouterContext = createContext<RouterState>({ path: '/', search: new URLSearchParams() });

const read = (): RouterState => ({ path: window.location.pathname, search: new URLSearchParams(window.location.search) });

export function navigate(to: string, replace = false) {
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(read);
  useEffect(() => {
    const onPop = () => setState(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return <RouterContext.Provider value={state}>{children}</RouterContext.Provider>;
}

export const useRoute = () => useContext(RouterContext);

// Сопоставление пути с шаблоном вида /product/:id
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const keys: string[] = [];
  const rx = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  const m = path.match(rx);
  if (!m) return null;
  return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
}

type LinkProps = { to: string; children: ReactNode; className?: string; onClick?: () => void; title?: string };

export function Link({ to, children, className, onClick, title }: LinkProps) {
  const { path } = useRoute();
  const active = path === to || (to !== '/' && path.startsWith(to + '/'));
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onClick?.();
    navigate(to);
  };
  return (
    <a href={to} className={[className, active ? 'active' : ''].filter(Boolean).join(' ')} onClick={handle} title={title}>
      {children}
    </a>
  );
}
