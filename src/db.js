const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'growth',
  allowed_origins TEXT NOT NULL DEFAULT '[]',
  widget TEXT NOT NULL DEFAULT '{}',
  return_cost REAL NOT NULL DEFAULT 450,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('public','secret')),
  label TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  public_token TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  fit TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  color INTEGER NOT NULL DEFAULT 0,
  chart TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (merchant_id, sku)
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  profile_id TEXT,
  size TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  engine TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rec_by_merchant_time ON recommendations (merchant_id, created_at);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sku TEXT,
  rec_id TEXT,
  size TEXT,
  value REAL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_by_merchant_time ON events (merchant_id, created_at);
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  rec_id TEXT,
  size TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('kept','too_small','too_large','returned_other')),
  followed INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_by_product ON feedback (merchant_id, sku);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'forme.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);

  const cache = new Map();
  const stmt = sql => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };

  return {
    raw: db,
    get: (sql, ...p) => stmt(sql).get(...p),
    all: (sql, ...p) => stmt(sql).all(...p),
    run: (sql, ...p) => stmt(sql).run(...p),
    tx(fn) {
      db.exec('BEGIN');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    close: () => db.close(),
  };
}

module.exports = { open };
