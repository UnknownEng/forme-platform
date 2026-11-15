import { esc, reveal } from './ui.js';

const EXAMPLES = {
  'POST /v1/recommend': `curl -X POST ${location.origin}/v1/recommend \\
  -H "Authorization: Bearer pk_live_…" -H "Content-Type: application/json" \\
  -d '{"sku":"NL-TEE-01","profile":{"height":178,"weight":76,"fit":"Regular"}}'`,
  'PUT /v1/products/{sku}': `curl -X PUT ${location.origin}/v1/products/TEE-001 \\
  -H "Authorization: Bearer sk_live_…" -H "Content-Type: application/json" \\
  -d '{"name":"Everyday Tee","brand":"Acme","category":"T-shirts","fit":"Regular","price":1490,
       "chart":[{"size":"S","chest":98,"length":68},{"size":"M","chest":104,"length":70},{"size":"L","chest":110,"length":72}]}'`,
  'POST /v1/feedback': `curl -X POST ${location.origin}/v1/feedback \\
  -H "Authorization: Bearer sk_live_…" -H "Content-Type: application/json" \\
  -d '{"sku":"TEE-001","size":"M","outcome":"too_small","rec_id":"rec_…"}'`,
  'POST /v1/profiles': `curl -X POST ${location.origin}/v1/profiles \\
  -H "Authorization: Bearer pk_live_…" -H "Content-Type: application/json" \\
  -d '{"height":165,"weight":58,"fit":"Relaxed"}'
# → { "profile_token": "fp_…", "profile": {…} }  Store the token on the shopper's device.`,
};

function schemaRows(spec, schema) {
  if (!schema) return '';
  if (schema.$ref) schema = spec.components.schemas[schema.$ref.split('/').pop()];
  const props = schema.properties || {};
  const req = new Set(schema.required || []);
  return `<table><thead><tr><th>Field</th><th>Type</th><th>Notes</th></tr></thead><tbody>${Object.entries(props).map(([k, v]) => {
    const t = v.$ref ? v.$ref.split('/').pop() : v.enum ? v.enum.join(' | ') : v.type === 'array' ? `array of ${v.items?.$ref ? v.items.$ref.split('/').pop() : v.items?.type || 'object'}` : [].concat(v.type || 'object').join(' | ');
    return `<tr><td>${esc(k)}${req.has(k) ? ' <span style="color:var(--coral)">*</span>' : ''}</td><td class="mono" style="font-size:12px">${esc(t)}</td><td>${esc(v.description || '')}</td></tr>`;
  }).join('')}</tbody></table>`;
}

const spec = await fetch('/openapi.json').then(r => r.json());
const eps = [];
for (const [path, ops] of Object.entries(spec.paths)) for (const [method, op] of Object.entries(ops)) eps.push({ path, method, op, id: `${method}-${path}`.replace(/[^a-z0-9]+/gi, '-') });

document.getElementById('toc').insertAdjacentHTML('beforeend', `<h4>GUIDE</h4><a class="ep" href="#auth">Authentication</a><a class="ep" href="#errors">Errors and limits</a><a class="ep" href="#flow">Typical integration</a><h4>ENDPOINTS</h4>` +
  eps.map(e => `<a class="ep" href="#${e.id}"><span class="m ${e.method}">${e.method.toUpperCase()}</span>${esc(e.path)}</a>`).join(''));

document.getElementById('endpoints').innerHTML = eps.map(e => {
  const body = e.op.requestBody?.content?.['application/json']?.schema;
  const ex = EXAMPLES[`${e.method.toUpperCase()} ${e.path}`];
  const keyNote = e.op.security && !e.op.security.length ? 'No key required.' : /secret key/i.test(e.op.summary) ? 'Secret key.' : 'Publishable or secret key.';
  return `<section class="endpoint glass" id="${e.id}" data-reveal><div class="endpoint-h"><span class="m ${e.method}">${e.method.toUpperCase()}</span><code>${esc(e.path)}</code></div>
    <p><b style="color:var(--text)">${esc(e.op.summary)}</b>${e.op.description ? ` ${esc(e.op.description)}` : ''} <span class="muted">${keyNote}</span></p>
    ${body ? schemaRows(spec, body) : ''}${ex ? `<pre>${esc(ex)}</pre>` : ''}
    <p class="muted" style="font-size:13px">Responses: ${Object.entries(e.op.responses).map(([c, r]) => `<code>${c}</code> ${esc(r.description)}`).join(' · ')}</p></section>`;
}).join('') + `<h2>Schemas</h2><section class="endpoint glass"><div class="endpoint-h"><code>Recommendation</code></div>${schemaRows(spec, { $ref: '#/components/schemas/Recommendation' })}</section>
  <section class="endpoint glass"><div class="endpoint-h"><code>Profile</code></div>${schemaRows(spec, { $ref: '#/components/schemas/Profile' })}</section>
  <section class="endpoint glass"><div class="endpoint-h"><code>ChartRow</code></div><p>All measurements are garment measurements in centimetres. Tops need <code>chest</code>; bottoms need <code>waist</code>; dresses need <code>chest</code> and <code>waist</code>.</p>${schemaRows(spec, { $ref: '#/components/schemas/ChartRow' })}</section>`;
reveal();
