/*!
 * Forme size widget v1
 * <script src="https://YOUR-FORME-HOST/widget.js" data-key="pk_live_…" async></script>
 * <div data-forme-sku="SKU-123"></div>
 * Emits `forme:size-selected` (detail: { sku, size, rec_id, confidence }) on the placeholder; it bubbles to document.
 * window.Forme: open(sku), track(type, data), clearProfile(), refresh()
 */
(function () {
  'use strict';
  if (window.Forme && window.Forme.version) return;

  var script = document.currentScript || document.querySelector('script[data-key][src*="widget.js"]');
  var KEY = script && script.getAttribute('data-key');
  var API = (script && script.getAttribute('data-api')) || (script ? new URL(script.src, location.href).origin : location.origin);
  var STORE = 'forme_profile_token';
  var REC = 'forme_recs';
  if (!KEY) { console.warn('[Forme] Missing data-key on the widget script tag.'); return; }

  var config = { accent: '#d4f36b', label: 'Find my size', position: 'inline' };
  var products = {};
  var lastRecs = load(REC, sessionStorage) || {};

  function load(k, s) { try { return JSON.parse((s || localStorage).getItem(k)); } catch (e) { return null; } }
  function save(k, v, s) { try { (s || localStorage).setItem(k, JSON.stringify(v)); } catch (e) {} }
  function token() { return load(STORE); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

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
    return call('POST', '/v1/events', { type: type, sku: data.sku || null, rec_id: rec, size: data.size || null, value: data.value == null ? null : data.value }).catch(function () {});
  }

  /* ---------------- Styles (scoped inside shadow roots) ---------------- */
  var STYLES = function () {
    return ':host{all:initial;font-family:"DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--a:' + config.accent + ';--ink:#121212;--paper:#fff7e8;--line:#121212;--soft:rgba(18,18,18,.12);--text:#121212;--muted:#6f695e}' +
      '*{box-sizing:border-box}button{font:inherit;cursor:pointer;border:0}' +
      '.trigger{display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 16px 0 10px;border-radius:12px;background:#fff;color:var(--ink);font-weight:800;font-size:14px;border:2.5px solid var(--ink);box-shadow:3px 3px 0 var(--ink);transition:transform .15s,box-shadow .15s}' +
      '.trigger:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--ink)}.trigger:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}' +
      '.tdot{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--a);color:var(--ink);font-size:14px;font-weight:900;border:2px solid var(--ink);transform:rotate(-6deg)}' +
      '.tsize{padding:2px 9px;border-radius:8px;background:var(--a);color:var(--ink);font-size:13px;font-weight:900;margin-left:2px;border:2px solid var(--ink)}' +
      '.tconf{color:var(--muted);font-weight:700;font-size:12px}' +
      '.overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(18,18,18,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;justify-content:flex-end;opacity:0;transition:opacity .3s}' +
      '.overlay.in{opacity:1}' +
      '.sheet{width:min(440px,100%);height:100%;background:var(--paper);color:var(--text);display:flex;flex-direction:column;transform:translateX(60px) rotate(1deg);opacity:.4;transition:transform .45s cubic-bezier(.34,1.56,.64,1),opacity .3s;border-left:3px solid var(--ink);box-shadow:-8px 0 0 var(--ink)}' +
      '.in .sheet{transform:none;opacity:1}' +
      '@media(max-width:560px){.overlay{align-items:flex-end}.sheet{height:92%;border-radius:24px 24px 0 0;transform:translateY(60px);border-left:0;border-top:3px solid var(--ink);box-shadow:0 -8px 0 var(--ink)}}' +
      '.head{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:2.5px solid var(--ink);background:#fff}' +
      '.mark{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--a);color:var(--ink);font-weight:900;border:2.5px solid var(--ink);box-shadow:2px 2px 0 var(--ink);transform:rotate(-6deg)}' +
      '.head b{flex:1;font-size:17px;font-weight:800}.head small{display:block;color:var(--muted);font-weight:600;font-size:12px}' +
      '.x{width:36px;height:36px;border-radius:10px;background:#fff;color:var(--ink);font-size:18px;border:2px solid var(--ink);font-weight:800}.x:hover{background:#ff5ca8;color:#fff}' +
      '.body{flex:1;overflow:auto;padding:22px 20px}' +
      '.steps{display:flex;gap:6px;margin-bottom:22px}.steps i{flex:1;height:8px;border-radius:6px;background:#fff;border:2px solid var(--ink);transition:background .3s}.steps i.on{background:var(--a)}' +
      'h3{font-size:26px;letter-spacing:-.03em;margin:0 0 6px;font-weight:800}p{color:#3c3832;font-size:14px;line-height:1.55;margin:0 0 18px}' +
      '.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}' +
      'label{display:grid;gap:6px;font-size:13px;font-weight:800;color:var(--ink)}' +
      '.inp{position:relative}.inp input{width:100%;height:52px;border-radius:12px;border:2.5px solid var(--ink);background:#fff;color:var(--ink);font:inherit;font-size:19px;font-weight:800;padding:0 44px 0 14px;outline:none;transition:box-shadow .15s,transform .15s}' +
      '.inp input:focus{box-shadow:3px 3px 0 #3d5afe;transform:translate(-1px,-1px)}.inp span{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;font-weight:700}' +
      '.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}.cards.two{grid-template-columns:1fr 1fr}.card{padding:14px 10px;border-radius:14px;background:#fff;color:var(--ink);border:2.5px solid var(--ink);display:grid;gap:8px;justify-items:center;font-weight:800;font-size:14px;transition:transform .15s,box-shadow .15s,background .15s}' +
      '.card svg{width:46px;height:46px}.card:hover{transform:translate(-2px,-2px);box-shadow:3px 3px 0 var(--ink)}.card.on{background:var(--a);box-shadow:3px 3px 0 var(--ink)}' +
      '.lbl{font-size:13px;font-weight:800;color:var(--ink);margin:0 0 10px}' +
      'details{margin:4px 0 18px;border-radius:14px;background:#fff;border:2px dashed var(--ink);padding:12px 14px}summary{cursor:pointer;font-size:14px;font-weight:800}details .row{margin:14px 0 0}' +
      '.foot{padding:16px 20px;border-top:2.5px solid var(--ink);display:flex;gap:10px;background:#fff}' +
      '.btn{flex:1;height:52px;border-radius:12px;background:var(--a);color:var(--ink);font-weight:900;font-size:16px;border:2.5px solid var(--ink);box-shadow:3px 3px 0 var(--ink);transition:transform .15s,box-shadow .15s}.btn:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--ink)}.btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--ink)}.btn:disabled{opacity:.5}' +
      '.btn.ghost{flex:none;padding:0 18px;background:#fff}' +
      '.err{color:#e5341f;font-size:13px;font-weight:700;min-height:18px;margin:4px 0 0}' +
      '.res{display:grid;justify-items:center;text-align:center;padding-top:6px}' +
      '.ringw{position:relative;width:176px;height:176px;margin:4px 0 16px;border-radius:50%;background:#fff;border:3px solid var(--ink);box-shadow:5px 5px 0 var(--ink)}.ringw svg{width:100%;height:100%;transform:rotate(-90deg)}' +
      '.ringw .fg{transition:stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)}' +
      '.ringl{position:absolute;inset:0;display:grid;place-content:center;line-height:1}.ringl b{font-size:58px;letter-spacing:-.04em;font-weight:900;animation:pop .6s cubic-bezier(.34,1.56,.64,1) both .2s}.ringl small{color:var(--muted);font-size:12px;font-weight:700;margin-top:6px}' +
      '@keyframes pop{from{transform:scale(.3) rotate(-20deg);opacity:0}}' +
      '.badge{display:inline-block;padding:6px 14px;border-radius:999px;background:#ffd43b;color:var(--ink);font-weight:900;font-size:13px;margin-bottom:12px;border:2px solid var(--ink);transform:rotate(-2deg)}' +
      '.alt{font-size:13px;color:var(--ink);margin:0 0 16px;padding:10px 14px;border-radius:12px;background:#dfe6ff;border:2px solid var(--ink)}' +
      '.notes{display:grid;gap:8px;width:100%;margin:6px 0 16px}.note{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:12px;background:#fff;border:2px solid var(--ink);font-size:14px;animation:slide .5s cubic-bezier(.34,1.56,.64,1) both}' +
      '.note b{text-transform:capitalize}.note em{font-style:normal;font-weight:900}.note small{color:var(--muted);font-weight:600;margin-left:4px}.ideal{background:#c9f7df}.roomy,.long{background:#dfe6ff}.snug,.short{background:#ffd6cc}' +
      '@keyframes slide{from{opacity:0;transform:translateY(10px) rotate(1deg)}}' +
      '.bar{position:relative;height:10px;border-radius:6px;background:#fff;border:2px solid var(--ink);width:90px;margin-left:12px}.bar i{position:absolute;top:-5px;width:16px;height:16px;border-radius:50%;background:var(--ink);transform:translateX(-50%)}.bar:after{content:"";position:absolute;left:50%;top:-5px;bottom:-5px;width:2px;background:var(--ink)}' +
      '.sizes{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:4px 0 6px}.sz{min-width:48px;height:42px;border-radius:10px;background:#fff;color:var(--ink);font-weight:900;border:2.5px solid var(--ink)}.sz.on{background:var(--a);box-shadow:3px 3px 0 var(--ink)}' +
      'table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}th,td{padding:8px 6px;text-align:center;border-bottom:1.5px solid var(--soft)}th{color:var(--ink);font-weight:800;text-transform:capitalize}tr.on td{background:var(--a);font-weight:900}' +
      '.small{font-size:12px;color:var(--muted);text-align:center;margin-top:14px;line-height:1.5}.link{background:none;color:#3d5afe;font-weight:800;font-size:12px;text-decoration:underline;padding:0}' +
      '.consent{font-size:11.5px;color:var(--muted);margin:10px 0 0;line-height:1.5}.consent a{color:#3d5afe;font-weight:700}' +
      '.load{display:grid;place-items:center;gap:16px;padding:60px 0}.spin{width:56px;height:56px;border-radius:14px;border:4px solid var(--ink);background:var(--a);animation:sp 0.9s cubic-bezier(.34,1.56,.64,1) infinite}@keyframes sp{to{transform:rotate(360deg)}}' +
      '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}';
  };

  var FIT_ICONS = {
    Slim: '<svg viewBox="0 0 48 48"><path d="M17 8h14l3 6-3 3v23H17V17l-3-3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
    Regular: '<svg viewBox="0 0 48 48"><path d="M14 8h20l6 7-5 4v21H13V19l-5-4z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
    Relaxed: '<svg viewBox="0 0 48 48"><path d="M11 8h26l9 9-6 5v18H8V22l-6-5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  };

  /* ---------------- Inline trigger on each placeholder ---------------- */
  function mount(el) {
    if (el.__forme) return;
    var sku = el.getAttribute('data-forme-sku');
    if (!sku) return;
    var root = el.attachShadow ? el.attachShadow({ mode: 'open' }) : el;
    el.__forme = { sku: sku, root: root };
    renderTrigger(el);
    var t = token();
    if (t) recommend(sku, t).then(function () { renderTrigger(el); }).catch(function () {});
  }
  function renderTrigger(el) {
    var st = el.__forme, r = lastRecs[st.sku];
    st.root.innerHTML = '<style>' + STYLES() + '</style><button class="trigger" part="button" aria-haspopup="dialog">' +
      '<span class="tdot">f</span>' + (r ? 'Your size <span class="tsize">' + esc(r.size) + '</span><span class="tconf">' + r.confidence + '%</span>' : esc(config.label)) + '</button>';
    st.root.querySelector('button').onclick = function () { open(st.sku, el); };
  }
  function refresh() {
    var els = document.querySelectorAll('[data-forme-sku]');
    for (var i = 0; i < els.length; i++) { if (els[i].__forme) renderTrigger(els[i]); else mount(els[i]); }
  }

  function scan() {
    var els = document.querySelectorAll('[data-forme-sku]');
    for (var i = 0; i < els.length; i++) if (!els[i].__forme) mount(els[i]);
  }

  function recommend(sku, t) {
    return call('POST', '/v1/recommend', { sku: sku, profile_token: t }).then(function (r) {
      lastRecs[sku] = { size: r.size, confidence: r.confidence, rec_id: r.rec_id };
      save(REC, lastRecs, sessionStorage);
      return r;
    });
  }

  /* ---------------- Panel ---------------- */
  var host, shadow, state;
  function open(sku, anchor) {
    if (!host) { host = document.createElement('div'); host.setAttribute('data-forme-panel', ''); document.body.appendChild(host); shadow = host.attachShadow({ mode: 'open' }); }
    state = { sku: sku, anchor: anchor || document.querySelector('[data-forme-sku="' + (window.CSS && window.CSS.escape ? window.CSS.escape(sku) : sku) + '"]'), step: 0, form: load('forme_profile_cache') || { height: '', weight: '', fit: 'Regular', build: 'Average', sex: '' }, prevFocus: document.activeElement };
    track('widget_open', { sku: sku });
    shadow.innerHTML = '<style>' + STYLES() + '</style><div class="overlay" role="dialog" aria-modal="true" aria-label="Find my size"><div class="sheet"><div class="head"><span class="mark">f</span><b>Find my size<small>Powered by Forme</small></b><button class="x" aria-label="Close">×</button></div><div class="body"></div><div class="foot"></div></div></div>';
    var ov = shadow.querySelector('.overlay');
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    shadow.querySelector('.x').onclick = close;
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(function () { ov.classList.add('in'); });
    var t = token();
    if (t) { loading(); recommend(sku, t).then(result).catch(function (e) { if (e.code === 'profile_required') { try { localStorage.removeItem(STORE); } catch (x) {} step1(); } else error(e); }); }
    else step1();
  }
  function close() {
    var ov = shadow && shadow.querySelector('.overlay');
    document.removeEventListener('keydown', onKey);
    document.documentElement.style.overflow = '';
    if (!ov) return;
    ov.classList.remove('in');
    setTimeout(function () { shadow.innerHTML = ''; if (state && state.prevFocus && state.prevFocus.focus) state.prevFocus.focus(); }, 350);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function $(s) { return shadow.querySelector(s); }
  function body(html, foot) { $('.body').onkeydown = null; $('.body').innerHTML = html; $('.foot').innerHTML = foot || ''; var f = $('.body input, .body button'); if (f) f.focus({ preventScroll: true }); }
  function steps(n) { return '<div class="steps"><i class="' + (n >= 0 ? 'on' : '') + '"></i><i class="' + (n >= 1 ? 'on' : '') + '"></i><i class="' + (n >= 2 ? 'on' : '') + '"></i></div>'; }
  function loading(msg) { body('<div class="load"><div class="spin"></div><p>' + esc(msg || 'Matching your profile to this size chart…') + '</p></div>'); }
  function error(e) { body('<h3>Something went wrong</h3><p>' + esc(e.message) + '</p>', '<button class="btn">Try again</button>'); $('.foot .btn').onclick = step1; }

  function num(name, label, unit, val, min, max) {
    return '<label>' + label + '<div class="inp"><input type="number" inputmode="decimal" name="' + name + '" min="' + min + '" max="' + max + '" value="' + esc(val || '') + '"><span>' + unit + '</span></div></label>';
  }
  function step1() {
    var f = state.form;
    body(steps(0) + '<h3>Let\'s start with you</h3><p>Two numbers and we can estimate the rest. Your profile is saved for next time.</p>' +
      '<div class="row">' + num('height', 'Height', 'cm', f.height, 120, 225) + num('weight', 'Weight', 'kg', f.weight, 30, 250) + '</div>' +
      '<details' + (f.chest || f.waist || f.hips ? ' open' : '') + '><summary>Add exact measurements (optional)</summary><div class="row">' + num('chest', 'Chest', 'cm', f.chest, 50, 200) + num('waist', 'Waist', 'cm', f.waist, 40, 200) + '</div><div class="row">' + num('hips', 'Hips', 'cm', f.hips, 50, 200) + num('inseam', 'Inseam', 'cm', f.inseam, 50, 110) + '</div></details>' +
      '<div class="lbl">I usually buy</div><div class="cards two" data-name="sex"><button class="card' + (f.sex === 'female' ? ' on' : '') + '" data-v="female" aria-pressed="' + (f.sex === 'female') + '">Women' + "'" + 's sizes</button><button class="card' + (f.sex === 'male' ? ' on' : '') + '" data-v="male" aria-pressed="' + (f.sex === 'male') + '">Men' + "'" + 's sizes</button></div>' +
      '<div class="err" aria-live="polite"></div><p class="consent">By continuing you agree that Forme saves these body measurements on this device and our servers to recommend sizes. No name, phone or photo. <a href="' + API + '/privacy" target="_blank" rel="noopener">Privacy</a></p>', '<button class="btn">Continue</button>');
    var sexCards = shadow.querySelector('.cards[data-name=sex]');
    sexCards.onclick = function (e) { var b = e.target.closest('.card'); if (!b) return; f.sex = b.getAttribute('data-v'); sexCards.querySelectorAll('.card').forEach(function (c) { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', String(c === b)); }); };
    $('.foot .btn').onclick = function () {
      var vals = {};
      var inputs = shadow.querySelectorAll('.body input');
      for (var i = 0; i < inputs.length; i++) vals[inputs[i].name] = inputs[i].value;
      var h = Number(vals.height);
      if (!(h >= 120 && h <= 225)) { $('.err').textContent = 'Enter your height in centimetres (120–225).'; return; }
      if (vals.weight && !(Number(vals.weight) >= 30 && Number(vals.weight) <= 250)) { $('.err').textContent = 'Weight should be in kilograms (30–250).'; return; }
      for (var k in vals) f[k] = vals[k];
      step2();
    };
    $('.body').onkeydown = function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') $('.foot .btn').click(); };
  }
  function step2() {
    var f = state.form;
    var cards = function (name, opts, icons) { return '<div class="cards" data-name="' + name + '">' + opts.map(function (o) { return '<button class="card' + (f[name] === o ? ' on' : '') + '" data-v="' + o + '" aria-pressed="' + (f[name] === o) + '">' + (icons ? icons[o] : '') + o + '</button>'; }).join('') + '</div>'; };
    body(steps(1) + '<h3>How do you like it to fit?</h3><p>We adjust the room in each size to match how you like to wear clothes.</p>' +
      '<div class="lbl">Preferred fit</div>' + cards('fit', ['Slim', 'Regular', 'Relaxed'], FIT_ICONS) +
      '<div class="lbl">Your build</div>' + cards('build', ['Slim', 'Average', 'Broad']) + '<div class="err" aria-live="polite"></div>',
      '<button class="btn ghost">Back</button><button class="btn">See my size</button>');
    shadow.querySelectorAll('.cards').forEach(function (group) {
      group.addEventListener('click', function (e) {
        var b = e.target.closest('.card'); if (!b) return;
        f[group.getAttribute('data-name')] = b.getAttribute('data-v');
        group.querySelectorAll('.card').forEach(function (c) { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', String(c === b)); });
      });
    });
    $('.foot .ghost').onclick = step1;
    $('.foot .btn:not(.ghost)').onclick = submit;
  }
  function submit() {
    var f = state.form, p = { height: Number(f.height), fit: f.fit, build: f.build };
    if (f.sex) p.sex = f.sex;
    ['weight', 'chest', 'waist', 'hips', 'inseam'].forEach(function (k) { if (f[k]) p[k] = Number(f[k]); });
    save('forme_profile_cache', f);
    loading();
    var t = token();
    var saveProfile = t ? call('PUT', '/v1/profiles/me', p, { 'X-Forme-Profile': t }).then(function () { return t; }).catch(function () { return null; }) : Promise.resolve(null);
    saveProfile.then(function (existing) {
      return existing || call('POST', '/v1/profiles', p).then(function (r) { save(STORE, r.profile_token); return r.profile_token; });
    }).then(function (tok) { return recommend(state.sku, tok); }).then(result).catch(error);
  }
  function ringSvg(v) {
    var r = 74, c = 2 * Math.PI * r;
    return '<svg viewBox="0 0 170 170"><circle cx="85" cy="85" r="' + r + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="12"/><circle class="fg" cx="85" cy="85" r="' + r + '" fill="none" stroke="' + config.accent + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" data-to="' + (c * (1 - v / 100)) + '"/></svg>';
  }
  function result(r) {
    state.result = r; state.selected = r.size;
    var notes = r.fit_notes.map(function (n, i) {
      var pos = Math.max(4, Math.min(96, 50 + n.delta_cm * 5));
      return '<div class="note ' + n.fit + '" style="animation-delay:' + (0.15 + i * 0.08) + 's"><b>' + esc(n.area) + (n.estimated ? '<small>est.</small>' : '') + '</b><span style="display:flex;align-items:center;gap:6px"><em>' + n.fit + '</em><span class="bar" style="color:' + (n.fit === 'ideal' ? '#7ef0c1' : n.fit === 'snug' || n.fit === 'short' ? '#ff8a6b' : '#74c7ff') + '"><i style="left:' + pos + '%"></i></span></span></div>';
    }).join('');
    body(steps(2) + '<div class="res"><span class="badge">' + esc(r.label) + '</span><div class="ringw">' + ringSvg(r.confidence) + '<div class="ringl"><b>' + esc(r.size) + '</b><small>' + r.confidence + '% confidence</small></div></div>' +
      (r.alternative ? '<div class="alt">' + esc(r.alternative.reason) + ' Alternative: <b>' + esc(r.alternative.size) + '</b></div>' : '') +
      '<div class="notes">' + notes + '</div><div class="sizes" role="radiogroup" aria-label="Choose size"></div><div class="chart"></div>' +
      '<div class="small">' + (r.estimated && r.estimated.length ? 'Some measurements were estimated from your height and weight. ' : '') + 'Forme stores body measurements only, never your name or photos. <a class="link" href="' + API + '/privacy" target="_blank" rel="noopener">Privacy</a> · <button class="link" data-act="edit">Edit profile</button> · <button class="link" data-act="forget">Forget me</button></div></div>',
      '<button class="btn">Select size ' + esc(r.size) + '</button>');
    requestAnimationFrame(function () { requestAnimationFrame(function () { var fg = $('.fg'); if (fg) fg.style.strokeDashoffset = fg.getAttribute('data-to'); }); });
    call('GET', '/v1/products/' + encodeURIComponent(state.sku)).then(function (d) { products[state.sku] = d.product; drawSizes(); }).catch(function () {});
    $('.foot .btn').onclick = choose;
    $('[data-act=edit]').onclick = step1;
    $('[data-act=forget]').onclick = function () {
      var t = token();
      (t ? call('DELETE', '/v1/profiles/me', null, { 'X-Forme-Profile': t }) : Promise.resolve()).catch(function () {}).then(function () {
        try { localStorage.removeItem(STORE); localStorage.removeItem('forme_profile_cache'); sessionStorage.removeItem(REC); } catch (e) {}
        lastRecs = {}; state.form = { height: '', weight: '', fit: 'Regular', build: 'Average' }; refresh(); step1();
      });
    };
    if (state.anchor && state.anchor.__forme) renderTrigger(state.anchor);
  }
  function drawSizes() {
    var p = products[state.sku]; if (!p || !$('.sizes')) return;
    $('.sizes').innerHTML = p.chart.map(function (row) { return '<button class="sz' + (row.size === state.selected ? ' on' : '') + '" role="radio" aria-checked="' + (row.size === state.selected) + '" data-s="' + esc(row.size) + '">' + esc(row.size) + '</button>'; }).join('');
    var dims = ['chest', 'waist', 'hips', 'shoulders', 'length', 'inseam'].filter(function (d) { return p.chart.some(function (r) { return r[d] != null; }); });
    $('.chart').innerHTML = '<details><summary>Size chart (cm)</summary><table><tr><th>Size</th>' + dims.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr>' +
      p.chart.map(function (r) { return '<tr class="' + (r.size === state.result.size ? 'on' : '') + '"><td>' + esc(r.size) + '</td>' + dims.map(function (d) { return '<td>' + (r[d] == null ? '–' : r[d]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></details>';
    $('.sizes').onclick = function (e) {
      var b = e.target.closest('.sz'); if (!b) return;
      state.selected = b.getAttribute('data-s');
      shadow.querySelectorAll('.sz').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      $('.foot .btn').textContent = 'Select size ' + state.selected + (state.selected === state.result.size ? '' : ' (we suggest ' + state.result.size + ')');
    };
  }
  function choose() {
    var r = state.result, detail = { sku: state.sku, size: state.selected, recommended: r.size, rec_id: r.rec_id, confidence: r.confidence };
    track('size_selected', { sku: state.sku, size: state.selected, rec_id: r.rec_id });
    var target = state.anchor || document;
    target.dispatchEvent(new CustomEvent('forme:size-selected', { detail: detail, bubbles: true, composed: true }));
    close();
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    call('GET', '/v1/widget-config').then(function (c) { for (var k in c.widget) config[k] = c.widget[k]; refresh(); }).catch(function (e) { console.warn('[Forme] ' + e.message); });
    refresh();
    if ('MutationObserver' in window) new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }
  window.Forme = {
    version: '1.0.0',
    open: function (sku) { open(sku); },
    track: track,
    refresh: refresh,
    lastRecommendation: function (sku) { return lastRecs[sku] || null; },
    clearProfile: function () { try { localStorage.removeItem(STORE); localStorage.removeItem('forme_profile_cache'); sessionStorage.removeItem(REC); } catch (e) {} lastRecs = {}; refresh(); },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
