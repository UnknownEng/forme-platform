// OpenAPI 3.1 description of the public API, served at /openapi.json and
// rendered by /docs.
const { CATEGORIES, FITS, BUILDS, SEXES } = require('./engine');

module.exports = function spec(version) {
  const ref = n => ({ $ref: `#/components/schemas/${n}` });
  const json = schema => ({ content: { 'application/json': { schema } } });
  const err = { description: 'Error', ...json(ref('Error')) };
  return {
    openapi: '3.1.0',
    info: { title: 'Forme Fit API', version: '1.0.0', description: `Size recommendations from one portable shopper fit profile. Engine ${version}.` },
    servers: [{ url: '/' }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', description: 'pk_live_… (browser) or sk_live_… (server)' } },
      schemas: {
        Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } } } },
        Profile: { type: 'object', required: ['height'], properties: {
          height: { type: 'number', description: 'cm, 120–225' }, weight: { type: 'number', description: 'kg, optional' },
          chest: { type: 'number' }, waist: { type: 'number' }, hips: { type: 'number' }, shoulders: { type: 'number' }, inseam: { type: 'number' },
          fit: { enum: FITS }, build: { enum: BUILDS }, sex: { enum: SEXES, description: 'Which size range the shopper buys from. Optional; improves estimates.' } } },
        ChartRow: { type: 'object', required: ['size'], properties: { size: { type: 'string' }, chest: { type: 'number' }, waist: { type: 'number' }, hips: { type: 'number' }, shoulders: { type: 'number' }, length: { type: 'number' }, inseam: { type: 'number' } } },
        Product: { type: 'object', required: ['name', 'brand', 'category', 'chart'], properties: {
          sku: { type: 'string' }, name: { type: 'string' }, brand: { type: 'string' }, category: { enum: CATEGORIES }, fit: { enum: FITS },
          price: { type: 'number' }, description: { type: 'string' }, image_url: { type: 'string' }, chart: { type: 'array', items: ref('ChartRow') } } },
        Recommendation: { type: 'object', properties: {
          rec_id: { type: 'string' }, sku: { type: 'string' }, size: { type: 'string' }, confidence: { type: 'integer', description: '30–98' },
          label: { type: 'string' }, alternative: { type: ['object', 'null'], properties: { size: { type: 'string' }, reason: { type: 'string' } } },
          fit_notes: { type: 'array', items: { type: 'object', properties: { area: { type: 'string' }, fit: { enum: ['snug', 'ideal', 'roomy', 'short', 'long'] }, delta_cm: { type: 'number' } } } },
          estimated: { type: 'array', items: { type: 'string' } }, calibration: { type: 'object', properties: { samples: { type: 'integer' }, shift_cm: { type: 'number' } } },
          engine_version: { type: 'string' } } },
      },
    },
    paths: {
      '/v1/health': { get: { summary: 'Service health', security: [], responses: { 200: { description: 'OK' } } } },
      '/v1/recommend': { post: { summary: 'Recommend a size for one product', description: 'Publishable or secret key. Send either profile or profile_token.',
        requestBody: json({ type: 'object', required: ['sku'], properties: { sku: { type: 'string' }, profile: ref('Profile'), profile_token: { type: 'string' } } }),
        responses: { 200: { description: 'Recommendation', ...json(ref('Recommendation')) }, 400: err, 404: err } } },
      '/v1/recommend/batch': { post: { summary: 'Sizes for up to 60 products (listing pages)', requestBody: json({ type: 'object', required: ['skus'], properties: { skus: { type: 'array', items: { type: 'string' } }, profile: ref('Profile'), profile_token: { type: 'string' } } }), responses: { 200: { description: 'Results' } } } },
      '/v1/profiles': { post: { summary: 'Create a portable shopper profile', requestBody: json(ref('Profile')), responses: { 201: { description: 'profile_token + profile' } } } },
      '/v1/profiles/me': {
        get: { summary: 'Read a profile (X-Forme-Profile header)', responses: { 200: { description: 'Profile' }, 404: err } },
        put: { summary: 'Replace a profile', requestBody: json(ref('Profile')), responses: { 200: { description: 'Profile' } } },
        delete: { summary: 'Delete a profile (right to erasure)', responses: { 200: { description: 'Deleted' } } },
      },
      '/v1/events': { post: { summary: 'Track a funnel event', description: 'sku must be in your catalog and rec_id must be a real recommendation. Purchases sent with a publishable key must cite the rec_id, count once per recommendation and are capped near the catalog price; send purchases from your server with a secret key for billing-grade revenue.', requestBody: json({ type: 'object', required: ['type'], properties: { type: { enum: ['widget_open', 'size_selected', 'add_to_cart', 'purchase'] }, sku: { type: 'string' }, rec_id: { type: 'string' }, size: { type: 'string' }, value: { type: 'number' } } }), responses: { 202: { description: 'Accepted' } } } },
      '/v1/feedback': { post: { summary: 'Report a keep/return outcome (secret key)', description: 'Feeds per-product calibration.', requestBody: json({ type: 'object', required: ['sku', 'size', 'outcome'], properties: { sku: { type: 'string' }, size: { type: 'string' }, outcome: { enum: ['kept', 'too_small', 'too_large', 'returned_other'] }, rec_id: { type: 'string' } } }), responses: { 201: { description: 'Stored' } } } },
      '/v1/products': { get: { summary: 'List catalog (secret key)', responses: { 200: { description: 'Products' } } } },
      '/v1/products/{sku}': {
        get: { summary: 'Get a product and size chart', parameters: [{ name: 'sku', in: 'path', required: true }], responses: { 200: { description: 'Product' }, 404: err } },
        put: { summary: 'Create or update a product (secret key)', parameters: [{ name: 'sku', in: 'path', required: true }], requestBody: json(ref('Product')), responses: { 200: { description: 'Updated' }, 201: { description: 'Created' }, 400: err } },
        delete: { summary: 'Delete a product (secret key)', parameters: [{ name: 'sku', in: 'path', required: true }], responses: { 200: { description: 'Deleted' } } },
      },
      '/v1/products/bulk': { post: { summary: 'Upsert up to 2000 products (secret key)', requestBody: json({ type: 'object', properties: { products: { type: 'array', items: ref('Product') } } }), responses: { 200: { description: 'created / updated / failed' } } } },
    },
  };
};
