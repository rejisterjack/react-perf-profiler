# Roadmap

High-level direction aligned with the project goals (trust, correctness, distribution). Items are not guaranteed ordering.

## Near term

- Optional narrowing of `host_permissions` (spike: active-tab-only mode tradeoffs for DevTools workflows). See [docs/PERMISSIONS_SPIKE.md](docs/PERMISSIONS_SPIKE.md).
- Google Drive: PKCE + refresh token flow is implemented; keep OAuth client redirect URIs in sync with `chrome.identity.getRedirectURL()`.
- Expand golden fixtures for analysis workers and snapshot stability of `checkPerformanceBudget` outputs.

## Medium term

- React 19 / DevTools matrix automation in CI where feasible.
- Further panel code-splitting and lazy routes for heavy views (3D, marketplace) on both Chrome and Firefox builds.
- Store listings: privacy policy page, permission justification copy, screenshots.

## Ongoing

- Dependency and security audits (`pnpm audit` in CI).
- Accessibility passes on high-traffic panel views (keyboard and focus).

See [GitHub Issues](https://github.com/rejisterjack/react-perf-profiler/issues) for concrete work items.
