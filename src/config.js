const path = require('node:path');

const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const ON_VERCEL = !!process.env.VERCEL;

module.exports = {
  ROOT,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  // Vercel functions can only write to /tmp, which is wiped between instances.
  DATA_DIR: process.env.FORME_DATA_DIR || (ON_VERCEL ? '/tmp/forme' : path.join(ROOT, 'data')),
  ON_VERCEL,
  TRUST_PROXY: ON_VERCEL || process.env.FORME_TRUST_PROXY === '1',
  // Signs session cookies. Set FORME_SECRET in production so sessions survive restarts
  // and work across server instances.
  SESSION_SECRET: process.env.FORME_SECRET || crypto.randomBytes(32).toString('hex'),
  PORT: Number(process.env.PORT ?? 4173),
  HOST: process.env.HOST || '127.0.0.1',
  // Set FORME_SEED=0 to start with an empty database (no demo merchant).
  SEED_DEMO: process.env.FORME_SEED !== '0',
  SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  ENGINE_VERSION: '2.1.0',
  SECURE_COOKIES: process.env.FORME_SECURE_COOKIES === '1' || ON_VERCEL,
  DEMO_ACCOUNT: { email: 'demo@forme.dev', password: 'forme-demo-2026', name: 'Northline Supply (demo)' },
};
