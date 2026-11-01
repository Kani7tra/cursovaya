// Загрузка настроек из файла .env (без сторонних библиотек)
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

module.exports = {
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:1234@localhost:5432/gigakuznya',
  jwtSecret: process.env.JWT_SECRET || 'GigaKuznya-dev-secret-2026',
  jwtHours: Number(process.env.JWT_HOURS || 24),
  // Балльная система: 10 баллов за каждые 1000 ₽; 1 балл = 1 % скидки, не более 30 %
  pointsPer1000: Number(process.env.POINTS_PER_1000 || 10),
  pointsMaxPercent: Number(process.env.POINTS_MAX_PERCENT || 30),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@gigakuznya.ru',
};
