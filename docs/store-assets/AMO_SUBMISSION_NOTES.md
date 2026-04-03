# Firefox Add-ons (AMO) — submission notes template

Paste or adapt for each version submission.

## Build reproducibility

- **Repository:** https://github.com/rejisterjack/react-perf-profiler
- **Git tag:** `vVERSION` (match submitted version)
- **Commands:**
  - `pnpm install --frozen-lockfile`
  - `pnpm run build:firefox`
- **Artifact:** Zip contents of `dist-firefox/` (as produced by [.github/workflows/release.yml](../../.github/workflows/release.yml))

## Minified / bundled code

The panel bundle is minified by Vite for production. Full TypeScript source is on GitHub at the tag above. No obfuscation beyond standard minification.

## Permissions

See [PERMISSION_JUSTIFICATION.md](./PERMISSION_JUSTIFICATION.md).

## Privacy

Canonical policy URL: see [STORE_ASSETS.md](../STORE_ASSETS.md) (GitHub Pages). Optional cloud sync and cloud LLM are user-configured; default use is local.

## Notes for reviewers

- Extension is **developer tooling** (DevTools panel), not general audience.
- Broad host permission supports debugging React apps on arbitrary dev/staging URLs.
