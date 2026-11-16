const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, before, after } = require('node:test');
const { createApp } = require('../src/app');

const PASSWORD = 'correct-admin-password-123';
let app, base, dir, admin;
const H = { 'content-type': 'application/json', 'x-forme-request': '1' };
const call = async (p, opts = {}) => { const r = await fetch(base + p, opts); return { status: r.status, headers: r.headers, body: await r.json().catch(() => ({})) }; };

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forme-admin-'));
  app = createApp({ DATA_DIR: dir, LOG_REQUESTS: false, ADMIN_PASSWORD: PASSWORD });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(async () => { await new Promise(r => app.server.close(r)); fs.rmSync(dir, { recursive: true, force: true }); });

test('admin login rejects wrong passwords and requires the CSRF header', async () => {
  assert.equal((await call('/api/admin/overview')).status, 401);
  assert.equal((await call('/api/admin/login', { method: 'POST', headers: H, body: JSON.stringify({ password: 'nope' }) })).status, 401);
  assert.equal((await call('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) })).status, 403);
  const ok = await call('/api/admin/login', { method: 'POST', headers: H, body: JSON.stringify({ password: PASSWORD }) });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie'), /SameSite=Strict/);
  admin = ok.headers.get('set-cookie').split(';')[0];
});

test('a merchant session cannot reach admin endpoints', async () => {
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'demo@forme.dev', password: 'forme-demo-2026' }) });
  const merchant = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/admin/overview', { headers: { cookie: merchant } })).status, 401);
  const forged = merchant.replace('forme_session', 'forme_admin');
  assert.equal((await call('/api/admin/overview', { headers: { cookie: forged } })).status, 401);
});

test('overview, merchants, engine playground and health', async () => {
  const o = await call('/api/admin/overview', { headers: { cookie: admin } });
  assert.equal(o.status, 200);
  assert.ok(o.body.totals.merchants >= 1);
  const m = await call('/api/admin/merchants', { headers: { cookie: admin } });
  const demo = m.body.merchants.find(x => x.email === 'demo@forme.dev');
  assert.ok(demo.products >= 10);
  const run = await call('/api/admin/engine/run', { method: 'POST', headers: { ...H, cookie: admin }, body: JSON.stringify({ merchant_id: demo.id, sku: 'NL-TEE-01', profile: { height: 178, weight: 76 } }) });
  assert.equal(run.status, 200);
  assert.ok(run.body.result.size);
  const h = await call('/api/admin/health', { headers: { cookie: admin } });
  assert.ok(h.body.checks.find(c => c.name === 'Fit engine').ok);
});

test('suspend blocks a merchant, unsuspend restores it, and actions are audited', async () => {
  const s = await fetch(base + '/api/auth/signup', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Shady Co', email: 'shady@test.pk', password: 'long-enough-password' }) });
  const cookie = s.headers.get('set-cookie').split(';')[0];
  const list = await call('/api/admin/merchants?q=shady', { headers: { cookie: admin } });
  const id = list.body.merchants[0].id;
  assert.equal((await call(`/api/admin/merchants/${id}`, { method: 'PATCH', headers: { ...H, cookie: admin }, body: JSON.stringify({ suspended: true, plan: 'growth' }) })).status, 200);
  assert.equal((await call('/api/auth/me', { headers: { cookie } })).status, 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'shady@test.pk', password: 'long-enough-password' }) })).status, 403);
  await call(`/api/admin/merchants/${id}`, { method: 'PATCH', headers: { ...H, cookie: admin }, body: JSON.stringify({ suspended: false }) });
  assert.equal((await call('/api/auth/me', { headers: { cookie } })).status, 200);
  const demoId = (await call('/api/admin/merchants?q=demo', { headers: { cookie: admin } })).body.merchants[0].id;
  assert.equal((await call(`/api/admin/merchants/${demoId}`, { method: 'DELETE', headers: { ...H, cookie: admin } })).status, 400);
  assert.equal((await call(`/api/admin/merchants/${id}`, { method: 'DELETE', headers: { ...H, cookie: admin } })).status, 200);
  const log = await call('/api/admin/audit', { headers: { cookie: admin } });
  const actions = log.body.entries.map(e => e.action);
  for (const a of ['login', 'login_failed', 'suspend', 'unsuspend', 'set_plan', 'delete_merchant']) assert.ok(actions.includes(a), a);
});

test('admin is disabled when no password is configured', async () => {
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'forme-admin-off-'));
  const off = createApp({ DATA_DIR: d2, LOG_REQUESTS: false, SEED_DEMO: false, ADMIN_PASSWORD: '' });
  await new Promise(r => off.server.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${off.server.address().port}`;
  try {
    assert.deepEqual(await (await fetch(b + '/api/admin/status')).json(), { enabled: false });
    assert.equal((await fetch(b + '/api/admin/login', { method: 'POST', headers: H, body: JSON.stringify({ password: '' }) })).status, 503);
  } finally { await new Promise(r => off.server.close(r)); fs.rmSync(d2, { recursive: true, force: true }); }
});
