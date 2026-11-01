// Каталог изделий: просмотр, поиск, фильтрация, управление (кузнец)
const { query, one, log } = require('../db');
const { ROLES, requireRole } = require('../auth');
const { Validator, toNumber, toId } = require('../validate');
const { HttpError } = require('../router');
const { CURRENT_PRICE_SQL, activeDiscounts, bestDiscount, calculate } = require('../pricing');

const MAX_PHOTO = 3 * 1024 * 1024; // ~3 МБ в виде data URL

// Добавляет к изделиям итоговую цену со скидкой для текущего пользователя
async function withPrices(rows, userId) {
  const discounts = await activeDiscounts(userId);
  return rows.map((p) => {
    const d = bestDiscount(p.current_price, p.product_id, discounts);
    const calc = calculate(p.current_price, d, 0);
    return {
      ...p,
      is_seasonal: p.current_price !== p.base_price,
      discount: calc.discount,
      price: calc.after_discount,
    };
  });
}

const SELECT_PRODUCTS = (withPhoto) => `
  SELECT p.product_id, p.title, p.description, p.material, p.type,
         p.base_price::float AS base_price, ${CURRENT_PRICE_SQL}::float AS current_price,
         ${withPhoto ? 'p.photo,' : ''}
         COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews r WHERE r.product_id = p.product_id), 0)::float AS rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.product_id)::int AS reviews_count,
         EXISTS (SELECT 1 FROM favorites f WHERE f.product_id = p.product_id AND f.user_id = $1) AS is_favorite
    FROM products p`;

function validateProduct(body) {
  const v = new Validator(body)
    .required('title', 'Название').maxLen('title', 128, 'Название')
    .required('material', 'Материал').maxLen('material', 60, 'Материал')
    .required('type', 'Тип').maxLen('type', 64, 'Тип')
    .maxLen('description', 3000, 'Описание')
    .number('base_price', 'Базовая цена', { min: 1, max: 99999999 });
  const photo = body.photo ? String(body.photo) : '';
  v.custom('photo', !photo || /^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(photo), 'Фото должно быть изображением PNG, JPG или WEBP');
  v.custom('photo', photo.length <= MAX_PHOTO, 'Фото слишком большое (не более 2 МБ)');
  v.check();
  return [v.str('title'), v.str('description') || null, v.str('material'), v.str('type'), toNumber(body.base_price), photo || null];
}

module.exports = (router) => {
  // Список изделий с поиском, фильтрами и сортировкой
  router.get('/api/products', async (req) => {
    const q = req.query;
    const where = [];
    const params = [req.user ? req.user.user_id : 0];
    if (q.search) { params.push(`%${q.search.trim()}%`); where.push(`(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`); }
    if (q.type) { params.push(q.type); where.push(`p.type = $${params.length}`); }
    if (q.material) { params.push(q.material); where.push(`p.material = $${params.length}`); }
    if (q.min_price) { params.push(Number(q.min_price) || 0); where.push(`${CURRENT_PRICE_SQL} >= $${params.length}`); }
    if (q.max_price) { params.push(Number(q.max_price) || 0); where.push(`${CURRENT_PRICE_SQL} <= $${params.length}`); }
    if (q.seasonal === '1') where.push(`${CURRENT_PRICE_SQL} <> p.base_price`);

    const sorts = {
      new: 'p.product_id DESC',
      price_asc: 'current_price ASC',
      price_desc: 'current_price DESC',
      rating: 'rating DESC, reviews_count DESC',
      title: 'p.title ASC',
    };
    const order = sorts[q.sort] || sorts.new;
    const limit = Math.min(Number(q.limit) || 100, 100);
    const rows = await query(
      `${SELECT_PRODUCTS(true)} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ${limit}`,
      params
    );
    return withPrices(rows, req.user && req.user.user_id);
  });

  // Значения для фильтров
  router.get('/api/products/filters', async () => {
    const types = await query('SELECT DISTINCT type FROM products ORDER BY type');
    const materials = await query('SELECT DISTINCT material FROM products ORDER BY material');
    const range = await one('SELECT COALESCE(MIN(base_price),0)::float AS min, COALESCE(MAX(base_price),0)::float AS max FROM products');
    return { types: types.map((r) => r.type), materials: materials.map((r) => r.material), ...range };
  });

  // Карточка изделия с отзывами
  router.get('/api/products/:id', async (req) => {
    const id = toId(req.params.id);
    const rows = await query(`${SELECT_PRODUCTS(true)} WHERE p.product_id = $2`, [req.user ? req.user.user_id : 0, id]);
    if (!rows.length) throw new HttpError(404, 'Изделие не найдено');
    const [product] = await withPrices(rows, req.user && req.user.user_id);
    product.season = await one(
      `SELECT start_date::text, end_date::text FROM seasonal_prices
        WHERE product_id = $1 AND is_active AND CURRENT_DATE BETWEEN start_date AND end_date
        ORDER BY seasonal_price_id DESC LIMIT 1`, [id]);
    product.reviews = await query(
      `SELECT r.review_id, r.user_id, u.full_name, r.rating, r.comment, r.created_at
         FROM reviews r JOIN users u ON u.user_id = r.user_id
        WHERE r.product_id = $1 ORDER BY r.created_at DESC`, [id]);
    return product;
  });

  // Добавление изделия
  router.post('/api/products', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const values = validateProduct(req.body);
    const row = await one(
      `INSERT INTO products (title, description, material, type, base_price, photo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING product_id`, values);
    await log(me.user_id, 'Добавление изделия', `№${row.product_id} «${values[0]}»`);
    return row;
  });

  // Редактирование изделия
  router.put('/api/products/:id', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const id = toId(req.params.id);
    const values = validateProduct(req.body);
    const row = await one(
      `UPDATE products SET title=$1, description=$2, material=$3, type=$4, base_price=$5, photo=$6
        WHERE product_id = $7 RETURNING product_id`, [...values, id]);
    if (!row) throw new HttpError(404, 'Изделие не найдено');
    await log(me.user_id, 'Редактирование изделия', `№${id} «${values[0]}»`);
    return row;
  });

  // Удаление изделия
  router.delete('/api/products/:id', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const id = toId(req.params.id);
    const active = await one(
      `SELECT COUNT(*)::int AS n FROM preorders WHERE product_id = $1 AND status NOT IN ('Отгружен', 'Отменён')`, [id]);
    if (active.n > 0) throw new HttpError(409, `Нельзя удалить: по изделию есть незавершённые предзаказы (${active.n})`);
    const row = await one('DELETE FROM products WHERE product_id = $1 RETURNING title', [id]);
    if (!row) throw new HttpError(404, 'Изделие не найдено');
    await log(me.user_id, 'Удаление изделия', `№${id} «${row.title}»`);
    return { ok: true };
  });
};
