# Store release checklist (operator)

Use [Release Checklist](./RELEASE_CHECKLIST.md) for full pre-release QA, coverage, and monitoring. This page is only the minimal tag → zip → store steps.

## Before tagging

1. `pnpm install --frozen-lockfile`
2. `pnpm run lint` (errors must be clean; warnings are acceptable per [CONTRIBUTING.md](../CONTRIBUTING.md))
3. `pnpm test` and `pnpm run typecheck`
4. `pnpm run build` and `pnpm run build:firefox`
5. Optional: `pnpm run test:e2e` (Chromium) after `pnpm run build`
6. Update [CHANGELOG.md](../CHANGELOG.md) and bump `version` in [package.json](../package.json), [src/manifest.json](../src/manifest.json), [src/manifest-firefox.json](../src/manifest-firefox.json) if you version manifests with the product.

## Privacy and listings

1. Confirm [docs/store-assets/privacy/index.html](store-assets/privacy/index.html) matches policy intent.
2. Run or verify GitHub Pages deploy ([.github/workflows/pages.yml](../.github/workflows/pages.yml)); copy HTTPS URL into both store consoles.
3. Paste text from [docs/store-assets/listing/](store-assets/listing/) and [PERMISSION_JUSTIFICATION.md](store-assets/PERMISSION_JUSTIFICATION.md).

## Create release

```bash
git tag v1.0.1   # example
git push origin v1.0.1
```

[.github/workflows/release.yml](../.github/workflows/release.yml) builds zips and attaches them to a GitHub Release.

## Submit builds

- **Chrome:** Upload `react-perf-profiler-chrome-v*.zip` from the release asset.
- **Firefox:** Upload `react-perf-profiler-firefox-v*.zip` (or follow AMO packaging rules) and use [AMO_SUBMISSION_NOTES.md](store-assets/AMO_SUBMISSION_NOTES.md).

## After approval

Replace placeholder screenshots in [docs/store-assets/screenshots/](store-assets/screenshots/) and refresh store media.
