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
    data?: unknown;
    error?: string;
  };
}

// Re-export types from shared for consistency
export type { CommitData, FiberData } from '@/shared/types';

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
