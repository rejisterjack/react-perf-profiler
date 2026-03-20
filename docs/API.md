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

### Performance Budgets

```typescript
// perf-budget.test.ts
import { analyzeWastedRenders } from '@/panel/utils/wastedRenderAnalysis';
import { calculatePerformanceScore } from '@/panel/utils/performanceScore';

describe('Performance Budgets', () => {
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

### GitHub Actions Integration

```yaml
# .github/workflows/perf.yml
name: Performance Check

on: [pull_request]

jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Profiler CI
        run: |
          pnpm install
          pnpm run test:perf
          
      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: perf-report
          path: perf-report.json
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
