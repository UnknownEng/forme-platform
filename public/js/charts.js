// Shared SVG charts for the console and admin panel.
import { $, compact } from './ui.js';

export function areaChart(el, series, keys) {
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
    tip.innerHTML = `<b>${new Date(d.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}</b>${keys.map(k => `<div><i style="background:${k.color}"></i>${k.label}<span style="margin-left:auto;font-family:var(--mono)">${d[k.key]}</span></div>`).join('')}`;
  };
  el.onpointerleave = () => { tip.style.opacity = 0; $('#hl', el).setAttribute('opacity', 0); keys.forEach(k => $(`#hd-${k.key}`, el).setAttribute('opacity', 0)); };
}
export function spark(values, color) {
  if (!values.length) return '';
  const max = Math.max(1, ...values), W = 120, H = 40;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * W},${H - (v / max) * (H - 4)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/><polygon points="0,${H} ${pts} ${W},${H}" fill="${color}" opacity=".12"/></svg>`;
}
