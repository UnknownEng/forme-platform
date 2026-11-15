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
    return ':host{all:initial;font-family:"Manrope",system-ui,-apple-system,"Segoe UI",sans-serif;--a:' + config.accent + ';--ink:#0b0f14;--bg:#0d1218;--panel:#141b23;--line:rgba(255,255,255,.1);--text:#eef3ea;--muted:#8a948b}' +
      '*{box-sizing:border-box}button{font:inherit;cursor:pointer;border:0}' +
      '.trigger{display:inline-flex;align-items:center;gap:10px;height:42px;padding:0 16px 0 12px;border-radius:999px;background:#0d1218;color:#eef3ea;font-weight:700;font-size:14px;box-shadow:0 8px 24px -10px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.12);transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s}' +
      '.trigger:hover{transform:translateY(-2px);box-shadow:0 14px 30px -12px rgba(0,0,0,.55),inset 0 0 0 1px var(--a)}' +
      '.tdot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--a);color:var(--ink);font-size:12px;font-weight:900}' +
      '.tsize{padding:3px 9px;border-radius:999px;background:var(--a);color:var(--ink);font-size:12px;font-weight:800;margin-left:2px}' +
      '.tconf{color:#8a948b;font-weight:600;font-size:12px}' +
      '.overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(5,8,11,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;justify-content:flex-end;opacity:0;transition:opacity .35s}' +
      '.overlay.in{opacity:1}' +
      '.sheet{width:min(440px,100%);height:100%;background:linear-gradient(180deg,#121921,#0b1015);color:var(--text);display:flex;flex-direction:column;transform:translateX(40px);opacity:.4;transition:transform .5s cubic-bezier(.22,1,.36,1),opacity .4s;box-shadow:-30px 0 80px -20px rgba(0,0,0,.7);border-left:1px solid var(--line)}' +
      '.in .sheet{transform:none;opacity:1}' +
      '@media(max-width:560px){.overlay{align-items:flex-end}.sheet{height:92%;border-radius:24px 24px 0 0;transform:translateY(60px);border-left:0}}' +
      '.head{display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line)}' +
      '.mark{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--a);color:var(--ink);font-weight:900}' +
      '.head b{flex:1;font-size:16px}.head small{display:block;color:var(--muted);font-weight:500;font-size:12px}' +
      '.x{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.06);color:var(--text);font-size:18px}' +
      '.body{flex:1;overflow:auto;padding:22px 20px}' +
      '.steps{display:flex;gap:6px;margin-bottom:22px}.steps i{flex:1;height:4px;border-radius:4px;background:rgba(255,255,255,.1);transition:background .4s}.steps i.on{background:var(--a)}' +
      'h3{font-size:24px;letter-spacing:-.03em;margin:0 0 6px}p{color:#b8c1b6;font-size:14px;line-height:1.55;margin:0 0 18px}' +
      '.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}' +
      'label{display:grid;gap:6px;font-size:13px;font-weight:600;color:#c3cbc1}' +
      '.inp{position:relative}.inp input{width:100%;height:50px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);font:inherit;font-size:18px;font-weight:700;padding:0 44px 0 14px;outline:none;transition:border-color .2s,box-shadow .2s}' +
      '.inp input:focus{border-color:var(--a);box-shadow:0 0 0 4px color-mix(in srgb,var(--a) 20%,transparent)}.inp span{position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px}' +
      '.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}.card{padding:14px 10px;border-radius:16px;background:rgba(255,255,255,.04);color:var(--text);box-shadow:inset 0 0 0 1px var(--line);display:grid;gap:8px;justify-items:center;font-weight:700;font-size:14px;transition:transform .25s,box-shadow .25s,background .25s}' +
      '.card svg{width:46px;height:46px}.card:hover{transform:translateY(-2px)}.card.on{background:color-mix(in srgb,var(--a) 14%,transparent);box-shadow:inset 0 0 0 2px var(--a)}' +
      '.lbl{font-size:13px;font-weight:700;color:#c3cbc1;margin:0 0 10px}' +
      'details{margin:4px 0 18px;border-radius:14px;background:rgba(255,255,255,.03);box-shadow:inset 0 0 0 1px var(--line);padding:12px 14px}summary{cursor:pointer;font-size:14px;font-weight:700}details .row{margin:14px 0 0}' +
      '.foot{padding:16px 20px;border-top:1px solid var(--line);display:flex;gap:10px}' +
      '.btn{flex:1;height:50px;border-radius:14px;background:var(--a);color:var(--ink);font-weight:800;font-size:15px;transition:transform .2s,filter .2s}.btn:hover{filter:brightness(1.05);transform:translateY(-1px)}.btn:disabled{opacity:.5}' +
      '.btn.ghost{flex:none;padding:0 18px;background:rgba(255,255,255,.06);color:var(--text)}' +
      '.err{color:#ff8a6b;font-size:13px;min-height:18px;margin:4px 0 0}' +
      '.res{display:grid;justify-items:center;text-align:center;padding-top:6px}' +
      '.ringw{position:relative;width:170px;height:170px;margin:4px 0 16px}.ringw svg{width:100%;height:100%;transform:rotate(-90deg)}' +
      '.ringw .fg{transition:stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)}' +
      '.ringl{position:absolute;inset:0;display:grid;place-content:center;line-height:1}.ringl b{font-size:56px;letter-spacing:-.04em;animation:pop .6s cubic-bezier(.22,1,.36,1) both .2s}.ringl small{color:var(--muted);font-size:12px;margin-top:6px}' +
      '@keyframes pop{from{transform:scale(.4);opacity:0}}' +
      '.badge{display:inline-block;padding:5px 12px;border-radius:999px;background:color-mix(in srgb,var(--a) 15%,transparent);color:var(--a);font-weight:800;font-size:13px;margin-bottom:10px}' +
      '.alt{font-size:13px;color:#b8c1b6;margin:0 0 16px;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)}' +
      '.notes{display:grid;gap:8px;width:100%;margin:6px 0 16px}.note{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-radius:12px;background:rgba(255,255,255,.04);font-size:14px;animation:slide .5s cubic-bezier(.22,1,.36,1) both}' +
      '.note b{text-transform:capitalize}.note em{font-style:normal;font-weight:800}.ideal em{color:#7ef0c1}.roomy em,.long em{color:#74c7ff}.snug em,.short em{color:#ff8a6b}' +
      '@keyframes slide{from{opacity:0;transform:translateY(8px)}}' +
      '.bar{position:relative;height:6px;border-radius:6px;background:rgba(255,255,255,.08);width:90px;margin-left:12px}.bar i{position:absolute;top:-3px;width:12px;height:12px;border-radius:50%;background:currentColor;transform:translateX(-50%)}.bar:after{content:"";position:absolute;left:50%;top:-4px;bottom:-4px;width:2px;background:rgba(255,255,255,.3)}' +
      '.sizes{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:4px 0 6px}.sz{min-width:46px;height:40px;border-radius:12px;background:rgba(255,255,255,.05);color:var(--text);font-weight:800;box-shadow:inset 0 0 0 1px var(--line)}.sz.on{background:var(--a);color:var(--ink)}' +
      'table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}th,td{padding:8px 6px;text-align:center;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:600;text-transform:capitalize}tr.on td{color:var(--a);font-weight:800}' +
      '.small{font-size:12px;color:var(--muted);text-align:center;margin-top:14px;line-height:1.5}.link{background:none;color:var(--a);font-weight:700;font-size:13px;text-decoration:underline;padding:0}' +
      '.load{display:grid;place-items:center;gap:16px;padding:60px 0}.spin{width:56px;height:56px;border-radius:50%;border:4px solid rgba(255,255,255,.1);border-top-color:var(--a);animation:sp 0.8s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}' +
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
    state = { sku: sku, anchor: anchor || document.querySelector('[data-forme-sku="' + (window.CSS && window.CSS.escape ? window.CSS.escape(sku) : sku) + '"]'), step: 0, form: load('forme_profile_cache') || { height: '', weight: '', fit: 'Regular', build: 'Average' }, prevFocus: document.activeElement };
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
      '<div class="err" aria-live="polite"></div>', '<button class="btn">Continue</button>');
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
      return '<div class="note ' + n.fit + '" style="animation-delay:' + (0.15 + i * 0.08) + 's"><b>' + esc(n.area) + '</b><span style="display:flex;align-items:center;gap:6px"><em>' + n.fit + '</em><span class="bar" style="color:' + (n.fit === 'ideal' ? '#7ef0c1' : n.fit === 'snug' || n.fit === 'short' ? '#ff8a6b' : '#74c7ff') + '"><i style="left:' + pos + '%"></i></span></span></div>';
    }).join('');
    body(steps(2) + '<div class="res"><span class="badge">' + esc(r.label) + '</span><div class="ringw">' + ringSvg(r.confidence) + '<div class="ringl"><b>' + esc(r.size) + '</b><small>' + r.confidence + '% confidence</small></div></div>' +
      (r.alternative ? '<div class="alt">' + esc(r.alternative.reason) + ' Alternative: <b>' + esc(r.alternative.size) + '</b></div>' : '') +
      '<div class="notes">' + notes + '</div><div class="sizes" role="radiogroup" aria-label="Choose size"></div><div class="chart"></div>' +
      '<div class="small">' + (r.estimated && r.estimated.length ? 'Some measurements were estimated from your height and weight. ' : '') + 'Forme stores body measurements only, never your name or photos. <button class="link" data-act="edit">Edit profile</button> · <button class="link" data-act="forget">Forget me</button></div></div>',
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
