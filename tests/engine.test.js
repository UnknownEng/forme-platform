const assert = require('node:assert/strict');
const { test } = require('node:test');
const engine = require('../src/engine');
const { DEMO_PRODUCTS } = require('../src/seed');

const tee = DEMO_PRODUCTS.find(p => p.sku === 'NL-TEE-01');
const jeans = DEMO_PRODUCTS.find(p => p.sku === 'NL-JNS-08');
const order = tee.chart.map(r => r.size);

test('bigger bodies get bigger sizes', () => {
  const small = engine.recommend(tee, { height: 160, weight: 50 });
  const large = engine.recommend(tee, { height: 190, weight: 100 });
  assert.ok(order.indexOf(large.size) > order.indexOf(small.size), `${small.size} should be smaller than ${large.size}`);
});

test('relaxed preference is never smaller than slim', () => {
  const body = { height: 176, weight: 74 };
  const slim = engine.recommend(tee, { ...body, fit: 'Slim' });
  const relaxed = engine.recommend(tee, { ...body, fit: 'Relaxed' });
  assert.ok(order.indexOf(relaxed.size) >= order.indexOf(slim.size));
});

test('exact measurements raise confidence over estimates', () => {
  const est = engine.recommend(jeans, { height: 170, weight: 70 });
  const exact = engine.recommend(jeans, { height: 170, waist: 80, hips: 98, inseam: 79 });
  assert.equal(exact.size, '32');
  assert.ok(exact.confidence > est.confidence);
  assert.deepEqual(exact.estimated, []);
  assert.ok(est.estimated.includes('waist'));
});

test('returns fit notes, a label and the engine version', () => {
  const r = engine.recommend(tee, { height: 178, chest: 96, waist: 82, shoulders: 45 });
  assert.ok(r.fit_notes.some(n => n.area === 'chest'));
  assert.match(r.label, /fit|sure/i);
  assert.ok(r.confidence >= 30 && r.confidence <= 98);
  assert.equal(typeof r.engine_version, 'string');
});

test('feedback calibration moves a product that runs small toward bigger sizes', () => {
  const body = { height: 172, chest: 93, waist: 80, shoulders: 43 };
  const base = engine.recommend(tee, body);
  const cal = engine.recommend(tee, body, { too_small: 60, kept: 20, too_large: 0 });
  assert.ok(cal.calibration.shift_cm > 0);
  assert.ok(order.indexOf(cal.size) >= order.indexOf(base.size));
});

test('rejects impossible heights', () => {
  assert.throws(() => engine.recommend(tee, { height: 20 }), /height/);
});
