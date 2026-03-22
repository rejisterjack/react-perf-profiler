/**
 * Content script types for React Perf Profiler
 * Types for fiber data and bridge communication
 */

import type {
  ReactFiber,
  ReactDevToolsHook,
  ReactElementType,
  ReactRef,
  ReactProps,
  ReactState,
  ReactUpdateQueue,
  ReactDependencies,
  ReactDeletions,
  FiberRoot,
} from './ReactInternals';

// Re-export React internal types for convenience
export type {
  ReactFiber,
  ReactDevToolsHook,
  FiberRoot,
  ReactElementType,
  ReactRef,
  ReactProps,
  ReactState,
  ReactUpdateQueue,
  ReactDependencies,
  ReactDeletions,
};

/**
 * Bridge message type for communication between injected bridge and content script
 */
export type BridgeMessagePayloadType =
  | 'COMMIT'
  | 'INIT'
  | 'ERROR'
  | 'START'
  | 'STOP'
  | 'RETRY_SCHEDULED'
  | 'DETECT_RESULT';

/**
 * Message format for communication between the injected bridge and content script
 */
export interface BridgeMessage {
  source: 'react-perf-profiler-bridge';
  payload: {
    type: BridgeMessagePayloadType;
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

// Re-export types from shared for consistency
export type { CommitData, FiberData } from '@/shared/types';

/**
 * Extended Fiber interface matching React internals
 * This mirrors ReactFiber from ReactInternals for internal use
 */
export interface ReactFiberExtended {
  tag: number;
  key: string | null;
  elementType: ReactElementType;
  type: ReactElementType;
  stateNode: unknown;
  return: ReactFiberExtended | null;
  child: ReactFiberExtended | null;
  sibling: ReactFiberExtended | null;
  index: number;
  ref: ReactRef;
  pendingProps: ReactProps;
  memoizedProps: ReactProps;
  updateQueue: ReactUpdateQueue | null;
  memoizedState: ReactState;
  dependencies: ReactDependencies | null;
  mode: number;
  flags: number;
  subtreeFlags: number;
  deletions: ReactDeletions;
  lanes: number;
  childLanes: number;
  alternate: ReactFiberExtended | null;
  actualDuration?: number;
  actualStartTime?: number;
  selfBaseDuration?: number;
  treeBaseDuration?: number;
}

/**
 * Message types for background script communication
 */
export type BackgroundMessageType =
  | 'START_PROFILING'
  | 'STOP_PROFILING'
  | 'COMMIT_DATA'
  | 'INIT'
  | 'BRIDGE_INIT'
  | 'BRIDGE_INJECTED'
  | 'BRIDGE_ERROR'
  | 'BRIDGE_RETRY_SCHEDULED'
  | 'BRIDGE_STATUS'
  | 'PROFILING_STARTED'
  | 'PROFILING_STOPPED'
  | 'REACT_DETECT_RESULT'
  | 'DETECT_REACT'
  | 'FORCE_INIT'
  | 'GET_BRIDGE_STATUS'
  | 'ERROR'
  | 'PING'
  | 'PONG';

/**
 * Message format for background script communication
 */
export interface BackgroundMessage {
  type: BackgroundMessageType;
  payload?: unknown;
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
