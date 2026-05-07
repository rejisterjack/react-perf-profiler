# React Perf Profiler ⚡

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./CHANGELOG.md)
[![CI](https://github.com/rejisterjack/react-perf-profiler/actions/workflows/ci.yml/badge.svg)](https://github.com/rejisterjack/react-perf-profiler/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-enforced%20≥75%25-4c1)](./vitest.config.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](./README.md)
[![Firefox MV2](https://img.shields.io/badge/Firefox-Manifest%20V2-FF7139.svg)](./README.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**Install:** [Chrome Web Store](https://chromewebstore.google.com/detail/react-perf-profiler/TODO) · [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/react-perf-profiler/) · [Download ZIP](https://github.com/rejisterjack/react-perf-profiler/releases/latest)

A high-performance Chrome & Firefox DevTools extension for profiling React component render behavior. Hooks into the React DevTools Profiler API to deliver actionable insights on render counts, wasted renders, and memoization effectiveness.

**Built for developers who care about performance at scale.** This tool directly addresses the challenges Meta engineers face when optimizing React applications serving billions of interactions.

### Security, privacy, and permissions

- **Where code runs:** The DevTools panel and service worker run in extension contexts. A **content script** runs in an isolated world on pages you open; it injects a **bridge** into the page so the extension can read `__REACT_DEVTOOLS_GLOBAL_HOOK__`. Web pages cannot access your stored API keys or profile database.
- **Broad host access:** The manifest uses `host_permissions: ["<all_urls>"]` and content scripts on `<all_urls>` (with `all_frames`) so the bridge can attach on whatever origin you are debugging. The extension is intended for **developer machines**; it does not upload page content unless you enable cloud sync, collaboration, or cloud LLM features.
- **Optional cloud and AI:** Export/sync (S3, Dropbox, Google Drive), team sessions, and OpenAI/Anthropic calls send data **only when you configure them**. Google Drive uses OAuth PKCE with refresh tokens; set `VITE_DISABLE_GOOGLE_DRIVE_SYNC=true` at build time only if you need to strip the provider from a custom build.
- **LLM API keys:** Keys are stored in `chrome.storage.local` (extension storage). That is **not** the same as OS keychain encryption. For keys that never leave your machine, use **Ollama (local)** in the AI panel.
- **Reporting issues safely:** See [SECURITY.md](./SECURITY.md) and [docs/MESSAGE_SECURITY.md](./docs/MESSAGE_SECURITY.md).

**Canonical privacy policy (for store listings):** [https://rejisterjack.github.io/react-perf-profiler/](https://rejisterjack.github.io/react-perf-profiler/) — enable GitHub Pages (GitHub Actions) on this repo if not already live; see [docs/store-assets/listing/README.md](./docs/store-assets/listing/README.md) and [docs/STORE_ASSETS.md](./docs/STORE_ASSETS.md). Sources: [docs/store-assets/privacy/index.html](./docs/store-assets/privacy/index.html), [chrome-privacy-policy.md](./docs/store-assets/privacy/chrome-privacy-policy.md), [firefox-privacy-policy.md](./docs/store-assets/privacy/firefox-privacy-policy.md).

### Machine learning note

Optional render-time prediction loads **TensorFlow.js** only when that feature initializes (`dynamic import`). It is not part of the cold path for opening the panel.

---

## 🎯 Why This Matters

React's concurrent features and automatic batching make performance optimization more complex than ever. This profiler bridges the gap between raw React DevTools data and actionable optimization strategies—exactly the kind of tooling needed to maintain sub-16ms frame times in large-scale applications.

**Relevance to Meta-scale engineering:**
- Identifies unnecessary re-renders in deeply nested component trees
- Quantifies the impact of `React.memo`, `useMemo`, and `useCallback`
- Surfaces render patterns that break React's optimization heuristics
- Provides flamegraph-style visualizations for render timelines

---

## 🌟 Feature Highlights

| Feature | Benefit |
|---------|---------|
| 🔍 **Wasted Render Detection** | Find components that re-render without changes |
| 📊 **Interactive Flamegraph** | Visualize render hierarchy and timing at a glance |
| 🧠 **Memo Effectiveness Analysis** | Understand why memoization isn't working |
| 🌊 **React Server Components Support** | Profile RSC payloads and cache hit rates |
| ⚡ **Performance at Scale** | Handles apps with 1000+ components smoothly |
| 🔌 **Extensible Plugin System** | Build custom analysis plugins |
| 📈 **CI/CD Integration** | Enforce performance budgets automatically |
| 🔄 **Time-Travel Debugging** | Step through commits to understand state changes |
| 💾 **Export/Import Sessions** | Share profiles with your team |
| ⌨️ **Keyboard Shortcuts** | Work efficiently without leaving the keyboard |

---

## ✨ Features

### 🎨 Visual Analysis

| Feature | Description |
|---------|-------------|
| **Flamegraph View** | Interactive flamegraph showing render hierarchy and timing |
| **Component Tree** | Hierarchical view with wasted render indicators |
| **Timeline** | Scrollable timeline of all commits |
| **Memo Report** | Detailed memoization effectiveness analysis |
| **RSC Analysis** | React Server Components payload & boundary analysis |

### Render Analytics Dashboard

| Metric | Description |
|--------|-------------|
| **Render Count** | Total renders per component with trend indicators |
| **Wasted Renders** | Renders where props/state remained identical |
| **Memo Hit Rate** | Effectiveness of memoization strategies |
| **Render Duration** | Self and total render time per component |
| **Commit Frequency** | How often a component appears in React commits |

### Smart Detection Algorithms

```typescript
// Wasted Render Detection
interface WastedRenderAnalysis {
  componentName: string;
  renderCount: number;
  wastedRenders: number;
  wastedRenderRate: number; // Percentage
  recommendedAction: 'memo' | 'useMemo' | 'useCallback' | 'none';
  estimatedSavings: string; // e.g., "12ms per interaction"
}
```

### Memoization Effectiveness Scorer
- Analyzes prop reference stability
- Detects inline object/array/function recreations
- Suggests specific optimization strategies per component

### Real-time Flamegraph
- Visual representation of render commits
- Color-coded by render duration
- Zoom and pan through component tree

### React Server Components Support
- Detects server/client component boundaries
- Analyzes RSC payload sizes and transfer times
- Tracks cache hit/miss rates for server components
- Identifies oversized props crossing boundaries

### Cross-Browser Support
- **Chrome**: Full support with Manifest V3
- **Firefox**: Full support with Manifest V2
- Unified API adapter for seamless cross-browser compatibility

---

## 🚀 Quick Start

### One-Click Install (Recommended)

| Browser | Link |
|---------|------|
| **Chrome / Edge / Brave** | [Chrome Web Store](https://chromewebstore.google.com/detail/react-perf-profiler/TODO) |
| **Firefox** | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/react-perf-profiler/) |

**First Profile:**
1. Open your React app
2. Open Chrome DevTools (F12)
3. Switch to the **"⚡ Perf Profiler"** tab
4. Click **Record** → Interact with your app → **Stop**
5. See wasted renders instantly highlighted

### Build from Source

```bash
# Clone and setup
git clone https://github.com/rejisterjack/react-perf-profiler.git
cd react-perf-profiler && pnpm install

# Start development
pnpm dev

# In Chrome:
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the `dist-chrome/` folder
```

**First Profile:**
1. Open your React app
2. Open Chrome DevTools (F12)
3. Switch to the **"⚡ Perf Profiler"** tab
4. Click **Record** → Interact with your app → **Stop**
5. See wasted renders instantly highlighted

---

## 🏗️ Architecture

The React Perf Profiler is built as a Chrome Extension that integrates directly into the DevTools panel. It bridges React's internal Profiler API with a custom analysis engine running in a Web Worker for performance.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Chrome DevTools Panel                   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Content   │  │   Popup     │  │   DevTools      │ │
│  │   Script    │  │   UI        │  │   Panel         │ │
│  │ (Injection) │  │             │  │ (Main Interface)│ │
│  └──────┬──────┘  └─────────────┘  └────────┬────────┘ │
│         │                                    │          │
│         └────────────────┬───────────────────┘          │
│                          │                              │
│                   ┌──────┴──────┐                      │
│                   │  Background  │                      │
│                   │    Service   │                      │
│                   │    Worker    │                      │
│                   └──────┬──────┘                      │
│                          │                              │
│         ┌────────────────┼────────────────┐             │
│         ▼                ▼                ▼             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  React Dev  │  │  Profiler   │  │   Store     │     │
│  │  Tools API  │  │  Hook       │  │  (IndexedDB)│     │
│  │  Bridge     │  │             │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Content Script** injects a bridge script into the page to communicate with React DevTools
2. **Background Worker** manages extension lifecycle and cross-tab communication
3. **DevTools Panel** hosts the profiler UI as a custom panel in Chrome DevTools
4. **Analysis Worker** processes profiler data off the main thread to maintain 60fps
5. **IndexedDB Store** persists profile sessions for later comparison

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + TypeScript | Panel UI and visualizations |
| State | Zustand | Lightweight state management |
| Styling | CSS Modules | Scoped, maintainable styles |
| Charts | D3.js | Flamegraph and timeline visualizations |
| Build | Vite + CRXJS | Fast HMR and Chrome extension bundling |
| Testing | Vitest + React Testing Library | Unit and integration tests |

---

## 🚀 Installation

### From Web Stores (Recommended)

#### Chrome Web Store

1. Visit the [React Perf Profiler](https://chrome.google.com/webstore) page
2. Click **"Add to Chrome"**
3. Open DevTools (F12) → **⚡ Perf Profiler** tab

#### Firefox Add-ons

1. Visit the [React Perf Profiler](https://addons.mozilla.org) page
2. Click **"Add to Firefox"**
3. Open DevTools (F12) → **⚡ Perf Profiler** tab

### Developer Install

#### Chrome

```bash
# Clone the repository
git clone https://github.com/rejisterjack/react-perf-profiler.git
cd react-perf-profiler

# Install dependencies
pnpm install

# Build for Chrome (Manifest V3)
pnpm build

# Or start dev mode with HMR
pnpm dev
```

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist-chrome/` folder from the project directory
5. Open React DevTools → Look for the **"⚡ Perf Profiler"** tab

#### Firefox

```bash
# Build for Firefox (Manifest V2)
pnpm build:firefox
```

1. Open Firefox and navigate to `about:debugging`
2. Click **"This Firefox"** in the left sidebar
3. Click **"Load Temporary Add-on"**
4. Select the `dist-firefox/manifest.json` file
5. Open React DevTools → Look for the **"⚡ Perf Profiler"** tab

#### Build All

```bash
# Build for both Chrome and Firefox
pnpm build:all
```

---

## 📊 Usage Guide

### Basic Profiling

1. **Start Recording**
   - Click the record button in the Perf Profiler panel
   - Interact with your React application
   - Stop recording to analyze

2. **Analyze Results**
   ```
   ┌────────────────────────────────────────────────────┐
   │ Component Tree (Left Panel)                        │
   │ ├── App ▲ 45 renders (12 wasted)                   │
   │ │   ├── Header ▲ 45 renders (0 wasted)             │
   │ │   ├── Feed ◆ 12 renders (0 wasted) [memoized]    │
   │ │   │   └── Post ▼ 120 renders (89 wasted)         │
   │ │   │       └── Actions ⚠️ 120 renders (120 wasted)│
   │ │   └── Sidebar ▲ 45 renders (43 wasted)           │
   └────────────────────────────────────────────────────┘
   
   Legend: ▲ High impact | ◆ Optimized | ▼ Problem area | ⚠️ Critical
   ```

3. **View Detailed Metrics**
   - Click any component to see:
     - Render timeline
     - Prop change analysis
     - Optimization recommendations

### Understanding Wasted Renders

A "wasted render" occurs when React re-renders a component but the output would be identical. Common causes:

```jsx
// ❌ Wasted Render: New object reference every render
function Feed() {
  const posts = usePosts();
  return <PostList config={{ showImages: true }} posts={posts} />;
}

// ✅ Fixed: Stable reference
const CONFIG = { showImages: true };
function Feed() {
  const posts = usePosts();
  return <PostList config={CONFIG} posts={posts} />;
}
```

### Memo Effectiveness Report

The profiler analyzes your memoization strategy:

```
┌─────────────────────────────────────────┐
│ Memo Report: PostActions                │
├─────────────────────────────────────────┤
│ Current Strategy: React.memo            │
│ Hit Rate: 23%                           │
│ Status: ⚠️ INEFFECTIVE                  │
│                                         │
│ Issues Detected:                        │
│ • onLike callback recreated each render │
│ • style object recreated each render    │
│                                         │
│ Recommendation:                         │
│ 1. Wrap onLike with useCallback         │
│ 2. Move styles to CSS module            │
│                                         │
│ Expected Improvement: 77% hit rate      │
└─────────────────────────────────────────┘
```

### React Server Components Analysis

For Next.js App Router and other RSC frameworks, the profiler provides specialized analysis:

```
┌─────────────────────────────────────────┐
│ RSC Analysis: Product Page              │
├─────────────────────────────────────────┤
│ Payload Size: 245 KB                    │
│ Transfer Time: 89ms                     │
│ Cache Hit Rate: 78%                     │
│                                         │
│ Server Components: 12                   │
│ Client Boundaries: 3                    │
│                                         │
│ ⚠️ Issues Detected:                     │
│ • Large props passed to ClientButton    │
│   (45 KB - consider data colocation)    │
│ • Cache miss on ProductReviews          │
│   (stale-while-revalidate recommended)  │
│                                         │
│ 💡 Recommendations:                     │
│ 1. Move heavy data to server components │
│ 2. Add 'use cache' directive            │
│ 3. Reduce boundary crossings            │
│                                         │
│ Expected Savings: 120 KB payload        │
└─────────────────────────────────────────┘
```

**RSC Metrics Tracked:**
- **Payload Size**: Total RSC payload transferred
- **Cache Hit Rate**: Effectiveness of RSC caching
- **Boundary Crossings**: Server → Client component transitions
- **Serialization Cost**: Time spent serializing props for client boundaries

---

## 🔧 Development

### Project Structure

```
react-perf-profiler/
├── src/
│   ├── background/          # Service worker
│   │   └── index.ts
│   ├── content/             # Content script injection
│   │   └── index.ts
│   ├── devtools/            # DevTools panel registration
│   │   ├── index.html
│   │   └── index.ts
│   ├── panel/               # Main profiler UI
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   ├── stores/          # Zustand stores
│   │   ├── utils/           # Analysis algorithms
│   │   ├── types/           # TypeScript definitions
│   │   └── App.tsx
│   └── shared/              # Shared utilities
│       └── constants.ts
├── public/
│   ├── manifest.json        # Extension manifest v3
│   └── icons/
├── tests/
│   ├── unit/
│   └── e2e/
└── package.json
```

### Key Algorithms

#### Wasted Render Detection

```typescript
// src/panel/utils/analyzeRenders.ts

export function detectWastedRenders(
  fiberData: FiberNode[],
  commitHistory: CommitData[]
): WastedRenderReport {
  const componentMap = new Map<string, RenderMetrics>();
  
  commitHistory.forEach(commit => {
    commit.nodes.forEach(node => {
      const prevProps = node.prevProps;
      const nextProps = node.props;
      
      // Shallow equality check (React's default behavior)
      const propsEqual = shallowEqual(prevProps, nextProps);
      const stateEqual = shallowEqual(node.prevState, node.state);
      
      if (propsEqual && stateEqual && !node.hasContextChanged) {
        // This was a wasted render
        recordWastedRender(componentMap, node);
      }
    });
  });
  
  return generateRecommendations(componentMap);
}
```

#### Memoization Analysis

```typescript
// src/panel/utils/memoAnalysis.ts

export function analyzeMemoEffectiveness(
  component: ComponentData
): MemoReport {
  const issues: MemoIssue[] = [];
  
  // Check for unstable callback props
  component.props.forEach((prop, key) => {
    if (typeof prop === 'function' && !prop._isStable) {
      issues.push({
        type: 'unstable-callback',
        propName: key,
        suggestion: `Wrap ${key} with useCallback`
      });
    }
  });
  
  // Calculate optimal hit rate
  const optimalHitRate = calculateOptimalHitRate(component, issues);
  
  return {
    currentHitRate: component.memoHitRate,
    optimalHitRate,
    issues,
    isEffective: component.memoHitRate > 0.7
  };
}
```

### Available Scripts

```bash
pnpm dev          # Start development with HMR
pnpm build        # Production build
pnpm test         # Run unit tests
pnpm test:e2e     # Run Playwright e2e tests
pnpm lint         # ESLint check
pnpm typecheck    # TypeScript check
```

---

## 🎯 Optimization Strategies

Based on profiling results, the extension suggests specific optimizations:

| Pattern | Detection | Recommendation |
|---------|-----------|----------------|
| **Callback Recreation** | Inline arrow functions in JSX | `useCallback` with stable deps |
| **Object Recreation** | Inline style/objects in JSX | `useMemo` or CSS modules |
| **Array Recreation** | `.map()` without memoization | `useMemo` for derived data |
| **Context Over-render** | Context consumers on rapid updates | Split context or use atoms |
| **Prop Drilling** | Deep passing of stable data | Colocate state or use composition |

---

## 📈 Performance at Scale

This tool is designed with Meta-scale applications in mind:

- **Memory Efficient**: Circular buffer for commit history (configurable limit)
- **Zero Runtime Overhead**: Only activates when DevTools is open
- **Web Worker Processing**: Heavy analysis offloaded from main thread
- **Incremental Analysis**: Process commits in chunks for large profiles

```typescript
// Configurable for different scales
interface ProfilerConfig {
  maxCommits: number;        // Default: 100
  maxNodesPerCommit: number; // Default: 10000
  analysisWorkerCount: number; // Default: 2
  enableTimeTravel: boolean;   // Default: true
}
```

### Performance Benchmarks

| Metric | Target | Achieved |
|--------|--------|----------|
| UI Response Time | < 16ms | ~8ms |
| Analysis Throughput | 10k nodes/sec | 15k+ nodes/sec |
| Memory Footprint | < 100MB | ~45MB |
| Profile Export (100 commits) | < 500ms | ~200ms |
| Timeline Scrolling | 60fps | 60fps |

*Benchmarked on a React app with 5,000+ components and 100 profile commits*

---

## 🧪 Testing

```bash
# Unit tests for analysis algorithms
pnpm test src/panel/utils/

# E2E tests with real React apps
pnpm test:e2e

# Performance benchmarks
pnpm benchmark
```

---

## 🚀 CI Performance Budgets

React Perf Profiler includes comprehensive CI/CD integration for enforcing performance budgets. Automatically check bundle sizes, test coverage, and performance metrics on every PR.

### Performance Budget Configuration

Create a `perf-budget.json` file in your project root:

```json
{
  "version": 1,
  "projectName": "My React App",
  "wastedRenderThreshold": 0.1,
  "memoHitRateThreshold": 0.8,
  "maxRenderTimeMs": 16,
  "maxRSCPayloadSize": 100000,
  "minPerformanceScore": 70,
  "maxSlowRenderPercentage": 0.1,
  "bundleBudgets": {
    "chrome": {
      "total": 1000000,
      "chunks": {
        "panel": 512000,
        "background": 102400,
        "content": 153600,
        "devtools": 51200,
        "popup": 102400,
        "vendor": 307200
      }
    }
  },
  "coverageThresholds": {
    "lines": 70,
    "functions": 70,
    "branches": 60,
    "statements": 70
  },
  "budgets": [
    {
      "id": "wasted-render-rate",
      "name": "Wasted Render Rate",
      "threshold": 0.1,
      "severity": "error",
      "enabled": true
    }
  ]
}
```

### CI/CD Integration

You can integrate the performance budget checker into your CI/CD pipeline:

- ✅ Build extensions for Chrome and Firefox
- ✅ Check bundle sizes against budgets
- ✅ Run all tests with coverage reporting
- ✅ Validate performance budgets from profiles
- ✅ Post PR comments with detailed results
- ✅ Fail CI if budgets are exceeded

**PR Comment Format:**

```markdown
## 📊 Performance Report: ✅ PASSED

### Bundle Sizes
| Chunk | Size | Budget | Status |
|-------|------|--------|--------|
| Panel | 245KB | 500KB | ✅ Pass |
| Background | 45KB | 100KB | ✅ Pass |
| **Total** | **890KB** | **1000KB** | ✅ Pass |

### Test Coverage
| Metric | Actual | Threshold | Status |
|--------|--------|-----------|--------|
| Lines | 75% | 70% | ✅ Pass |
| Functions | 72% | 70% | ✅ Pass |

### Performance Budgets
| Check | Result |
|-------|--------|
| Overall Status | ✅ Passed |
| Performance Score | 85/100 |
| Violations | 0 |
```

### CLI Tool

Use the `perf-check` CLI tool locally or in CI:

```bash
# Check performance profile
pnpm perf:check profile.json

# Check bundle sizes
pnpm perf:check:bundles

# Check test coverage
pnpm perf:check:coverage

# Check everything (for CI)
pnpm perf:check:all

# Direct usage with options
pnpm exec tsx src/cli/perf-check.ts \
  --check-bundles \
  --check-coverage \
  --bundle-target both \
  --pr-comment \
  profile.json
```

**CLI Options:**

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to budget config (default: perf-budget.json) |
| `-f, --format <format>` | Output: json, human, markdown |
| `-o, --output <path>` | Write output to file |
| `-w, --fail-on-warning` | Fail on warnings (not just errors) |
| `--check-bundles` | Check bundle sizes |
| `--bundle-target <target>` | chrome, firefox, or both |
| `--check-coverage` | Check test coverage |
| `--pr-comment` | Generate PR comment format |
| `-q, --quiet` | Only output errors |
| `-v, --verbose` | Show detailed information |

### Programmatic API

Use the performance budget checker in your own scripts:

```typescript
import {
  checkPerformanceBudget,
  checkBundleSizes,
  checkCoverage,
  generateBudgetReport,
} from '@/shared/performance-budgets';

// Check performance profile
const profileResult = checkPerformanceBudget(profileData, config);

// Check bundle sizes
const bundleResult = checkBundleSizes('./dist-chrome', 'chrome');

// Check test coverage
const coverageResult = checkCoverage('./coverage');

// Generate report
const report = generateBudgetReport(
  profileResult,
  [bundleResult],
  coverageResult
);

console.log(report);
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All budgets passed |
| 1 | Budget violations detected |
| 2 | Configuration or runtime error |

---

## 📚 Documentation

- **[Plugin Development Guide](./docs/PLUGIN_DEVELOPMENT.md)** - Create custom analysis plugins
- **[Performance Budgets Guide](./docs/PERFORMANCE_BUDGETS.md)** - CI/CD integration and budgets
- **[API Reference](./docs/API_REFERENCE.md)** - Store APIs, hooks, and utilities
- **[Programmatic API](./docs/API.md)** - Analysis utilities and CI-oriented APIs
- **[Release Checklist](./docs/RELEASE_CHECKLIST.md)** - Full release QA and process
- **[Store Assets](./docs/STORE_ASSETS.md)** - Chrome Web Store & Firefox Add-ons assets
- **[Store listing copy & privacy URL](./docs/store-assets/listing/README.md)** - Paste-ready descriptions and canonical policy link
- **[Store release](./docs/STORE_RELEASE.md)** - Tag, build zips, store checklist
- **[Publishing secrets](./docs/PUBLISHING_SECRETS.md)** - Optional CI upload to stores
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and data flow
- **[Compatibility](./docs/COMPATIBILITY.md)** - React / DevTools / RSC expectations
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Roadmap](./ROADMAP.md)** - Planned direction
- **[Permissions spike (narrow host access)](./docs/PERMISSIONS_SPIKE.md)** - Tradeoffs for `<all_urls>` vs narrower modes
- **[Team sessions / WebRTC relay](./docs/TEAM_SESSIONS.md)** - `VITE_COLLAB_RELAY_URL` and signaling modes

## 🤝 Contributing

Contributions welcome! Areas of interest:

- [x] Firefox DevTools support
- [x] React Server Components analysis
- [x] Export/import profile sessions
- [ ] Custom metric plugins
- [ ] Team sharing / cloud profiles

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📝 License

MIT © [Your Name](https://github.com/rejisterjack)

---

## 🔗 Related

- [React DevTools](https://github.com/facebook/react/tree/main/packages/react-devtools)
- [React Profiler API](https://react.dev/reference/react/Profiler)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)

---

> *"Performance is a feature. This tool helps you ship it."*

Built with ❤️ for the React community.
