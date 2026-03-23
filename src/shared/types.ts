/**
 * Shared TypeScript types for React Perf Profiler
 * @module shared/types
 */

/**
 * React Fiber tag constants (matching React internals)
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
  SimpleMemoComponent = 12,
  LazyComponent = 13,
  MemoComponent = 21,
}

/**
 * React priority levels
 */
export enum PriorityLevel {
  NoPriority = 0,
  ImmediatePriority = 1,
  UserBlockingPriority = 2,
  NormalPriority = 3,
  LowPriority = 4,
  IdlePriority = 5,
}

/**
 * Type guard for message types
 */
export function isMessageType(value: unknown): value is string {
  const validTypes = [
    'COMMIT',
    'START_PROFILING',
    'STOP_PROFILING',
    'CLEAR_DATA',
    'GET_DATA',
    'COMPONENT_SELECTED',
    'ANALYSIS_COMPLETE',
    'INIT',
    'PING',
    'PONG',
    'ERROR',
  ];
  return typeof value === 'string' && validTypes.includes(value);
}

/**
 * Type guard for severity levels
 */
export function isSeverity(value: unknown): value is 'critical' | 'warning' | 'info' {
  return value === 'critical' || value === 'warning' || value === 'info';
}

/**
 * Type guard for recommended actions
 */
export function isRecommendedAction(
  value: unknown
): value is 'memo' | 'useMemo' | 'useCallback' | 'none' | 'colocate' {
  return (
    value === 'memo' ||
    value === 'useMemo' ||
    value === 'useCallback' ||
    value === 'none' ||
    value === 'colocate'
  );
}

/**
 * Represents a parsed React Fiber node (matches content script structure)
 * This is defined here to avoid circular dependencies
 */
export interface FiberData {
  /** Unique identifier for the fiber node */
  id: string;
  /** Component display name */
  displayName: string;
  /** React key if provided */
  key: string | null;
  /** First child fiber */
  child: FiberData | null;
  /** Sibling fiber */
  sibling: FiberData | null;
  /** Parent fiber (called 'return' in React internals) */
  return: FiberData | null;
  /** The type of the component (function, class, host component, etc.) */
  type: unknown;
  /** The element type */
  elementType: unknown;
  /** Current props */
  memoizedProps: Record<string, unknown>;
  /** Current state */
  memoizedState: unknown;
  /** Time spent rendering this fiber and its descendants */
  actualDuration: number;
  /** When this fiber started rendering */
  actualStartTime: number;
  /** Duration without children (self time) */
  selfBaseDuration: number;
  /** Total base duration including children */
  treeBaseDuration: number;
  /** Fiber tag indicating the type of work */
  tag: number;
  /** Index among siblings */
  index: number;
  /**
   * React internal flags bitmask (optional — populated by content script when available).
   * React 17 sets ContextChanged = 0x40 when a context subscription changed.
   * React 18 uses 0x1000 for the same purpose.
   */
  flags?: number;
  /** Bitfield for mode (concurrent, strict, etc.) */
  mode: number;
}

/**
 * Represents a single node in the React fiber tree during a commit
 */
export interface FiberNode {
  /** Unique identifier for the fiber node */
  id: number;
  /** Display name of the component */
  displayName: string;
  /** Actual render duration in milliseconds */
  actualDuration: number;
  /** Total time including children in milliseconds */
  baseDuration: number;
  /** Current props of the component */
  props: Record<string, unknown>;
  /** Previous props from last render */
  prevProps?: Record<string, unknown>;
  /** Current state of the component */
  state?: Record<string, unknown>;
  /** Previous state from last render */
  prevState?: Record<string, unknown>;
  /** Whether the component's context has changed */
  hasContextChanged: boolean;
  /** Parent node ID (null for root) */
  parentId: number | null;
  /** Child node IDs */
  children: number[];
  /** Whether the component is memoized */
  isMemoized: boolean;
  /** Memo comparison function type */
  memoType?: 'React.memo' | 'PureComponent' | 'custom';
}

/**
 * Data captured for a single React commit phase
 * Merged interface that supports both content script and panel usages
 */
export interface CommitData {
  /** Unique commit identifier */
  id: string;
  /** Timestamp when commit occurred */
  timestamp: number;
  /** All fiber nodes in this commit (panel view) */
  nodes?: FiberNode[];
  /** Root component that triggered the commit (panel view) */
  rootId?: number;
  /** React priority level */
  priorityLevel: 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';
  /** Interactions that triggered this commit */
  interactions?: InteractionData[];
  /** Duration of the commit in milliseconds */
  duration: number;

  // Properties from content/types.ts for content script compatibility
  /** Root fiber data (content script view) */
  rootFiber?: FiberData | null;
  /** All fibers in the tree - can be an array from content script */
  fibers?: FiberData[];
  /** React version if available */
  reactVersion?: string;
  /** React priority level string (alternative to priorityLevel) */
  priorityLevelString?: 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';
  /** Actual render duration in milliseconds (alias for duration) */
  actualDuration?: number;
  /** When this fiber started rendering */
  actualStartTime?: number;
}

/**
 * User interaction that triggered a render
 */
export interface InteractionData {
  /** Interaction ID */
  id: number;
  /** Name of the interaction */
  name: string;
  /** Timestamp when interaction started */
  timestamp: number;
}

/**
 * Metrics calculated for a specific component across all commits
 */
export interface ComponentMetrics {
  /** Component display name */
  componentName: string;
  /** Total number of renders */
  renderCount: number;
  /** Number of wasted (unnecessary) renders */
  wastedRenderCount: number;
  /** Percentage of renders that were wasted */
  wastedRenderRate: number;
  /** Total time spent rendering in milliseconds */
  totalRenderTime: number;
  /** Average render duration in milliseconds */
  averageRenderTime: number;
  /** Maximum render duration in milliseconds */
  maxRenderTime: number;
  /** Minimum render duration in milliseconds */
  minRenderTime: number;
  /** Whether the component is wrapped in React.memo */
  isMemoized: boolean;
  /** Memo hit rate (0-1) if memoized */
  memoHitRate?: number;
  /** First seen timestamp */
  firstSeen: number;
  /** Last seen timestamp */
  lastSeen: number;
}

/**
 * Individual wasted render issue
 */
export interface WastedRenderIssue {
  /** Type of issue */
  type:
    | 'prop-reference'
    | 'state-reference'
    | 'inline-function'
    | 'inline-object'
    | 'inline-array'
    | 'context-change';
  /** Description of the issue */
  description: string;
  /** Suggested fix */
  suggestion: string;
  /** Commit IDs where this issue occurred */
  occurrences: string[];
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Report for wasted render analysis
 */
export interface WastedRenderReport {
  /** Component name */
  componentName: string;
  /** Total render count */
  renderCount: number;
  /** Total number of renders */
  totalRenders: number;
  /** Number of wasted renders */
  wastedRenders: number;
  /** Percentage of renders that were wasted */
  wastedRenderRate: number;
  /** Recommended optimization action */
  recommendedAction: 'memo' | 'useMemo' | 'useCallback' | 'none';
  /** Estimated time savings in milliseconds */
  estimatedSavingsMs: number;
  /** Severity level of the wasted render issue */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Specific issues detected */
  issues: WastedRenderIssue[];
}

/**
 * Individual memoization issue
 */
export interface MemoIssue {
  /** Type of memo issue */
  type: 'unstable-callback' | 'unstable-object' | 'unstable-array' | 'inline-jsx' | 'deep-prop';
  /** Property name causing the issue */
  propName: string;
  /** Description of the issue */
  description: string;
  /** Suggested fix */
  suggestion: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Memoization recommendation
 */
export interface MemoRecommendation {
  /** Type of recommendation */
  type: 'useCallback' | 'useMemo' | 'React.memo' | 'split-props';
  /** Description of the recommendation */
  description: string;
  /** Code example or suggested fix */
  codeExample?: string;
}

/**
 * Report for memoization effectiveness analysis
 */
export interface MemoReport {
  /** Component name */
  componentName: string;
  /** Whether component uses React.memo */
  hasMemo: boolean;
  /** Current memo hit rate (0-1) */
  currentHitRate: number;
  /** Optimal achievable hit rate */
  optimalHitRate: number;
  /** Whether current memoization is effective */
  isEffective: boolean;
  /** Issues preventing effective memoization */
  issues: MemoIssue[];
  /** Recommendations for improving memoization */
  recommendations: MemoRecommendation[];
}

/**
 * Memo effectiveness report (alias for MemoReport)
 */
export type MemoEffectivenessReport = MemoReport;

/**
 * Complete analysis results
 */
export interface AnalysisResult {
  /** Timestamp when analysis completed */
  timestamp: number;
  /** Total commits analyzed */
  totalCommits: number;
  /** Wasted render reports */
  wastedRenderReports: WastedRenderReport[];
  /** Memo effectiveness reports */
  memoReports: MemoReport[];
  /** Overall performance score (0-100) */
  performanceScore: number;
  /** Top optimization opportunities */
  topOpportunities: OptimizationOpportunity[];
}

/**
 * Optimization opportunity
 */
export interface OptimizationOpportunity {
  /** Component name */
  componentName: string;
  /** Type of optimization */
  type: 'memo' | 'useMemo' | 'useCallback' | 'split-props' | 'colocate-state';
  /** Potential impact */
  impact: 'high' | 'medium' | 'low';
  /** Estimated time savings in ms */
  estimatedSavings: number;
  /** Description of the opportunity */
  description: string;
}

/**
 * Message types for communication between content script and devtools panel
 */
export type PanelMessage =
  | { type: 'START_PROFILING' }
  | { type: 'STOP_PROFILING' }
  | { type: 'CLEAR_DATA' }
  | { type: 'COMMIT_DATA'; payload: CommitData }
  | { type: 'CONNECTION_STATUS'; payload: { connected: boolean } }
  | { type: 'PONG' }
  | { type: 'ERROR'; payload: { message: string; errorType?: string; recoverable?: boolean } }
  // Bridge-related messages
  | { type: 'BRIDGE_INIT'; payload: { success?: boolean; reactVersion?: string; supportsFiber?: boolean; rendererCount?: number; state?: string } }
  | { type: 'BRIDGE_ERROR'; payload: { message: string; errorType?: string; recoverable?: boolean } }
  | { type: 'GET_BRIDGE_STATUS' }
  | { type: 'BRIDGE_STATUS'; payload: { state: string; error?: { type: string; message: string; recoverable: boolean } | null; retryCount: number; isInjected: boolean; reactDetected: boolean } }
  | { type: 'DETECT_REACT' }
  | { type: 'REACT_DETECT_RESULT'; payload: { reactDetected?: boolean; devtoolsDetected?: boolean; isInitialized?: boolean } }
  | { type: 'FORCE_INIT' }
  // Analysis-related messages
  | { type: 'ANALYSIS_STARTED' }
  | { type: 'ANALYSIS_PROGRESS'; payload: { stage: string; progress: number } }
  | { type: 'ANALYSIS_COMPLETE'; payload: AnalysisResult };

/**
 * Message type values
 */
export type MessageType =
  | 'START_PROFILING'
  | 'STOP_PROFILING'
  | 'CLEAR_DATA'
  | 'INIT'
  | 'PING'
  | 'PONG'
  | 'GET_DATA'
  | 'COMMIT'
  | 'COMMIT_DATA'
  | 'COMPONENT_SELECTED'
  | 'ANALYSIS_COMPLETE'
  | 'ERROR'
  | string;

/**
 * Base interface for all extension messages
 */
export interface BaseExtensionMessage {
  /** Message type */
  type: MessageType;
  /** Unique message ID */
  messageId?: string;
  /** Timestamp when message was created */
  timestamp?: number;
  /** Tab ID */
  tabId?: number;
  /** Message payload */
  payload?: unknown;
}

/**
 * Message types for extension communication (content script, background, devtools)
 * Supports both string literals and MessageTypeEnum values
 */
export type ExtensionMessage =
  | {
      type:
        | 'START_PROFILING'
        | 'STOP_PROFILING'
        | 'CLEAR_DATA'
        | 'INIT'
        | 'PING'
        | 'PONG'
        | 'GET_DATA';
      tabId?: number;
      payload?: unknown;
      messageId?: string;
      timestamp?: number;
    }
  | {
      type: 'COMMIT_DATA' | 'COMMIT';
      payload: CommitData;
      tabId?: number;
      messageId?: string;
      timestamp?: number;
    }
  | {
      type: 'COMPONENT_SELECTED';
      payload: { componentName: string };
      tabId?: number;
      messageId?: string;
      timestamp?: number;
    }
  | {
      type: 'ANALYSIS_COMPLETE';
      payload: AnalysisResult;
      tabId?: number;
      messageId?: string;
      timestamp?: number;
    }
  | {
      type: 'ERROR';
      payload: { message: string; error?: unknown };
      tabId?: number;
      messageId?: string;
      timestamp?: number;
    }
  // Allow any string type for compatibility with MessageTypeEnum
  | { type: string; payload?: unknown; tabId?: number; messageId?: string; timestamp?: number }
  | BaseExtensionMessage;

/**
 * Typed extension message for generic use cases
 */
export type TypedExtensionMessage<T = unknown> = BaseExtensionMessage & {
  payload?: T;
};

/**
 * Profiler configuration options
 */
export interface ProfilerConfig {
  /** Maximum number of commits to store */
  maxCommits: number;
  /** Maximum nodes per commit */
  maxNodesPerCommit: number;
  /** Number of analysis workers */
  analysisWorkerCount: number;
  /** Enable time travel debugging */
  enableTimeTravel: boolean;
  /** Maximum number of component entries to store in LRU cache */
  maxComponentDataEntries: number;
  /** Threshold percentage for wasted renders */
  wastedRenderThreshold: number;
}

/**
 * Connection state in the devtools panel
 */
export interface ConnectionState {
  /** Whether connected to the content script */
  isConnected: boolean;
  /** Connection port */
  port: chrome.runtime.Port | null;
  /** Last ping timestamp */
  lastPing: number;
}

/**
 * Severity levels for issues/reports
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Theme options
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Analysis summary statistics
 */
export interface AnalysisSummary {
  /** Total number of commits analyzed */
  totalCommits: number;
  /** Total number of components analyzed */
  totalComponents: number;
  /** Number of components with wasted renders */
  wastedRenderCount: number;
  /** Number of components with memoization issues */
  memoIssueCount: number;
  /** Overall performance score (0-100) */
  performanceScore: number;
  /** Timestamp when analysis completed */
  timestamp: number;
}

/**
 * Data filters for analysis
 */
export interface DataFilters {
  /** Filter by component name */
  componentName?: string;
  /** Filter by severity level */
  severity?: Severity;
  /** Filter by minimum render count */
  minRenderCount?: number;
  /** Filter by minimum wasted render rate */
  minWastedRate?: number;
  /** Include memoized components only */
  memoizedOnly?: boolean;
  /** Include components with issues only */
  issuesOnly?: boolean;
}
