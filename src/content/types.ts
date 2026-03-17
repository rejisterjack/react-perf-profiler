/**
 * Content script types for React Perf Profiler
 * Types for fiber data and bridge communication
 */

/**
 * Message format for communication between the injected bridge and content script
 */
export interface BridgeMessage {
  source: 'react-perf-profiler-bridge';
  payload: {
    type: 'COMMIT' | 'INIT' | 'ERROR' | 'START' | 'STOP';
    data?: any;
    error?: string;
  };
}

/**
 * Represents a parsed React Fiber node
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
  type: any;
  /** The element type */
  elementType: any;
  /** Current props */
  memoizedProps: Record<string, any>;
  /** Current state */
  memoizedState: any;
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
  /** Bitfield for mode (concurrent, strict, etc.) */
  mode: number;
}

/**
 * Represents a single commit from React
 */
export interface CommitData {
  /** Unique commit identifier */
  commitId: string;
  /** Timestamp when commit was recorded */
  timestamp: number;
  /** Priority level of the commit */
  priorityLevel: number;
  /** Duration of the commit in ms */
  duration: number;
  /** Root fiber data */
  rootFiber: FiberData | null;
  /** All fibers in the tree (flattened) */
  fibers: FiberData[];
  /** React version if available */
  reactVersion?: string;
}

/**
 * Extended Fiber interface matching React internals
 */
export interface ReactFiber {
  tag: number;
  key: string | null;
  elementType: any;
  type: any;
  stateNode: any;
  return: ReactFiber | null;
  child: ReactFiber | null;
  sibling: ReactFiber | null;
  index: number;
  ref: any;
  pendingProps: any;
  memoizedProps: any;
  updateQueue: any;
  memoizedState: any;
  dependencies: any;
  mode: number;
  flags: number;
  subtreeFlags: number;
  deletions: any;
  lanes: number;
  childLanes: number;
  alternate: ReactFiber | null;
  actualDuration?: number;
  actualStartTime?: number;
  selfBaseDuration?: number;
  treeBaseDuration?: number;
}

/**
 * React DevTools global hook interface
 */
export interface ReactDevToolsHook {
  renderers: Map<number, any>;
  supportsFiber: boolean;
  inject: (renderer: any) => number;
  onScheduleRoot?: (root: any, children: any) => void;
  onCommitFiberRoot: (rendererID: number, root: any, priorityLevel: number) => void;
  onCommitFiberUnmount: (rendererID: number, fiber: any) => void;
}

/**
 * Declare global window extensions
 */
declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsHook;
    __REACT_PERF_PROFILER_ACTIVE__?: boolean;
  }
}

/**
 * Message types for background script communication
 */
export type BackgroundMessageType =
  | 'START_PROFILING'
  | 'STOP_PROFILING'
  | 'COMMIT_DATA'
  | 'INIT'
  | 'ERROR'
  | 'PING';

/**
 * Message format for background script communication
 */
export interface BackgroundMessage {
  type: BackgroundMessageType;
  payload?: any;
  error?: string;
  tabId?: number;
}

/**
 * Fiber tag constants from React
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

/**
 * Priority levels from React
 */
export enum PriorityLevel {
  NoPriority = 0,
  ImmediatePriority = 1,
  UserBlockingPriority = 2,
  NormalPriority = 3,
  LowPriority = 4,
  IdlePriority = 5,
}
