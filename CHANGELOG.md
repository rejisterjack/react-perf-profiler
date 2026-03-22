# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- React Server Components (RSC) analysis support
- Firefox DevTools extension support
- Cross-browser compatibility layer for unified API across Chrome and Firefox
- Plugin system for custom analysis extensions
- Performance budget checking for CI/CD integration
- Profile export/import with migration support
- Keyboard shortcuts support

### Changed

- Improved analysis worker performance
- Enhanced error recovery mechanisms

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
