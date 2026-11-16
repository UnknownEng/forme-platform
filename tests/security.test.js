// Regression tests for the findings of the pre-launch security review.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');
const { createApp } = require('../src/app');

let app, base, dir, pk, cookie, sk;
const H = { 'content-type': 'application/json', 'x-forme-request': '1' };
const bearer = k => ({ 'content-type': 'application/json', authorization: `Bearer ${k}` });
const call = async (p, opts = {}) => { const r = await fetch(base + p, opts); return { status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }; };

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forme-sec-test-'));
  app = createApp({ DATA_DIR: dir, LOG_REQUESTS: false, ADMIN_PASSWORD: 'x'.repeat(16), TRUST_PROXY: true });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  pk = (await call('/demo-config.json')).body.publicKey;
  const s = await fetch(base + '/api/auth/signup', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Sec Co', email: 'sec@test.pk', password: 'long-enough-password' }) });
  cookie = s.headers.get('set-cookie').split(';')[0];
});
after(async () => { await new Promise(r => app.server.close(r)); fs.rmSync(dir, { recursive: true, force: true }); });

test('browser purchase events cannot invent revenue', async () => {
  const before = (await call('/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'demo@forme.dev', password: 'forme-demo-2026' }) })).headers.get('set-cookie').split(';')[0];
  const rev = async () => (await call('/api/analytics?days=7', { headers: { cookie: before } })).body.kpis.influenced_revenue.value;
  const start = await rev();
  const fake = await call('/v1/events', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ type: 'purchase', sku: 'NL-BOX-02', rec_id: 'rec_fake_attacker', value: 9999999 }) });
  assert.equal(fake.status, 400);
  const noRec = await call('/v1/events', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ type: 'purchase', sku: 'NL-BOX-02', value: 9999999 }) });
  assert.equal(noRec.status, 400);
  const unknownSku = await call('/v1/events', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ type: 'widget_open', sku: '<img src=x>' }) });
  assert.equal(unknownSku.status, 400);
  // A real recommendation can be credited once, capped near the catalog price.
  const rec = (await call('/v1/recommend', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ sku: 'NL-BOX-02', profile: { height: 175 } }) })).body;
  const ok = await call('/v1/events', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ type: 'purchase', sku: 'NL-BOX-02', rec_id: rec.rec_id, value: 9999999 }) });
  assert.equal(ok.status, 202);
  const dup = await call('/v1/events', { method: 'POST', headers: bearer(pk), body: JSON.stringify({ type: 'purchase', sku: 'NL-BOX-02', rec_id: rec.rec_id, value: 9999999 }) });
  assert.equal(dup.body.duplicate, true);
  const gained = (await rev()) - start;
  assert.ok(gained > 0 && gained <= 2490 * 5, `revenue grew by ${gained}`);
});

test('spoofed X-Forwarded-For does not reset the login limiter', async () => {
  let limited = 0;
  for (let i = 0; i < 20; i++) {
    const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { ...H, 'x-forwarded-for': `10.0.0.${i}, 203.0.113.9` }, body: JSON.stringify({ email: 'sec@test.pk', password: 'wrong-password-123' }) });
    if (r.status === 429) limited++;
  }
  assert.ok(limited >= 5, `only ${limited} of 20 attempts were throttled`);
});

test('signing out ends the session even if the cookie is replayed', async () => {
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { ...H, 'x-real-ip': '198.51.100.7' }, body: JSON.stringify({ email: 'sec@test.pk', password: 'long-enough-password' }) });
  const c = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/auth/me', { headers: { cookie: c } })).status, 200);
  await fetch(base + '/api/auth/logout', { method: 'POST', headers: { ...H, cookie: c } });
  assert.equal((await call('/api/auth/me', { headers: { cookie: c } })).status, 401);
});

test('origin allow-list also blocks requests with no Origin', async () => {
  const keys = (await call('/api/keys', { headers: { cookie: (await fetch(base + '/api/auth/login', { method: 'POST', headers: { ...H, 'x-real-ip': '198.51.100.8' }, body: JSON.stringify({ email: 'sec@test.pk', password: 'long-enough-password' }) })).headers.get('set-cookie').split(';')[0] } })).body.keys;
  void keys;
  const c = (await fetch(base + '/api/auth/login', { method: 'POST', headers: { ...H, 'x-real-ip': '198.51.100.9' }, body: JSON.stringify({ email: 'sec@test.pk', password: 'long-enough-password' }) })).headers.get('set-cookie').split(';')[0];
  const myPk = (await call('/api/keys', { headers: { cookie: c } })).body.keys.find(k => k.kind === 'public').key;
  await call('/api/account', { method: 'PATCH', headers: { ...H, cookie: c }, body: JSON.stringify({ allowed_origins: ['https://shop.sec.test'] }) });
  sk = (await call('/api/keys', { method: 'POST', headers: { ...H, cookie: c }, body: JSON.stringify({ kind: 'secret' }) })).body.key.key;
  await call('/v1/products/T1', { method: 'PUT', headers: bearer(sk), body: JSON.stringify({ name: 'T', brand: 'B', category: 'T-shirts', chart: [{ size: 'M', chest: 100 }] }) });
  const body = JSON.stringify({ sku: 'T1', profile: { height: 170 } });
  assert.equal((await call('/v1/recommend', { method: 'POST', headers: bearer(myPk), body })).status, 403);
  assert.equal((await call('/v1/recommend', { method: 'POST', headers: { ...bearer(myPk), origin: 'https://shop.sec.test' }, body })).status, 200);
});

test('profile creation is capped per visitor', async () => {
  let blocked = false;
  for (let i = 0; i < 25 && !blocked; i++) {
    const r = await call('/v1/profiles', { method: 'POST', headers: { ...bearer(pk), 'x-real-ip': '192.0.2.50' }, body: JSON.stringify({ height: 170 }) });
    if (r.status === 429) blocked = true;
  }
  assert.ok(blocked);
});

test('signing out of the shared demo does not sign other visitors out', async () => {
  const a = (await fetch(base + '/api/auth/login', { method: 'POST', headers: { ...H, 'x-real-ip': '198.51.100.20' }, body: JSON.stringify({ email: 'demo@forme.dev', password: 'forme-demo-2026' }) })).headers.get('set-cookie').split(';')[0];
  const b = (await fetch(base + '/api/auth/login', { method: 'POST', headers: { ...H, 'x-real-ip': '198.51.100.21' }, body: JSON.stringify({ email: 'demo@forme.dev', password: 'forme-demo-2026' }) })).headers.get('set-cookie').split(';')[0];
  await fetch(base + '/api/auth/logout', { method: 'POST', headers: { ...H, cookie: a } });
  assert.equal((await call('/api/auth/me', { headers: { cookie: b } })).status, 200);
});
