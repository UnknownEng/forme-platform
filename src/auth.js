const crypto = require('node:crypto');

const id = prefix => `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
const token = (prefix, bytes = 24) => `${prefix}_${crypto.randomBytes(bytes).toString('base64url')}`;
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const [alg, n, saltB64, hashB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: SCRYPT.r, p: SCRYPT.p });
  return crypto.timingSafeEqual(expected, actual);
}

// A dummy hash so login spends the same time whether or not the email exists.
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));

function createAuth(db, { sessionTtlMs, secret }) {
  // Sessions are signed tokens (merchant id + expiry + HMAC), so any server
  // instance holding the same secret can verify them without shared storage.
  const sign = payload => crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  function createSession(merchantId) {
    const payload = `${merchantId}.${Date.now() + sessionTtlMs}`;
    return `${payload}.${sign(payload)}`;
  }
  function sessionMerchant(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const i = raw.lastIndexOf('.');
    if (i < 0) return null;
    const payload = raw.slice(0, i), mac = raw.slice(i + 1);
    const expected = sign(payload);
    if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const [merchantId, exp] = payload.split('.');
    if (!(Number(exp) > Date.now())) return null;
    return db.get('SELECT * FROM merchants WHERE id = ?', merchantId) || null;
  }
  // Signing out clears the cookie in the browser (see the logout route).
  function destroySession() {}

  // Public keys (pk_) are meant to sit in browser code, like a Stripe publishable
  // key, so we keep them readable for the install snippet. Secret keys (sk_) are
  // shown once and stored only as a hash.
  function createKey(merchantId, kind, label, fixed = null) {
    const raw = fixed?.key || token(kind === 'public' ? 'pk_live' : 'sk_live', 24);
    const row = { id: fixed?.id || id('key'), prefix: raw.slice(0, 12), created_at: Date.now() };
    db.run('INSERT INTO api_keys (id, merchant_id, kind, label, prefix, key_hash, public_token, created_at) VALUES (?,?,?,?,?,?,?,?)',
      row.id, merchantId, kind, label, row.prefix, sha256(raw), kind === 'public' ? raw : null, row.created_at);
    return { ...row, kind, label, key: raw };
  }
  function resolveKey(raw) {
    if (!raw || !/^(pk|sk)_live_[A-Za-z0-9_-]{20,}$/.test(raw)) return null;
    const row = db.get(`SELECT k.id AS key_id, k.kind, k.last_used_at, m.* FROM api_keys k JOIN merchants m ON m.id = k.merchant_id
      WHERE k.key_hash = ? AND k.revoked_at IS NULL`, sha256(raw));
    if (!row) return null;
    // Avoid a write on every call: refresh last_used at most once a minute.
    if (!row.last_used_at || Date.now() - row.last_used_at > 60_000) db.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', Date.now(), row.key_id);
    return row;
  }

  return { createSession, sessionMerchant, destroySession, createKey, resolveKey };
}

module.exports = { id, token, sha256, hashPassword, verifyPassword, DUMMY_HASH, createAuth };
