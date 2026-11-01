// Избранное, предзаказы, баллы заказчиков
const { pool, query, one, log } = require('../db');
const { ROLES, requireRole } = require('../auth');
const { Validator, toId } = require('../validate');
const { HttpError } = require('../router');
const { CURRENT_PRICE_SQL, activeDiscounts, bestDiscount, calculate, pointsForOrder } = require('../pricing');

const STATUSES = ['Новый', 'Принят', 'В работе', 'Готов', 'Отгружен', 'Отменён'];

// Расчёт стоимости предзаказа для заказчика
async function quote(userId, productId, points) {
  const product = await one(
    `SELECT p.product_id, p.title, ${CURRENT_PRICE_SQL}::float AS current_price FROM products p WHERE p.product_id = $1`,
    [productId]);
  if (!product) throw new HttpError(404, 'Изделие не найдено');
  const user = await one('SELECT bonus_points FROM users WHERE user_id = $1', [userId]);
  const usable = Math.min(Math.max(0, Number(points) || 0), user.bonus_points);
  const discount = bestDiscount(product.current_price, productId, await activeDiscounts(userId));
  return { product, available_points: user.bonus_points, ...calculate(product.current_price, discount, usable) };
}

const ORDER_SELECT = `
  SELECT o.preorder_id, o.user_id, u.full_name, u.phone, u.email, o.product_id, p.title AS product_title,
         o.desired_date, o.comment, o.status, o.created_at, o.final_price::float AS final_price, o.points_used
    FROM preorders o
    JOIN users u ON u.user_id = o.user_id
    JOIN products p ON p.product_id = o.product_id`;

module.exports = (router) => {
  // ---------- Избранное ----------
  router.get('/api/favorites', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER);
    const rows = await query(
      `SELECT p.product_id, p.title, p.material, p.type, p.photo, p.base_price::float AS base_price,
              ${CURRENT_PRICE_SQL}::float AS current_price, f.added_at
         FROM favorites f JOIN products p ON p.product_id = f.product_id
        WHERE f.user_id = $1 ORDER BY f.added_at DESC`, [me.user_id]);
    const discounts = await activeDiscounts(me.user_id);
    return rows.map((p) => {
      const c = calculate(p.current_price, bestDiscount(p.current_price, p.product_id, discounts), 0);
      return { ...p, is_favorite: true, is_seasonal: p.current_price !== p.base_price, discount: c.discount, price: c.after_discount };
    });
  });

  router.post('/api/favorites', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER);
    const productId = toId(req.body.product_id);
    if (!(await one('SELECT 1 FROM products WHERE product_id = $1', [productId]))) throw new HttpError(404, 'Изделие не найдено');
    await query('INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [me.user_id, productId]);
    return { ok: true };
  });

  router.delete('/api/favorites/:productId', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER);
    await query('DELETE FROM favorites WHERE user_id = $1 AND product_id = $2', [me.user_id, toId(req.params.productId)]);
    return { ok: true };
  });

  // ---------- Предзаказы (заказчик) ----------
  router.get('/api/preorders/quote', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER);
    return quote(me.user_id, toId(req.query.product_id), req.query.points);
  });

  router.post('/api/preorders', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER);
    const v = new Validator(req.body)
      .number('product_id', 'Изделие', { min: 1, integer: true })
      .date('desired_date', 'Желаемая дата')
      .maxLen('comment', 1000, 'Комментарий')
      .number('points_used', 'Баллы', { min: 0, integer: true, required: false });
    const today = new Date().toISOString().slice(0, 10);
    v.custom('desired_date', v.str('desired_date') > today, 'Желаемая дата должна быть позже сегодняшнего дня');
    v.check();

    const q = await quote(me.user_id, Number(req.body.product_id), req.body.points_used);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO preorders (user_id, product_id, desired_date, comment, final_price, points_used)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING preorder_id`,
        [me.user_id, q.product.product_id, v.str('desired_date'), v.str('comment') || null, q.final_price, q.points_used]);
      if (q.points_used > 0) {
        await client.query('UPDATE users SET bonus_points = bonus_points - $1 WHERE user_id = $2', [q.points_used, me.user_id]);
      }
      await client.query('COMMIT');
      await log(me.user_id, 'Оформление предзаказа', `№${rows[0].preorder_id}, «${q.product.title}», ${q.final_price} ₽`);
      return { preorder_id: rows[0].preorder_id, ...q };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  router.get('/api/preorders/my', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER);
    return query(`${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [me.user_id]);
  });

  // Отмена своего предзаказа (только в статусе «Новый»)
  router.patch('/api/preorders/:id/cancel', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER);
    const id = toId(req.params.id);
    const order = await one('SELECT * FROM preorders WHERE preorder_id = $1 AND user_id = $2', [id, me.user_id]);
    if (!order) throw new HttpError(404, 'Предзаказ не найден');
    if (order.status !== 'Новый') throw new HttpError(409, 'Отменить можно только предзаказ в статусе «Новый»');
    await query(`UPDATE preorders SET status = 'Отменён' WHERE preorder_id = $1`, [id]);
    if (order.points_used > 0) await query('UPDATE users SET bonus_points = bonus_points + $1 WHERE user_id = $2', [order.points_used, me.user_id]);
    await log(me.user_id, 'Отмена предзаказа', `№${id}`);
    return { ok: true };
  });

  // ---------- Обработка предзаказов (кузнец) ----------
  router.get('/api/preorders', async (req) => {
    requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const params = [];
    let where = '';
    if (req.query.status && STATUSES.includes(req.query.status)) { params.push(req.query.status); where = 'WHERE o.status = $1'; }
    return query(`${ORDER_SELECT} ${where} ORDER BY o.created_at DESC`, params);
  });

  router.patch('/api/preorders/:id/status', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const id = toId(req.params.id);
    new Validator(req.body).oneOf('status', STATUSES, 'Статус').check();
    const status = req.body.status;
    const order = await one('SELECT * FROM preorders WHERE preorder_id = $1', [id]);
    if (!order) throw new HttpError(404, 'Предзаказ не найден');
    if (['Отгружен', 'Отменён'].includes(order.status) && me.role_id !== ROLES.ADMIN) {
      throw new HttpError(409, `Предзаказ уже завершён (статус «${order.status}»)`);
    }
    if (order.status === status) return { ok: true };

    await query('UPDATE preorders SET status = $1 WHERE preorder_id = $2', [status, id]);
    let note = `Статус вашего предзаказа №${id} изменён: «${status}».`;
    // Начисление баллов при отгрузке; возврат списанных баллов при отмене
    if (status === 'Отгружен') {
      const points = pointsForOrder(Number(order.final_price));
      if (points > 0) {
        await query('UPDATE users SET bonus_points = bonus_points + $1 WHERE user_id = $2', [points, order.user_id]);
        note += ` Начислено бонусных баллов: ${points}.`;
      }
    }
    if (status === 'Отменён' && order.points_used > 0) {
      await query('UPDATE users SET bonus_points = bonus_points + $1 WHERE user_id = $2', [order.points_used, order.user_id]);
      note += ` Списанные баллы (${order.points_used}) возвращены.`;
    }
    // Уведомление заказчику приходит сообщением от кузнеца
    await query('INSERT INTO messages (sender_id, receiver_id, message_text) VALUES ($1, $2, $3)', [me.user_id, order.user_id, note]);
    await log(me.user_id, 'Смена статуса предзаказа', `№${id}: «${order.status}» → «${status}»`);
    return { ok: true };
  });

  // Удаление предзаказа администратором (корректировка при сбоях)
  router.delete('/api/preorders/:id', async (req) => {
    const me = requireRole(req, ROLES.ADMIN);
    const id = toId(req.params.id);
    await query('DELETE FROM preorders WHERE preorder_id = $1', [id]);
    await log(me.user_id, 'Удаление предзаказа', `№${id}`, 'warning');
    return { ok: true };
  });

  // ---------- Заказчики и баллы (кузнец) ----------
  router.get('/api/customers', async (req) => {
    requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    return query(
      `SELECT u.user_id, u.full_name, u.phone, u.email, u.bonus_points, u.is_blocked,
              COUNT(o.preorder_id)::int AS orders_count,
              COALESCE(SUM(o.final_price) FILTER (WHERE o.status = 'Отгружен'), 0)::float AS total_spent
         FROM users u LEFT JOIN preorders o ON o.user_id = u.user_id
        WHERE u.role_id = $1
        GROUP BY u.user_id ORDER BY u.full_name`, [ROLES.CUSTOMER]);
  });

  router.post('/api/customers/:id/points', async (req) => {
    const me = requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const id = toId(req.params.id);
    const v = new Validator(req.body)
      .number('points', 'Количество баллов', { min: -10000, max: 10000, integer: true })
      .maxLen('reason', 200, 'Причина');
    v.custom('points', Number(req.body.points) !== 0, 'Количество баллов не может быть равно нулю');
    v.check();
    const points = Number(req.body.points);
    const user = await one('SELECT bonus_points FROM users WHERE user_id = $1 AND role_id = $2', [id, ROLES.CUSTOMER]);
    if (!user) throw new HttpError(404, 'Заказчик не найден');
    if (user.bonus_points + points < 0) throw new HttpError(400, 'Баланс баллов не может стать отрицательным', { points: `Доступно для списания: ${user.bonus_points}` });
    await query('UPDATE users SET bonus_points = bonus_points + $1 WHERE user_id = $2', [points, id]);
    const reason = v.str('reason');
    await query('INSERT INTO messages (sender_id, receiver_id, message_text) VALUES ($1, $2, $3)',
      [me.user_id, id, `${points > 0 ? 'Вам начислено' : 'Списано'} бонусных баллов: ${Math.abs(points)}.${reason ? ' Причина: ' + reason : ''}`]);
    await log(me.user_id, 'Начисление баллов', `Заказчику №${id}: ${points > 0 ? '+' : ''}${points}`);
    return { ok: true, bonus_points: user.bonus_points + points };
  });
};

module.exports.STATUSES = STATUSES;
