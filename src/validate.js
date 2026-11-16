// Input validation. Every function returns { value } on success or { error } with a
// human-readable message, so routes can answer with a precise 400.
const { CATEGORIES, FITS, BUILDS, SEXES, DIMS, GROUPS, groupFor } = require('./engine');

const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
// Only real numbers or numeric strings count: Number(true) === 1 and Number([5]) === 5
// must not sneak through.
const num = (v, lo, hi) => {
  if (typeof v !== 'number' && !(typeof v === 'string' && v.trim() !== '')) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi;
};

function product(input, { partialSku = false } = {}) {
  if (!input || typeof input !== 'object') return { error: 'Body must be a JSON object.' };
  const p = input;
  if (!partialSku && !(typeof p.sku === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(p.sku))) return { error: 'sku must be 1–64 characters: letters, digits, . _ : -' };
  if (!str(p.name, 80)) return { error: 'name is required (max 80 characters).' };
  if (!str(p.brand, 60)) return { error: 'brand is required (max 60 characters).' };
  if (!CATEGORIES.includes(p.category)) return { error: `category must be one of: ${CATEGORIES.join(', ')}` };
  const fit = p.fit ?? 'Regular';
  if (!FITS.includes(fit)) return { error: `fit must be one of: ${FITS.join(', ')}` };
  if (p.price != null && !num(p.price, 0, 10_000_000)) return { error: 'price must be a number between 0 and 10,000,000.' };
  if (p.description != null && (typeof p.description !== 'string' || p.description.length > 400)) return { error: 'description must be text up to 400 characters.' };
  if (p.image_url != null && p.image_url !== '' && !(typeof p.image_url === 'string' && /^https?:\/\/\S{1,500}$/.test(p.image_url))) return { error: 'image_url must be an http(s) URL.' };
  const chartCheck = chart(p.chart, p.category);
  if (chartCheck.error) return chartCheck;
  return {
    value: {
      sku: partialSku ? undefined : p.sku,
      name: p.name.trim(), brand: p.brand.trim(), category: p.category, fit,
      price: Number(p.price ?? 0), description: (p.description || '').trim(),
      image_url: p.image_url || '', color: Number.isInteger(p.color) && p.color >= 0 && p.color < 8 ? p.color : 0,
      chart: chartCheck.value,
    },
  };
}

function chart(rows, category) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 15) return { error: 'chart must be an array of 1–15 sizes.' };
  const labels = new Set();
  const clean = [];
  for (const [i, row] of rows.entries()) {
    if (!row || !str(String(row.size ?? ''), 10)) return { error: `chart[${i}].size is required (max 10 characters).` };
    const size = String(row.size).trim();
    if (labels.has(size.toUpperCase())) return { error: `chart has a duplicate size "${size}".` };
    labels.add(size.toUpperCase());
    const out = { size };
    for (const d of DIMS) {
      if (row[d] == null || row[d] === '') continue;
      if (!num(row[d], 10, 250)) return { error: `chart[${i}].${d} must be a number of centimetres between 10 and 250.` };
      out[d] = Number(row[d]);
    }
    clean.push(out);
  }
  const required = GROUPS[groupFor(category)].required;
  for (const d of required) {
    if (!clean.every(r => Number.isFinite(r[d]))) return { error: `Every size needs a ${d} measurement for ${category}.` };
  }
  // Store sizes smallest to largest, whatever order the brand sent them in, so
  // "size up / size down" advice and out-of-range checks are always right.
  clean.sort((a, b) => a[required[0]] - b[required[0]]);
  return { value: clean };
}

function profile(input) {
  if (!input || typeof input !== 'object') return { error: 'profile must be an object.' };
  if (!num(input.height, 120, 225)) return { error: 'profile.height is required, in cm (120–225).' };
  const out = { height: Number(input.height) };
  if (input.weight != null && input.weight !== '') {
    if (!num(input.weight, 30, 250)) return { error: 'profile.weight must be in kg (30–250).' };
    out.weight = Number(input.weight);
  }
  for (const d of ['chest', 'waist', 'hips', 'shoulders', 'inseam']) {
    if (input[d] == null || input[d] === '') continue;
    if (!num(input[d], 20, 250)) return { error: `profile.${d} must be in cm (20–250).` };
    out[d] = Number(input[d]);
  }
  if (input.fit != null && !FITS.includes(input.fit)) return { error: `profile.fit must be one of: ${FITS.join(', ')}` };
  if (input.build != null && !BUILDS.includes(input.build)) return { error: `profile.build must be one of: ${BUILDS.join(', ')}` };
  if (input.sex != null && input.sex !== '' && !SEXES.includes(input.sex)) return { error: `profile.sex must be one of: ${SEXES.join(', ')} (or omitted)` };
  if (SEXES.includes(input.sex)) out.sex = input.sex;
  out.fit = input.fit || 'Regular';
  if (input.build) out.build = input.build;
  return { value: out };
}

function origins(list) {
  if (!Array.isArray(list) || list.length > 20) return { error: 'allowed_origins must be a list of up to 20 origins.' };
  const out = [];
  for (const o of list) {
    try {
      const u = new URL(String(o));
      if (!/^https?:$/.test(u.protocol) || u.pathname !== '/' || u.search || u.hash) throw new Error();
      out.push(u.origin);
    } catch { return { error: `"${o}" is not an origin. Use the form https://shop.example.com` }; }
  }
  return { value: [...new Set(out)] };
}

const email = v => typeof v === 'string' && v.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

module.exports = { product, chart, profile, origins, email, str, num };
