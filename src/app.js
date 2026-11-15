const http = require('node:http');
const config = require('./config');
const { open } = require('./db');
const { createAuth } = require('./auth');
const { createServices } = require('./services');
const { seedDemo } = require('./seed');
const { HttpError, createRouter, send, rateLimiter, serveStatic } = require('./http');
const openapi = require('./openapi');

const PAGES = { '/': '/index.html', '/console': '/console.html', '/demo': '/demo.html', '/docs': '/docs.html' };

function createApp(overrides = {}) {
  const cfg = { ...config, ...overrides };
  const db = open(cfg.DATA_DIR);
  const auth = createAuth(db, { sessionTtlMs: cfg.SESSION_TTL_MS, secret: cfg.SESSION_SECRET });
  const services = createServices(db);
  if (cfg.SEED_DEMO) seedDemo(db, auth, cfg.DEMO_ACCOUNT);

  const limits = {
    auth: rateLimiter({ windowMs: 60_000, max: 12 }),
    api: rateLimiter({ windowMs: 60_000, max: 600 }),
    ip: rateLimiter({ windowMs: 60_000, max: 1200 }),
  };
  const selfOrigin = req => `${cfg.SECURE_COOKIES ? 'https' : 'http'}://${req.headers.host}`;
  const router = createRouter();
  const deps = { db, auth, services, config: cfg, limits, selfOrigin };
  require('./routes/console').register(router, deps);
  require('./routes/public').register(router, deps);

  const spec = openapi(cfg.ENGINE_VERSION);
  router.get('/openapi.json', () => spec);
  router.get('/demo-config.json', () => {
    const mid = db.get("SELECT value FROM meta WHERE key = 'demo_seeded'")?.value;
    const key = mid && db.get("SELECT public_token FROM api_keys WHERE merchant_id = ? AND kind = 'public' AND revoked_at IS NULL ORDER BY created_at LIMIT 1", mid);
    if (!key) return { status: 404, body: { error: { code: 'no_demo', message: 'Demo workspace is not installed.' } } };
    return { publicKey: key.public_token, products: services.products.list(mid).map(p => ({ sku: p.sku, name: p.name, brand: p.brand, category: p.category, fit: p.fit, price: p.price, description: p.description, color: p.color })) };
  });

  const handler = async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, 'http://localhost');
    const isApi = url.pathname.startsWith('/v1/') || url.pathname.startsWith('/api/');
    // Behind Vercel's proxy the client address is the first X-Forwarded-For entry.
    const ip = (cfg.TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket?.remoteAddress || 'unknown';
    res.extraHeaders = {};

    if (url.pathname.startsWith('/v1/')) {
      // CORS for the widget. Origin allow-lists are enforced per key in the route.
      const origin = req.headers.origin;
      if (origin) Object.assign(res.extraHeaders, { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Expose-Headers': 'X-RateLimit-Remaining' });
      if (req.method === 'OPTIONS') {
        return send(res, 204, '', { 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Forme-Key, X-Forme-Profile', 'Access-Control-Max-Age': '600' });
      }
    }

    if (!limits.ip(ip).ok) return send(res, 429, { error: { code: 'rate_limited', message: 'Too many requests from this address.' } });

    const ctx = { req, res, url, ip, auth, params: {} };
    try {
      const m = router.match(req.method, url.pathname);
      if (m?.methodNotAllowed) throw new HttpError(405, 'method_not_allowed', `${req.method} is not supported here.`);
      if (m) {
        ctx.params = m.params;
        let out;
        for (const h of m.handlers) out = await h(ctx);
        const isWrapped = out && typeof out === 'object' && 'status' in out && 'body' in out;
        send(res, isWrapped ? out.status : 200, isWrapped ? out.body : out);
      } else if (isApi) {
        throw new HttpError(404, 'not_found', 'No such endpoint. See /docs.');
      } else if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(cfg.PUBLIC_DIR, req, res, url.pathname, PAGES)) {
        // served
      } else if (req.method !== 'GET' && req.method !== 'HEAD') {
        throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');
      } else {
        serveStatic(cfg.PUBLIC_DIR, req, res, '/404.html', {}, 404) || send(res, 404, 'Not found');
      }
    } catch (e) {
      if (e instanceof HttpError) send(res, e.status, { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } });
      else if (/^(height|size chart)/.test(e.message)) send(res, 400, { error: { code: 'engine_input', message: e.message } });
      else { console.error(e); send(res, 500, { error: { code: 'internal', message: 'Something went wrong on our side.' } }); }
    }
    if (isApi && cfg.LOG_REQUESTS !== false) console.log(`${new Date().toISOString()} ${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
  };

  const server = http.createServer(handler);
  server.on('close', () => db.close());
  return { server, handler, db, auth, services, config: cfg };
}

module.exports = { createApp };
