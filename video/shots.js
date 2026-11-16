// Screenshots of every main page, for design review. Usage: node shots.js [baseUrl]
const fs = require('node:fs');
const path = require('node:path');
const { launch, sleep, OUT } = require('./lib');

const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const ADMIN_PW = process.env.FORME_ADMIN_PASSWORD || (() => { try { return fs.readFileSync(path.join(__dirname, '..', 'data', 'admin-password.txt'), 'utf8').trim(); } catch { return ''; } })();

(async () => {
  const dir = path.join(OUT, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  const { browser, context } = await launch({ width: 1440, height: 900 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });
  const shot = async (name, opts = {}) => { await page.screenshot({ path: path.join(dir, `${name}.png`), ...opts }); };
  const scrollShot = async (name, sel) => { await page.locator(sel).scrollIntoViewIfNeeded(); await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'start' }), sel); await sleep(1400); await shot(name); };

  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await sleep(2200); await shot('01-hero');
  for (const [n, s] of [['02-problem', '.problem'], ['03-how', '#how'], ['04-demo', '#demo'], ['05-roi', '#roi'], ['06-features', '.features'], ['07-dev', '#developers'], ['08-pricing', '#pricing']]) await scrollShot(n, s);

  await page.goto(BASE + '/demo#/', { waitUntil: 'networkidle' }); await sleep(1200); await shot('09-store');
  await page.goto(BASE + '/demo#/p/NL-KRT-11', { waitUntil: 'networkidle' }); await sleep(900);
  await page.locator('[data-forme-sku] >> .trigger').click(); await sleep(900); await shot('10-widget-step1');
  await page.locator('[data-forme-panel] >> input[name=height]').fill('160');
  await page.locator('[data-forme-panel] >> input[name=weight]').fill('55');
  await page.locator('[data-forme-panel] >> .card[data-v=female]').click();
  await page.locator('[data-forme-panel] >> .foot .btn').click(); await sleep(600);
  await page.locator('[data-forme-panel] >> .foot .btn:not(.ghost)').click(); await sleep(2600); await shot('11-widget-result');

  await page.goto(BASE + '/console', { waitUntil: 'networkidle' }); await sleep(600); await shot('12-console-login');
  await page.locator('#demo-btn').click(); await page.waitForSelector('.kpi'); await sleep(2200); await shot('13-console-overview');
  await page.goto(BASE + '/console#insights', { waitUntil: 'networkidle' }); await sleep(1800); await shot('14-console-insights');

  if (ADMIN_PW) {
    await page.goto(BASE + '/admin', { waitUntil: 'networkidle' }); await sleep(600); await shot('15-admin-login');
    await page.locator('#pw').fill(ADMIN_PW); await page.locator('#lf button').click(); await page.waitForSelector('.kpi'); await sleep(2000); await shot('16-admin-overview');
    await page.goto(BASE + '/admin#engine', { waitUntil: 'networkidle' }); await sleep(2000); await shot('17-admin-engine');
    await page.goto(BASE + '/admin#merchants', { waitUntil: 'networkidle' }); await sleep(1200); await shot('18-admin-merchants');
  }
  await page.goto(BASE + '/docs', { waitUntil: 'networkidle' }); await sleep(800); await shot('19-docs');
  await page.goto(BASE + '/privacy', { waitUntil: 'networkidle' }); await sleep(500); await shot('20-privacy');

  // Mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' }); await sleep(1800); await mp.screenshot({ path: path.join(dir, '21-mobile-hero.png') });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await browser.close();
  console.log(JSON.stringify({ errors, mobileOverflowPx: overflow }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
