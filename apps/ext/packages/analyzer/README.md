# @react-perf-profiler/analyzer

Framework-agnostic analysis engine for React profiling data.

Takes `CommitData[]` (as defined in [`@repo/profile-contract`](../../../packages/profile-contract)) and produces an `AnalysisResult`: wasted-render reports, memoization effectiveness, performance scoring, anomaly/trend/pattern detection, and ranked optimization opportunities.

## Why it exists

The browser extension runs this in a Web Worker so the panel UI never blocks on analysis. The same engine is reused by:

- `@react-perf-profiler/cli` — to assert performance budgets in CI
- `@react-perf-profiler/vscode-extension` — to surface diagnostics inline
- `@react-perf-profiler/test-plugin` — to assert render behavior in Vitest

## Install

```bash
npm install @react-perf-profiler/analyzer
```

## Usage

```ts
import {
  runAnalysis,
  analyzeWastedRenders,
  analyzeMemoization,
  calculatePerformanceScore,
  detectAnomalies,
  detectTrends,
  detectPatterns,
} from '@react-perf-profiler/analyzer';
import type { CommitData, AnalysisResult } from '@react-perf-profiler/analyzer';

const commits: CommitData[] = /* captured by the extension or loaded from JSON */;

const result: AnalysisResult = runAnalysis(commits);
console.log(result.performanceScore);          // 0–100
console.log(result.wastedRenderReports);        // ranked by severity
console.log(result.topOpportunities);           // highest-impact fixes
```

## Outputs

| Field                 | Type                        | Purpose                                                          |
| --------------------- | --------------------------- | ---------------------------------------------------------------- |
| `performanceScore`    | `number` (0–100)            | Weighted score across wasted renders, memoization, and anomalies |
| `wastedRenderReports` | `WastedRenderReport[]`      | Per-component wasted-render analysis with suggested action       |
| `memoReports`         | `MemoReport[]`              | Per-component `React.memo`/`useMemo`/`useCallback` effectiveness |
| `topOpportunities`    | `OptimizationOpportunity[]` | Ranked fix suggestions with estimated savings (ms)               |
| `anomalyReports`      | `AnomalyReportGroup[]`?     | Statistical outliers (z-score based)                             |
| `trendReports`        | `TrendReportEntry[]`?       | Linear-regression slope per component                            |
| `patternReports`      | `PatternReportEntry[]`?     | Burst / periodic / cascade / escalating render patterns          |

## Constraints

- **Zero browser dependencies.** Runs in Node, Workers, and the browser without polyfills.
- **Pure functions.** No I/O — callers provide the commits, callers consume the result.
- **Self-contained types.** The contract types are duplicated locally (see `src/types.ts`) so this package can be published without a runtime dep on the private `@repo/profile-contract` workspace package.

## License

MIT.
