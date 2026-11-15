const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DATA_DIR = process.env.FORME_DATA_DIR || path.join(ROOT, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json');
const PORT = Number(process.env.PORT || 4173);
const HOST = '127.0.0.1';
const SIZES = ['XS','S','M','L','XL'];
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};

function readCatalog() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    return Array.isArray(parsed.products) ? parsed : {products:[]};
  } catch {
    return {products:[]};
  }
}

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

function validProduct(p) {
  const validBase = p && p.base && ['chest','waist','shoulders'].every(k => Number.isFinite(Number(p.base[k])) && Number(p.base[k]) > 0 && Number(p.base[k]) < 200) && Number.isFinite(Number(p.base.length ?? 70)) && Number(p.base.length ?? 70) > 0 && Number(p.base.length ?? 70) < 200;
  const validChart = !p?.chart || (Array.isArray(p.chart) && p.chart.length === SIZES.length && p.chart.every((row,i) => row.size === SIZES[i] && ['chest','waist','shoulders','length'].every(k => Number.isFinite(Number(row[k])) && Number(row[k]) > 0 && Number(row[k]) < 200)));
  return p && typeof p.id === 'string' && p.id.length <= 80 && typeof p.brand === 'string' && p.brand.trim().length > 0 && p.brand.length <= 45 && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 60 && ['T-shirts','Shirts','Knitwear'].includes(p.category) && Number.isFinite(Number(p.price)) && Number(p.price) > 0 && Number(p.price) <= 1000000 && validBase && validChart && ['Slim','Regular','Relaxed'].includes(p.fit);
}

const server = http.createServer((req,res)=>{
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if(url.pathname==='/api/catalog' && req.method==='GET') return send(res,200,readCatalog());
  if(url.pathname==='/api/catalog' && req.method==='PUT') {
    let raw='';
    req.on('data',chunk=>{raw+=chunk;if(raw.length>1024*1024){req.destroy()}});
    req.on('end',()=>{
      try {
        const body=JSON.parse(raw);
        if(!body || !Array.isArray(body.products) || body.products.length>300 || !body.products.every(validProduct)) return send(res,400,{error:'Catalog validation failed.'});
        const ids=body.products.map(p=>p.id);
        if(new Set(ids).size!==ids.length) return send(res,400,{error:'Product IDs must be unique.'});
        fs.mkdirSync(DATA_DIR,{recursive:true});
        const temp=path.join(DATA_DIR,`.catalog-${crypto.randomUUID()}.tmp`);
        fs.writeFileSync(temp,JSON.stringify({products:body.products},null,2),'utf8');
        fs.renameSync(temp,CATALOG_PATH);
        send(res,200,{ok:true,count:body.products.length});
      } catch { send(res,400,{error:'Invalid catalog payload.'}); }
    });
    return;
  }
  if(req.method!=='GET' && req.method!=='HEAD') return send(res,405,{error:'Method not allowed.'});
  let pathname;
  try { pathname=decodeURIComponent(url.pathname); } catch { return send(res,400,{error:'Invalid path.'}); }
  if(pathname==='/') pathname='/index.html';
  const target=path.resolve(ROOT,`.${pathname}`);
  if(target!==ROOT && !target.startsWith(ROOT+path.sep)) return send(res,403,{error:'Forbidden.'});
  fs.stat(target,(err,stat)=>{
    if(err || !stat.isFile()) return send(res,404,{error:'Not found.'});
    res.writeHead(200,{'Content-Type':MIME[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    if(req.method==='HEAD') return res.end();
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT,HOST,()=>console.log(`Forme MVP running at http://${HOST}:${server.address().port}`));
