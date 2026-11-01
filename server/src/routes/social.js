// Сообщения (заказчик ↔ кузнец) и отзывы об изделиях
const { query, one, log } = require('../db');
const { ROLES, requireRole } = require('../auth');
const { Validator, toId } = require('../validate');
const { HttpError } = require('../router');

// С кем пользователь может переписываться: заказчик — с кузнецами, кузнец — с заказчиками
const partnerRoles = (roleId) => (roleId === ROLES.CUSTOMER ? [ROLES.SMITH] : [ROLES.CUSTOMER]);

module.exports = (router) => {
  // ---------- Сообщения ----------
  // Список диалогов
  router.get('/api/messages/dialogs', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER, ROLES.SMITH);
    return query(
      `WITH pairs AS (
         SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS partner_id, message_id, message_text, send_at
           FROM messages WHERE sender_id = $1 OR receiver_id = $1
       ), last AS (
         SELECT DISTINCT ON (partner_id) partner_id, message_text, send_at FROM pairs ORDER BY partner_id, send_at DESC, message_id DESC
       )
       SELECT l.partner_id, u.full_name, r.title AS role, l.message_text AS last_message, l.send_at,
              (SELECT COUNT(*) FROM messages m WHERE m.sender_id = l.partner_id AND m.receiver_id = $1 AND NOT m.is_read)::int AS unread
         FROM last l JOIN users u ON u.user_id = l.partner_id JOIN roles r ON r.role_id = u.role_id
        ORDER BY l.send_at DESC`, [me.user_id]);
  });

  // Кому можно написать (для создания нового диалога)
  router.get('/api/messages/partners', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER, ROLES.SMITH);
    return query(
      `SELECT user_id, full_name FROM users WHERE role_id = ANY($1) AND NOT is_blocked ORDER BY full_name`,
      [partnerRoles(me.role_id)]);
  });

  router.get('/api/messages/unread', async (req) => {
    const me = requireRole(req);
    return one('SELECT COUNT(*)::int AS count FROM messages WHERE receiver_id = $1 AND NOT is_read', [me.user_id]);
  });

  // История переписки с собеседником (входящие помечаются прочитанными)
  router.get('/api/messages/:partnerId', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER, ROLES.SMITH);
    const partnerId = toId(req.params.partnerId);
    const partner = await one('SELECT user_id, full_name FROM users WHERE user_id = $1', [partnerId]);
    if (!partner) throw new HttpError(404, 'Собеседник не найден');
    await query('UPDATE messages SET is_read = TRUE WHERE sender_id = $1 AND receiver_id = $2 AND NOT is_read', [partnerId, me.user_id]);
    const messages = await query(
      `SELECT message_id, sender_id, receiver_id, message_text, send_at, is_read FROM messages
        WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
        ORDER BY send_at, message_id`, [me.user_id, partnerId]);
    return { partner, messages };
  });

  router.post('/api/messages', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER, ROLES.SMITH);
    const v = new Validator(req.body)
      .number('receiver_id', 'Получатель', { min: 1, integer: true })
      .required('message_text', 'Сообщение').maxLen('message_text', 2000, 'Сообщение');
    v.check();
    const receiver = await one('SELECT role_id, is_blocked FROM users WHERE user_id = $1', [Number(req.body.receiver_id)]);
    if (!receiver || receiver.is_blocked) throw new HttpError(404, 'Получатель не найден');
    if (!partnerRoles(me.role_id).includes(receiver.role_id)) throw new HttpError(403, 'Переписка с этим пользователем недоступна');
    return one(
      `INSERT INTO messages (sender_id, receiver_id, message_text) VALUES ($1, $2, $3)
       RETURNING message_id, sender_id, receiver_id, message_text, send_at, is_read`,
      [me.user_id, Number(req.body.receiver_id), v.str('message_text')]);
  });

  // ---------- Отзывы ----------
  const validateReview = (body) => {
    const v = new Validator(body)
      .number('rating', 'Оценка', { min: 1, max: 5, integer: true })
      .maxLen('comment', 1000, 'Текст отзыва');
    v.check();
    return [Number(body.rating), v.str('comment') || null];
  };

  router.post('/api/products/:id/reviews', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER);
    const productId = toId(req.params.id);
    const [rating, comment] = validateReview(req.body);
    if (!(await one('SELECT 1 FROM products WHERE product_id = $1', [productId]))) throw new HttpError(404, 'Изделие не найдено');
    if (await one('SELECT 1 FROM reviews WHERE user_id = $1 AND product_id = $2', [me.user_id, productId])) {
      throw new HttpError(409, 'Вы уже оставили отзыв на это изделие — его можно отредактировать');
    }
    const row = await one(
      'INSERT INTO reviews (user_id, product_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING review_id',
      [me.user_id, productId, rating, comment]);
    await log(me.user_id, 'Отзыв', `Добавлен отзыв к изделию №${productId}`);
    return row;
  });

  router.put('/api/reviews/:id', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER);
    const id = toId(req.params.id);
    const [rating, comment] = validateReview(req.body);
    const row = await one('UPDATE reviews SET rating = $1, comment = $2 WHERE review_id = $3 AND user_id = $4 RETURNING review_id',
      [rating, comment, id, me.user_id]);
    if (!row) throw new HttpError(404, 'Отзыв не найден');
    return row;
  });

  router.delete('/api/reviews/:id', async (req) => {
    const me = requireRole(req, ROLES.CUSTOMER, ROLES.ADMIN);
    const id = toId(req.params.id);
    const row = me.role_id === ROLES.ADMIN
      ? await one('DELETE FROM reviews WHERE review_id = $1 RETURNING review_id', [id])
      : await one('DELETE FROM reviews WHERE review_id = $1 AND user_id = $2 RETURNING review_id', [id, me.user_id]);
    if (!row) throw new HttpError(404, 'Отзыв не найден');
    await log(me.user_id, 'Удаление отзыва', `№${id}`);
    return { ok: true };
  });
};
