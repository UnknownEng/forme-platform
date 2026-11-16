import { $, $$, esc, money, compact, reveal, countOnView, countUp, tilt, magnetic, copyText, ring, animateRings, reduceMotion } from './ui.js';
import { artBox } from './art.js';

/* ---------- Dynamic nav ---------- */
// Shrinks once you scroll, hides while scrolling down and returns on the way up,
// shows reading progress, and slides a highlight to the section you're on.
function nav() {
  const n = $('#nav');
  const bar = $('#progress');
  const links = $$('.nav-links a[href^="#"]');
  const ind = $('.nav-ind');
  let lastY = scrollY, ticking = false;
  const onScroll = () => {
    const y = scrollY;
    n.classList.toggle('scrolled', y > 40);
    if (!n.classList.contains('open')) n.classList.toggle('hidden', y > 300 && y > lastY + 4);
    if (y < lastY - 4) n.classList.remove('hidden');
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const moveTo = a => {
    links.forEach(x => x.classList.toggle('on', x === a));
    if (!a) { ind.style.opacity = 0; return; }
    ind.style.opacity = 1;
    ind.style.width = `${a.offsetWidth}px`;
    ind.style.transform = `translateX(${a.offsetLeft}px)`;
  };
  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const visible = new Map();
    const io = new IntersectionObserver(entries => {
      for (const e of entries) visible.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
      let best = null, ratio = 0;
      for (const [el, r] of visible) if (r > ratio) { ratio = r; best = el; }
      moveTo(best ? links.find(a => a.getAttribute('href') === '#' + best.id) : null);
    }, { threshold: [0.15, 0.35, 0.6], rootMargin: '-20% 0px -40% 0px' });
    sections.forEach(s => io.observe(s));
  }
  // Hovering previews the highlight; leaving returns it to the active section.
  links.forEach(a => a.addEventListener('pointerenter', () => { ind.style.opacity = 1; ind.style.width = `${a.offsetWidth}px`; ind.style.transform = `translateX(${a.offsetLeft}px)`; }));
  $('.nav-links').addEventListener('pointerleave', () => moveTo(links.find(a => a.classList.contains('on')) || null));

  const b = $('.burger');
  b.addEventListener('click', () => { const open = n.classList.toggle('open'); n.classList.remove('hidden'); b.setAttribute('aria-expanded', String(open)); });
  $$('.nav-links a').forEach(a => a.addEventListener('click', () => { n.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); }));
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
    $('#phone-ring').innerHTML = ring(x.conf, 96, 8, 'var(--blue)');
    $('#phone-conf').textContent = x.conf >= 88 ? 'very likely' : x.conf >= 74 ? 'likely' : 'check chart';
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
        $('#demo-ring').innerHTML = ring(r.confidence, 140, 10, 'var(--blue)');
        animateRings($('#demo'));
        $('#demo-size').textContent = r.size;
        $('#demo-conf').textContent = r.confidence >= 88 ? 'very likely' : r.confidence >= 74 ? 'likely' : r.confidence >= 58 ? 'check chart' : 'not sure';
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

nav();
stage();
reveal();
countOnView();
liveDemo();
$$('.tiltable').forEach(t => tilt(t, 2));
$$('.magnet').forEach(b => magnetic(b, 0.12));
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
