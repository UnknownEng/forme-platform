// Regression tests for the developer review: bad input must give 4xx, never 500.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');
const { createApp } = require('../src/app');
const engine = require('../src/engine');
const validate = require('../src/validate');

let app, base, dir, pk, cookie;
const H = { 'content-type': 'application/json', 'x-forme-request': '1' };
const bearer = k => ({ 'content-type': 'application/json', authorization: `Bearer ${k}` });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forme-robust-'));
  app = createApp({ DATA_DIR: dir, LOG_REQUESTS: false, ADMIN_PASSWORD: 'x'.repeat(16) });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  pk = (await (await fetch(base + '/demo-config.json')).json()).publicKey;
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'demo@forme.dev', password: 'forme-demo-2026' }) });
  cookie = r.headers.get('set-cookie').split(';')[0];
});
after(async () => { await new Promise(r => app.server.close(r)); fs.rmSync(dir, { recursive: true, force: true }); });

test('non-object JSON bodies and wrong value types are 400s', async () => {
  for (const [p, h] of [['/v1/recommend', bearer(pk)], ['/v1/events', bearer(pk)], ['/api/auth/login', H]]) {
    const r = await fetch(base + p, { method: 'POST', headers: h, body: 'null' });
    assert.equal(r.status, 400, p);
  }
  for (const value of [true, [5], { a: 1 }]) {
    const r = await fetch(base + '/v1/events', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ type: 'widget_open', value }) });
    assert.equal(r.status, 400, JSON.stringify(value));
  }
  const tok = await fetch(base + '/v1/recommend', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ sku: 'NL-TEE-01', profile_token: ['fp_aaaaaaaaaaaaaaaaaaaaaaaa'] }) });
  assert.equal(tok.status, 400);
});

test('stray % in cookies or paths never causes a 500', async () => {
  assert.equal((await fetch(base + '/api/auth/me', { headers: { cookie: `theme=%E0%A4%A; ${cookie}` } })).status, 200);
  assert.equal((await fetch(base + '/v1/products/%E0%A4%A', { headers: bearer(pk) })).status, 404);
});

test('oversized bodies get a readable 413', async () => {
  const r = await fetch(base + '/v1/events', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ type: 'widget_open', pad: 'x'.repeat(40000) }) });
  assert.equal(r.status, 413);
});

test('HEAD works on API GET routes, 405 carries Allow, unknown POST is 404', async () => {
  assert.equal((await fetch(base + '/v1/health', { method: 'HEAD' })).status, 200);
  const r = await fetch(base + '/v1/health', { method: 'DELETE' });
  assert.equal(r.status, 405);
  assert.match(r.headers.get('allow'), /GET/);
  assert.equal((await fetch(base + '/nothing-here', { method: 'POST' })).status, 404);
  assert.equal((await fetch(base + '/openapiXjson')).status, 404);
});

test('charts are stored smallest first and one-size garments are not out of range', () => {
  const v = validate.product({ sku: 'X', name: 'X', brand: 'B', category: 'T-shirts', chart: [{ size: 'L', chest: 110 }, { size: 'S', chest: 98 }, { size: 'M', chest: 104 }] });
  assert.deepEqual(v.value.chart.map(r => r.size), ['S', 'M', 'L']);
  const r = engine.recommend({ category: 'Kurtas', fit: 'Relaxed', chart: [{ size: 'Free', chest: 120 }] }, { height: 180, weight: 80 });
  assert.equal(r.out_of_range, false);
  const desc = engine.recommend({ category: 'T-shirts', fit: 'Regular', chart: [{ size: 'L', chest: 110 }, { size: 'M', chest: 104 }, { size: 'S', chest: 98 }] }, { height: 175, chest: 90.5 });
  if (desc.alternative) assert.equal(desc.alternative.direction === 'up', ['L', 'M'].includes(desc.alternative.size) && desc.alternative.size !== desc.size && ['S', 'M', 'L'].indexOf(desc.alternative.size) > ['S', 'M', 'L'].indexOf(desc.size));
});

test('a whole-chart misfit is flagged (e.g. inches typed as cm)', () => {
  const jeans = { category: 'Jeans', fit: 'Regular', chart: [{ size: '28', waist: 74, hips: 94 }, { size: '30', waist: 79, hips: 99 }] };
  assert.equal(engine.recommend(jeans, { height: 170, waist: 32, hips: 38 }).warning, 'all_loose');
});

test('analytics: one bucket per day, and the chart agrees with the headline numbers', async () => {
  const a = await (await fetch(base + '/api/analytics?days=7', { headers: { cookie } })).json();
  assert.equal(a.series.length, 7);
  assert.equal(a.series.reduce((s, d) => s + d.recs, 0), a.kpis.recommendations.value);
  // Last bucket is today in Pakistan time.
  const pkToday = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  assert.equal(a.series.at(-1).date, pkToday);
});

test('the shared demo workspace is read-only', async () => {
  const del = await fetch(base + '/api/keys/key_demo_public', { method: 'DELETE', headers: { ...H, cookie } });
  assert.equal(del.status, 403);
  assert.equal((await fetch(base + '/api/products/NL-TEE-01', { method: 'DELETE', headers: { ...H, cookie } })).status, 403);
  assert.equal((await fetch(base + '/api/account', { method: 'PATCH', headers: { ...H, cookie }, body: JSON.stringify({ name: 'Hacked' }) })).status, 403);
  assert.equal((await fetch(base + '/demo-config.json')).status, 200);
});

test('successful logins do not use up the login limit', async () => {
  for (let i = 0; i < 16; i++) {
    const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'demo@forme.dev', password: 'forme-demo-2026' }) });
    assert.equal(r.status, 200, `login ${i + 1}`);
  }
});
