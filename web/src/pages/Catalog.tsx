// Каталог изделий: поиск, фильтрация по типу, материалу, цене, сортировка
import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api';
import { navigate, useRoute } from '../lib/router';
import { useAuth } from '../lib/auth';
import type { Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { Empty, ErrorBox, Loader, useLoad } from '../components/ui';

type Filters = { types: string[]; materials: string[]; min: number; max: number };

export default function Catalog() {
  const { user } = useAuth();
  const { search } = useRoute();
  const f = {
    search: search.get('search') || '',
    type: search.get('type') || '',
    material: search.get('material') || '',
    min_price: search.get('min_price') || '',
    max_price: search.get('max_price') || '',
    seasonal: search.get('seasonal') || '',
    sort: search.get('sort') || 'new',
  };
  const key = qs(f);
  const [text, setText] = useState(f.search);
  const [price, setPrice] = useState({ min: f.min_price, max: f.max_price });
  const [priceError, setPriceError] = useState('');
  const filters = useLoad(() => api.get<Filters>('/products/filters'), []);
  const list = useLoad(() => api.get<Product[]>('/products' + key), [key, user?.user_id]);

  useEffect(() => { setText(f.search); setPrice({ min: f.min_price, max: f.max_price }); }, [key]); // eslint-disable-line

  const apply = (patch: Partial<typeof f>) => navigate('/catalog' + qs({ ...f, ...patch }), true);

  const applyPrice = () => {
    const min = price.min ? Number(price.min) : null;
    const max = price.max ? Number(price.max) : null;
    if ((min !== null && (isNaN(min) || min < 0)) || (max !== null && (isNaN(max) || max < 0))) return setPriceError('Цена должна быть положительным числом');
    if (min !== null && max !== null && min > max) return setPriceError('Минимальная цена больше максимальной');
    setPriceError('');
    apply({ min_price: price.min, max_price: price.max });
  };

  const reset = () => { setText(''); setPrice({ min: '', max: '' }); navigate('/catalog', true); };
  const hasFilters = f.search || f.type || f.material || f.min_price || f.max_price || f.seasonal;

  return (
    <div className="container page">
      <div className="page-head">
        <div><span className="eyebrow">Выставка работ</span><h1>Каталог изделий</h1></div>
      </div>

      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); apply({ search: text.trim() }); }}>
        <input type="search" placeholder="Поиск по названию или описанию…" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} />
        <button className="btn btn-primary" type="submit">Найти</button>
      </form>

      <div className="catalog">
        <aside className="filters card">
          <h3>Фильтры</h3>
          <label className="field"><span className="field-label">Тип изделия</span>
            <select value={f.type} onChange={(e) => apply({ type: e.target.value })}>
              <option value="">Все типы</option>
              {filters.data?.types.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Материал</span>
            <select value={f.material} onChange={(e) => apply({ material: e.target.value })}>
              <option value="">Все материалы</option>
              {filters.data?.materials.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <div className={`field ${priceError ? 'has-error' : ''}`}>
            <span className="field-label">Цена, ₽</span>
            <div className="row-2">
              <input inputMode="numeric" placeholder={`от ${filters.data?.min ?? ''}`} value={price.min} onChange={(e) => setPrice({ ...price, min: e.target.value.replace(/[^\d]/g, '') })} />
              <input inputMode="numeric" placeholder={`до ${filters.data?.max ?? ''}`} value={price.max} onChange={(e) => setPrice({ ...price, max: e.target.value.replace(/[^\d]/g, '') })} />
            </div>
            {priceError && <span className="field-error">{priceError}</span>}
            <button type="button" className="btn btn-sm btn-ghost" onClick={applyPrice}>Применить цену</button>
          </div>
          <label className="check">
            <input type="checkbox" checked={f.seasonal === '1'} onChange={(e) => apply({ seasonal: e.target.checked ? '1' : '' })} />
            Только сезонные предложения
          </label>
          {hasFilters && <button className="btn btn-ghost btn-block" onClick={reset}>Сбросить фильтры</button>}
        </aside>

        <div className="catalog-main">
          <div className="catalog-toolbar">
            <span className="muted">{list.data ? `Найдено изделий: ${list.data.length}` : ''}</span>
            <label className="sort">Сортировка:
              <select value={f.sort} onChange={(e) => apply({ sort: e.target.value })}>
                <option value="new">Сначала новые</option>
                <option value="price_asc">Сначала дешёвые</option>
                <option value="price_desc">Сначала дорогие</option>
                <option value="rating">По рейтингу</option>
                <option value="title">По названию</option>
              </select>
            </label>
          </div>
          {list.loading ? <Loader /> : list.error ? <ErrorBox text={list.error} /> : list.data && list.data.length ? (
            <div className="grid grid-3">
              {list.data.map((p) => (
                <ProductCard key={p.product_id} p={p}
                  onFav={(fav) => list.setData((d) => d && d.map((x) => (x.product_id === p.product_id ? { ...x, is_favorite: fav } : x)))} />
              ))}
            </div>
          ) : (
            <Empty icon="🔍" title="Ничего не найдено" text="Попробуйте изменить условия поиска или сбросить фильтры."
              action={<button className="btn btn-primary" onClick={reset}>Сбросить фильтры</button>} />
          )}
        </div>
      </div>
    </div>
  );
}
