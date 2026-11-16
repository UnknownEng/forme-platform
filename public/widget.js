/*!
 * Forme size widget v2
 * <script src="https://YOUR-FORME-HOST/widget.js" data-key="pk_live_…" data-lang="auto|en|ur" async></script>
 * <div data-forme-sku="SKU-123"></div>
 * Emits `forme:size-selected` (detail: { sku, size, recommended, rec_id, confidence }) on the placeholder; it bubbles to document.
 * window.Forme: open(sku), track(type, data), clearProfile(), refresh(), lastRecommendation(sku)
 */
(function () {
  'use strict';
  if (window.Forme && window.Forme.version) return;

  var script = document.currentScript || document.querySelector('script[data-key][src*="widget.js"]');
  var KEY = script && script.getAttribute('data-key');
  var API = (script && script.getAttribute('data-api')) || (script ? new URL(script.src, location.href).origin : location.origin);
  var STORE = 'forme_profile_token';
  var CACHE = 'forme_profile_cache';
  var REC = 'forme_recs';
  if (!KEY) { console.warn('[Forme] Missing data-key on the widget script tag.'); return; }

  /* ---------------- Storage that never throws (blocked cookies, private mode, sandboxes) ---------------- */
  function store(kind) { try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch (e) { return null; } }
  function load(k, kind) { try { var s = store(kind); return s ? JSON.parse(s.getItem(k)) : null; } catch (e) { return null; } }
  function save(k, v, kind) { try { var s = store(kind); if (s) s.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function drop(k, kind) { try { var s = store(kind); if (s) s.removeItem(k); } catch (e) {} }

  var config = { accent: '#c6ff3d', label: '', position: 'inline' };
  var products = {};
  var lastRecs = load(REC, 'session') || {};
  function token() { return load(STORE); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------------- Language: English and Urdu ---------------- */
  var attrLang = (script && script.getAttribute('data-lang')) || 'auto';
  var lang = load('forme_lang') || (attrLang === 'ur' || (attrLang === 'auto' && /^ur/i.test(navigator.language || '')) ? 'ur' : 'en');
  var STR = {
    en: {
      find: 'Find my size', powered: 'Powered by Forme', yourSize: 'Your size', close: 'Close',
      who: 'Who is this for?', me: 'Me', other: 'Someone else',
      t1me: "Let's find your size", t1other: 'Their height and weight', p1: 'Two numbers and we work out the rest.',
      notSaved: "We won't save these numbers.", saved: 'Saved on this phone for next time.',
      height: 'Height', ft: 'ft', in: 'in', cm: 'cm', kg: 'kg', useCm: 'Use cm instead', useFt: 'Use feet and inches',
      weight: 'Weight', sizes: 'Sizes for', women: 'Women', men: 'Men',
      tailor: 'Tailor measurements (optional)', tailorNote: 'Body measurements, not the clothes.', inches: 'inches',
      chest: 'Chest', waist: 'Waist', hips: 'Hips', shoulders: 'Shoulders', length: 'Length', inseam: 'Inside leg (crotch to ankle)',
      errHeight: 'Enter a height, for example 5 ft 4 in or 163 cm.', errWeight: 'Weight should be in kilograms, between 30 and 250.',
      readAs: 'We read that as {v}.', looksInches: '{f} {v} looked like inches, so we used {v} in.',
      next: 'Continue', back: 'Back', see: 'See my size',
      consent: 'We only use these numbers to pick a size. No name, phone number or photo. Delete any time with "Forget me".', privacy: 'Privacy',
      t2: 'How do you like your clothes?', fitted: 'Fitted', normal: 'Normal', loose: 'Loose',
      body: 'Body type', thin: 'Thin', medium: 'Medium', heavy: 'Heavy',
      loading: 'Matching you to this size chart…',
      c1: 'Very likely to fit', c2: 'Likely to fit', c3: 'Might fit — check the chart', c4: 'Not sure',
      area_chest: 'Chest', area_waist: 'Waist', area_hips: 'Hips', area_shoulders: 'Shoulders', area_length: 'Length', area_inseam: 'Leg length',
      fit_ideal: 'Fits well', fit_roomy: 'Loose', fit_snug: 'Tight', fit_long: 'Longer', fit_short: 'Shorter',
      eastLong: '(normal for this style)', guessed: '{a} guessed from height and weight.',
      up: "You're between sizes. Pick {s} if you want more room.", down: "You're between sizes. Pick {s} if you want it closer to the body.",
      allLoose: 'Even the smallest size will be loose. Did you type inches where we asked for cm?', allTight: 'Even the biggest size will be tight. Check your numbers, or ask the store about bigger sizes.',
      check: 'Check my numbers', choose: 'Or choose another size', select: 'Select size {s}', suggest: ' (we suggest {s})',
      chart: 'Garment measurements (cm) — the clothes, not your body', size: 'Size',
      edit: 'Edit details', forget: 'Forget me', forgetQ: 'Delete your saved size details from this phone and our servers?', yes: 'Yes, delete', cancel: 'Cancel',
      deleted: 'Deleted. Nothing about you is saved now.', oops: 'Something went wrong', retry: 'Try again', lang: 'اردو',
    },
    ur: {
      find: 'اپنا سائز معلوم کریں', powered: 'Forme کی مدد سے', yourSize: 'آپ کا سائز', close: 'بند کریں',
      who: 'یہ کس کے لیے ہے؟', me: 'میرے لیے', other: 'کسی اور کے لیے',
      t1me: 'آئیے آپ کا سائز معلوم کریں', t1other: 'ان کا قد اور وزن', p1: 'صرف دو چیزیں بتائیں، باقی ہم اندازہ لگا لیں گے۔',
      notSaved: 'یہ معلومات محفوظ نہیں کی جائیں گی۔', saved: 'اگلی بار کے لیے اس فون پر محفوظ۔',
      height: 'قد', ft: 'فٹ', in: 'انچ', cm: 'سینٹی میٹر', kg: 'کلو', useCm: 'سینٹی میٹر میں لکھیں', useFt: 'فٹ اور انچ میں لکھیں',
      weight: 'وزن', sizes: 'سائز', women: 'خواتین', men: 'مرد',
      tailor: 'درزی والے ناپ (اختیاری)', tailorNote: 'جسم کے ناپ، کپڑے کے نہیں۔', inches: 'انچ',
      chest: 'سینہ', waist: 'کمر', hips: 'کولہے', shoulders: 'کندھے', length: 'لمبائی', inseam: 'اندرونی ٹانگ (ران سے ٹخنے تک)',
      errHeight: 'قد درج کریں، مثلاً 5 فٹ 4 انچ یا 163 سینٹی میٹر۔', errWeight: 'وزن کلو میں 30 سے 250 کے درمیان ہونا چاہیے۔',
      readAs: 'ہم نے اسے {v} سمجھا۔', looksInches: '{f} {v} انچ لگا، اس لیے {v} انچ لیا گیا۔',
      next: 'آگے', back: 'واپس', see: 'میرا سائز دکھائیں',
      consent: 'ہم یہ معلومات صرف سائز بتانے کے لیے استعمال کرتے ہیں۔ نام، فون یا تصویر نہیں لی جاتی۔ "میری معلومات مٹا دیں" سے کبھی بھی ختم کریں۔', privacy: 'رازداری',
      t2: 'کپڑے کیسے پسند ہیں؟', fitted: 'تنگ', normal: 'نارمل', loose: 'کھلے',
      body: 'جسمانی ساخت', thin: 'دبلا', medium: 'درمیانہ', heavy: 'بھاری',
      loading: 'سائز چارٹ سے ملایا جا رہا ہے…',
      c1: 'فٹ ہونے کا بہت امکان', c2: 'فٹ ہونے کا امکان', c3: 'شاید فٹ ہو — چارٹ دیکھیں', c4: 'یقین نہیں',
      area_chest: 'سینہ', area_waist: 'کمر', area_hips: 'کولہے', area_shoulders: 'کندھے', area_length: 'لمبائی', area_inseam: 'ٹانگ کی لمبائی',
      fit_ideal: 'ٹھیک', fit_roomy: 'ڈھیلا', fit_snug: 'تنگ', fit_long: 'لمبا', fit_short: 'چھوٹا',
      eastLong: '(اس ڈیزائن میں عام ہے)', guessed: '{a} کا اندازہ قد اور وزن سے لگایا گیا۔',
      up: 'آپ دو سائز کے درمیان ہیں۔ زیادہ کھلا چاہیں تو {s} لیں۔', down: 'آپ دو سائز کے درمیان ہیں۔ تھوڑا تنگ چاہیں تو {s} لیں۔',
      allLoose: 'سب سے چھوٹا سائز بھی ڈھیلا ہوگا۔ کہیں سینٹی میٹر کی جگہ انچ تو نہیں لکھے؟', allTight: 'سب سے بڑا سائز بھی تنگ ہوگا۔ ناپ دوبارہ دیکھیں یا دکان سے بڑے سائز کا پوچھیں۔',
      check: 'ناپ دوبارہ دیکھیں', choose: 'یا کوئی اور سائز چنیں', select: 'سائز {s} منتخب کریں', suggest: ' (ہمارا مشورہ {s})',
      chart: 'کپڑے کے ناپ (سینٹی میٹر) — آپ کے جسم کے نہیں', size: 'سائز',
      edit: 'تبدیل کریں', forget: 'میری معلومات مٹا دیں', forgetQ: 'اس فون اور ہمارے سرور سے آپ کی سائز معلومات مٹا دیں؟', yes: 'ہاں، مٹا دیں', cancel: 'منسوخ',
      deleted: 'مٹا دیا گیا۔ اب آپ کی کوئی معلومات محفوظ نہیں۔', oops: 'کچھ غلط ہو گیا', retry: 'دوبارہ کوشش کریں', lang: 'English',
    },
  };
  function t(k, vars) { var s = (STR[lang] && STR[lang][k]) || STR.en[k] || k; if (vars) for (var v in vars) s = s.split('{' + v + '}').join(vars[v]); return s; }
  function triggerLabel() { return lang === 'en' && config.label ? config.label : t('find'); }

  /* ---------------- API ---------------- */
  function call(method, path, body, extra) {
    var headers = { Authorization: 'Bearer ' + KEY };
    if (body) headers['Content-Type'] = 'application/json';
    if (extra) for (var k in extra) headers[k] = extra[k];
    return fetch(API + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, keepalive: method === 'POST' && path === '/v1/events' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error((d.error && d.error.message) || 'Request failed'); e.code = d.error && d.error.code; throw e; } return d; }); });
  }
  function track(type, data) {
    data = data || {};
    var rec = data.rec_id || (data.sku && lastRecs[data.sku] && lastRecs[data.sku].rec_id) || null;
    var body = { type: type, sku: data.sku || null, size: data.size || null, value: data.value == null ? null : data.value };
    if (rec) body.rec_id = rec;
    return call('POST', '/v1/events', body).catch(function () {});
  }
  function getProduct(sku) {
    if (products[sku]) return Promise.resolve(products[sku]);
    return call('GET', '/v1/products/' + encodeURIComponent(sku)).then(function (d) { products[sku] = d.product; return d.product; });
  }
  function toProfile(f) {
    var p = { height: Number(f.height), fit: f.fit || 'Regular', build: f.build || 'Average' };
    if (f.sex) p.sex = f.sex;
    ['weight', 'chest', 'waist', 'hips', 'inseam'].forEach(function (k) { if (f[k]) p[k] = Number(f[k]); });
    return p;
  }
  // Recommend for the saved shopper. If this server has never seen the profile token
  // (e.g. another serverless instance), fall back to sending the saved numbers inline.
  function recommendSaved(sku) {
    var tk = token();
    var viaToken = tk ? call('POST', '/v1/recommend', { sku: sku, profile_token: tk }) : Promise.reject({ code: 'profile_required' });
    return viaToken.catch(function (e) {
      var f = load(CACHE);
      if (e.code !== 'profile_required' || !f || !f.height) throw e;
      return call('POST', '/v1/recommend', { sku: sku, profile: toProfile(f) });
    }).then(function (r) {
      lastRecs[sku] = { size: r.size, confidence: r.confidence, rec_id: r.rec_id };
      save(REC, lastRecs, 'session');
      return r;
    });
  }

  /* ---------------- Styles (scoped inside shadow roots) ---------------- */
  var STYLES = function () {
    return ':host{all:initial;font-family:"DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--a:' + config.accent + ';--ink:#121212;--paper:#f6f4ef;--line:#121212;--soft:rgba(18,18,18,.12);--text:#121212;--muted:#6f695e}' +
      '*{box-sizing:border-box}button{font:inherit;cursor:pointer;border:0}' +
      '.trigger{display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 18px 0 8px;border-radius:999px;background:#fff;color:var(--ink);font-weight:800;font-size:14px;border:1px solid rgba(15,15,18,.16);box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28);transition:transform .15s,box-shadow .15s}' +
      '.trigger:hover{transform:translateY(-1px);box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28)}.trigger:active{transform:translate(2px,2px);box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28)}' +
      '.tdot{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--a);color:var(--ink);font-size:14px;font-weight:800;border:1px solid rgba(15,15,18,.14)}' +
      '.tsize{padding:2px 9px;border-radius:8px;background:var(--a);color:var(--ink);font-size:13px;font-weight:800;margin-left:2px;border:1px solid rgba(15,15,18,.14)}' +
      '.tconf{color:var(--muted);font-weight:700;font-size:12px}' +
      '.overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(18,18,18,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;justify-content:flex-end;opacity:0;transition:opacity .3s}' +
      '.overlay.in{opacity:1}' +
      '.sheet{width:min(440px,100%);height:100%;background:var(--paper);color:var(--text);display:flex;flex-direction:column;transform:translateX(60px);opacity:.4;transition:transform .45s cubic-bezier(.34,1.56,.64,1),opacity .3s;border-left:1px solid rgba(15,15,18,.12);box-shadow:-30px 0 80px -30px rgba(15,15,18,.45)}' +
      '.in .sheet{transform:none;opacity:1}' +
      '@media(max-width:560px){.overlay{align-items:flex-end}.sheet{height:92%;border-radius:24px 24px 0 0;transform:translateY(60px);border-left:0;border-top:1px solid rgba(15,15,18,.12);box-shadow:0 -20px 60px -20px rgba(15,15,18,.4)}}' +
      '.head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid rgba(15,15,18,.16);background:#fff}' +
      '.mark{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--ink);color:#fff;font-weight:800;border:1px solid rgba(15,15,18,.16);box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28)}' +
      '.head b{flex:1;font-size:17px;font-weight:800}.head small{display:block;color:var(--muted);font-weight:600;font-size:12px}' +
      '.x{width:36px;height:36px;border-radius:10px;background:#fff;color:var(--ink);font-size:18px;border:1px solid rgba(15,15,18,.14);font-weight:800}.x:hover{background:var(--ink);color:#fff}' +
      '.body{flex:1;overflow:auto;padding:22px 20px}' +
      '.steps{display:flex;gap:6px;margin-bottom:22px}.steps i{flex:1;height:4px;border-radius:4px;background:rgba(15,15,18,.1);border:0!important;border:1px solid rgba(15,15,18,.14);transition:background .3s}.steps i.on{background:var(--ink)}' +
      'h3{font-size:26px;letter-spacing:-.03em;margin:0 0 6px;font-weight:800}p{color:#3c3832;font-size:14px;line-height:1.55;margin:0 0 18px}' +
      '.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}' +
      'label{display:grid;gap:6px;font-size:13px;font-weight:800;color:var(--ink)}' +
      '.inp{position:relative}.inp input{width:100%;height:52px;border-radius:12px;border:1px solid rgba(15,15,18,.16);background:#fff;color:var(--ink);font:inherit;font-size:19px;font-weight:800;padding:0 44px 0 14px;outline:none;transition:box-shadow .15s,transform .15s}' +
      '.inp input:focus{box-shadow:0 0 0 4px rgba(47,67,255,.15);transform:translate(-1px,-1px)}.inp span{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;font-weight:700}' +
      '.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}.cards.two{grid-template-columns:1fr 1fr}.card{padding:14px 10px;border-radius:14px;background:#fff;color:var(--ink);border:1px solid rgba(15,15,18,.16);display:grid;gap:8px;justify-items:center;font-weight:800;font-size:14px;transition:transform .15s,box-shadow .15s,background .15s}' +
      '.card svg{width:46px;height:46px}.card:hover{transform:translate(-2px,-2px);box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28)}.card.on{background:var(--ink);color:#fff;box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28)}' +
      '.lbl{font-size:13px;font-weight:800;color:var(--ink);margin:0 0 10px}' +
      'details{margin:4px 0 18px;border-radius:14px;background:#fff;border:1px solid rgba(15,15,18,.1);padding:12px 14px}summary{cursor:pointer;font-size:14px;font-weight:800}details .row{margin:14px 0 0}' +
      '.foot{padding:16px 20px;border-top:1px solid rgba(15,15,18,.16);display:flex;gap:10px;background:#fff}' +
      '.btn{flex:1;height:52px;border-radius:999px;background:var(--ink);color:#fff;font-weight:800;font-size:16px;border:1px solid rgba(15,15,18,.16);box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28);transition:transform .15s,box-shadow .15s}.btn:hover{transform:translateY(-1px);background:#25252b}.btn:active{transform:scale(.98)}.btn:disabled{opacity:.5}' +
      '.btn.ghost{flex:none;padding:0 20px;background:#fff;color:var(--ink)}' +
      '.err{color:#e5341f;font-size:13px;font-weight:700;min-height:18px;margin:4px 0 0}' +
      '.res{display:grid;justify-items:center;text-align:center;padding-top:6px}' +
      '.ringw{position:relative;width:176px;height:176px;margin:4px 0 16px;border-radius:50%;background:#fff;border:1px solid rgba(15,15,18,.12);box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28)}.ringw svg{width:100%;height:100%}' +
      '.ringw .fg{transition:stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)}' +
      '.ringl{position:absolute;inset:0;display:grid;place-content:center;line-height:1}.ringl b{font-size:58px;letter-spacing:-.04em;font-weight:800;animation:pop .6s cubic-bezier(.34,1.56,.64,1) both .2s}.ringl small{color:var(--muted);font-size:12px;font-weight:700;margin-top:6px}' +
      '@keyframes pop{from{transform:scale(.85);opacity:0}}' +
      '.badge{display:inline-block;padding:6px 14px;border-radius:999px;background:var(--a);color:var(--ink);font-weight:800;font-size:13px;margin-bottom:12px;border:1px solid rgba(15,15,18,.14)}' +
      '.alt{font-size:13px;color:var(--ink);margin:0 0 16px;padding:10px 14px;border-radius:12px;background:#eceeff;border:1px solid rgba(15,15,18,.14)}' +
      '.notes{display:grid;gap:8px;width:100%;margin:6px 0 16px}.note{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:12px;background:#fff;border:1px solid rgba(15,15,18,.14);font-size:14px;animation:slide .5s cubic-bezier(.34,1.56,.64,1) both}' +
      '.note b{text-transform:capitalize}.note em{font-style:normal;font-weight:800}.note small{color:var(--muted);font-weight:600;margin-left:4px}.note.ideal em{color:#0b7a4d}.note.roomy em,.note.long em{color:#2f43ff}.note.snug em,.note.short em{color:#c23a24}' +
      '@keyframes slide{from{opacity:0;transform:translateY(8px)}}' +
      '.bar{position:relative;height:10px;border-radius:6px;background:#fff;border:1px solid rgba(15,15,18,.14);width:90px;margin-left:12px}.bar i{position:absolute;top:-5px;width:16px;height:16px;border-radius:50%;background:var(--ink);transform:translateX(-50%)}.bar:after{content:"";position:absolute;left:50%;top:-5px;bottom:-5px;width:2px;background:var(--ink)}' +
      '.sizes{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:4px 0 6px}.sz{min-width:48px;height:42px;border-radius:10px;background:#fff;color:var(--ink);font-weight:800;border:1px solid rgba(15,15,18,.16)}.sz.on{background:var(--ink);color:#fff;box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28)}' +
      'table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}th,td{padding:8px 6px;text-align:center;border-bottom:1.5px solid var(--soft)}th{color:var(--ink);font-weight:800;text-transform:capitalize}tr.on td{background:#f0efe9;font-weight:800}' +
      '.small{font-size:12px;color:var(--muted);text-align:center;margin-top:14px;line-height:1.5}.link{background:none;color:#3d5afe;font-weight:800;font-size:12px;text-decoration:underline;padding:0}' +
      '.consent{font-size:11.5px;color:var(--muted);margin:10px 0 0;line-height:1.5}.consent a{color:#3d5afe;font-weight:700}' +
      '.load{display:grid;place-items:center;gap:16px;padding:60px 0}.spin{width:44px;height:44px;border-radius:50%;border:3px solid rgba(15,15,18,.1);border-top-color:var(--ink);animation:sp .8s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}' +
      '.lang{height:34px;padding:0 12px;border-radius:10px;background:#fff;border:1px solid rgba(15,15,18,.14);font-weight:800;font-size:13px;color:var(--ink)}.lang:hover{background:#ebe8e1}' +
      '.row.one{grid-template-columns:1fr}.hint{font-size:12.5px;color:var(--muted);margin:6px 0 10px}.units .cards{margin-bottom:12px}' +
      '.unit-h{display:inline-block;margin:-4px 0 14px;font-size:13px}' +
      '.note-ok{font-size:13px;font-weight:700;color:#0b7a47;min-height:0;margin:4px 0}' +
      '.warn{width:100%;text-align:start;font-size:13.5px;font-weight:600;padding:12px 14px;margin:0 0 14px;border-radius:12px;border:1px solid rgba(15,15,18,.14);background:#ffd6cc}' +
      '.note em small{font-weight:600;color:var(--muted);margin-inline-start:4px}' +
      '.btn.danger{background:#d6331f;color:#fff}' +
      '.ok-big{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-size:30px;font-weight:800;background:var(--a);border:1px solid rgba(15,15,18,.12);box-shadow:0 1px 2px rgba(15,15,18,.06),0 8px 20px -12px rgba(15,15,18,.28);margin:20px auto 12px}' +
      '[dir=rtl]{font-family:"Noto Nastaliq Urdu","Jameel Noori Nastaleeq","Urdu Typesetting","DM Sans",system-ui,sans-serif}' +
      '.sheet[dir=rtl]{border-left:0;border-right:1px solid rgba(15,15,18,.12);box-shadow:30px 0 80px -30px rgba(15,15,18,.45)}[dir=rtl] .inp span{right:auto;left:14px}[dir=rtl] .inp input{padding:0 14px 0 44px}' +
      '[dir=rtl] h3,[dir=rtl] p,[dir=rtl] label,[dir=rtl] .lbl{line-height:1.9}' +
      '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}';
  };

  /* ---------------- Inline trigger on each placeholder ---------------- */
  function mount(el) {
    var sku = el.getAttribute('data-forme-sku');
    if (!sku) return;
    if (el.__forme) {
      // Single-page stores reuse the same element for the next product.
      if (el.__forme.sku === sku) return;
      el.__forme.sku = sku; renderTrigger(el); refreshSaved(el); return;
    }
    var root;
    try { root = el.attachShadow ? el.attachShadow({ mode: 'open' }) : el; }
    catch (e) {
      // Some elements (li, td, button…) cannot host a shadow root: use an inner span.
      var inner = document.createElement('span'); el.appendChild(inner);
      try { root = inner.attachShadow({ mode: 'open' }); } catch (x) { root = inner; }
    }
    el.__forme = { sku: sku, root: root };
    renderTrigger(el);
    refreshSaved(el);
  }
  function refreshSaved(el) {
    var sku = el.__forme.sku;
    if (token() || load(CACHE)) recommendSaved(sku).then(function () { if (el.__forme.sku === sku) renderTrigger(el); }).catch(function () {});
  }
  function renderTrigger(el) {
    var st = el.__forme, r = lastRecs[st.sku];
    st.root.innerHTML = '<style>' + STYLES() + '</style><button class="trigger" part="button" aria-haspopup="dialog"' + (lang === 'ur' ? ' dir="rtl"' : '') + '>' +
      '<span class="tdot">f</span>' + (r ? esc(t('yourSize')) + ': <span class="tsize">' + esc(r.size) + '</span>' : esc(triggerLabel())) + '</button>';
    st.root.querySelector('button').onclick = function () { open(st.sku, el); };
  }
  function scan() {
    var els = document.querySelectorAll('[data-forme-sku]');
    for (var i = 0; i < els.length; i++) { try { mount(els[i]); } catch (e) {} }
  }
  function refresh() {
    var els = document.querySelectorAll('[data-forme-sku]');
    for (var i = 0; i < els.length; i++) { try { if (els[i].__forme) renderTrigger(els[i]); else mount(els[i]); } catch (e) {} }
  }

  /* ---------------- Panel ---------------- */
  var host, shadow, state, gen = 0, closeTimer;
  function blankForm() { return { height: '', weight: '', fit: 'Regular', build: 'Average', sex: '', hUnit: 'ft', mUnit: 'in' }; }
  function open(sku, anchor) {
    clearTimeout(closeTimer);
    var my = ++gen;
    if (!host) { host = document.createElement('div'); host.setAttribute('data-forme-panel', ''); document.body.appendChild(host); shadow = host.attachShadow({ mode: 'open' }); }
    var cached = load(CACHE);
    state = { sku: sku, gen: my, anchor: anchor || document.querySelector('[data-forme-sku="' + (window.CSS && window.CSS.escape ? window.CSS.escape(sku) : sku) + '"]'), forOther: false, form: cached || blankForm(), prevFocus: document.activeElement };
    track('widget_open', { sku: sku });
    frame();
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    getProduct(sku).catch(function () {});
    if (token() || cached) {
      loading();
      recommendSaved(sku).then(function (r) { if (my === gen) result(r); }).catch(function (e) {
        if (my !== gen) return;
        if (e.code === 'profile_required') { drop(STORE); step1(); } else error(e);
      });
    } else step1();
  }
  function frame() {
    shadow.innerHTML = '<style>' + STYLES() + '</style><div class="overlay" role="dialog" aria-modal="true" aria-label="' + esc(t('find')) + '"><div class="sheet"' + (lang === 'ur' ? ' dir="rtl"' : '') + '><div class="head"><span class="mark">f</span><b>' + esc(t('find')) + '<small>' + esc(t('powered')) + '</small></b><button class="lang" type="button">' + esc(t('lang')) + '</button><button class="x" aria-label="' + esc(t('close')) + '">×</button></div><div class="body"></div><div class="foot"></div></div></div>';
    var ov = shadow.querySelector('.overlay');
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    shadow.querySelector('.x').onclick = close;
    shadow.querySelector('.lang').onclick = function () {
      lang = lang === 'ur' ? 'en' : 'ur'; save('forme_lang', lang);
      var view = state.view; frame(); requestAnimationFrame(function () { $('.overlay') && $('.overlay').classList.add('in'); });
      if (view === 'result' && state.result) result(state.result); else if (view === 'step2') step2(); else step1();
      refresh();
    };
    requestAnimationFrame(function () { ov.classList.add('in'); });
  }
  function close() {
    gen++;
    var ov = shadow && shadow.querySelector('.overlay');
    document.removeEventListener('keydown', onKey);
    document.documentElement.style.overflow = '';
    if (!ov) return;
    ov.classList.remove('in');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () { shadow.innerHTML = ''; if (state && state.prevFocus && state.prevFocus.focus) state.prevFocus.focus(); }, 350);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function $(s) { return shadow.querySelector(s); }
  function body(html, foot) {
    var b = $('.body'); if (!b) return false;
    b.onkeydown = null; b.innerHTML = html; $('.foot').innerHTML = foot || '';
    var f = $('.body input, .body button'); if (f) f.focus({ preventScroll: true });
    return true;
  }
  function steps(n) { return '<div class="steps"><i class="' + (n >= 0 ? 'on' : '') + '"></i><i class="' + (n >= 1 ? 'on' : '') + '"></i><i class="' + (n >= 2 ? 'on' : '') + '"></i></div>'; }
  function loading() { body('<div class="load"><div class="spin"></div><p>' + esc(t('loading')) + '</p></div>'); }
  function error(e) { state.view = 'error'; if (body('<h3>' + esc(t('oops')) + '</h3><p>' + esc(e.message || '') + '</p>', '<button class="btn">' + esc(t('retry')) + '</button>')) $('.foot .btn').onclick = step1; }
  function seg(name, opts, value) {
    return '<div class="cards' + (opts.length === 2 ? ' two' : '') + '" data-name="' + name + '">' + opts.map(function (o) {
      return '<button type="button" class="card' + (value === o[0] ? ' on' : '') + '" data-v="' + o[0] + '" aria-pressed="' + (value === o[0]) + '">' + (o[2] || '') + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function bindSeg(onPick) {
    shadow.querySelectorAll('.cards').forEach(function (group) {
      group.onclick = function (e) {
        var b = e.target.closest('.card'); if (!b) return;
        group.querySelectorAll('.card').forEach(function (c) { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', String(c === b)); });
        onPick(group.getAttribute('data-name'), b.getAttribute('data-v'));
      };
    });
  }
  function field(name, label, unit, val) {
    return '<label>' + esc(label) + '<div class="inp"><input type="text" inputmode="decimal" autocomplete="off" name="' + name + '" value="' + esc(val == null ? '' : val) + '"><span>' + esc(unit) + '</span></div></label>';
  }
  var BOTTOMS = ['Jeans', 'Trousers', 'Shorts'];
  function measureFields() {
    var p = products[state.sku], cat = p && p.category;
    if (BOTTOMS.indexOf(cat) >= 0) return ['waist', 'hips', 'inseam'];
    if (cat === 'Dresses') return ['chest', 'waist', 'hips'];
    if (cat) return ['chest', 'waist'];
    return ['chest', 'waist', 'hips'];
  }
  var IN = 2.54;
  function r1(n) { return Math.round(n * 10) / 10; }

  function step1() {
    state.view = 'step1';
    var f = state.form;
    if (!f.hUnit) f.hUnit = 'ft';
    if (!f.mUnit) f.mUnit = 'in';
    var hFt = f.height ? Math.floor(f.height / 30.48) : '', hIn = f.height ? Math.round((f.height - hFt * 30.48) / IN) : '';
    if (hIn === 12) { hFt += 1; hIn = 0; }
    var hHtml = f.hUnit === 'ft'
      ? '<div class="row">' + field('hft', t('height'), t('ft'), hFt) + field('hin', ' ', t('in'), hIn) + '</div>'
      : '<div class="row one">' + field('hcm', t('height'), t('cm'), f.height || '') + '</div>';
    var shown = measureFields();
    var mval = function (k) { return f[k] ? (f.mUnit === 'in' ? r1(f[k] / IN) : f[k]) : ''; };
    var anyM = shown.some(function (k) { return f[k]; });
    var ok = body(steps(0) +
      '<div class="lbl">' + esc(t('who')) + '</div>' + seg('who', [['me', t('me')], ['other', t('other')]], state.forOther ? 'other' : 'me') +
      '<h3>' + esc(state.forOther ? t('t1other') : t('t1me')) + '</h3><p>' + esc(t('p1')) + ' ' + esc(state.forOther ? t('notSaved') : t('saved')) + '</p>' +
      hHtml + '<button type="button" class="link unit-h">' + esc(f.hUnit === 'ft' ? t('useCm') : t('useFt')) + '</button>' +
      '<div class="row one">' + field('weight', t('weight'), t('kg'), f.weight) + '</div>' +
      '<div class="lbl">' + esc(t('sizes')) + '</div>' + seg('sex', [['female', t('women')], ['male', t('men')]], f.sex) +
      '<details class="tailor"' + (anyM || state.mOpen ? ' open' : '') + '><summary>' + esc(t('tailor')) + '</summary><p class="hint">' + esc(t('tailorNote')) + '</p>' +
      '<div class="units">' + seg('munit', [['in', t('inches')], ['cm', t('cm')]], f.mUnit) + '</div>' +
      '<div class="row">' + shown.map(function (k) { return field(k, t(k), f.mUnit === 'in' ? t('in') : t('cm'), mval(k)); }).join('') + '</div></details>' +
      '<div class="err" aria-live="polite"></div><div class="note-ok" aria-live="polite"></div>' +
      '<p class="consent">' + esc(t('consent')) + ' <a href="' + API + '/privacy" target="_blank" rel="noopener">' + esc(t('privacy')) + '</a></p>',
      '<button class="btn">' + esc(t('next')) + '</button>');
    if (!ok) return;
    var grab = function () { var v = {}; shadow.querySelectorAll('.body input').forEach(function (i) { v[i.name] = i.value.replace(',', '.').trim(); }); return v; };
    var keep = function () { var v = grab(); readInto(v, true); };
    bindSeg(function (name, val) {
      if (name === 'who') { keep(); state.forOther = val === 'other'; if (state.forOther) state.form = blankForm(); else state.form = load(CACHE) || state.form; step1(); }
      else if (name === 'sex') f.sex = val;
      else if (name === 'munit') { keep(); f.mUnit = val; state.mOpen = true; step1(); }
    });
    $('.tailor').ontoggle = function () { state.mOpen = $('.tailor').open; };
    $('.unit-h').onclick = function () { keep(); f.hUnit = f.hUnit === 'ft' ? 'cm' : 'ft'; step1(); };
    $('.foot .btn').onclick = function () {
      var v = grab();
      var msg = readInto(v, false);
      if (msg === false) return;
      if (msg) { $('.note-ok').textContent = msg; setTimeout(step2, 1400); } else step2();
    };
    $('.body').onkeydown = function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') $('.foot .btn').click(); };
  }
  // Reads the form into state.form (always in cm). Returns false on error, or a note
  // describing any automatic unit correction.
  function readInto(v, quiet) {
    var f = state.form, notes = [], err = function (m) { if (!quiet) $('.err').textContent = m; return false; };
    var h = null;
    if ('hft' in v) {
      var ft = parseFloat(v.hft), inch = parseFloat(v.hin || '0');
      if (isFinite(ft)) {
        if (ft > 3 && ft < 8 && Math.floor(ft) !== ft && !v.hin) { var whole = Math.floor(ft); inch = Math.round((ft - whole) * 10); ft = whole; } // "5.3" means 5 ft 3 in
        h = ft * 30.48 + (isFinite(inch) ? inch : 0) * IN;
      }
    } else if ('hcm' in v) {
      var c = parseFloat(v.hcm);
      if (c >= 4 && c < 8) { var w2 = Math.floor(c), i2 = Math.round((c - w2) * 10); h = w2 * 30.48 + i2 * IN; notes.push(t('readAs', { v: w2 + "' " + i2 + '" (' + Math.round(h) + ' cm)' })); }
      else if (c >= 48 && c <= 90) { h = c * IN; notes.push(t('readAs', { v: c + ' in (' + Math.round(h) + ' cm)' })); }
      else h = c;
    }
    if (quiet) { if (h) f.height = r1(h); }
    else if (!(h >= 120 && h <= 225)) return err(t('errHeight'));
    else f.height = r1(h);
    var w = parseFloat(v.weight);
    if (v.weight && !(w >= 30 && w <= 250)) { if (!quiet) return err(t('errWeight')); } else f.weight = v.weight ? w : '';
    ['chest', 'waist', 'hips', 'inseam'].forEach(function (k) {
      if (!(k in v)) return;
      var x = parseFloat(v[k]);
      if (!v[k] || !isFinite(x)) { f[k] = ''; return; }
      var cm = f.mUnit === 'in' ? x * IN : x;
      // Tailors measure in inches: a "36" chest in the cm box is really 36 inches.
      var tooSmall = { chest: 60, waist: 50, hips: 60, inseam: 45 }[k];
      if (f.mUnit === 'cm' && cm < tooSmall && x * IN >= tooSmall) { cm = x * IN; notes.push(t('looksInches', { f: t(k), v: x })); }
      f[k] = r1(cm);
    });
    return notes.join(' ');
  }
  function step2() {
    state.view = 'step2';
    var f = state.form;
    if (!body(steps(1) + '<h3>' + esc(t('t2')) + '</h3>' +
      seg('fit', [['Slim', t('fitted')], ['Regular', t('normal')], ['Relaxed', t('loose')]], f.fit) +
      '<div class="lbl">' + esc(t('body')) + '</div>' + seg('build', [['Slim', t('thin')], ['Average', t('medium')], ['Broad', t('heavy')]], f.build) +
      '<div class="err" aria-live="polite"></div>',
      '<button class="btn ghost">' + esc(t('back')) + '</button><button class="btn">' + esc(t('see')) + '</button>')) return;
    bindSeg(function (name, val) { f[name] = val; });
    $('.foot .ghost').onclick = step1;
    $('.foot .btn:not(.ghost)').onclick = submit;
  }
  function submit() {
    var f = state.form, p = toProfile(f), my = gen, sku = state.sku;
    loading();
    if (state.forOther) {
      // Someone else: recommend once, keep nothing.
      call('POST', '/v1/recommend', { sku: sku, profile: p }).then(function (r) { if (my === gen) result(r); }).catch(function (e) { if (my === gen) error(e); });
      return;
    }
    save(CACHE, f);
    var tk = token();
    var saved = tk ? call('PUT', '/v1/profiles/me', p, { 'X-Forme-Profile': tk }).then(function () { return tk; }).catch(function () { return null; }) : Promise.resolve(null);
    saved.then(function (existing) {
      return existing || call('POST', '/v1/profiles', p).then(function (r) { save(STORE, r.profile_token); return r.profile_token; }).catch(function () { return null; });
    }).then(function () { return recommendSaved(sku); })
      .then(function (r) { if (my === gen) { result(r); refresh(); } }).catch(function (e) { if (my === gen) error(e); });
  }
  function confWord(c) { return c >= 88 ? t('c1') : c >= 74 ? t('c2') : c >= 58 ? t('c3') : t('c4'); }
  function ringSvg(v) {
    var r = 74, c = 2 * Math.PI * r, col = v >= 74 ? '#2f43ff' : v >= 58 ? '#e8a317' : '#e5482f';
    return '<svg viewBox="0 0 170 170"><circle cx="85" cy="85" r="' + r + '" fill="none" stroke="rgba(18,18,18,.1)" stroke-width="12"/><circle class="fg" cx="85" cy="85" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" data-to="' + (c * (1 - v / 100)) + '"/></svg>';
  }
  var EASTERN = ['Kurtas', 'Shalwar Kameez', 'Dresses'];
  function result(r) {
    state.view = 'result'; state.result = r; state.selected = r.size;
    var p = products[state.sku];
    var east = p && EASTERN.indexOf(p.category) >= 0;
    var notes = r.fit_notes.map(function (n, i) {
      return '<div class="note ' + esc(n.fit) + '" style="animation-delay:' + (0.15 + i * 0.08) + 's"><b>' + esc(t('area_' + n.area)) + '</b><em>' + esc(t('fit_' + n.fit)) + (east && n.area === 'length' && n.fit === 'long' ? ' <small>' + esc(t('eastLong')) + '</small>' : '') + '</em></div>';
    }).join('');
    var guessed = r.fit_notes.filter(function (n) { return n.estimated; }).map(function (n) { return t('area_' + n.area); });
    var warn = r.warning === 'all_loose' ? t('allLoose') : r.warning === 'all_tight' ? t('allTight') : '';
    var alt = r.alternative ? t(r.alternative.direction === 'up' ? 'up' : 'down', { s: r.alternative.size }) : '';
    if (!body(steps(2) + '<div class="res">' +
      (warn ? '<div class="warn">' + esc(warn) + ' <button class="link" data-act="edit">' + esc(t('check')) + '</button></div>' : '') +
      '<span class="badge">' + esc(confWord(r.confidence)) + '</span><div class="ringw">' + ringSvg(r.confidence) + '<div class="ringl"><b>' + esc(r.size) + '</b></div></div>' +
      (alt ? '<div class="alt">' + esc(alt) + '</div>' : '') +
      '<div class="notes">' + notes + '</div>' +
      (guessed.length ? '<p class="hint">' + esc(t('guessed', { a: guessed.join(', ') })) + '</p>' : '') +
      '<div class="lbl" style="margin-top:6px">' + esc(t('choose')) + '</div><div class="sizes" role="radiogroup" aria-label="' + esc(t('choose')) + '"></div><div class="chart"></div>' +
      '<div class="small">' + (state.forOther ? '' : '<button class="link" data-act="edit">' + esc(t('edit')) + '</button> · <button class="link" data-act="forget">' + esc(t('forget')) + '</button> · ') +
      '<a class="link" href="' + API + '/privacy" target="_blank" rel="noopener">' + esc(t('privacy')) + '</a></div></div>',
      '<button class="btn">' + esc(t('select', { s: r.size })) + '</button>')) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () { var fg = $('.fg'); if (fg) fg.style.strokeDashoffset = fg.getAttribute('data-to'); }); });
    var my = gen;
    getProduct(state.sku).then(function () { if (my === gen && state.view === 'result') drawSizes(); }).catch(function () {});
    $('.foot .btn').onclick = choose;
    shadow.querySelectorAll('[data-act=edit]').forEach(function (b) { b.onclick = step1; });
    var fg = $('[data-act=forget]');
    if (fg) fg.onclick = confirmForget;
    if (state.anchor && state.anchor.__forme && !state.forOther) renderTrigger(state.anchor);
  }
  function confirmForget() {
    state.view = 'forget';
    if (!body('<h3>' + esc(t('forget')) + '</h3><p>' + esc(t('forgetQ')) + '</p>', '<button class="btn ghost">' + esc(t('cancel')) + '</button><button class="btn danger">' + esc(t('yes')) + '</button>')) return;
    $('.foot .ghost').onclick = function () { result(state.result); };
    $('.foot .danger').onclick = function () {
      var tk = token(), my = gen;
      (tk ? call('DELETE', '/v1/profiles/me', null, { 'X-Forme-Profile': tk }) : Promise.resolve()).catch(function () {}).then(function () {
        drop(STORE); drop(CACHE); drop(REC, 'session');
        lastRecs = {}; state.form = blankForm(); refresh();
        if (my !== gen) return;
        state.view = 'deleted';
        if (body('<div class="res"><div class="ok-big">✓</div><h3>' + esc(t('deleted')) + '</h3></div>', '<button class="btn">' + esc(t('next')) + '</button>')) $('.foot .btn').onclick = step1;
      });
    };
  }
  function drawSizes() {
    var p = products[state.sku]; if (!p || !$('.sizes')) return;
    $('.sizes').innerHTML = p.chart.map(function (row) { return '<button class="sz' + (row.size === state.selected ? ' on' : '') + '" role="radio" aria-checked="' + (row.size === state.selected) + '" data-s="' + esc(row.size) + '">' + esc(row.size) + '</button>'; }).join('');
    var dims = ['chest', 'waist', 'hips', 'shoulders', 'length', 'inseam'].filter(function (d) { return p.chart.some(function (r) { return r[d] != null; }); });
    $('.chart').innerHTML = '<details><summary>' + esc(t('chart')) + '</summary><table><tr><th>' + esc(t('size')) + '</th>' + dims.map(function (d) { return '<th>' + esc(t('area_' + d)) + '</th>'; }).join('') + '</tr>' +
      p.chart.map(function (r) { return '<tr class="' + (r.size === state.result.size ? 'on' : '') + '"><td>' + esc(r.size) + '</td>' + dims.map(function (d) { return '<td>' + (r[d] == null ? '–' : esc(r[d])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></details>';
    $('.sizes').onclick = function (e) {
      var b = e.target.closest('.sz'); if (!b) return;
      state.selected = b.getAttribute('data-s');
      shadow.querySelectorAll('.sz').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      $('.foot .btn').textContent = t('select', { s: state.selected }) + (state.selected === state.result.size ? '' : t('suggest', { s: state.result.size }));
    };
  }
  function choose() {
    var r = state.result, detail = { sku: state.sku, size: state.selected, recommended: r.size, rec_id: r.rec_id, confidence: r.confidence, for_someone_else: state.forOther };
    track('size_selected', { sku: state.sku, size: state.selected, rec_id: r.rec_id });
    var target = state.anchor || document;
    target.dispatchEvent(new CustomEvent('forme:size-selected', { detail: detail, bubbles: true, composed: true }));
    close();
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    call('GET', '/v1/widget-config').then(function (c) { for (var k in c.widget) config[k] = c.widget[k]; refresh(); }).catch(function (e) { console.warn('[Forme] ' + e.message); });
    scan();
    if ('MutationObserver' in window) new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-forme-sku'] });
  }
  window.Forme = {
    version: '2.0.0',
    open: function (sku) { open(sku); },
    track: track,
    refresh: refresh,
    lastRecommendation: function (sku) { return lastRecs[sku] || null; },
    clearProfile: function () { drop(STORE); drop(CACHE); drop(REC, 'session'); lastRecs = {}; refresh(); },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
