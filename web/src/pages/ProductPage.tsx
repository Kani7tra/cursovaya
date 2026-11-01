// Карточка изделия: фото, описание, цена, избранное, предзаказ, отзывы, связь с кузнецом
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Link, navigate } from '../lib/router';
import { ROLES, useAuth } from '../lib/auth';
import { collect, date, money, todayISO } from '../lib/format';
import type { Product, Quote, Review } from '../lib/types';
import { FavButton, PriceTag } from '../components/ProductCard';
import { Empty, ErrorBox, Field, Loader, Modal, Stars, useLoad, useToast } from '../components/ui';

export default function ProductPage({ id }: { id: string }) {
  const { user } = useAuth();
  const { data: p, error, loading, reload, setData } = useLoad(() => api.get<Product>(`/products/${id}`), [id, user?.user_id]);
  const [preorderOpen, setPreorderOpen] = useState(false);

  if (loading && !p) return <div className="container page"><Loader /></div>;
  if (error || !p) return <div className="container page"><Empty icon="⚠" title="Изделие не найдено" text={error} action={<Link to="/catalog" className="btn btn-primary">В каталог</Link>} /></div>;

  const isCustomer = user?.role_id === ROLES.CUSTOMER;
  const startPreorder = () => (user ? setPreorderOpen(true) : navigate('/login?next=' + encodeURIComponent(`/product/${id}`)));

  return (
    <div className="container page">
      <nav className="crumbs"><Link to="/catalog">Каталог</Link> / <span>{p.type}</span></nav>
      <div className="product-page">
        <div className="product-gallery card">
          {p.photo ? <img src={p.photo} alt={p.title} /> : <div className="no-photo big">⚒</div>}
          <FavButton p={p} onChange={(fav) => setData({ ...p, is_favorite: fav })} />
        </div>

        <div className="product-info">
          <span className="product-type">{p.type}</span>
          <h1>{p.title}</h1>
          <div className="product-meta">
            {p.reviews_count > 0 ? <><Stars value={p.rating} /><span>{p.rating} · отзывов: {p.reviews_count}</span></> : <span className="muted">Отзывов пока нет</span>}
          </div>

          <div className="buy-box card">
            <PriceTag p={p} large />
            {p.is_seasonal && p.season && (
              <div className="note note-season">❄ Сезонное предложение до {date(p.season.end_date)} (базовая цена {money(p.base_price)})</div>
            )}
            {p.discount && <div className="note note-sale">Скидка «{p.discount.title}»: −{money(p.discount.saved)}</div>}
            {(!user || isCustomer) && (
              <div className="buy-actions">
                <button className="btn btn-primary btn-lg" onClick={startPreorder}>Оформить предзаказ</button>
                {isCustomer && <Link to="/messages?to=smith" className="btn btn-ghost btn-lg">Написать кузнецу</Link>}
              </div>
            )}
            {!user && <p className="muted small">Для оформления предзаказа нужно <Link to="/login">войти</Link> или <Link to="/register">зарегистрироваться</Link>.</p>}
            {user && !isCustomer && <Link to="/smith/products" className="btn btn-ghost">Редактировать в мастерской</Link>}
          </div>

          <dl className="specs">
            <div><dt>Материал</dt><dd>{p.material}</dd></div>
            <div><dt>Тип</dt><dd>{p.type}</dd></div>
            <div><dt>Артикул</dt><dd>ГК-{String(p.product_id).padStart(4, '0')}</dd></div>
          </dl>
          {p.description && <div className="description"><h3>Описание</h3><p>{p.description}</p></div>}
        </div>
      </div>

      <Reviews product={p} onChange={reload} />
      {preorderOpen && <PreorderModal product={p} onClose={() => setPreorderOpen(false)} />}
    </div>
  );
}

// ---------- Оформление предзаказа ----------
function PreorderModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ desired_date: todayISO(14), comment: '', points: 0 });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    api.get<Quote>(`/preorders/quote?product_id=${product.product_id}&points=${form.points}`).then(setQuote).catch((e) => setErrors({ form: e.message }));
  }, [product.product_id, form.points]);

  const maxPoints = quote ? Math.min(quote.available_points, 30) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = collect({
      desired_date: !form.desired_date ? 'Укажите желаемую дату' : form.desired_date <= todayISO() ? 'Дата должна быть позже сегодняшнего дня' : '',
      comment: form.comment.length > 1000 ? 'Не более 1000 символов' : '',
    });
    if (errs) return setErrors(errs);
    setSaving(true);
    try {
      const r = await api.post<{ preorder_id: number }>('/preorders', { product_id: product.product_id, desired_date: form.desired_date, comment: form.comment, points_used: form.points });
      setDone(r.preorder_id);
      refresh();
      toast(`Предзаказ №${r.preorder_id} оформлен`);
    } catch (err: any) {
      setErrors({ ...err.fields, form: err.fields && Object.keys(err.fields).length ? '' : err.message });
    } finally { setSaving(false); }
  };

  if (done) {
    return (
      <Modal title="Предзаказ оформлен" onClose={onClose}>
        <div className="success-box">
          <div className="success-icon">✓</div>
          <p>Предзаказ <b>№{done}</b> на «{product.title}» принят в обработку. Кузнец свяжется с вами, а изменения статуса придут в сообщения.</p>
          <div className="row-actions">
            <Link to="/orders" className="btn btn-primary">Мои предзаказы</Link>
            <button className="btn btn-ghost" onClick={onClose}>Продолжить</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Предзаказ: ${product.title}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form">
        {errors.form && <ErrorBox text={errors.form} />}
        <Field label="Желаемая дата получения" required error={errors.desired_date}>
          <input type="date" min={todayISO(1)} value={form.desired_date} onChange={(e) => { setForm({ ...form, desired_date: e.target.value }); setErrors({}); }} />
        </Field>
        <Field label="Комментарий к заказу" hint="Размеры, гравировка, цвет покрытия и другие пожелания" error={errors.comment}>
          <textarea rows={3} maxLength={1000} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        </Field>
        {quote && quote.available_points > 0 && (
          <Field label={`Списать баллы (доступно ${quote.available_points}, не более ${maxPoints})`} hint="1 балл = 1 % скидки">
            <div className="range-row">
              <input type="range" min={0} max={maxPoints} value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
              <b>{form.points}</b>
            </div>
          </Field>
        )}
        {quote && (
          <div className="calc">
            <div><span>Цена изделия</span><span>{money(quote.price)}</span></div>
            {quote.discount && <div><span>Скидка «{quote.discount.title}»</span><span>−{money(quote.discount.saved)}</span></div>}
            {quote.points_used > 0 && <div><span>Баллы ({quote.points_used} %)</span><span>−{money(quote.points_saved)}</span></div>}
            <div className="calc-total"><span>Итого</span><span>{money(quote.final_price)}</span></div>
          </div>
        )}
        <button className="btn btn-primary btn-block btn-lg" disabled={saving}>{saving ? 'Оформляем…' : 'Подтвердить предзаказ'}</button>
      </form>
    </Modal>
  );
}

// ---------- Отзывы ----------
function Reviews({ product, onChange }: { product: Product; onChange: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const reviews = product.reviews || [];
  const mine = user ? reviews.find((r) => r.user_id === user.user_id) : undefined;
  const [editing, setEditing] = useState<Review | 'new' | null>(null);
  const [form, setForm] = useState({ rating: 5, comment: '' });
  const [error, setError] = useState('');

  const open = (r: Review | 'new') => {
    setEditing(r);
    setForm(r === 'new' ? { rating: 5, comment: '' } : { rating: r.rating, comment: r.comment || '' });
    setError('');
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (form.rating < 1 || form.rating > 5) return setError('Поставьте оценку от 1 до 5');
    if (form.comment.length > 1000) return setError('Текст отзыва — не более 1000 символов');
    try {
      if (editing === 'new') await api.post(`/products/${product.product_id}/reviews`, form);
      else if (editing) await api.put(`/reviews/${editing.review_id}`, form);
      toast('Отзыв сохранён');
      setEditing(null);
      onChange();
    } catch (err: any) { setError(err.message); }
  };

  const remove = async (r: Review) => {
    if (!window.confirm('Удалить отзыв?')) return;
    try { await api.del(`/reviews/${r.review_id}`); toast('Отзыв удалён'); onChange(); } catch (err: any) { toast(err.message, 'error'); }
  };

  return (
    <section className="section reviews">
      <div className="section-head">
        <h2>Отзывы <span className="muted">({reviews.length})</span></h2>
        {user?.role_id === ROLES.CUSTOMER && !mine && <button className="btn btn-primary" onClick={() => open('new')}>Написать отзыв</button>}
      </div>
      {reviews.length === 0 && <p className="muted">Станьте первым, кто оценит это изделие.</p>}
      <div className="review-list">
        {reviews.map((r) => (
          <article key={r.review_id} className={`card review ${mine?.review_id === r.review_id ? 'mine' : ''}`}>
            <div className="review-head">
              <b>{r.full_name}</b>
              <Stars value={r.rating} size="sm" />
              <span className="muted small">{date(r.created_at)}</span>
            </div>
            {r.comment && <p>{r.comment}</p>}
            {(mine?.review_id === r.review_id || user?.role_id === ROLES.ADMIN) && (
              <div className="row-actions">
                {mine?.review_id === r.review_id && <button className="btn btn-sm btn-ghost" onClick={() => open(r)}>Редактировать</button>}
                <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(r)}>Удалить</button>
              </div>
            )}
          </article>
        ))}
      </div>
      {editing && (
        <Modal title={editing === 'new' ? 'Новый отзыв' : 'Редактирование отзыва'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="form" noValidate>
            {error && <ErrorBox text={error} />}
            <Field label="Оценка" required><Stars value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} size="lg" /></Field>
            <Field label="Текст отзыва" hint={`${form.comment.length}/1000`}>
              <textarea rows={4} maxLength={1000} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </Field>
            <button className="btn btn-primary btn-block">Сохранить</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
