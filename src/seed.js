// Demo workspace: a fictional retailer with a real catalog and 60 days of
// synthetic traffic, so the console has something to show on first run.
// Everything here is generated sample data, labelled as such in the UI.
const engine = require('./engine');
const { hashPassword, sha256 } = require('./auth');

const grade = (sizes, base, step) => sizes.map((size, i) => {
  const row = { size };
  for (const [k, v] of Object.entries(base)) row[k] = Math.round((v + (step[k] || 0) * i) * 10) / 10;
  return row;
});
const TOPS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const WAIST = ['28', '30', '32', '34', '36', '38'];

const DEMO_PRODUCTS = [
  { sku: 'NL-TEE-01', name: 'Everyday Cotton Tee', category: 'T-shirts', fit: 'Regular', price: 1990, color: 0, description: 'Mid-weight cotton jersey with a tidy crew neck. Easy through the body.', chart: grade(TOPS, { chest: 92, waist: 86, shoulders: 42, length: 67 }, { chest: 6, waist: 6, shoulders: 2, length: 1 }) },
  { sku: 'NL-BOX-02', name: 'Heavyweight Box Tee', category: 'T-shirts', fit: 'Relaxed', price: 2490, color: 2, description: 'Substantial 260gsm jersey with a dropped shoulder and a straight, boxy silhouette.', chart: grade(TOPS, { chest: 102, waist: 98, shoulders: 47, length: 67 }, { chest: 6, waist: 6, shoulders: 2, length: 1.2 }) },
  { sku: 'NL-OXF-03', name: 'Washed Oxford Shirt', category: 'Shirts', fit: 'Regular', price: 3990, color: 3, description: 'Garment-washed oxford cloth with a soft button-down collar.', chart: grade(TOPS, { chest: 94, waist: 88, shoulders: 42, length: 71 }, { chest: 5, waist: 5, shoulders: 1.5, length: 1 }) },
  { sku: 'NL-OVR-04', name: 'Workday Overshirt', category: 'Shirts', fit: 'Relaxed', price: 4490, color: 1, description: 'Soft structured twill overshirt cut with room for a layer underneath.', chart: grade(TOPS, { chest: 104, waist: 100, shoulders: 46, length: 72 }, { chest: 6, waist: 6, shoulders: 2, length: 1 }) },
  { sku: 'NL-KNT-05', name: 'Soft Rib Knit Polo', category: 'Knitwear', fit: 'Slim', price: 3490, color: 4, description: 'A light textured knit with a neat collar, for in-between weather.', chart: grade(TOPS, { chest: 88, waist: 82, shoulders: 41, length: 64 }, { chest: 5, waist: 5, shoulders: 1.5, length: 1 }) },
  { sku: 'NL-HOD-06', name: 'Loopback Hoodie', category: 'Hoodies', fit: 'Relaxed', price: 4990, color: 5, description: 'Brushed loopback cotton with a double-layer hood and ribbed hem.', chart: grade(TOPS, { chest: 104, waist: 96, shoulders: 46, length: 66 }, { chest: 6, waist: 6, shoulders: 2, length: 1.5 }) },
  { sku: 'NL-JKT-07', name: 'Canvas Chore Jacket', category: 'Jackets', fit: 'Regular', price: 7990, color: 6, description: 'Waxed cotton canvas with three patch pockets and corozo buttons.', chart: grade(TOPS, { chest: 100, waist: 96, shoulders: 44, length: 70 }, { chest: 6, waist: 6, shoulders: 2, length: 1 }) },
  { sku: 'NL-JNS-08', name: 'Straight Selvedge Jeans', category: 'Jeans', fit: 'Regular', price: 4990, color: 7, description: '13.5oz selvedge denim, straight from hip to hem.', chart: grade(WAIST, { waist: 74, hips: 94, inseam: 79 }, { waist: 5, hips: 5, inseam: 0.5 }) },
  { sku: 'NL-CHN-09', name: 'Tapered Chino', category: 'Trousers', fit: 'Slim', price: 3990, color: 0, description: 'Stretch cotton twill with a gentle taper below the knee.', chart: grade(WAIST, { waist: 73, hips: 91, inseam: 78 }, { waist: 5, hips: 4.5, inseam: 0.5 }) },
  { sku: 'NL-KRT-11', name: 'Lawn Printed Kurta', category: 'Kurtas', fit: 'Regular', price: 3990, color: 4, description: 'Breathable printed lawn with a straight cut, side slits and a band collar. Easy summer staple.', chart: grade(['XS', 'S', 'M', 'L', 'XL'], { chest: 88, waist: 84, shoulders: 36, length: 108 }, { chest: 6, waist: 6, shoulders: 1.5, length: 1.5 }) },
  { sku: 'NL-SKZ-12', name: 'Cotton Shalwar Kameez', category: 'Shalwar Kameez', fit: 'Regular', price: 5490, color: 6, description: 'Soft wash-and-wear cotton with a classic collar. Kameez sized by chest and length; shalwar has an adjustable waist.', chart: grade(TOPS, { chest: 98, waist: 94, shoulders: 43, length: 98 }, { chest: 6, waist: 6, shoulders: 1.5, length: 1.5 }) },
  { sku: 'NL-DRS-10', name: 'Linen Midi Dress', category: 'Dresses', fit: 'Regular', price: 5990, color: 1, description: 'Breathable European linen with a tie waist and a fluid midi length.', chart: grade(['XS', 'S', 'M', 'L', 'XL'], { chest: 84, waist: 68, hips: 92, length: 115 }, { chest: 5, waist: 5, hips: 5, length: 1 }) },
];

// Small deterministic PRNG so every fresh install shows the same demo story.
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Bump when the demo catalog or story changes; older demo workspaces are rebuilt.
const DEMO_VERSION = '5-pk';

// Insert many rows with one statement per chunk (fast on a remote Postgres too).
async function insertMany(db, table, cols, rows, chunk = 250) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const one = `(${cols.map(() => '?').join(',')})`;
    await db.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${part.map(() => one).join(',')}`, ...part.flat());
  }
}

async function seedDemo(db, auth, demoAccount) {
  // Fast path: already seeded at this version — no lock, one quick read.
  const done = await db.all("SELECT key, value FROM meta WHERE key IN ('demo_seeded', 'demo_version')");
  if (done.length === 2 && done.find(r => r.key === 'demo_version').value === DEMO_VERSION) return null;
  // One server instance seeds at a time; the others wait and then find it done.
  return db.withLock('forme-demo-seed', async L => {
    const seeded = await L.get("SELECT value FROM meta WHERE key = 'demo_seeded'");
    if (seeded && (await L.get("SELECT value FROM meta WHERE key = 'demo_version'"))?.value === DEMO_VERSION) return null;

    const rand = rng(20261115);
    // Deterministic ids: every server instance rebuilds exactly the same demo workspace,
    // so demo logins and keys work everywhere.
    const id = prefix => `${prefix}_${Math.floor(rand() * 2 ** 52).toString(36)}${Math.floor(rand() * 2 ** 30).toString(36)}`;
    const DEMO_PK = { id: 'key_demo_public', key: `pk_live_demo${sha256('forme-demo-public-key').slice(0, 28)}` };
    const pick = arr => arr[Math.floor(rand() * arr.length)];
    const gauss = () => (rand() + rand() + rand() + rand() - 2) * 1.2;
    const mid = 'mer_demo_northline';
    const DAY = 86400000;
    const now = Math.floor(Date.now() / DAY) * DAY + DAY - 1;
    const realNow = Date.now();

    // Generate the whole 60-day story in memory first.
    const recs = [], events = [], fbs = [];
    const shoppers = Array.from({ length: 900 }, () => {
      const female = rand() < 0.42;
      const height = Math.round(female ? 161 + gauss() * 6 : 174 + gauss() * 7);
      const weight = Math.round((female ? 58 : 72) + gauss() * 9 + (height - (female ? 161 : 174)) * 0.6);
      return { pid: id('prf'), body: { height, weight, sex: female ? 'female' : 'male', fit: pick(['Slim', 'Regular', 'Regular', 'Relaxed']), build: pick(['Slim', 'Average', 'Average', 'Broad']) }, female };
    });
    // A couple of products have quirks so the insights page has a story.
    const quirk = { 'NL-OXF-03': 'small', 'NL-BOX-02': 'large' };
    // Random numbers are drawn identically on every instance (the day is fixed in UTC);
    // events that would fall later than "right now" are simply not stored.
    const ev = (t, ...row) => { if (t <= realNow) events.push([mid, ...row, t]); };
    for (let d = 59; d >= 0; d--) {
      const dayStart = Math.floor((now - d * DAY) / DAY) * DAY;
      const weekday = new Date(dayStart).getUTCDay();
      const growth = 1 + (59 - d) * 0.012;
      const opens = Math.round((70 + rand() * 40) * growth * (weekday === 0 || weekday === 6 ? 1.35 : 1));
      for (let i = 0; i < opens; i++) {
        const t = dayStart + Math.floor(rand() * DAY);
        const sh = pick(shoppers);
        const pool = DEMO_PRODUCTS.filter(p => (['Dresses', 'Kurtas'].includes(p.category) ? sh.female : p.category === 'Shalwar Kameez' ? !sh.female : true));
        const p = pick(pool);
        ev(t, 'widget_open', p.sku, null, null, null);
        if (rand() > 0.8) continue;
        const r = engine.recommend(p, sh.body, {});
        const recId = id('rec');
        if (t + 4000 <= realNow) recs.push([recId, mid, p.sku, sh.pid, r.size, r.confidence, r.engine_version, t + 4000]);
        ev(t + 4000, 'recommendation', p.sku, recId, r.size, null);
        if (rand() > 0.36 - (r.confidence - 75) / 400) continue;
        const followed = rand() < 0.86;
        const idx = p.chart.findIndex(c => c.size === r.size);
        const size = followed ? r.size : p.chart[Math.min(p.chart.length - 1, Math.max(0, idx + (rand() < 0.5 ? -1 : 1)))].size;
        ev(t + 30000, 'add_to_cart', p.sku, recId, size, null);
        if (rand() > 0.63) continue;
        ev(t + 300000, 'purchase', p.sku, recId, size, p.price);
        if (rand() > 0.72 || t + 6 * DAY > now) continue;
        const x = rand();
        let outcome;
        if (followed) outcome = x < 0.885 ? 'kept' : x < 0.925 ? 'too_small' : x < 0.965 ? 'too_large' : 'returned_other';
        else outcome = x < 0.69 ? 'kept' : x < 0.82 ? 'too_small' : x < 0.93 ? 'too_large' : 'returned_other';
        if (quirk[p.sku] === 'small' && outcome === 'kept' && rand() < 0.16) outcome = 'too_small';
        if (quirk[p.sku] === 'large' && outcome === 'kept' && rand() < 0.14) outcome = 'too_large';
        const fbId = id('fb');
        if (t + 6 * DAY <= realNow) fbs.push([fbId, mid, p.sku, recId, size, outcome, followed ? 1 : 0, t + 6 * DAY]);
      }
    }

    await L.tx(async t => {
      if (seeded) {
        // Only the demo workspace is replaced; real merchant accounts are untouched.
        for (const tbl of ['recommendations', 'events', 'feedback', 'products', 'api_keys', 'sessions']) await t.run(`DELETE FROM ${tbl} WHERE merchant_id = ?`, seeded.value);
        await t.run('DELETE FROM merchants WHERE id = ?', seeded.value);
        await t.run("DELETE FROM meta WHERE key IN ('demo_seeded', 'demo_version')");
      }
      await t.run('INSERT INTO merchants (id, name, email, password_hash, plan, return_cost, widget, currency, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        mid, demoAccount.name, demoAccount.email, hashPassword(demoAccount.password), 'enterprise', 450, JSON.stringify({ accent: '#c6ff3d', label: 'Find my size', position: 'inline' }), 'PKR', now - 70 * DAY);
      await auth.createKey(mid, 'public', 'Storefront widget', DEMO_PK, t);
      const pt = now - 65 * DAY;
      await insertMany(t, 'products', ['id', 'merchant_id', 'sku', 'brand', 'name', 'category', 'fit', 'price', 'description', 'image_url', 'color', 'chart', 'created_at', 'updated_at'],
        DEMO_PRODUCTS.map(p => [`prd_demo_${p.sku}`, mid, p.sku, 'Northline', p.name, p.category, p.fit, p.price, p.description, '', p.color, JSON.stringify(p.chart), pt, pt]));
      await insertMany(t, 'recommendations', ['id', 'merchant_id', 'sku', 'profile_id', 'size', 'confidence', 'engine', 'created_at'], recs);
      await insertMany(t, 'events', ['merchant_id', 'type', 'sku', 'rec_id', 'size', 'value', 'created_at'], events);
      await insertMany(t, 'feedback', ['id', 'merchant_id', 'sku', 'rec_id', 'size', 'outcome', 'followed', 'created_at'], fbs);
      await t.run("INSERT INTO meta (key, value) VALUES ('demo_seeded', ?)", mid);
      await t.run("INSERT INTO meta (key, value) VALUES ('demo_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", DEMO_VERSION);
    });
    return mid;
  });
}

module.exports = { seedDemo, DEMO_PRODUCTS };
