// Public REST API (/v1) for retailers. Authenticated with API keys:
//   pk_live_…  publishable key for the browser widget (recommend, profiles, events)
//   sk_live_…  secret key for server-to-server calls (catalog sync, feedback)
const validate = require('../validate');
const { fail, readJson } = require('../http');
const { id, token, sha256 } = require('../auth');

const EVENT_TYPES = ['widget_open', 'size_selected', 'add_to_cart', 'purchase'];
const OUTCOMES = ['kept', 'too_small', 'too_large', 'returned_other'];

function register(router, { db, services, config, limits, selfOrigin }) {
  const keyAuth = kinds => ctx => {
    const header = ctx.req.headers.authorization || '';
    const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : ctx.req.headers['x-forme-key'];
    const key = ctx.auth.resolveKey(raw);
    if (!key) fail(401, 'invalid_api_key', 'Missing or invalid API key. Send Authorization: Bearer <key>.');
    if (!kinds.includes(key.kind)) fail(403, 'wrong_key_type', key.kind === 'public' ? 'This endpoint needs a secret key (sk_live_…).' : 'Use a publishable key (pk_live_…) here.');
    const origin = ctx.req.headers.origin;
    const own = origin && origin === selfOrigin(ctx.req);
    if (key.kind === 'secret' && origin && !own) fail(403, 'secret_key_in_browser', 'Secret keys must only be used from your server. Use a pk_live_ key in the browser.');
    if (key.kind === 'public' && origin && !own) {
      const allowed = JSON.parse(key.allowed_origins);
      if (allowed.length && !allowed.includes(origin)) fail(403, 'origin_not_allowed', `${origin} is not in this account's allowed origins.`);
    }
    const r = limits.api(key.key_id);
    ctx.res.extraHeaders = { ...ctx.res.extraHeaders, 'X-RateLimit-Remaining': String(r.remaining) };
    if (!r.ok) fail(429, 'rate_limited', 'Rate limit exceeded. Slow down and retry shortly.');
    ctx.merchant = key;
    ctx.keyKind = key.kind;
  };
  const any = keyAuth(['public', 'secret']);
  const secret = keyAuth(['secret']);

  // Shopper profiles are global so one Forme profile works at every store.
  const profileFromToken = raw => {
    if (!raw || !/^fp_[A-Za-z0-9_-]{20,}$/.test(raw)) return null;
    const row = db.get('SELECT * FROM profiles WHERE token_hash = ?', sha256(raw));
    return row ? { id: row.id, data: JSON.parse(row.data) } : null;
  };
  const resolveProfile = (ctx, body) => {
    if (body.profile) {
      const v = validate.profile(body.profile);
      if (v.error) fail(400, 'invalid_profile', v.error);
      return { id: null, data: v.value };
    }
    const p = profileFromToken(body.profile_token || ctx.req.headers['x-forme-profile']);
    if (!p) fail(400, 'profile_required', 'Send a profile object or a valid profile_token.');
    return p;
  };
  const publicProduct = p => ({ sku: p.sku, name: p.name, brand: p.brand, category: p.category, fit: p.fit, chart: p.chart });

  router.get('/v1/health', () => ({ status: 'ok', engine_version: config.ENGINE_VERSION, time: new Date().toISOString() }));

  router.get('/v1/widget-config', any, ctx => ({
    merchant: ctx.merchant.name,
    widget: { accent: '#d4f36b', label: 'Find my size', position: 'inline', ...JSON.parse(ctx.merchant.widget) },
  }));

  router.post('/v1/recommend', any, async ctx => {
    const b = await readJson(ctx.req);
    if (typeof b.sku !== 'string') fail(400, 'sku_required', 'sku is required.');
    const product = services.products.get(ctx.merchant.id, b.sku);
    if (!product) fail(404, 'product_not_found', `No product with SKU ${b.sku}. Sync it with PUT /v1/products/{sku}.`);
    const profile = resolveProfile(ctx, b);
    return services.recommend(ctx.merchant.id, product, profile.data, profile.id);
  });

  router.post('/v1/recommend/batch', any, async ctx => {
    const b = await readJson(ctx.req);
    if (!Array.isArray(b.skus) || !b.skus.length || b.skus.length > 60) fail(400, 'invalid_skus', 'skus must list 1–60 SKUs.');
    const profile = resolveProfile(ctx, b);
    const results = b.skus.map(sku => {
      const p = typeof sku === 'string' && services.products.get(ctx.merchant.id, sku);
      if (!p) return { sku, error: 'product_not_found' };
      const r = services.recommend(ctx.merchant.id, p, profile.data, profile.id, { log: false });
      return { sku, size: r.size, confidence: r.confidence, label: r.label };
    });
    return { results };
  });

  router.post('/v1/profiles', any, async ctx => {
    const v = validate.profile(await readJson(ctx.req));
    if (v.error) fail(400, 'invalid_profile', v.error);
    const raw = token('fp', 24);
    const pid = id('prf');
    const now = Date.now();
    db.run('INSERT INTO profiles (id, token_hash, data, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)', pid, sha256(raw), JSON.stringify(v.value), ctx.merchant.id, now, now);
    return { status: 201, body: { profile_token: raw, profile: v.value } };
  });
  router.get('/v1/profiles/me', any, ctx => {
    const p = profileFromToken(ctx.req.headers['x-forme-profile']);
    if (!p) fail(404, 'profile_not_found', 'Unknown profile token.');
    return { profile: p.data };
  });
  router.put('/v1/profiles/me', any, async ctx => {
    const p = profileFromToken(ctx.req.headers['x-forme-profile']);
    if (!p) fail(404, 'profile_not_found', 'Unknown profile token.');
    const v = validate.profile(await readJson(ctx.req));
    if (v.error) fail(400, 'invalid_profile', v.error);
    db.run('UPDATE profiles SET data = ?, updated_at = ? WHERE id = ?', JSON.stringify(v.value), Date.now(), p.id);
    return { profile: v.value };
  });
  router.delete('/v1/profiles/me', any, ctx => {
    const raw = ctx.req.headers['x-forme-profile'];
    const r = raw ? db.run('DELETE FROM profiles WHERE token_hash = ?', sha256(raw)) : { changes: 0 };
    if (!r.changes) fail(404, 'profile_not_found', 'Unknown profile token.');
    return { deleted: true };
  });

  router.post('/v1/events', any, async ctx => {
    const b = await readJson(ctx.req, 16 * 1024);
    if (!EVENT_TYPES.includes(b.type)) fail(400, 'invalid_event', `type must be one of: ${EVENT_TYPES.join(', ')}`);
    if (b.value != null && !validate.num(b.value, 0, 10_000_000)) fail(400, 'invalid_event', 'value must be a positive number.');
    const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
    services.track(ctx.merchant.id, { type: b.type, sku: str(b.sku, 64), rec_id: str(b.rec_id, 40), size: str(b.size, 10), value: b.value ?? null });
    return { status: 202, body: { accepted: true } };
  });

  router.post('/v1/feedback', secret, async ctx => {
    const b = await readJson(ctx.req);
    if (typeof b.sku !== 'string' || !services.products.get(ctx.merchant.id, b.sku)) fail(404, 'product_not_found', 'Unknown sku.');
    if (!validate.str(String(b.size ?? ''), 10)) fail(400, 'invalid_size', 'size is required.');
    if (!OUTCOMES.includes(b.outcome)) fail(400, 'invalid_outcome', `outcome must be one of: ${OUTCOMES.join(', ')}`);
    return { status: 201, body: services.addFeedback(ctx.merchant.id, { sku: b.sku, size: String(b.size), outcome: b.outcome, rec_id: typeof b.rec_id === 'string' ? b.rec_id : null }) };
  });

  router.get('/v1/products', secret, ctx => ({ products: services.products.list(ctx.merchant.id, { q: ctx.url.searchParams.get('q') || '' }) }));
  router.get('/v1/products/:sku', any, ctx => {
    const p = services.products.get(ctx.merchant.id, ctx.params.sku);
    if (!p) fail(404, 'product_not_found', 'Unknown sku.');
    return { product: ctx.keyKind === 'secret' ? p : publicProduct(p) };
  });
  router.put('/v1/products/:sku', secret, async ctx => {
    const v = validate.product({ ...(await readJson(ctx.req)), sku: ctx.params.sku });
    if (v.error) fail(400, 'invalid_product', v.error);
    const r = services.products.upsert(ctx.merchant.id, v.value);
    return { status: r.created ? 201 : 200, body: { product: r.product, created: r.created } };
  });
  router.delete('/v1/products/:sku', secret, ctx => {
    if (!services.products.remove(ctx.merchant.id, ctx.params.sku)) fail(404, 'product_not_found', 'Unknown sku.');
    return { deleted: true };
  });
  router.post('/v1/products/bulk', secret, async ctx => {
    const b = await readJson(ctx.req, 5 * 1024 * 1024);
    if (!Array.isArray(b.products) || !b.products.length || b.products.length > 2000) fail(400, 'invalid_bulk', 'Send { "products": [...] } with 1–2000 products.');
    const results = b.products.map((p, i) => { const v = validate.product(p); return v.error ? { index: i, sku: p?.sku ?? null, error: v.error } : { index: i, value: v.value }; });
    let created = 0, updated = 0;
    db.tx(() => { for (const r of results) if (r.value) services.products.upsert(ctx.merchant.id, r.value).created ? created++ : updated++; });
    return { created, updated, failed: results.filter(r => r.error).map(({ value, ...r }) => r) };
  });
}

module.exports = { register };
