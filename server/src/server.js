// Точка входа сервера ИС «ГигаКузня»: общий REST API для веб- и мобильного приложения
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./config');
const { log } = require('./db');
const { readUser } = require('./auth');
const { Router, HttpError } = require('./router');

const router = new Router();
require('./routes/auth')(router);
require('./routes/products')(router);
require('./routes/prices')(router);
require('./routes/orders')(router);
require('./routes/social')(router);
require('./routes/admin')(router);

router.get('/api/info', async () => ({
  name: 'ГигаКузня',
  admin_email: config.adminEmail,
  phone: '+7 (495) 123-45-67',
  address: 'г. Москва, ул. Кузнечная, д. 7',
  points_per_1000: config.pointsPer1000,
  points_max_percent: config.pointsMaxPercent,
}));

const WEB_DIST = path.join(__dirname, '..', '..', 'web', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 6 * 1024 * 1024) { reject(new HttpError(413, 'Слишком большой запрос')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Некорректный JSON')); }
    });
    req.on('error', reject);
  });
}

// Раздача собранного сайта (web/dist) с переходом на index.html для маршрутов SPA
function serveStatic(req, res, pathname) {
  if (!fs.existsSync(WEB_DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('API ГигаКузня работает. Сайт не собран: выполните «npm run build» в папке web.');
  }
  let file = path.normalize(path.join(WEB_DIST, decodeURIComponent(pathname)));
  if (!file.startsWith(WEB_DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(WEB_DIST, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  // CORS — чтобы мобильное приложение и dev-сервер сайта могли обращаться к API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

  try {
    const found = router.match(req.method, url.pathname);
    if (!found) throw new HttpError(404, 'Метод API не найден');
    req.params = found.params;
    req.query = Object.fromEntries(url.searchParams);
    req.body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
    req.user = readUser(req);
    const data = await found.handler(req);
    send(res, 200, data === undefined ? { ok: true } : data);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message, fields: err.fields });
    console.error(err);
    await log(req.user && req.user.user_id, 'Ошибка сервера', `${req.method} ${url.pathname}: ${err.message}`, 'error');
    send(res, 500, { error: 'Внутренняя ошибка сервера. Попробуйте позже.' });
  }
});

server.listen(config.port, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\n  ГигаКузня запущена:`);
  console.log(`  - на этом компьютере:  http://localhost:${config.port}`);
  ips.forEach((ip) => console.log(`  - в локальной сети:    http://${ip}:${config.port}  (адрес для телефона)`));
  console.log('');
});
