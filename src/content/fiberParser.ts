/**
 * Fiber Parser - Parse React Fiber tree into structured data
 * Extracts performance metrics and component information from React internals
 */

import type { CommitData, FiberData } from './types';

// Counter for generating unique fiber IDs
let fiberIdCounter = 0;
const fiberIdMap = new WeakMap<object, string>();

/** Maximum safe value for fiberIdCounter before reset */
const MAX_FIBER_ID = 1000000; // Reset after 1 million IDs

/**
 * Generate or retrieve a unique ID for a fiber node
 */
function getFiberId(fiber: unknown): string {
  if (!fiber || typeof fiber !== 'object') return 'null';

  if (fiberIdMap.has(fiber)) {
    return fiberIdMap.get(fiber)!;
  }

  // Reset counter if it gets too large to prevent overflow
  if (fiberIdCounter >= MAX_FIBER_ID) {
    fiberIdCounter = 0;
  }
  
  const id = `fiber-${++fiberIdCounter}`;
  fiberIdMap.set(fiber, id);
  return id;
}

/**
 * Parse a single fiber node into FiberData
 */
export function parseFiberNode(fiber: unknown): FiberData {
  const fiberObj = fiber as Record<string, unknown>;
  const id = getFiberId(fiber);

  return {
    id,
    displayName: getComponentName(fiber),
    key: (fiberObj['key'] ?? null) as string | null,
    child: null, // Will be populated by walkFiberTree
    sibling: null, // Will be populated by walkFiberTree
    return: null, // Will be populated by walkFiberTree
    type: fiberObj['type'],
    elementType: fiberObj['elementType'],
    memoizedProps: extractProps(fiberObj['memoizedProps'] as Record<string, unknown>),
    memoizedState: fiberObj['memoizedState'],
    actualDuration: (fiberObj['actualDuration'] as number) ?? 0,
    actualStartTime: (fiberObj['actualStartTime'] as number) ?? 0,
    selfBaseDuration: (fiberObj['selfBaseDuration'] as number) ?? 0,
    treeBaseDuration: (fiberObj['treeBaseDuration'] as number) ?? 0,
    tag: (fiberObj['tag'] as number) ?? 0,
    index: (fiberObj['index'] as number) ?? 0,
    mode: (fiberObj['mode'] as number) ?? 0,
    flags: (fiberObj['flags'] as number) ?? 0,
  };
}

/**
 * Walk fiber tree and collect all nodes
 * Traverses the fiber tree using child/sibling/return pointers
 */
export function walkFiberTree(rootFiber: unknown, callback: (fiber: unknown) => void): void {
  if (!rootFiber) return;

  let current: unknown = rootFiber;

  while (current !== null) {
    // Process current node
    callback(current);

    const currentObj = current as Record<string, unknown>;

    // Go to child first (depth-first)
    if (currentObj['child'] !== null && currentObj['child'] !== undefined) {
      current = currentObj['child'];
    } else {
      // No child, try sibling
      while (current !== null && current !== undefined) {
        const tempObj = current as Record<string, unknown>;
        if (tempObj['sibling'] !== null && tempObj['sibling'] !== undefined) {
          break;
        }
        current = tempObj['return'];
      }

      if (current !== null && current !== undefined) {
        current = (current as Record<string, unknown>)['sibling'];
      }
    }
  }
}

/**
 * Extract commit data from fiber root
 * Called when React commits a fiber root
 */
export function parseFiberRoot(rootFiber: unknown, priorityLevel: number = 0): CommitData {
  const fibers: FiberData[] = [];
  const fiberMap = new Map<string, FiberData>();
  let rootFiberData: FiberData | null = null;

  const rootObj = rootFiber as Record<string, unknown>;

  // Calculate total duration from the root
  const duration = (rootObj['actualDuration'] as number) ?? 0;

  // First pass: create all fiber data nodes
  walkFiberTree(rootFiber, (fiber) => {
    const fiberData = parseFiberNode(fiber);
    fibers.push(fiberData);
    fiberMap.set(fiberData.id, fiberData);

    if (fiber === rootFiber) {
      rootFiberData = fiberData;
    }
  });

  // Second pass: link parent-child relationships
  walkFiberTree(rootFiber, (fiber) => {
    const fiberData = fiberMap.get(getFiberId(fiber))!;
    const fiberObj = fiber as Record<string, unknown>;

    if (fiberObj['child']) {
      const childId = getFiberId(fiberObj['child']);
      const childData = fiberMap.get(childId);
      if (childData) {
        fiberData.child = childData;
      }
    }

    if (fiberObj['sibling']) {
      const siblingId = getFiberId(fiberObj['sibling']);
      const siblingData = fiberMap.get(siblingId);
      if (siblingData) {
        fiberData.sibling = siblingData;
      }
    }

    if (fiberObj['return']) {
      const returnId = getFiberId(fiberObj['return']);
      const returnData = fiberMap.get(returnId);
      if (returnData) {
        fiberData.return = returnData;
      }
    }
  });

  return {
    id: generateCommitId(),
    timestamp: Date.now(),
    priorityLevel: getPriorityLevelName(priorityLevel),
    duration,
    rootFiber: rootFiberData,
    fibers,
  };
}

/**
 * Get priority level name from number
 */
function getPriorityLevelName(
  level: number
): 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle' {
  switch (level) {
    case 1:
      return 'Immediate';
    case 2:
      return 'UserBlocking';
    case 3:
      return 'Normal';
    case 4:
      return 'Low';
    case 5:
      return 'Idle';
    default:
      return 'Normal';
  }
}

/**
 * Get component display name from fiber
 * Handles different component types (functions, classes, host components)
 */
export function getComponentName(fiber: unknown): string {
  if (!fiber || typeof fiber !== 'object') return 'Unknown';

  const fiberObj = fiber as Record<string, unknown>;
  const type = fiberObj['type'];
  const tag = fiberObj['tag'];

  // Handle different fiber tags
  switch (tag) {
    case 0: // FunctionComponent
    case 1: // ClassComponent
    case 2: // IndeterminateComponent
      if (typeof type === 'function') {
        return (
          (type as { displayName?: string; name?: string }).displayName ||
          (type as { displayName?: string; name?: string }).name ||
          'Anonymous'
        );
      }
      return 'Component';

    case 3: // HostRoot
      return 'HostRoot';

    case 4: // HostPortal
      return 'Portal';

    case 5: // HostComponent
      return typeof type === 'string' ? type : 'HostComponent';

    case 6: // HostText
      return 'Text';

    case 7: // Fragment
      return 'Fragment';

    case 8: // Mode
      return 'Mode';

    case 9: // ContextConsumer
      return 'Context.Consumer';

    case 10: // ContextProvider
      return 'Context.Provider';

    case 11: // ForwardRef
      if (typeof type === 'object' && type !== null) {
        const renderFn = (type as { render?: unknown }).render;
        if (typeof renderFn === 'function') {
          return (
            (renderFn as { displayName?: string; name?: string }).displayName ||
            (renderFn as { displayName?: string; name?: string }).name ||
            'ForwardRef'
          );
        }
      }
      return 'ForwardRef';

    case 12: // Profiler
      return 'Profiler';

    case 13: // SuspenseComponent
      return 'Suspense';

    case 14: // MemoComponent
    case 15: // SimpleMemoComponent
      if (typeof type === 'object' && type !== null) {
        const innerType = (type as { type?: unknown }).type || type;
        if (typeof innerType === 'function') {
          const name =
            (innerType as { displayName?: string; name?: string }).displayName ||
            (innerType as { displayName?: string; name?: string }).name;
          return name ? `${name} (memo)` : 'Memo';
        }
      }
      return 'Memo';

    case 16: // LazyComponent
      return 'Lazy';

    case 17: // IncompleteClassComponent
      return 'IncompleteClass';

    case 21: // ScopeComponent
      return 'Scope';

    case 22: // OffscreenComponent
      return 'Offscreen';

    case 23: // LegacyHiddenComponent
      return 'LegacyHidden';

    case 24: // CacheComponent
      return 'Cache';

    case 25: // TracingMarkerComponent
      return 'TracingMarker';

    default:
      return `Unknown(${tag})`;
  }
}

/**
 * Extract props from fiber
 * Returns a sanitized copy of props (removes functions and circular refs)
 */
export function extractProps(
  memoizedProps: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!memoizedProps || typeof memoizedProps !== 'object') {
    return {};
  }

  const props: Record<string, unknown> = {};
  const seen = new WeakSet<object>();

  try {
    for (const key of Object.keys(memoizedProps)) {
      const value = memoizedProps[key];

      // Skip React internal props
      if (key === 'children' || key.startsWith('__react')) {
        continue;
      }

      // Handle different value types
      if (value === null || value === undefined) {
        props[key] = value;
      } else if (typeof value === 'function') {
        props[key] = '[Function]';
      } else if (typeof value === 'object') {
        if (seen.has(value)) {
          props[key] = '[Circular]';
        } else if (Array.isArray(value)) {
          seen.add(value);
          props[key] = `[Array(${value.length})]`;
        } else if ((value as { $$typeof?: unknown }).$$typeof) {
          // React element
          props[key] = '[ReactElement]';
        } else {
          seen.add(value);
          // Shallow copy of plain objects
          const plainObj: Record<string, unknown> = {};
          for (const k of Object.keys(value).slice(0, 10)) {
            // Limit to 10 keys
            const v = (value as Record<string, unknown>)[k];
            plainObj[k] =
              typeof v === 'function' ? '[Function]' : typeof v === 'object' ? '[Object]' : v;
          }
          props[key] = plainObj;
        }
      } else {
        props[key] = value;
      }
    }
  } catch (_e) {
    // If extraction fails, return empty object
    return { _error: 'Failed to extract props' };
  }

  return props;
}

/**
 * Check if fiber has memoization (React.memo, PureComponent, etc.)
 */
export function hasMemoization(fiber: unknown): boolean {
  if (!fiber || typeof fiber !== 'object') return false;

  const fiberObj = fiber as Record<string, unknown>;

  // Check for memo component
  if (fiberObj['tag'] === 14 || fiberObj['tag'] === 15) {
    return true;
  }

  // Check if it's a PureComponent (class component with shouldComponentUpdate)
  if (fiberObj['tag'] === 1 && fiberObj['type']) {
    const type = fiberObj['type'] as { prototype?: { shouldComponentUpdate?: unknown } };
    const prototype = type.prototype;
    if (prototype && typeof prototype.shouldComponentUpdate === 'function') {
      return true;
    }
  }

  // Check for useMemo in hooks
  if (fiberObj['memoizedState'] && typeof fiberObj['memoizedState'] === 'object') {
    let hook: unknown = fiberObj['memoizedState'];
    while (hook) {
      const hookObj = hook as { memoizedState?: unknown; queue?: { last?: unknown } };
      if (hookObj.memoizedState !== undefined && hookObj.queue?.last) {
        // This might be a useMemo hook
        return true;
      }
      hook = (hook as { next?: unknown }).next;
    }
  }

  return false;
}

/**
 * Get React version from the page
 */
export function getReactVersion(): string | undefined {
  // Try to find React version from various sources
  const hook = (
    window as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: { renderers?: Map<number, { version?: string }> } }
  ).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook?.renderers) {
    for (const [, renderer] of hook.renderers) {
      if (renderer?.version) {
        return renderer.version;
      }
    }
  }

  // Try global React object
  const win = window as { React?: { version?: string } };
  if (typeof window !== 'undefined' && win.React?.version) {
    return win.React.version;
  }

  return undefined;
}

/**
 * Generate unique commit ID
 */
function generateCommitId(): string {
  return `commit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Reset the fiber ID counter (useful for testing)
 */
export function resetFiberIdCounter(): void {
  fiberIdCounter = 0;
}

/**
 * Check if a fiber is a component (not a host element)
 */
export function isComponentFiber(fiber: unknown): boolean {
  if (!fiber || typeof fiber !== 'object') return false;

  const fiberObj = fiber as { tag?: number };
  const componentTags = [0, 1, 2, 11, 14, 15]; // Function, Class, Indeterminate, ForwardRef, Memo
  return componentTags.includes(fiberObj.tag ?? -1);
}

/**
 * Get performance metrics summary for a commit
 */
export function getCommitMetrics(commitData: CommitData): {
  componentCount: number;
  slowestComponent: { name: string; duration: number } | null;
  averageDuration: number;
  memoizedCount: number;
} {
  const fibers = commitData.fibers;

  if (!fibers || fibers.length === 0) {
    return {
      componentCount: 0,
      slowestComponent: null,
      averageDuration: 0,
      memoizedCount: 0,
    };
  }

  let slowestComponent: { name: string; duration: number } | null = null;
  let totalDuration = 0;
  let memoizedCount = 0;

  for (const fiber of fibers) {
    totalDuration += fiber.actualDuration;

    if (fiber.tag === 14 || fiber.tag === 15) memoizedCount++;

    if (!slowestComponent || fiber.actualDuration > slowestComponent.duration) {
      slowestComponent = {
        name: fiber.displayName,
        duration: fiber.actualDuration,
      };
    }
  }

  return {
    componentCount: fibers.length,
    slowestComponent,
    averageDuration: totalDuration / fibers.length,
    memoizedCount,
  };
}
