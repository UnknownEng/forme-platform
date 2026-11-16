# Forme: fit intelligence for fashion platforms

Forme gives every shopper one portable fit profile and recommends the right size for every product in a retailer's catalog. It ships as:

| Piece | Where | What it is |
|---|---|---|
| Landing page | `/` | Animated sales site with a live engine demo, ROI calculator, integration code and pricing |
| Merchant console | `/console` | Sign up / sign in, analytics dashboard, catalog and size-chart editor with live preview, fit insights, API keys, widget settings |
| Demo store | `/demo` | A fictional retailer with the widget installed exactly as a customer would |
| Widget | `/widget.js` | One script tag + `<div data-forme-sku>`; shadow-DOM isolated, works on any storefront |
| REST API | `/v1/*` | Recommend, batch recommend, profiles, events, feedback, catalog sync |
| API docs | `/docs`, `/openapi.json` | Rendered reference + OpenAPI 3.1 spec |

## Live

- Site: https://forme-platform.vercel.app
- Console: https://forme-platform.vercel.app/console (press **Open demo**)
- Demo store: https://forme-platform.vercel.app/demo
- API docs: https://forme-platform.vercel.app/docs

### Deploying on Vercel
Import the repo on Vercel and add one environment variable, **`FORME_SECRET`** (any long random string). It signs console logins so they work on every serverless instance. Vercel functions have no permanent disk: the demo workspace is rebuilt identically on each instance, but new sign-ups and live events are not kept. Move to Postgres before onboarding real customers.

## Videos

`video/` renders the product walkthrough and the narrated pitch (needs Chrome and ffmpeg):

```sh
cd video && npm install
node walkthrough.js
node pitch.js forme-platform.vercel.app
```

## Run it

Needs **Node.js 22.13 or later** (uses the built-in `node:sqlite`). No `npm install` needed: there are zero third-party dependencies.

```sh
npm start
```

Open http://127.0.0.1:4173. On first start a demo workspace is created with 10 products and 60 days of synthetic traffic.

- Demo console login: `demo@forme.dev` / `forme-demo-2026` (or press **Open demo** on the sign-in page)
- Use the demo store, then watch the events arrive in the console's **Live activity** feed.

```sh
npm test        # 18 engine + API tests against a temporary database
npm run dev     # restart on file changes
```

Environment variables: `PORT` (default 4173), `HOST` (default 127.0.0.1), `FORME_DATA_DIR` (default `./data`), `FORME_SEED=0` (skip the demo workspace), `FORME_SECURE_COOKIES=1` (behind HTTPS), `FORME_LOG=0` (quiet request log).

## Architecture

```
server.js            entry point
src/app.js           HTTP server, CORS, routing, static files
src/routes/public.js /v1 API (API-key auth: pk_live_ browser keys, sk_live_ server keys)
src/routes/console.js /api for the console (cookie session + CSRF header)
src/engine.js        fit engine: body estimation, ease by fit preference and garment cut,
                     weighted scoring, confidence, fit notes, between-size alternatives,
                     per-product calibration from return feedback
src/services.js      catalog, recommendations, events, feedback, analytics, insights
src/db.js            SQLite schema (merchants, sessions, api_keys, products, profiles,
                     recommendations, events, feedback)
src/auth.js          scrypt passwords, hashed session tokens, hashed secret keys
src/validate.js      strict input validation with precise error messages
src/seed.js          demo workspace + synthetic traffic
public/              landing, console, demo store, docs, widget
legacy-mvp/          the original MVP, kept for reference
```

### Security already in place
- Passwords hashed with scrypt; constant-time login checks.
- Session tokens and secret API keys are stored only as SHA-256 hashes. Secret keys are shown once.
- Console mutations need a `X-Forme-Request` header on top of an HttpOnly SameSite=Lax cookie (CSRF).
- Publishable keys can be locked to allowed origins; secret keys are refused when sent from a browser.
- Rate limits per key, per IP and on login/signup. Body size limits. Strict CSP on all pages.
- Shopper profiles hold body measurements only; `DELETE /v1/profiles/me` erases them ("Forget me" in the widget).

### What a production launch still needs
This is a complete, working product you can demo and pilot, but before running it for a large platform you should add:
1. **Hosting**: HTTPS, a domain, `FORME_SECURE_COOKIES=1`, and a CDN for `widget.js`.
2. **Database**: SQLite is fine for a pilot on one server. For multiple servers, move to Postgres and move rate limits to Redis.
3. **Accounts**: password reset, email verification, team members/roles, SSO for enterprise.
4. **Billing**: metered usage (recommendations per month) via a payment provider.
5. **Shopper identity across stores**: the profile token works across every merchant, but browsers isolate storage per site, so true cross-store reuse needs a Forme sign-in (e.g. phone OTP) or partner-level account linking.
6. **Fit model**: validate the engine against real brand charts and real return data; the calibration loop is built in.
7. **Legal**: privacy policy, DPA, consent text in the widget, and compliance review for your markets (e.g. Pakistan's data protection rules and PECA, GDPR for EU shoppers).
8. **Ops**: backups, monitoring/alerting, error tracking, uptime SLA.

See [BUSINESS.md](BUSINESS.md) for the business analysis and go-to-market notes.
