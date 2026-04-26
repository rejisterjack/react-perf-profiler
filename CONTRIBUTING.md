# Contributing

Thanks for helping improve React Perf Profiler.

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) 8.x (see `packageManager` in [package.json](./package.json))

## Setup

```bash
pnpm install
pnpm run dev
```

Load `dist-chrome/` as an unpacked extension (see the main [README](./README.md)).

## Biome / lint

- `pnpm run lint` exits cleanly on **errors**; many a11y and style rules are set to **warn** so CI stays green while you iterate. `**/*.module.css` is ignored because Biome’s CSS parser does not support `:local` / `:global` (Vite CSS modules).
- `src/cli/**/*.ts` disables `noConsole` (CLI is meant to write to stdout).
- Tighten rules back toward `error` over time as warnings are fixed.

## Commands

| Command | Purpose |
|--------|---------|
| `pnpm run lint` / `pnpm run format:check` | Style (Biome) |
| `pnpm run typecheck` | TypeScript |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm run test:e2e` | Playwright (requires build + browsers) |
| `pnpm run build` | Chrome extension output |
| `pnpm run build:firefox` | Firefox extension output |
| `pnpm run build:cli` | Compile perf-check sources (sanity check) |
| `node scripts/perf-check-run.mjs` | Run perf budget CLI with path-alias resolution |

## Pull requests

1. Keep changes focused on one concern when possible.
2. Run `pnpm run lint`, `pnpm run typecheck`, and `pnpm test` before pushing.
3. If you change user-visible behavior, update relevant docs or in-app copy.
4. Google Drive can be omitted from a build with `VITE_DISABLE_GOOGLE_DRIVE_SYNC=true` (see README).

## Security

Do not open public issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md).
