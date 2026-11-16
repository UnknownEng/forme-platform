// End-to-end check of the shopper widget and key pages. Usage: node check-widget.js [baseUrl]
const fs = require('node:fs');
const path = require('node:path');
const { launch, sleep, OUT } = require('./lib');
const BASE = process.argv[2] || 'http://127.0.0.1:4173';

(async () => {
  const dir = path.join(OUT, 'check');
  fs.mkdirSync(dir, { recursive: true });
  const { browser } = await launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const shot = n => page.screenshot({ path: path.join(dir, `${n}.png`) });
  const W = s => page.locator(`[data-forme-panel] >> ${s}`);
  const text = async () => (await page.locator('[data-forme-panel]').evaluate(h => h.shadowRoot.textContent)).replace(/\s+/g, ' ');
  const out = {};

  // 1. Feet and inches on a kurta, women's sizes
  await page.goto(BASE + '/demo#/p/NL-KRT-11', { waitUntil: 'networkidle' }); await sleep(700);
  await page.locator('[data-forme-sku] >> .trigger').click(); await sleep(800);
  await shot('w1-step1');
  await W('input[name=hft]').fill('5'); await W('input[name=hin]').fill('3'); await W('input[name=weight]').fill('55');
  await W('.cards[data-name=sex] .card[data-v=female]').click();
  await W('.foot .btn').click(); await sleep(500);
  out.step2 = (await text()).includes('How do you like your clothes?');
  await W('.foot .btn:not(.ghost)').click();
  // Poll (the site's CSP blocks waitForFunction's eval); a live server can take a moment.
  for (let i = 0; i < 40 && !/Select size/.test(await text()); i++) await sleep(250);
  await sleep(400);
  await shot('w2-result');
  const t1 = await text();
  out.resultWords = /Very likely to fit|Likely to fit|Might fit|Not sure/.test(t1);
  out.noPercent = !/\d+% confidence/.test(t1);
  out.fitWords = /Fits well|Loose|Tight|Longer|Shorter/.test(t1);
  out.savedToken = !!(await page.evaluate(() => localStorage.getItem('forme_profile_token')));
  await W('.foot .btn').click(); await sleep(500);
  // Visible text only — the shadow root's <style> legitimately contains "%".
  out.triggerNoPercent = !(await page.locator('[data-forme-sku]').evaluate(h => [...h.shadowRoot.children].filter(e => e.tagName !== 'STYLE').map(e => e.textContent).join(' '))).includes('%');

  // 2. Someone else: inches typed as cm get corrected, nothing is saved
  const tokenBefore = await page.evaluate(() => localStorage.getItem('forme_profile_token'));
  const cacheBefore = await page.evaluate(() => localStorage.getItem('forme_profile_cache'));
  await page.goto(BASE + '/demo#/p/NL-JNS-08', { waitUntil: 'networkidle' }); await sleep(800);
  await page.locator('[data-forme-sku] >> .trigger').click(); await sleep(1500);
  await W('[data-act=edit]').first().click(); await sleep(400);
  await W('.cards[data-name=who] .card[data-v=other]').click(); await sleep(300);
  out.otherTitle = (await text()).includes('Their height and weight');
  await W('.unit-h').click(); await sleep(200);
  await W('input[name=hcm]').fill('5.8'); // feet typed into the cm box
  await W('input[name=weight]').fill('70');
  await W('.cards[data-name=sex] .card[data-v=male]').click();
  await W('details summary').click(); await sleep(200);
  await W('.cards[data-name=munit] .card[data-v=cm]').click(); await sleep(200);
  await W('input[name=waist]').fill('32'); // inches typed as cm
  await W('.foot .btn').click(); await sleep(400);
  out.autoCorrectNote = await W('.note-ok').textContent();
  await sleep(1600);
  await W('.foot .btn:not(.ghost)').click(); await sleep(1800);
  await shot('w3-other-result');
  out.otherSize = await W('.ringl b').textContent();
  out.otherNotSaved = (await page.evaluate(() => localStorage.getItem('forme_profile_token'))) === tokenBefore && (await page.evaluate(() => localStorage.getItem('forme_profile_cache'))) === cacheBefore;

  // 3. Urdu + right-to-left
  await W('.lang').click(); await sleep(600);
  await shot('w4-urdu');
  out.urdu = /سائز/.test(await text());
  out.rtl = await page.locator('[data-forme-panel]').evaluate(h => h.shadowRoot.querySelector('.sheet').getAttribute('dir'));
  await W('.lang').click(); await sleep(300);

  // 4. Forget me with confirmation
  await W('.x').click(); await sleep(500);
  await page.locator('[data-forme-sku] >> .trigger').click(); await sleep(1500);
  await W('[data-act=forget]').click(); await sleep(300);
  out.forgetAsks = (await text()).includes('Delete your saved size details');
  await W('.foot .danger').click(); await sleep(900);
  await shot('w5-deleted');
  out.forgetDone = (await text()).includes('Deleted') && !(await page.evaluate(() => localStorage.getItem('forme_profile_token')));

  // 5. Fast close/reopen keeps a usable panel and page scroll
  await W('.x').click(); await sleep(100);
  await page.locator('[data-forme-sku] >> .trigger').click(); await sleep(700);
  out.reopenPanel = await page.locator('[data-forme-panel]').evaluate(h => !!h.shadowRoot.querySelector('.sheet'));
  await W('.x').click(); await sleep(500);
  out.scrollRestored = await page.evaluate(() => document.documentElement.style.overflow === '');

  // 6. Landing: clicking the kurta in the live demo
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await sleep(800);
  await page.locator('#demo').scrollIntoViewIfNeeded();
  await page.locator('#prod-pick button').nth(1).click(); await sleep(900);
  out.landingKurtaSex = await page.locator('#sex button.on').getAttribute('data-v');
  out.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await shot('w6-landing-mobile');

  await browser.close();
  console.log(JSON.stringify({ ...out, errors }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
