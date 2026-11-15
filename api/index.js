// Vercel serverless entry. One function serves the API, the console pages and
// any file not already served by Vercel's CDN from /public.
const { createApp } = require('../src/app');

const { handler } = createApp({ LOG_REQUESTS: false });

module.exports = handler;
