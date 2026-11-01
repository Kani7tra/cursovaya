// Хэширование паролей (scrypt) и JWT-токены на встроенном модуле crypto
const crypto = require('crypto');
const config = require('./config');
const { HttpError } = require('./router');

const ROLES = { ADMIN: 1, SMITH: 2, CUSTOMER: 3 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [, salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(hash, 'hex');
  return original.length === check.length && crypto.timingSafeEqual(original, check);
}

const b64url = (data) => Buffer.from(data).toString('base64url');

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + config.jwtHours * 3600;
  const body = b64url(JSON.stringify({ ...payload, exp }));
  const signature = crypto.createHmac('sha256', config.jwtSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (expected.length !== parts[2].length ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// Достаёт пользователя из заголовка Authorization (если он есть)
function readUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return token ? verifyToken(token) : null;
}

// Проверка доступа: requireRole() — любой вошедший, requireRole(1, 2) — только указанные роли
function requireRole(req, ...roles) {
  if (!req.user) throw new HttpError(401, 'Необходимо войти в систему');
  if (roles.length && !roles.includes(req.user.role_id)) {
    throw new HttpError(403, 'Недостаточно прав для этого действия');
  }
  return req.user;
}

module.exports = { ROLES, hashPassword, verifyPassword, signToken, verifyToken, readUser, requireRole };
