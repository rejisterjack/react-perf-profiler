# Screenshots

This directory is for **documentation** images (README, guides). **Store listing** captures belong in [../store-assets/screenshots/](../store-assets/screenshots/).

## Required screenshots

| Screenshot | Description | Status |
|------------|-------------|--------|
| `flamegraph.png` | Flamegraph visualization showing render hierarchy | 🔄 Placeholder |
| `tree.png` | Component tree view with wasted render indicators | 🔄 Placeholder |
| `timeline.png` | Scrollable timeline of all commits | 🔄 Placeholder |
| `memo.png` | Detailed memoization effectiveness analysis | 🔄 Placeholder |
| `import-dialog.png` | Import profile data dialog | 🔄 Placeholder |
| `theme-toggle.png` | Dark/light theme comparison | 🔄 Placeholder |

## How to Capture

1. Build the extension: `pnpm run build`
2. Load extension in Chrome (chrome://extensions/ → Developer mode → Load unpacked → select `dist-chrome/`)
3. Open React DevTools → Perf Profiler tab
4. Record a profile session on a React app
5. Take screenshots of each view mode
6. Save to this directory with appropriate names

## Notes

- Screenshots should be taken at 1440x900 resolution minimum
- Use the same React app for consistency across screenshots
- Capture both light and dark themes where applicable
