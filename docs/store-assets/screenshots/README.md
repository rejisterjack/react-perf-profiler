# Store listing screenshots (placeholders)

Solid-color PNGs at the sizes store consoles expect. **Replace with real DevTools captures** before a marketing push or when reviewers ask for representative UI.

| File pattern | Size | Suggested real content |
|--------------|------|-------------------------|
| `screenshot-*-1280x800.png` | 1280×800 | Chrome Web Store primary |
| `screenshot-*-640x400.png` | 640×400 | Thumbnails / Firefox |
| `screenshot-1-flamegraph-*` | | Flamegraph view |
| `screenshot-2-wasted-renders-*` | | Wasted render highlights |
| `screenshot-3-memo-analysis-*` | | Memo effectiveness |
| `screenshot-4-rsc-support-*` | | RSC panel (if shown) |
| `screenshot-5-component-tree-*` | | Tree view |

## Capture checklist

1. `pnpm run build` and load `dist-chrome/` (or Firefox build) unpacked.
2. Open a real React app, DevTools → Perf Profiler tab.
3. Record a short session; capture each mode at **1280×800** minimum.
4. Export PNGs; replace files here keeping names or update [docs/STORE_ASSETS.md](../STORE_ASSETS.md).

See [PLACEHOLDERS.md](./PLACEHOLDERS.md).
