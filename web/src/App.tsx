// Маршруты веб-приложения и разграничение доступа по ролям
import type { ReactNode } from 'react';
import { Link, matchPath, useRoute } from './lib/router';
import { ROLES, useAuth } from './lib/auth';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Empty, Loader } from './components/ui';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductPage from './pages/ProductPage';
import Messages from './pages/Messages';
import { Login, Register } from './pages/Auth';
import { Cabinet, Favorites, MyOrders } from './pages/Customer';
import { SmithAnalytics, SmithCustomers, SmithOrders, SmithProducts } from './pages/smith/Smith';
import { SmithDiscounts, SmithSeasonal } from './pages/smith/Prices';
import { AdminLogs, AdminUsers } from './pages/admin/Admin';

const { ADMIN, SMITH, CUSTOMER } = ROLES;

type Route = { path: string; render: (p: Record<string, string>) => ReactNode; roles?: number[]; guestOnly?: boolean };

const routes: Route[] = [
  { path: '/', render: () => <Home /> },
  { path: '/catalog', render: () => <Catalog /> },
  { path: '/product/:id', render: (p) => <ProductPage id={p.id} /> },
  { path: '/login', render: () => <Login />, guestOnly: true },
  { path: '/register', render: () => <Register />, guestOnly: true },
  { path: '/favorites', render: () => <Favorites />, roles: [CUSTOMER] },
  { path: '/orders', render: () => <MyOrders />, roles: [CUSTOMER] },
  { path: '/cabinet', render: () => <Cabinet />, roles: [CUSTOMER] },
  { path: '/profile', render: () => <Cabinet />, roles: [SMITH, ADMIN] },
  { path: '/messages', render: () => <Messages />, roles: [CUSTOMER, SMITH] },
  { path: '/smith/orders', render: () => <SmithOrders />, roles: [SMITH, ADMIN] },
  { path: '/smith/products', render: () => <SmithProducts />, roles: [SMITH, ADMIN] },
  { path: '/smith/seasonal', render: () => <SmithSeasonal />, roles: [SMITH, ADMIN] },
  { path: '/smith/discounts', render: () => <SmithDiscounts />, roles: [SMITH, ADMIN] },
  { path: '/smith/customers', render: () => <SmithCustomers />, roles: [SMITH, ADMIN] },
  { path: '/smith/analytics', render: () => <SmithAnalytics />, roles: [SMITH, ADMIN] },
  { path: '/admin/users', render: () => <AdminUsers />, roles: [ADMIN] },
  { path: '/admin/logs', render: () => <AdminLogs />, roles: [ADMIN] },
];

function Page() {
  const { path } = useRoute();
  const { user, ready } = useAuth();
  if (!ready) return <div className="container page"><Loader /></div>;

  for (const r of routes) {
    const params = matchPath(r.path, path);
    if (!params) continue;
    if (r.guestOnly && user) {
      return <div className="container page"><Empty icon="✓" title="Вы уже вошли в систему" action={<Link to="/" className="btn btn-primary">На главную</Link>} /></div>;
    }
    if (r.roles && !user) {
      return <div className="container page"><Empty icon="🔒" title="Требуется вход" text="Войдите в систему, чтобы открыть этот раздел."
        action={<Link to={`/login?next=${encodeURIComponent(path)}`} className="btn btn-primary">Войти</Link>} /></div>;
    }
    if (r.roles && user && !r.roles.includes(user.role_id)) {
      return <div className="container page"><Empty icon="⛔" title="Доступ запрещён" text="Этот раздел недоступен для вашей роли." action={<Link to="/" className="btn btn-primary">На главную</Link>} /></div>;
    }
    return <>{r.render(params)}</>;
  }
  return <div className="container page"><Empty icon="404" title="Страница не найдена" action={<Link to="/" className="btn btn-primary">На главную</Link>} /></div>;
}

export default function App() {
  return (
    <div className="app">
      <Header />
      <main className="main"><Page /></main>
      <Footer />
    </div>
  );
}
