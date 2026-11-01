// Раскладка рабочих разделов кузнеца и администратора (боковое меню + содержимое)
import type { ReactNode } from 'react';
import { Link } from '../lib/router';
import { ROLES, useAuth } from '../lib/auth';

const SMITH_MENU = [
  { to: '/smith/orders', label: 'Предзаказы', icon: '📋' },
  { to: '/smith/products', label: 'Изделия', icon: '⚒' },
  { to: '/smith/seasonal', label: 'Сезонные цены', icon: '❄' },
  { to: '/smith/discounts', label: 'Скидки', icon: '％' },
  { to: '/smith/customers', label: 'Заказчики и баллы', icon: '★' },
  { to: '/smith/analytics', label: 'Аналитика спроса', icon: '📊' },
];

const ADMIN_MENU = [
  { to: '/admin/users', label: 'Пользователи', icon: '👤' },
  { to: '/admin/logs', label: 'Журнал событий', icon: '🗒' },
  ...SMITH_MENU,
];

export function PanelLayout({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { user } = useAuth();
  const menu = user?.role_id === ROLES.ADMIN ? ADMIN_MENU : SMITH_MENU;
  return (
    <div className="container panel">
      <aside className="panel-side">
        <div className="panel-side-title">{user?.role_id === ROLES.ADMIN ? 'Администрирование' : 'Мастерская'}</div>
        {menu.map((m) => (
          <Link key={m.to} to={m.to} className="panel-link"><span className="panel-icon">{m.icon}</span>{m.label}</Link>
        ))}
      </aside>
      <section className="panel-main">
        <div className="page-head">
          <h1>{title}</h1>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
        {children}
      </section>
    </div>
  );
}
