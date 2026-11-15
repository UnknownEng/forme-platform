// Sample storefront. The only Forme-specific parts are: the widget <script>,
// the data-forme-sku placeholder, the forme:size-selected listener, and
// Forme.track() calls for add-to-cart and purchase. Everything else is a
// normal shop.
import { artBox } from './art.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => '₹' + Number(v).toLocaleString('en-IN');
const GROUP = { tops: ['T-shirts', 'Shirts', 'Knitwear', 'Hoodies', 'Jackets'], bottoms: ['Jeans', 'Trousers', 'Shorts'], dresses: ['Dresses'] };
const SIZES = { 'T-shirts': 'XS S M L XL XXL', Shirts: 'XS S M L XL XXL', Knitwear: 'XS S M L XL XXL', Hoodies: 'XS S M L XL XXL', Jackets: 'XS S M L XL XXL', Jeans: '28 30 32 34 36 38', Trousers: '28 30 32 34 36 38', Dresses: 'XS S M L XL' };

let products = [];
let bag = [];
try { bag = JSON.parse(localStorage.getItem('northline_bag')) || []; } catch { bag = []; }
const saveBag = () => { try { localStorage.setItem('northline_bag', JSON.stringify(bag)); } catch {} updateBag(); };

async function boot() {
  const cfg = await fetch('/demo-config.json').then(r => r.json()).catch(() => null);
  if (!cfg?.publicKey) { $('#view').innerHTML = '<p class="empty">The demo workspace is not installed. Start the server with demo seeding enabled.</p>'; return; }
  products = cfg.products;
  // This is the one line a retailer adds to their site.
  const s = document.createElement('script');
  s.src = '/widget.js'; s.async = true; s.dataset.key = cfg.publicKey;
  document.head.append(s);
  addEventListener('hashchange', route);
  route();
  updateBag();
}

function route() {
  const hash = location.hash.slice(1) || '/';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query);
  document.querySelectorAll('.store-head nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + hash));
  if (path.startsWith('/p/')) pdp(decodeURIComponent(path.slice(3)));
  else list(params.get('c'));
  scrollTo({ top: 0, behavior: 'instant' });
}

function list(group) {
  const items = products.filter(p => !group || GROUP[group]?.includes(p.category));
  $('#view').innerHTML = `<section class="hero"><h1>Autumn<br/><em>essentials</em></h1><p>Considered everyday pieces. Not sure of your size? Every product page has a Forme fit check, and once you've done it your size shows here too.</p></section>
  <div class="chips"><a href="#/" class="${!group ? 'on' : ''}">All</a><a href="#/?c=tops" class="${group === 'tops' ? 'on' : ''}">Tops</a><a href="#/?c=bottoms" class="${group === 'bottoms' ? 'on' : ''}">Bottoms</a><a href="#/?c=dresses" class="${group === 'dresses' ? 'on' : ''}">Dresses</a></div>
  <div class="grid">${items.map((p, i) => `<a class="card" style="--i:${i}" href="#/p/${encodeURIComponent(p.sku)}"><div style="position:relative">${artBox(p.category, p.color)}<span class="yoursize" data-sku="${esc(p.sku)}" hidden></span></div><h3>${esc(p.name)}</h3><div class="meta"><span>${esc(p.category)}</span><span>${money(p.price)}</span></div></a>`).join('')}</div>`;
  listingSizes(items);
}

// Listing-page badges from the batch API, only for shoppers who already have a profile.
async function listingSizes(items) {
  let token; try { token = JSON.parse(localStorage.getItem('forme_profile_token')); } catch {}
  const key = document.querySelector('script[data-key]')?.dataset.key;
  if (!token || !key || !items.length) return;
  const r = await fetch('/v1/recommend/batch', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ skus: items.map(p => p.sku), profile_token: token }) }).then(x => x.json()).catch(() => null);
  for (const res of r?.results || []) {
    const el = document.querySelector(`.yoursize[data-sku="${CSS.escape(res.sku)}"]`);
    if (el && res.size) { el.textContent = `Your size ${res.size}`; el.hidden = false; }
  }
}

function pdp(sku) {
  const p = products.find(x => x.sku === sku);
  if (!p) { $('#view').innerHTML = '<p class="empty">Product not found. <a href="#/">Back to shop</a></p>'; return; }
  const sizes = SIZES[p.category].split(' ');
  let selected = null, recId = null, recommended = window.Forme?.lastRecommendation?.(sku)?.size || null;
  $('#view').innerHTML = `<a class="back" href="#/">← Back to shop</a><div class="pdp">${artBox(p.category, p.color)}<div>
    <div class="crumb">Northline · ${esc(p.category)} · ${esc(p.fit)} fit</div>
    <h1>${esc(p.name)}</h1><div class="price">${money(p.price)}</div>
    <p class="desc">${esc(p.description)}</p>
    <div class="size-head"><span>Select size</span><div data-forme-sku="${esc(p.sku)}"></div></div>
    <div class="sizes" role="radiogroup" aria-label="Size">${sizes.map(s => `<button role="radio" aria-checked="false" data-s="${s}">${s}</button>`).join('')}</div>
    <div class="hint" id="hint"></div>
    <button class="add" id="add" disabled>Select a size</button>
    <div class="perks"><span>✓ Free exchanges within 30 days</span><span>✓ Size checked by Forme fit engine</span><span>✓ Ships in 2–4 days</span></div>
  </div></div>`;
  const paint = () => {
    document.querySelectorAll('.sizes button').forEach(b => { b.classList.toggle('on', b.dataset.s === selected); b.classList.toggle('rec', b.dataset.s === recommended); b.setAttribute('aria-checked', String(b.dataset.s === selected)); });
    $('#add').disabled = !selected;
    $('#add').textContent = selected ? `Add size ${selected} to bag · ${money(p.price)}` : 'Select a size';
  };
  paint();
  $('.sizes').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; selected = b.dataset.s; $('#hint').textContent = recommended && selected !== recommended ? `Forme suggests ${recommended} for you.` : ''; paint(); });
  // Integration point: the widget tells us which size the shopper chose.
  $('[data-forme-sku]').addEventListener('forme:size-selected', e => {
    selected = e.detail.size; recommended = e.detail.recommended; recId = e.detail.rec_id;
    $('#hint').textContent = `Forme fit check: ${e.detail.recommended} · ${e.detail.confidence}% confidence`;
    paint();
  });
  $('#add').addEventListener('click', () => {
    const rec = window.Forme?.lastRecommendation?.(sku);
    bag.push({ sku, size: selected, price: p.price, rec_id: recId || rec?.rec_id || null, forme: !!(rec && rec.size === selected) });
    window.Forme?.track('add_to_cart', { sku, size: selected, rec_id: recId || rec?.rec_id, value: p.price });
    saveBag();
    $('#bag-btn').classList.remove('bump'); void $('#bag-btn').offsetWidth; $('#bag-btn').classList.add('bump');
    openDrawer();
  });
}

function updateBag() {
  $('#bag-count').textContent = bag.length;
  const total = bag.reduce((s, x) => s + x.price, 0);
  $('#drawer-body').innerHTML = bag.length ? bag.map((x, i) => { const p = products.find(y => y.sku === x.sku); if (!p) return ''; return `<div class="line">${artBox(p.category, p.color)}<div><b>${esc(p.name)}</b><small>Size ${esc(x.size)}${x.forme ? '<span class="fm">FORME FIT</span>' : ''}</small></div><div style="text-align:right">${money(x.price)}<br/><button class="rm" data-i="${i}">Remove</button></div></div>`; }).join('') : '<p class="empty">Your bag is empty.</p>';
  $('#drawer-foot').innerHTML = bag.length ? `<div class="total"><span>Total</span><span>${money(total)}</span></div><button class="add" id="checkout">Place sample order</button>` : '';
  $('#checkout')?.addEventListener('click', () => {
    for (const x of bag) window.Forme?.track('purchase', { sku: x.sku, size: x.size, rec_id: x.rec_id, value: x.price });
    bag = []; saveBag();
    $('#drawer-body').innerHTML = '<div class="done"><div class="tick">✓</div><b>Sample order placed</b><p class="empty" style="padding:8px 0">No payment was taken. The purchase events now appear in the Forme console.</p></div>';
  });
}

function openDrawer() { $('#drawer').classList.add('open'); $('#scrim').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); }
function closeDrawer() { $('#drawer').classList.remove('open'); $('#scrim').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); }
$('#bag-btn').addEventListener('click', openDrawer);
$('#drawer-close').addEventListener('click', closeDrawer);
$('#scrim').addEventListener('click', closeDrawer);
$('#drawer-body').addEventListener('click', e => { const b = e.target.closest('.rm'); if (b) { bag.splice(Number(b.dataset.i), 1); saveBag(); } });
addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

boot();
