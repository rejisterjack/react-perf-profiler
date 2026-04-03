# Roadmap

High-level direction aligned with the project goals (trust, correctness, distribution). Items are not guaranteed ordering.

## Near term

- Optional narrowing of `host_permissions` (spike: active-tab-only mode tradeoffs for DevTools workflows).
- Google Drive: authorization-code flow with refresh tokens (behind the same experimental flag until stable).
- Expand golden fixtures for analysis workers and snapshot stability of `checkPerformanceBudget` outputs.

## Medium term

- React 19 / DevTools matrix automation in CI where feasible.
- Further panel code-splitting and lazy routes for heavy views (3D, marketplace) on both Chrome and Firefox builds.
- Store listings: privacy policy page, permission justification copy, screenshots.

## Ongoing

- Dependency and security audits (`pnpm audit` in CI).
- Accessibility passes on high-traffic panel views (keyboard and focus).

See [GitHub Issues](https://github.com/rejisterjack/react-perf-profiler/issues) for concrete work items.
