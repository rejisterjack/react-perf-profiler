/**
 * React Internal Types
 * Minimal type definitions for React internals used by the profiler
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
}

export interface ReactFiber {
  tag: number;
  key: string | null;
  elementType: unknown;
  type: unknown;
  stateNode: unknown;
  return: ReactFiber | null;
  child: ReactFiber | null;
  sibling: ReactFiber | null;
  index: number;
  ref: unknown;
  pendingProps: Record<string, unknown>;
  memoizedProps: Record<string, unknown>;
  updateQueue: unknown;
  memoizedState: unknown;
  dependencies: unknown;
  mode: number;
  flags: number;
  subtreeFlags: number;
  deletions: ReactFiber[] | null;
  lanes: number;
  childLanes: number;
  alternate: ReactFiber | null;
  actualDuration?: number;
  actualStartTime?: number;
  selfBaseDuration?: number;
  treeBaseDuration?: number;
}

export interface ReactRenderer {
  version: string;
  findFiberByHostInstance?: (hostInstance: unknown) => ReactFiber | null;
  bundleType?: number;
  rendererPackageName?: string;
}

export interface ReactDevToolsHook {
  renderers: Map<number, ReactRenderer>;
  supportsFiber: boolean;
  inject: (renderer: ReactRenderer) => number;
  onScheduleRoot?: (root: FiberRoot, children: unknown) => void;
  onCommitFiberRoot: (rendererID: number, root: FiberRoot, priorityLevel: number) => void;
  onCommitFiberUnmount: (rendererID: number, fiber: ReactFiber) => void;
}

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsHook;
    __REACT_PERF_PROFILER_ACTIVE__?: boolean;
    __REACT_PERF_PROFILER_CLEANUP__?: () => void;
    __REACT_PERF_PROFILER_DETECT_REACT__?: () => boolean;
    React?: { version?: string };
    __REACT__?: unknown;
  }
}
