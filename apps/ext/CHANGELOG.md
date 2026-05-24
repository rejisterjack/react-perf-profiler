# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-12

### Added

#### Core Features

- **React Performance Profiling** — Chrome DevTools extension for profiling React component render behavior
- **Wasted Render Detection** — Identifies unnecessary re-renders with specific recommendations
- **Memoization Analysis** — Effectiveness scoring for React.memo, useMemo, and useCallback
- **Interactive Flamegraph** — D3 icicle chart with click-to-zoom and severity coloring
- **Component Tree View** — Virtualized hierarchical view with performance badges
- **Timeline View** — Scrollable D3 bar chart of all React commits
- **Web Vitals** — LCP, FID, CLS, INP display with progress indicators

#### Developer Experience

- **Real-time Profiling** — Start/stop controls with live data capture via React Fiber hooks
- **Export/Import Sessions** — Share profiles with team members as JSON
- **Performance Scoring** — Overall performance score (0-100)
- **Dark/Light/System Theme** — Automatic theme detection with manual toggle
- **Keyboard Shortcuts** — Efficient workflow without mouse
- **Session Persistence** — Restore profiling sessions across panel close/reopen

#### Architecture

- **WXT Framework** — Modern Web Extension Tools with React module
- **shadcn/ui** — Default Nova-style design system with Radix primitives
- **Tailwind CSS v4** — Utility-first styling via `@tailwindcss/vite`
- **Zustand + reselect** — Lightweight state management with memoized selectors
- **CircularBuffer** — O(1) commit storage with configurable limits
- **3-Layer Message Bridge** — MAIN world → ISOLATED world → Background → Panel
- **Virtualized Lists** — Smooth rendering for large component trees
- **TypeScript** — Strict mode with comprehensive type coverage

#### Advanced Features

- **AI Integration** — Optimization suggestions via Claude, OpenAI, or local Ollama
- **3D Component Tree** — Three.js radial visualization with OrbitControls
- **Plugin System** — Extensible analysis with sandboxed plugins
- **TensorFlow.js Predictions** — Render time prediction from profiling data
- **Cloud Sync** — Dropbox integration for cross-device profile sharing

[1.0.0]: https://github.com/rejisterjack/react-perf-profiler/releases/tag/v1.0.0
