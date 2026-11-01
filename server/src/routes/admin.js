// Администрирование: пользователи и роли, журнал, статистика спроса
const { query, one, log } = require('../db');
const { ROLES, hashPassword, requireRole } = require('../auth');
const { Validator, cleanPhone, toId } = require('../validate');
const { HttpError } = require('../router');
const { USER_FIELDS, getUser } = require('./auth');

module.exports = (router) => {
  router.get('/api/roles', async (req) => {
    requireRole(req, ROLES.ADMIN);
    return query('SELECT role_id, title FROM roles ORDER BY role_id');
  });

  router.get('/api/users', async (req) => {
    requireRole(req, ROLES.ADMIN);
    return query(`SELECT ${USER_FIELDS} FROM users u JOIN roles r ON r.role_id = u.role_id ORDER BY u.role_id, u.full_name`);
  });

  // Создание пользователя с назначением роли
  router.post('/api/users', async (req) => {
    const me = requireRole(req, ROLES.ADMIN);
    const v = new Validator(req.body).fullName().phone('phone', false).email().password()
      .number('role_id', 'Роль', { min: 1, max: 3, integer: true });
    v.check();
    const email = v.str('email').toLowerCase();
    if (await one('SELECT 1 FROM users WHERE LOWER(email) = $1', [email])) {
      throw new HttpError(409, 'Пользователь с таким e-mail уже существует', { email: 'E-mail уже занят' });
    }
    const row = await one(
      `INSERT INTO users (full_name, phone, email, password, role_id) VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
      [v.str('full_name'), cleanPhone(v.str('phone')) || null, email, hashPassword(v.str('password')), Number(req.body.role_id)]);
    await log(me.user_id, 'Создание пользователя', `${email}, роль №${req.body.role_id}`);
    return getUser(row.user_id);
  });

  // Изменение данных, роли, блокировка; корректировка баллов при сбоях
  router.put('/api/users/:id', async (req) => {
    const me = requireRole(req, ROLES.ADMIN);
    const id = toId(req.params.id);
    const v = new Validator(req.body).fullName().phone('phone', false).email()
      .number('role_id', 'Роль', { min: 1, max: 3, integer: true })
      .number('bonus_points', 'Баллы', { min: 0, max: 1000000, integer: true });
    if (id === me.user_id) {
      v.custom('role_id', Number(req.body.role_id) === ROLES.ADMIN, 'Нельзя снять роль администратора с самого себя');
      v.custom('is_blocked', !req.body.is_blocked, 'Нельзя заблокировать самого себя');
    }
    v.check();
    const email = v.str('email').toLowerCase();
    if (await one('SELECT 1 FROM users WHERE LOWER(email) = $1 AND user_id <> $2', [email, id])) {
      throw new HttpError(409, 'E-mail уже используется', { email: 'E-mail уже занят' });
    }
    const row = await one(
      `UPDATE users SET full_name=$1, phone=$2, email=$3, role_id=$4, is_blocked=$5, bonus_points=$6
        WHERE user_id = $7 RETURNING user_id`,
      [v.str('full_name'), cleanPhone(v.str('phone')) || null, email, Number(req.body.role_id),
        Boolean(req.body.is_blocked), Number(req.body.bonus_points), id]);
    if (!row) throw new HttpError(404, 'Пользователь не найден');
    if (req.body.new_password) {
      const pv = new Validator(req.body).password('new_password');
      pv.check();
      await query('UPDATE users SET password = $1 WHERE user_id = $2', [hashPassword(pv.str('new_password')), id]);
    }
    await log(me.user_id, 'Изменение пользователя', `№${id} (${email})${req.body.is_blocked ? ', заблокирован' : ''}`);
    return getUser(id);
  });

  router.patch('/api/users/:id/block', async (req) => {
    const me = requireRole(req, ROLES.ADMIN);
    const id = toId(req.params.id);
    if (id === me.user_id) throw new HttpError(400, 'Нельзя заблокировать самого себя');
    const row = await one('UPDATE users SET is_blocked = NOT is_blocked WHERE user_id = $1 RETURNING is_blocked, email', [id]);
    if (!row) throw new HttpError(404, 'Пользователь не найден');
    await log(me.user_id, row.is_blocked ? 'Блокировка пользователя' : 'Разблокировка пользователя', row.email, 'warning');
    return row;
  });

  router.delete('/api/users/:id', async (req) => {
    const me = requireRole(req, ROLES.ADMIN);
    const id = toId(req.params.id);
    if (id === me.user_id) throw new HttpError(400, 'Нельзя удалить самого себя');
    const row = await one('DELETE FROM users WHERE user_id = $1 RETURNING email', [id]);
    if (!row) throw new HttpError(404, 'Пользователь не найден');
    await log(me.user_id, 'Удаление пользователя', row.email, 'warning');
    return { ok: true };
  });

  // Журнал событий и ошибок
  router.get('/api/logs', async (req) => {
    requireRole(req, ROLES.ADMIN);
    const params = [];
    let where = '';
    if (['info', 'warning', 'error'].includes(req.query.level)) { params.push(req.query.level); where = 'WHERE l.level = $1'; }
    return query(
      `SELECT l.log_id, l.level, l.action, l.details, l.created_at, u.full_name, u.email
         FROM logs l LEFT JOIN users u ON u.user_id = l.user_id ${where}
        ORDER BY l.created_at DESC, l.log_id DESC LIMIT 300`, params);
  });

  // Аналитика спроса для кузнеца
  router.get('/api/stats', async (req) => {
    requireRole(req, ROLES.SMITH, ROLES.ADMIN);
    const totals = await one(
      `SELECT (SELECT COUNT(*) FROM products)::int AS products,
              (SELECT COUNT(*) FROM users WHERE role_id = 3)::int AS customers,
              (SELECT COUNT(*) FROM preorders)::int AS preorders,
              (SELECT COUNT(*) FROM preorders WHERE status NOT IN ('Отгружен','Отменён'))::int AS active_preorders,
              (SELECT COALESCE(SUM(final_price), 0) FROM preorders WHERE status = 'Отгружен')::float AS revenue,
              (SELECT COUNT(*) FROM favorites)::int AS favorites`);
    const favorites = await query(
      `SELECT p.product_id, p.title, COUNT(f.favorite_id)::int AS count
         FROM products p LEFT JOIN favorites f ON f.product_id = p.product_id
        GROUP BY p.product_id ORDER BY count DESC, p.title LIMIT 10`);
    const preorders = await query(
      `SELECT p.product_id, p.title, COUNT(o.preorder_id)::int AS count
         FROM products p LEFT JOIN preorders o ON o.product_id = p.product_id
        GROUP BY p.product_id ORDER BY count DESC, p.title LIMIT 10`);
    const statuses = await query(
      `SELECT status, COUNT(*)::int AS count FROM preorders GROUP BY status ORDER BY count DESC`);
    return { totals, favorites, preorders, statuses };
  });
};
