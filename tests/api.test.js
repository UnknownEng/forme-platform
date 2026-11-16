const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');
const { createApp } = require('../src/app');

let app, base, dir, cookie, pk, sk;
const H = { 'content-type': 'application/json', 'x-forme-request': '1' };
const json = async res => ({ status: res.status, body: await res.json().catch(() => ({})) });
const req = (p, opts = {}) => fetch(base + p, opts).then(json);
const bearer = k => ({ 'content-type': 'application/json', authorization: `Bearer ${k}` });
const product = {
  name: 'Test Tee', brand: 'Test', category: 'T-shirts', fit: 'Regular', price: 999,
  chart: [{ size: 'S', chest: 98, waist: 92, length: 68 }, { size: 'M', chest: 104, waist: 98, length: 70 }, { size: 'L', chest: 110, waist: 104, length: 72 }],
};

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forme-test-'));
  app = createApp({ DATABASE_URL: process.env.FORME_TEST_DB || '', DATA_DIR: dir, SEED_DEMO: false, LOG_REQUESTS: false });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(async () => {
  await new Promise(r => app.server.close(r));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('signup creates a session and a publishable key', async () => {
  const res = await fetch(base + '/api/auth/signup', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Acme', email: 'ops@acme.test', password: 'correct-horse-battery' }) });
  assert.equal(res.status, 201);
  assert.match(res.headers.get('set-cookie'), /HttpOnly/);
  cookie = res.headers.get('set-cookie').split(';')[0];
  const keys = await req('/api/keys', { headers: { cookie } });
  pk = keys.body.keys.find(k => k.kind === 'public').key;
  assert.match(pk, /^pk_live_/);
});

test('rejects duplicate email, weak password and a bad login', async () => {
  const signup = body => req('/api/auth/signup', { method: 'POST', headers: H, body: JSON.stringify(body) });
  assert.equal((await signup({ name: 'X', email: 'ops@acme.test', password: 'correct-horse-battery' })).status, 409);
  assert.equal((await signup({ name: 'X', email: 'x@acme.test', password: 'short' })).status, 400);
  assert.equal((await req('/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'ops@acme.test', password: 'wrong-password' }) })).status, 401);
});

test('console API needs a session and the CSRF header', async () => {
  assert.equal((await req('/api/products')).status, 401);
  const noHeader = await req('/api/products', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ ...product, sku: 'X' }) });
  assert.equal(noHeader.status, 403);
});

test('secret key is shown once and stored only as a hash', async () => {
  const r = await req('/api/keys', { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify({ kind: 'secret' }) });
  assert.equal(r.status, 201);
  sk = r.body.key.key;
  assert.match(sk, /^sk_live_/);
  const list = await req('/api/keys', { headers: { cookie } });
  assert.equal(list.body.keys.find(k => k.kind === 'secret').key, null);
  const rows = await app.db.all("SELECT key_hash, public_token FROM api_keys WHERE kind = 'secret'");
  assert.ok(rows.every(k => k.public_token === null && k.key_hash !== sk));
});

test('catalog sync, validation and key scopes', async () => {
  assert.equal((await req('/v1/products/TT-1', { method: 'PUT', headers: bearer(sk), body: JSON.stringify(product) })).status, 201);
  assert.equal((await req('/v1/products/TT-1', { method: 'PUT', headers: bearer(sk), body: JSON.stringify(product) })).status, 200);
  const bad = await req('/v1/products/TT-2', { method: 'PUT', headers: bearer(sk), body: JSON.stringify({ ...product, chart: [{ size: 'M', waist: 90 }] }) });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error.message, /chest/);
  assert.equal((await req('/v1/products/TT-1', { method: 'PUT', headers: bearer(pk), body: JSON.stringify(product) })).status, 403);
  assert.equal((await req('/v1/products', { headers: bearer('pk_live_notarealkeyatallxxxxxxxx') })).status, 401);
  const bulk = await req('/v1/products/bulk', { method: 'POST', headers: bearer(sk), body: JSON.stringify({ products: [{ ...product, sku: 'TT-3' }, { sku: 'bad sku' }] }) });
  assert.equal(bulk.body.created, 1);
  assert.equal(bulk.body.failed.length, 1);
});

test('recommend with a profile, a portable token, and in batch', async () => {
  const r = await req('/v1/recommend', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ sku: 'TT-1', profile: { height: 178, chest: 94, waist: 84 } }) });
  assert.equal(r.status, 200);
  assert.ok(['S', 'M', 'L'].includes(r.body.size));
  assert.match(r.body.rec_id, /^rec_/);
  const prof = await req('/v1/profiles', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ height: 165, weight: 60 }) });
  assert.equal(prof.status, 201);
  const token = prof.body.profile_token;
  assert.equal((await req('/v1/recommend', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ sku: 'TT-1', profile_token: token }) })).status, 200);
  const batch = await req('/v1/recommend/batch', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ skus: ['TT-1', 'TT-3', 'NOPE'], profile_token: token }) });
  assert.equal(batch.body.results.length, 3);
  assert.equal(batch.body.results[2].error, 'product_not_found');
  assert.equal((await req('/v1/recommend', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ sku: 'NOPE', profile: { height: 170 } }) })).status, 404);
  assert.equal((await req('/v1/profiles/me', { method: 'DELETE', headers: { ...bearer(pk), 'x-forme-profile': token } })).status, 200);
  assert.equal((await req('/v1/recommend', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ sku: 'TT-1', profile_token: token }) })).status, 400);
});

test('origin allow-list, CORS preflight, and secret keys in browsers', async () => {
  await req('/api/account', { method: 'PATCH', headers: { ...H, cookie }, body: JSON.stringify({ allowed_origins: ['https://shop.acme.test'] }) });
  const body = JSON.stringify({ sku: 'TT-1', profile: { height: 170 } });
  assert.equal((await req('/v1/recommend', { method: 'POST', headers: { ...bearer(pk), origin: 'https://shop.acme.test' }, body })).status, 200);
  assert.equal((await req('/v1/recommend', { method: 'POST', headers: { ...bearer(pk), origin: 'https://evil.test' }, body })).status, 403);
  assert.equal((await req('/v1/products', { headers: { authorization: `Bearer ${sk}`, origin: 'https://shop.acme.test' } })).status, 403);
  const preflight = await fetch(base + '/v1/recommend', { method: 'OPTIONS', headers: { origin: 'https://shop.acme.test' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://shop.acme.test');
  await req('/api/account', { method: 'PATCH', headers: { ...H, cookie }, body: JSON.stringify({ allowed_origins: [] }) });
});

test('events, feedback calibration and analytics', async () => {
  const rec = await req('/v1/recommend', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ sku: 'TT-1', profile: { height: 175 } }) });
  assert.equal((await req('/v1/events', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ type: 'add_to_cart', sku: 'TT-1', rec_id: rec.body.rec_id, size: rec.body.size }) })).status, 202);
  assert.equal((await req('/v1/events', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ type: 'hack' }) })).status, 400);
  assert.equal((await req('/v1/feedback', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ sku: 'TT-1', size: 'M', outcome: 'kept' }) })).status, 403);
  const fb = await req('/v1/feedback', { method: 'POST', headers: bearer(sk), body: JSON.stringify({ sku: 'TT-1', size: rec.body.size, outcome: 'too_small', rec_id: rec.body.rec_id }) });
  assert.equal(fb.status, 201);
  assert.equal(fb.body.followed, true);
  const a = await req('/api/analytics?days=7', { headers: { cookie } });
  assert.ok(a.body.kpis.recommendations.value >= 1);
  assert.ok(a.body.series.length >= 7);
  const ins = await req('/api/insights', { headers: { cookie } });
  assert.equal(ins.body.products.find(p => p.sku === 'TT-1').too_small, 1);
});

test('revoked keys stop working', async () => {
  const keys = (await req('/api/keys', { headers: { cookie } })).body.keys;
  const id = keys.find(k => k.kind === 'secret').id;
  assert.equal((await req(`/api/keys/${id}`, { method: 'DELETE', headers: { ...H, cookie } })).status, 200);
  assert.equal((await req('/v1/products', { headers: { authorization: `Bearer ${sk}` } })).status, 401);
});

test('static pages, security headers and 404s', async () => {
  for (const p of ['/', '/console', '/demo', '/docs', '/widget.js', '/openapi.json', '/v1/health']) {
    assert.equal((await fetch(base + p)).status, 200, p);
  }
  assert.match((await fetch(base + '/')).headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal((await fetch(base + '/widget.js')).headers.get('access-control-allow-origin'), '*');
  assert.equal((await fetch(base + '/nope')).status, 404);
  assert.equal((await fetch(base + '/v1/nope')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e/package.json')).status, 404);
  assert.equal((await fetch(base + '/demo-config.json')).status, 404);
});

test('demo seed creates a working demo workspace', async () => {
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'forme-seed-'));
  const seeded = createApp({ DATABASE_URL: process.env.FORME_TEST_DB || '', DATA_DIR: d2, LOG_REQUESTS: false });
  await new Promise(r => seeded.server.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${seeded.server.address().port}`;
  try {
    const cfg = await (await fetch(b + '/demo-config.json')).json();
    assert.equal(cfg.products.length, 12);
    const r = await fetch(b + '/v1/recommend', { method: 'POST', headers: bearer(cfg.publicKey), body: JSON.stringify({ sku: 'NL-JNS-08', profile: { height: 175, waist: 84 } }) });
    assert.equal(r.status, 200);
    const n = Number((await seeded.db.get('SELECT COUNT(*) AS n FROM events')).n);
    assert.ok(n > 1000);
  } finally {
    await new Promise(r => seeded.server.close(r));
    fs.rmSync(d2, { recursive: true, force: true });
  }
});
