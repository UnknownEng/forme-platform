import { $, $$, esc, money, compact, reveal, countOnView, countUp, tilt, magnetic, copyText, ring, animateRings, reduceMotion } from './ui.js';
import { artBox } from './art.js';

/* ---------- Floating confetti: shapes drift and dodge the cursor ---------- */
function threads() {
  const c = $('#threads');
  const ctx = c.getContext('2d');
  const COLORS = ['#c6ff3d', '#ff5ca8', '#3d5afe', '#ffd43b', '#ff7a2f', '#12b76a'];
  let w, h, dpr, bits = [];
  const mouse = { x: -9999, y: -9999 };
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr;
    const n = Math.round(Math.min(34, (innerWidth * innerHeight) / 40000));
    bits = Array.from({ length: n }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .3 * dpr, vy: (-.15 - Math.random() * .35) * dpr,
      r: (6 + Math.random() * 9) * dpr, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .02, color: COLORS[i % COLORS.length], kind: i % 4 }));
  };
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', e => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });
  const draw = b => {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
    ctx.fillStyle = b.color; ctx.strokeStyle = '#121212'; ctx.lineWidth = 2 * dpr; ctx.beginPath();
    if (b.kind === 0) ctx.arc(0, 0, b.r * .7, 0, Math.PI * 2);
    else if (b.kind === 1) ctx.rect(-b.r * .7, -b.r * .7, b.r * 1.4, b.r * 1.4);
    else if (b.kind === 2) { ctx.moveTo(0, -b.r); ctx.lineTo(b.r * .9, b.r * .7); ctx.lineTo(-b.r * .9, b.r * .7); ctx.closePath(); }
    else { for (let k = 0; k < 10; k++) { const rr = k % 2 ? b.r * .45 : b.r; const a = (k / 10) * Math.PI * 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
    ctx.fill(); ctx.stroke(); ctx.restore();
  };
  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    for (const b of bits) {
      const dx = b.x - mouse.x, dy = b.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 140 * dpr) { b.x += (dx / d) * 4 * dpr; b.y += (dy / d) * 4 * dpr; b.vr += .004; }
      b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.vr *= .995;
      if (b.y < -40 * dpr) { b.y = h + 40 * dpr; b.x = Math.random() * w; }
      if (b.x < -40 * dpr) b.x = w + 30 * dpr; else if (b.x > w + 40 * dpr) b.x = -30 * dpr;
      ctx.globalAlpha = .55; draw(b);
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
  { name: 'Everyday Cotton Tee', cat: 'T-shirts', color: 0, size: 'M', conf: 86, notes: [['Chest', 'ideal'], ['Shoulders', 'ideal'], ['Length', 'ideal']] },
  { name: 'Straight Selvedge Jeans', cat: 'Jeans', color: 7, size: '32', conf: 91, notes: [['Waist', 'ideal'], ['Hips', 'ideal'], ['Inseam', 'long']] },
  { name: 'Lawn Printed Kurta', cat: 'Kurtas', color: 1, size: 'S', conf: 89, notes: [['Chest', 'ideal'], ['Shoulders', 'ideal'], ['Length', 'long']] },
  { name: 'Loopback Hoodie', cat: 'Hoodies', color: 5, size: 'L', conf: 90, notes: [['Chest', 'roomy'], ['Shoulders', 'ideal'], ['Length', 'ideal']] },
  { name: 'Cotton Shalwar Kameez', cat: 'Shalwar Kameez', color: 6, size: 'L', conf: 87, notes: [['Chest', 'ideal'], ['Waist', 'roomy'], ['Length', 'ideal']] },
];

function stage() {
  const s = $('#stage');
  $('.f1').innerHTML = artBox('Shirts', 3);
  $('.f2').innerHTML = artBox('Jeans', 7);
  $('.f3').innerHTML = artBox('Kurtas', 4);
  $('.f4').innerHTML = artBox('Hoodies', 2);

  let i = 0;
  const show = () => {
    const x = HERO_SAMPLES[i % HERO_SAMPLES.length];
    $('#phone-art').innerHTML = artBox(x.cat, x.color);
    $('#phone-name').textContent = x.name;
    $('#phone-ring').innerHTML = ring(x.conf, 96, 10);
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
  const products = ['NL-TEE-01', 'NL-KRT-11', 'NL-SKZ-12', 'NL-JNS-08', 'NL-DRS-10'].map(s => cfg.products.find(p => p.sku === s)).filter(Boolean);
  let current = products[0];
  const state = { fit: 'Regular', build: 'Average', sex: 'male' };
  $('#prod-pick').innerHTML = products.map((p, i) => `<button class="${i ? '' : 'on'}" data-sku="${esc(p.sku)}" aria-label="${esc(p.name)}" title="${esc(p.name)}">${artBox(p.category, p.color)}</button>`).join('');

  const fill = el => el.style.setProperty('--fill', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
  let timer, seq = 0;
  const run = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const my = ++seq;
      const body = { sku: current.sku, profile: { height: Number($('#height').value), weight: Number($('#weight').value), fit: state.fit, build: state.build, sex: state.sex } };
      try {
        const res = await fetch('/v1/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.publicKey}` }, body: JSON.stringify(body) });
        const r = await res.json();
        if (my !== seq) return;
        if (!res.ok) throw new Error(r.error?.message);
        $('#demo-ring').innerHTML = ring(r.confidence, 140, 14);
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
  for (const id of ['fit', 'build', 'sex']) {
    $('#' + id).addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b));
      state[id] = b.dataset.v; run();
    });
  }
  $('#prod-pick').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#prod-pick button').forEach(x => x.classList.toggle('on', x === b));
    current = products.find(p => p.sku === b.dataset.sku);
    const want = ['Kurtas', 'Dresses'].includes(current.category) ? 'female' : current.category === 'Shalwar Kameez' ? 'male' : state.sex;
    if (want !== state.sex) { state.sex = want; $$('#sex button').forEach(x => x.classList.toggle('on', x.dataset.v === want)); }
    setArt(); run();
  });
  run();
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
code();
$$('.tiltable').forEach(t => tilt(t, 5));
$$('.magnet').forEach(b => magnetic(b, 0.18));
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
