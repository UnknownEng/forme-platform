// Business logic shared by the merchant console API (/api) and the public API (/v1).
const engine = require('./engine');
const { id } = require('./auth');

const DAY = 24 * 60 * 60 * 1000;

function createServices(db) {
  const toProduct = r => r && ({
    id: r.id, sku: r.sku, brand: r.brand, name: r.name, category: r.category, fit: r.fit, price: r.price,
    description: r.description, image_url: r.image_url, color: r.color, chart: JSON.parse(r.chart),
    created_at: r.created_at, updated_at: r.updated_at,
  });

  const products = {
    list(merchantId, { q = '', category = '', limit = 500 } = {}) {
      const like = `%${q.toLowerCase()}%`;
      return db.all(`SELECT * FROM products WHERE merchant_id = ? AND (? = '' OR lower(name || ' ' || brand || ' ' || sku) LIKE ?)
        AND (? = '' OR category = ?) ORDER BY updated_at DESC LIMIT ?`, merchantId, q, like, category, category, limit).map(toProduct);
    },
    get: (merchantId, sku) => toProduct(db.get('SELECT * FROM products WHERE merchant_id = ? AND sku = ?', merchantId, sku)),
    getById: (merchantId, pid) => toProduct(db.get('SELECT * FROM products WHERE merchant_id = ? AND id = ?', merchantId, pid)),
    count: merchantId => db.get('SELECT COUNT(*) AS n FROM products WHERE merchant_id = ?', merchantId).n,
    upsert(merchantId, p) {
      const now = Date.now();
      const existing = db.get('SELECT id, created_at FROM products WHERE merchant_id = ? AND sku = ?', merchantId, p.sku);
      if (existing) {
        db.run(`UPDATE products SET brand=?, name=?, category=?, fit=?, price=?, description=?, image_url=?, color=?, chart=?, updated_at=? WHERE id=?`,
          p.brand, p.name, p.category, p.fit, p.price, p.description, p.image_url, p.color, JSON.stringify(p.chart), now, existing.id);
        return { product: products.getById(merchantId, existing.id), created: false };
      }
      const pid = id('prd');
      db.run(`INSERT INTO products (id, merchant_id, sku, brand, name, category, fit, price, description, image_url, color, chart, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, pid, merchantId, p.sku, p.brand, p.name, p.category, p.fit, p.price, p.description, p.image_url, p.color, JSON.stringify(p.chart), now, now);
      return { product: products.getById(merchantId, pid), created: true };
    },
    remove: (merchantId, sku) => db.run('DELETE FROM products WHERE merchant_id = ? AND sku = ?', merchantId, sku).changes > 0,
  };

  function feedbackCounts(merchantId, sku) {
    const out = { kept: 0, too_small: 0, too_large: 0, returned_other: 0 };
    for (const r of db.all('SELECT outcome, COUNT(*) AS n FROM feedback WHERE merchant_id = ? AND sku = ? GROUP BY outcome', merchantId, sku)) out[r.outcome] = r.n;
    return out;
  }

  function recommend(merchantId, product, profile, profileId = null, { log = true } = {}) {
    const result = engine.recommend(product, profile, feedbackCounts(merchantId, product.sku));
    let recId = null;
    if (log) {
      recId = id('rec');
      const now = Date.now();
      db.run('INSERT INTO recommendations (id, merchant_id, sku, profile_id, size, confidence, engine, created_at) VALUES (?,?,?,?,?,?,?,?)',
        recId, merchantId, product.sku, profileId, result.size, result.confidence, result.engine_version, now);
      db.run('INSERT INTO events (merchant_id, type, sku, rec_id, size, created_at) VALUES (?,?,?,?,?,?)', merchantId, 'recommendation', product.sku, recId, result.size, now);
    }
    return { rec_id: recId, sku: product.sku, ...result };
  }

  function track(merchantId, { type, sku = null, rec_id = null, size = null, value = null }) {
    db.run('INSERT INTO events (merchant_id, type, sku, rec_id, size, value, created_at) VALUES (?,?,?,?,?,?,?)', merchantId, type, sku, rec_id, size, value, Date.now());
  }

  function addFeedback(merchantId, { sku, size, outcome, rec_id = null }) {
    let followed = null;
    if (rec_id) {
      const rec = db.get('SELECT size FROM recommendations WHERE id = ? AND merchant_id = ?', rec_id, merchantId);
      if (rec) followed = rec.size === size ? 1 : 0;
    }
    const fid = id('fb');
    db.run('INSERT INTO feedback (id, merchant_id, sku, rec_id, size, outcome, followed, created_at) VALUES (?,?,?,?,?,?,?,?)', fid, merchantId, sku, rec_id, size, outcome, followed, Date.now());
    return { id: fid, followed: followed == null ? null : !!followed, calibration: engine.calibration(feedbackCounts(merchantId, sku)) };
  }

  function analytics(merchant, days = 30) {
    const mid = merchant.id;
    const since = Date.now() - days * DAY;
    const prevSince = since - days * DAY;
    const count = (type, from, to = Date.now()) => db.get('SELECT COUNT(*) AS n FROM events WHERE merchant_id = ? AND type = ? AND created_at >= ? AND created_at < ?', mid, type, from, to).n;
    const period = (from, to) => {
      const opens = count('widget_open', from, to), recs = count('recommendation', from, to);
      const carts = db.get(`SELECT COUNT(*) AS n FROM events WHERE merchant_id = ? AND type = 'add_to_cart' AND rec_id IS NOT NULL AND created_at >= ? AND created_at < ?`, mid, from, to).n;
      const purchases = count('purchase', from, to);
      const revenue = db.get(`SELECT COALESCE(SUM(value),0) AS v FROM events WHERE merchant_id = ? AND type = 'purchase' AND rec_id IS NOT NULL AND created_at >= ? AND created_at < ?`, mid, from, to).v;
      return { opens, recs, carts, purchases, revenue };
    };
    const cur = period(since, Date.now());
    const prev = period(prevSince, since);
    const change = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);

    const fb = db.all(`SELECT followed, outcome, COUNT(*) AS n FROM feedback WHERE merchant_id = ? AND created_at >= ? GROUP BY followed, outcome`, mid, since);
    const bucket = f => { const rows = fb.filter(r => r.followed === f); const total = rows.reduce((s, r) => s + r.n, 0); const size = rows.filter(r => r.outcome === 'too_small' || r.outcome === 'too_large').reduce((s, r) => s + r.n, 0); return { total, size_returns: size, rate: total ? size / total : null }; };
    const followed = bucket(1), ignored = bucket(0);
    const lift = followed.rate != null && ignored.rate != null ? Math.max(0, ignored.rate - followed.rate) : null;
    const purchasesWithRec = db.get(`SELECT COUNT(*) AS n FROM events WHERE merchant_id = ? AND type = 'purchase' AND rec_id IS NOT NULL AND created_at >= ?`, mid, since).n;
    const returnsAvoided = lift != null ? Math.round(purchasesWithRec * lift) : 0;

    const series = [];
    const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const rows = db.all(`SELECT type, created_at FROM events WHERE merchant_id = ? AND created_at >= ? AND type IN ('widget_open','recommendation','add_to_cart')`, mid, dayStart(since));
    const byDay = new Map();
    for (let t = dayStart(since); t <= Date.now(); t += DAY) byDay.set(dayStart(t), { date: new Date(dayStart(t)).toISOString().slice(0, 10), opens: 0, recs: 0, carts: 0 });
    for (const r of rows) { const b = byDay.get(dayStart(r.created_at)); if (!b) continue; if (r.type === 'widget_open') b.opens++; else if (r.type === 'recommendation') b.recs++; else b.carts++; }
    series.push(...byDay.values());

    const sizeMix = db.all(`SELECT size, COUNT(*) AS n FROM recommendations WHERE merchant_id = ? AND created_at >= ? GROUP BY size ORDER BY n DESC LIMIT 12`, mid, since);
    const top = db.all(`SELECT r.sku, p.name, p.brand, COUNT(*) AS recs, ROUND(AVG(r.confidence)) AS confidence FROM recommendations r
      LEFT JOIN products p ON p.merchant_id = r.merchant_id AND p.sku = r.sku WHERE r.merchant_id = ? AND r.created_at >= ? GROUP BY r.sku ORDER BY recs DESC LIMIT 8`, mid, since);
    const profiles = db.get(`SELECT COUNT(DISTINCT profile_id) AS n FROM recommendations WHERE merchant_id = ? AND created_at >= ? AND profile_id IS NOT NULL`, mid, since).n;
    const avgConf = db.get(`SELECT ROUND(AVG(confidence)) AS c FROM recommendations WHERE merchant_id = ? AND created_at >= ?`, mid, since).c;

    return {
      days,
      kpis: {
        widget_opens: { value: cur.opens, change: change(cur.opens, prev.opens) },
        recommendations: { value: cur.recs, change: change(cur.recs, prev.recs) },
        add_to_cart_rate: { value: cur.recs ? cur.carts / cur.recs : 0, change: change(cur.recs ? cur.carts / cur.recs : 0, prev.recs ? prev.carts / prev.recs : 0) },
        influenced_revenue: { value: cur.revenue, change: change(cur.revenue, prev.revenue) },
        avg_confidence: { value: avgConf || 0 },
        shoppers: { value: profiles },
      },
      returns: {
        followed_rate: followed.rate, ignored_rate: ignored.rate, followed_samples: followed.total, ignored_samples: ignored.total,
        returns_avoided: returnsAvoided, estimated_savings: returnsAvoided * merchant.return_cost, return_cost: merchant.return_cost, currency: merchant.currency,
      },
      series, size_mix: sizeMix, top_products: top,
    };
  }

  function insights(merchantId) {
    const rows = db.all(`SELECT p.sku, p.name, p.brand, p.category,
        SUM(CASE WHEN f.outcome='kept' THEN 1 ELSE 0 END) AS kept,
        SUM(CASE WHEN f.outcome='too_small' THEN 1 ELSE 0 END) AS too_small,
        SUM(CASE WHEN f.outcome='too_large' THEN 1 ELSE 0 END) AS too_large,
        SUM(CASE WHEN f.outcome='returned_other' THEN 1 ELSE 0 END) AS returned_other
      FROM products p LEFT JOIN feedback f ON f.merchant_id = p.merchant_id AND f.sku = p.sku
      WHERE p.merchant_id = ? GROUP BY p.sku ORDER BY (too_small + too_large) DESC, p.name`, merchantId);
    return rows.map(r => {
      const cal = engine.calibration(r);
      const total = r.kept + r.too_small + r.too_large + r.returned_other;
      let verdict = 'Not enough feedback yet';
      if (total >= 8) verdict = cal.shift_cm > 1 ? 'Runs small — recommendations are sizing up' : cal.shift_cm < -1 ? 'Runs large — recommendations are sizing down' : 'True to chart';
      return { ...r, total, calibration: cal, verdict };
    });
  }

  function activity(merchantId, limit = 20) {
    return db.all(`SELECT e.id, e.type, e.sku, e.size, e.value, e.created_at, p.name FROM events e
      LEFT JOIN products p ON p.merchant_id = e.merchant_id AND p.sku = e.sku WHERE e.merchant_id = ? ORDER BY e.id DESC LIMIT ?`, merchantId, limit);
  }

  return { products, recommend, track, addFeedback, feedbackCounts, analytics, insights, activity };
}

module.exports = { createServices };
