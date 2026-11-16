// Business logic shared by the merchant console API (/api) and the public API (/v1).
// Every function is async and works on SQLite and Postgres alike.
const engine = require('./engine');
const { id } = require('./auth');

const DAY = 24 * 60 * 60 * 1000;
// Days are counted in Pakistan time (UTC+5, no daylight saving) whatever the server's
// own timezone is, so "today" on a Vercel server in UTC matches the merchant's day.
const TZ_OFFSET = 5 * 60 * 60 * 1000;
const dayStart = t => Math.floor((t + TZ_OFFSET) / DAY) * DAY - TZ_OFFSET;
const dayKey = t => new Date(t + TZ_OFFSET).toISOString().slice(0, 10);
// Below this many feedback outcomes per group, a "returns avoided" figure is noise.
const MIN_FEEDBACK = 20;
const n = v => Number(v) || 0;

function createServices(db) {
  const toProduct = r => r && ({
    id: r.id, sku: r.sku, brand: r.brand, name: r.name, category: r.category, fit: r.fit, price: n(r.price),
    description: r.description, image_url: r.image_url, color: n(r.color), chart: JSON.parse(r.chart),
    created_at: n(r.created_at), updated_at: n(r.updated_at),
  });

  const products = {
    async list(merchantId, { q = '', category = '', limit = 500 } = {}) {
      const like = `%${q.toLowerCase()}%`;
      const rows = await db.all(`SELECT * FROM products WHERE merchant_id = ? AND (? = '' OR lower(name || ' ' || brand || ' ' || sku) LIKE ?)
        AND (? = '' OR category = ?) ORDER BY updated_at DESC LIMIT ?`, merchantId, q, like, category, category, limit);
      return rows.map(toProduct);
    },
    get: async (merchantId, sku) => toProduct(await db.get('SELECT * FROM products WHERE merchant_id = ? AND sku = ?', merchantId, sku)),
    getById: async (merchantId, pid) => toProduct(await db.get('SELECT * FROM products WHERE merchant_id = ? AND id = ?', merchantId, pid)),
    count: async merchantId => n((await db.get('SELECT COUNT(*) AS n FROM products WHERE merchant_id = ?', merchantId)).n),
    async upsert(merchantId, p) {
      const now = Date.now();
      const existing = await db.get('SELECT id, created_at FROM products WHERE merchant_id = ? AND sku = ?', merchantId, p.sku);
      if (existing) {
        await db.run(`UPDATE products SET brand=?, name=?, category=?, fit=?, price=?, description=?, image_url=?, color=?, chart=?, updated_at=? WHERE id=?`,
          p.brand, p.name, p.category, p.fit, p.price, p.description, p.image_url, p.color, JSON.stringify(p.chart), now, existing.id);
        return { product: await products.getById(merchantId, existing.id), created: false };
      }
      const pid = id('prd');
      await db.run(`INSERT INTO products (id, merchant_id, sku, brand, name, category, fit, price, description, image_url, color, chart, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, pid, merchantId, p.sku, p.brand, p.name, p.category, p.fit, p.price, p.description, p.image_url, p.color, JSON.stringify(p.chart), now, now);
      return { product: await products.getById(merchantId, pid), created: true };
    },
    remove: async (merchantId, sku) => (await db.run('DELETE FROM products WHERE merchant_id = ? AND sku = ?', merchantId, sku)).changes > 0,
  };

  async function feedbackCounts(merchantId, sku) {
    const out = { kept: 0, too_small: 0, too_large: 0, returned_other: 0 };
    for (const r of await db.all('SELECT outcome, COUNT(*) AS n FROM feedback WHERE merchant_id = ? AND sku = ? GROUP BY outcome', merchantId, sku)) out[r.outcome] = n(r.n);
    return out;
  }

  async function recommend(merchantId, product, profile, profileId = null, { log = true, counts = null } = {}) {
    const result = engine.recommend(product, profile, counts || await feedbackCounts(merchantId, product.sku));
    let recId = null;
    if (log) {
      recId = id('rec');
      const now = Date.now();
      // The two writes are independent, so they go out together.
      await Promise.all([
        db.run('INSERT INTO recommendations (id, merchant_id, sku, profile_id, size, confidence, engine, created_at) VALUES (?,?,?,?,?,?,?,?)',
          recId, merchantId, product.sku, profileId, result.size, result.confidence, result.engine_version, now),
        db.run('INSERT INTO events (merchant_id, type, sku, rec_id, size, created_at) VALUES (?,?,?,?,?,?)', merchantId, 'recommendation', product.sku, recId, result.size, now),
      ]);
    }
    return { rec_id: recId, sku: product.sku, ...result };
  }

  async function track(merchantId, { type, sku = null, rec_id = null, size = null, value = null }) {
    await db.run('INSERT INTO events (merchant_id, type, sku, rec_id, size, value, created_at) VALUES (?,?,?,?,?,?,?)', merchantId, type, sku, rec_id, size, value, Date.now());
  }

  async function addFeedback(merchantId, { sku, size, outcome, rec_id = null }) {
    let followed = null;
    if (rec_id) {
      const rec = await db.get('SELECT size FROM recommendations WHERE id = ? AND merchant_id = ?', rec_id, merchantId);
      if (rec) followed = rec.size === size ? 1 : 0;
    }
    const fid = id('fb');
    await db.run('INSERT INTO feedback (id, merchant_id, sku, rec_id, size, outcome, followed, created_at) VALUES (?,?,?,?,?,?,?,?)', fid, merchantId, sku, rec_id, size, outcome, followed, Date.now());
    return { id: fid, followed: followed == null ? null : !!followed, calibration: engine.calibration(await feedbackCounts(merchantId, sku)) };
  }

  async function analytics(merchant, days = 30) {
    const mid = merchant.id;
    // Calendar-aligned window: today plus the previous days-1 full days, so the
    // headline numbers and the daily chart always cover the same events.
    const since = dayStart(Date.now()) - (days - 1) * DAY;
    const prevSince = since - days * DAY;
    const now = Date.now();
    // One pass per period instead of five separate counts.
    const period = async (from, to) => {
      const r = await db.get(`SELECT
          SUM(CASE WHEN type = 'widget_open' THEN 1 ELSE 0 END) AS opens,
          SUM(CASE WHEN type = 'recommendation' THEN 1 ELSE 0 END) AS recs,
          SUM(CASE WHEN type = 'add_to_cart' AND rec_id IS NOT NULL THEN 1 ELSE 0 END) AS carts,
          SUM(CASE WHEN type = 'purchase' THEN 1 ELSE 0 END) AS purchases,
          COALESCE(SUM(CASE WHEN type = 'purchase' AND rec_id IS NOT NULL THEN value ELSE 0 END), 0) AS revenue
        FROM events WHERE merchant_id = ? AND created_at >= ? AND created_at < ?`, mid, from, to);
      return { opens: n(r.opens), recs: n(r.recs), carts: n(r.carts), purchases: n(r.purchases), revenue: n(r.revenue) };
    };
    const [cur, prev] = [await period(since, now + 1), await period(prevSince, since)];
    const change = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);

    const fb = await db.all(`SELECT followed, outcome, COUNT(*) AS n FROM feedback WHERE merchant_id = ? AND created_at >= ? GROUP BY followed, outcome`, mid, since);
    const bucket = f => { const rows = fb.filter(r => r.followed != null && n(r.followed) === f); const total = rows.reduce((s, r) => s + n(r.n), 0); const size = rows.filter(r => r.outcome === 'too_small' || r.outcome === 'too_large').reduce((s, r) => s + n(r.n), 0); return { total, size_returns: size, rate: total ? size / total : null }; };
    const followed = bucket(1), ignored = bucket(0);
    const enough = followed.total >= MIN_FEEDBACK && ignored.total >= MIN_FEEDBACK;
    const lift = enough ? Math.max(0, ignored.rate - followed.rate) : null;
    // Only purchases where the shopper actually took Forme's size count towards savings.
    const followedPurchases = n((await db.get(`SELECT COUNT(*) AS n FROM events e JOIN recommendations r ON r.id = e.rec_id
      WHERE e.merchant_id = ? AND e.type = 'purchase' AND e.size = r.size AND e.created_at >= ?`, mid, since)).n);
    const returnsAvoided = lift != null ? Math.round(followedPurchases * lift) : 0;

    // Daily buckets are computed in the database so only ~90 rows travel, not every event.
    const DAYMS = DAY, OFF = TZ_OFFSET;
    const daily = await db.all(`SELECT (created_at + ${OFF}) / ${DAYMS} AS d,
        SUM(CASE WHEN type = 'widget_open' THEN 1 ELSE 0 END) AS opens,
        SUM(CASE WHEN type = 'recommendation' THEN 1 ELSE 0 END) AS recs,
        SUM(CASE WHEN type = 'add_to_cart' AND rec_id IS NOT NULL THEN 1 ELSE 0 END) AS carts
      FROM events WHERE merchant_id = ? AND created_at >= ? GROUP BY (created_at + ${OFF}) / ${DAYMS}`, mid, since);
    const byDay = new Map();
    for (let i = 0; i < days; i++) { const t = since + i * DAY; byDay.set(Math.floor((t + TZ_OFFSET) / DAY), { date: dayKey(t), opens: 0, recs: 0, carts: 0 }); }
    for (const r of daily) { const b = byDay.get(Math.floor(n(r.d))); if (b) { b.opens = n(r.opens); b.recs = n(r.recs); b.carts = n(r.carts); } }
    const series = [...byDay.values()];

    const sizeMix = (await db.all(`SELECT size, COUNT(*) AS n FROM recommendations WHERE merchant_id = ? AND created_at >= ? GROUP BY size ORDER BY n DESC LIMIT 12`, mid, since)).map(r => ({ size: r.size, n: n(r.n) }));
    const top = (await db.all(`SELECT r.sku, p.name, p.brand, COUNT(*) AS recs, ROUND(AVG(r.confidence)) AS confidence FROM recommendations r
      LEFT JOIN products p ON p.merchant_id = r.merchant_id AND p.sku = r.sku WHERE r.merchant_id = ? AND r.created_at >= ? GROUP BY r.sku, p.name, p.brand ORDER BY recs DESC LIMIT 8`, mid, since))
      .map(r => ({ ...r, recs: n(r.recs), confidence: n(r.confidence) }));
    const profiles = n((await db.get(`SELECT COUNT(DISTINCT profile_id) AS n FROM recommendations WHERE merchant_id = ? AND created_at >= ? AND profile_id IS NOT NULL`, mid, since)).n);
    const avgConf = n((await db.get(`SELECT ROUND(AVG(confidence)) AS c FROM recommendations WHERE merchant_id = ? AND created_at >= ?`, mid, since)).c);
    const returnCost = n(merchant.return_cost);

    return {
      days,
      kpis: {
        widget_opens: { value: cur.opens, change: change(cur.opens, prev.opens) },
        recommendations: { value: cur.recs, change: change(cur.recs, prev.recs) },
        add_to_cart_rate: { value: cur.recs ? cur.carts / cur.recs : 0, change: change(cur.recs ? cur.carts / cur.recs : 0, prev.recs ? prev.carts / prev.recs : 0) },
        influenced_revenue: { value: cur.revenue, change: change(cur.revenue, prev.revenue) },
        avg_confidence: { value: avgConf },
        shoppers: { value: profiles },
      },
      returns: {
        followed_rate: followed.rate, ignored_rate: ignored.rate, followed_samples: followed.total, ignored_samples: ignored.total,
        enough_feedback: enough, min_feedback: MIN_FEEDBACK,
        returns_avoided: returnsAvoided, estimated_savings: returnsAvoided * returnCost, return_cost: returnCost, currency: merchant.currency,
      },
      series, size_mix: sizeMix, top_products: top,
    };
  }

  async function insights(merchantId) {
    const rows = await db.all(`SELECT p.sku, p.name, p.brand, p.category,
        SUM(CASE WHEN f.outcome='kept' THEN 1 ELSE 0 END) AS kept,
        SUM(CASE WHEN f.outcome='too_small' THEN 1 ELSE 0 END) AS too_small,
        SUM(CASE WHEN f.outcome='too_large' THEN 1 ELSE 0 END) AS too_large,
        SUM(CASE WHEN f.outcome='returned_other' THEN 1 ELSE 0 END) AS returned_other
      FROM products p LEFT JOIN feedback f ON f.merchant_id = p.merchant_id AND f.sku = p.sku
      WHERE p.merchant_id = ? GROUP BY p.sku, p.name, p.brand, p.category
      ORDER BY SUM(CASE WHEN f.outcome IN ('too_small','too_large') THEN 1 ELSE 0 END) DESC, p.name`, merchantId);
    return rows.map(r0 => {
      const r = { ...r0, kept: n(r0.kept), too_small: n(r0.too_small), too_large: n(r0.too_large), returned_other: n(r0.returned_other) };
      const cal = engine.calibration(r);
      const total = r.kept + r.too_small + r.too_large + r.returned_other;
      let verdict = 'Not enough feedback yet';
      if (total >= 8) verdict = cal.shift_cm > 1 ? 'Runs small — recommendations are sizing up' : cal.shift_cm < -1 ? 'Runs large — recommendations are sizing down' : 'True to chart';
      return { ...r, total, calibration: cal, verdict };
    });
  }

  async function activity(merchantId, limit = 20) {
    const rows = await db.all(`SELECT e.id, e.type, e.sku, e.size, e.value, e.created_at, p.name FROM events e
      LEFT JOIN products p ON p.merchant_id = e.merchant_id AND p.sku = e.sku WHERE e.merchant_id = ? ORDER BY e.id DESC LIMIT ?`, merchantId, limit);
    return rows.map(r => ({ ...r, id: n(r.id), created_at: n(r.created_at), value: r.value == null ? null : n(r.value) }));
  }

  // The same services, running inside a transaction.
  const bind = conn => createServices(conn);

  return { products, recommend, track, addFeedback, feedbackCounts, analytics, insights, activity, bind };
}

module.exports = { createServices };
