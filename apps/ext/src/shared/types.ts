/**
 * Shared TypeScript types for React Perf Profiler
 */

export enum FiberTag {
  FunctionComponent = 0,
  ClassComponent = 1,
  IndeterminateComponent = 2,
  HostRoot = 3,
  HostPortal = 4,
  HostComponent = 5,
  HostText = 6,
  Fragment = 7,
  Mode = 8,
  ContextConsumer = 9,
  ContextProvider = 10,
  ForwardRef = 11,
  Profiler = 12,
  SuspenseComponent = 13,
  MemoComponent = 14,
  SimpleMemoComponent = 15,
  LazyComponent = 16,
  IncompleteClassComponent = 17,
  DehydratedFragment = 18,
  SuspenseListComponent = 19,
  ScopeComponent = 21,
  OffscreenComponent = 22,
  LegacyHiddenComponent = 23,
  CacheComponent = 24,
  TracingMarkerComponent = 25,
}

export enum PriorityLevel {
  NoPriority = 0,
  ImmediatePriority = 1,
  UserBlockingPriority = 2,
  NormalPriority = 3,
  LowPriority = 4,
  IdlePriority = 5,
}

export interface SourceLocation {
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

export interface FiberData {
  id: string;
  displayName: string;
  key: string | null;
  child: FiberData | null;
  sibling: FiberData | null;
  return: FiberData | null;
  type: unknown;
  elementType: unknown;
  memoizedProps: Record<string, unknown>;
  memoizedState: unknown;
  actualDuration: number;
  actualStartTime: number;
  selfBaseDuration: number;
  treeBaseDuration: number;
  tag: number;
  index: number;
  flags?: number;
  mode: number;
  sourceLocation?: SourceLocation;
}

export interface FiberNode {
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

export interface WebVitalMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  element?: string | null;
  url?: string | null;
  delta?: number;
}

export interface RenderCause {
  fiberId: string;
  componentName: string;
  causes: Array<{
    type: 'props-changed' | 'state-changed' | 'parent-rerendered' | 'context-changed' | 'hooks-changed';
    details: string;
    changedKeys?: string[];
  }>;
}

export interface CommitData {
  id: string;
  timestamp: number;
  nodes?: FiberNode[];
  rootId?: number;
  priorityLevel: 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';
  interactions?: InteractionData[];
  duration: number;
  rootFiber?: FiberData | null;
  fibers?: FiberData[];
  reactVersion?: string;
  priorityLevelString?: 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';
  actualDuration?: number;
  actualStartTime?: number;
  renderCauses?: RenderCause[];
  changedFiberIds?: string[];
  isDelta?: boolean;
  /** Delta serialization: only the fibers that changed */
  deltaChangedFibers?: FiberData[];
  /** Delta serialization: fiber IDs removed since base commit */
  deltaRemovedFiberIds?: string[];
}

export interface InteractionData {
  id: number;
  name: string;
  timestamp: number;
}

export interface ComponentMetrics {
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

export interface WastedRenderIssue {
  type: 'prop-reference' | 'state-reference' | 'inline-function' | 'inline-object' | 'inline-array' | 'context-change';
  description: string;
  suggestion: string;
  occurrences: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface WastedRenderReport {
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

export interface MemoIssue {
  type: 'unstable-callback' | 'unstable-object' | 'unstable-array' | 'inline-jsx' | 'deep-prop';
  propName: string;
  description: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MemoRecommendation {
  type: 'useCallback' | 'useMemo' | 'React.memo' | 'split-props';
  description: string;
  codeExample?: string;
}

export interface MemoReport {
  componentName: string;
  hasMemo: boolean;
  currentHitRate: number;
  optimalHitRate: number;
  isEffective: boolean;
  issues: MemoIssue[];
  recommendations: MemoRecommendation[];
}

export type MemoEffectivenessReport = MemoReport;

export interface AnomalyReportEntry {
  commitIndex: number;
  duration: number;
  expectedRange: { low: number; high: number };
  zScore: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AnomalyReportGroup {
  componentName: string;
  reports: AnomalyReportEntry[];
}

export interface TrendReportEntry {
  componentName: string;
  slope: number;
  rSquared: number;
  direction: 'improving' | 'stable' | 'degrading';
  sampleSize: number;
}

export interface PatternReportEntry {
  pattern: 'burst' | 'periodic' | 'cascade' | 'escalating';
  components: string[];
  description: string;
  confidence: number;
}

export interface AnalysisResult {
  timestamp: number;
  totalCommits: number;
  wastedRenderReports: WastedRenderReport[];
  memoReports: MemoReport[];
  performanceScore: number;
  topOpportunities: OptimizationOpportunity[];
  anomalyReports?: AnomalyReportGroup[];
  trendReports?: TrendReportEntry[];
  patternReports?: PatternReportEntry[];
}

export interface OptimizationOpportunity {
  componentName: string;
  type: 'memo' | 'useMemo' | 'useCallback' | 'split-props' | 'colocate-state';
  impact: 'high' | 'medium' | 'low';
  estimatedSavings: number;
  description: string;
}

export interface ProfilerConfig {
  maxCommits: number;
  maxNodesPerCommit: number;
  analysisWorkerCount: number;
  enableTimeTravel: boolean;
  maxComponentDataEntries: number;
  wastedRenderThreshold: number;
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Theme = 'light' | 'dark' | 'system';

export interface AnalysisSummary {
  totalCommits: number;
  totalComponents: number;
  wastedRenderCount: number;
  memoIssueCount: number;
  performanceScore: number;
  timestamp: number;
}

export interface DataFilters {
  componentName?: string;
  severity?: Severity;
  minRenderCount?: number;
  minWastedRate?: number;
  memoizedOnly?: boolean;
  issuesOnly?: boolean;
}

export type MessageType =
  | 'START_PROFILING' | 'STOP_PROFILING' | 'CLEAR_DATA' | 'INIT' | 'PING'
  | 'PONG' | 'GET_DATA' | 'COMMIT' | 'COMMIT_DATA' | 'COMPONENT_SELECTED'
  | 'ANALYSIS_COMPLETE' | 'ERROR' | string;

export interface BaseExtensionMessage {
  type: MessageType;
  messageId?: string;
  timestamp?: number;
  tabId?: number;
  payload?: unknown;
}

export type ExtensionMessage =
  | { type: 'START_PROFILING' | 'STOP_PROFILING' | 'CLEAR_DATA' | 'INIT' | 'PING' | 'PONG' | 'GET_DATA'; tabId?: number; payload?: unknown; messageId?: string; timestamp?: number }
  | { type: 'COMMIT_DATA' | 'COMMIT'; payload: CommitData; tabId?: number; messageId?: string; timestamp?: number }
  | { type: 'COMPONENT_SELECTED'; payload: { componentName: string }; tabId?: number; messageId?: string; timestamp?: number }
  | { type: 'ANALYSIS_COMPLETE'; payload: AnalysisResult; tabId?: number; messageId?: string; timestamp?: number }
  | { type: 'ERROR'; payload: { message: string; error?: unknown }; tabId?: number; messageId?: string; timestamp?: number }
  | { type: string; payload?: unknown; tabId?: number; messageId?: string; timestamp?: number }
  | BaseExtensionMessage;

// Bridge message types
export interface BridgeMessage {
  source: 'react-perf-profiler-bridge';
  token?: string;
  payload: {
    type: string;
    data?: unknown;
    error?: string;
    errorType?: string;
    recoverable?: boolean;
    retryCount?: number;
    maxRetries?: number;
    nextRetryIn?: number;
    reactDetected?: boolean;
    devtoolsDetected?: boolean;
    isInitialized?: boolean;
  };
}

// Background message types
export interface BackgroundMessage {
  type: string;
  payload?: unknown;
  error?: string;
  tabId?: number;
}

export interface ConnectionState {
  isConnected: boolean;
  port: RuntimePort | null;
  lastPing: number;
}

// WXT uses `browser` from `wxt/browser` which has the same shape as chrome.runtime.Port
export type RuntimePort = { postMessage: (msg: unknown) => void; disconnect: () => void; onMessage: { addListener: (fn: (msg: unknown) => void) => void }; onDisconnect: { addListener: (fn: () => void) => void } };
