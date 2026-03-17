/**
 * Shared TypeScript types for React Perf Profiler
 * @module shared/types
 */

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
 */
export interface CommitData {
  /** Unique commit identifier */
  id: string;
  /** Timestamp when commit occurred */
  timestamp: number;
  /** All fiber nodes in this commit */
  nodes: FiberNode[];
  /** Root component that triggered the commit */
  rootId: number;
  /** React priority level */
  priorityLevel: 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';
  /** Interactions that triggered this commit */
  interactions?: InteractionData[];
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
 * Report for wasted render analysis
 */
export interface WastedRenderReport {
  /** Component name */
  componentName: string;
  /** Total render count */
  renderCount: number;
  /** Number of wasted renders */
  wastedRenders: number;
  /** Percentage of renders that were wasted */
  wastedRenderRate: number;
  /** Recommended optimization action */
  recommendedAction: 'memo' | 'useMemo' | 'useCallback' | 'none';
  /** Estimated time savings */
  estimatedSavings: string;
  /** Specific issues detected */
  issues: WastedRenderIssue[];
}

/**
 * Individual wasted render issue
 */
export interface WastedRenderIssue {
  /** Type of issue */
  type: 'prop-reference' | 'state-reference' | 'inline-function' | 'inline-object' | 'inline-array' | 'context-change';
  /** Description of the issue */
  description: string;
  /** Suggested fix */
  suggestion: string;
  /** Commit IDs where this issue occurred */
  occurrences: string[];
}

/**
 * Report for memoization effectiveness analysis
 */
export interface MemoReport {
  /** Component name */
  componentName: string;
  /** Current memo hit rate (0-1) */
  currentHitRate: number;
  /** Optimal achievable hit rate */
  optimalHitRate: number;
  /** Whether current memoization is effective */
  isEffective: boolean;
  /** Issues preventing effective memoization */
  issues: MemoIssue[];
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
  severity: 'low' | 'medium' | 'high';
}

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
  | { type: 'ERROR'; payload: { message: string } };

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
