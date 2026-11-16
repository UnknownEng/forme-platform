// Records a captioned product walkthrough: landing page -> demo store -> console.
// Usage: node walkthrough.js [baseUrl]   (default: starts a fresh local server)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launch, screencast, encodeFrames, sleep, OUT, OVERLAY } = require('./lib');

async function startLocal() {
  const { createApp } = require('../src/app');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forme-video-'));
  const app = createApp({ DATA_DIR: dir, LOG_REQUESTS: false });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${app.server.address().port}`, close: () => new Promise(r => app.server.close(r)) };
}

(async () => {
  const local = process.argv[2] ? null : await startLocal();
  const base = process.argv[2] || local.base;
  const { browser, context } = await launch();
  await context.addInitScript(OVERLAY);
  const page = await context.newPage();
  const cap = async (html, wait = 0) => { await page.evaluate(h => window.__cap && window.__cap(h), html); if (wait) await sleep(wait); };
  const glide = async (x, y, steps = 30) => page.mouse.move(x, y, { steps });
  const scrollTo = async (sel, offset = 90, ms = 1400) => {
    await page.evaluate(([s, o, d]) => new Promise(res => {
      const el = document.querySelector(s); const from = scrollY; const to = el.getBoundingClientRect().top + scrollY - o; const t0 = performance.now();
      const step = now => { const p = Math.min(1, (now - t0) / d); const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; scrollTo(0, from + (to - from) * e); p < 1 ? requestAnimationFrame(step) : res(); };
      requestAnimationFrame(step);
    }), [sel, offset, ms]);
  };
  const dragSlider = async (sel, fromPct, toPct, steps = 40) => {
    const b = await page.locator(sel).boundingBox();
    const y = b.y + b.height / 2;
    await glide(b.x + b.width * fromPct, y, 15); await page.mouse.down();
    await glide(b.x + b.width * toPct, y, steps); await page.mouse.up();
  };

  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await sleep(600);
  const rec = await screencast(page, path.join(OUT, 'walk-frames'));

  // 1. Landing
  await cap('<b>Forme</b>: fit tech for Pakistan\'s fashion brands', 300);
  for (const [x, y] of [[1300, 400], [1500, 650], [1150, 500], [1400, 300]]) await glide(x, y, 40);
  await sleep(1200);
  await cap('Three questions. The right size on every product. <b>Fewer returns.</b>', 2600);
  await scrollTo('.problem', 60); await cap('A size doubt at the door becomes a refused COD parcel', 3200);
  await scrollTo('#how', 60); await cap('Sync size charts, ask three questions, learn from every return', 3400);
  await scrollTo('#demo', 60); await cap('The live engine, answering real API calls', 1500);
  await dragSlider('#height', 0.55, 0.85); await sleep(700);
  await dragSlider('#weight', 0.35, 0.6); await sleep(700);
  await page.locator('#fit button[data-v="Relaxed"]').click(); await sleep(900);
  await page.locator('#prod-pick button').nth(1).click(); await cap('Kurtas, shalwar kameez, denim: each with its own size logic', 2400);
  await scrollTo('.features', 60, 1200); await cap('One platform: size finder, brand console, learning from every return', 3200);
  await scrollTo('#pricing', 60, 1200); await cap('Free to start, simple monthly plans', 2600);

  // 2. Demo store + widget
  await cap('');
  await page.goto(base + '/demo#/', { waitUntil: 'networkidle' });
  await cap('A retailer storefront with the Forme widget installed', 1800);
  await glide(700, 600); await sleep(400);
  await page.goto(base + '/demo#/p/NL-KRT-11', { waitUntil: 'networkidle' }); await sleep(1200);
  await cap('Shoppers tap <b>Find my size</b> on any product page', 1200);
  const trig = page.locator('[data-forme-sku] >> .trigger');
  const tb = await trig.boundingBox(); await glide(tb.x + tb.width / 2, tb.y + tb.height / 2); await sleep(300); await trig.click();
  await sleep(900);
  await cap('Height in feet and inches, and weight. That\'s it', 600);
  const hf = page.locator('[data-forme-panel] >> input[name=hft]'); await hf.click(); await page.keyboard.type('5', { delay: 140 });
  const hi = page.locator('[data-forme-panel] >> input[name=hin]'); await hi.click(); await page.keyboard.type('3', { delay: 140 });
  const w = page.locator('[data-forme-panel] >> input[name=weight]'); await w.click(); await page.keyboard.type('55', { delay: 120 });
  await page.locator('[data-forme-panel] >> .cards[data-name=sex] .card[data-v=female]').click(); await sleep(600);
  await page.locator('[data-forme-panel] >> .foot .btn').click(); await sleep(900);
  await cap('Then how they like clothes to fit', 600);
  await page.locator('[data-forme-panel] >> .cards[data-name=fit] .card[data-v="Regular"]').click(); await sleep(500);
  await page.locator('[data-forme-panel] >> .cards[data-name=build] .card[data-v="Average"]').click(); await sleep(500);
  await page.locator('[data-forme-panel] >> .foot .btn:not(.ghost)').click();
  await sleep(1400); await cap('A size, how likely it is to fit, and how each area will feel', 3200);
  await page.locator('[data-forme-panel] >> .lang').click(); await cap('Also in Urdu', 2200); await page.locator('[data-forme-panel] >> .lang').click(); await sleep(600);
  await page.locator('[data-forme-panel] >> .foot .btn').click(); await sleep(1000);
  await cap('The chosen size flows straight into the store’s own size picker', 2000);
  await page.locator('#add').click(); await sleep(1600);
  await page.locator('#checkout').click(); await cap('Every step is tracked back to the recommendation', 2400);

  // 3. Console
  await cap('');
  await page.goto(base + '/console', { waitUntil: 'networkidle' });
  await cap('The merchant console', 1000);
  await page.locator('#demo-btn').click();
  await page.waitForSelector('.kpi'); await sleep(800);
  await cap('Opens, recommendations, add-to-cart rate and influenced revenue', 3200);
  await glide(700, 640, 20); for (const x of [800, 950, 1100, 1250]) await glide(x, 640, 15); await sleep(600);
  await scrollTo('#feed', 300, 1000); await cap('Return impact, size mix, and a live feed of storefront events', 3600);
  await page.evaluate(() => scrollTo({ top: 0 }));
  await page.locator('.side .nav-item[data-v=catalog]').click(); await sleep(1200);
  await cap('Every product with its full garment size chart', 1600);
  await page.locator('[data-edit]').first().click(); await sleep(1000);
  await cap('Edit a chart and preview the recommendation live', 800);
  await dragSlider('#pv-h', 0.5, 0.9); await sleep(800);
  await dragSlider('#pv-w', 0.35, 0.65); await sleep(1600);
  await page.locator('#ed-close').click(); await sleep(600);
  await page.locator('.side .nav-item[data-v=insights]').click(); await sleep(1400);
  await cap('Forme learns which products run small or large from real returns', 3600);
  await page.locator('.side .nav-item[data-v=integration]').click(); await sleep(1200);
  await cap('Install steps for Shopify and WooCommerce, styling and keys', 3400);
  await cap('<b>Forme</b>: the right size, the first time. Made by Maverick Technologies', 3400);

  const frames = await rec.stop();
  await browser.close();
  if (local) await local.close();
  fs.mkdirSync(OUT, { recursive: true });
  const outFile = path.join(OUT, 'forme-walkthrough.mp4');
  encodeFrames(frames, path.join(OUT, 'walk-frames'), outFile);
  console.log(`Saved ${outFile} (${frames.length} frames, ${(frames.at(-1).t - frames[0].t).toFixed(1)}s)`);
})().catch(e => { console.error(e); process.exit(1); });
