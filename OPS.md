# Operations runbook

This document captures the production-readiness decisions, the operational
items that require infrastructure provisioning (and therefore live outside
the codebase), and the runbooks for common incidents.

It is the companion to the [Production-Readiness Audit & Master Plan](.cursor/plans/)
— items marked "infra" in Phase 5 are documented here.

## 1. Scaling ingestion (QStash / Inngest + pooled DB + Redis cache + CDN)

The `/api/profiles` POST handler currently writes synchronously to Postgres
via Prisma. At expected launch volume (a few hundred uploads per day) this is
fine. The architectural escape hatch when volume grows:

| Layer          | Current            | Target (when needed)                                                | Trigger                          |
| -------------- | ------------------ | ------------------------------------------------------------------- | -------------------------------- |
| Write path     | Sync Prisma write  | **QStash** or **Inngest** queue → background worker                 | p95 write latency > 500 ms       |
| DB connections | Direct URL         | **PgBouncer** / Vercel Pooler / Neon pooler (`?connection_limit=1`) | Connection exhaustion errors     |
| Read path      | Direct Prisma read | **Redis** cache keyed by `profile:{id}` (TTL 5 min)                 | Hot profile read rate > 50 req/s |
| Static assets  | Vercel CDN         | **Cloudflare CDN** in front of Vercel for the marketing site        | Global p95 TTFB > 200 ms         |

**Action:** none today. Re-evaluate at 1k uploads/day.

## 2. Database backup & retention (PITR)

The Postgres provider (whichever of Neon / Supabase / RDS is chosen at deploy
time) is responsible for backups. Required configuration:

| Setting                       | Value                                                                |
| ----------------------------- | -------------------------------------------------------------------- |
| Point-in-time recovery (PITR) | Enabled, 7-day retention minimum                                     |
| Daily logical backup          | Offsite (S3 / GCS), 30-day retention                                 |
| Retention on `Profile` rows   | TTL job deletes profiles older than 365 days unless `isPublic: true` |

**Action:** enable PITR on the production DB at provision time. Document the
provider-specific command in the deploy runbook once the provider is chosen.

## 3. Real plugin sandbox (Web Worker)

Today the extension's analyzer runs in a Web Worker (good), but third-party
plugins (loaded via the `Plugin` model) run in the panel's main thread (bad —
a misbehaving plugin can hang the UI). Phase 5 calls for a real sandbox.

**Target:** move third-party plugin execution into a dedicated Web Worker
spawned per-plugin, with a capability-based message protocol (no DOM access,
no `fetch` to arbitrary origins — only declared webhook URLs).

**Action:** this is a follow-up tracked in `apps/ext/ROADMAP.md`. Until then,
the plugin system is documented as "load at your own risk" in the
`Plugin` model's `description`.

## 4. SESSION_TOKEN verification

**Implemented.** The bridge and content script now exchange and verify a
per-session random token on every `postMessage`. See
[`apps/ext/entrypoints/bridge.content/index.ts`](apps/ext/entrypoints/bridge.content/index.ts)
and
[`apps/ext/entrypoints/content.ts`](apps/ext/entrypoints/content.ts).

## 5. COMMIT_BATCH bundling

**Implemented.** The bridge already batches commits into a 50 ms / 50-item
window before flushing to the service worker. No further action.

## 6. Extension Sentry crash reporting

The extension has an `integrations/sentryReporter.ts` stub. To activate:

1. Provision a Sentry project (browser-extensions type).
2. Set `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` in `apps/ext/.env`.
3. Wire `Sentry.init` into `apps/ext/entrypoints/background.ts`.
4. Wrap the bridge's `try/catch` blocks with `Sentry.captureException`.

**Action:** tracked in `apps/ext/ROADMAP.md`. Not blocking launch — the
extension fails closed (silently) today, which is acceptable for v1.

## 7. Docs site with architecture diagrams

The repo root `README.md` now includes a Mermaid architecture diagram
(rendered by GitHub). A standalone docs site (e.g. Mintlify / Fumadocs) is a
follow-up once the API stabilizes.

## 8. Test coverage to 70%

Current coverage is concentrated in the analyzer (3 test files). Targets:

| Package                                   | Current | Target |
| ----------------------------------------- | ------- | ------ |
| `@react-perf-profiler/analyzer`           | ~40%    | 80%    |
| `apps/web` API routes                     | 0%      | 70%    |
| `apps/web` `lib/*`                        | 0%      | 70%    |
| `packages/profile-contract` (Zod schemas) | 0%      | 90%    |

**Action:** add Vitest to `apps/web` and unit tests for the auth helpers,
the pagination cursor logic, and the contract schemas. Tracked in
`apps/ext/ROADMAP.md`.

## Incident runbooks

### "Users report 500s on profile upload"

1. Check the `X-Request-Id` header from the user's error envelope.
2. `grep` the structured logs (Vercel → log drain) for that `requestId`.
3. Common causes:
   - `PAYLOAD_TOO_LARGE` → user exceeded 10 MB; ask them to filter the profile.
   - Prisma `P1001` (connection timeout) → DB is saturated; see §1.
   - Zod `VALIDATION_ERROR` → extension is sending a malformed payload; check the contract version.

### "Login returns 401 immediately"

1. Confirm the user's clock isn't skewed (JWTs have a 30s leeway).
2. If using a refresh token older than 30 d, the user must re-authenticate.
3. If `NEXTAUTH_SECRET` was rotated, all outstanding tokens are invalid by design.

### "Extension can't connect to bridge"

1. Verify the target app is in **development** mode (`NODE_ENV !== production`).
2. Confirm React DevTools is detected (the bridge relies on the same global hook).
3. Check the bridge content script loaded without errors (`chrome://extensions` → inspect).
