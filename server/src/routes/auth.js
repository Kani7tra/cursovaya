// Регистрация, вход, профиль пользователя
const { query, one, log } = require('../db');
const { ROLES, hashPassword, verifyPassword, signToken, requireRole } = require('../auth');
const { Validator, cleanPhone } = require('../validate');
const { HttpError } = require('../router');

const USER_FIELDS = `u.user_id, u.full_name, u.phone, u.email, u.role_id, r.title AS role,
                     u.is_blocked, u.bonus_points`;

async function getUser(id) {
  return one(`SELECT ${USER_FIELDS} FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = $1`, [id]);
}

function session(user) {
  return { token: signToken({ user_id: user.user_id, role_id: user.role_id }), user };
}

module.exports = (router) => {
  // Регистрация нового заказчика
  router.post('/api/auth/register', async (req) => {
    const v = new Validator(req.body).fullName().phone().email().password();
    v.custom('password_confirm', v.str('password') === v.str('password_confirm'), 'Пароли не совпадают');
    v.check();

    const email = v.str('email').toLowerCase();
    if (await one('SELECT 1 FROM users WHERE LOWER(email) = $1', [email])) {
      throw new HttpError(409, 'Пользователь с таким e-mail уже зарегистрирован', { email: 'E-mail уже занят' });
    }
    const created = await one(
      `INSERT INTO users (full_name, phone, email, password, role_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
      [v.str('full_name'), cleanPhone(v.str('phone')), email, hashPassword(v.str('password')), ROLES.CUSTOMER]
    );
    await log(created.user_id, 'Регистрация', `Зарегистрирован заказчик ${email}`);
    return session(await getUser(created.user_id));
  });

  // Вход по e-mail и паролю
  router.post('/api/auth/login', async (req) => {
    const v = new Validator(req.body).email().required('password', 'Пароль');
    v.check();
    const row = await one('SELECT user_id, password, is_blocked FROM users WHERE LOWER(email) = $1', [v.str('email').toLowerCase()]);
    if (!row || !verifyPassword(v.str('password'), row.password)) {
      await log(null, 'Неудачный вход', v.str('email'), 'warning');
      throw new HttpError(401, 'Неверный e-mail или пароль');
    }
    if (row.is_blocked) throw new HttpError(403, 'Учётная запись заблокирована администратором');
    await log(row.user_id, 'Вход в систему');
    return session(await getUser(row.user_id));
  });

  // Текущий пользователь
  router.get('/api/auth/me', async (req) => {
    const me = requireRole(req);
    const user = await getUser(me.user_id);
    if (!user || user.is_blocked) throw new HttpError(401, 'Сессия недействительна');
    return user;
  });

  // Редактирование профиля
  router.put('/api/profile', async (req) => {
    const me = requireRole(req);
    const v = new Validator(req.body).fullName().phone().email();
    v.check();
    const email = v.str('email').toLowerCase();
    if (await one('SELECT 1 FROM users WHERE LOWER(email) = $1 AND user_id <> $2', [email, me.user_id])) {
      throw new HttpError(409, 'Этот e-mail уже используется', { email: 'E-mail уже занят' });
    }
    await query('UPDATE users SET full_name = $1, phone = $2, email = $3 WHERE user_id = $4',
      [v.str('full_name'), cleanPhone(v.str('phone')), email, me.user_id]);
    await log(me.user_id, 'Изменение профиля');
    return getUser(me.user_id);
  });

  // Смена пароля
  router.put('/api/profile/password', async (req) => {
    const me = requireRole(req);
    const v = new Validator(req.body).required('old_password', 'Текущий пароль').password('new_password');
    v.custom('new_password_confirm', v.str('new_password') === v.str('new_password_confirm'), 'Пароли не совпадают');
    v.check();
    const row = await one('SELECT password FROM users WHERE user_id = $1', [me.user_id]);
    if (!verifyPassword(v.str('old_password'), row.password)) {
      throw new HttpError(400, 'Текущий пароль указан неверно', { old_password: 'Неверный пароль' });
    }
    await query('UPDATE users SET password = $1 WHERE user_id = $2', [hashPassword(v.str('new_password')), me.user_id]);
    await log(me.user_id, 'Смена пароля');
    return { ok: true };
  });
};

module.exports.getUser = getUser;
module.exports.USER_FIELDS = USER_FIELDS;
