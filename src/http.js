// Minimal HTTP toolkit: router, JSON bodies, typed errors, cookies, rate limits,
// security headers and a static file server. No third-party dependencies.
const fs = require('node:fs');
const path = require('node:path');

class HttpError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
const fail = (status, code, message, details) => { throw new HttpError(status, code, message, details); };
// A stray "%" in a cookie or URL must not turn into a 500.
const safeDecode = s => { try { return decodeURIComponent(s); } catch { return s; } };

function createRouter() {
  const routes = [];
  const add = (method, pattern, ...handlers) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/[.]/g, '\\.').replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    routes.push({ method, re, keys, handlers });
  };
  const match = (method, pathname) => {
    // HEAD is answered by the GET handler (Node drops the body), so uptime monitors work.
    const want = method === 'HEAD' ? 'GET' : method;
    const allowed = new Set();
    for (const r of routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      allowed.add(r.method);
      if (r.method !== want) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = safeDecode(m[i + 1]); });
      return { handlers: r.handlers, params };
    }
    if (allowed.has('GET')) allowed.add('HEAD');
    return allowed.size ? { methodNotAllowed: true, allow: [...allowed].join(', ') } : null;
  };
  return { get: (p, ...h) => add('GET', p, ...h), post: (p, ...h) => add('POST', p, ...h), put: (p, ...h) => add('PUT', p, ...h), patch: (p, ...h) => add('PATCH', p, ...h), delete: (p, ...h) => add('DELETE', p, ...h), match };
}

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function send(res, status, body, headers = {}) {
  if (res.headersSent) return;
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...BASE_HEADERS,
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...res.extraHeaders,
    ...headers,
  });
  res.end(status === 204 ? undefined : isJson ? JSON.stringify(body) : body);
}

function readJson(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const type = req.headers['content-type'] || '';
    if (!type.includes('application/json')) return reject(new HttpError(415, 'unsupported_media_type', 'Send the body as application/json.'));
    let size = 0, tooBig = false;
    const chunks = [];
    req.on('data', c => {
      if (tooBig) return; // keep draining so the 413 reply can still be delivered
      size += c.length;
      if (size > limit) { tooBig = true; chunks.length = 0; reject(new HttpError(413, 'payload_too_large', `Body is larger than ${Math.round(limit / 1024)} KB.`)); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) return;
      let v;
      try { v = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
      catch { return reject(new HttpError(400, 'invalid_json', 'Body is not valid JSON.')); }
      if (v === null || typeof v !== 'object') return reject(new HttpError(400, 'invalid_json', 'Body must be a JSON object or array.'));
      resolve(v);
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = safeDecode(part.slice(i + 1).trim());
  }
  return out;
}

// Fixed-window limiter in memory. Fine for one process; use Redis when scaling out.
function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  return key => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    h.count++;
    return { ok: h.count <= max, remaining: Math.max(0, max - h.count), reset: h.reset };
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function serveStatic(root, req, res, pathname, aliases = {}, status = 200) {
  let rel = aliases[pathname] || pathname;
  if (rel.endsWith('/')) rel += 'index.html';
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch { return false; }
  const target = path.resolve(root, '.' + decoded);
  if (target !== root && !target.startsWith(root + path.sep)) return false;
  let stat;
  try { stat = fs.statSync(target); } catch { return false; }
  if (!stat.isFile()) return false;
  const ext = path.extname(target);
  const headers = { ...BASE_HEADERS, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' };
  if (ext === '.html') headers['Content-Security-Policy'] = PAGE_CSP;
  // The widget is loaded by other sites, so it must be fetchable cross-origin.
  if (decoded === '/widget.js') { headers['Access-Control-Allow-Origin'] = '*'; headers['Cross-Origin-Resource-Policy'] = 'cross-origin'; }
  res.writeHead(status, headers);
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(target).pipe(res);
  return true;
}

// Does a static page/file exist at this path? (Used to answer 405 vs 404.)
serveStatic.exists = (root, pathname, aliases = {}) => {
  let rel = aliases[pathname] || pathname;
  if (rel.endsWith('/')) rel += 'index.html';
  const target = path.resolve(root, '.' + safeDecode(rel));
  if (target !== root && !target.startsWith(root + path.sep)) return false;
  try { return fs.statSync(target).isFile(); } catch { return false; }
};

module.exports = { HttpError, fail, createRouter, send, readJson, parseCookies, rateLimiter, serveStatic, safeDecode };
