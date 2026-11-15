import { $, $$, esc, money, compact, pct, api, toast, countUp, copyText, ring, animateRings, reduceMotion } from './ui.js';
import { artBox, SWATCHES } from './art.js';

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
const EV = { recommendation: ['✦', 'Size recommended'], widget_open: ['◌', 'Widget opened'], add_to_cart: ['＋', 'Added to cart'], purchase: ['₹', 'Purchase'], size_selected: ['✓', 'Size selected'] };
const ago = t => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };

/* =================== Boot & routing =================== */
async function boot() {
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
      <div><h1>Your catalog's <span class="serif" style="color:var(--lime)">fit brain.</span></h1><p>Manage size charts, ship the widget, and prove return savings with live analytics.</p></div>
      <div class="auth-stats"><div><b>REST + widget</b><span>Two ways to integrate</span></div><div><b>Self-learning</b><span>From keep / return feedback</span></div></div>
    </section>
    <section class="auth-form"><div class="auth-card glass">
      <div class="seg" id="auth-tabs"><button data-m="login" class="${mode === 'login' ? 'on' : ''}">Sign in</button><button data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Create account</button></div>
      <h2>${mode === 'login' ? 'Welcome back' : 'Start your workspace'}</h2>
      <p class="muted" style="margin:0;font-size:14px">${mode === 'login' ? 'Sign in to your Forme console.' : 'Free while you pilot. No card needed.'}</p>
      <form id="auth-form" novalidate>
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
    $('#a-email').value = 'demo@forme.dev'; $('#a-pass').value = 'forme-demo-2026';
    $('#auth-form').requestSubmit();
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
      <div class="side-card"><b>See it live</b>Open the demo store, pick a size, and watch events arrive here. <a href="/demo" target="_blank" rel="noopener">Open store ↗</a></div>
      <div class="me"><div class="avatar">${esc(m.name[0] || 'F').toUpperCase()}</div><div><b>${esc(m.name)}</b><small>${esc(m.email)} · ${esc(m.plan)}</small></div><button class="icon-btn" id="logout" title="Sign out" aria-label="Sign out">⏻</button></div>
    </aside>
    <div class="main">
      <header class="top"><h1 id="title"></h1><span class="live"><i></i>Live</span><div class="seg" id="period"><button data-d="7">7d</button><button data-d="30">30d</button><button data-d="90">90d</button></div></header>
      <div id="view"></div>
    </div>
    <nav class="mobile-nav">${nav('')}</nav>
  </div>`;
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
function render() {
  stopPoll();
  const view = $('#view');
  view.className = 'view'; void view.offsetWidth; view.className = 'view';
  ({ overview, catalog, insights, integration, settings })[S.view]();
}
function stopPoll() { clearInterval(S.poll); S.poll = null; }

/* =================== Charts =================== */
function areaChart(el, series, keys) {
  const W = 800, H = 280, P = { l: 40, r: 10, t: 12, b: 28 };
  const max = Math.max(1, ...series.flatMap(d => keys.map(k => d[k.key]))) * 1.12;
  const x = i => P.l + (i / Math.max(1, series.length - 1)) * (W - P.l - P.r);
  const y = v => H - P.b - (v / max) * (H - P.t - P.b);
  const smooth = pts => pts.reduce((d, [px, py], i, a) => {
    if (!i) return `M${px},${py}`;
    const [qx, qy] = a[i - 1], cx = (qx + px) / 2;
    return `${d} C${cx},${qy} ${cx},${py} ${px},${py}`;
  }, '');
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i);
  const step = Math.ceil(series.length / 7);
  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>${keys.map(k => `<linearGradient id="ga-${k.key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.color}" stop-opacity=".35"/><stop offset="1" stop-color="${k.color}" stop-opacity="0"/></linearGradient>`).join('')}</defs>`;
  svg += ticks.map(t => `<line class="gridline" x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${P.l - 8}" y="${y(t) + 4}" text-anchor="end">${compact(t)}</text>`).join('');
  svg += series.map((d, i) => (i % step === 0 ? `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${d.date.slice(5).replace('-', '/')}</text>` : '')).join('');
  for (const k of keys) {
    const pts = series.map((d, i) => [x(i), y(d[k.key])]);
    const line = smooth(pts);
    svg += `<path class="area" d="${line} L${x(series.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z" fill="url(#ga-${k.key})"/>`;
    svg += `<path class="line" d="${line}" stroke="${k.color}" pathLength="1000" style="--len:1000"/>`;
  }
  svg += `<line class="hover-line" id="hl" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" opacity="0"/>${keys.map(k => `<circle id="hd-${k.key}" r="5" fill="${k.color}" stroke="#0b0f14" stroke-width="2" opacity="0"/>`).join('')}</svg><div class="tip" style="opacity:0"></div>`;
  el.innerHTML = svg;
  const s = $('svg', el), tip = $('.tip', el);
  el.onpointermove = e => {
    const r = s.getBoundingClientRect();
    const rel = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(series.length - 1, Math.round(((rel - P.l) / (W - P.l - P.r)) * (series.length - 1))));
    const d = series[i];
    $('#hl', el).setAttribute('x1', x(i)); $('#hl', el).setAttribute('x2', x(i)); $('#hl', el).setAttribute('opacity', 1);
    for (const k of keys) { const c = $(`#hd-${k.key}`, el); c.setAttribute('cx', x(i)); c.setAttribute('cy', y(d[k.key])); c.setAttribute('opacity', 1); }
    tip.style.opacity = 1;
    tip.style.left = `${(x(i) / W) * r.width}px`; tip.style.top = `${(y(Math.max(...keys.map(k => d[k.key]))) / H) * r.height}px`;
    tip.innerHTML = `<b>${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</b>${keys.map(k => `<div><i style="background:${k.color}"></i>${k.label}<span style="margin-left:auto;font-family:var(--mono)">${d[k.key]}</span></div>`).join('')}`;
  };
  el.onpointerleave = () => { tip.style.opacity = 0; $('#hl', el).setAttribute('opacity', 0); keys.forEach(k => $(`#hd-${k.key}`, el).setAttribute('opacity', 0)); };
}
function spark(values, color) {
  if (!values.length) return '';
  const max = Math.max(1, ...values), W = 120, H = 40;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * W},${H - (v / max) * (H - 4)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/><polygon points="0,${H} ${pts} ${W},${H}" fill="${color}" opacity=".12"/></svg>`;
}
const chg = c => (c == null ? '<span class="chg flat">new</span>' : `<span class="chg ${c > 0.5 ? 'up' : c < -0.5 ? 'down' : 'flat'}">${c > 0 ? '▲' : c < 0 ? '▼' : '•'} ${Math.abs(c).toFixed(1)}%</span>`);

/* =================== Overview =================== */
async function overview() {
  const view = $('#view');
  view.innerHTML = `<div class="grid kpis">${'<div class="skeleton"></div>'.repeat(6)}</div>`;
  let a;
  try { a = await api(`/api/analytics?days=${S.days}`); } catch (e) { view.innerHTML = `<div class="empty"><b>Could not load analytics</b>${esc(e.message)}</div>`; return; }
  if (S.view !== 'overview') return;
  const k = a.kpis, r = a.returns, cur = S.merchant.currency;
  const seriesOf = key => a.series.map(d => d[key]);
  const isDemo = S.merchant.email === 'demo@forme.dev';
  const kpis = [
    ['Widget opens', k.widget_opens.value, chg(k.widget_opens.change), 'compact', seriesOf('opens'), '#74c7ff'],
    ['Recommendations', k.recommendations.value, chg(k.recommendations.change), 'compact', seriesOf('recs'), '#d4f36b'],
    ['Add-to-cart rate', k.add_to_cart_rate.value * 100, chg(k.add_to_cart_rate.change), 'pct', seriesOf('carts'), '#a48bff'],
    ['Influenced revenue', k.influenced_revenue.value, chg(k.influenced_revenue.change), 'money', [], '#7ef0c1'],
    ['Avg. confidence', k.avg_confidence.value, '<span class="chg flat">engine score</span>', 'pct', [], '#d4f36b'],
    ['Unique shoppers', k.shoppers.value, '<span class="chg flat">with a profile</span>', 'compact', [], '#ff8a6b'],
  ];
  const maxRate = Math.max(r.followed_rate || 0, r.ignored_rate || 0, 0.01);
  view.innerHTML = `
    ${isDemo ? '<div class="notice"><b>Demo workspace.</b> 60 days of synthetic traffic plus anything you do in the demo store right now.</div>' : ''}
    <div class="grid kpis">${kpis.map(([l, v, c, f, sp, col], i) => `<div class="kpi glass" style="--i:${i}"><span>${l}</span><b data-v="${v}" data-f="${f}">0</b>${c}${spark(sp, col)}</div>`).join('')}</div>
    <div class="grid row-2" style="margin-top:16px">
      <section class="card glass"><div class="card-head"><div><h2>Shopper funnel</h2><p>Daily widget opens, size recommendations and add-to-carts after a recommendation</p></div>
        <div class="legend"><span><i style="background:#74c7ff"></i>Opens</span><span><i style="background:#d4f36b"></i>Recommendations</span><span><i style="background:#a48bff"></i>Add to cart</span></div></div>
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
  $$('.kpi b').forEach(b => { const f = b.dataset.f; countUp(b, Number(b.dataset.v), { format: f === 'money' ? v => money(v, cur) : f === 'pct' ? v => `${v.toFixed(1)}%` : v => compact(v) }); });
  countUp($('#savings'), r.estimated_savings, { format: v => money(v, cur), duration: 1800 });
  areaChart($('#funnel'), a.series, [{ key: 'opens', color: '#74c7ff', label: 'Opens' }, { key: 'recs', color: '#d4f36b', label: 'Recommendations' }, { key: 'carts', color: '#a48bff', label: 'Add to cart' }]);
  const mixMax = Math.max(1, ...a.size_mix.map(s => s.n));
  $('#mix').innerHTML = a.size_mix.length ? [...a.size_mix].sort((x, y) => sizeOrder(x.size) - sizeOrder(y.size)).map((s, i) => `<div style="--i:${i}"><i data-h="${(s.n / mixMax) * 100}" title="${s.n}"></i><span>${esc(s.size)}</span></div>`).join('') : '<p class="empty">No data yet</p>';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('.track i').forEach(t => { t.style.width = `${t.dataset.w}%`; });
    $$('#mix i').forEach(t => { t.style.height = `${t.dataset.h}%`; });
  }));
  S.lastEvent = 0;
  await feed(true);
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

function closeLayer() {
  const d = $('.drawer', layer);
  if (d) { d.classList.add('closing'); setTimeout(() => { layer.innerHTML = ''; }, 280); } else layer.innerHTML = '';
  document.removeEventListener('keydown', escClose);
}
function escClose(e) { if (e.key === 'Escape') closeLayer(); }

function editor(p, onSaved) {
  const isNew = !p;
  const cats = S.categories.length ? S.categories : ['T-shirts', 'Shirts', 'Knitwear', 'Hoodies', 'Jackets', 'Jeans', 'Trousers', 'Shorts', 'Dresses'];
  const fits = S.fits.length ? S.fits : ['Slim', 'Regular', 'Relaxed'];
  const st = { category: p?.category || 'T-shirts', color: p?.color ?? 0, rows: p ? p.chart.map(r => ({ ...r })) : null };
  const defaults = cat => {
    const g = GROUP_OF(cat);
    if (g === 'bottoms') return ['28', '30', '32', '34', '36'].map((s, i) => ({ size: s, waist: 74 + i * 5, hips: 94 + i * 5, inseam: 79 + i * 0.5 }));
    if (g === 'dresses') return ['XS', 'S', 'M', 'L', 'XL'].map((s, i) => ({ size: s, chest: 84 + i * 5, waist: 68 + i * 5, hips: 92 + i * 5, length: 115 + i }));
    return ['XS', 'S', 'M', 'L', 'XL'].map((s, i) => ({ size: s, chest: 92 + i * 6, waist: 86 + i * 6, shoulders: 42 + i * 2, length: 67 + i }));
  };
  if (!st.rows) st.rows = defaults(st.category);
  layer.innerHTML = `<div class="scrim"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="ed-title">
    <div class="drawer-head"><h2 id="ed-title">${isNew ? 'Add product' : `Edit ${esc(p.name)}`}</h2><button class="icon-btn" id="ed-close" aria-label="Close">✕</button></div>
    <form class="drawer-body" id="ed-form" novalidate>
      <div class="form-grid">
        <div class="form-2"><div class="field"><label for="f-sku">SKU</label><input class="input mono" id="f-sku" name="sku" value="${esc(p?.sku || '')}" ${isNew ? '' : 'readonly'} placeholder="e.g. TEE-001" required></div>
          <div class="field"><label for="f-brand">Brand</label><input class="input" id="f-brand" name="brand" value="${esc(p?.brand || S.merchant.name.replace(/\s*\(demo\)$/, ''))}" required></div></div>
        <div class="field"><label for="f-name">Product name</label><input class="input" id="f-name" name="name" value="${esc(p?.name || '')}" placeholder="e.g. Everyday Cotton Tee" required></div>
        <div class="form-2"><div class="field"><label for="f-cat">Category</label><select class="select" id="f-cat" name="category">${cats.map(c => `<option ${c === st.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label for="f-fit">Garment cut</label><select class="select" id="f-fit" name="fit">${fits.map(f => `<option ${f === (p?.fit || 'Regular') ? 'selected' : ''}>${f}</option>`).join('')}</select></div></div>
        <div class="form-2"><div class="field"><label for="f-price">Price (${esc(S.merchant.currency)})</label><input class="input" id="f-price" name="price" type="number" min="0" value="${p?.price ?? ''}"></div>
          <div class="field"><span class="label">Swatch</span><div class="swatches" id="f-sw">${SWATCHES.map((c, i) => `<button type="button" style="--c:${c}" data-i="${i}" class="${i === st.color ? 'on' : ''}" aria-label="Swatch ${i + 1}"></button>`).join('')}</div></div></div>
        <div class="field"><label for="f-desc">Description</label><textarea class="textarea" id="f-desc" name="description" maxlength="400">${esc(p?.description || '')}</textarea></div>
        <div class="field"><div style="display:flex;justify-content:space-between;align-items:center"><span class="label">Garment size chart · cm</span><span><button type="button" class="btn ghost small" id="row-add">+ Size</button></span></div>
          <div class="table-wrap" style="margin:0;padding:0"><table class="chart-edit" id="chart-edit"></table></div>
          <span class="helper">Measure the garment flat and double it for chest, waist and hips. Each size needs ${'<b id="req"></b>'}.</span></div>
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
  const payload = () => {
    const f = Object.fromEntries(new FormData($('#ed-form')));
    const d = dims();
    return { sku: f.sku.trim(), brand: f.brand, name: f.name, category: st.category, fit: f.fit, price: Number(f.price) || 0, description: f.description, color: st.color,
      chart: st.rows.map(r => Object.fromEntries([['size', r.size], ...d.filter(k => r[k] !== '' && r[k] != null).map(k => [k, Number(r[k])])])) };
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
  drawChart(); preview();
  $('#f-cat').onchange = e => {
    const prevGroup = GROUP_OF(st.category); st.category = e.target.value;
    if (GROUP_OF(st.category) !== prevGroup) st.rows = defaults(st.category);
    drawChart(); preview();
  };
  $('#f-sw').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.color = Number(b.dataset.i); $$('#f-sw button').forEach(x => x.classList.toggle('on', x === b)); preview(); };
  $('#chart-edit').oninput = e => { const i = e.target.dataset.r; if (i == null) return; st.rows[i][e.target.dataset.k] = e.target.value; preview(); };
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
      await api(isNew ? '/api/products' : `/api/products/${encodeURIComponent(p.sku)}`, { method: isNew ? 'POST' : 'PUT', body });
      toast(isNew ? `${body.name} added to your catalog` : 'Changes saved'); closeLayer(); onSaved?.();
    } catch (e) { $('#ed-err').textContent = e.message; btn.disabled = false; }
  };
}

function importModal(onDone) {
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
  return new Promise(resolve => {
    layer.innerHTML = `<div class="scrim"></div><div class="modal glass" role="alertdialog" aria-modal="true" aria-labelledby="cf-t"><h2 id="cf-t">${esc(title)}</h2><p>${esc(text)}</p><div class="foot"><button class="btn ghost" id="cf-no">Cancel</button><button class="btn danger" id="cf-yes">${esc(cta)}</button></div></div>`;
    const done = v => { closeLayer(); resolve(v); };
    $('.scrim', layer).onclick = () => done(false); $('#cf-no').onclick = () => done(false); $('#cf-yes').onclick = () => done(true);
    $('#cf-no').focus();
  });
}

/* =================== Insights =================== */
async function insights() {
  const view = $('#view');
  view.innerHTML = `<div class="grid insights">${'<div class="skeleton" style="height:220px"></div>'.repeat(6)}</div>`;
  const d = await api('/api/insights');
  if (S.view !== 'insights') return;
  const productsByS = Object.fromEntries((await api('/api/products')).products.map(p => [p.sku, p]));
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
async function integration() {
  const view = $('#view');
  view.innerHTML = '<div class="skeleton"></div>';
  const { keys } = await api('/api/keys');
  if (S.view !== 'integration') return;
  const m = S.merchant;
  const pk = keys.find(k => k.kind === 'public' && !k.revoked_at);
  const host = location.origin;
  const snippet = `<span class="c">&lt;!-- Add once, before &lt;/body&gt; --&gt;</span>
<span class="k">&lt;script</span> src=<span class="s">"${host}/widget.js"</span>
        data-key=<span class="s">"${esc(pk?.key || 'pk_live_…')}"</span> async<span class="k">&gt;&lt;/script&gt;</span>

<span class="c">&lt;!-- On each product page, near the size picker --&gt;</span>
<span class="k">&lt;div</span> data-forme-sku=<span class="s">"YOUR-SKU"</span><span class="k">&gt;&lt;/div&gt;</span>

<span class="k">&lt;script&gt;</span>
  document.addEventListener(<span class="s">'forme:size-selected'</span>, e =&gt; selectSize(e.detail.size));
  <span class="c">// After add to cart / checkout:</span>
  Forme.track(<span class="s">'add_to_cart'</span>, { sku, size });
  Forme.track(<span class="s">'purchase'</span>, { sku, size, value: price });
<span class="k">&lt;/script&gt;</span>`;
  const accent = m.widget.accent;
  const ACCENTS = ['#d4f36b', '#7ef0c1', '#74c7ff', '#a48bff', '#ff8a6b', '#f5d76e', '#ffffff'];
  view.innerHTML = `<div class="grid row-2">
    <section class="card glass"><div class="card-head"><div><h2>Install the widget</h2><p>Paste this into your storefront theme. It adapts to any page and never blocks rendering.</p></div><button class="btn ghost small" id="copy-snippet">Copy</button></div><pre class="snippet">${snippet}</pre>
      <p class="helper" style="margin-top:12px">Full reference in the <a href="/docs" style="color:var(--lime)">API docs</a>. Try it on the <a href="/demo" style="color:var(--lime)">demo store</a>.</p></section>
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
  let wt;
  const saveWidget = patch => { clearTimeout(wt); wt = setTimeout(async () => { try { S.merchant = (await api('/api/account', { method: 'PATCH', body: { widget: patch } })).merchant; toast('Widget style saved'); } catch (e) { toast(e.message, 'err'); } }, 500); };
  $('#acc').onclick = e => { const b = e.target.closest('button'); if (!b) return; $$('#acc button').forEach(x => x.classList.toggle('on', x === b)); $('#w-prev').style.setProperty('--a', b.dataset.c); saveWidget({ accent: b.dataset.c }); };
  $('#w-label').oninput = e => { $('#w-prev-l').textContent = e.target.value || ' '; if (e.target.value.trim()) saveWidget({ label: e.target.value }); };
  $('#keys').onclick = async e => {
    const c = e.target.closest('[data-copy]'), r = e.target.closest('[data-revoke]');
    if (c) copyText(c.dataset.copy);
    if (r && await confirmModal('Revoke this key?', 'Any site or server using it will stop working immediately. This cannot be undone.', 'Revoke key')) {
      try { await api(`/api/keys/${r.dataset.revoke}`, { method: 'DELETE' }); toast('Key revoked'); integration(); } catch (err) { toast(err.message, 'err'); }
    }
  };
  $$('[data-new]').forEach(b => b.onclick = async () => {
    try {
      const { key } = await api('/api/keys', { method: 'POST', body: { kind: b.dataset.new } });
      if (key.kind === 'secret') {
        layer.innerHTML = `<div class="scrim"></div><div class="modal glass" role="dialog" aria-modal="true" aria-labelledby="sk-t"><h2 id="sk-t">Your new secret key</h2><p>Copy it now and store it in your server's secrets manager. For your security, Forme will never show it again.</p><div class="secret-box"><span>${esc(key.key)}</span><button class="btn small" id="sk-copy">Copy</button></div><div class="foot"><button class="btn" id="sk-done">I've saved it</button></div></div>`;
        $('#sk-copy').onclick = () => copyText(key.key);
        $('#sk-done').onclick = () => { closeLayer(); integration(); };
      } else { toast('Publishable key created'); integration(); }
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
      <div class="form-grid"><div><span class="label">Email</span><div>${esc(m.email)}</div></div><div><span class="label">Plan</span><div><span class="pill lime">${esc(m.plan)}</span></div></div><div><span class="label">Member since</span><div>${new Date(m.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</div></div>
      <div><span class="label">Data</span><p class="helper" style="margin:4px 0 0">Shopper profiles contain body measurements and a fit preference only. Shoppers can erase theirs from the widget ("Forget me") or via <code>DELETE /v1/profiles/me</code>.</p></div></div></section></div>`;
  $('#set-form').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { S.merchant = (await api('/api/account', { method: 'PATCH', body: { name: f.name, return_cost: Number(f.return_cost) } })).merchant; toast('Settings saved'); shell(); }
    catch (err) { toast(err.message, 'err'); }
  };
}

if (reduceMotion()) document.documentElement.classList.add('reduce');
boot();
