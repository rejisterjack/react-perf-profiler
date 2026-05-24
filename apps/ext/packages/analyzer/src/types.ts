/**
 * Core types for @react-perf-profiler/analyzer.
 * Self-contained — zero browser or extension dependencies.
 */

export type Severity = 'low' | 'medium' | 'high' | 'critical';

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
  deltaChangedFibers?: FiberData[];
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
  severity: Severity;
}

export interface WastedRenderReport {
  componentName: string;
  renderCount: number;
  totalRenders: number;
  wastedRenders: number;
  wastedRenderRate: number;
  recommendedAction: 'memo' | 'useMemo' | 'useCallback' | 'none';
  estimatedSavingsMs: number;
  severity: Severity;
  issues: WastedRenderIssue[];
}

export interface MemoIssue {
  type: 'unstable-callback' | 'unstable-object' | 'unstable-array' | 'inline-jsx' | 'deep-prop';
  propName: string;
  description: string;
  suggestion: string;
  severity: Severity;
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

export interface OptimizationOpportunity {
  componentName: string;
  type: 'memo' | 'useMemo' | 'useCallback' | 'split-props' | 'colocate-state';
  impact: 'high' | 'medium' | 'low';
  estimatedSavings: number;
  description: string;
}

export interface AnomalyReportEntry {
  commitIndex: number;
  duration: number;
  expectedRange: { low: number; high: number };
  zScore: number;
  severity: Severity;
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
