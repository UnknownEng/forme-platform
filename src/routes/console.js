// Merchant console API: cookie session auth, used by /console.
const validate = require('../validate');
const engine = require('../engine');
const { fail, readJson, parseCookies } = require('../http');
const { id, hashPassword, verifyPassword, DUMMY_HASH } = require('../auth');

const COOKIE = 'forme_session';

function publicMerchant(m) {
  return {
    id: m.id, name: m.name, email: m.email, plan: m.plan, currency: m.currency, return_cost: m.return_cost,
    allowed_origins: JSON.parse(m.allowed_origins), widget: { accent: '#c6ff3d', position: 'inline', label: 'Find my size', ...JSON.parse(m.widget) },
    created_at: m.created_at,
  };
}

function register(router, { db, auth, services, config, limits }) {
  const cookie = (value, maxAgeSec) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${config.SECURE_COOKIES ? '; Secure' : ''}`;

  // Session + CSRF guard. Mutating calls must carry a custom header, which a
  // cross-site form or image cannot add, on top of the SameSite=Lax cookie.
  const session = async ctx => {
    const m = await auth.sessionMerchant(parseCookies(ctx.req)[COOKIE]);
    if (!m) fail(401, 'unauthenticated', 'Sign in to continue.');
    if (ctx.req.method !== 'GET' && ctx.req.headers['x-forme-request'] !== '1') fail(403, 'csrf', 'Missing X-Forme-Request header.');
    ctx.merchant = m;
  };
  const demoId = async () => (await db.get("SELECT value FROM meta WHERE key = 'demo_seeded'"))?.value;
  const writable = async ctx => {
    if (ctx.merchant.id === await demoId()) fail(403, 'demo_read_only', 'The demo workspace is read-only, so it stays the same for every visitor. Apply for a pilot to get your own workspace.');
  };
  const authLimit = ctx => {
    if (!limits.auth.peek(ctx.ip).ok) fail(429, 'rate_limited', 'Too many attempts. Wait a minute and try again.');
    if (ctx.req.url.startsWith('/api/auth/signup')) limits.auth(ctx.ip);
    if (ctx.req.headers['x-forme-request'] !== '1') fail(403, 'csrf', 'Missing X-Forme-Request header.');
  };

  router.get('/api/auth/config', () => ({ signups_open: !!config.SIGNUPS_OPEN }));

  router.post('/api/auth/signup', authLimit, async ctx => {
    if (!config.SIGNUPS_OPEN) fail(503, 'signups_closed', 'New accounts open after the pilot phase. Explore the demo workspace, or apply for a free pilot.');
    const b = await readJson(ctx.req);
    if (!validate.str(b.name, 80)) fail(400, 'invalid_name', 'Company name is required.');
    if (!validate.email(b.email)) fail(400, 'invalid_email', 'Enter a valid work email.');
    if (typeof b.password !== 'string' || b.password.length < 10 || b.password.length > 200) fail(400, 'weak_password', 'Use a password of at least 10 characters.');
    if (await db.get('SELECT 1 FROM merchants WHERE lower(email) = lower(?)', b.email.trim())) fail(409, 'email_taken', 'An account with this email already exists.');
    const mid = id('mer');
    await db.tx(async t => {
      await t.run('INSERT INTO merchants (id, name, email, password_hash, currency, created_at) VALUES (?,?,?,?,?,?)', mid, b.name.trim(), b.email.trim(), hashPassword(b.password), 'PKR', Date.now());
      await auth.createKey(mid, 'public', 'Storefront widget', null, t);
    });
    ctx.res.extraHeaders = { 'Set-Cookie': cookie(await auth.createSession(mid), config.SESSION_TTL_MS / 1000) };
    return { status: 201, body: { merchant: publicMerchant(await db.get('SELECT * FROM merchants WHERE id = ?', mid)) } };
  });

  router.post('/api/auth/login', authLimit, async ctx => {
    const b = await readJson(ctx.req);
    const m = typeof b.email === 'string' ? await db.get('SELECT * FROM merchants WHERE lower(email) = lower(?)', b.email.trim()) : null;
    const ok = verifyPassword(String(b.password || ''), m ? m.password_hash : DUMMY_HASH) && !!m;
    if (!ok) { limits.auth(ctx.ip); fail(401, 'invalid_credentials', 'Email or password is incorrect.'); }
    if (m.suspended_at) fail(403, 'account_suspended', 'This account is suspended. Contact Forme support.');
    ctx.res.extraHeaders = { 'Set-Cookie': cookie(await auth.createSession(m.id), config.SESSION_TTL_MS / 1000) };
    return { merchant: publicMerchant(m) };
  });

  router.post('/api/auth/logout', async ctx => {
    await auth.destroySession(parseCookies(ctx.req)[COOKIE]);
    ctx.res.extraHeaders = { 'Set-Cookie': cookie('', 0) };
    return { ok: true };
  });

  router.get('/api/auth/me', session, ctx => ({ merchant: publicMerchant(ctx.merchant) }));

  router.patch('/api/account', session, writable, async ctx => {
    const b = await readJson(ctx.req);
    const m = ctx.merchant;
    const next = { name: m.name, allowed_origins: m.allowed_origins, return_cost: m.return_cost, widget: JSON.parse(m.widget) };
    if (b.name !== undefined) { if (!validate.str(b.name, 80)) fail(400, 'invalid_name', 'Company name is required.'); next.name = b.name.trim(); }
    if (b.allowed_origins !== undefined) { const v = validate.origins(b.allowed_origins); if (v.error) fail(400, 'invalid_origins', v.error); next.allowed_origins = JSON.stringify(v.value); }
    if (b.return_cost !== undefined) { if (!validate.num(b.return_cost, 0, 100000)) fail(400, 'invalid_return_cost', 'Return cost must be between 0 and 100,000.'); next.return_cost = Number(b.return_cost); }
    if (b.widget !== undefined) {
      const w = b.widget || {};
      if (w.accent !== undefined && !/^#[0-9a-fA-F]{6}$/.test(w.accent)) fail(400, 'invalid_widget', 'Accent must be a hex colour like #c6ff3d.');
      if (w.label !== undefined && !validate.str(w.label, 32)) fail(400, 'invalid_widget', 'Button label must be 1–32 characters.');
      if (w.position !== undefined && !['inline', 'floating'].includes(w.position)) fail(400, 'invalid_widget', 'Position must be inline or floating.');
      next.widget = { ...next.widget, ...Object.fromEntries(Object.entries({ accent: w.accent, label: w.label?.trim(), position: w.position }).filter(([, v]) => v !== undefined)) };
    }
    await db.run('UPDATE merchants SET name=?, allowed_origins=?, return_cost=?, widget=? WHERE id=?', next.name, next.allowed_origins, next.return_cost, JSON.stringify(next.widget), m.id);
    return { merchant: publicMerchant(await db.get('SELECT * FROM merchants WHERE id = ?', m.id)) };
  });

  // API keys
  router.get('/api/keys', session, async ctx => ({
    keys: (await db.all('SELECT id, kind, label, prefix, public_token, created_at, last_used_at, revoked_at FROM api_keys WHERE merchant_id = ? ORDER BY created_at DESC', ctx.merchant.id))
      .map(k => ({ ...k, key: k.public_token || null, public_token: undefined })),
  }));
  router.post('/api/keys', session, writable, async ctx => {
    const b = await readJson(ctx.req);
    if (!['public', 'secret'].includes(b.kind)) fail(400, 'invalid_kind', 'kind must be public or secret.');
    const label = validate.str(b.label, 40) ? b.label.trim() : b.kind === 'public' ? 'Storefront widget' : 'Server integration';
    const active = Number((await db.get('SELECT COUNT(*) AS n FROM api_keys WHERE merchant_id = ? AND revoked_at IS NULL', ctx.merchant.id)).n);
    if (active >= 20) fail(400, 'too_many_keys', 'Revoke an unused key before creating another.');
    return { status: 201, body: { key: await auth.createKey(ctx.merchant.id, b.kind, label) } };
  });
  router.delete('/api/keys/:id', session, writable, async ctx => {
    const r = await db.run('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND merchant_id = ? AND revoked_at IS NULL', Date.now(), ctx.params.id, ctx.merchant.id);
    if (!r.changes) fail(404, 'not_found', 'Key not found or already revoked.');
    return { ok: true };
  });

  // Catalog
  router.get('/api/products', session, async ctx => ({
    products: await services.products.list(ctx.merchant.id, { q: ctx.url.searchParams.get('q') || '', category: ctx.url.searchParams.get('category') || '' }),
    categories: engine.CATEGORIES, fits: engine.FITS,
  }));
  router.post('/api/products', session, writable, async ctx => {
    const v = validate.product(await readJson(ctx.req));
    if (v.error) fail(400, 'invalid_product', v.error);
    if (await services.products.get(ctx.merchant.id, v.value.sku)) fail(409, 'sku_taken', `A product with SKU ${v.value.sku} already exists.`);
    return { status: 201, body: { product: (await services.products.upsert(ctx.merchant.id, v.value)).product } };
  });
  router.put('/api/products/:sku', session, writable, async ctx => {
    if (!await services.products.get(ctx.merchant.id, ctx.params.sku)) fail(404, 'not_found', 'Product not found.');
    const v = validate.product({ ...(await readJson(ctx.req)), sku: ctx.params.sku });
    if (v.error) fail(400, 'invalid_product', v.error);
    return { product: (await services.products.upsert(ctx.merchant.id, v.value)).product };
  });
  router.delete('/api/products/:sku', session, writable, async ctx => {
    if (!await services.products.remove(ctx.merchant.id, ctx.params.sku)) fail(404, 'not_found', 'Product not found.');
    return { ok: true };
  });
  router.post('/api/products/import', session, writable, async ctx => {
    const b = await readJson(ctx.req, 5 * 1024 * 1024);
    const list = Array.isArray(b) ? b : b.products;
    if (!Array.isArray(list) || !list.length || list.length > 2000) fail(400, 'invalid_import', 'Send { "products": [...] } with 1–2000 products.');
    const errors = [];
    const valid = [];
    list.forEach((p, i) => { const v = validate.product(p); if (v.error) errors.push({ index: i, sku: p?.sku ?? null, error: v.error }); else valid.push(v.value); });
    if (errors.length) fail(400, 'invalid_import', `${errors.length} of ${list.length} products failed validation. Nothing was imported.`, errors.slice(0, 50));
    let created = 0, updated = 0;
    await db.tx(async t => { const ts = services.bind(t); for (const p of valid) { (await ts.products.upsert(ctx.merchant.id, p)).created ? created++ : updated++; } });
    return { created, updated };
  });

  // Live preview for the chart editor: runs the engine without logging anything.
  router.post('/api/preview', session, async ctx => {
    const b = await readJson(ctx.req);
    const pv = validate.product({ ...b.product, sku: b.product?.sku || 'preview' });
    if (pv.error) fail(400, 'invalid_product', pv.error);
    const prof = validate.profile(b.profile);
    if (prof.error) fail(400, 'invalid_profile', prof.error);
    return { result: await services.recommend(ctx.merchant.id, pv.value, prof.value, null, { log: false }) };
  });

  router.get('/api/analytics', session, ctx => {
    const days = Math.min(90, Math.max(7, Number(ctx.url.searchParams.get('days')) || 30));
    return services.analytics(ctx.merchant, days);
  });
  router.get('/api/insights', session, async ctx => ({ products: await services.insights(ctx.merchant.id) }));
  router.get('/api/activity', session, async ctx => ({ events: await services.activity(ctx.merchant.id, 25) }));
}

module.exports = { register, publicMerchant };
