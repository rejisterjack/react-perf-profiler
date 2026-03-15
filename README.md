# React Perf Profiler ⚡

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)

A high-performance Chrome DevTools extension for profiling React component render behavior. Hooks into the React DevTools Profiler API to deliver actionable insights on render counts, wasted renders, and memoization effectiveness.

**Built for developers who care about performance at scale.** This tool directly addresses the challenges Meta engineers face when optimizing React applications serving billions of interactions.

---

## 🎯 Why This Matters

React's concurrent features and automatic batching make performance optimization more complex than ever. This profiler bridges the gap between raw React DevTools data and actionable optimization strategies—exactly the kind of tooling needed to maintain sub-16ms frame times in large-scale applications.

**Relevance to Meta-scale engineering:**
- Identifies unnecessary re-renders in deeply nested component trees
- Quantifies the impact of `React.memo`, `useMemo`, and `useCallback`
- Surfaces render patterns that break React's optimization heuristics
- Provides flamegraph-style visualizations for render timelines

---

## ✨ Features

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

---

## 🏗️ Architecture

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

### From Chrome Web Store
*(Coming soon)*

### Developer Install

```bash
# Clone the repository
git clone https://github.com/rejisterjack/react-perf-profiler.git
cd react-perf-profiler

# Install dependencies
pnpm install

# Build extension
pnpm build

# Or start dev mode with HMR
pnpm dev
```

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist/` folder from the project directory
5. Open React DevTools → Look for the **"Perf Profiler"** tab

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

## 🤝 Contributing

Contributions welcome! Areas of interest:

- [ ] Firefox DevTools support
- [ ] React Server Components analysis
- [ ] Export/import profile sessions
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
