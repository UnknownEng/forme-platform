const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {test} = require('node:test');

const root = path.resolve(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const product = {
  id: 'test-tee', brand: 'Test Brand', name: 'Test Tee', category: 'T-shirts',
  price: 1250, description: 'Test chart', fit: 'Regular', color: 0, verified: false,
  base: {chest: 104, waist: 96, shoulders: 46, length: 70},
  chart: [
    {size: 'XS', chest: 92, waist: 84, shoulders: 42, length: 68},
    {size: 'S', chest: 98, waist: 90, shoulders: 44, length: 69},
    {size: 'M', chest: 104, waist: 96, shoulders: 46, length: 70},
    {size: 'L', chest: 110, waist: 102, shoulders: 48, length: 71},
    {size: 'XL', chest: 116, waist: 108, shoulders: 50, length: 72}
  ]
};

function startServer(dataDir) {
  const child = spawn(process.execPath, [serverPath], {
    cwd: root,
    env: {...process.env, PORT: '0', FORME_DATA_DIR: dataDir},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start. ${logs}`)), 8000);
    child.stdout.on('data', chunk => {
      logs += chunk.toString();
      const match = logs.match(/Forme MVP running at http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); resolve({child, baseUrl: `http://127.0.0.1:${match[1]}`}); }
    });
    child.stderr.on('data', chunk => { logs += chunk.toString(); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { if (code !== null && !logs.includes('Forme MVP running')) { clearTimeout(timer); reject(new Error(`Server exited ${code}. ${logs}`)); } });
  });
}

test('catalog API validates, saves, and serves chart data without touching the real catalog', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forme-backend-'));
  let child;
  try {
    const started = await startServer(dataDir);
    child = started.child;
    t.after(async () => {
      if (child && child.exitCode === null) {
        child.kill();
        await new Promise(resolve => child.once('exit', resolve));
      }
      fs.rmSync(dataDir, {recursive: true, force: true});
    });

    const initial = await fetch(`${started.baseUrl}/api/catalog`);
    assert.equal(initial.status, 200);
    assert.deepEqual(await initial.json(), {products: []});

    const saved = await fetch(`${started.baseUrl}/api/catalog`, {
      method: 'PUT', headers: {'content-type': 'application/json'},
      body: JSON.stringify({products: [product]})
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), {ok: true, count: 1});

    const reloaded = await fetch(`${started.baseUrl}/api/catalog`);
    assert.equal(reloaded.status, 200);
    assert.deepEqual((await reloaded.json()).products, [product]);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'catalog.json'), 'utf8')).products, [product]);

    const invalid = await fetch(`${started.baseUrl}/api/catalog`, {
      method: 'PUT', headers: {'content-type': 'application/json'},
      body: JSON.stringify({products: [{...product, chart: product.chart.slice(0, 4)}]})
    });
    assert.equal(invalid.status, 400);

    const duplicate = await fetch(`${started.baseUrl}/api/catalog`, {
      method: 'PUT', headers: {'content-type': 'application/json'},
      body: JSON.stringify({products: [product, product]})
    });
    assert.equal(duplicate.status, 400);

    const unchanged = await fetch(`${started.baseUrl}/api/catalog`);
    assert.deepEqual((await unchanged.json()).products, [product]);

    const wrongMethod = await fetch(`${started.baseUrl}/api/catalog`, {method: 'POST'});
    assert.equal(wrongMethod.status, 405);

    const home = await fetch(started.baseUrl);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
  } finally {
    if (child && child.exitCode === null) child.kill();
    if (fs.existsSync(dataDir)) fs.rmSync(dataDir, {recursive: true, force: true});
  }
});
