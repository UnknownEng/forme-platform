// Database layer. One async interface over three engines:
//   - SQLite (node:sqlite) for local development and tests (default)
//   - Postgres (pg) in production when DATABASE_URL / POSTGRES_URL is set
//   - PGlite (in-process Postgres) when DATABASE_URL starts with "pglite:" (tests)
// Queries use "?" placeholders and portable SQL; the Postgres adapters translate
// placeholders to $1, $2, …
const fs = require('node:fs');
const path = require('node:path');

const TABLES = t => `
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'growth',
  allowed_origins TEXT NOT NULL DEFAULT '[]',
  widget TEXT NOT NULL DEFAULT '{}',
  return_cost ${t.real} NOT NULL DEFAULT 450,
  currency TEXT NOT NULL DEFAULT 'PKR',
  created_at ${t.big} NOT NULL,
  suspended_at ${t.big},
  session_epoch INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  expires_at ${t.big} NOT NULL,
  created_at ${t.big} NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('public','secret')),
  label TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  public_token TEXT,
  created_at ${t.big} NOT NULL,
  last_used_at ${t.big},
  revoked_at ${t.big}
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  fit TEXT NOT NULL,
  price ${t.real} NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  color INTEGER NOT NULL DEFAULT 0,
  chart TEXT NOT NULL,
  created_at ${t.big} NOT NULL,
  updated_at ${t.big} NOT NULL,
  UNIQUE (merchant_id, sku)
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  created_by TEXT,
  created_at ${t.big} NOT NULL,
  updated_at ${t.big} NOT NULL
);
CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  profile_id TEXT,
  size TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  engine TEXT NOT NULL,
  created_at ${t.big} NOT NULL
);
CREATE INDEX IF NOT EXISTS rec_by_merchant_time ON recommendations (merchant_id, created_at);
CREATE TABLE IF NOT EXISTS events (
  id ${t.serial},
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sku TEXT,
  rec_id TEXT,
  size TEXT,
  value ${t.real},
  created_at ${t.big} NOT NULL
);
CREATE INDEX IF NOT EXISTS events_by_merchant_time ON events (merchant_id, created_at);
CREATE INDEX IF NOT EXISTS events_by_rec ON events (rec_id);
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  rec_id TEXT,
  size TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('kept','too_small','too_large','returned_other')),
  followed INTEGER,
  created_at ${t.big} NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_by_product ON feedback (merchant_id, sku);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_audit (
  id ${t.serial},
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  ip TEXT,
  created_at ${t.big} NOT NULL
)`;
const SQLITE_TYPES = { real: 'REAL', big: 'INTEGER', serial: 'INTEGER PRIMARY KEY AUTOINCREMENT' };
const PG_TYPES = { real: 'DOUBLE PRECISION', big: 'BIGINT', serial: 'BIGSERIAL PRIMARY KEY' };
// Emails are unique regardless of letter case.
const EMAIL_INDEX = 'CREATE UNIQUE INDEX IF NOT EXISTS merchants_email ON merchants (lower(email))';
// Columns added after the first release, for databases created by older versions.
const ADDED_COLUMNS = [['merchants', 'suspended_at', 'big'], ['merchants', 'session_epoch', 'INTEGER NOT NULL DEFAULT 0']];

// "?" → "$1, $2 …", skipping anything inside single-quoted string literals.
function toPg(sql) {
  let n = 0, out = '', inStr = false;
  for (const ch of sql) {
    if (ch === "'") inStr = !inStr;
    out += !inStr && ch === '?' ? `$${++n}` : ch;
  }
  return out;
}
const statements = sql => sql.split(';').map(s => s.trim()).filter(Boolean);

/* ---------------- SQLite ---------------- */
function openSqlite(dataDir) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(dataDir, { recursive: true });
  const raw = new DatabaseSync(path.join(dataDir, 'forme.db'));
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  raw.exec(TABLES(SQLITE_TYPES));
  const cols = raw.prepare('PRAGMA table_info(merchants)').all().map(c => c.name);
  for (const [table, col, type] of ADDED_COLUMNS) if (!cols.includes(col)) raw.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${SQLITE_TYPES[type] || type}`);
  try { raw.exec(EMAIL_INDEX); } catch { /* an old database with case-duplicate emails: lookups still use lower() */ }
  raw.exec("UPDATE merchants SET currency = 'PKR' WHERE currency = 'INR'");

  const cache = new Map();
  const stmt = sql => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  const api = {
    dialect: 'sqlite',
    get: async (sql, ...p) => stmt(sql).get(...p),
    all: async (sql, ...p) => stmt(sql).all(...p),
    run: async (sql, ...p) => ({ changes: Number(stmt(sql).run(...p).changes) }),
    // SQLite calls resolve immediately, so no other request can interleave inside a transaction.
    async tx(fn) { raw.exec('BEGIN'); try { const r = await fn(api); raw.exec('COMMIT'); return r; } catch (e) { raw.exec('ROLLBACK'); throw e; } },
    withLock: (_name, fn) => fn(api),
    close: async () => raw.close(),
    persistent: true,
    location: path.join(dataDir, 'forme.db'),
  };
  return api;
}

/* ---------------- Postgres (pg) and PGlite ---------------- */
function pgAdapter(query, transaction, extra) {
  const make = q => {
    const a = {
      dialect: 'postgres',
      get: async (sql, ...p) => (await q(toPg(sql), p)).rows[0],
      all: async (sql, ...p) => (await q(toPg(sql), p)).rows,
      run: async (sql, ...p) => { const r = await q(toPg(sql), p); return { changes: r.rowCount ?? r.affectedRows ?? 0 }; },
    };
    return a;
  };
  const api = make(query);
  const scoped = q => { const a = make(q); a.tx = f => f(a); a.withLock = (_n, f) => f(a); return a; };
  api.tx = fn => transaction(q => fn(scoped(q)));
  // Lock shared by every server instance (serverless instances may start together).
  api.withLock = (name, fn) => transaction(async q => { await q('SELECT pg_advisory_xact_lock(hashtext($1))', [name]); return fn(scoped(q)); });
  return Object.assign(api, extra);
}

async function migratePg(db) {
  for (const s of statements(TABLES(PG_TYPES))) await db.run(s);
  for (const [table, col, type] of ADDED_COLUMNS) await db.run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${PG_TYPES[type] || type}`);
  await db.run(EMAIL_INDEX);
}

async function openPostgres(url) {
  const pg = require('pg');
  pg.types.setTypeParser(20, v => Number(v));        // BIGINT (COUNT, timestamps) as numbers
  pg.types.setTypeParser(1700, v => parseFloat(v));  // NUMERIC (AVG, ROUND) as numbers
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || /sslmode=disable/.test(url);
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.FORME_DB_POOL || 3), idleTimeoutMillis: 10_000, ssl: local ? false : { rejectUnauthorized: false } });
  const transaction = async fn => {
    const c = await pool.connect();
    try { await c.query('BEGIN'); const r = await fn((s, p) => c.query(s, p)); await c.query('COMMIT'); return r; }
    catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
    finally { c.release(); }
  };
  const db = pgAdapter((s, p) => pool.query(s, p), transaction, { close: () => pool.end(), persistent: true, location: url.replace(/\/\/[^@]*@/, '//***@') });
  await db.withLock('forme-migrate', migratePg);
  return db;
}

async function openPglite() {
  const { PGlite } = await import('@electric-sql/pglite');
  const pgl = new PGlite({ parsers: { 20: v => Number(v), 1700: v => parseFloat(v) } });
  // PGlite runs one transaction at a time; queue them so each stays atomic.
  let chain = Promise.resolve();
  const transaction = fn => {
    const run = chain.then(() => pgl.transaction(tx => fn((s, p) => tx.query(s, p))));
    chain = run.catch(() => {});
    return run;
  };
  const query = (s, p) => chain.then(() => pgl.query(s, p));
  const db = pgAdapter(query, transaction, { close: () => pgl.close(), persistent: false, location: 'pglite (in-memory)' });
  await migratePg(db);
  return db;
}

async function open(cfg) {
  const url = cfg.DATABASE_URL;
  if (url && url.startsWith('pglite:')) return openPglite();
  if (url) return openPostgres(url);
  return openSqlite(cfg.DATA_DIR);
}

module.exports = { open, toPg };
