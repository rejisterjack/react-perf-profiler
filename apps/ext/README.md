# React Perf Profiler

A Chrome DevTools extension for profiling React component performance — detect wasted renders, analyze memoization effectiveness, and visualize your component hierarchy.

## Features

- **Wasted Render Detection** — identifies unnecessary re-renders with specific recommendations
- **Memoization Analysis** — effectiveness scoring for React.memo, useMemo, and useCallback
- **Interactive Flamegraph** — D3 icicle chart with click-to-zoom and severity coloring
- **Component Tree View** — virtualized hierarchical view with performance badges
- **Timeline View** — scrollable bar chart of all React commits
- **Analysis Dashboard** — performance scoring (0-100) with weighted analysis
- **AI Suggestions** — optimization recommendations via Claude, OpenAI, or local Ollama
- **Tech Stack Detection** — auto-detect frameworks, CSS tools, build tools, fonts, and colors
- **Web Vitals** — LCP, FID, CLS, INP display
- **Performance Budgets** — configurable rules with violation tracking
- **Statistical Analysis** — anomaly detection, trend analysis, render pattern detection
- **Export/Import** — share profiles as JSON
- **Dark/Light/System Theme**
- **Keyboard Shortcuts**

### Coming Soon

- **3D Component Tree** — Three.js radial visualization
- **Cloud Sync** — profile sharing via Dropbox, Google Drive, S3
- **Plugin System** — extensible custom analysis

## Install

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [bun](https://bun.sh/)

### Setup

```bash
git clone https://github.com/rejisterjack/react-perf-profiler.git
cd react-perf-profiler
bun install
bun run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3/` directory

## Usage

1. Open any React app
2. Open Chrome DevTools → **React Perf** tab
3. Click **Record** to start profiling
4. Interact with the page
5. Click **Stop** to end the session
6. Explore results in Tree, Flamegraph, Timeline, or Analysis views

## Development

```bash
bun run dev          # Start dev server with HMR
bun run build        # Production build
bun run compile      # TypeScript type check
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

## Architecture

```
Bridge (MAIN world content script)
  → window.postMessage →
Content Script (ISOLATED world)
  → browser.runtime.connect →
Background Service Worker
  → browser.runtime.connect →
DevTools Panel (React + Zustand + shadcn/ui)
```

The bridge hooks into `__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot` to intercept React Fiber commits, then forwards them through a rate-limited pipeline to the DevTools panel.

## Tech Stack

- [WXT](https://wxt.dev/) — Web Extension Tools framework
- [React](https://react.dev/) 19 + TypeScript
- [shadcn/ui](https://ui.shadcn.com/) — component library (Nova style, Radix primitives)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Zustand](https://zustand.docs.pmnd.rs/) + [reselect](https://reselect.js.org/) — state management
- [D3.js](https://d3js.org/) — flamegraph and timeline visualizations

## License

[MIT](./LICENSE)
