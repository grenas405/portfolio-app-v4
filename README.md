# portfolio-app-v4

Pedro M. Dominguez's portfolio: "One person, one paradigm shift." A single-page site for Oklahoma City local businesses and nonprofits, served by a Cloudflare Worker.

## Stack

- **Cloudflare Workers** (TypeScript) for routing, the contact API and security headers
- **Workers KV** (`CONTACT_KV`) for contact messages and rate-limit counters
- **Plain HTML, CSS and ES modules** in `public/`, with no build step for the frontend
- **anime.js v4** (vendored) for the intro, menu and section animations
- **Vitest** with `@cloudflare/vitest-plugin` for tests that run inside the Workers runtime

## Layout

```
src/                 Worker (TypeScript)
  index.ts           entry: route -> handler -> security headers
  router.ts          pure (method, path) -> Route
  contact/           POST /api/contact: validation and handler
  health/            GET /api/health
  http/              response builders, static asset serving
  security/          CSP/OWASP headers, origin check, bounded body, KV rate limit
  lib/result.ts      Result type (no throwing for expected failures)
public/              static assets (served through the ASSETS binding)
  html/              index.html, 404.html
  css/               tokens, base, layout, nav, hero, sections, motion
  js/                main.js entry, one module per feature, lib/ helpers, vendor/
tests/               unit and integration tests
scripts/             vendor_assets.mjs copies anime.js and fonts from node_modules
```

## Commands

```sh
npm install
npm run dev        # wrangler dev on http://localhost:8787
npm run check      # typecheck + tests
npm run vendor     # re-copy anime.js and fonts after upgrading them
npm run deploy     # wrangler deploy
```

Before the first deploy, create the KV namespace and paste its id into `wrangler.jsonc`:

```sh
npx wrangler kv namespace create CONTACT_KV
```

## API

| Method | Path           | Notes |
|--------|----------------|-------|
| GET    | `/api/health`  | `{ status, version, time }` |
| POST   | `/api/contact` | JSON body: `name`, `email`, `message`, optional `phone`, `organization`. Same-origin only, 8 KB max, 5 messages per 10 minutes per client. Returns 201, 403, 413, 415, 422 or 429. |

Messages are stored in KV under `msg:<ISO time>:<uuid>` for 90 days. List them with:

```sh
npx wrangler kv key list --binding CONTACT_KV --prefix msg: --remote
```

## Security

- Strict CSP (`default-src 'none'`, `script-src 'self'`, `style-src 'self'`): no inline scripts, styles or third-party origins. Fonts and anime.js are self-hosted.
- HSTS, `nosniff`, `X-Frame-Options: DENY`, COOP/CORP, a restrictive Permissions-Policy and Referrer-Policy on every response.
- The contact endpoint checks Origin and Fetch Metadata, caps the body size, validates with an allow-list on the server, has a honeypot field, and rate-limits by a SHA-256 hash of the client IP (raw IPs are never stored).
- Error responses never include internal details.

## Motion and accessibility

- One orchestrated moment: an intro curtain (first visit per session) leading into the hero reveal over the canvas globe.
- `prefers-reduced-motion` turns off the intro, the globe loop, tilt and magnetic effects.
- If JavaScript fails, CSS failsafes reveal the content after 5 seconds.
- The menu is a modal dialog with a focus trap, Escape to close, and `inert` on the page behind it.
