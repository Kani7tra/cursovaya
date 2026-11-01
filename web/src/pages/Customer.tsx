// Разделы заказчика: избранное, мои предзаказы, личный кабинет (профиль для всех ролей)
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Link } from '../lib/router';
import { ROLES, useAuth } from '../lib/auth';
import { collect, date, dateTime, money, rules } from '../lib/format';
import type { Preorder, Product } from '../lib/types';
import { STATUSES } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { Empty, ErrorBox, Field, Loader, StatusBadge, useLoad, useToast } from '../components/ui';

export function Favorites() {
  const list = useLoad(() => api.get<Product[]>('/favorites'), []);
  return (
    <div className="container page">
      <div className="page-head"><h1>Избранное</h1></div>
      {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : list.data && list.data.length ? (
        <div className="grid">
          {list.data.map((p) => (
            <ProductCard key={p.product_id} p={{ ...p, rating: 0, reviews_count: 0 } as Product}
              onFav={(fav) => !fav && list.setData((d) => d && d.filter((x) => x.product_id !== p.product_id))} />
          ))}
        </div>
      ) : (
        <Empty icon="♡" title="В избранном пока пусто" text="Нажмите на сердечко на карточке изделия, чтобы сохранить его здесь."
          action={<Link to="/catalog" className="btn btn-primary">Перейти в каталог</Link>} />
      )}
    </div>
  );
}

const PROGRESS = STATUSES.slice(0, 5);

export function MyOrders() {
  const { refresh } = useAuth();
  const toast = useToast();
  const list = useLoad(() => api.get<Preorder[]>('/preorders/my'), []);
  const [filter, setFilter] = useState('');

  const cancel = async (o: Preorder) => {
    if (!window.confirm(`Отменить предзаказ №${o.preorder_id}?`)) return;
    try { await api.patch(`/preorders/${o.preorder_id}/cancel`); toast('Предзаказ отменён'); list.reload(); refresh(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  const rows = (list.data || []).filter((o) => !filter || o.status === filter);

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Мои предзаказы</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Фильтр по статусу">
          <option value="">Все статусы</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : rows.length ? (
        <div className="order-list">
          {rows.map((o) => {
            const step = PROGRESS.indexOf(o.status);
            return (
              <article key={o.preorder_id} className="card order">
                <div className="order-head">
                  <div>
                    <span className="muted small">Предзаказ №{o.preorder_id} от {dateTime(o.created_at)}</span>
                    <h3><Link to={`/product/${o.product_id}`}>{o.product_title}</Link></h3>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                {o.status !== 'Отменён' && (
                  <ol className="progress">
                    {PROGRESS.map((s, i) => <li key={s} className={i <= step ? 'done' : ''}><span />{s}</li>)}
                  </ol>
                )}
                <div className="order-info">
                  <div><span>Желаемая дата</span><b>{date(o.desired_date)}</b></div>
                  <div><span>Сумма</span><b>{money(o.final_price)}</b></div>
                  {o.points_used > 0 && <div><span>Списано баллов</span><b>{o.points_used}</b></div>}
                  {o.comment && <div className="wide"><span>Комментарий</span><b>{o.comment}</b></div>}
                </div>
                <div className="row-actions">
                  <Link to="/messages?to=smith" className="btn btn-sm btn-ghost">Связаться с кузнецом</Link>
                  {o.status === 'Новый' && <button className="btn btn-sm btn-danger-ghost" onClick={() => cancel(o)}>Отменить</button>}
                  {o.status === 'Отгружен' && <Link to={`/product/${o.product_id}`} className="btn btn-sm btn-ghost">Оставить отзыв</Link>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty icon="📋" title={filter ? 'Нет предзаказов с таким статусом' : 'У вас пока нет предзаказов'}
          action={<Link to="/catalog" className="btn btn-primary">Выбрать изделие</Link>} />
      )}
    </div>
  );
}

// Личный кабинет заказчика / профиль кузнеца и администратора
export function Cabinet() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const isCustomer = user?.role_id === ROLES.CUSTOMER;
  const orders = useLoad(() => (isCustomer ? api.get<Preorder[]>('/preorders/my') : Promise.resolve([] as Preorder[])), [isCustomer]);
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '', email: user?.email || '' });
  const [pwd, setPwd] = useState({ old_password: '', new_password: '', new_password_confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});

  if (!user) return null;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const errs = collect({ full_name: rules.fullName(form.full_name), phone: rules.phone(form.phone), email: rules.email(form.email) });
    if (errs) return setErrors(errs);
    try { setUser(await api.put('/profile', form)); toast('Данные профиля сохранены'); }
    catch (err: any) { setErrors({ ...(err.fields || {}), form: err.fields ? '' : err.message }); }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    const errs = collect({
      old_password: rules.required(pwd.old_password, 'Текущий пароль'),
      new_password: rules.password(pwd.new_password),
      new_password_confirm: pwd.new_password !== pwd.new_password_confirm ? 'Пароли не совпадают' : '',
    });
    if (errs) return setPwdErrors(errs);
    try {
      await api.put('/profile/password', pwd);
      setPwd({ old_password: '', new_password: '', new_password_confirm: '' });
      setPwdErrors({});
      toast('Пароль изменён');
    } catch (err: any) { setPwdErrors({ ...(err.fields || {}), form: err.fields ? '' : err.message }); }
  };

  const list = orders.data || [];
  const active = list.filter((o) => !['Отгружен', 'Отменён'].includes(o.status)).length;
  const done = list.filter((o) => o.status === 'Отгружен');

  return (
    <div className="container page">
      <div className="page-head"><h1>{isCustomer ? 'Личный кабинет' : 'Профиль'}</h1><span className="role-chip">{user.role}</span></div>

      {isCustomer && (
        <div className="stat-row">
          <div className="stat card stat-accent"><span>Бонусные баллы</span><b>{user.bonus_points}</b><small>1 балл = 1 % скидки, до 30 % заказа</small></div>
          <div className="stat card"><span>Активные предзаказы</span><b>{active}</b><Link to="/orders">Открыть →</Link></div>
          <div className="stat card"><span>Выполнено заказов</span><b>{done.length}</b><small>на {money(done.reduce((s, o) => s + o.final_price, 0))}</small></div>
          <div className="stat card"><span>Избранное</span><b>♡</b><Link to="/favorites">Перейти →</Link></div>
        </div>
      )}

      <div className="two-col">
        <form className="card form" onSubmit={saveProfile} noValidate>
          <h3>Личные данные</h3>
          {errors.form && <ErrorBox text={errors.form} />}
          <Field label="ФИО" required error={errors.full_name}>
            <input value={form.full_name} maxLength={128} onChange={(e) => { setForm({ ...form, full_name: e.target.value }); setErrors({}); }} />
          </Field>
          <Field label="Телефон" required error={errors.phone}>
            <input type="tel" value={form.phone} maxLength={20} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setErrors({}); }} />
          </Field>
          <Field label="E-mail" required error={errors.email}>
            <input type="email" value={form.email} maxLength={64} onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors({}); }} />
          </Field>
          <button className="btn btn-primary">Сохранить изменения</button>
        </form>

        <form className="card form" onSubmit={savePassword} noValidate>
          <h3>Смена пароля</h3>
          {pwdErrors.form && <ErrorBox text={pwdErrors.form} />}
          <Field label="Текущий пароль" required error={pwdErrors.old_password}>
            <input type="password" value={pwd.old_password} maxLength={64} autoComplete="current-password" onChange={(e) => setPwd({ ...pwd, old_password: e.target.value })} />
          </Field>
          <Field label="Новый пароль" required error={pwdErrors.new_password} hint="Не менее 6 символов, буквы и цифры">
            <input type="password" value={pwd.new_password} maxLength={64} autoComplete="new-password" onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} />
          </Field>
          <Field label="Повтор нового пароля" required error={pwdErrors.new_password_confirm}>
            <input type="password" value={pwd.new_password_confirm} maxLength={64} autoComplete="new-password" onChange={(e) => setPwd({ ...pwd, new_password_confirm: e.target.value })} />
          </Field>
          <button className="btn btn-dark">Изменить пароль</button>
        </form>
      </div>

      {isCustomer && list.length > 0 && (
        <section className="section">
          <h2>История предзаказов</h2>
          <div className="table-wrap card">
            <table className="table">
              <thead><tr><th>№</th><th>Изделие</th><th>Дата оформления</th><th>Сумма</th><th>Статус</th></tr></thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.preorder_id}>
                    <td>{o.preorder_id}</td><td>{o.product_title}</td><td>{date(o.created_at)}</td>
                    <td>{money(o.final_price)}</td><td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
