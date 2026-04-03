# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub Pages workflow for canonical privacy policy HTML ([.github/workflows/pages.yml](.github/workflows/pages.yml))
- Store submission pack: [docs/store-assets/PERMISSION_JUSTIFICATION.md](docs/store-assets/PERMISSION_JUSTIFICATION.md), [AMO_SUBMISSION_NOTES.md](docs/store-assets/AMO_SUBMISSION_NOTES.md), placeholder PNG screenshots and promos under [docs/store-assets/](docs/store-assets/)
- Maintainer docs: [docs/PUBLISHING_SECRETS.md](docs/PUBLISHING_SECRETS.md), [docs/STORE_RELEASE.md](docs/STORE_RELEASE.md)

### Changed

- Store privacy markdown and listing drafts now disclose optional cloud sync, collaboration, and cloud LLM data flows
- Biome: CSS module files ignored; several rules relaxed to `warn` for incremental cleanup; CLI allows `console` ([CONTRIBUTING.md](CONTRIBUTING.md))
- Documentation: accurate store-asset layout and icon location; cross-links for release docs, API docs, and doc vs store screenshots; removed redundant `docs/store-assets/screenshots/PLACEHOLDERS.md`; E2E README uses `pnpm` and correct `profiling.spec.ts` description

## [1.0.0] - 2026-03-22

### Added

#### Core Features

- **React Performance Profiling** - Chrome DevTools extension for profiling React component render behavior
- **Wasted Render Detection** - Identifies unnecessary re-renders with specific recommendations
- **Memoization Analysis** - Effectiveness scoring for React.memo, useMemo, and useCallback
- **Interactive Flamegraph** - Visual representation of render hierarchy with zoom and pan
- **Component Tree View** - Hierarchical view with wasted render indicators
- **Timeline View** - Scrollable timeline of all React commits
- **RSC Support** - React Server Components payload and boundary analysis
- **Time-Travel Debugging** - Step through commits to understand state changes

#### Developer Experience

- **Real-time Profiling** - Start/stop controls with live data capture
- **Export/Import Sessions** - Share profiles with team members
- **Performance Scoring** - Overall performance score (0-100)
- **Optimization Suggestions** - Specific recommendations per component
- **Dark Mode Support** - Automatic theme detection
- **Keyboard Shortcuts** - Efficient workflow without mouse

#### Technical Implementation

- **Web Worker Processing** - Heavy analysis offloaded from main thread
- **Zustand State Management** - Lightweight and efficient state handling
- **Virtualized Lists** - Smooth rendering for large component trees
- **Memory Efficiency** - Circular buffer for commit history with configurable limits
- **TypeScript** - Strict mode with comprehensive type coverage

#### Testing & Quality

- **305+ Unit Tests** - Comprehensive test coverage with Vitest
- **E2E Tests** - Playwright tests for critical user flows
- **Performance Benchmarks** - Automated performance regression testing
- **Bundle Size Tracking** - Per-chunk budget enforcement

#### Build & CI/CD

- **Vite Build System** - Fast HMR and optimized production builds
- **Chrome & Firefox Support** - Unified build for both browsers
- **GitHub Actions** - Automated testing and performance checks
- **Biome Linting** - Fast, modern linting and formatting

#### Documentation

- Comprehensive README with usage examples
- Architecture documentation
- API reference for stores and hooks
- Troubleshooting guide
- Performance budget CI guide

[1.0.0]: https://github.com/rejisterjack/react-perf-profiler/releases/tag/v1.0.0
