# API Documentation

Programmatic API for React Perf Profiler.

## Overview

React Perf Profiler exposes APIs for:
- Custom analysis plugins
- Integration with testing frameworks
- CI/CD performance monitoring
- Custom visualizations

## Core APIs

### Analysis Utilities

#### Wasted Render Analysis

```typescript
import { analyzeWastedRenders } from '@/panel/utils/wastedRenderAnalysis';

const result = analyzeWastedRenders(commits, prevCommits);

// Returns: WastedRenderReport[]
[
  {
    componentName: 'UserCard',
    renderCount: 45,
    wastedRenders: 23,
    wastedRenderRate: 0.51,
    recommendedAction: 'memo',
    estimatedSavingsMs: 12.5,
    severity: 'high',
    issues: [...]
  }
]
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `commits` | `CommitData[]` | Current commit data |
| `prevCommits` | `CommitData[]` | Previous commits for comparison |

**Returns:** `WastedRenderReport[]`

#### Memoization Analysis

```typescript
import { analyzeMemoEffectiveness } from '@/panel/utils/memoAnalysis';

const report = analyzeMemoEffectiveness(componentData);

// Returns: MemoReport
{
  componentName: 'ProductList',
  currentHitRate: 0.23,
  optimalHitRate: 0.85,
  isEffective: false,
  issues: [
    {
      type: 'unstable-callback',
      propName: 'onSelect',
      description: 'Callback recreated each render',
      suggestion: 'Wrap onSelect with useCallback',
      severity: 'high'
    }
  ],
  recommendations: [...]
}
```

#### Performance Scoring

```typescript
import { calculatePerformanceScore } from '@/panel/utils/performanceScore';

const score = calculatePerformanceScore({
  wastedRenderReports,
  memoReports,
  totalCommits,
  totalComponents
});

// Returns: 0-100 score
// 90-100: Excellent
// 70-89: Good
// 50-69: Needs Improvement
// <50: Poor
```

### RSC Analysis

```typescript
import { 
  parseRSCPayload,
  extractRSCMetrics,
  detectRSCBoundaries 
} from '@/panel/utils/rscParser';

// Parse RSC payload
const payload = parseRSCPayload(streamData);

// Extract metrics
const metrics = extractRSCMetrics(payload);
// Returns: RSCMetrics

// Detect boundaries in fiber tree
const boundaries = detectRSCBoundaries(fiberData);
// Returns: RSCBoundary[]
```

### Fiber Parsing

```typescript
import { 
  parseFiberNode,
  walkFiberTree,
  parseFiberRoot 
} from '@/content/fiberParser';

// Parse single fiber node
const fiberData = parseFiberNode(fiber);

// Walk entire fiber tree
walkFiberTree(rootFiber, (node) => {
  console.log(node);
});

// Parse full commit
const commitData = parseFiberRoot(rootFiber, priorityLevel);
```

## Store APIs

### Profiler Store

```typescript
import { useProfilerStore } from '@/panel/stores/profilerStore';

// Access store
const store = useProfilerStore.getState();

// Actions
store.startProfiling();
store.stopProfiling();
store.addCommit(commitData);
store.clearData();
store.setAnalysisResults(results);

// RSC Actions
store.addRSCPayload(payload);
store.analyzeRSC();
store.clearRSCData();

// Selectors
const commits = useProfilerStore(state => state.commits);
const isProfiling = useProfilerStore(state => state.isProfiling);
const analysis = useProfilerStore(state => state.analysisResults);
const rscMetrics = useProfilerStore(state => state.getRSCTotalPayloadSize());
```

### Settings Store

```typescript
import { useSettingsStore } from '@/panel/stores/settingsStore';

const { 
  theme,
  maxCommits,
  enableTimeTravel,
  setTheme,
  setMaxCommits 
} = useSettingsStore();
```

## Browser Adapter API

### Cross-Browser DevTools

```typescript
import { 
  detectBrowser,
  createDevToolsPanel,
  sendMessage,
  getRuntime 
} from '@/shared/browser';

// Detect browser
const browser = detectBrowser(); // 'chrome' | 'firefox' | 'unknown'

// Create DevTools panel
const panel = await createDevToolsPanel({
  title: 'My Panel',
  iconPath: 'icons/icon.png',
  pagePath: 'panel.html'
});

// Send message
await sendMessage({ type: 'MY_MESSAGE', payload: data });

// Access runtime
const runtime = getRuntime();
```

## Custom Plugins

### Creating a Plugin

```typescript
// my-plugin.ts
import type { AnalysisPlugin, CommitData, AnalysisResult } from '@/shared/types';

export const myPlugin: AnalysisPlugin = {
  name: 'my-custom-analysis',
  version: '1.0.0',
  
  analyze(commits: CommitData[]): Partial<AnalysisResult> {
    // Custom analysis logic
    const customMetrics = commits.map(commit => {
      return calculateCustomMetric(commit);
    });
    
    return {
      customMetrics,
      customScore: calculateScore(customMetrics)
    };
  }
};

// Register plugin
import { useProfilerStore } from '@/panel/stores/profilerStore';

useProfilerStore.getState().registerPlugin(myPlugin);
```

### Plugin Interface

```typescript
interface AnalysisPlugin {
  name: string;
  version: string;
  
  // Main analysis function
  analyze(commits: CommitData[]): Partial<AnalysisResult>;
  
  // Optional: Transform commit data
  transformCommit?(commit: CommitData): CommitData;
  
  // Optional: Cleanup
  destroy?(): void;
}
```

## Testing Utilities

### Mock Data Generators

```typescript
import { 
  generateMockCommit,
  generateMockFiber,
  generateMockRSCPayload 
} from '@/tests/utils/mockData';

// Generate test commit
const commit = generateMockCommit({
  componentCount: 10,
  duration: 16,
  wastedRenders: 2
});

// Generate RSC payload
const rscPayload = generateMockRSCPayload({
  boundaryCount: 3,
  payloadSize: 50000
});
```

### Test Helpers

```typescript
import { 
  waitForAnalysis,
  simulateCommits,
  mockChromeAPI,
  mockFirefoxAPI 
} from '@/tests/utils/helpers';

// Mock browser APIs
beforeEach(() => {
  mockChromeAPI();
  // or
  mockFirefoxAPI();
});

// Simulate commits
await simulateCommits([
  generateMockCommit(),
  generateMockCommit()
]);

// Wait for analysis
const result = await waitForAnalysis(() => {
  return useProfilerStore.getState().analysisResults;
});
```

## CI/CD Integration

### Performance Budget API

React Perf Profiler provides a comprehensive performance budget system for CI/CD integration. Set thresholds for key metrics and automatically fail builds when performance degrades.

#### Quick Start

```typescript
import { checkPerformanceBudget, loadBudgetConfig } from '@/shared/performance-budgets';

// Load profile data (exported from the extension or generated during tests)
const profile = JSON.parse(fs.readFileSync('profile.json', 'utf-8'));

// Check against default budgets
const result = checkPerformanceBudget(profile);

if (!result.passed) {
  console.error('Performance budget violations:', result.violations);
  process.exit(1);
}
```

#### Budget Configuration

Create a `perf-budget.json` file in your project root:

```json
{
  "version": 1,
  "projectName": "My App",
  "wastedRenderThreshold": 0.1,
  "memoHitRateThreshold": 0.8,
  "maxRenderTimeMs": 16,
  "maxRSCPayloadSize": 100000,
  "minPerformanceScore": 70,
  "maxSlowRenderPercentage": 0.1,
  "failOnWarning": false,
  "outputFormat": "human",
  "budgets": [
    {
      "id": "wasted-render-rate",
      "name": "Wasted Render Rate",
      "threshold": 0.1,
      "severity": "error",
      "enabled": true,
      "errorMessage": "Wasted render rate exceeds 10%"
    }
  ]
}
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wastedRenderThreshold` | number | 0.1 | Max wasted render rate (0-1) |
| `memoHitRateThreshold` | number | 0.8 | Min memo hit rate (0-1) |
| `maxRenderTimeMs` | number | 16 | Max avg render time (60fps budget) |
| `maxRSCPayloadSize` | number | 100000 | Max RSC payload in bytes |
| `minPerformanceScore` | number | 70 | Min overall score (0-100) |
| `maxSlowRenderPercentage` | number | 0.1 | Max % of renders > 16ms |
| `failOnWarning` | boolean | false | Fail CI on warnings |
| `outputFormat` | string | "human" | "json" or "human" |

#### CLI Tool

The `perf-check` CLI tool runs in CI pipelines:

```bash
# Basic usage
npx perf-check profile.json

# With custom config
npx perf-check --config budgets.json profile.json

# JSON output for automation
npx perf-check --format json --output result.json profile.json

# Fail on warnings
npx perf-check --fail-on-warning profile.json
```

**CLI Options:**

| Option | Short | Description |
|--------|-------|-------------|
| `--config` | `-c` | Path to budget config file |
| `--format` | `-f` | Output format: json or human |
| `--output` | `-o` | Write output to file |
| `--fail-on-warning` | `-w` | Fail on warning-level violations |
| `--quiet` | `-q` | Only output errors |
| `--verbose` | `-v` | Show detailed information |
| `--help` | `-h` | Show help |
| `--version` | | Show version |

#### Programmatic API

##### Check Performance Budget

```typescript
import { checkPerformanceBudget } from '@/shared/performance-budgets';

const result = checkPerformanceBudget(profile, {
  wastedRenderThreshold: 0.15,
  maxRenderTimeMs: 20,
  minPerformanceScore: 75
});

console.log(result.passed);           // boolean
console.log(result.totalViolations);  // number
console.log(result.violations);       // BudgetViolation[]
console.log(result.summary);          // BudgetSummary
```

**Check Result Structure:**

```typescript
interface BudgetCheckResult {
  passed: boolean;                    // All budgets passed
  totalViolations: number;            // Total violation count
  errorCount: number;                 // Error-level violations
  warningCount: number;               // Warning-level violations
  infoCount: number;                  // Info-level violations
  violations: BudgetViolation[];      // Detailed violations
  summary: BudgetSummary;             // Summary statistics
  metadata: ProfileMetadata;          // Profile info
  timestamp: number;                  // Check timestamp
}
```

##### Budget Violation

```typescript
interface BudgetViolation {
  id: string;                         // Violation ID
  budgetId: string;                   // Budget ID
  budgetName: string;                 // Human-readable name
  severity: 'error' | 'warning' | 'info';
  actualValue: number;                // Measured value
  threshold: number;                  // Budget threshold
  difference: number;                 // Amount over threshold
  percentageOver: number;             // % over threshold
  componentName?: string;             // Affected component
  message: string;                    // Human-readable message
  recommendation?: string;            // Suggested fix
  timestamp: number;                  // Detection time
}
```

##### Load Budget Configuration

```typescript
import { loadBudgetConfig } from '@/shared/performance-budgets';

// Load from file or use defaults
const config = loadBudgetConfig({
  wastedRenderThreshold: 0.1,
  budgets: [
    {
      id: 'custom-budget',
      name: 'Custom Budget',
      threshold: 100,
      severity: 'warning',
      enabled: true
    }
  ]
});
```

##### Format Results

```typescript
import { 
  formatCheckResultHuman, 
  formatCheckResultJson 
} from '@/shared/performance-budgets';

// Human-readable output
const humanOutput = formatCheckResultHuman(result);
console.log(humanOutput);

// JSON output
const jsonOutput = formatCheckResultJson(result);
fs.writeFileSync('results.json', jsonOutput);
```

#### GitHub Actions Integration

A complete workflow is provided in `.github/workflows/perf-budget.yml`:

```yaml
name: Performance Budget Check

on:
  pull_request:
    branches: [main, develop]

jobs:
  perf-budget:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm run build
      
      - name: Run E2E tests and generate profile
        run: pnpm run test:e2e:profile
      
      - name: Check performance budgets
        run: |
          node dist/cli/perf-check.js \
            --config perf-budget.json \
            --format json \
            --fail-on-warning \
            perf-profile.json
```

The workflow automatically:
- Runs on every PR to main/develop
- Generates a performance profile
- Checks against configured budgets
- Comments results on the PR
- Fails the build if budgets are exceeded

#### Testing with Performance Budgets

```typescript
// perf-budget.test.ts
import { checkPerformanceBudget } from '@/shared/performance-budgets';
import { loadProfile } from './utils';

describe('Performance Budgets', () => {
  it('should pass all performance budgets', async () => {
    const profile = await loadProfile('production.json');
    const result = checkPerformanceBudget(profile, {
      wastedRenderThreshold: 0.1,
      maxRenderTimeMs: 16
    });
    
    // Log violations for debugging
    result.violations.forEach(v => {
      console.log(`${v.severity}: ${v.message}`);
    });
    
    expect(result.passed).toBe(true);
  });
  
  it('should have < 10% wasted renders', () => {
    const profile = loadProfile('production.json');
    const result = checkPerformanceBudget(profile);
    
    const wastedViolation = result.violations.find(
      v => v.budgetId === 'wasted-render-rate'
    );
    
    expect(wastedViolation).toBeUndefined();
  });
  
  it('should maintain > 80% memo hit rate', () => {
    const profile = loadProfile('production.json');
    const result = checkPerformanceBudget(profile);
    
    const memoViolation = result.violations.find(
      v => v.budgetId === 'memo-hit-rate'
    );
    
    expect(memoViolation).toBeUndefined();
  });
});
```

### Legacy Performance Budgets

For backward compatibility, the original budget checking approach is still available:

```typescript
// perf-budget.test.ts
import { analyzeWastedRenders } from '@/panel/utils/wastedRenderAnalysis';
import { calculatePerformanceScore } from '@/panel/utils/performanceScore';

describe('Performance Budgets (Legacy)', () => {
  it('should maintain > 90% performance score', async () => {
    const profile = await loadProfile('production.json');
    const score = calculatePerformanceScore(profile);
    
    expect(score).toBeGreaterThanOrEqual(90);
  });
  
  it('should have < 10% wasted renders', () => {
    const reports = analyzeWastedRenders(commits);
    const avgWaste = reports.reduce((sum, r) => 
      sum + r.wastedRenderRate, 0
    ) / reports.length;
    
    expect(avgWaste).toBeLessThan(0.1);
  });
  
  it('should have < 100KB RSC payload', () => {
    const payload = getRSCTotalPayloadSize();
    expect(payload).toBeLessThan(100 * 1024);
  });
});
```

## Message API

### Extension Messaging

```typescript
import { sendMessage, onMessage } from '@/shared/messaging';

// Send message to background
const response = await sendMessage({
  type: 'ANALYZE_COMMITS',
  payload: { commits }
});

// Listen for messages
const unsubscribe = onMessage((message) => {
  if (message.type === 'ANALYSIS_COMPLETE') {
    console.log(message.payload);
  }
});

// Cleanup
unsubscribe();
```

### Message Types

```typescript
type MessageType =
  | 'START_PROFILING'
  | 'STOP_PROFILING'
  | 'COMMIT_DATA'
  | 'CLEAR_DATA'
  | 'ANALYZE_COMMITS'
  | 'ANALYSIS_COMPLETE'
  | 'RSC_PAYLOAD'
  | 'ERROR';
```

## Types Reference

### Core Types

```typescript
// src/shared/types.ts

interface CommitData {
  id: string;
  timestamp: number;
  priorityLevel: 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';
  duration: number;
  nodes?: FiberNode[];
  rootId?: number;
}

interface FiberNode {
  id: number;
  displayName: string;
  actualDuration: number;
  baseDuration: number;
  props: Record<string, unknown>;
  parentId: number | null;
  children: number[];
  isMemoized: boolean;
}

interface ComponentMetrics {
  componentName: string;
  renderCount: number;
  wastedRenderCount: number;
  wastedRenderRate: number;
  totalRenderTime: number;
  averageRenderTime: number;
  isMemoized: boolean;
  memoHitRate?: number;
}

interface WastedRenderReport {
  componentName: string;
  renderCount: number;
  wastedRenders: number;
  wastedRenderRate: number;
  recommendedAction: 'memo' | 'useMemo' | 'useCallback' | 'none';
  estimatedSavingsMs: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface MemoReport {
  componentName: string;
  currentHitRate: number;
  optimalHitRate: number;
  isEffective: boolean;
  issues: MemoIssue[];
  recommendations: MemoRecommendation[];
}
```

### RSC Types

```typescript
// src/shared/types/rsc.ts

interface RSCPayload {
  chunks: RSCChunk[];
  boundaries: RSCBoundary[];
  metadata: RSCPayloadMetadata;
  metrics: RSCMetrics;
}

interface RSCBoundary {
  id: string;
  componentName: string;
  type: 'server' | 'client' | 'shared';
  depth: number;
  payloadSize: number;
  cacheStatus: 'hit' | 'miss' | 'stale' | 'pending';
}

interface RSCMetrics {
  totalPayloadSize: number;
  transferTime: number;
  serializationCost: number;
  deserializationCost: number;
  boundaryCount: number;
  serverComponentCount: number;
  clientBoundaryCount: number;
}
```

## Configuration

### Profiler Configuration

```typescript
interface ProfilerConfig {
  // Storage limits
  maxCommits: number;              // Default: 100
  maxNodesPerCommit: number;       // Default: 10000
  
  // Analysis settings
  analysisWorkerCount: number;     // Default: 2
  enableTimeTravel: boolean;       // Default: true
  
  // RSC settings
  rscAnalysisEnabled: boolean;     // Default: true
  maxPayloadSize: number;          // Default: 500000 (500KB)
  
  // UI settings
  theme: 'light' | 'dark' | 'system';
  showInlineDetails: boolean;      // Default: true
}

// Update config
import { useSettingsStore } from '@/panel/stores/settingsStore';

useSettingsStore.getState().updateConfig({
  maxCommits: 50,
  theme: 'dark'
});
```

## Best Practices

### 1. Batch Analysis
```typescript
// Good: Batch multiple commits
const results = analyzeWastedRenders(allCommits);

// Bad: Analyze one by one
commits.forEach(c => analyzeWastedRenders([c]));
```

### 2. Memoize Selectors
```typescript
// Good: Use selectors
const wastedRenders = useProfilerStore(
  state => state.getWastedRenderCount()
);

// Bad: Calculate in render
const wasted = commits.filter(...).length;
```

### 3. Cleanup Resources
```typescript
useEffect(() => {
  const unsubscribe = onMessage(handleMessage);
  
  return () => {
    unsubscribe(); // Always cleanup
  };
}, []);
```

## Examples

### Custom Analysis Report

```typescript
// Custom report combining multiple analyses
function generateCustomReport(commits: CommitData[]) {
  const wasted = analyzeWastedRenders(commits);
  const memo = analyzeAllMemoization(commits);
  const rsc = analyzeRSCPayloads(commits);
  
  return {
    summary: {
      totalCommits: commits.length,
      totalWasted: wasted.reduce((s, r) => s + r.wastedRenders, 0),
      avgMemoHitRate: average(memo.map(m => m.currentHitRate)),
      rscPayloadSize: rsc.totalSize
    },
    topIssues: [
      ...wasted.filter(w => w.severity === 'critical'),
      ...memo.filter(m => !m.isEffective)
    ].slice(0, 10),
    recommendations: generateRecommendations(wasted, memo, rsc)
  };
}
```

### Integration with Testing Library

```typescript
// Component performance test
import { render } from '@testing-library/react';
import { Profiler } from 'react';

test('Component renders efficiently', async () => {
  const onRender = jest.fn();
  
  render(
    <Profiler id="Test" onRender={onRender}>
      <MyComponent />
    </Profiler>
  );
  
  // Trigger updates
  await userEvent.click(screen.getByRole('button'));
  
  // Analyze
  const commits = convertToCommits(onRender.mock.calls);
  const report = analyzeWastedRenders(commits);
  
  expect(report[0].wastedRenderRate).toBeLessThan(0.1);
});
```
