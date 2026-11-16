const http = require('node:http');
const config = require('./config');
const { open } = require('./db');
const { createAuth } = require('./auth');
const { createServices } = require('./services');
const { seedDemo } = require('./seed');
const { HttpError, createRouter, send, rateLimiter, serveStatic } = require('./http');
const openapi = require('./openapi');

const PAGES = { '/': '/index.html', '/console': '/console.html', '/demo': '/demo.html', '/docs': '/docs.html', '/admin': '/admin.html', '/privacy': '/privacy.html' };

function createApp(overrides = {}) {
  const cfg = { ...config, ...overrides };
  // The database opens asynchronously (Postgres needs a network connection). Routes get
  // a stable handle that forwards to it; every request waits for `ready` first.
  let real = null;
  const db = {
    get: (...a) => real.get(...a), all: (...a) => real.all(...a), run: (...a) => real.run(...a),
    tx: fn => real.tx(fn), withLock: (n, fn) => real.withLock(n, fn),
    get dialect() { return real?.dialect; }, get persistent() { return real?.persistent; }, get location() { return real?.location; },
    close: async () => { if (real) await real.close(); },
  };
  require('node:fs').mkdirSync(cfg.DATA_DIR, { recursive: true });
  // Local runs without FORME_ADMIN_PASSWORD get a generated password, saved once in the data folder.
  if (cfg.ADMIN_PASSWORD === null) {
    const file = require('node:path').join(cfg.DATA_DIR, 'admin-password.txt');
    try { cfg.ADMIN_PASSWORD = require('node:fs').readFileSync(file, 'utf8').trim(); }
    catch { cfg.ADMIN_PASSWORD = require('node:crypto').randomBytes(12).toString('base64url'); require('node:fs').writeFileSync(file, cfg.ADMIN_PASSWORD, { mode: 0o600 }); }
    cfg.ADMIN_PASSWORD_FILE = file;
  }
  const auth = createAuth(db, { sessionTtlMs: cfg.SESSION_TTL_MS, secret: cfg.SESSION_SECRET });
  const services = createServices(db);
  const ready = (async () => {
    real = await open(cfg);
    if (cfg.SEED_DEMO) await seedDemo(db, auth, cfg.DEMO_ACCOUNT);
  })();
  ready.catch(e => console.error('[forme] database start-up failed:', e.message));

  const limits = {
    auth: rateLimiter({ windowMs: 60_000, max: 12 }),
    api: rateLimiter({ windowMs: 60_000, max: 600 }),
    ip: rateLimiter({ windowMs: 60_000, max: 1200 }),
    profiles: rateLimiter({ windowMs: 60 * 60_000, max: 20 }),
  };
  const selfOrigin = req => `${cfg.SECURE_COOKIES ? 'https' : 'http'}://${req.headers.host}`;
  const router = createRouter();
  const deps = { db, auth, services, config: cfg, limits, selfOrigin };
  require('./routes/console').register(router, deps);
  require('./routes/public').register(router, deps);
  require('./routes/admin').register(router, deps);

  const spec = openapi(cfg.ENGINE_VERSION);
  router.get('/openapi.json', () => spec);
  router.get('/demo-config.json', async () => {
    const mid = (await db.get("SELECT value FROM meta WHERE key = 'demo_seeded'"))?.value;
    const key = mid && await db.get("SELECT public_token FROM api_keys WHERE merchant_id = ? AND kind = 'public' AND revoked_at IS NULL ORDER BY created_at LIMIT 1", mid);
    if (!key) return { status: 404, body: { error: { code: 'no_demo', message: 'Demo workspace is not installed.' } } };
    return { publicKey: key.public_token, products: (await services.products.list(mid)).map(p => ({ sku: p.sku, name: p.name, brand: p.brand, category: p.category, fit: p.fit, price: p.price, description: p.description, color: p.color, sizes: p.chart.map(r => r.size) })) };
  });

  const handler = async (req, res) => {
    const started = Date.now();
    try { await ready; } catch (e) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '10' });
      return res.end(JSON.stringify({ error: { code: 'database_unavailable', message: 'The database is not reachable right now. Please try again shortly.' } }));
    }
    const url = new URL(req.url, 'http://localhost');
    const isApi = url.pathname.startsWith('/v1/') || url.pathname.startsWith('/api/');
    // Behind a trusted proxy, use the address the proxy itself saw. Clients can put
    // anything at the start of X-Forwarded-For, so only the last hop (or Vercel's
    // x-real-ip, which it sets itself) is trusted.
    let ip = req.socket?.remoteAddress || 'unknown';
    if (cfg.TRUST_PROXY) {
      const hops = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
      ip = String(req.headers['x-real-ip'] || '').trim() || hops[hops.length - 1] || ip;
    }
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
      if (m?.methodNotAllowed) { res.extraHeaders.Allow = m.allow; throw new HttpError(405, 'method_not_allowed', `${req.method} is not supported here.`); }
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
      } else if (req.method !== 'GET' && req.method !== 'HEAD' && serveStatic.exists?.(cfg.PUBLIC_DIR, url.pathname, PAGES)) {
        res.extraHeaders.Allow = 'GET, HEAD';
        throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');
      } else if (req.method !== 'GET' && req.method !== 'HEAD') {
        throw new HttpError(404, 'not_found', 'Not found.');
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
  server.on('close', () => { db.close().catch(() => {}); });
  return { server, handler, ready, db, auth, services, config: cfg };
}

module.exports = { createApp };
