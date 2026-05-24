/**
 * Bridge content script types
 * These types are self-contained (no imports from shared/) because
 * the MAIN-world content script cannot import extension APIs.
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

export interface SourceLocation {
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
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
