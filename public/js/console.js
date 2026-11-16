import { $, $$, esc, money, moneyShort, compact, pct, api, toast, countUp, copyText, ring, animateRings, reduceMotion } from './ui.js';
import { artBox, SWATCHES } from './art.js';
import { areaChart, spark } from './charts.js';

const root = $('#root');
const layer = $('#layer');
const S = { merchant: null, view: 'overview', days: 30, products: [], categories: [], fits: [], poll: null, lastEvent: 0 };

const VIEWS = [
  ['overview', '◈', 'Overview'],
  ['catalog', '▦', 'Catalog'],
  ['insights', '◎', 'Fit insights'],
  ['integration', '⌘', 'Integration'],
  ['settings', '⚙', 'Settings'],
];
const DIMS_FOR = { tops: ['chest', 'waist', 'shoulders', 'length'], bottoms: ['waist', 'hips', 'inseam'], dresses: ['chest', 'waist', 'hips', 'length'] };
const GROUP_OF = c => (['Jeans', 'Trousers', 'Shorts'].includes(c) ? 'bottoms' : c === 'Dresses' ? 'dresses' : 'tops');
const EV = { recommendation: ['✦', 'Size recommended'], widget_open: ['◌', 'Widget opened'], add_to_cart: ['＋', 'Added to cart'], purchase: ['Rs ', 'Purchase'], size_selected: ['✓', 'Size selected'] };
const ago = t => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };

/* =================== Boot & routing =================== */
async function boot() {
  S.signupsOpen = await api('/api/auth/config').then(c => c.signups_open).catch(() => true);
  try { S.merchant = (await api('/api/auth/me')).merchant; shell(); }
  catch { authScreen(location.hash === '#signup' ? 'signup' : 'login'); }
}
addEventListener('hashchange', () => {
  if (!S.merchant) return authScreen(location.hash === '#signup' ? 'signup' : 'login');
  const v = location.hash.slice(1);
  if (VIEWS.some(x => x[0] === v) && v !== S.view) { S.view = v; navPaint(); render(); }
});

/* =================== Auth =================== */
function authScreen(mode) {
  stopPoll();
  root.innerHTML = `<div class="auth">
    <section class="auth-art">
      <a href="/" class="logo"><span class="logo-mark"><span>f</span></span>forme</a>
      <div class="auth-float">${artBox('Shirts', 3)}${artBox('Jeans', 7)}${artBox('Dresses', 4)}<span class="chip-f">M · 94% match</span></div>
      <div><h1>Your catalog's <span class="serif" style="color:var(--accent-ink)">fit brain.</span></h1><p>Manage size charts, ship the widget, and prove return savings with live analytics.</p></div>
      <div class="auth-stats"><div><b>REST + widget</b><span>Two ways to integrate</span></div><div><b>Self-learning</b><span>From keep / return feedback</span></div></div>
    </section>
    <section class="auth-form"><div class="auth-card glass">
      <div class="seg" id="auth-tabs"><button data-m="login" class="${mode === 'login' ? 'on' : ''}">Sign in</button><button data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Create account</button></div>
      <h2>${mode === 'login' ? 'Welcome back' : 'Start your workspace'}</h2>
      <p class="muted" style="margin:0;font-size:14px">${mode === 'login' ? 'Sign in to your Forme console.' : 'Free while you pilot. Any email works.'}</p>
      ${mode === 'signup' && S.signupsOpen === false ? '<div class="notice" style="margin-top:18px"><b>Pilot phase.</b>&nbsp;New accounts open soon. Meanwhile, explore the full demo workspace below.</div><div class="demo-login"><span>Open the <b>demo workspace</b> with 60 days of sample data.</span><button class="btn small" id="demo-btn" type="button">Open demo</button></div>' : ''}
      <form id="auth-form" novalidate ${mode === 'signup' && S.signupsOpen === false ? 'hidden' : ''}>
        ${mode === 'signup' ? '<div class="field"><label for="a-name">Company name</label><input class="input" id="a-name" name="name" autocomplete="organization" required></div>' : ''}
        <div class="field"><label for="a-email">Work email</label><input class="input" id="a-email" name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="a-pass">Password</label><input class="input" id="a-pass" name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="10" required>${mode === 'signup' ? '<span class="helper">At least 10 characters.</span>' : ''}</div>
        <div class="err-msg" id="auth-err" role="alert"></div>
        <button class="btn" type="submit">${mode === 'login' ? 'Sign in' : 'Create workspace'} <span class="arrow">→</span></button>
      </form>
      ${mode === 'login' ? '<div class="demo-login"><span>Exploring? Open the <b>demo workspace</b> with 60 days of sample data.</span><button class="btn small" id="demo-btn" type="button">Open demo</button></div>' : ''}
    </div></section></div>`;
  $('#auth-tabs').onclick = e => { const b = e.target.closest('button'); if (b) { history.replaceState(null, '', b.dataset.m === 'signup' ? '#signup' : '#'); authScreen(b.dataset.m); } };
  $('#auth-form').onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const btn = $('button[type=submit]', e.target); btn.disabled = true;
    try {
      S.merchant = (await api(mode === 'login' ? '/api/auth/login' : '/api/auth/signup', { method: 'POST', body })).merchant;
      history.replaceState(null, '', '#overview'); S.view = 'overview'; shell();
      toast(mode === 'login' ? `Signed in to ${S.merchant.name}` : 'Workspace created. Add your first product to begin.');
    } catch (err) { $('#auth-err').textContent = err.message; btn.disabled = false; }
  };
  const demo = $('#demo-btn');
  if (demo) demo.onclick = async () => {
    demo.disabled = true;
    try { const d = await fetch('/demo-config.json'); if (!d.ok) throw new Error('Demo workspace is not installed.'); } catch (e) { $('#auth-err').textContent = e.message; demo.disabled = false; return; }
    // Demo credentials are public sample values, created by the seed script.
    try {
      S.merchant = (await api('/api/auth/login', { method: 'POST', body: { email: 'demo@forme.dev', password: 'forme-demo-2026' } })).merchant;
      history.replaceState(null, '', '#overview'); S.view = 'overview'; shell();
      toast(`Signed in to ${S.merchant.name}`);
    } catch (err) { $('#auth-err').textContent = err.message; demo.disabled = false; }
  };
}

/* =================== Shell =================== */
function shell() {
  const v = location.hash.slice(1);
  if (VIEWS.some(x => x[0] === v)) S.view = v;
  const m = S.merchant;
  const nav = cls => VIEWS.map(([k, i, l]) => `<a class="nav-item ${cls}" data-v="${k}" href="#${k}"><i>${i}</i>${l}</a>`).join('');
  root.innerHTML = `<div class="shell">
    <aside class="side">
      <a href="/" class="logo"><span class="logo-mark"><span>f</span></span>forme</a>
      <div class="side-label">WORKSPACE</div>
      ${nav('')}
      <div class="side-spacer"></div>
      <div class="side-card" id="side-card">${m.email === 'demo@forme.dev' ? '<b>See it live</b>Open the demo store, pick a size, and watch events arrive here. <a href="/demo" target="_blank" rel="noopener">Open store ↗</a>' : '<b>Get started</b><a href="#catalog">1. Add a product</a><br><a href="#integration">2. Install on your store</a><br>3. See your first shopper here'}</div>
      <div class="me"><div class="avatar">${esc(m.name[0] || 'F').toUpperCase()}</div><div><b>${esc(m.name)}</b><small>${esc(m.email)} · ${esc(m.plan)}</small></div><button class="icon-btn" id="logout" title="Sign out" aria-label="Sign out">⏻</button></div>
    </aside>
    <div class="main">
      <header class="top"><h1 id="title"></h1><button class="icon-btn m-only" id="logout-m" title="Sign out" aria-label="Sign out">⏻</button><span class="live"><i></i>Live</span><div class="seg" id="period"><button data-d="7">7d</button><button data-d="30">30d</button><button data-d="90">90d</button></div></header>
      <div id="view"></div>
    </div>
    <nav class="mobile-nav">${nav('')}</nav>
  </div>`;
  $('#logout-m').onclick = () => $('#logout').click();
  $('#logout').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); S.merchant = null; history.replaceState(null, '', '#'); authScreen('login'); };
  $('#period').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.days = Number(b.dataset.d); navPaint(); render(); };
  navPaint();
  render();
}
function navPaint() {
  $$('.nav-item').forEach(a => a.classList.toggle('on', a.dataset.v === S.view));
  $$('#period button').forEach(b => b.classList.toggle('on', Number(b.dataset.d) === S.days));
  const p = $('#period'); if (p) p.style.visibility = S.view === 'overview' ? 'visible' : 'hidden';
  const t = $('#title'); if (t) t.textContent = VIEWS.find(x => x[0] === S.view)[2];
}
let renderSeq = 0;
const stale = my => my !== renderSeq;
function render() {
  stopPoll();
  const my = ++renderSeq;
  const view = $('#view');
  view.className = 'view'; void view.offsetWidth; view.className = 'view';
  Promise.resolve(({ overview, catalog, insights, integration, settings })[S.view](my)).catch(e => {
    if (stale(my)) return;
    if (e.status === 401) { S.merchant = null; toast('Your session ended. Please sign in again.', 'err'); return authScreen('login'); }
    view.innerHTML = `<div class="empty"><b>Could not load this page</b>${esc(e.message)}</div>`;
  });
}
function stopPoll() { clearInterval(S.poll); S.poll = null; }

const chg = c => (c == null ? '<span class="chg flat">new</span>' : `<span class="chg ${c > 0.5 ? 'up' : c < -0.5 ? 'down' : 'flat'}">${c > 0 ? '▲' : c < 0 ? '▼' : '•'} ${Math.abs(c).toFixed(1)}%</span>`);

/* =================== Overview =================== */
async function overview(my) {
  const view = $('#view');
  view.innerHTML = `<div class="grid kpis">${'<div class="skeleton"></div>'.repeat(6)}</div>`;
  const a = await api(`/api/analytics?days=${S.days}`);
  if (stale(my)) return;
  const k = a.kpis, r = a.returns, cur = S.merchant.currency;
  const seriesOf = key => a.series.map(d => d[key]);
  const isDemo = S.merchant.email === 'demo@forme.dev';
  const kpis = [
    ['Widget opens', k.widget_opens.value, chg(k.widget_opens.change), 'compact', seriesOf('opens'), '#9aa3ff'],
    ['Recommendations', k.recommendations.value, chg(k.recommendations.change), 'compact', seriesOf('recs'), '#2f43ff'],
    ['Add-to-cart rate', k.add_to_cart_rate.value * 100, chg(k.add_to_cart_rate.change), 'pct', seriesOf('carts'), '#12b76a'],
    ['Influenced revenue', k.influenced_revenue.value, chg(k.influenced_revenue.change), 'money', [], '#12b76a'],
    ['Avg. confidence', k.avg_confidence.value, '<span class="chg flat">engine score</span>', 'pct', [], '#2f43ff'],
    ['Unique shoppers', k.shoppers.value, '<span class="chg flat">with a profile</span>', 'compact', [], '#ff7a2f'],
  ];
  const maxRate = Math.max(r.followed_rate || 0, r.ignored_rate || 0, 0.01);
  view.innerHTML = `
    ${isDemo ? '<div class="notice"><b>Demo workspace.</b> 60 days of synthetic traffic plus anything you do in the demo store right now.</div>' : ''}
    <div class="grid kpis">${kpis.map(([l, v, c, f, sp, col], i) => `<div class="kpi glass" style="--i:${i}"><span>${l}</span><b data-v="${v}" data-f="${f}">0</b>${c}${spark(sp, col)}</div>`).join('')}</div>
    <div class="grid row-2" style="margin-top:16px">
      <section class="card glass"><div class="card-head"><div><h2>Shopper funnel</h2><p>Daily widget opens, size recommendations and add-to-carts after a recommendation</p></div>
        <div class="legend"><span><i style="background:#9aa3ff"></i>Opens</span><span><i style="background:#2f43ff"></i>Recommendations</span><span><i style="background:#12b76a"></i>Add to cart</span></div></div>
        <div class="chart" id="funnel"></div></section>
      <section class="card glass impact" style="--d:.1s"><div class="card-head"><div><h2>Return impact</h2><p>Size returns when shoppers followed Forme vs. picked another size</p></div></div>
        <div><div class="impact-big" id="savings">0</div><div class="helper">Estimated saved in ${S.days} days · ${r.returns_avoided} size returns avoided × ${money(r.return_cost, cur)} per return</div></div>
        <div class="bars">
          <div class="bar-row"><div><span>Followed recommendation</span><b>${r.followed_rate == null ? '–' : pct(r.followed_rate)}</b></div><div class="track"><i style="background:var(--mint)" data-w="${((r.followed_rate || 0) / maxRate) * 100}"></i></div><span class="helper">${r.followed_samples} orders with feedback</span></div>
          <div class="bar-row"><div><span>Chose a different size</span><b>${r.ignored_rate == null ? '–' : pct(r.ignored_rate)}</b></div><div class="track"><i style="background:var(--coral)" data-w="${((r.ignored_rate || 0) / maxRate) * 100}"></i></div><span class="helper">${r.ignored_samples} orders with feedback</span></div>
        </div>
        ${r.followed_samples + r.ignored_samples < 20 ? '<p class="helper">Send keep/return outcomes to <code>POST /v1/feedback</code> to measure this for your store.</p>' : ''}
      </section>
    </div>
    <div class="grid row-3" style="margin-top:16px">
      <section class="card glass" style="--d:.15s"><div class="card-head"><div><h2>Size mix</h2><p>Recommended sizes this period</p></div></div><div class="mix" id="mix"></div></section>
      <section class="card glass" style="--d:.2s"><div class="card-head"><div><h2>Top products</h2><p>By recommendations</p></div><a class="btn ghost small" href="#catalog">Catalog</a></div>
        <div class="table-wrap"><table><tbody>${a.top_products.map((p, i) => `<tr style="--i:${i}"><td><b>${esc(p.name || p.sku)}</b><br/><small class="muted mono">${esc(p.sku)}</small></td><td style="text-align:right;font-family:var(--mono)">${compact(p.recs)}</td><td><span class="conf" style="--w:${p.confidence}%"><i></i>${p.confidence}%</span></td></tr>`).join('') || '<tr><td class="empty">No recommendations yet</td></tr>'}</tbody></table></div></section>
      <section class="card glass" style="--d:.25s"><div class="card-head"><div><h2>Live activity</h2><p>Updates every few seconds</p></div><span class="live"><i></i></span></div><div class="feed" id="feed"></div></section>
    </div>`;
  $$('.kpi b').forEach(b => { const f = b.dataset.f; countUp(b, Number(b.dataset.v), { format: f === 'money' ? v => moneyShort(v, cur) : f === 'pct' ? v => `${v.toFixed(1)}%` : v => compact(v) }); });
  countUp($('#savings'), r.estimated_savings, { format: v => money(v, cur), duration: 1800 });
  areaChart($('#funnel'), a.series, [{ key: 'opens', color: '#9aa3ff', label: 'Opens' }, { key: 'recs', color: '#2f43ff', label: 'Recommendations' }, { key: 'carts', color: '#12b76a', label: 'Add to cart' }]);
  const mixMax = Math.max(1, ...a.size_mix.map(s => s.n));
  $('#mix').innerHTML = a.size_mix.length ? [...a.size_mix].sort((x, y) => sizeOrder(x.size) - sizeOrder(y.size)).map((s, i) => `<div style="--i:${i}"><i data-h="${(s.n / mixMax) * 100}" title="${s.n}"></i><span>${esc(s.size)}</span></div>`).join('') : '<p class="empty">No data yet</p>';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.track i').forEach(t => { t.style.width = `${t.dataset.w}%`; });
    $$('#mix i').forEach(t => { t.style.height = `${t.dataset.h}%`; });
  }));
  S.lastEvent = 0;
  await feed(true);
  if (stale(my)) return;
  stopPoll();
  S.poll = setInterval(() => feed(false), 4000);
}
const ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const sizeOrder = s => (ORDER.includes(s) ? ORDER.indexOf(s) : 100 + Number(s) || 999);
async function feed(first) {
  const el = $('#feed'); if (!el) return stopPoll();
  let d; try { d = await api('/api/activity'); } catch { return; }
  const fresh = d.events.filter(e => e.id > S.lastEvent);
  if (!first && !fresh.length) return;
  const prev = S.lastEvent;
  S.lastEvent = Math.max(S.lastEvent, ...d.events.map(e => e.id));
  el.innerHTML = d.events.map(e => {
    const [ico, label] = EV[e.type] || ['•', e.type];
    return `<div class="feed-item ${!first && e.id > prev ? 'new' : ''}"><span class="feed-ico ev-${esc(e.type)}">${ico}</span><div><b>${label}${e.size ? ` · ${esc(e.size)}` : ''}</b><br/><small>${esc(e.name || e.sku || '')}${e.value ? ` · ${money(e.value)}` : ''}</small></div><small>${ago(e.created_at)}</small></div>`;
  }).join('') || '<p class="empty">Waiting for the first event…</p>';
  if (!first && fresh.length) toast(`${fresh.length} new event${fresh.length > 1 ? 's' : ''} from your storefront`);
}

/* =================== Catalog =================== */
async function catalog() {
  const view = $('#view');
  view.innerHTML = `<div class="toolbar"><label class="search"><input class="input" id="q" placeholder="Search name, brand or SKU" aria-label="Search products"></label>
    <select class="select" id="cat" aria-label="Filter by category"><option value="">All categories</option></select><span class="grow"></span>
    <button class="btn ghost small" id="import">Import JSON</button><button class="btn ghost small" id="export">Export</button><button class="btn small" id="add">+ Add product</button></div>
    <section class="card glass"><div class="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Fit</th><th>Sizes</th><th>Price</th><th>Updated</th><th></th></tr></thead><tbody id="rows"><tr><td colspan="7"><div class="skeleton" style="height:60px"></div></td></tr></tbody></table></div></section>`;
  const load = async () => {
    const d = await api(`/api/products?q=${encodeURIComponent($('#q').value)}&category=${encodeURIComponent($('#cat').value)}`);
    S.products = d.products; S.categories = d.categories; S.fits = d.fits;
    if ($('#cat').options.length === 1) $('#cat').innerHTML += d.categories.map(c => `<option>${esc(c)}</option>`).join('');
    $('#rows').innerHTML = d.products.map((p, i) => `<tr style="--i:${i}"><td><div class="prod-cell">${artBox(p.category, p.color)}<div><b>${esc(p.name)}</b><small>${esc(p.sku)} · ${esc(p.brand)}</small></div></div></td>
      <td>${esc(p.category)}</td><td><span class="pill">${esc(p.fit)}</span></td><td class="mono" style="font-size:13px">${esc(p.chart[0].size)}–${esc(p.chart[p.chart.length - 1].size)} <span class="muted">(${p.chart.length})</span></td>
      <td>${money(p.price, S.merchant.currency)}</td><td class="muted" style="font-size:13px">${ago(p.updated_at)}</td>
      <td><div class="actions"><button class="btn ghost small" data-edit="${esc(p.sku)}">Edit</button><button class="icon-btn" data-del="${esc(p.sku)}" aria-label="Delete ${esc(p.name)}" title="Delete">✕</button></div></td></tr>`).join('')
      || `<tr><td colspan="7"><div class="empty"><b>${$('#q').value || $('#cat').value ? 'No matching products' : 'No products yet'}</b>Add a product with its size chart, import JSON, or sync from your server with <code>PUT /v1/products/{sku}</code>.</div></td></tr>`;
  };
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(load, 200); };
  $('#cat').onchange = load;
  $('#add').onclick = () => editor(null, load);
  $('#export').onclick = async () => {
    const d = await api('/api/products');
    const blob = new Blob([JSON.stringify({ products: d.products.map(({ id, created_at, updated_at, ...p }) => p) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'forme-catalog.json'; a.click(); URL.revokeObjectURL(a.href);
    toast(`Exported ${d.products.length} products`);
  };
  $('#import').onclick = () => importModal(load);
  $('#rows').onclick = async e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) editor(S.products.find(p => p.sku === ed.dataset.edit), load);
    if (del) {
      const p = S.products.find(x => x.sku === del.dataset.del);
      if (await confirmModal(`Delete ${p.name}?`, `This removes SKU ${p.sku} and its size chart. Recommendations for it will stop working until you sync it again.`, 'Delete product')) {
        try { await api(`/api/products/${encodeURIComponent(p.sku)}`, { method: 'DELETE' }); toast('Product deleted'); load(); } catch (err) { toast(err.message, 'err'); }
      }
    }
  };
  load().catch(e => toast(e.message, 'err'));
}

let layerTimer;
function closeLayer() {
  clearTimeout(layerTimer);
  const d = $('.drawer', layer);
  if (d) { d.classList.add('closing'); layerTimer = setTimeout(() => { layer.innerHTML = ''; }, 280); } else layer.innerHTML = '';
  document.removeEventListener('keydown', escClose);
}
function escClose(e) { if (e.key === 'Escape') closeLayer(); }

function editor(p, onSaved) {
  clearTimeout(layerTimer);
  const isNew = !p;
  const cats = S.categories.length ? S.categories : ['T-shirts', 'Shirts', 'Knitwear', 'Hoodies', 'Jackets', 'Jeans', 'Trousers', 'Shorts', 'Dresses'];
  const fits = S.fits.length ? S.fits : ['Slim', 'Regular', 'Relaxed'];
  const st = { category: p?.category || 'T-shirts', color: p?.color ?? 0, rows: p ? p.chart.map(r => ({ ...r })) : null };
  const defaults = cat => {
    const g = GROUP_OF(cat);
    if (g === 'bottoms') return ['28', '30', '32', '34', '36'].map((s, i) => ({ size: s, waist: 74 + i * 5, hips: 94 + i * 5, inseam: 79 + i * 0.5 }));
    if (g === 'dresses') return ['XS', 'S', 'M', 'L', 'XL'].map((s, i) => ({ size: s, chest: 84 + i * 5, waist: 68 + i * 5, hips: 92 + i * 5, length: 115 + i }));
    if (cat === 'Kurtas') return ['XS', 'S', 'M', 'L', 'XL'].map((s, i) => ({ size: s, chest: 88 + i * 6, waist: 84 + i * 6, shoulders: 36 + i * 1.5, length: 106 + i * 1.5 }));
    if (cat === 'Shalwar Kameez') return ['S', 'M', 'L', 'XL', 'XXL'].map((s, i) => ({ size: s, chest: 104 + i * 6, waist: 100 + i * 6, shoulders: 45 + i * 1.5, length: 100 + i * 1.5 }));
    return ['XS', 'S', 'M', 'L', 'XL'].map((s, i) => ({ size: s, chest: 92 + i * 6, waist: 86 + i * 6, shoulders: 42 + i * 2, length: 67 + i }));
  };
  if (!st.rows) st.rows = defaults(st.category);
  layer.innerHTML = `<div class="scrim"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="ed-title">
    <div class="drawer-head"><h2 id="ed-title">${isNew ? 'Add product' : `Edit ${esc(p.name)}`}</h2><button class="icon-btn" id="ed-close" aria-label="Close">✕</button></div>
    <form class="drawer-body" id="ed-form" novalidate>
      <div class="form-grid">
        <div class="form-2"><div class="field"><label for="f-sku">Product code</label><input class="input mono" id="f-sku" name="sku" value="${esc(p?.sku || '')}" ${isNew ? '' : 'readonly'} placeholder="e.g. LAWN-01" required><span class="helper">Any short code (your SKU). Filled in from the name if you leave it.</span></div>
          <div class="field"><label for="f-brand">Brand</label><input class="input" id="f-brand" name="brand" value="${esc(p?.brand || S.merchant.name.replace(/\s*\(demo\)$/, ''))}" required></div></div>
        <div class="field"><label for="f-name">Product name</label><input class="input" id="f-name" name="name" value="${esc(p?.name || '')}" placeholder="e.g. Everyday Cotton Tee" required></div>
        <div class="form-2"><div class="field"><label for="f-cat">Category</label><select class="select" id="f-cat" name="category">${cats.map(c => `<option ${c === st.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label for="f-fit">Fit of this design</label><select class="select" id="f-fit" name="fit">${fits.map(f => `<option ${f === (p?.fit || 'Regular') ? 'selected' : ''}>${f}</option>`).join('')}</select></div></div>
        <div class="form-2"><div class="field"><label for="f-price">Price (${esc(S.merchant.currency)})</label><input class="input" id="f-price" name="price" type="number" min="0" value="${p?.price ?? ''}"></div>
          <div class="field"><span class="label">Card colour</span><div class="swatches" id="f-sw">${SWATCHES.map((c, i) => `<button type="button" style="--c:${c}" data-i="${i}" class="${i === st.color ? 'on' : ''}" aria-label="Swatch ${i + 1}"></button>`).join('')}</div></div></div>
        <div class="field"><label for="f-desc">Description</label><textarea class="textarea" id="f-desc" name="description" maxlength="400">${esc(p?.description || '')}</textarea></div>
        <div class="field"><div style="display:flex;justify-content:space-between;align-items:center"><span class="label">Garment size chart</span><span style="display:flex;gap:8px;align-items:center"><span class="seg" id="f-unit"><button type="button" data-u="cm" class="on">cm</button><button type="button" data-u="in">inches</button></span><button type="button" class="btn ghost small" id="row-add">+ Size</button></span></div>
          <div class="table-wrap" style="margin:0;padding:0"><table class="chart-edit" id="chart-edit"></table></div>
          <span class="helper">Measure the clothes, not a person: lay the garment flat and double it for chest, waist and hips. Each size needs ${'<b id="req"></b>'}.</span><span class="helper" id="unit-warn" style="color:var(--danger)"></span></div>
      </div>
      <div><div class="preview glass">
        <span class="eyebrow"><span class="dot"></span>Live fit preview</span>
        <div id="pv-art"></div>
        <div class="mini-slider"><div><span>Test shopper height</span><b class="mono"><span id="pv-h-v">175</span> cm</b></div><input type="range" id="pv-h" min="145" max="200" value="175" aria-label="Test height"></div>
        <div class="mini-slider"><div><span>Test shopper weight</span><b class="mono"><span id="pv-w-v">72</span> kg</b></div><input type="range" id="pv-w" min="40" max="130" value="72" aria-label="Test weight"></div>
        <div class="seg" id="pv-fit"><button type="button" data-v="Slim">Slim</button><button type="button" data-v="Regular" class="on">Regular</button><button type="button" data-v="Relaxed">Relaxed</button></div>
        <div class="pv-out"><div class="pv-ring" id="pv-ring"></div><div><b id="pv-label">…</b><div class="helper" id="pv-notes"></div></div></div>
      </div></div>
    </form>
    <div class="drawer-foot"><span class="err-msg" id="ed-err" role="alert"></span><button class="btn ghost" id="ed-cancel" type="button">Cancel</button><button class="btn" id="ed-save" type="button">${isNew ? 'Add product' : 'Save changes'}</button></div>
  </aside>`;
  document.addEventListener('keydown', escClose);
  $('.scrim', layer).onclick = closeLayer; $('#ed-close').onclick = closeLayer; $('#ed-cancel').onclick = closeLayer;
  let pvFit = 'Regular';
  const dims = () => DIMS_FOR[GROUP_OF(st.category)];
  const drawChart = () => {
    const d = dims();
    $('#req').textContent = { tops: 'a chest', bottoms: 'a waist', dresses: 'chest and waist' }[GROUP_OF(st.category)] + ' measurement';
    $('#chart-edit').innerHTML = `<thead><tr><th>Size</th>${d.map(x => `<th>${x}</th>`).join('')}<th></th></tr></thead><tbody>${st.rows.map((r, i) => `<tr><td><input class="size-in" data-r="${i}" data-k="size" value="${esc(r.size)}" maxlength="10" aria-label="Size label"></td>${d.map(k => `<td><input type="number" step="0.5" data-r="${i}" data-k="${k}" value="${r[k] ?? ''}" aria-label="${esc(r.size)} ${k}"></td>`).join('')}<td><button type="button" class="icon-btn" data-rm="${i}" aria-label="Remove size">✕</button></td></tr>`).join('')}</tbody>`;
  };
  let unit = 'cm';
  const toCm = v => (unit === 'in' ? Math.round(Number(v) * 2.54 * 10) / 10 : Number(v));
  const autoSku = name => name.toUpperCase().normalize('NFKD').replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
  const payload = () => {
    const f = Object.fromEntries(new FormData($('#ed-form')));
    const d = dims();
    const sku = f.sku.trim() || (isNew && f.name.trim() ? autoSku(f.name.trim()) : '');
    const hidden = r => Object.fromEntries(Object.entries(r).filter(([k, v]) => k !== 'size' && !d.includes(k) && v != null && v !== ''));
    return { sku, brand: f.brand, name: f.name, category: st.category, fit: f.fit, price: Number(f.price) || 0, description: f.description, color: st.color, image_url: p?.image_url || '',
      chart: st.rows.map(r => ({ ...hidden(r), ...Object.fromEntries([['size', r.size], ...d.filter(k => r[k] !== '' && r[k] != null).map(k => [k, toCm(r[k])])]) })) };
  };
  const checkUnits = () => {
    const key = DIMS_FOR[GROUP_OF(st.category)][0];
    const vals = st.rows.map(r => toCm(r[key])).filter(Number.isFinite);
    $('#unit-warn').textContent = unit === 'cm' && vals.length && Math.min(...vals) < 60 ? `These look like inches (${key} ${Math.min(...vals)}). Switch the chart to "inches" above, or enter centimetres.` : '';
  };
  let pt, pseq = 0;
  const preview = () => {
    clearTimeout(pt);
    pt = setTimeout(async () => {
      const my = ++pseq;
      $('#pv-art').innerHTML = artBox(st.category, st.color);
      const body = { product: { ...payload(), sku: 'preview', name: $('#f-name').value || 'Preview', brand: $('#f-brand').value || 'Preview' }, profile: { height: Number($('#pv-h').value), weight: Number($('#pv-w').value), fit: pvFit } };
      try {
        const { result: r } = await api('/api/preview', { method: 'POST', body });
        if (my !== pseq) return;
        $('#pv-ring').innerHTML = `${ring(r.confidence, 92, 9)}<div><b>${esc(r.size)}</b><small>${r.confidence}%</small></div>`;
        animateRings($('#pv-ring'));
        $('#pv-label').textContent = r.label + (r.alternative ? ` · or ${r.alternative.size}` : '');
        $('#pv-notes').textContent = r.fit_notes.map(n => `${n.area} ${n.fit}`).join(' · ');
      } catch (e) { if (my === pseq) { $('#pv-label').textContent = 'Fix the chart to preview'; $('#pv-notes').textContent = e.message; $('#pv-ring').innerHTML = ''; } }
    }, 180);
  };
  drawChart(); preview(); checkUnits();
  $('#f-unit').onclick = e => {
    const b = e.target.closest('button'); if (!b || b.dataset.u === unit) return;
    // Convert what is already typed so the numbers stay the same garment.
    const factor = b.dataset.u === 'in' ? 1 / 2.54 : 2.54;
    for (const r of st.rows) for (const k of dims()) if (r[k] !== '' && r[k] != null) r[k] = Math.round(Number(r[k]) * factor * 10) / 10;
    unit = b.dataset.u; $$('#f-unit button').forEach(x => x.classList.toggle('on', x === b)); drawChart(); checkUnits();
  };
  $('#f-cat').onchange = e => {
    const prevGroup = GROUP_OF(st.category); st.category = e.target.value;
    if (GROUP_OF(st.category) !== prevGroup) st.rows = defaults(st.category);
    drawChart(); preview();
  };
  $('#f-sw').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.color = Number(b.dataset.i); $$('#f-sw button').forEach(x => x.classList.toggle('on', x === b)); preview(); };
  $('#chart-edit').oninput = e => { const i = e.target.dataset.r; if (i == null) return; st.rows[i][e.target.dataset.k] = e.target.value; checkUnits(); preview(); };
  $('#chart-edit').onclick = e => { const b = e.target.closest('[data-rm]'); if (!b) return; if (st.rows.length <= 1) return toast('A chart needs at least one size', 'err'); st.rows.splice(Number(b.dataset.rm), 1); drawChart(); preview(); };
  $('#row-add').onclick = () => {
    const last = st.rows[st.rows.length - 1]; const prev = st.rows[st.rows.length - 2] || last;
    const next = { size: '' }; for (const k of dims()) next[k] = last[k] != null ? Math.round((Number(last[k]) + (Number(last[k]) - Number(prev[k] ?? last[k]) || 4)) * 10) / 10 : '';
    st.rows.push(next); drawChart(); $(`#chart-edit tbody tr:last-child input`).focus(); preview();
  };
  $('#ed-form').oninput = e => { if (!e.target.closest('#chart-edit')) preview(); };
  for (const id of ['pv-h', 'pv-w']) $('#' + id).oninput = e => { $(`#${id}-v`).textContent = e.target.value; preview(); };
  $('#pv-fit').onclick = e => { const b = e.target.closest('button'); if (!b) return; pvFit = b.dataset.v; $$('#pv-fit button').forEach(x => x.classList.toggle('on', x === b)); preview(); };
  $('#ed-save').onclick = async () => {
    const body = payload();
    const btn = $('#ed-save'); btn.disabled = true; $('#ed-err').textContent = '';
    try {
      if (!body.name.trim()) throw new Error('Give the product a name.');
      await api(isNew ? '/api/products' : `/api/products/${encodeURIComponent(p.sku)}`, { method: isNew ? 'POST' : 'PUT', body });
      toast(isNew ? `${body.name} added. Next: install Forme on your store (Integration).` : 'Changes saved'); closeLayer(); onSaved?.();
    } catch (e) { $('#ed-err').textContent = /sku must be/.test(e.message) ? 'Use letters, numbers or dashes for the product code.' : e.message; btn.disabled = false; }
  };
}

function importModal(onDone) {
  clearTimeout(layerTimer);
  layer.innerHTML = `<div class="scrim"></div><div class="modal glass" role="dialog" aria-modal="true" aria-labelledby="im-t"><h2 id="im-t">Import products</h2>
    <p>Paste JSON in the form <code>{"products":[…]}</code> or choose a file. Products are matched by SKU: existing ones are updated, new ones created. If any product is invalid, nothing is imported.</p>
    <textarea class="textarea mono" id="im-text" style="min-height:180px;font-size:12px" placeholder='{"products":[{"sku":"TEE-1","name":"Tee","brand":"Acme","category":"T-shirts","fit":"Regular","chart":[{"size":"M","chest":104}]}]}'></textarea>
    <div style="margin-top:10px"><input type="file" id="im-file" accept="application/json,.json"></div>
    <div class="err-msg" id="im-err" role="alert"></div>
    <div class="foot"><button class="btn ghost" id="im-cancel">Cancel</button><button class="btn" id="im-go">Import</button></div></div>`;
  document.addEventListener('keydown', escClose);
  $('.scrim', layer).onclick = closeLayer; $('#im-cancel').onclick = closeLayer;
  $('#im-file').onchange = async e => { const f = e.target.files[0]; if (f) $('#im-text').value = await f.text(); };
  $('#im-go').onclick = async () => {
    let body;
    try { body = JSON.parse($('#im-text').value); } catch { $('#im-err').textContent = 'That is not valid JSON.'; return; }
    try {
      const r = await api('/api/products/import', { method: 'POST', body });
      toast(`Imported: ${r.created} created, ${r.updated} updated`); closeLayer(); onDone?.();
    } catch (e) { $('#im-err').innerHTML = esc(e.message) + (e.details ? '<br>' + e.details.slice(0, 4).map(d => `#${d.index} ${esc(d.sku || '')}: ${esc(d.error)}`).join('<br>') : ''); }
  };
}

function confirmModal(title, text, cta) {
  clearTimeout(layerTimer);
  return new Promise(resolve => {
    layer.innerHTML = `<div class="scrim"></div><div class="modal glass" role="alertdialog" aria-modal="true" aria-labelledby="cf-t"><h2 id="cf-t">${esc(title)}</h2><p>${esc(text)}</p><div class="foot"><button class="btn ghost" id="cf-no">Cancel</button><button class="btn danger" id="cf-yes">${esc(cta)}</button></div></div>`;
    const done = v => { document.removeEventListener('keydown', onEsc); closeLayer(); resolve(v); };
    const onEsc = e => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onEsc);
    $('.scrim', layer).onclick = () => done(false); $('#cf-no').onclick = () => done(false); $('#cf-yes').onclick = () => done(true);
    $('#cf-no').focus();
  });
}

/* =================== Insights =================== */
async function insights(my) {
  const view = $('#view');
  view.innerHTML = `<div class="grid insights">${'<div class="skeleton" style="height:220px"></div>'.repeat(6)}</div>`;
  const [d, prods] = await Promise.all([api('/api/insights'), api('/api/products')]);
  if (stale(my)) return;
  const productsByS = Object.fromEntries(prods.products.map(p => [p.sku, p]));
  view.innerHTML = `<p class="muted" style="margin:0 0 18px;max-width:760px">Forme learns from keep/return outcomes. When a product keeps coming back as "too small", recommendations for it shift towards bigger sizes, and vice versa. Send outcomes with <code class="mono">POST /v1/feedback</code>.</p>
  <div class="grid insights">${d.products.map((p, i) => {
    const t = Math.max(1, p.total); const pr = productsByS[p.sku];
    const shift = p.calibration.shift_cm; const pos = 50 + (shift / 4) * 45;
    const vc = /small/.test(p.verdict) ? 'var(--coral)' : /large/.test(p.verdict) ? 'var(--sky)' : /True/.test(p.verdict) ? 'var(--mint)' : 'var(--muted)';
    return `<article class="ins glass" style="--i:${i}"><div class="ins-top">${artBox(p.category, pr?.color ?? 0)}<div><b>${esc(p.name)}</b><small>${esc(p.sku)} · ${p.total} outcomes</small></div></div>
      <div class="stack"><i style="background:var(--mint)" data-w="${(p.kept / t) * 100}"></i><i style="background:var(--coral)" data-w="${(p.too_small / t) * 100}"></i><i style="background:var(--sky)" data-w="${(p.too_large / t) * 100}"></i><i style="background:var(--muted)" data-w="${(p.returned_other / t) * 100}"></i></div>
      <div class="stack-legend"><span><i style="background:var(--mint)"></i>Kept ${p.kept}</span><span><i style="background:var(--coral)"></i>Too small ${p.too_small}</span><span><i style="background:var(--sky)"></i>Too large ${p.too_large}</span><span><i style="background:var(--muted)"></i>Other ${p.returned_other}</span></div>
      <div class="gauge"><div class="gauge-l"><span>Sizing down</span><span class="mono">${shift > 0 ? '+' : ''}${shift} cm</span><span>Sizing up</span></div><div class="gauge-track"><i data-l="${pos}"></i></div></div>
      <div class="verdict" style="color:${vc}">${esc(p.verdict)}</div></article>`;
  }).join('') || '<div class="empty"><b>No products yet</b>Add products to start collecting fit insights.</div>'}</div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.stack i').forEach(x => { x.style.width = `${x.dataset.w}%`; });
    $$('.gauge-track i').forEach(x => { x.style.left = `${x.dataset.l}%`; });
  }));
}

/* =================== Integration =================== */
async function integration(my) {
  const view = $('#view');
  view.innerHTML = '<div class="skeleton"></div>';
  const [{ keys }, { products: prods }] = await Promise.all([api('/api/keys'), api('/api/products')]);
  if (stale(my)) return;
  const firstSku = prods[0]?.sku || 'YOUR-PRODUCT-CODE';
  const m = S.merchant;
  const pk = keys.find(k => k.kind === 'public' && !k.revoked_at);
  const host = location.origin;
  const snippet = `<span class="c">&lt;!-- Add once, before &lt;/body&gt; --&gt;</span>
<span class="k">&lt;script</span> src=<span class="s">"${host}/widget.js"</span>
        data-key=<span class="s">"${esc(pk?.key || 'pk_live_…')}"</span> async<span class="k">&gt;&lt;/script&gt;</span>

<span class="c">&lt;!-- On each product page, near the size picker --&gt;</span>
<span class="k">&lt;div</span> data-forme-sku=<span class="s">"${esc(firstSku)}"</span><span class="k">&gt;&lt;/div&gt;</span>

<span class="k">&lt;script&gt;</span>
  <span class="c">// Optional, for developers: pick the chosen size in your own size buttons</span>
  document.addEventListener(<span class="s">'forme:size-selected'</span>, e =&gt; selectSize(e.detail.size));
  <span class="c">// After add to cart (safe even if the widget is blocked):</span>
  window.Forme &amp;&amp; Forme.track(<span class="s">'add_to_cart'</span>, { sku, size });
<span class="k">&lt;/script&gt;</span>`;
  const accent = m.widget.accent;
  const ACCENTS = ['#c6ff3d', '#2f43ff', '#12b76a', '#9aa3ff', '#ff7a2f', '#ffd43b', '#ffffff'];
  view.innerHTML = `<div class="grid row-2">
    <section class="card glass"><div class="card-head"><div><h2>Install the widget</h2><p>Copy the code, then follow the steps for your store. Replace <b>${esc(firstSku)}</b> with each product's code.</p></div><button class="btn ghost small" id="copy-snippet">Copy code</button></div>
      <div class="seg" id="plat" style="margin-bottom:12px"><button type="button" class="on" data-p="shopify">Shopify</button><button type="button" data-p="woo">WooCommerce</button><button type="button" data-p="custom">Custom site</button></div>
      <ol class="helper" id="plat-steps" style="margin:0 0 12px;padding-left:18px;line-height:1.8"></ol><pre class="snippet">${snippet}</pre>
      <p class="helper" style="margin-top:12px">Full reference in the <a href="/docs" style="color:var(--accent-ink)">API docs</a>. Try it on the <a href="/demo" style="color:var(--accent-ink)">demo store</a>.</p></section>
    <section class="card glass" style="--d:.08s"><div class="card-head"><div><h2>Widget style</h2><p>Saved instantly to every storefront using your key.</p></div></div>
      <div class="form-grid"><div class="field"><span class="label">Accent colour</span><div class="swatches" id="acc">${ACCENTS.map(c => `<button type="button" style="--c:${c}" data-c="${c}" class="${c === accent ? 'on' : ''}" aria-label="Accent ${c}"></button>`).join('')}</div></div>
      <div class="field"><label for="w-label">Button label</label><input class="input" id="w-label" maxlength="32" value="${esc(m.widget.label)}"></div>
      <div class="preview-pad" id="w-prev" style="--a:${accent}"><span class="mock-trigger"><span>f</span><b id="w-prev-l">${esc(m.widget.label)}</b></span><small>Preview on a light storefront</small></div></div></section>
  </div>
  <section class="card glass" style="margin-top:16px;--d:.12s"><div class="card-head"><div><h2>API keys</h2><p><b>Publishable</b> keys (pk_live_) go in the browser and can only recommend and track. <b>Secret</b> keys (sk_live_) are for your servers: catalog sync and return feedback. Secret keys are shown once.</p></div>
    <div style="display:flex;gap:8px"><button class="btn ghost small" data-new="public">+ Publishable key</button><button class="btn small" data-new="secret">+ Secret key</button></div></div>
    <div id="keys">${keys.map(k => `<div class="key-row ${k.revoked_at ? 'revoked' : ''}"><span class="pill ${k.kind === 'secret' ? 'violet' : 'lime'}">${k.kind === 'secret' ? 'Secret' : 'Publishable'}</span>
      <div style="min-width:0"><div class="key-val">${esc(k.key || k.prefix + '••••••••••••••••')}</div><small>${esc(k.label)} · created ${ago(k.created_at)} · ${k.revoked_at ? `revoked ${ago(k.revoked_at)}` : k.last_used_at ? `last used ${ago(k.last_used_at)}` : 'never used'}</small></div>
      ${k.key && !k.revoked_at ? `<button class="btn ghost small" data-copy="${esc(k.key)}">Copy</button>` : '<span></span>'}
      ${k.revoked_at ? '<span></span>' : `<button class="btn danger small" data-revoke="${esc(k.id)}">Revoke</button>`}</div>`).join('') || '<p class="empty">No keys yet.</p>'}</div></section>
  <section class="card glass" style="margin-top:16px;--d:.16s"><div class="card-head"><div><h2>Allowed origins</h2><p>Publishable keys only work from these sites. Leave empty while testing to allow any origin.</p></div><button class="btn small" id="save-origins">Save origins</button></div>
    <div class="origins" id="origins"></div><button class="btn ghost small" id="add-origin" style="margin-top:10px">+ Add origin</button></section>`;
  $('#copy-snippet').onclick = () => copyText($('.snippet').textContent);
  const STEPS = {
    shopify: ['Shopify admin → Online Store → Themes → … → Edit code.', 'Open <b>layout/theme.liquid</b> and paste the first two lines just before <code>&lt;/body&gt;</code>.', 'Open your product template (e.g. <b>sections/main-product.liquid</b>) and paste the <code>&lt;div data-forme-sku&gt;</code> line above the Add to cart button, using <code>{{ product.selected_or_first_available_variant.sku }}</code> as the code.', 'Save and open a product page: the "Find my size" button appears.'],
    woo: ['WordPress admin → Appearance → Theme File Editor (or a "Header & Footer scripts" plugin).', 'Paste the first two lines into the footer, before <code>&lt;/body&gt;</code>.', 'Edit <b>single-product.php</b> (or use a shortcode block) and add the <code>&lt;div data-forme-sku&gt;</code> line with <code>&lt;?php echo $product-&gt;get_sku(); ?&gt;</code>.', 'Save and open a product page to check.'],
    custom: ['Paste the first two lines once, before <code>&lt;/body&gt;</code> on every page.', 'Put the <code>&lt;div data-forme-sku&gt;</code> line next to your size picker with that product\'s code.', 'Optional: the developer lines let the chosen size select your own size button and report add-to-cart.'],
  };
  const drawSteps = k => { $('#plat-steps').innerHTML = STEPS[k].map(x => `<li>${x}</li>`).join(''); };
  drawSteps('shopify');
  $('#plat').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#plat button').forEach(x => x.classList.toggle('on', x === b)); drawSteps(b.dataset.p); };
  let wt, pending = {};
  const saveWidget = patch => { pending = { ...pending, ...patch }; clearTimeout(wt); wt = setTimeout(async () => { const body = pending; pending = {}; try { S.merchant = (await api('/api/account', { method: 'PATCH', body: { widget: body } })).merchant; toast('Widget style saved'); } catch (e) { toast(e.message, 'err'); } }, 500); };
  $('#acc').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#acc button').forEach(x => x.classList.toggle('on', x === b)); $('#w-prev').style.setProperty('--a', b.dataset.c); saveWidget({ accent: b.dataset.c }); };
  $('#w-label').oninput = e => { $('#w-prev-l').textContent = e.target.value || ' '; if (e.target.value.trim()) saveWidget({ label: e.target.value }); };
  $('#keys').onclick = async e => {
    const c = e.target.closest('[data-copy]'), r = e.target.closest('[data-revoke]');
    if (c) copyText(c.dataset.copy);
    if (r && await confirmModal('Revoke this key?', 'Any site or server using it will stop working immediately. This cannot be undone.', 'Revoke key')) {
      try { await api(`/api/keys/${r.dataset.revoke}`, { method: 'DELETE' }); toast('Key revoked'); render(); } catch (err) { toast(err.message, 'err'); }
    }
  };
  $$('[data-new]').forEach(b => b.onclick = async () => {
    try {
      const { key } = await api('/api/keys', { method: 'POST', body: { kind: b.dataset.new } });
      if (key.kind === 'secret') {
        layer.innerHTML = `<div class="scrim"></div><div class="modal glass" role="dialog" aria-modal="true" aria-labelledby="sk-t"><h2 id="sk-t">Your new secret key</h2><p>Copy it now and store it in your server's secrets manager. For your security, Forme will never show it again.</p><div class="secret-box"><span>${esc(key.key)}</span><button class="btn small" id="sk-copy">Copy</button></div><div class="foot"><button class="btn" id="sk-done">I've saved it</button></div></div>`;
        $('#sk-copy').onclick = () => copyText(key.key);
        $('#sk-done').onclick = () => { closeLayer(); render(); };
      } else { toast('Publishable key created'); render(); }
    } catch (err) { toast(err.message, 'err'); }
  });
  const origins = [...m.allowed_origins];
  const drawOrigins = () => {
    $('#origins').innerHTML = origins.map((o, i) => `<div class="origin"><input class="input mono" data-o="${i}" value="${esc(o)}" placeholder="https://shop.example.com" aria-label="Allowed origin"><button class="icon-btn" data-ro="${i}" aria-label="Remove origin">✕</button></div>`).join('') || '<p class="helper">No restrictions: any website can use your publishable key.</p>';
  };
  drawOrigins();
  $('#origins').oninput = e => { if (e.target.dataset.o != null) origins[e.target.dataset.o] = e.target.value; };
  $('#origins').onclick = e => { const b = e.target.closest('[data-ro]'); if (b) { origins.splice(Number(b.dataset.ro), 1); drawOrigins(); } };
  $('#add-origin').onclick = () => { origins.push(''); drawOrigins(); $('#origins input:last-of-type')?.focus(); };
  $('#save-origins').onclick = async () => {
    try { S.merchant = (await api('/api/account', { method: 'PATCH', body: { allowed_origins: origins.map(o => o.trim()).filter(Boolean) } })).merchant; toast('Allowed origins saved'); }
    catch (e) { toast(e.message, 'err'); }
  };
}

/* =================== Settings =================== */
function settings() {
  const m = S.merchant;
  $('#view').innerHTML = `<div class="grid row-2"><section class="card glass"><div class="card-head"><div><h2>Workspace</h2><p>Used across the console and in the ROI figures.</p></div></div>
    <form class="form-grid" id="set-form"><div class="field"><label for="s-name">Company name</label><input class="input" id="s-name" name="name" value="${esc(m.name)}" required></div>
    <div class="field"><label for="s-cost">Average cost of one return (${esc(m.currency)})</label><input class="input" id="s-cost" name="return_cost" type="number" min="0" value="${m.return_cost}"><span class="helper">Reverse pickup, inspection and restocking. Used to estimate savings.</span></div>
    <div><button class="btn" type="submit">Save settings</button></div></form></section>
    <section class="card glass" style="--d:.08s"><div class="card-head"><div><h2>Account</h2></div></div>
      <div class="form-grid"><div><span class="label">Email</span><div>${esc(m.email)}</div></div><div><span class="label">Plan</span><div><span class="pill lime">${esc(m.plan)}</span></div></div><div><span class="label">Member since</span><div>${new Date(m.created_at).toLocaleDateString('en-PK', { dateStyle: 'long' })}</div></div>
      <div><span class="label">Data</span><p class="helper" style="margin:4px 0 0">Shopper profiles contain body measurements and a fit preference only. Shoppers can erase theirs from the widget ("Forget me") or via <code>DELETE /v1/profiles/me</code>.</p></div></div></section></div>`;
  $('#set-form').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (String(f.return_cost).trim() === '') return toast('Enter the average cost of one return (Rs).', 'err');
    try { S.merchant = (await api('/api/account', { method: 'PATCH', body: { name: f.name, return_cost: Number(f.return_cost) } })).merchant; toast('Settings saved'); shell(); }
    catch (err) { toast(err.message, 'err'); }
  };
}

if (reduceMotion()) document.documentElement.classList.add('reduce');
boot();
