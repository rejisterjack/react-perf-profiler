/**
 * React Internal Types
 * Minimal type definitions for React internals used by the profiler
 * These types represent React's internal fiber architecture
 */

/**
 * React element type - can be a string (host element), function component, class component, etc.
 */
export type ReactElementType =
  | string
  | React.ComponentType<unknown>
  | React.ForwardRefExoticComponent<unknown>
  | React.MemoExoticComponent<React.ComponentType<unknown>>
  | symbol
  | null;

/**
 * React component type - function or class component
 */
export type ReactComponentType = React.ComponentType<unknown>;

/**
 * React ref type - can be a callback ref, object ref, or null
 */
export type ReactRef =
  | ((instance: unknown) => void)
  | { current: unknown | null }
  | string
  | null;

/**
 * React props object
 */
export type ReactProps = Record<string, unknown>;

/**
 * React state - can be any value
 */
export type ReactState = unknown;

/**
 * Update queue for React hooks and state updates
 */
export interface ReactUpdateQueue {
  baseState: ReactState;
  firstBaseUpdate: unknown;
  lastBaseUpdate: unknown;
  shared: {
    pending: unknown;
    interleaved: unknown;
  };
  effects: unknown[] | null;
}

/**
 * React hook object
 */
export interface ReactHook {
  memoizedState: unknown;
  baseState: unknown;
  baseQueue: unknown;
  queue: unknown;
  next: ReactHook | null;
}

/**
 * Dependencies for hooks (useEffect, useMemo, etc.)
 */
export interface ReactDependencies {
  firstContext: unknown;
  responders: Map<string, unknown> | null;
  pending: unknown;
}

/**
 * Fiber node deletion array
 */
export type ReactDeletions = ReactFiber[] | null;

/**
 * React Fiber Root - the root of a React tree
 */
export interface FiberRoot {
  tag: number;
  containerInfo: unknown;
  current: ReactFiber | null;
  finishedWork: ReactFiber | null;
  timeoutHandle: number;
  context: unknown;
  pendingContext: unknown;
  callbackNode: unknown;
  callbackPriority: number;
  pendingLanes: number;
  expiredLanes: number;
  suspenseLanes: number;
  pingedLanes: number;
  finishedLanes: number;
  eventTimes: number[];
  expirationTimes: number[];
}

/**
 * React Fiber Node - represents a unit of work in React's reconciliation
 * This is a minimal representation of React's internal fiber structure
 */
export interface ReactFiber {
  /** Tag identifying the type of fiber */
  tag: number;

  /** Unique key for the element */
  key: string | null;

  /** The resolved function/class/associated with this fiber */
  elementType: ReactElementType;

  /** The type of component (function, class, host component, etc.) */
  type: ReactElementType;

  /** The local state associated with this fiber */
  stateNode: unknown;

  /** Parent fiber */
  return: ReactFiber | null;

  /** First child fiber */
  child: ReactFiber | null;

  /** Next sibling fiber */
  sibling: ReactFiber | null;

  /** Index amongst siblings */
  index: number;

  /** Ref attached to this fiber */
  ref: ReactRef;

  /** Props pending to be applied */
  pendingProps: ReactProps;

  /** Current props (memoized) */
  memoizedProps: ReactProps;

  /** Queue of pending state updates */
  updateQueue: ReactUpdateQueue | null;

  /** Current state (memoized) */
  memoizedState: ReactState;

  /** Dependencies for hooks (effects, context, etc.) */
  dependencies: ReactDependencies | null;

  /** Mode flags (concurrent, strict, etc.) */
  mode: number;

  /** Effect flags */
  flags: number;

  /** Subtree effect flags */
  subtreeFlags: number;

  /** Fibers that were deleted in this commit */
  deletions: ReactDeletions;

  /** Lane configuration for this fiber */
  lanes: number;

  /** Child lane configuration */
  childLanes: number;

  /** Alternate fiber (used for double buffering) */
  alternate: ReactFiber | null;

  /** Actual duration of rendering this fiber */
  actualDuration?: number;

  /** When this fiber started rendering */
  actualStartTime?: number;

  /** Duration without children (self time) */
  selfBaseDuration?: number;

  /** Total base duration including children */
  treeBaseDuration?: number;
}

/**
 * React DevTools Renderer interface
 */
export interface ReactRenderer {
  version: string;
  /** Find fiber by host instance (DOM node) */
  findFiberByHostInstance?: (hostInstance: unknown) => ReactFiber | null;
  /** Renderer configuration */
  bundleType?: number;
  /** Renderer version */
  rendererPackageName?: string;
}

/**
 * React DevTools Global Hook
 * This is the hook that React DevTools uses to introspect React applications
 */
export interface ReactDevToolsHook {
  /** Map of renderer IDs to renderer interfaces */
  renderers: Map<number, ReactRenderer>;

  /** Whether the hook supports fiber */
  supportsFiber: boolean;

  /** Inject a renderer and return its ID */
  inject: (renderer: ReactRenderer) => number;

  /** Called when a root is scheduled */
  onScheduleRoot?: (root: FiberRoot, children: unknown) => void;

  /** Called when a fiber root is committed */
  onCommitFiberRoot: (
    rendererID: number,
    root: FiberRoot,
    priorityLevel: number
  ) => void;

  /** Called when a fiber is unmounted */
  onCommitFiberUnmount: (rendererID: number, fiber: ReactFiber) => void;
}

/**
 * Global window extensions for React DevTools
 */
declare global {
  interface Window {
    /** React DevTools global hook */
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsHook;
    /** Profiler active flag */
    __REACT_PERF_PROFILER_ACTIVE__?: boolean;
    /** Profiler cleanup function */
    __REACT_PERF_PROFILER_CLEANUP__?: () => void;
    /** React detection function */
    __REACT_PERF_PROFILER_DETECT_REACT__?: () => boolean;
    /** Get detailed React detection info */
    __REACT_PERF_PROFILER_GET_INFO__?: () => {
      detected: boolean;
      devtoolsHook: boolean;
      reactGlobal: boolean;
      reactRoot: boolean;
      reactId: boolean;
      rootContainer: boolean;
    };
    /** Global React object (if available) */
    React?: { version?: string };
    /** Legacy React internal */
    __REACT__?: unknown;
  }
}
