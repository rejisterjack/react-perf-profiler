# Architecture Decision Records

This document explains the key architectural decisions made in React Perf Profiler.

## ADR-001: Web Worker for Analysis

**Status**: ✅ Accepted

**Context**: Profiling large React applications can generate thousands of component renders. Running analysis on the main thread causes UI jank and frozen DevTools.

**Decision**: Offload all analysis computation to a Web Worker.

**Consequences**:
- ✅ Main thread stays responsive at 60fps
- ✅ Can analyze 10,000+ components without jank
- ✅ Complex algorithms (wasted render detection, memo analysis) don't block UI
- ❌ Adds complexity with message passing
- ❌ Worker setup and teardown overhead

**Implementation**: `src/panel/workers/analysis.worker.ts`

---

## ADR-002: Manifest V3 for Chrome, V2 for Firefox

**Status**: ✅ Accepted

**Context**: Chrome pushed Manifest V3 with service workers replacing background pages. Firefox still primarily supports MV2.

**Decision**: Support both manifest versions with separate builds.

| Browser | Manifest | Background | Reason |
|---------|----------|------------|--------|
| Chrome | V3 | Service Worker | Required by Chrome Web Store |
| Firefox | V2 | Background Script | Better DevTools API support |

**Consequences**:
- ✅ Maximum browser compatibility
- ✅ Firefox DevTools panel API works better with MV2
- ✅ Chrome compliance with CWS requirements
- ❌ Dual build configuration complexity
- ❌ Feature parity maintenance

**Implementation**: 
- `src/manifest.json` (Chrome V3)
- `src/manifest-firefox.json` (Firefox V2)
- `vite.config.ts` vs `vite.config.firefox.ts`

---

## ADR-003: Zustand for State Management

**Status**: ✅ Accepted

**Context**: Need lightweight state management for DevTools panel that handles:
- Profiling sessions
- Commit history
- Analysis results
- UI state

**Decision**: Use Zustand over Redux/Context.

**Consequences**:
- ✅ Minimal bundle size (+2KB vs +15KB for Redux)
- ✅ No Provider wrapper needed
- ✅ Excellent TypeScript support
- ✅ Immer middleware for immutable updates
- ✅ DevTools middleware for debugging
- ❌ Less ecosystem than Redux

**Implementation**: `src/panel/stores/profilerStore.ts`

---

## ADR-004: CSS Modules for Styling

**Status**: ✅ Accepted

**Context**: Need scoped styles for DevTools panel that don't leak to host page or other extensions.

**Decision**: Use CSS Modules with camelCase convention.

**Consequences**:
- ✅ Guaranteed style isolation
- ✅ Type-safe class names with TypeScript
- ✅ Tree-shakeable unused styles
- ✅ Easy theming with CSS variables
- ❌ More verbose than Tailwind for simple cases

**Implementation**: 
- `*.module.css` files alongside components
- `localsConvention: 'camelCase'` in Vite config

---

## ADR-005: Fiber Tree Parsing Strategy

**Status**: ✅ Accepted

**Context**: React's internal fiber structure is complex and private. Need to extract performance data without breaking React internals.

**Decision**: Hook into React DevTools global hook, parse fiber tree via `onCommitFiberRoot`.

**Data Flow**:
```
React Commit → DevTools Hook → Our Bridge → Content Script → Background → Panel
```

**Consequences**:
- ✅ No React internal imports needed
- ✅ Works across React versions (16.5+)
- ✅ Respects React's profiling settings
- ❌ Dependent on DevTools hook presence
- ❌ Hook API could change (though unlikely)

**Implementation**: `src/content/bridge.ts`, `src/content/fiberParser.ts`

---

## ADR-006: Separate Process per Tab

**Status**: ✅ Accepted

**Context**: User can profile multiple tabs simultaneously. Need isolation between sessions.

**Decision**: Background service worker routes messages by `tabId`. Each tab gets independent session.

**Consequences**:
- ✅ True multi-tab profiling
- ✅ No data leakage between tabs
- ✅ Can compare profiles side-by-side
- ❌ Higher memory usage
- ❌ More complex message routing

**Implementation**: `src/background/messageRouter.ts`

---

## ADR-007: RSC Stream Parsing

**Status**: ✅ Accepted

**Context**: React Server Components use a custom streaming protocol with reference markers.

**Decision**: Parse RSC payloads at the network level, before React hydration.

**RSC Protocol Markers**:
| Marker | Meaning |
|--------|---------|
| `$` | Element reference |
| `@` | Client reference |
| `#` | Server action |
| `$S` | Symbol |
| `$F` | Form state |
| `$L` | Lazy/Promise |

**Consequences**:
- ✅ Accurate server/client boundary detection
- ✅ Payload size measurement
- ✅ Cache hit/miss tracking
- ❌ Tied to RSC protocol specifics
- ❌ Protocol may evolve

**Implementation**: `src/panel/utils/rscParser.ts`

---

## ADR-008: Biome over ESLint+Prettier

**Status**: ✅ Accepted

**Context**: Need linting and formatting. Traditional stack is ESLint + Prettier + many plugins.

**Decision**: Use Biome (formerly Rome) - all-in-one toolchain.

**Consequences**:
- ✅ Single dependency vs 10+
- ✅ Much faster (Rust-based)
- ✅ Unified config
- ✅ No plugin version conflicts
- ❌ Less configurable than ESLint
- ❌ Smaller rule set (growing rapidly)

**Implementation**: `biome.json`

---

## Performance Budgets

| Metric | Target | Status |
|--------|--------|--------|
| Panel bundle | < 200KB | 145KB ✅ |
| Background | < 50KB | 20KB ✅ |
| Content script | < 30KB | 2KB ✅ |
| Analysis (1k comps) | < 100ms | ~50ms ✅ |
| Analysis (10k comps) | < 500ms | ~200ms ✅ |
| UI render | 60fps | ✅ |
| Memory (max commits) | < 100MB | ~45MB ✅ |

## Security Considerations

1. **Content Isolation**: Content script runs in isolated world
2. **No eval()**: All code statically analyzed
3. **CSP Compliant**: Strict Content Security Policy
4. **No external requests**: All assets bundled
5. **Storage**: IndexedDB for local-only data

## Scalability Limits

| Resource | Soft Limit | Hard Limit |
|----------|------------|------------|
| Commits stored | 100 | 1000 |
| Nodes per commit | 10,000 | 50,000 |
| RSC payload size | 500KB | 5MB |
| Concurrent tabs | 10 | Browser limit |

## Future Considerations

### MV3 Service Worker Lifecycle
Chrome aggressively terminates service workers. We use:
- Keep-alive pings during profiling
- Persist state to storage before termination
- Resume on wake with stored session data

### React Concurrent Features
Future React versions may change fiber structure. Our strategy:
- Feature-detect new APIs
- Graceful degradation
- Version-specific parsers if needed

### RSC Protocol Evolution
Next.js/React may change RSC encoding. Our strategy:
- Version detection in payload
- Parser plugins per version
- Backward compatibility layers
