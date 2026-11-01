// Мастерская кузнеца: предзаказы, изделия, заказчики и баллы, аналитика
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { Link, navigate } from '../../lib/router';
import { ROLES, useAuth } from '../../lib/auth';
import { collect, date, dateTime, money, resizeImage, rules } from '../../lib/format';
import { STATUSES, type Preorder, type Product } from '../../lib/types';
import { PanelLayout } from '../../components/PanelLayout';
import { Empty, ErrorBox, Field, Loader, Modal, StatusBadge, useLoad, useToast } from '../../components/ui';

// ---------- Обработка предзаказов ----------
export function SmithOrders() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const list = useLoad(() => api.get<Preorder[]>('/preorders' + (status ? `?status=${encodeURIComponent(status)}` : '')), [status]);
  const [view, setView] = useState<Preorder | null>(null);

  const change = async (o: Preorder, s: string) => {
    if (s === o.status) return;
    if (['Отгружен', 'Отменён'].includes(s) && !window.confirm(`Перевести предзаказ №${o.preorder_id} в статус «${s}»? Это завершит заказ.`)) return;
    try {
      await api.patch(`/preorders/${o.preorder_id}/status`, { status: s });
      toast(`Статус предзаказа №${o.preorder_id}: «${s}». Заказчик уведомлён.`);
      list.reload();
      setView(null);
    } catch (e: any) { toast(e.message, 'error'); }
  };

  const remove = async (o: Preorder) => {
    if (!window.confirm(`Удалить предзаказ №${o.preorder_id} без возможности восстановления?`)) return;
    try { await api.del(`/preorders/${o.preorder_id}`); toast('Предзаказ удалён'); list.reload(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const q = search.trim().toLowerCase();
  const rows = (list.data || []).filter((o) => !q || o.full_name.toLowerCase().includes(q) || o.product_title.toLowerCase().includes(q) || String(o.preorder_id) === q);
  const closed = (o: Preorder) => ['Отгружен', 'Отменён'].includes(o.status) && user?.role_id !== ROLES.ADMIN;

  return (
    <PanelLayout title="Предзаказы">
      <div className="toolbar">
        <input type="search" placeholder="Поиск: №, заказчик, изделие" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="chips">
          {['', ...STATUSES].map((s) => (
            <button key={s || 'all'} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{s || 'Все'}</button>
          ))}
        </div>
      </div>
      {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : rows.length ? (
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>№</th><th>Заказчик</th><th>Изделие</th><th>Желаемая дата</th><th>Сумма</th><th>Статус</th><th /></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.preorder_id}>
                  <td>{o.preorder_id}</td>
                  <td><b>{o.full_name}</b><div className="muted small">{o.phone}</div></td>
                  <td>{o.product_title}</td>
                  <td>{date(o.desired_date)}</td>
                  <td>{money(o.final_price)}</td>
                  <td>
                    <select className={`status-select`} value={o.status} disabled={closed(o)} onChange={(e) => change(o, e.target.value)} aria-label="Статус">
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="nowrap">
                    <button className="btn btn-sm btn-ghost" onClick={() => setView(o)}>Подробнее</button>
                    {user?.role_id === ROLES.ADMIN && <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(o)}>Удалить</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty icon="📋" title="Предзаказов нет" text={status ? `Нет предзаказов в статусе «${status}»` : undefined} />}

      {view && (
        <Modal title={`Предзаказ №${view.preorder_id}`} onClose={() => setView(null)}>
          <dl className="details">
            <div><dt>Статус</dt><dd><StatusBadge status={view.status} /></dd></div>
            <div><dt>Изделие</dt><dd><Link to={`/product/${view.product_id}`}>{view.product_title}</Link></dd></div>
            <div><dt>Заказчик</dt><dd>{view.full_name}</dd></div>
            <div><dt>Телефон</dt><dd>{view.phone || '—'}</dd></div>
            <div><dt>E-mail</dt><dd>{view.email}</dd></div>
            <div><dt>Оформлен</dt><dd>{dateTime(view.created_at)}</dd></div>
            <div><dt>Желаемая дата</dt><dd>{date(view.desired_date)}</dd></div>
            <div><dt>Сумма</dt><dd>{money(view.final_price)}{view.points_used > 0 && ` (списано баллов: ${view.points_used})`}</dd></div>
            <div><dt>Комментарий</dt><dd>{view.comment || '—'}</dd></div>
          </dl>
          <div className="row-actions">
            {user?.role_id === ROLES.SMITH && <button className="btn btn-ghost" onClick={() => navigate(`/messages?with=${view.user_id}`)}>Написать заказчику</button>}
            {!closed(view) && STATUSES.filter((s) => s !== view.status).map((s) => (
              <button key={s} className="btn btn-sm btn-dark" onClick={() => change(view, s)}>→ {s}</button>
            ))}
          </div>
        </Modal>
      )}
    </PanelLayout>
  );
}

// ---------- Управление каталогом ----------
const EMPTY_PRODUCT = { title: '', description: '', material: '', type: '', base_price: '', photo: '' };

export function SmithProducts() {
  const toast = useToast();
  const list = useLoad(() => api.get<Product[]>('/products?sort=title'), []);
  const filters = useLoad(() => api.get<{ types: string[]; materials: string[] }>('/products/filters'), []);
  const [edit, setEdit] = useState<{ id: number | null; form: typeof EMPTY_PRODUCT } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const open = (p?: Product) => {
    setErrors({});
    setEdit(p
      ? { id: p.product_id, form: { title: p.title, description: p.description || '', material: p.material, type: p.type, base_price: String(p.base_price), photo: p.photo || '' } }
      : { id: null, form: { ...EMPTY_PRODUCT } });
  };
  const set = (k: keyof typeof EMPTY_PRODUCT, v: string) => { if (edit) { setEdit({ ...edit, form: { ...edit.form, [k]: v } }); setErrors({ ...errors, [k]: '' }); } };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    try { set('photo', await resizeImage(file)); } catch (e: any) { setErrors({ ...errors, photo: e.message }); }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const f = edit.form;
    const price = Number(f.base_price.replace(',', '.'));
    const errs = collect({
      title: rules.required(f.title, 'Название'),
      material: rules.required(f.material, 'Материал'),
      type: rules.required(f.type, 'Тип'),
      base_price: !f.base_price ? 'Укажите базовую цену' : isNaN(price) || price < 1 ? 'Цена должна быть числом не меньше 1' : price > 99999999 ? 'Слишком большая цена' : '',
    });
    if (errs) return setErrors(errs);
    try {
      if (edit.id) await api.put(`/products/${edit.id}`, f); else await api.post('/products', f);
      toast(edit.id ? 'Изделие обновлено' : 'Изделие добавлено в каталог');
      setEdit(null); list.reload(); filters.reload();
    } catch (err: any) { setErrors({ ...(err.fields || {}), form: err.fields ? '' : err.message }); }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`Удалить «${p.title}» из каталога? Будут удалены также его сезонные цены, отзывы и записи в избранном.`)) return;
    try { await api.del(`/products/${p.product_id}`); toast('Изделие удалено'); list.reload(); } catch (e: any) { toast(e.message, 'error'); }
  };

  const q = search.trim().toLowerCase();
  const rows = (list.data || []).filter((p) => !q || p.title.toLowerCase().includes(q) || p.type.toLowerCase().includes(q));

  return (
    <PanelLayout title="Изделия" actions={<button className="btn btn-primary" onClick={() => open()}>+ Добавить изделие</button>}>
      <div className="toolbar"><input type="search" placeholder="Поиск по названию или типу" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : (
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>Фото</th><th>Название</th><th>Тип / материал</th><th>Базовая цена</th><th>Текущая цена</th><th>Рейтинг</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.product_id}>
                  <td>{p.photo ? <img className="thumb" src={p.photo} alt="" /> : <div className="thumb no-photo">⚒</div>}</td>
                  <td><Link to={`/product/${p.product_id}`}><b>{p.title}</b></Link></td>
                  <td>{p.type}<div className="muted small">{p.material}</div></td>
                  <td>{money(p.base_price)}</td>
                  <td>{money(p.current_price)}{p.is_seasonal && <div className="tag tag-season tag-inline">сезонная</div>}</td>
                  <td>{p.reviews_count ? `★ ${p.rating} (${p.reviews_count})` : '—'}</td>
                  <td className="nowrap">
                    <button className="btn btn-sm btn-ghost" onClick={() => open(p)}>Изменить</button>
                    <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(p)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="muted pad">Изделия не найдены</p>}
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? 'Редактирование изделия' : 'Новое изделие'} onClose={() => setEdit(null)} wide>
          <form className="form product-form" onSubmit={save} noValidate>
            {errors.form && <ErrorBox text={errors.form} />}
            <div className="product-form-grid">
              <div className="photo-input">
                {edit.form.photo ? <img src={edit.form.photo} alt="Фото изделия" /> : <div className="no-photo big">⚒</div>}
                <label className="btn btn-sm btn-ghost">
                  Загрузить фото
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
                </label>
                {edit.form.photo && <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => set('photo', '')}>Убрать фото</button>}
                {errors.photo && <span className="field-error">{errors.photo}</span>}
              </div>
              <div>
                <Field label="Название" required error={errors.title}>
                  <input value={edit.form.title} maxLength={128} onChange={(e) => set('title', e.target.value)} />
                </Field>
                <div className="row-2">
                  <Field label="Тип изделия" required error={errors.type}>
                    <input list="types" value={edit.form.type} maxLength={64} onChange={(e) => set('type', e.target.value)} />
                  </Field>
                  <Field label="Материал" required error={errors.material}>
                    <input list="materials" value={edit.form.material} maxLength={60} onChange={(e) => set('material', e.target.value)} />
                  </Field>
                </div>
                <datalist id="types">{filters.data?.types.map((t) => <option key={t} value={t} />)}</datalist>
                <datalist id="materials">{filters.data?.materials.map((m) => <option key={m} value={m} />)}</datalist>
                <Field label="Базовая цена, ₽" required error={errors.base_price}>
                  <input inputMode="decimal" value={edit.form.base_price} onChange={(e) => set('base_price', e.target.value.replace(/[^\d.,]/g, ''))} />
                </Field>
                <Field label="Описание" error={errors.description} hint={`${edit.form.description.length}/3000`}>
                  <textarea rows={4} maxLength={3000} value={edit.form.description} onChange={(e) => set('description', e.target.value)} />
                </Field>
              </div>
            </div>
            <div className="row-actions end">
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Отмена</button>
              <button className="btn btn-primary">{edit.id ? 'Сохранить' : 'Добавить'}</button>
            </div>
          </form>
        </Modal>
      )}
    </PanelLayout>
  );
}

// ---------- Заказчики и баллы ----------
type Customer = { user_id: number; full_name: string; phone: string; email: string; bonus_points: number; is_blocked: boolean; orders_count: number; total_spent: number };

export function SmithCustomers() {
  const { user } = useAuth();
  const toast = useToast();
  const list = useLoad(() => api.get<Customer[]>('/customers'), []);
  const [target, setTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState({ points: '', reason: '' });
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(form.points);
    if (!form.points || !Number.isInteger(n) || n === 0) return setError('Укажите целое число, не равное нулю (минус — списание)');
    if (target && target.bonus_points + n < 0) return setError(`Нельзя списать больше, чем есть (${target.bonus_points})`);
    try {
      await api.post(`/customers/${target!.user_id}/points`, { points: n, reason: form.reason });
      toast(n > 0 ? `Начислено ${n} баллов` : `Списано ${-n} баллов`);
      setTarget(null); list.reload();
    } catch (err: any) { setError(err.fields?.points || err.message); }
  };

  return (
    <PanelLayout title="Заказчики и баллы">
      <div className="alert alert-info">Баллы начисляются автоматически при отгрузке заказа: 10 баллов за каждые 1000 ₽. 1 балл = 1 % скидки на следующий предзаказ (не более 30 %). Здесь можно начислить баллы вручную, например за отзыв.</div>
      {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : (
        <div className="table-wrap card">
          <table className="table">
            <thead><tr><th>Заказчик</th><th>Контакты</th><th>Предзаказов</th><th>Выкуплено на</th><th>Баллы</th><th /></tr></thead>
            <tbody>
              {list.data?.map((c) => (
                <tr key={c.user_id} className={c.is_blocked ? 'row-muted' : ''}>
                  <td><b>{c.full_name}</b>{c.is_blocked && <span className="tag tag-inline">заблокирован</span>}</td>
                  <td>{c.phone}<div className="muted small">{c.email}</div></td>
                  <td>{c.orders_count}</td>
                  <td>{money(c.total_spent)}</td>
                  <td><b className="points">★ {c.bonus_points}</b></td>
                  <td className="nowrap">
                    <button className="btn btn-sm btn-ghost" onClick={() => { setTarget(c); setForm({ points: '', reason: '' }); setError(''); }}>Баллы</button>
                    {user?.role_id === ROLES.SMITH && <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/messages?with=${c.user_id}`)}>Написать</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {target && (
        <Modal title={`Баллы: ${target.full_name}`} onClose={() => setTarget(null)}>
          <form className="form" onSubmit={submit} noValidate>
            <p>Текущий баланс: <b>{target.bonus_points}</b> баллов</p>
            <Field label="Количество баллов" required error={error} hint="Положительное число — начисление, отрицательное — списание">
              <input inputMode="numeric" value={form.points} onChange={(e) => { setForm({ ...form, points: e.target.value.replace(/[^\d-]/g, '') }); setError(''); }} />
            </Field>
            <Field label="Причина">
              <input value={form.reason} maxLength={200} placeholder="Например: за отзыв" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
            <button className="btn btn-primary btn-block">Применить</button>
          </form>
        </Modal>
      )}
    </PanelLayout>
  );
}

// ---------- Аналитика спроса ----------
type Stats = {
  totals: { products: number; customers: number; preorders: number; active_preorders: number; revenue: number; favorites: number };
  favorites: { product_id: number; title: string; count: number }[];
  preorders: { product_id: number; title: string; count: number }[];
  statuses: { status: string; count: number }[];
};

function Bars({ rows, unit }: { rows: { title: string; count: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.title} className="bar-row">
          <span className="bar-label" title={r.title}>{r.title}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(r.count / max) * 100}%` }} /></span>
          <span className="bar-value">{r.count} {unit}</span>
        </div>
      ))}
    </div>
  );
}

export function SmithAnalytics() {
  const { data, loading, error } = useLoad(() => api.get<Stats>('/stats'), []);
  return (
    <PanelLayout title="Аналитика спроса">
      {loading ? <Loader /> : error || !data ? <ErrorBox text={error} /> : (
        <>
          <div className="stat-row">
            <div className="stat card"><span>Изделий в каталоге</span><b>{data.totals.products}</b></div>
            <div className="stat card"><span>Заказчиков</span><b>{data.totals.customers}</b></div>
            <div className="stat card"><span>Активных предзаказов</span><b>{data.totals.active_preorders}</b><small>всего {data.totals.preorders}</small></div>
            <div className="stat card stat-accent"><span>Выручка (отгружено)</span><b>{money(data.totals.revenue)}</b></div>
          </div>
          <div className="two-col">
            <div className="card pad"><h3>Чаще всего добавляют в избранное</h3><Bars rows={data.favorites} unit="♡" /></div>
            <div className="card pad"><h3>Чаще всего оформляют предзаказ</h3><Bars rows={data.preorders} unit="шт." /></div>
          </div>
          <div className="card pad section-sm">
            <h3>Предзаказы по статусам</h3>
            <div className="status-summary">
              {STATUSES.map((s) => (
                <div key={s}><StatusBadge status={s} /><b>{data.statuses.find((x) => x.status === s)?.count || 0}</b></div>
              ))}
            </div>
          </div>
        </>
      )}
    </PanelLayout>
  );
}
