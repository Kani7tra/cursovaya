// Главная страница: выставка работ, сезонные предложения, новинки
import { Link } from '../lib/router';
import { api } from '../lib/api';
import { ROLES, useAuth } from '../lib/auth';
import type { Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { Loader, useLoad } from '../components/ui';

export default function Home() {
  const { user } = useAuth();
  const fresh = useLoad(() => api.get<Product[]>('/products?sort=new&limit=4'), [user?.user_id]);
  const seasonal = useLoad(() => api.get<Product[]>('/products?seasonal=1&limit=4'), [user?.user_id]);

  const patch = (list: typeof fresh, id: number, fav: boolean) =>
    list.setData((d) => d && d.map((p) => (p.product_id === id ? { ...p, is_favorite: fav } : p)));

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-text">
            <span className="eyebrow">Кузнечная мастерская</span>
            <h1>Металл, который <em>помнит руку мастера</em></h1>
            <p>Ножи, каминные наборы, мангалы, перила и подарки ручной ковки. Выберите изделие в каталоге, оформите предзаказ и следите за его статусом онлайн. Задать вопрос кузнецу можно прямо на сайте.</p>
            <div className="hero-actions">
              <Link to="/catalog" className="btn btn-primary btn-lg">Смотреть каталог</Link>
              {!user && <Link to="/register" className="btn btn-outline-light btn-lg">Стать заказчиком</Link>}
              {user?.role_id === ROLES.SMITH && <Link to="/smith/orders" className="btn btn-outline-light btn-lg">Перейти в мастерскую</Link>}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <svg viewBox="0 0 400 320">
              <defs>
                <radialGradient id="glow" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#ff8a3d" stopOpacity=".55" /><stop offset="1" stopColor="#ff8a3d" stopOpacity="0" /></radialGradient>
              </defs>
              <circle cx="210" cy="120" r="150" fill="url(#glow)" />
              <path d="M40 150h230c0 40-32 62-80 68v34h52v30H118v-30h52v-34C98 212 40 190 40 150z" fill="#3a332e" />
              <path d="M270 150h90l-90 46z" fill="#3a332e" />
              <path d="M40 150h230" stroke="#5a4f47" strokeWidth="6" />
              <g fill="#ffb26b" className="sparks">
                <circle cx="200" cy="90" r="4" /><circle cx="240" cy="60" r="3" /><circle cx="170" cy="55" r="2.5" /><circle cx="265" cy="100" r="2" /><circle cx="215" cy="35" r="2" />
              </g>
              <rect x="150" y="128" width="110" height="14" rx="4" fill="#e0662a" />
            </svg>
          </div>
        </div>
        <div className="container hero-stats">
          <div><b>12+</b><span>видов изделий</span></div>
          <div><b>ручная</b><span>ковка и сборка</span></div>
          <div><b>до 30%</b><span>оплаты баллами</span></div>
          <div><b>онлайн</b><span>статус предзаказа</span></div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div><span className="eyebrow">Только сейчас</span><h2>Сезонные предложения</h2></div>
          <Link to="/catalog?seasonal=1" className="link-arrow">Все предложения →</Link>
        </div>
        {seasonal.loading ? <Loader /> : seasonal.data && seasonal.data.length ? (
          <div className="grid">{seasonal.data.map((p) => <ProductCard key={p.product_id} p={p} onFav={(f) => patch(seasonal, p.product_id, f)} />)}</div>
        ) : <p className="muted">Сейчас сезонных предложений нет.</p>}
      </section>

      <section className="container section">
        <div className="section-head">
          <div><span className="eyebrow">Из кузни</span><h2>Новые работы</h2></div>
          <Link to="/catalog" className="link-arrow">Весь каталог →</Link>
        </div>
        {fresh.loading ? <Loader /> : (
          <div className="grid">{fresh.data?.map((p) => <ProductCard key={p.product_id} p={p} onFav={(f) => patch(fresh, p.product_id, f)} />)}</div>
        )}
      </section>

      <section className="container section steps">
        <h2>Как оформить предзаказ</h2>
        <ol className="steps-list">
          <li><b>Выберите изделие</b><span>Используйте поиск и фильтры по типу, материалу и цене.</span></li>
          <li><b>Оформите предзаказ</b><span>Укажите желаемую дату и пожелания. Скидки применятся автоматически.</span></li>
          <li><b>Следите за статусом</b><span>Новый → Принят → В работе → Готов → Отгружен. Уведомления приходят в сообщения.</span></li>
          <li><b>Копите баллы</b><span>10 баллов за каждые 1000 ₽. 1 балл = 1 % скидки на следующий заказ.</span></li>
        </ol>
      </section>
    </>
  );
}
