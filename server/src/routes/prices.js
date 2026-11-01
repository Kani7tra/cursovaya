// Сезонные цены и скидки (управляет кузнец)
const { query, one, log } = require('../db');
const { ROLES, requireRole } = require('../auth');
const { Validator, toNumber, toId } = require('../validate');
const { HttpError } = require('../router');

const bool = (v) => v === true || v === 'true' || v === 1 || v === '1';

async function productExists(id) {
  if (!(await one('SELECT 1 FROM products WHERE product_id = $1', [id]))) {
    throw new HttpError(400, 'Выбранное изделие не существует', { product_id: 'Изделие не найдено' });
  }
}

function validateSeasonal(body) {
  const v = new Validator(body)
    .number('product_id', 'Изделие', { min: 1, integer: true })
    .number('seasonal_price', 'Сезонная цена', { min: 1, max: 99999999 })
    .date('start_date', 'Дата начала')
    .date('end_date', 'Дата окончания');
  v.custom('end_date', v.str('end_date') >= v.str('start_date'), 'Дата окончания не может быть раньше даты начала');
  v.check();
  return [Number(body.product_id), toNumber(body.seasonal_price), v.str('start_date'), v.str('end_date'), bool(body.is_active)];
}

function validateDiscount(body) {
  const v = new Validator(body)
    .required('title', 'Название').maxLen('title', 128, 'Название')
    .oneOf('discount_type', ['percent', 'fixed'], 'Тип скидки')
    .number('amount', 'Размер скидки', { min: 0.01, max: body.discount_type === 'percent' ? 100 : 99999999 })
    .number('product_id', 'Изделие', { min: 1, integer: true, required: false })
    .number('user_id', 'Заказчик', { min: 1, integer: true, required: false })
    .date('start_date', 'Дата начала')
    .date('end_date', 'Дата окончания');
  v.custom('end_date', v.str('end_date') >= v.str('start_date'), 'Дата окончания не может быть раньше даты начала');
  v.check();
  return [v.str('title'), v.str('discount_type'), toNumber(body.amount),
    toNumber(body.product_id), toNumber(body.user_id), v.str('start_date'), v.str('end_date'), bool(body.is_active)];
}

module.exports = (router) => {
  // ---------- Сезонные цены ----------
  router.get('/api/seasonal-prices', async (req) => {
    requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    return query(
      `SELECT sp.seasonal_price_id, sp.product_id, p.title AS product_title, p.base_price::float AS base_price,
              sp.seasonal_price::float AS seasonal_price, sp.start_date::text, sp.end_date::text, sp.is_active,
              (sp.is_active AND CURRENT_DATE BETWEEN sp.start_date AND sp.end_date) AS is_current
         FROM seasonal_prices sp JOIN products p ON p.product_id = sp.product_id
        ORDER BY sp.start_date DESC`);
  });

  router.post('/api/seasonal-prices', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const values = validateSeasonal(req.body);
    await productExists(values[0]);
    const row = await one(
      `INSERT INTO seasonal_prices (product_id, seasonal_price, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING seasonal_price_id`, values);
    await log(me.user_id, 'Сезонная цена', `Добавлена для изделия №${values[0]}: ${values[1]} ₽`);
    return row;
  });

  router.put('/api/seasonal-prices/:id', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const id = toId(req.params.id);
    const values = validateSeasonal(req.body);
    await productExists(values[0]);
    const row = await one(
      `UPDATE seasonal_prices SET product_id=$1, seasonal_price=$2, start_date=$3, end_date=$4, is_active=$5
        WHERE seasonal_price_id = $6 RETURNING seasonal_price_id`, [...values, id]);
    if (!row) throw new HttpError(404, 'Сезонная цена не найдена');
    await log(me.user_id, 'Сезонная цена', `Изменена запись №${id}`);
    return row;
  });

  router.delete('/api/seasonal-prices/:id', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const id = toId(req.params.id);
    await query('DELETE FROM seasonal_prices WHERE seasonal_price_id = $1', [id]);
    await log(me.user_id, 'Сезонная цена', `Удалена запись №${id}`);
    return { ok: true };
  });

  // ---------- Скидки ----------
  router.get('/api/discounts', async (req) => {
    requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    return query(
      `SELECT d.discount_id, d.title, d.discount_type, d.amount::float AS amount, d.product_id, p.title AS product_title,
              d.user_id, u.full_name AS user_name, d.start_date::text, d.end_date::text, d.is_active,
              (d.is_active AND CURRENT_DATE BETWEEN d.start_date AND d.end_date) AS is_current
         FROM discounts d
         LEFT JOIN products p ON p.product_id = d.product_id
         LEFT JOIN users u ON u.user_id = d.user_id
        ORDER BY d.start_date DESC`);
  });

  router.post('/api/discounts', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const values = validateDiscount(req.body);
    if (values[3]) await productExists(values[3]);
    const row = await one(
      `INSERT INTO discounts (title, discount_type, amount, product_id, user_id, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING discount_id`, values);
    await log(me.user_id, 'Скидка', `Создана «${values[0]}»`);
    return row;
  });

  router.put('/api/discounts/:id', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const id = toId(req.params.id);
    const values = validateDiscount(req.body);
    if (values[3]) await productExists(values[3]);
    const row = await one(
      `UPDATE discounts SET title=$1, discount_type=$2, amount=$3, product_id=$4, user_id=$5,
              start_date=$6, end_date=$7, is_active=$8
        WHERE discount_id = $9 RETURNING discount_id`, [...values, id]);
    if (!row) throw new HttpError(404, 'Скидка не найдена');
    await log(me.user_id, 'Скидка', `Изменена «${values[0]}»`);
    return row;
  });

  router.delete('/api/discounts/:id', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const id = toId(req.params.id);
    await query('DELETE FROM discounts WHERE discount_id = $1', [id]);
    await log(me.user_id, 'Скидка', `Удалена запись №${id}`);
    return { ok: true };
  });
};
