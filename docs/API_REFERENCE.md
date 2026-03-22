# API Reference

Complete API reference for React Perf Profiler's stores, hooks, and utilities.

## Table of Contents

- [Store APIs](#store-apis)
- [Hook APIs](#hook-apis)
- [Utility Functions](#utility-functions)
- [Type Definitions](#type-definitions)

---

## Store APIs

### useProfilerStore

Main store for profiler state management.

```typescript
import { useProfilerStore } from '@/panel/stores';

// Subscribe to specific state
const isRecording = useProfilerStore((state) => state.isRecording);

// Or use multiple values
const { commits, startRecording, stopRecording } = useProfilerStore();
```

#### State

| Property | Type | Description |
|----------|------|-------------|
| `isRecording` | `boolean` | Whether currently recording |
| `recordingStartTime` | `number \| null` | Recording start timestamp |
| `recordingDuration` | `number` | Recording duration in ms |
| `commits` | `CommitData[]` | Captured commits |
| `analysisResults` | `AnalysisResult \| null` | Analysis results |
| `wastedRenderReports` | `WastedRenderReport[]` | Wasted render analysis |
| `memoReports` | `MemoReport[]` | Memo effectiveness reports |
| `selectedCommitId` | `string \| null` | Currently selected commit |
| `selectedComponent` | `string \| null` | Currently selected component |
| `selectedComponentName` | `string \| null` | Alias for selectedComponent |
| `timeTravelIndex` | `number \| null` | Time travel position |
| `viewMode` | `ViewMode` | Current view mode |
| `filterText` | `string` | Component filter text |
| `expandedNodes` | `Set<string>` | Expanded tree node IDs |
| `isAnalyzing` | `boolean` | Analysis in progress |
| `analysisError` | `string \| null` | Analysis error message |
| `performanceScore` | `PerformanceMetrics \| null` | Performance metrics |
| `componentData` | `Map<string, ComponentData>` | Component data map |
| `isDetailPanelOpen` | `boolean` | Detail panel visibility |
| `detailPanelOpen` | `boolean` | Alias for isDetailPanelOpen |
| `sidebarWidth` | `number` | Sidebar width in pixels |
| `detailPanelWidth` | `number` | Detail panel width in pixels |
| `componentTypeFilter` | `'all' \| 'memoized' \| 'unmemoized'` | Component type filter |
| `severityFilter` | `('critical' \| 'warning' \| 'info')[]` | Severity filter |
| `rscPayloads` | `RSCPayload[]` | RSC payloads |
| `rscAnalysis` | `RSCAnalysisResult \| null` | RSC analysis results |
| `rscMetrics` | `RSCMetrics \| null` | RSC metrics |
| `isAnalyzingRSC` | `boolean` | RSC analysis in progress |
| `rscAnalysisError` | `string \| null` | RSC analysis error |

#### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `startRecording` | `() => void` | Start profiling |
| `stopRecording` | `() => void` | Stop profiling |
| `clearData` | `() => void` | Clear all data |
| `addCommit` | `(commit: CommitData) => void` | Add single commit |
| `addCommits` | `(commits: CommitData[]) => void` | Add multiple commits |
| `setAnalysisResults` | `(results: AnalysisResult) => void` | Set analysis results |
| `setWastedRenderReports` | `(reports: WastedRenderReport[]) => void` | Set wasted render reports |
| `setMemoReports` | `(reports: MemoReport[]) => void` | Set memo reports |
| `exportData` | `() => string` | Export as JSON string |
| `importData` | `(json: string) => void` | Import from JSON string |
| `importDataWithMigration` | `(json: string) => ImportResult` | Import with auto-migration |
| `validateImportData` | `(json: string) => ImportValidationResult` | Validate import data |
| `updateConfig` | `(config: Partial<ProfilerConfig>) => void` | Update profiler config |
| `selectCommit` | `(commitId: string \| null) => void` | Select commit |
| `selectComponent` | `(componentName: string \| null) => void` | Select component |
| `setTimeTravelIndex` | `(index: number \| null) => void` | Set time travel position |
| `toggleNode` | `(nodeId: string) => void` | Toggle node expansion |
| `expandAll` | `() => void` | Expand all nodes |
| `collapseAll` | `() => void` | Collapse all nodes |
| `expandAllNodes` | `() => void` | Alias for expandAll |
| `collapseAllNodes` | `() => void` | Alias for collapseAll |
| `toggleNodeExpanded` | `(nodeId: string) => void` | Toggle node expanded |
| `setFilterText` | `(text: string) => void` | Set filter text |
| `setViewMode` | `(mode: ViewMode) => void` | Set view mode |
| `runAnalysis` | `() => Promise<void>` | Run analysis |
| `toggleDetailPanel` | `() => void` | Toggle detail panel |
| `setSidebarWidth` | `(width: number) => void` | Set sidebar width |
| `setDetailPanelWidth` | `(width: number) => void` | Set detail panel width |
| `setComponentTypeFilter` | `(filter: 'all' \| 'memoized' \| 'unmemoized') => void` | Set component filter |
| `setSeverityFilter` | `(filter: ('critical' \| 'warning' \| 'info')[]) => void` | Set severity filter |
| `addRSCPayload` | `(payload: RSCPayload) => void` | Add RSC payload |
| `clearRSCData` | `() => void` | Clear RSC data |
| `setRSCAnalysis` | `(analysis: RSCAnalysisResult) => void` | Set RSC analysis |
| `analyzeRSC` | `(config?: Partial<RSCAnalysisConfig>) => Promise<void>` | Analyze RSC |
| `getRSCTotalPayloadSize` | `() => number` | Get total RSC payload size |
| `getRSCCacheHitRate` | `() => number` | Get RSC cache hit rate |
| `getRSCBoundaryCount` | `() => number` | Get RSC boundary count |
| `getRSCHasData` | `() => boolean` | Check if RSC data exists |

#### Selectors

```typescript
import { selectTreeData, selectSelectedCommit } from '@/panel/stores/profilerStore';

// Get tree data
const treeData = useProfilerStore(selectTreeData);

// Get selected commit
const selectedCommit = useProfilerStore(selectSelectedCommit);
```

---

### useSettingsStore

Store for user settings and preferences.

```typescript
import { useSettingsStore, DEFAULT_SETTINGS } from '@/panel/stores';

const { colorScheme, updateSetting, resetSettings } = useSettingsStore();
```

#### State

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxCommits` | `number` | 100 | Maximum commits to store |
| `enableTimeTravel` | `boolean` | true | Enable time-travel debugging |
| `showInlineDetails` | `boolean` | true | Show inline details in tree |
| `colorScheme` | `'light' \| 'dark' \| 'system'` | 'system' | UI color scheme |
| `wastedRenderThreshold` | `number` | 20 | Wasted render threshold % |
| `memoHitRateThreshold` | `number` | 70 | Memo hit rate threshold % |
| `sidebarWidth` | `number` | 280 | Default sidebar width |
| `detailPanelOpen` | `boolean` | true | Detail panel default state |
| `defaultViewMode` | `ViewMode` | 'tree' | Default view mode |
| `maxNodesPerCommit` | `number` | 10000 | Max nodes per commit |
| `analysisWorkerCount` | `number` | 2 | Analysis worker count |
| `enableAutoAnalysis` | `boolean` | false | Auto-run analysis |
| `exportIncludeMetrics` | `boolean` | true | Include metrics in exports |
| `exportIncludeReports` | `boolean` | true | Include reports in exports |
| `loaded` | `boolean` | false | Settings loaded state |

#### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `loadSettings` | `() => Promise<void>` | Load from chrome.storage |
| `saveSettings` | `() => Promise<void>` | Save to chrome.storage |
| `updateSetting` | `<K>(key: K, value: SettingsState[K]) => void` | Update single setting |
| `updateSettings` | `(updates: Partial<SettingsState>) => void` | Update multiple settings |
| `resetSettings` | `() => void` | Reset to defaults |
| `getProfilerConfig` | `() => ProfilerConfig` | Get profiler config |

---

### useConnectionStore

Store for managing connection to content script.

```typescript
import { useConnectionStore } from '@/panel/stores';

const { isConnected, sendMessage, reconnect } = useConnectionStore();
```

#### State

| Property | Type | Description |
|----------|------|-------------|
| `isConnected` | `boolean` | Connection status |
| `port` | `chrome.runtime.Port \| null` | Chrome runtime port |
| `error` | `string \| null` | Connection error |
| `lastError` | `string \| null` | Alias for error |
| `lastPing` | `number` | Last ping timestamp |
| `messageQueue` | `PanelMessage[]` | Pending messages |
| `pendingMessages` | `PanelMessage[]` | Alias for messageQueue |
| `messageHandlers` | `Set<(message: PanelMessage) => void>` | Message handlers |
| `retryCount` | `number` | Reconnection attempts |
| `isReconnecting` | `boolean` | Reconnection in progress |
| `tabId` | `number \| null` | Current tab ID |
| `bridgeState` | `BridgeState` | Bridge initialization state |
| `bridgeError` | `{ type, message, recoverable } \| null` | Bridge error details |
| `reactDetected` | `boolean \| null` | React detection status |
| `devtoolsDetected` | `boolean \| null` | DevTools detection status |

#### Actions

| Action | Signature | Description |
|--------|-----------|-------------|
| `connect` | `() => void` | Connect to content script |
| `disconnect` | `() => void` | Disconnect |
| `sendMessage` | `(message: PanelMessage) => void` | Send message |
| `sendTypedMessage` | `<T>(message: T) => void` | Send typed message |
| `handleMessage` | `(message: PanelMessage) => void` | Handle incoming message |
| `onMessage` | `(handler) => () => void` | Register handler |
| `ping` | `() => void` | Send ping |
| `reconnect` | `() => Promise<void>` | Reconnect with backoff |
| `setConnected` | `(connected: boolean) => void` | Set connection status |
| `setError` | `(error: string \| null) => void` | Set error |
| `flushPendingMessages` | `() => void` | Flush message queue |
| `addMessageHandler` | `(handler) => () => void` | Add message handler |
| `clearError` | `() => void` | Clear error |
| `setBridgeState` | `(state: BridgeState) => void` | Set bridge state |
| `setBridgeError` | `(error) => void` | Set bridge error |
| `setReactDetected` | `(detected: boolean) => void` | Set React detected |
| `setDevtoolsDetected` | `(detected: boolean) => void` | Set DevTools detected |

---

## Hook APIs

### useProfiler

Main hook for profiler functionality.

```typescript
import { useProfiler } from '@/panel/hooks';

const {
  isRecording,
  commits,
  startRecording,
  stopRecording,
  clearData,
} = useProfiler();
```

**Returns:** `UseProfilerReturn`

| Property | Type | Description |
|----------|------|-------------|
| `isRecording` | `boolean` | Recording state |
| `commits` | `CommitData[]` | All commits |
| `recordingDuration` | `number` | Recording duration |
| `startRecording` | `() => void` | Start recording |
| `stopRecording` | `() => void` | Stop recording |
| `clearData` | `() => void` | Clear data |
| `addCommit` | `(commit: CommitData) => void` | Add commit |

---

### useComponentData

Hook for accessing and filtering component data.

```typescript
import { useComponentData } from '@/panel/hooks';

const {
  componentData,
  selectedComponent,
  selectComponent,
  filteredComponents,
} = useComponentData();
```

**Returns:** `UseComponentDataReturn`

| Property | Type | Description |
|----------|------|-------------|
| `componentData` | `Map<string, ComponentData>` | All component data |
| `selectedComponent` | `string \| null` | Selected component name |
| `selectComponent` | `(name: string \| null) => void` | Select component |
| `filteredComponents` | `ComponentData[]` | Filtered components |
| `getComponentByName` | `(name: string) => ComponentData \| undefined` | Get component |
| `getWastedRendersForComponent` | `(name: string) => number` | Get wasted renders |
| `getMemoHitRateForComponent` | `(name: string) => number` | Get memo hit rate |

---

### useAnalysis

Hook for running and accessing analysis.

```typescript
import { useAnalysis } from '@/panel/hooks';

const {
  isAnalyzing,
  analysisResults,
  wastedRenderReports,
  memoReports,
  runAnalysis,
} = useAnalysis();
```

**Returns:** `UseAnalysisReturn`

| Property | Type | Description |
|----------|------|-------------|
| `isAnalyzing` | `boolean` | Analysis in progress |
| `analysisStage` | `AnalysisStage` | Current analysis stage |
| `analysisProgress` | `number` | Analysis progress (0-100) |
| `analysisResults` | `AnalysisResult \| null` | Analysis results |
| `wastedRenderReports` | `WastedRenderReport[]` | Wasted render reports |
| `memoReports` | `MemoReport[]` | Memo reports |
| `performanceScore` | `number` | Overall score |
| `runAnalysis` | `() => Promise<void>` | Run analysis |
| `analysisError` | `string \| null` | Error message |

---

### useRSCAnalysis

Hook for RSC analysis.

```typescript
import { useRSCAnalysis } from '@/panel/hooks';

const {
  rscPayloads,
  rscAnalysis,
  rscMetrics,
  isAnalyzingRSC,
  analyzeRSC,
} = useRSCAnalysis();
```

**Returns:** `UseRSCAnalysisReturn`

| Property | Type | Description |
|----------|------|-------------|
| `rscPayloads` | `RSCPayload[]` | RSC payloads |
| `rscAnalysis` | `RSCAnalysisResult \| null` | Analysis results |
| `rscMetrics` | `RSCMetrics \| null` | RSC metrics |
| `isAnalyzingRSC` | `boolean` | Analysis in progress |
| `analyzeRSC` | `(config?) => Promise<void>` | Analyze RSC |
| `totalPayloadSize` | `number` | Total payload size |
| `cacheHitRate` | `number` | Cache hit rate |
| `boundaryCount` | `number` | Number of boundaries |
| `hasRSCData` | `boolean` | Has RSC data |

---

### useExport

Hook for export/import functionality.

```typescript
import { useExport } from '@/panel/hooks';

const {
  exportData,
  importData,
  isExporting,
  isImporting,
  exportProgress,
  importProgress,
} = useExport();
```

**Returns:** `UseExportReturn`

| Property | Type | Description |
|----------|------|-------------|
| `exportData` | `(options?) => Promise<string>` | Export data |
| `importData` | `(json: string) => Promise<void>` | Import data |
| `isExporting` | `boolean` | Export in progress |
| `isImporting` | `boolean` | Import in progress |
| `exportProgress` | `ExportProgress` | Export progress |
| `importProgress` | `ImportProgress` | Import progress |
| `validateImport` | `(json: string) => ImportValidationResult` | Validate import |
| `downloadExport` | `(data: string, filename?) => void` | Download file |

---

### useVirtualList

Hook for virtualized list rendering.

```typescript
import { useVirtualList } from '@/panel/hooks';

const {
  virtualItems,
  totalHeight,
  scrollToIndex,
} = useVirtualList({
  itemCount: 1000,
  itemHeight: 50,
  overscan: 5,
});
```

**Options:** `UseVirtualListOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `itemCount` | `number` | required | Total items |
| `itemHeight` | `number` | required | Item height in px |
| `overscan` | `number` | 5 | Extra items to render |
| `scrollRef` | `RefObject<HTMLElement>` | - | Scroll container |

**Returns:** `UseVirtualListReturn`

| Property | Type | Description |
|----------|------|-------------|
| `virtualItems` | `VirtualItem[]` | Items to render |
| `totalHeight` | `number` | Total list height |
| `scrollToIndex` | `(index: number) => void` | Scroll to item |

---

### useResizeObserver

Hook for observing element resizes.

```typescript
import { useResizeObserver } from '@/panel/hooks';

const { ref, size } = useResizeObserver<HTMLDivElement>();

// size = { width: number, height: number }
```

**Returns:** `UseResizeObserverReturn`

| Property | Type | Description |
|----------|------|-------------|
| `ref` | `RefObject<T>` | Element ref |
| `size` | `ElementSize` | Current size |
| `width` | `number` | Element width |
| `height` | `number` | Element height |

---

### useDebounce

Debounce hook utilities.

```typescript
import { useDebounce, useDebouncedCallback, useDebounceState } from '@/panel/hooks';

// Debounce a value
const debouncedValue = useDebounce(value, 300);

// Debounce a callback
const debouncedFn = useDebouncedCallback(fn, 300);

// State with debounce
const [value, setValue] = useDebounceState(initialValue, 300);
```

---

### useLocalStorage

Local storage hook with error handling.

```typescript
import { useLocalStorage, useLocalStorageObject } from '@/panel/hooks';

// String storage
const [value, setValue, remove] = useLocalStorage('key', 'default');

// Object storage
const [obj, setObj, removeObj] = useLocalStorageObject('key', {});
```

---

### useKeyboardShortcuts

Keyboard shortcut management.

```typescript
import { useKeyboardShortcuts, createDefaultShortcuts } from '@/panel/hooks';

const shortcuts = createDefaultShortcuts({
  toggleRecording: () => toggleRecording(),
  clearData: () => clearData(),
});

useKeyboardShortcuts(shortcuts);
```

**ShortcutConfig:**

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | Key to match |
| `modifiers` | `ModifierKey[]` | Modifiers (ctrl, alt, shift, meta) |
| `action` | `() => void` | Action to execute |
| `description` | `string` | Description for help |
| `category` | `string` | Category for grouping |
| `preventDefault` | `boolean` | Prevent default behavior |

---

## Utility Functions

### Wasted Render Analysis

```typescript
import { 
  detectWastedRenders,
  calculateWastedRenderRate,
  generateWastedRenderReport 
} from '@/panel/utils/wastedRenderAnalysis';

// Detect wasted renders
const wastedRenders = detectWastedRenders(commits, options);

// Calculate rate
const rate = calculateWastedRenderRate(componentRenders, wastedCount);

// Generate report
const report = generateWastedRenderReport(componentName, commits);
```

### Memo Analysis

```typescript
import { 
  analyzeMemoEffectiveness,
  calculateOptimalHitRate,
  detectMemoIssues 
} from '@/panel/utils/memoAnalysis';

// Analyze memo effectiveness
const analysis = analyzeMemoEffectiveness(componentData);

// Detect specific issues
const issues = detectMemoIssues(componentData, commits);
```

### Performance Score

```typescript
import { 
  calculatePerformanceScore,
  getScoreRating,
  generateScoreBreakdown 
} from '@/panel/utils/performanceScore';

// Calculate overall score
const score = calculatePerformanceScore(analysisData);

// Get rating
const rating = getScoreRating(score); // 'excellent' | 'good' | 'fair' | 'poor'

// Get breakdown
const breakdown = generateScoreBreakdown(analysisData);
```

### Shallow Equality

```typescript
import { shallowEqual, shallowEqualArrays } from '@/panel/utils/shallowEqual';

// Compare objects
const equal = shallowEqual(objA, objB);

// Compare arrays
const arraysEqual = shallowEqualArrays(arrA, arrB);
```

### Timeline Generation

```typescript
import { generateTimeline, calculateTimelineMetrics } from '@/panel/utils/timelineGenerator';

// Generate timeline data
const timeline = generateTimeline(commits, options);

// Calculate metrics
const metrics = calculateTimelineMetrics(timeline);
```

---

## Type Definitions

### Core Types

```typescript
// From @/shared/types

interface CommitData {
  id: string;
  timestamp: number;
  nodes?: FiberNode[];
  rootId?: number;
  priorityLevel: 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';
  interactions?: InteractionData[];
  duration: number;
}

interface FiberNode {
  id: number;
  displayName: string;
  actualDuration: number;
  baseDuration: number;
  props: Record<string, unknown>;
  prevProps?: Record<string, unknown>;
  state?: Record<string, unknown>;
  prevState?: Record<string, unknown>;
  hasContextChanged: boolean;
  parentId: number | null;
  children: number[];
  isMemoized: boolean;
  memoType?: 'React.memo' | 'PureComponent' | 'custom';
}

interface ComponentMetrics {
  componentName: string;
  renderCount: number;
  wastedRenderCount: number;
  wastedRenderRate: number;
  totalRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  isMemoized: boolean;
  memoHitRate?: number;
  firstSeen: number;
  lastSeen: number;
}

interface WastedRenderReport {
  componentName: string;
  renderCount: number;
  totalRenders: number;
  wastedRenders: number;
  wastedRenderRate: number;
  recommendedAction: 'memo' | 'useMemo' | 'useCallback' | 'none';
  estimatedSavingsMs: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  issues: WastedRenderIssue[];
}

interface MemoReport {
  componentName: string;
  currentHitRate: number;
  optimalHitRate: number;
  isEffective: boolean;
  issues: MemoIssue[];
  recommendations: MemoRecommendation[];
}

interface AnalysisResult {
  timestamp: number;
  totalCommits: number;
  wastedRenderReports: WastedRenderReport[];
  memoReports: MemoReport[];
  performanceScore: number;
  topOpportunities: OptimizationOpportunity[];
}

interface OptimizationOpportunity {
  componentName: string;
  type: 'memo' | 'useMemo' | 'useCallback' | 'split-props' | 'colocate-state';
  impact: 'high' | 'medium' | 'low';
  estimatedSavings: number;
  description: string;
}
```

### RSC Types

```typescript
// From @/shared/types/rsc

interface RSCPayload {
  id: string;
  timestamp: number;
  totalSize: number;
  chunks: RSCChunk[];
  boundaries: RSCBoundary[];
  serverComponentCount: number;
  clientComponentCount: number;
}

interface RSCBoundary {
  id: string;
  componentName: string;
  propsSize: number;
  cacheStatus?: 'hit' | 'miss' | 'none';
}

interface RSCMetrics {
  payloadSize: number;
  transferTime: number;
  serializationCost: number;
  deserializationCost: number;
  serverComponentCount: number;
  clientComponentCount: number;
  boundaryCount: number;
  boundaryMetrics: RSCBoundaryMetric[];
  streamMetrics: RSCStreamMetrics;
  cacheHitRatio: number;
}

interface RSCAnalysisResult {
  metrics: RSCMetrics;
  issues: RSCIssue[];
  recommendations: RSCRecommendation[];
}
```

### Plugin Types

```typescript
// From @/panel/plugins/types

interface AnalysisPlugin {
  metadata: PluginMetadata;
  hooks?: PluginHooks;
  getMetrics?: (api: PluginAPI, context: PluginContext) => PluginMetric[];
  getUI?: (api: PluginAPI, context: PluginContext) => ComponentType<PluginUIProps> | null;
  SettingsComponent?: ComponentType<PluginSettingsProps>;
  destroy?: () => void;
}

interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  enabledByDefault?: boolean;
  settingsSchema?: PluginSettingSchema[];
}

interface PluginAPI {
  // Data Access
  getCommits: () => CommitData[];
  getAnalysisResults: () => AnalysisResult | null;
  getRSCPayloads: () => RSCPayload[];
  getRSCAnalysis: () => RSCAnalysisResult | null;
  getConfig: () => Record<string, unknown>;
  getSelectedCommit: () => CommitData | null;
  getSelectedComponent: () => string | null;
  isRecording: () => boolean;
  
  // Data Storage
  setPluginData: <T>(key: string, data: T) => void;
  getPluginData: <T>(key: string) => T | undefined;
  removePluginData: (key: string) => void;
  clearPluginData: () => void;
  
  // UI Integration
  registerPanel: (panel: PluginPanel) => () => void;
  showNotification: (notification: PluginNotification) => void;
  registerContextMenuItem: (item: PluginContextMenuItem) => () => void;
  
  // Actions
  runAnalysis: () => Promise<void>;
  exportData: () => string;
  selectCommit: (commitId: string) => void;
  selectComponent: (componentName: string) => void;
  
  // Utilities
  getFiberNode: (commitId: string, nodeId: number) => FiberNode | undefined;
  walkFiberTree: (commitId: string, callback) => void;
  debounce: <T>(fn: T, ms: number) => T;
  throttle: <T>(fn: T, ms: number) => T;
}

interface PluginContext {
  pluginId: string;
  getSettings: <T>() => T;
  setSettings: (settings: Record<string, unknown>) => void;
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args) => void;
  emit: (eventName: string, payload?: unknown) => void;
  on: (eventName: string, handler) => () => void;
}

interface PluginMetric {
  id: string;
  name: string;
  value: number | string | boolean;
  formattedValue?: string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendPositive?: boolean;
  description?: string;
  category?: string;
  priority?: number;
}
```

### Performance Budget Types

```typescript
// From @/shared/performance-budgets

interface BudgetConfig {
  version: number;
  projectName?: string;
  wastedRenderThreshold: number;
  memoHitRateThreshold: number;
  maxRenderTimeMs: number;
  maxRSCPayloadSize: number;
  minPerformanceScore: number;
  maxSlowRenderPercentage: number;
  bundleBudgets?: BundleBudgets;
  coverageThresholds?: CoverageThresholds;
  budgets: PerformanceBudget[];
  failOnWarning: boolean;
  outputFormat: 'json' | 'human';
}

interface BudgetCheckResult {
  passed: boolean;
  totalViolations: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  violations: BudgetViolation[];
  summary: BudgetSummary;
  bundleResults?: BundleCheckResult[];
  coverageResult?: CoverageCheckResult;
}

interface BudgetViolation {
  id: string;
  budgetId: string;
  budgetName: string;
  severity: 'error' | 'warning' | 'info';
  actualValue: number;
  threshold: number;
  difference: number;
  percentageOver: number;
  message: string;
  recommendation?: string;
  timestamp: number;
}
```

---

## Constants

```typescript
// From @/shared/constants

export const MAX_COMMITS = 500;
export const MIN_SIDEBAR_WIDTH = 180;
export const MAX_SIDEBAR_WIDTH = 600;

// Fiber tags
export enum FiberTag {
  FunctionComponent = 0,
  ClassComponent = 1,
  HostComponent = 5,
  SimpleMemoComponent = 12,
  MemoComponent = 21,
}

// Priority levels
export enum PriorityLevel {
  NoPriority = 0,
  ImmediatePriority = 1,
  UserBlockingPriority = 2,
  NormalPriority = 3,
  LowPriority = 4,
  IdlePriority = 5,
}
```

---

For more details, see:
- [Store Implementation](../src/panel/stores/)
- [Hook Implementation](../src/panel/hooks/)
- [Type Definitions](../src/shared/types/)
