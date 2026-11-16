// Garment illustrations, drawn as SVG so they stay crisp and themeable.
export const SWATCHES = ['#c6ff3d', '#3ddc97', '#9b6cff', '#4fa3ff', '#ff5ca8', '#ffd43b', '#ff7a2f', '#3d5afe'];

const SHAPES = {
  tee: {
    body: 'M62 26 82 16c6 14 30 14 36 0l20 10 44 34-22 30-22-14v140H62V76L40 90 18 60Z',
    detail: '<path d="M82 16c6 16 30 16 36 0" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.2"/><path d="M62 76v140M138 76v140" stroke="rgba(0,0,0,.12)" stroke-width="2"/>',
  },
  shirt: {
    body: 'M62 24 84 14l16 12 16-12 22 10 40 38-8 120-18 2-6-104v136H62V80l-6 104-18-2-8-120Z',
    detail: '<path d="m84 14 16 26 16-26M100 40v176" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"/><g fill="rgba(0,0,0,.25)"><circle cx="100" cy="64" r="2.4"/><circle cx="100" cy="98" r="2.4"/><circle cx="100" cy="132" r="2.4"/><circle cx="100" cy="166" r="2.4"/></g><path d="M116 70h16v16h-16z" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2"/>',
  },
  hoodie: {
    body: 'M60 34c4-22 20-30 40-30s36 8 40 30l40 30-10 120-20 2-6-102v134H56V84l-6 102-20-2-10-120Z',
    detail: '<path d="M74 40c6 22 46 22 52 0" fill="rgba(0,0,0,.18)"/><path d="M92 58v28M108 58v28" stroke="rgba(255,255,255,.7)" stroke-width="2.2" stroke-linecap="round"/><path d="M70 150h60l8 40H62Z" fill="rgba(0,0,0,.12)"/><path d="M56 206h88" stroke="rgba(0,0,0,.2)" stroke-width="6"/>',
  },
  jacket: {
    body: 'M58 24 82 12l18 18 18-18 24 12 40 38-8 126-20 2-4-108v134H58V82l-4 108-20-2-8-126Z',
    detail: '<path d="M82 12 92 56l8-26 8 26 10-44" fill="rgba(0,0,0,.16)" stroke="rgba(255,255,255,.45)" stroke-width="1.8"/><path d="M100 56v160" stroke="rgba(0,0,0,.25)" stroke-width="2"/><path d="M66 120h26v28H66zM108 120h26v28h-26zM110 74h20v18h-20z" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="2"/>',
  },
  jeans: {
    body: 'M56 10h88l8 206h-40l-12-140-12 140H48Z',
    detail: '<path d="M56 26h88" stroke="rgba(0,0,0,.25)" stroke-width="3"/><path d="M100 26v46" stroke="rgba(0,0,0,.25)" stroke-width="2"/><path d="M62 30c4 18 18 22 28 22M138 30c-4 18-18 22-28 22" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.8"/><path d="M48 206h40M112 206h40" stroke="rgba(0,0,0,.18)" stroke-width="5"/>',
  },
  kurta: {
    body: 'M66 14 86 6c4 10 24 10 28 0l20 8 38 36-18 26-20-14v134l8 26H56l8-26V62L44 76 26 50Z',
    detail: '<path d="M90 8v52M110 8v52" stroke="rgba(0,0,0,.18)" stroke-width="2"/><path d="M100 10v70" stroke="rgba(0,0,0,.3)" stroke-width="2.2"/><g fill="rgba(0,0,0,.3)"><circle cx="100" cy="30" r="2.3"/><circle cx="100" cy="48" r="2.3"/><circle cx="100" cy="66" r="2.3"/></g><path d="M64 180 56 216M136 180l8 36" stroke="rgba(0,0,0,.28)" stroke-width="2"/><path d="M66 120h68M70 140h60" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-dasharray="4 6"/>',
  },
  dress: {
    body: 'M78 10h10c2 12 22 12 24 0h10l6 26-8 46 52 134H28l52-134-8-46Z',
    detail: '<path d="M72 82h56" stroke="rgba(0,0,0,.28)" stroke-width="4"/><path d="M96 82c-6 10-10 22-8 30M104 82c6 10 10 22 8 30" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/><path d="M88 10c2 14 22 14 24 0" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"/><path d="M60 216 92 90M140 216 108 90" stroke="rgba(255,255,255,.18)" stroke-width="2"/>',
  },
};

const KIND = { 'T-shirts': 'tee', Shirts: 'shirt', Knitwear: 'shirt', Hoodies: 'hoodie', Jackets: 'jacket', Jeans: 'jeans', Trousers: 'jeans', Shorts: 'jeans', Dresses: 'dress', Kurtas: 'kurta', 'Shalwar Kameez': 'kurta' };
let uid = 0;

export function garment(category, color = 0) {
  const shape = SHAPES[KIND[category] || category] || SHAPES.tee;
  const c = typeof color === 'number' ? SWATCHES[color % SWATCHES.length] : color;
  const id = `g${++uid}`;
  return `<svg viewBox="0 0 200 222" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="color-mix(in srgb, ${c} 55%, #10151b)"/></linearGradient>
  <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  <path d="${shape.body}" fill="url(#${id})" stroke="rgba(0,0,0,.35)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="${shape.body}" fill="url(#${id}s)"/>${shape.detail}</svg>`;
}

export function artBox(category, color = 0, cls = '') {
  const c = typeof color === 'number' ? SWATCHES[color % SWATCHES.length] : color;
  return `<div class="art ${cls}" style="--c:${c}">${garment(category, color)}</div>`;
}
