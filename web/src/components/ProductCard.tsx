// Карточка изделия в каталоге и блок цены
import { Link, navigate } from '../lib/router';
import { ROLES, useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { money } from '../lib/format';
import type { Product } from '../lib/types';
import { Stars, useToast } from './ui';

export function PriceTag({ p, large }: { p: Pick<Product, 'base_price' | 'current_price' | 'price' | 'is_seasonal' | 'discount'>; large?: boolean }) {
  const old = p.price < p.base_price ? p.base_price : null;
  return (
    <div className={`price ${large ? 'price-lg' : ''}`}>
      <span className="price-now">{money(p.price)}</span>
      {old && <s className="price-old">{money(old)}</s>}
    </div>
  );
}

export function FavButton({ p, onChange }: { p: Product; onChange?: (fav: boolean) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  if (user && user.role_id !== ROLES.CUSTOMER) return null;
  const toggle = async () => {
    if (!user) { toast('Войдите, чтобы добавлять изделия в избранное', 'error'); return navigate('/login'); }
    try {
      if (p.is_favorite) await api.del(`/favorites/${p.product_id}`);
      else await api.post('/favorites', { product_id: p.product_id });
      onChange?.(!p.is_favorite);
      toast(p.is_favorite ? 'Удалено из избранного' : 'Добавлено в избранное');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <button className={`fav ${p.is_favorite ? 'on' : ''}`} onClick={toggle} aria-label={p.is_favorite ? 'Убрать из избранного' : 'В избранное'} title={p.is_favorite ? 'Убрать из избранного' : 'В избранное'}>
      <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3.2 5 6.6 5c2 0 3.6 1.1 5.4 3 1.8-1.9 3.4-3 5.4-3C20.8 5 23 8.4 21.5 11.8 19.5 16.4 12 21 12 21z" /></svg>
    </button>
  );
}

export function ProductCard({ p, onFav }: { p: Product; onFav?: (fav: boolean) => void }) {
  return (
    <article className="card product-card">
      <div className="product-photo">
        <Link to={`/product/${p.product_id}`}>
          {p.photo ? <img src={p.photo} alt={p.title} loading="lazy" /> : <div className="no-photo">⚒</div>}
        </Link>
        <div className="tags">
          {p.is_seasonal && <span className="tag tag-season">Сезонное предложение</span>}
          {p.discount && <span className="tag tag-sale">−{money(p.discount.saved)}</span>}
        </div>
        <FavButton p={p} onChange={onFav} />
      </div>
      <div className="product-body">
        <span className="product-type">{p.type} · {p.material}</span>
        <h3><Link to={`/product/${p.product_id}`}>{p.title}</Link></h3>
        <div className="product-meta">
          {p.reviews_count > 0 ? <><Stars value={p.rating} size="sm" /><span>{p.rating} ({p.reviews_count})</span></> : <span className="muted">Нет отзывов</span>}
        </div>
        <div className="product-foot">
          <PriceTag p={p} />
          <Link to={`/product/${p.product_id}`} className="btn btn-sm btn-dark">Подробнее</Link>
        </div>
      </div>
    </article>
  );
}
