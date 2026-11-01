// Шапка сайта: название, навигация по ролям, иконка профиля
import { useEffect, useRef, useState } from 'react';
import { Link, navigate, useRoute } from '../lib/router';
import { ROLES, useAuth } from '../lib/auth';
import { initials } from '../lib/format';

export function navItems(roleId?: number) {
  const common = [{ to: '/', label: 'Главная' }, { to: '/catalog', label: 'Каталог' }];
  if (roleId === ROLES.CUSTOMER) return [...common, { to: '/favorites', label: 'Избранное' }, { to: '/orders', label: 'Мои предзаказы' }, { to: '/messages', label: 'Сообщения' }];
  if (roleId === ROLES.SMITH) return [...common, { to: '/smith/orders', label: 'Мастерская' }, { to: '/messages', label: 'Сообщения' }];
  if (roleId === ROLES.ADMIN) return [...common, { to: '/admin/users', label: 'Администрирование' }];
  return common;
}

export function Logo() {
  return (
    <Link to="/" className="logo">
      <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 24h36c0 7-5 11-12 12v7h9v7H17v-7h9v-7C15 35 8 31 8 24z" /><path d="M44 24h12l-12 8z" /><circle className="spark" cx="48" cy="12" r="4" /></svg>
      <span>Гига<b>Кузня</b></span>
    </Link>
  );
}

export function Header() {
  const { user, logout, unread } = useAuth();
  const { path } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMenuOpen(false); setProfileOpen(false); }, [path]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items = navItems(user?.role_id);
  const cabinet = user?.role_id === ROLES.CUSTOMER ? '/cabinet' : '/profile';

  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />
        <nav className={`nav ${menuOpen ? 'open' : ''}`} aria-label="Основная навигация">
          {items.map((i) => (
            <Link key={i.to} to={i.to} className="nav-link">
              {i.label}
              {i.to === '/messages' && unread > 0 && <span className="badge">{unread}</span>}
            </Link>
          ))}
          {!user && (
            <div className="nav-auth-mobile">
              <Link to="/login" className="btn btn-ghost">Войти</Link>
              <Link to="/register" className="btn btn-primary">Регистрация</Link>
            </div>
          )}
        </nav>

        <div className="header-actions">
          {user ? (
            <div className="profile" ref={profileRef}>
              <button className="avatar" onClick={() => setProfileOpen((v) => !v)} aria-label="Профиль" aria-expanded={profileOpen}>
                {initials(user.full_name)}
                {unread > 0 && <span className="avatar-dot" />}
              </button>
              {profileOpen && (
                <div className="dropdown">
                  <div className="dropdown-head">
                    <b>{user.full_name}</b>
                    <span>{user.role}</span>
                    {user.role_id === ROLES.CUSTOMER && <span className="points-chip">★ {user.bonus_points} баллов</span>}
                  </div>
                  <Link to={cabinet}>{user.role_id === ROLES.CUSTOMER ? 'Личный кабинет' : 'Профиль'}</Link>
                  {user.role_id === ROLES.CUSTOMER && <Link to="/orders">Мои предзаказы</Link>}
                  {user.role_id !== ROLES.ADMIN && <Link to="/messages">Сообщения {unread > 0 && `(${unread})`}</Link>}
                  <button onClick={() => { logout(); navigate('/'); }}>Выйти</button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-ghost">Войти</Link>
              <Link to="/register" className="btn btn-primary">Регистрация</Link>
            </div>
          )}
          <button className="burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Меню" aria-expanded={menuOpen}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
