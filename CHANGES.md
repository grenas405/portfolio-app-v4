# Changes

## 1.0.0 (2026-10-16)

- Cloudflare Worker with routing, `GET /api/health` and `POST /api/contact` (KV storage, server-side validation, honeypot, origin check, body size limit, KV rate limiting).
- OWASP security headers and a strict CSP on every response; custom 404 page.
- Landing page: canvas globe hero with requests leaving Oklahoma City for Cloudflare edge cities, intro curtain, full-screen menu with a live Oklahoma City clock, agency vs one-person comparison, terminal replay, client case studies with phone tilt, story timeline, process, pricing and contact form.
- Plain CSS on design tokens; self-hosted Bricolage Grotesque, Inter and JetBrains Mono; vendored anime.js v4.
- Reduced-motion support and no-JS failsafes.
- 32 tests (unit and Workers-runtime integration) with `@cloudflare/vitest-plugin`.
