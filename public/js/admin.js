import { $, $$, esc, money, compact, api, toast, countUp, ring, animateRings } from './ui.js';
import { areaChart } from './charts.js';

const root = $('#root');
const layer = $('#layer');
const VIEWS = [
  ['overview', '◈', 'Overview'],
  ['merchants', '▦', 'Merchants'],
  ['engine', '✦', 'Engine playground'],
  ['activity', '◌', 'Live activity'],
  ['audit', '☰', 'Audit log'],
  ['system', '⚙', 'System health'],
];
const S = { view: 'overview', poll: null };
const ago = t => { if (!t) return 'never'; const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };
const date = t => new Date(t).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });

async function boot() {
  const st = await api('/api/admin/status').catch(() => ({ enabled: false }));
  if (!st.enabled) return disabledScreen();
  try { await api('/api/admin/me'); shell(); } catch { login(); }
}

function disabledScreen() {
  root.innerHTML = `<div class="admin-login"><div class="auth-card glass"><div class="lock">🔒</div><h2>Admin is not configured</h2>
    <p class="muted" style="font-size:14px">Set an environment variable <code class="mono">FORME_ADMIN_PASSWORD</code> (at least 12 characters) and redeploy. On Vercel: Project → Settings → Environment Variables.</p>
    <a class="btn ghost" href="/" style="margin-top:16px">Back to site</a></div></div>`;
}

function login() {
  root.innerHTML = `<div class="admin-login"><div class="auth-card glass"><div class="lock">🔒</div><span class="admin-badge">OWNER ONLY</span>
    <h2>Forme admin</h2><p class="muted" style="margin:0;font-size:14px">Platform control panel. Every action is recorded in the audit log.</p>
    <form id="lf" novalidate><div class="field"><label for="pw">Admin password</label><input class="input" id="pw" type="password" autocomplete="current-password" required autofocus></div>
    <div class="err-msg" id="le" role="alert"></div><button class="btn" type="submit">Sign in <span class="arrow">→</span></button></form></div></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const b = $('button', e.target); b.disabled = true;
    try { await api('/api/admin/login', { method: 'POST', body: { password: $('#pw').value } }); shell(); }
    catch (err) { $('#le').textContent = err.message; b.disabled = false; $('#pw').select(); }
  };
}

function shell() {
  const v = location.hash.slice(1);
  if (VIEWS.some(x => x[0] === v)) S.view = v;
  const nav = VIEWS.map(([k, i, l]) => `<a class="nav-item" data-v="${k}" href="#${k}"><i>${i}</i>${l}</a>`).join('');
  root.innerHTML = `<div class="shell"><aside class="side"><a href="/" class="logo"><span class="logo-mark"><span>f</span></span>forme</a><span class="admin-badge">ADMIN</span>
    <div class="side-label">PLATFORM</div>${nav}<div class="side-spacer"></div>
    <div class="side-card"><b>Owner session</b>Signed in for 8 hours. Actions are audited.</div>
    <div class="me"><div class="avatar" style="background:linear-gradient(135deg,var(--coral),var(--violet))">A</div><div><b>Platform owner</b><small>forme admin</small></div><button class="icon-btn" id="logout" title="Sign out" aria-label="Sign out">⏻</button></div></aside>
    <div class="main"><header class="top"><h1 id="title"></h1><span class="live"><i></i>Live</span><button class="btn ghost small" id="refresh">Refresh</button></header><div id="view"></div></div>
    <nav class="mobile-nav">${nav}</nav></div>`;
  $('#logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); login(); };
  $('#refresh').onclick = render;
  render();
}
addEventListener('hashchange', () => { const v = location.hash.slice(1); if ($('.shell') && VIEWS.some(x => x[0] === v)) { S.view = v; render(); } });

function render() {
  clearInterval(S.poll);
  $$('.nav-item').forEach(a => a.classList.toggle('on', a.dataset.v === S.view));
  $('#title').textContent = VIEWS.find(x => x[0] === S.view)[2];
  const view = $('#view'); view.className = 'view'; void view.offsetWidth; view.className = 'view';
  view.innerHTML = '<div class="skeleton"></div>';
  ({ overview, merchants, engine, activity, audit, system })[S.view]().catch(e => {
    if (e.status === 401) return login();
    view.innerHTML = `<div class="empty"><b>Could not load</b>${esc(e.message)}</div>`;
  });
}

/* ---------- Overview ---------- */
async function overview() {
  const d = await api('/api/admin/overview');
  const t = d.totals, s = d.system;
  const k = [['Merchants', t.merchants, `${t.active_30d} active in 30d`], ['Products', t.products, 'with size charts'], ['Shopper profiles', t.profiles, 'portable profiles'],
    ['Recommendations', t.recommendations, `${compact(t.recommendations_24h)} in 24h`], ['Events (24h)', t.events_24h, `${compact(t.feedback)} feedback total`]];
  const warn = [];
  if (!s.secret_configured && s.on_vercel) warn.push('FORME_SECRET is not set: console logins will fail at random.');
  if (!s.persistent_storage) warn.push('Running on temporary storage: sign-ups and events can be lost when Vercel recycles a server. Move to Postgres before real customers.');
  $('#view').innerHTML = `${warn.map(w => `<div class="notice" style="background:rgba(255,138,107,.08);border-color:rgba(255,138,107,.3)"><b style="color:var(--coral)">Heads up.</b> ${esc(w)}</div>`).join('')}
    <div class="grid kpis k5">${k.map(([l, v, sub], i) => `<div class="kpi glass" style="--i:${i}"><span>${l}</span><b data-v="${v}">0</b><span class="chg flat">${esc(sub)}</span></div>`).join('')}</div>
    <div class="grid row-2" style="margin-top:16px">
      <section class="card glass"><div class="card-head"><div><h2>Platform recommendations</h2><p>All merchants, last 30 days</p></div></div><div class="chart" id="ch"></div></section>
      <section class="card glass" style="--d:.1s"><div class="card-head"><div><h2>Top merchants</h2><p>By recommendations, 30 days</p></div><a class="btn ghost small" href="#merchants">All</a></div>
        <div class="table-wrap"><table><tbody>${d.top_merchants.map((m, i) => `<tr style="--i:${i}"><td><b>${esc(m.name)}</b><br><small class="muted">${esc(m.plan)}</small></td><td style="text-align:right" class="mono">${compact(m.recs)}</td><td style="text-align:right"><button class="btn ghost small" data-open="${esc(m.id)}">Open</button></td></tr>`).join('') || '<tr><td class="empty">No merchants yet</td></tr>'}</tbody></table></div></section>
    </div>
    <section class="card glass" style="margin-top:16px;--d:.15s"><div class="card-head"><div><h2>This server instance</h2><p>Each Vercel function instance reports its own numbers.</p></div><a class="btn ghost small" href="#system">Health checks</a></div>
      <div class="sys-grid">${[['Engine', s.engine_version], ['Node', s.node], ['Instance', s.instance], ['Uptime', `${Math.round(s.uptime_s / 60)} min`], ['Memory', `${s.memory_mb} MB`], ['Database', `${s.db_mb} MB`], ['Hosting', s.on_vercel ? 'Vercel' : 'Server'], ['Storage', s.persistent_storage ? 'Persistent' : 'Temporary']].map(([a, b]) => `<div><span>${a}</span><b>${esc(b)}</b></div>`).join('')}</div></section>`;
  $$('.kpi b').forEach(b => countUp(b, Number(b.dataset.v), { format: v => compact(v) }));
  areaChart($('#ch'), d.series, [{ key: 'recs', color: '#ff5ca8', label: 'Recommendations' }]);
  $('#view').onclick = e => { const b = e.target.closest('[data-open]'); if (b) merchantDrawer(b.dataset.open); };
}

/* ---------- Merchants ---------- */
async function merchants() {
  $('#view').innerHTML = `<div class="toolbar"><label class="search"><input class="input" id="mq" placeholder="Search name or email" aria-label="Search merchants"></label><span class="grow"></span></div>
    <section class="card glass"><div class="table-wrap"><table><thead><tr><th>Merchant</th><th>Plan</th><th>Products</th><th>Recs 30d</th><th>Keys</th><th>Last activity</th><th>Status</th><th></th></tr></thead><tbody id="mrows"></tbody></table></div></section>`;
  const load = async () => {
    const d = await api(`/api/admin/merchants?q=${encodeURIComponent($('#mq').value)}`);
    $('#mrows').innerHTML = d.merchants.map((m, i) => `<tr style="--i:${i}"><td><b>${esc(m.name)}</b><br><small class="muted mono">${esc(m.email)}</small></td><td><span class="pill ${m.plan === 'enterprise' ? 'violet' : m.plan === 'growth' ? 'lime' : ''}">${esc(m.plan)}</span></td>
      <td class="mono">${m.products}</td><td class="mono">${compact(m.recs_30d)}</td><td class="mono">${m.keys}</td><td class="muted" style="font-size:13px">${ago(m.last_event)}</td>
      <td>${m.suspended_at ? '<span class="pill coral">Suspended</span>' : '<span class="pill mint">Active</span>'}</td><td><button class="btn ghost small" data-open="${esc(m.id)}">Manage</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No merchants match.</td></tr>';
  };
  let t; $('#mq').oninput = () => { clearTimeout(t); t = setTimeout(load, 200); };
  $('#mrows').onclick = e => { const b = e.target.closest('[data-open]'); if (b) merchantDrawer(b.dataset.open, load); };
  await load();
}

function closeLayer() { const d = $('.drawer', layer); if (d) { d.classList.add('closing'); setTimeout(() => { layer.innerHTML = ''; }, 280); } else layer.innerHTML = ''; }
function confirmBox(title, text, cta) {
  return new Promise(res => {
    const prev = layer.innerHTML;
    const box = document.createElement('div');
    box.innerHTML = `<div class="scrim" style="z-index:96"></div><div class="modal glass" style="z-index:97" role="alertdialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="foot"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">${esc(cta)}</button></div></div>`;
    layer.append(box);
    box.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a || (e.target.classList.contains('scrim') ? 'no' : null); if (!a) return; box.remove(); res(a === 'yes'); };
    void prev;
  });
}

async function merchantDrawer(id, onChange) {
  const d = await api(`/api/admin/merchants/${encodeURIComponent(id)}`);
  const m = d.merchant, k = d.analytics.kpis;
  layer.innerHTML = `<div class="scrim"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="md-t">
    <div class="drawer-head"><div><h2 id="md-t">${esc(m.name)}</h2><small class="muted mono">${esc(m.email)} · ${esc(m.id)}</small></div><button class="icon-btn" id="md-x" aria-label="Close">✕</button></div>
    <div class="drawer-body single">
      <div class="detail-grid"><div><span>Recommendations (30d)</span><b>${compact(k.recommendations.value)}</b></div><div><span>Add-to-cart rate</span><b>${(k.add_to_cart_rate.value * 100).toFixed(1)}%</b></div><div><span>Influenced revenue</span><b>${money(k.influenced_revenue.value, m.currency)}</b></div>
        <div><span>Products</span><b>${d.products.length}${d.products.length === 50 ? '+' : ''}</b></div><div><span>Joined</span><b style="font-size:15px">${date(m.created_at)}</b></div><div><span>Status</span><b style="font-size:15px">${m.suspended_at ? `Suspended ${ago(m.suspended_at)}` : 'Active'}</b></div></div>
      <div class="form-2"><div class="field"><label for="md-plan">Plan</label><select class="select" id="md-plan">${['starter', 'growth', 'enterprise'].map(p => `<option ${p === m.plan ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
        <div class="field"><span class="label">Support</span><button class="btn ghost" id="md-imp" ${m.suspended_at ? 'disabled' : ''}>Open console as this merchant ↗</button></div></div>
      <section style="margin-top:18px"><h3 style="margin:0 0 8px;font-size:15px">API keys</h3>${d.keys.map(x => `<div class="key-row ${x.revoked_at ? 'revoked' : ''}"><span class="pill ${x.kind === 'secret' ? 'violet' : 'lime'}">${x.kind}</span><div><div class="key-val">${esc(x.prefix)}••••</div><small>${esc(x.label)} · last used ${ago(x.last_used_at)}${x.revoked_at ? ' · revoked' : ''}</small></div><span></span>${x.revoked_at ? '<span></span>' : `<button class="btn danger small" data-rk="${esc(x.id)}">Revoke</button>`}</div>`).join('') || '<p class="helper">No keys.</p>'}</section>
      <section style="margin-top:18px"><h3 style="margin:0 0 8px;font-size:15px">Recent products</h3><div class="table-wrap" style="margin:0;padding:0"><table><tbody>${d.products.slice(0, 10).map(p => `<tr><td><b>${esc(p.name)}</b><br><small class="muted mono">${esc(p.sku)}</small></td><td>${esc(p.category)}</td><td class="muted">${ago(p.updated_at)}</td></tr>`).join('') || '<tr><td class="helper">No products yet.</td></tr>'}</tbody></table></div></section>
      ${m.is_demo ? '<p class="helper" style="margin-top:18px">This is the demo workspace. It cannot be suspended or deleted.</p>' : `<div class="danger-zone"><p><b>Danger zone.</b> Suspending blocks the merchant's console login and every API key immediately. Deleting removes the merchant and all their data permanently.</p>
        <button class="btn danger small" id="md-sus">${m.suspended_at ? 'Unsuspend' : 'Suspend'}</button><button class="btn danger small" id="md-del">Delete merchant</button></div>`}
    </div></aside>`;
  const refresh = () => { onChange?.(); merchantDrawer(id, onChange); };
  $('.scrim', layer).onclick = closeLayer; $('#md-x').onclick = closeLayer;
  $('#md-plan').onchange = async e => { try { await api(`/api/admin/merchants/${id}`, { method: 'PATCH', body: { plan: e.target.value } }); toast(`Plan set to ${e.target.value}`); onChange?.(); } catch (err) { toast(err.message, 'err'); } };
  $('#md-imp').onclick = async () => {
    if (!await confirmBox('Open their console?', `You'll be signed in to ${m.name}'s console for one hour. This is recorded in the audit log.`, 'Open console')) return;
    try { const r = await api(`/api/admin/merchants/${id}/impersonate`, { method: 'POST' }); window.open(r.redirect, '_blank', 'noopener'); } catch (err) { toast(err.message, 'err'); }
  };
  $$('[data-rk]', layer).forEach(b => b.onclick = async () => {
    if (!await confirmBox('Revoke this key?', 'Any site or server using it stops working immediately.', 'Revoke')) return;
    try { await api(`/api/admin/keys/${b.dataset.rk}`, { method: 'DELETE' }); toast('Key revoked'); refresh(); } catch (err) { toast(err.message, 'err'); }
  });
  const sus = $('#md-sus');
  if (sus) sus.onclick = async () => {
    const on = !m.suspended_at;
    if (on && !await confirmBox(`Suspend ${m.name}?`, 'Their console and all API keys stop working until you unsuspend them.', 'Suspend')) return;
    try { await api(`/api/admin/merchants/${id}`, { method: 'PATCH', body: { suspended: on } }); toast(on ? 'Merchant suspended' : 'Merchant reactivated'); refresh(); } catch (err) { toast(err.message, 'err'); }
  };
  const del = $('#md-del');
  if (del) del.onclick = async () => {
    if (!await confirmBox(`Delete ${m.name} permanently?`, 'This deletes the account, products, keys, events and feedback. It cannot be undone.', 'Delete forever')) return;
    try { await api(`/api/admin/merchants/${id}`, { method: 'DELETE' }); toast('Merchant deleted'); closeLayer(); onChange?.(); } catch (err) { toast(err.message, 'err'); }
  };
}

/* ---------- Engine playground ---------- */
async function engine() {
  const { products } = await api('/api/admin/products');
  const P = { height: 175, weight: 72, chest: '', waist: '', hips: '', inseam: '', fit: 'Regular', build: 'Average' };
  $('#view').innerHTML = `<p class="muted" style="margin:0 0 16px;max-width:800px">Run the fit engine directly against any product in the platform. Nothing here is logged or counted in merchant analytics.</p>
  <div class="engine"><section class="card glass"><div class="form-grid">
    <div class="field"><label for="ep">Product</label><select class="select" id="ep">${products.map(p => `<option value="${esc(p.merchant_id)}|${esc(p.sku)}">${esc(p.merchant)} · ${esc(p.name)} (${esc(p.sku)})</option>`).join('')}</select></div>
    <div class="form-2"><div class="mini-slider"><div><span>Height</span><b class="mono"><span id="v-h">175</span> cm</b></div><input type="range" id="e-h" min="140" max="210" value="175" aria-label="Height"></div>
      <div class="mini-slider"><div><span>Weight</span><b class="mono"><span id="v-w">72</span> kg</b></div><input type="range" id="e-w" min="35" max="150" value="72" aria-label="Weight"></div></div>
    <div class="form-2">${['chest', 'waist', 'hips', 'inseam'].map(x => `<div class="field"><label for="e-${x}">${x[0].toUpperCase() + x.slice(1)} (cm, optional)</label><input class="input mono" id="e-${x}" type="number" placeholder="estimate"></div>`).join('')}</div>
    <div class="form-2"><div class="field"><span class="label">Fit preference</span><div class="seg" id="e-fit">${['Slim', 'Regular', 'Relaxed'].map(f => `<button type="button" data-v="${f}" class="${f === 'Regular' ? 'on' : ''}">${f}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Build</span><div class="seg" id="e-build">${['Slim', 'Average', 'Broad'].map(f => `<button type="button" data-v="${f}" class="${f === 'Average' ? 'on' : ''}">${f}</button>`).join('')}</div></div></div>
    <label style="display:flex;gap:10px;align-items:center;font-size:14px"><input type="checkbox" id="e-nofb"> Ignore return-feedback calibration</label>
  </div></section>
  <section class="engine-out"><div class="card glass"><div class="big-size"><div class="pv-ring" id="e-ring"></div><div><div class="demo-label" id="e-label" style="font-size:24px;font-weight:800">…</div><div class="helper" id="e-meta"></div></div></div>
    <div class="notes" id="e-notes" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"></div></div>
    <div class="card glass"><div class="card-head"><div><h2>Size chart vs. this body</h2><p id="e-body"></p></div></div><div class="table-wrap"><table class="chart-tbl" id="e-chart"></table></div></div>
    <div class="card glass"><details><summary class="mono" style="cursor:pointer;font-size:13px">Raw engine response</summary><pre class="raw" id="e-raw"></pre></details></div></section></div>`;
  let timer, seq = 0;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const my = ++seq;
      const [merchant_id, sku] = $('#ep').value.split('|');
      const profile = { height: P.height, weight: P.weight, fit: P.fit, build: P.build };
      for (const x of ['chest', 'waist', 'hips', 'inseam']) if (P[x]) profile[x] = Number(P[x]);
      try {
        const d = await api('/api/admin/engine/run', { method: 'POST', body: { merchant_id, sku, profile, ignore_feedback: $('#e-nofb').checked } });
        if (my !== seq) return;
        const r = d.result;
        $('#e-ring').innerHTML = `${ring(r.confidence, 130, 11)}<div><b>${esc(r.size)}</b><small>${r.confidence}%</small></div>`; animateRings($('#e-ring'));
        $('#e-label').textContent = r.label + (r.alternative ? ` · alt ${r.alternative.size}` : '');
        $('#e-meta').textContent = `${d.took_us} µs · calibration ${r.calibration.shift_cm > 0 ? '+' : ''}${r.calibration.shift_cm} cm from ${r.calibration.samples} outcomes · engine ${r.engine_version}`;
        $('#e-notes').innerHTML = r.fit_notes.map(n => `<span class="pill ${n.fit === 'ideal' ? 'mint' : n.fit === 'snug' || n.fit === 'short' ? 'coral' : 'violet'}">${esc(n.area)} · ${esc(n.fit)} · ${n.delta_cm > 0 ? '+' : ''}${n.delta_cm}cm</span>`).join('');
        $('#e-body').textContent = `Body used: ${Object.entries(d.body).map(([a, b]) => `${a} ${b}${d.estimated.includes(a) ? '*' : ''}`).join(' · ')}   (* estimated)`;
        const dims = ['chest', 'waist', 'hips', 'shoulders', 'length', 'inseam'].filter(x => d.chart.some(c => c[x] != null));
        $('#e-chart').innerHTML = `<thead><tr><th>Size</th>${dims.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${d.chart.map(c => `<tr class="${c.size === r.size ? 'best' : ''}"><td class="${c.size === r.size ? 'best' : ''}">${esc(c.size)}</td>${dims.map(x => `<td class="mono">${c[x] ?? '–'}</td>`).join('')}</tr>`).join('')}</tbody>`;
        $('#e-raw').textContent = JSON.stringify(d, null, 2);
      } catch (e) { if (my === seq) { $('#e-label').textContent = e.message; $('#e-ring').innerHTML = ''; } }
    }, 120);
  };
  for (const [id, key] of [['e-h', 'height'], ['e-w', 'weight']]) $('#' + id).oninput = e => { P[key] = Number(e.target.value); $(id === 'e-h' ? '#v-h' : '#v-w').textContent = e.target.value; run(); };
  for (const x of ['chest', 'waist', 'hips', 'inseam']) $('#e-' + x).oninput = e => { P[x] = e.target.value; run(); };
  for (const [id, key] of [['e-fit', 'fit'], ['e-build', 'build']]) $('#' + id).onclick = e => { const b = e.target.closest('button'); if (!b) return; P[key] = b.dataset.v; $$(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); run(); };
  $('#ep').onchange = run; $('#e-nofb').onchange = run;
  if (products.length) run(); else $('#e-label').textContent = 'No products on the platform yet';
}

/* ---------- Activity / audit / system ---------- */
const EV = { recommendation: '✦ Recommended', widget_open: '◌ Widget opened', add_to_cart: '＋ Added to cart', purchase: 'Rs  Purchase', size_selected: '✓ Size selected' };
async function activity() {
  const draw = async () => {
    const d = await api('/api/admin/activity');
    if (S.view !== 'activity') return;
    $('#view').innerHTML = `<section class="card glass"><div class="card-head"><div><h2>Every storefront, live</h2><p>Latest 60 events across all merchants. Refreshes every 5 seconds.</p></div><span class="live"><i></i></span></div>
      <div class="table-wrap"><table><thead><tr><th>Event</th><th>Merchant</th><th>Product</th><th>Size</th><th>Value</th><th>When</th></tr></thead><tbody>${d.events.map(e => `<tr><td><span class="feed-ico ev-${esc(e.type)}" style="display:inline-grid;width:auto;padding:0 10px;height:26px">${EV[e.type] || esc(e.type)}</span></td><td>${esc(e.merchant || '–')}</td><td class="mono" style="font-size:13px">${esc(e.sku || '–')}</td><td>${esc(e.size || '–')}</td><td>${e.value ? money(e.value) : '–'}</td><td class="muted" style="font-size:13px">${ago(e.created_at)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No events yet.</td></tr>'}</tbody></table></div></section>`;
  };
  await draw();
  S.poll = setInterval(() => draw().catch(() => {}), 5000);
}

async function audit() {
  const d = await api('/api/admin/audit');
  $('#view').innerHTML = `<section class="card glass"><div class="card-head"><div><h2>Admin audit log</h2><p>Every admin sign-in and change, newest first.</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th></tr></thead><tbody>${d.entries.map(a => `<tr><td style="font-size:13px">${date(a.created_at)}</td><td><span class="audit-action ${/failed|delete|suspend|revoke/.test(a.action) ? 'bad' : ''}">${esc(a.action)}</span></td><td class="mono" style="font-size:12px">${esc(a.target || '–')}</td><td class="muted" style="font-size:12px">${esc(a.detail || '')}</td><td class="mono muted" style="font-size:12px">${esc(a.ip || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No admin actions recorded yet.</td></tr>'}</tbody></table></div></section>`;
}

async function system() {
  const [h, o] = await Promise.all([api('/api/admin/health'), api('/api/admin/overview')]);
  const s = o.system;
  $('#view').innerHTML = `<div class="grid row-2"><section class="card glass"><div class="card-head"><div><h2>Self-test</h2><p>Run live against this server instance.</p></div><button class="btn small" id="rerun">Run again</button></div>
    ${h.checks.map(c => `<div class="check"><span class="status-dot ${c.ok ? 'ok' : 'bad'}"></span><div><b>${esc(c.name)}</b><small>${esc(c.detail)}</small></div><span class="mono muted" style="font-size:12px">${c.ms} ms</span></div>`).join('')}</section>
    <section class="card glass" style="--d:.08s"><div class="card-head"><div><h2>Runtime</h2></div></div><div class="sys-grid">${Object.entries(s).map(([k, v]) => `<div><span>${esc(k.replace(/_/g, ' '))}</span><b>${esc(String(v))}</b></div>`).join('')}</div>
    <p class="helper" style="margin-top:14px">Environment variables: <code>FORME_SECRET</code> (session signing), <code>FORME_ADMIN_PASSWORD</code> (this panel). Public status: <a href="/v1/health" style="color:var(--accent-ink)">/v1/health</a>.</p></section></div>`;
  $('#rerun').onclick = render;
}

boot();
