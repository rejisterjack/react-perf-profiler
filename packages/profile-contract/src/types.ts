/**
 * Canonical profile data contract for React Perf Profiler.
 *
 * This is the single source of truth for every type that crosses a process
 * boundary: MAIN-world bridge → ISOLATED content script → service worker →
 * DevTools panel → analyzer Web Worker, AND extension → web API.
 *
 * Constraints:
 *  - Pure types only. No runtime values, no browser/Node APIs.
 *  - No imports from `apps/ext` or `apps/web`.
 *  - Every type here must have a mirroring Zod schema in `./schema.ts` if it
 *    is part of an on-the-wire payload.
 */

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface SourceLocation {
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

/**
 * A serialized React Fiber node. Captured by the MAIN-world bridge from
 * `__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot` and forwarded through
 * the extension pipeline. Stored verbatim in uploaded profiles.
 *
 * Note: `type`, `elementType`, and `memoizedState` are intentionally
 * `unknown` because React fibers carry heterogeneous runtime values
 * (functions, classes, symbols, raw state) that have no useful static shape.
 */
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

export type RenderCauseType =
  | 'props-changed'
  | 'state-changed'
  | 'parent-rerendered'
  | 'context-changed'
  | 'hooks-changed';

export interface RenderCauseEntry {
  type: RenderCauseType;
  details: string;
  changedKeys?: string[];
}

export interface RenderCause {
  fiberId: string;
  componentName: string;
  causes: RenderCauseEntry[];
}

export type PriorityLevelString = 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';

export interface InteractionData {
  id: number;
  name: string;
  timestamp: number;
}

/**
 * One React commit. This is the atomic unit captured by the bridge and the
 * atomic unit stored in an uploaded profile.
 */
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

export interface CommitData {
  id: string;
  timestamp: number;
  priorityLevel: PriorityLevelString;
  interactions?: InteractionData[];
  duration: number;
  /** Full fiber tree for the commit. Absent on delta commits (`isDelta: true`). */
  rootFiber?: FiberData | null;
  /** Flat fiber list (alternative to walking `rootFiber`). */
  fibers?: FiberData[];
  /**
   * Panel-side flattened representation of the commit's components.
   * Populated by the extension when persisting/uploading for legacy
   * viewers that consume this shape instead of `rootFiber`/`fibers`.
   */
  nodes?: FiberNode[];
  /** When `nodes` is present, the id of the root node in that array. */
  rootId?: number;
  reactVersion?: string;
  priorityLevelString?: PriorityLevelString;
  actualDuration?: number;
  actualStartTime?: number;
  renderCauses?: RenderCause[];
  changedFiberIds?: string[];
  /** Delta commits carry only the changed/removed fibers, not the full tree. */
  isDelta?: boolean;
  deltaChangedFibers?: FiberData[];
  deltaRemovedFiberIds?: string[];
}

// ---------------------------------------------------------------------------
// Analysis output types (also persisted alongside profiles and shipped to APM)
// ---------------------------------------------------------------------------

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

export type WastedRenderIssueType =
  | 'prop-reference'
  | 'state-reference'
  | 'inline-function'
  | 'inline-object'
  | 'inline-array'
  | 'context-change';

export interface WastedRenderIssue {
  type: WastedRenderIssueType;
  description: string;
  suggestion: string;
  occurrences: string[];
  severity: Severity;
}

export type WastedRenderAction = 'memo' | 'useMemo' | 'useCallback' | 'none';

export interface WastedRenderReport {
  componentName: string;
  renderCount: number;
  totalRenders: number;
  wastedRenders: number;
  wastedRenderRate: number;
  recommendedAction: WastedRenderAction;
  estimatedSavingsMs: number;
  severity: Severity;
  issues: WastedRenderIssue[];
}

export type MemoIssueType =
  | 'unstable-callback'
  | 'unstable-object'
  | 'unstable-array'
  | 'inline-jsx'
  | 'deep-prop';

export interface MemoIssue {
  type: MemoIssueType;
  propName: string;
  description: string;
  suggestion: string;
  severity: Severity;
}

export type MemoRecommendationType = 'useCallback' | 'useMemo' | 'React.memo' | 'split-props';

export interface MemoRecommendation {
  type: MemoRecommendationType;
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

/** Backwards-compatible alias used in some extension modules. */
export type MemoEffectivenessReport = MemoReport;

export type OptimizationType =
  | 'memo'
  | 'useMemo'
  | 'useCallback'
  | 'split-props'
  | 'colocate-state';

export type Impact = 'high' | 'medium' | 'low';

export interface OptimizationOpportunity {
  componentName: string;
  type: OptimizationType;
  impact: Impact;
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

export type TrendDirection = 'improving' | 'stable' | 'degrading';

export interface TrendReportEntry {
  componentName: string;
  slope: number;
  rSquared: number;
  direction: TrendDirection;
  sampleSize: number;
}

export type RenderPattern = 'burst' | 'periodic' | 'cascade' | 'escalating';

export interface PatternReportEntry {
  pattern: RenderPattern;
  components: string[];
  description: string;
  confidence: number;
}

/**
 * The full analysis envelope. Persisted alongside the raw commit data and
 * surfaced to the user in the panel/dashboard.
 */
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

// ---------------------------------------------------------------------------
// API envelope (extension ↔ web API)
// ---------------------------------------------------------------------------

/**
 * Light-weight metadata about a profile, returned by `GET /api/profiles`
 * listings. Does not include the (potentially large) `data` payload.
 */
export interface ProfileMetadata {
  reactVersion?: string;
  totalCommits?: number;
  totalComponents?: number;
  performanceScore?: number;
  durationMs?: number;
  source?: 'extension' | 'cli' | 'import';
  [key: string]: unknown;
}

/** A stored profile record, as returned by `GET /api/profiles/[id]`. */
export interface ProfileRecord {
  id: string;
  userId: string;
  name: string;
  data: CommitData[];
  analysis?: AnalysisResult | null;
  metadata: ProfileMetadata;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Body of `POST /api/profiles`. `data` MUST be an array of `CommitData`.
 * `analysis` is optional (the server can run analysis lazily).
 */
export interface ProfileUploadRequest {
  name: string;
  data: CommitData[];
  analysis?: AnalysisResult;
  metadata?: ProfileMetadata;
  isPublic?: boolean;
}

export interface ProfileUploadResponse {
  profile: Pick<
    ProfileRecord,
    'id' | 'userId' | 'name' | 'isPublic' | 'createdAt' | 'updatedAt'
  > & { metadata: ProfileMetadata };
}
