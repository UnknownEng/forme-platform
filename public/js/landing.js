import { $, $$, esc, money, compact, reveal, countOnView, countUp, tilt, magnetic, copyText, ring, animateRings, reduceMotion } from './ui.js';
import { artBox } from './art.js';

/* ---------- Ambient "measurement threads" canvas ---------- */
function threads() {
  const c = $('#threads');
  const ctx = c.getContext('2d');
  let w, h, dpr, pts = [];
  const mouse = { x: -9999, y: -9999 };
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr;
    const n = Math.round(Math.min(90, (innerWidth * innerHeight) / 18000));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25 * dpr, vy: (Math.random() - 0.5) * 0.25 * dpr }));
  };
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', e => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });
  const link = 150 * (devicePixelRatio || 1);
  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
      if (d < 180 * dpr) { p.x -= dx * 0.004; p.y -= dy * 0.004; }
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link) { ctx.strokeStyle = `rgba(212,243,107,${(1 - d / link) * 0.16})`; ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      ctx.fillStyle = 'rgba(212,243,107,.5)';
      ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 1.3 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(frame);
  };
  if (!reduceMotion()) frame();
}

/* ---------- Nav ---------- */
function nav() {
  const n = $('#nav');
  const onScroll = () => n.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const b = $('.burger');
  b.addEventListener('click', () => { const open = n.classList.toggle('open'); b.setAttribute('aria-expanded', String(open)); });
  $$('.nav-links a').forEach(a => a.addEventListener('click', () => n.classList.remove('open')));
}

/* ---------- Hero stage: flying garments + cycling widget ---------- */
const HERO_SAMPLES = [
  { name: 'Everyday Cotton Tee', cat: 'T-shirts', color: 0, size: 'M', conf: 94, notes: [['Chest', 'ideal'], ['Shoulders', 'ideal'], ['Length', 'ideal']] },
  { name: 'Straight Selvedge Jeans', cat: 'Jeans', color: 7, size: '32', conf: 91, notes: [['Waist', 'ideal'], ['Hips', 'ideal'], ['Inseam', 'long']] },
  { name: 'Linen Midi Dress', cat: 'Dresses', color: 1, size: 'S', conf: 88, notes: [['Bust', 'ideal'], ['Waist', 'ideal'], ['Hips', 'roomy']] },
  { name: 'Loopback Hoodie', cat: 'Hoodies', color: 5, size: 'L', conf: 90, notes: [['Chest', 'roomy'], ['Shoulders', 'ideal'], ['Length', 'ideal']] },
  { name: 'Canvas Chore Jacket', cat: 'Jackets', color: 6, size: 'M', conf: 86, notes: [['Chest', 'ideal'], ['Waist', 'ideal'], ['Length', 'short']] },
];

function stage() {
  const s = $('#stage');
  $('.f1').innerHTML = artBox('Shirts', 3);
  $('.f2').innerHTML = artBox('Jeans', 7);
  $('.f3').innerHTML = artBox('Dresses', 4);
  $('.f4').innerHTML = artBox('Hoodies', 2);

  let i = 0;
  const show = () => {
    const x = HERO_SAMPLES[i % HERO_SAMPLES.length];
    $('#phone-art').innerHTML = artBox(x.cat, x.color);
    $('#phone-name').textContent = x.name;
    $('#phone-ring').innerHTML = ring(x.conf, 96, 9);
    countUp($('#phone-conf'), x.conf, { duration: 1100, format: v => `${Math.round(v)}%` });
    $('#phone-size').textContent = x.size; $('#phone-size-2').textContent = x.size;
    $('#phone-notes').innerHTML = x.notes.map(([a, f]) => `<div><span>${a}</span><em class="${f}">${f}</em></div>`).join('');
    animateRings($('#stage'));
    i++;
  };
  show();
  if (!reduceMotion()) setInterval(show, 3200);

  // Parallax: layers move by their depth with the pointer.
  if (reduceMotion() || matchMedia('(hover: none)').matches) return;
  const layers = $$('[data-depth]', s);
  addEventListener('pointermove', e => {
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    for (const l of layers) {
      const d = Number(l.dataset.depth);
      const target = l.classList.contains('phone') ? l : l.firstElementChild;
      if (!target) continue;
      if (l.classList.contains('phone')) l.style.transform = `translate(calc(-50% + ${x * d}px), calc(-50% + ${y * d}px)) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
      else target.style.transform = `translate(${x * d}px, ${y * d}px) rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`;
    }
  });
}

/* ---------- Live engine demo ---------- */
async function liveDemo() {
  let cfg;
  try { cfg = await (await fetch('/demo-config.json')).json(); } catch { cfg = null; }
  if (!cfg?.publicKey) { $('#demo-label').textContent = 'Demo workspace not installed'; return; }
  const products = ['NL-TEE-01', 'NL-OXF-03', 'NL-HOD-06', 'NL-JNS-08', 'NL-DRS-10'].map(s => cfg.products.find(p => p.sku === s)).filter(Boolean);
  let current = products[0];
  const state = { fit: 'Regular', build: 'Average' };
  $('#prod-pick').innerHTML = products.map((p, i) => `<button class="${i ? '' : 'on'}" data-sku="${esc(p.sku)}" aria-label="${esc(p.name)}" title="${esc(p.name)}">${artBox(p.category, p.color)}</button>`).join('');

  const fill = el => el.style.setProperty('--fill', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
  let timer, seq = 0;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const my = ++seq;
      const body = { sku: current.sku, profile: { height: Number($('#height').value), weight: Number($('#weight').value), fit: state.fit, build: state.build } };
      try {
        const res = await fetch('/v1/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.publicKey}` }, body: JSON.stringify(body) });
        const r = await res.json();
        if (my !== seq) return;
        if (!res.ok) throw new Error(r.error?.message);
        $('#demo-ring').innerHTML = ring(r.confidence, 140, 12);
        animateRings($('#demo'));
        $('#demo-size').textContent = r.size;
        $('#demo-conf').textContent = `${r.confidence}%`;
        $('#demo-label').textContent = r.label;
        $('#demo-alt').textContent = r.alternative ? `Alternative: ${r.alternative.size}. ${r.alternative.reason}` : r.estimated.length ? 'Estimated from height and weight. Add measurements for more precision.' : '';
        $('#demo-notes').innerHTML = r.fit_notes.map(n => `<span class="note ${n.fit}"><b>${n.area}</b><em>${n.fit}</em><span class="muted mono">${n.delta_cm > 0 ? '+' : ''}${n.delta_cm}cm</span></span>`).join('');
        $('#demo-json').textContent = JSON.stringify(r, null, 2);
      } catch (e) { $('#demo-label').textContent = e.message || 'Could not reach the API'; }
    }, 160);
  };
  const setArt = () => { $('#demo-art').innerHTML = artBox(current.category, current.color); };
  setArt();
  for (const id of ['height', 'weight']) {
    const el = $('#' + id); fill(el);
    el.addEventListener('input', () => { $('#v-' + id).textContent = el.value; fill(el); run(); });
  }
  for (const id of ['fit', 'build']) {
    $('#' + id).addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b));
      state[id] = b.dataset.v; run();
    });
  }
  $('#prod-pick').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#prod-pick button').forEach(x => x.classList.toggle('on', x === b));
    current = products.find(p => p.sku === b.dataset.sku); setArt(); run();
  });
  run();
}

/* ---------- ROI calculator ---------- */
function roi() {
  const f = $('#roi-form');
  let scenario = 0.25, last = 0;
  const bars = $('#roi-bars');
  bars.innerHTML = Array.from({ length: 12 }, (_, i) => `<i style="--dl:${i * 40}ms"></i>`).join('');
  const calc = () => {
    const v = Object.fromEntries([...new FormData(f)].map(([k, x]) => [k, Number(x)]));
    $$('input[type=range]', f).forEach(el => el.style.setProperty('--fill', `${((el.value - el.min) / (el.max - el.min)) * 100}%`));
    $('#r-orders-v').textContent = compact(v.orders);
    $('#r-aov-v').textContent = money(v.aov);
    $('#r-rate-v').textContent = `${v.rate}%`;
    $('#r-size-v').textContent = `${v.size}%`;
    $('#r-cost-v').textContent = money(v.cost);
    const sizeReturns = v.orders * (v.rate / 100) * (v.size / 100);
    const avoided = sizeReturns * scenario;
    const monthly = avoided * v.cost;
    const kept = avoided * 0.5 * v.aov;
    const yearly = monthly * 12;
    countUp($('#roi-year'), yearly, { from: last, duration: 900, format: x => money(x) });
    last = yearly;
    $('#roi-returns').textContent = compact(avoided);
    $('#roi-month').textContent = money(monthly);
    $('#roi-kept').textContent = money(kept);
    // Ramp-up curve over the first year of rollout.
    $$('i', bars).forEach((b, i) => { b.style.setProperty('--h', `${Math.min(100, 18 + (1 - Math.exp(-(i + 1) / 3.2)) * 82)}%`); });
  };
  f.addEventListener('input', calc);
  $('#r-scenario').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#r-scenario button').forEach(x => x.classList.toggle('on', x === b));
    scenario = Number(b.dataset.v); calc();
  });
  calc();
}

/* ---------- Code samples with typing effect ---------- */
const CODE = {
  widget: `<span class="c">&lt;!-- 1. Load the widget once, anywhere on the page --&gt;</span>
<span class="k">&lt;script</span> <span class="n">src</span>=<span class="s">"https://cdn.forme.fit/widget.js"</span>
        <span class="n">data-key</span>=<span class="s">"pk_live_…"</span> <span class="n">async</span><span class="k">&gt;&lt;/script&gt;</span>

<span class="c">&lt;!-- 2. Put a placeholder next to your size picker --&gt;</span>
<span class="k">&lt;div</span> <span class="n">data-forme-sku</span>=<span class="s">"NL-TEE-01"</span><span class="k">&gt;&lt;/div&gt;</span>

<span class="c">&lt;!-- 3. Hook the chosen size into your cart --&gt;</span>
<span class="k">&lt;script&gt;</span>
  document.addEventListener(<span class="s">'forme:size-selected'</span>, e =&gt; {
    selectSize(e.detail.size);   <span class="c">// your existing function</span>
  });
<span class="k">&lt;/script&gt;</span>`,
  rest: `<span class="c"># Server-side or app call</span>
curl -X POST https://api.forme.fit/v1/recommend \\
  -H <span class="s">"Authorization: Bearer sk_live_…"</span> \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{
    "sku": "NL-TEE-01",
    "profile": { "height": 178, "weight": 76, "fit": "Regular" }
  }'</span>

<span class="c"># → 200 OK</span>
{ <span class="n">"size"</span>: <span class="s">"L"</span>, <span class="n">"confidence"</span>: <span class="s">82</span>, <span class="n">"label"</span>: <span class="s">"Good match"</span>,
  <span class="n">"alternative"</span>: { <span class="n">"size"</span>: <span class="s">"XL"</span>, … },
  <span class="n">"fit_notes"</span>: [ { <span class="n">"area"</span>: <span class="s">"chest"</span>, <span class="n">"fit"</span>: <span class="s">"ideal"</span> }, … ] }`,
  feedback: `<span class="c">// Send outcomes from your returns system.</span>
<span class="c">// Forme recalibrates products that run small or large.</span>
<span class="k">await</span> fetch(<span class="s">'https://api.forme.fit/v1/feedback'</span>, {
  method: <span class="s">'POST'</span>,
  headers: {
    Authorization: <span class="s">\`Bearer \${process.env.FORME_SECRET}\`</span>,
    <span class="s">'Content-Type'</span>: <span class="s">'application/json'</span>,
  },
  body: JSON.stringify({
    sku: <span class="s">'NL-OXF-03'</span>,
    size: <span class="s">'M'</span>,
    outcome: <span class="s">'too_small'</span>,   <span class="c">// kept | too_small | too_large | returned_other</span>
    rec_id: order.formeRecId,
  }),
});`,
};
function code() {
  const pre = $('#code-body');
  let tab = 'widget', typing;
  const plain = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };
  const type = () => {
    clearInterval(typing);
    const html = CODE[tab];
    if (reduceMotion()) { pre.innerHTML = html; return; }
    // Reveal the highlighted HTML progressively, never splitting a tag or entity.
    let i = 0;
    typing = setInterval(() => {
      i += 6;
      while (i < html.length && (html.lastIndexOf('<', i) > html.lastIndexOf('>', i) || html.lastIndexOf('&', i) > html.lastIndexOf(';', i))) i++;
      pre.innerHTML = html.slice(0, i) + (i < html.length ? '<span class="caret"></span>' : '');
      if (i >= html.length) clearInterval(typing);
    }, 16);
  };
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { type(); io.disconnect(); } }, { threshold: 0.3 });
  io.observe(pre);
  $('.code-tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    $$('.code-tabs [data-tab]').forEach(x => x.classList.toggle('on', x === b));
    tab = b.dataset.tab; type();
  });
  $('#copy-code').addEventListener('click', () => copyText(plain(CODE[tab])));
}

threads();
nav();
stage();
reveal();
countOnView();
liveDemo();
roi();
code();
$$('.tiltable').forEach(t => tilt(t, 5));
$$('.magnet').forEach(b => magnetic(b, 0.18));
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
