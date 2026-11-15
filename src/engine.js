// Forme fit engine.
// Compares a shopper's body (measured or estimated) plus their fit preference
// against a garment's size chart, and returns a size with a confidence score,
// per-area fit notes, an alternative when the shopper is between sizes, and any
// calibration learned from real return/keep feedback for that product.

const { ENGINE_VERSION } = require('./config');

const DIMS = ['chest', 'waist', 'hips', 'shoulders', 'length', 'inseam'];

const GROUPS = {
  tops: { categories: ['T-shirts', 'Shirts', 'Knitwear', 'Jackets', 'Hoodies'], weights: { chest: 0.45, waist: 0.18, shoulders: 0.22, length: 0.15 }, required: ['chest'] },
  bottoms: { categories: ['Jeans', 'Trousers', 'Shorts'], weights: { waist: 0.5, hips: 0.3, inseam: 0.2 }, required: ['waist'] },
  dresses: { categories: ['Dresses'], weights: { chest: 0.35, waist: 0.35, hips: 0.3, length: 0.0 }, required: ['chest', 'waist'] },
};
const CATEGORIES = Object.values(GROUPS).flatMap(g => g.categories);
const FITS = ['Slim', 'Regular', 'Relaxed'];
const BUILDS = ['Slim', 'Average', 'Broad'];

function groupFor(category) {
  return Object.entries(GROUPS).find(([, g]) => g.categories.includes(category))?.[0] || 'tops';
}

const round1 = n => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Fill in body dimensions the shopper did not give us. Uses height, optional
// weight and a self-described build. Anything filled in here is reported back
// as "estimated" and lowers confidence.
function resolveBody(input = {}) {
  const height = Number(input.height);
  if (!Number.isFinite(height) || height < 120 || height > 225) throw new Error('height must be between 120 and 225 cm');
  const weight = Number(input.weight);
  const bmi = Number.isFinite(weight) && weight > 30 && weight < 250 ? weight / ((height / 100) ** 2) : null;
  const buildShift = { Slim: -1, Average: 0, Broad: 1 }[input.build] ?? 0;
  const b = bmi == null ? buildShift * 2.2 : clamp(bmi - 22.5, -6, 14) + buildShift * 0.8;
  const estimates = {
    chest: 0.555 * height + b * 2.3,
    waist: 0.47 * height + b * 3.1,
    hips: 0.56 * height + b * 2.1,
    shoulders: 0.262 * height + b * 0.35,
    inseam: 0.45 * height,
  };
  const body = { height };
  const estimated = [];
  for (const dim of ['chest', 'waist', 'hips', 'shoulders', 'inseam']) {
    const v = Number(input[dim]);
    if (Number.isFinite(v) && v > 10 && v < 250) body[dim] = v;
    else { body[dim] = round1(estimates[dim]); estimated.push(dim); }
  }
  return { body, estimated, fit: FITS.includes(input.fit) ? input.fit : 'Regular' };
}

// Garment measurement we would like to see for this body and preference.
function targets(body, fitPref, garmentFit, group, shiftCm) {
  const pref = { Slim: 0, Regular: 1, Relaxed: 2 }[fitPref];
  const cut = { Slim: -2, Regular: 0, Relaxed: 3 }[garmentFit] ?? 0;
  const chestEase = [6, 10, 16][pref] + cut + shiftCm;
  const t = {
    chest: body.chest + chestEase,
    shoulders: body.shoulders + [0, 1, 2.5][pref],
    length: 0.41 * body.height,
    inseam: body.inseam,
  };
  if (group === 'bottoms') {
    t.waist = body.waist + [1, 2.5, 4][pref] + shiftCm * 0.5;
    t.hips = body.hips + [3, 6, 9][pref] + cut * 0.5 + shiftCm * 0.6;
  } else {
    t.waist = body.waist + chestEase * 0.85;
    t.hips = body.hips + [3, 6, 9][pref] + shiftCm * 0.6;
  }
  return t;
}

function scoreRow(row, target, weights, group) {
  let total = 0, wsum = 0;
  const deltas = {};
  for (const [dim, w] of Object.entries(weights)) {
    if (!w || !Number.isFinite(row[dim])) continue;
    const d = row[dim] - target[dim];
    deltas[dim] = d;
    // Too tight hurts more than too loose; length deviations matter less per cm.
    const scale = dim === 'length' || dim === 'inseam' ? 0.6 : 1;
    // Tops are usually cut straight, so extra room at the waist matters little.
    const loose = group !== 'bottoms' && dim === 'waist' ? 0.45 : 1;
    total += w * (d < 0 ? Math.abs(d) * 1.4 : d * loose) * scale;
    wsum += w;
  }
  return { penalty: wsum ? total / wsum : Infinity, deltas };
}

function note(dim, d) {
  const lengthy = dim === 'length' || dim === 'inseam';
  const band = lengthy ? 3 : 2.5;
  let fit = 'ideal';
  if (d < -band) fit = lengthy ? 'short' : 'snug';
  else if (d > band) fit = lengthy ? 'long' : 'roomy';
  return { area: dim, fit, delta_cm: round1(d) };
}

// Learned correction from feedback. If shoppers who bought this product keep
// saying "too small", push targets up (towards bigger sizes), and vice versa.
function calibration(feedback = {}) {
  const small = feedback.too_small || 0, large = feedback.too_large || 0, kept = feedback.kept || 0;
  const n = small + large + kept;
  const shift = n ? clamp(((small - large) / (n + 6)) * 8, -4, 4) : 0;
  return { samples: n, shift_cm: round1(shift) };
}

function recommend(product, profileInput, feedback) {
  const group = groupFor(product.category);
  const { weights } = GROUPS[group];
  const { body, estimated, fit } = resolveBody(profileInput);
  const cal = calibration(feedback);
  const target = targets(body, fit, product.fit, group, cal.shift_cm);
  const chart = product.chart;

  const scored = chart.map(row => ({ row, ...scoreRow(row, target, weights, group) })).filter(s => Number.isFinite(s.penalty));
  if (!scored.length) throw new Error('size chart has no measurements this engine can use');
  const ranked = [...scored].sort((a, b) => a.penalty - b.penalty);
  const best = ranked[0];
  const idx = chart.indexOf(best.row);

  let confidence = 100 - best.penalty * 3.4;
  const usedDims = Object.keys(best.deltas);
  const estimatedUsed = usedDims.filter(d => estimated.includes(d));
  confidence -= Math.min(12, estimatedUsed.length * 4);
  if (cal.samples >= 10) confidence += 3;
  // Edge of the chart and still far off: the range probably does not suit.
  const outOfRange = (idx === 0 || idx === chart.length - 1) && best.penalty > 5;
  if (outOfRange) confidence -= 10;
  confidence = Math.round(clamp(confidence, 30, 98));

  let alternative = null;
  const runner = ranked[1];
  if (runner && runner.penalty - best.penalty < 1.2) {
    const runnerIdx = chart.indexOf(runner.row);
    alternative = {
      size: runner.row.size,
      reason: runnerIdx > idx ? 'You are between sizes. Size up for a looser feel.' : 'You are between sizes. Size down for a closer feel.',
    };
  }

  const label = confidence >= 88 ? 'Strong match' : confidence >= 74 ? 'Good match' : confidence >= 58 ? 'Fair match' : 'Low confidence';
  return {
    size: best.row.size,
    confidence,
    label,
    alternative,
    fit_notes: usedDims.map(d => note(d, best.deltas[d])),
    out_of_range: outOfRange,
    estimated: estimatedUsed,
    calibration: cal,
    fit_preference: fit,
    engine_version: ENGINE_VERSION,
  };
}

module.exports = { recommend, resolveBody, calibration, groupFor, GROUPS, CATEGORIES, FITS, BUILDS, DIMS };
