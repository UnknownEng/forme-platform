// Platform-owner admin API (/api/admin), used by /admin.
// One owner account protected by FORME_ADMIN_PASSWORD. Every change is written
// to the admin_audit table.
const crypto = require('node:crypto');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../engine');
const validate = require('../validate');
const { fail, readJson, parseCookies } = require('../http');
const { sha256 } = require('../auth');

const COOKIE = 'forme_admin';
const TTL_MS = 8 * 60 * 60 * 1000;
const PLANS = ['starter', 'growth', 'enterprise'];
const DAY = 86400000;
const BOOTED = Date.now();
const INSTANCE = crypto.randomBytes(4).toString('hex');

function register(router, { db, auth, services, config, limits }) {
  const enabled = () => typeof config.ADMIN_PASSWORD === 'string' && config.ADMIN_PASSWORD.length >= 12;
  const sign = p => crypto.createHmac('sha256', `${config.SESSION_SECRET}:admin`).update(p).digest('base64url');
  const cookie = (v, maxAge) => `${COOKIE}=${v}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.SECURE_COOKIES ? '; Secure' : ''}`;
  const audit = (ctx, action, target = null, detail = null) =>
    db.run('INSERT INTO admin_audit (action, target, detail, ip, created_at) VALUES (?,?,?,?,?)', action, target, detail ? JSON.stringify(detail) : null, ctx.ip, Date.now());

  const admin = ctx => {
    if (!enabled()) fail(503, 'admin_disabled', 'Admin is not configured. Set FORME_ADMIN_PASSWORD (12+ characters).');
    const raw = parseCookies(ctx.req)[COOKIE] || '';
    const i = raw.lastIndexOf('.');
    const payload = raw.slice(0, i), mac = raw.slice(i + 1);
    const good = i > 0 && mac.length === sign(payload).length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sign(payload)));
    if (!good || !payload.startsWith('admin.') || !(Number(payload.split('.')[1]) > Date.now())) fail(401, 'unauthenticated', 'Admin sign-in required.');
    if (ctx.req.method !== 'GET' && ctx.req.headers['x-forme-request'] !== '1') fail(403, 'csrf', 'Missing X-Forme-Request header.');
  };

  router.get('/api/admin/status', () => ({ enabled: enabled() }));

  router.post('/api/admin/login', async ctx => {
    if (!limits.auth(`admin:${ctx.ip}`).ok) fail(429, 'rate_limited', 'Too many attempts. Wait a minute and try again.');
    if (ctx.req.headers['x-forme-request'] !== '1') fail(403, 'csrf', 'Missing X-Forme-Request header.');
    if (!enabled()) fail(503, 'admin_disabled', 'Admin is not configured. Set FORME_ADMIN_PASSWORD (12+ characters).');
    const b = await readJson(ctx.req);
    const a = Buffer.from(sha256(String(b.password || ''))), e = Buffer.from(sha256(config.ADMIN_PASSWORD));
    if (!crypto.timingSafeEqual(a, e)) { await audit(ctx, 'login_failed'); fail(401, 'invalid_credentials', 'Wrong admin password.'); }
    const payload = `admin.${Date.now() + TTL_MS}`;
    ctx.res.extraHeaders = { 'Set-Cookie': cookie(`${payload}.${sign(payload)}`, TTL_MS / 1000) };
    await audit(ctx, 'login');
    return { ok: true };
  });
  router.post('/api/admin/logout', ctx => { ctx.res.extraHeaders = { 'Set-Cookie': cookie('', 0) }; return { ok: true }; });
  router.get('/api/admin/me', admin, () => ({ ok: true }));

  router.get('/api/admin/overview', admin, async () => {
    const now = Date.now();
    const n = async (sql, ...p) => Number((await db.get(sql, ...p)).n);
    const TZ = 5 * 3600 * 1000; // Pakistan time
    const dayStart = t => Math.floor((t + TZ) / DAY) * DAY - TZ;
    const since = dayStart(now) - 29 * DAY;
    const byDay = new Map();
    for (let i = 0; i < 30; i++) { const t = since + i * DAY; byDay.set(t, { date: new Date(t + TZ).toISOString().slice(0, 10), recs: 0, merchants: 0 }); }
    // Counted per day inside the database instead of loading every row.
    for (const r of await db.all(`SELECT (created_at + ${TZ}) / ${DAY} AS d, COUNT(*) AS c FROM recommendations WHERE created_at >= ? GROUP BY (created_at + ${TZ}) / ${DAY}`, since)) { const b = byDay.get(Number(r.d) * DAY - TZ); if (b) b.recs = Number(r.c); }
    for (const r of await db.all(`SELECT (created_at + ${TZ}) / ${DAY} AS d, COUNT(*) AS c FROM merchants WHERE created_at >= ? GROUP BY (created_at + ${TZ}) / ${DAY}`, since)) { const b = byDay.get(Number(r.d) * DAY - TZ); if (b) b.merchants = Number(r.c); }
    let dbBytes = 0;
    if (db.dialect === 'sqlite') for (const f of ['forme.db', 'forme.db-wal']) { try { dbBytes += fs.statSync(path.join(config.DATA_DIR, f)).size; } catch {} }
    else { try { dbBytes = Number((await db.get('SELECT pg_database_size(current_database()) AS n')).n); } catch {} }
    return {
      totals: {
        merchants: await n('SELECT COUNT(*) AS n FROM merchants'),
        suspended: await n('SELECT COUNT(*) AS n FROM merchants WHERE suspended_at IS NOT NULL'),
        active_30d: await n('SELECT COUNT(DISTINCT merchant_id) AS n FROM recommendations WHERE created_at >= ?', now - 30 * DAY),
        products: await n('SELECT COUNT(*) AS n FROM products'),
        profiles: await n('SELECT COUNT(*) AS n FROM profiles'),
        recommendations: await n('SELECT COUNT(*) AS n FROM recommendations'),
        recommendations_24h: await n('SELECT COUNT(*) AS n FROM recommendations WHERE created_at >= ?', now - DAY),
        events_24h: await n('SELECT COUNT(*) AS n FROM events WHERE created_at >= ?', now - DAY),
        feedback: await n('SELECT COUNT(*) AS n FROM feedback'),
        active_keys: await n('SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL'),
      },
      series: [...byDay.values()],
      top_merchants: (await db.all(`SELECT m.id, m.name, m.plan, COUNT(r.id) AS recs FROM merchants m LEFT JOIN recommendations r ON r.merchant_id = m.id AND r.created_at >= ?
        GROUP BY m.id, m.name, m.plan ORDER BY recs DESC LIMIT 6`, now - 30 * DAY)).map(r => ({ ...r, recs: Number(r.recs) })),
      system: {
        engine_version: config.ENGINE_VERSION, node: process.version, platform: `${os.platform()} ${os.arch()}`,
        instance: INSTANCE, uptime_s: Math.round((now - BOOTED) / 1000), memory_mb: Math.round(process.memoryUsage().rss / 1048576),
        db_mb: Math.round((dbBytes / 1048576) * 10) / 10, on_vercel: config.ON_VERCEL, database: db.dialect, persistent_storage: db.persistent && !(config.ON_VERCEL && db.dialect === 'sqlite'),
        secret_configured: !!process.env.FORME_SECRET,
      },
    };
  });

  router.get('/api/admin/merchants', admin, async ctx => {
    const q = (ctx.url.searchParams.get('q') || '').toLowerCase();
    return {
      merchants: (await db.all(`SELECT m.id, m.name, m.email, m.plan, m.created_at, m.suspended_at, m.allowed_origins,
          (SELECT COUNT(*) FROM products p WHERE p.merchant_id = m.id) AS products,
          (SELECT COUNT(*) FROM recommendations r WHERE r.merchant_id = m.id AND r.created_at >= ?) AS recs_30d,
          (SELECT MAX(created_at) FROM events e WHERE e.merchant_id = m.id) AS last_event,
          (SELECT COUNT(*) FROM api_keys k WHERE k.merchant_id = m.id AND k.revoked_at IS NULL) AS keys
        FROM merchants m WHERE (? = '' OR lower(m.name || ' ' || m.email) LIKE ? ESCAPE '\\') ORDER BY m.created_at DESC LIMIT 500`, Date.now() - 30 * DAY, q, `%${q.replace(/[\\%_]/g, c => '\\' + c)}%`))
        .map(m => ({ ...m, products: Number(m.products), recs_30d: Number(m.recs_30d), keys: Number(m.keys), last_event: m.last_event == null ? null : Number(m.last_event), allowed_origins: JSON.parse(m.allowed_origins) })),
      plans: PLANS,
    };
  });

  const merchantOr404 = async id => (await db.get('SELECT * FROM merchants WHERE id = ?', id)) || fail(404, 'not_found', 'Merchant not found.');
  const demoId = async () => (await db.get("SELECT value FROM meta WHERE key = 'demo_seeded'"))?.value;

  router.get('/api/admin/merchants/:id', admin, async ctx => {
    const m = await merchantOr404(ctx.params.id);
    const isDemo = m.id === await demoId();
    return {
      merchant: { id: m.id, name: m.name, email: m.email, plan: m.plan, created_at: m.created_at, suspended_at: m.suspended_at, return_cost: m.return_cost, currency: m.currency, allowed_origins: JSON.parse(m.allowed_origins), is_demo: isDemo },
      keys: await db.all('SELECT id, kind, label, prefix, created_at, last_used_at, revoked_at FROM api_keys WHERE merchant_id = ? ORDER BY created_at DESC', m.id),
      products: await db.all('SELECT sku, name, category, fit, updated_at FROM products WHERE merchant_id = ? ORDER BY updated_at DESC LIMIT 50', m.id),
      analytics: await services.analytics(m, 30),
    };
  });

  router.patch('/api/admin/merchants/:id', admin, async ctx => {
    const m = await merchantOr404(ctx.params.id);
    const b = await readJson(ctx.req);
    if (b.plan !== undefined) {
      if (!PLANS.includes(b.plan)) fail(400, 'invalid_plan', `plan must be one of: ${PLANS.join(', ')}`);
      await db.run('UPDATE merchants SET plan = ? WHERE id = ?', b.plan, m.id);
      await audit(ctx, 'set_plan', m.id, { from: m.plan, to: b.plan });
    }
    if (b.suspended !== undefined) {
      if (m.id === await demoId() && b.suspended) fail(400, 'protected', 'The demo workspace cannot be suspended.');
      await db.run('UPDATE merchants SET suspended_at = ? WHERE id = ?', b.suspended ? Date.now() : null, m.id);
      await audit(ctx, b.suspended ? 'suspend' : 'unsuspend', m.id, { name: m.name });
    }
    return { ok: true };
  });

  router.delete('/api/admin/merchants/:id', admin, async ctx => {
    const m = await merchantOr404(ctx.params.id);
    if (m.id === await demoId()) fail(400, 'protected', 'The demo workspace cannot be deleted.');
    await db.tx(async tx => {
      for (const t of ['recommendations', 'events', 'feedback', 'products', 'api_keys', 'sessions']) await tx.run(`DELETE FROM ${t} WHERE merchant_id = ?`, m.id);
      await tx.run('DELETE FROM merchants WHERE id = ?', m.id);
    });
    await audit(ctx, 'delete_merchant', m.id, { name: m.name, email: m.email });
    return { deleted: true };
  });

  // Support: open the console as this merchant. Recorded in the audit log.
  router.post('/api/admin/merchants/:id/impersonate', admin, async ctx => {
    const m = await merchantOr404(ctx.params.id);
    if (m.suspended_at) fail(400, 'suspended', 'Unsuspend the merchant first.');
    ctx.res.extraHeaders = { 'Set-Cookie': `forme_session=${await auth.createSession(m.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${config.SECURE_COOKIES ? '; Secure' : ''}` };
    await audit(ctx, 'impersonate', m.id, { name: m.name });
    return { ok: true, redirect: '/console#overview' };
  });

  router.delete('/api/admin/keys/:id', admin, async ctx => {
    const r = await db.run('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', Date.now(), ctx.params.id);
    if (!r.changes) fail(404, 'not_found', 'Key not found or already revoked.');
    await audit(ctx, 'revoke_key', ctx.params.id);
    return { ok: true };
  });

  router.get('/api/admin/activity', admin, async () => ({
    events: await db.all(`SELECT e.id, e.type, e.sku, e.size, e.value, e.created_at, m.name AS merchant FROM events e
      LEFT JOIN merchants m ON m.id = e.merchant_id ORDER BY e.id DESC LIMIT 60`),
  }));

  router.get('/api/admin/audit', admin, async () => ({ entries: await db.all('SELECT * FROM admin_audit ORDER BY id DESC LIMIT 200') }));

  router.get('/api/admin/products', admin, async () => ({
    products: await db.all('SELECT p.merchant_id, p.sku, p.name, p.category, p.fit, m.name AS merchant FROM products p JOIN merchants m ON m.id = p.merchant_id ORDER BY m.name, p.name LIMIT 1000'),
  }));

  // Engine playground: run the fit engine directly, without logging anything.
  router.post('/api/admin/engine/run', admin, async ctx => {
    const b = await readJson(ctx.req);
    let product;
    if (b.merchant_id && b.sku) {
      product = await services.products.get(b.merchant_id, b.sku);
      if (!product) fail(404, 'not_found', 'Product not found.');
    } else {
      const v = validate.product({ ...b.product, sku: 'playground', name: b.product?.name || 'Playground', brand: b.product?.brand || 'Playground' });
      if (v.error) fail(400, 'invalid_product', v.error);
      product = v.value;
    }
    const p = validate.profile(b.profile);
    if (p.error) fail(400, 'invalid_profile', p.error);
    const feedback = b.merchant_id && b.sku ? await services.feedbackCounts(b.merchant_id, b.sku) : {};
    const t0 = process.hrtime.bigint();
    const result = engine.recommend(product, p.value, b.ignore_feedback ? {} : feedback);
    const micros = Number(process.hrtime.bigint() - t0) / 1000;
    const body = engine.resolveBody(p.value);
    return { result, body: body.body, estimated: body.estimated, chart: product.chart, feedback, took_us: Math.round(micros) };
  });

  // Self-test of the running instance.
  router.get('/api/admin/health', admin, async () => {
    const checks = [];
    const check = async (name, fn) => { const t = Date.now(); try { const detail = await fn(); checks.push({ name, ok: true, ms: Date.now() - t, detail }); } catch (e) { checks.push({ name, ok: false, ms: Date.now() - t, detail: e.message }); } };
    await check('Database read', async () => `${Number((await db.get('SELECT COUNT(*) AS n FROM merchants')).n)} merchants (${db.dialect})`);
    await check('Database write', async () => { await db.run("INSERT INTO meta (key, value) VALUES ('health', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", String(Date.now())); return 'ok'; });
    await check('Fit engine', () => { const r = engine.recommend({ category: 'T-shirts', fit: 'Regular', chart: [{ size: 'M', chest: 104 }, { size: 'L', chest: 110 }] }, { height: 178, chest: 96 }); return `size ${r.size}, ${r.confidence}%`; });
    await check('Session secret', () => { if (config.ON_VERCEL && !process.env.FORME_SECRET) throw new Error('FORME_SECRET missing: logins will fail at random'); return 'configured'; });
    await check('Persistent storage', () => { if (config.ON_VERCEL && db.dialect === 'sqlite') throw new Error('Vercel /tmp is temporary: connect a Postgres database (DATABASE_URL) to keep sign-ups and events.'); return `${db.dialect}: ${db.location}`; });
    return { checks };
  });
}

module.exports = { register };
