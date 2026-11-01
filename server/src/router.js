// Простой маршрутизатор REST API на встроенном модуле http
class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields; // ошибки по полям формы (валидация)
  }
}

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; }) + '/?$'
    );
    this.routes.push({ method, regex, keys, handler });
  }

  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  put(p, h) { this.add('PUT', p, h); }
  patch(p, h) { this.add('PATCH', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = pathname.match(route.regex);
      if (m) {
        const params = {};
        route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

module.exports = { Router, HttpError };
