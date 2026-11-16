// Shared helpers for every page.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function money(v, currency = 'PKR') {
  const n = Math.round(Number(v) || 0);
  if (currency === 'PKR') return 'Rs ' + n.toLocaleString('en-PK');
  try { return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `${currency} ${n.toLocaleString('en-PK')}`; }
}
export const compact = v => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v) || 0);
export const pct = (v, d = 1) => `${(Number(v) * 100).toFixed(d)}%`;

// Fetch wrapper for the console API: JSON in/out, CSRF header, typed errors.
export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), 'X-Forme-Request': '1', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data?.error?.message || `Request failed (${res.status})`); e.status = res.status; e.code = data?.error?.code; e.details = data?.error?.details; throw e; }
  return data;
}

export function toast(message, type = '') {
  let wrap = $('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite'); document.body.append(wrap); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  wrap.append(t);
  setTimeout(() => { t.style.transition = 'opacity .4s, transform .4s'; t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 400); }, 2800);
}

export function reveal(root = document) {
  const els = $$('[data-reveal]:not(.in)', root);
  if (!('IntersectionObserver' in window) || reduceMotion()) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach(e => io.observe(e));
}

// Animate a number into an element. format: fn(value) -> string
export function countUp(el, to, { from = 0, duration = 1400, format = v => Math.round(v).toLocaleString('en-PK') } = {}) {
  if (reduceMotion()) { el.textContent = format(to); return; }
  const start = performance.now();
  const tick = now => {
    const p = Math.min(1, (now - start) / duration);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = format(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Count up when the element scrolls into view.
export function countOnView(root = document) {
  const els = $$('[data-count]', root);
  const run = el => {
    const to = Number(el.dataset.count);
    const fmt = el.dataset.format;
    const format = fmt === 'pct' ? v => `${v.toFixed(0)}%` : fmt === 'money' ? v => money(v) : fmt === 'compact' ? v => compact(v) : fmt === 'dec1' ? v => v.toFixed(1) : undefined;
    countUp(el, to, format ? { format } : {});
  };
  if (!('IntersectionObserver' in window)) return els.forEach(run);
  const io = new IntersectionObserver(entries => { for (const e of entries) if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }, { threshold: 0.4 });
  els.forEach(e => io.observe(e));
}

// Subtle 3D tilt that follows the pointer.
export function tilt(el, max = 8) {
  if (reduceMotion() || matchMedia('(hover: none)').matches) return;
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * max}deg) rotateX(${-y * max}deg) translateZ(0)`;
    el.style.setProperty('--mx', `${(x + 0.5) * 100}%`); el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
  });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}

// Buttons drift slightly toward the cursor.
export function magnetic(el, strength = 0.25) {
  if (reduceMotion() || matchMedia('(hover: none)').matches) return;
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
  });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
  catch { toast('Copy failed. Select the text and copy it manually.', 'err'); }
}

// Confidence ring as SVG; animate by toggling the --p variable.
export function ring(value, size = 120, stroke = 10, color = 'var(--pink)') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(18,18,18,.1)" stroke-width="${stroke}"/>
  <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-target="${c * (1 - value / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1)"/></svg>`;
}
export function animateRings(root = document) {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.ring-fg', root).forEach(c => { c.style.strokeDashoffset = c.dataset.target; })));
}
