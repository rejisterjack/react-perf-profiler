/**
 * Fiber Parser — Parse React Fiber tree into structured data
 * Runs in MAIN world (page context) as part of the bridge content script.
 *
 * Supports:
 * - Incremental diffing (send only changed fibers)
 * - Source code correlation (_debugSource extraction)
 * - Configurable props serialization limits
 * - Render cause data
 */

import type { FiberData } from './types';
import { FiberTag } from './types';

let fiberIdCounter = 0;
const fiberIdMap = new WeakMap<object, string>();
const MAX_FIBER_ID = 1000000;

function getFiberId(fiber: unknown): string {
  if (!fiber || typeof fiber !== 'object') return 'null';
  if (fiberIdMap.has(fiber)) return fiberIdMap.get(fiber)!;
  if (fiberIdCounter >= MAX_FIBER_ID) fiberIdCounter = 0;
  const id = `fiber-${++fiberIdCounter}`;
  fiberIdMap.set(fiber, id);
  return id;
}

// =========================================================================
// Props Serialization with Limits
// =========================================================================

export interface PropSerializationLimits {
  maxPropDepth: number;
  maxPropKeys: number;
  maxPropValueLength: number;
}

const DEFAULT_PROP_LIMITS: PropSerializationLimits = {
  maxPropDepth: 3,
  maxPropKeys: 20,
  maxPropValueLength: 200,
};

export function extractProps(
  memoizedProps: Record<string, unknown> | undefined,
  limits: PropSerializationLimits = DEFAULT_PROP_LIMITS,
  depth: number = 0,
): Record<string, unknown> {
  if (!memoizedProps || typeof memoizedProps !== 'object') return {};
  if (depth > limits.maxPropDepth) return { _truncated: 'max depth exceeded' };

  const props: Record<string, unknown> = {};
  const seen = new WeakSet<object>();
  const keys = Object.keys(memoizedProps).slice(0, limits.maxPropKeys);

  try {
    for (const key of keys) {
      if (key === 'children' || key.startsWith('__react')) continue;
      const value = memoizedProps[key];
      if (value === null || value === undefined) { props[key] = value; }
      else if (typeof value === 'function') { props[key] = `[Function: ${value.name || 'anonymous'}]`; }
      else if (typeof value === 'string') {
        props[key] = value.length > limits.maxPropValueLength
          ? value.slice(0, limits.maxPropValueLength) + '...'
          : value;
      }
      else if (typeof value === 'number' || typeof value === 'boolean') { props[key] = value; }
      else if (typeof value === 'object') {
        if (seen.has(value)) { props[key] = '[Circular]'; }
        else if (Array.isArray(value)) {
          seen.add(value);
          if (value.length === 0) { props[key] = '[]'; }
          else if (depth >= limits.maxPropDepth - 1) { props[key] = `[Array(${value.length})]`; }
          else {
            const items = value.slice(0, 5).map((item) =>
              typeof item === 'object' && item !== null ? '[Object]' : item
            );
            props[key] = items.length < value.length
              ? `[${items.map(String).join(', ')}, ... (${value.length} total)]`
              : `[${items.map(String).join(', ')}]`;
          }
        }
        else if ((value as { $$typeof?: unknown }).$$typeof) { props[key] = '[ReactElement]'; }
        else {
          seen.add(value);
          const objKeys = Object.keys(value as Record<string, unknown>).slice(0, 10);
          if (objKeys.length === 0) { props[key] = '{}'; }
          else if (depth >= limits.maxPropDepth - 1) {
            props[key] = `{${objKeys.join(', ')}}`;
          } else {
            const plainObj: Record<string, unknown> = {};
            for (const k of objKeys) {
              const v = (value as Record<string, unknown>)[k];
              plainObj[k] = typeof v === 'function' ? '[Function]'
                : typeof v === 'object' && v !== null ? extractProps({ [k]: v } as Record<string, unknown>, limits, depth + 1)[k]
                : typeof v === 'string' && v.length > limits.maxPropValueLength
                  ? v.slice(0, limits.maxPropValueLength) + '...'
                  : v;
            }
            props[key] = plainObj;
          }
        }
      } else { props[key] = String(value); }
    }

    if (Object.keys(memoizedProps).length > limits.maxPropKeys) {
      props._truncated = `${Object.keys(memoizedProps).length - limits.maxPropKeys} more props omitted`;
    }
  } catch { return { _error: 'Failed to extract props' }; }
  return props;
}

// =========================================================================
// Source Code Correlation
// =========================================================================

export interface SourceLocation {
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

function extractSourceLocation(fiber: unknown): SourceLocation | null {
  if (!fiber || typeof fiber !== 'object') return null;
  const fiberObj = fiber as Record<string, unknown>;

  // React stores source location in _debugSource in development builds
  const debugSource = fiberObj['_debugSource'];
  if (debugSource && typeof debugSource === 'object') {
    const src = debugSource as Record<string, unknown>;
    if (src['fileName'] || src['lineNumber']) {
      return {
        fileName: (src['fileName'] as string) ?? null,
        lineNumber: (src['lineNumber'] as number) ?? null,
        columnNumber: (src['columnNumber'] as number) ?? null,
      };
    }
  }

  // Fallback: check for __self (JSX transform in development)
  const self = fiberObj['_debugSelf'] ?? fiberObj['__self'];
  if (self && typeof self === 'object') {
    const src = self as Record<string, unknown>;
    if (src['fileName']) {
      return {
        fileName: (src['fileName'] as string) ?? null,
        lineNumber: (src['lineNumber'] as number) ?? null,
        columnNumber: (src['columnNumber'] as number) ?? null,
      };
    }
  }

  return null;
}

// =========================================================================
// Fiber Node Parsing
// =========================================================================

interface ParseOptions {
  sourceCorrelation?: boolean;
  propLimits?: PropSerializationLimits;
  previousFiberIds?: Set<string> | null;
}

export function parseFiberNode(
  fiber: unknown,
  options: ParseOptions = {},
): FiberData {
  const fiberObj = fiber as Record<string, unknown>;
  const id = getFiberId(fiber);
  const propLimits = options.propLimits ?? DEFAULT_PROP_LIMITS;

  const data: FiberData = {
    id,
    displayName: getComponentName(fiber),
    key: (fiberObj['key'] ?? null) as string | null,
    child: null,
    sibling: null,
    return: null,
    type: typeof fiberObj['type'] === 'string' ? fiberObj['type'] : undefined,
    elementType: typeof fiberObj['elementType'] === 'string' ? fiberObj['elementType'] : undefined,
    memoizedProps: extractProps(fiberObj['memoizedProps'] as Record<string, unknown>, propLimits),
    memoizedState: undefined,
    actualDuration: (fiberObj['actualDuration'] as number) ?? 0,
    actualStartTime: (fiberObj['actualStartTime'] as number) ?? 0,
    selfBaseDuration: (fiberObj['selfBaseDuration'] as number) ?? 0,
    treeBaseDuration: (fiberObj['treeBaseDuration'] as number) ?? 0,
    tag: (fiberObj['tag'] as number) ?? 0,
    index: (fiberObj['index'] as number) ?? 0,
    mode: (fiberObj['mode'] as number) ?? 0,
    flags: (fiberObj['flags'] as number) ?? 0,
  };

  // Source code correlation
  if (options.sourceCorrelation) {
    const sourceLoc = extractSourceLocation(fiber);
    if (sourceLoc) {
      data.sourceLocation = sourceLoc;
    }
  }

  return data;
}

// =========================================================================
// Delta Tree Diffing
// =========================================================================

export interface FiberDelta {
  /** Only the fibers that changed since the last commit */
  changedFibers: FiberData[];
  /** IDs removed since the last commit */
  removedFiberIds: string[];
  /** Reference commit ID for reconstruction */
  baseCommitId: string;
}

export function diffFiberTree(
  currentFibers: FiberData[],
  previousState: Map<string, { propsHash: string; duration: number }>,
): FiberDelta {
  const changedFibers: FiberData[] = [];
  const currentIds = new Set<string>();

  for (const fiber of currentFibers) {
    currentIds.add(fiber.id);
    const prev = previousState.get(fiber.id);

    if (!prev) {
      // New fiber — include it
      changedFibers.push(fiber);
    } else {
      // Existing fiber — check if it changed
      const currentHash = hashProps(fiber.memoizedProps);
      const durationDelta = Math.abs(fiber.actualDuration - prev.duration);
      if (currentHash !== prev.propsHash || durationDelta > 0.01) {
        changedFibers.push(fiber);
      }
    }
  }

  // Find removed fibers
  const removedFiberIds: string[] = [];
  for (const id of previousState.keys()) {
    if (!currentIds.has(id)) {
      removedFiberIds.push(id);
    }
  }

  return { changedFibers, removedFiberIds, baseCommitId: '' };
}

export function buildFiberStateMap(fibers: FiberData[]): Map<string, { propsHash: string; duration: number }> {
  const map = new Map<string, { propsHash: string; duration: number }>();
  for (const fiber of fibers) {
    map.set(fiber.id, {
      propsHash: hashProps(fiber.memoizedProps),
      duration: fiber.actualDuration,
    });
  }
  return map;
}

function hashProps(props: Record<string, unknown>): string {
  if (!props || typeof props !== 'object') return '';
  try {
    const keys = Object.keys(props).sort();
    const parts: string[] = [];
    for (const key of keys) {
      if (key === 'children' || key.startsWith('__react')) continue;
      const val = props[key];
      const type = typeof val;
      if (type === 'function') parts.push(`${key}:[Fn]`);
      else if (type === 'object' && val !== null) parts.push(`${key}:[Obj]`);
      else parts.push(`${key}:${String(val)}`);
    }
    return parts.join('|').slice(0, 200);
  } catch {
    return '';
  }
}

export function walkFiberTree(rootFiber: unknown, callback: (fiber: unknown) => void): void {
  if (!rootFiber) return;
  let current: unknown = rootFiber;
  while (current !== null) {
    callback(current);
    const currentObj = current as Record<string, unknown>;
    if (currentObj['child'] !== null && currentObj['child'] !== undefined) {
      current = currentObj['child'];
    } else {
      while (current !== null && current !== undefined) {
        const tempObj = current as Record<string, unknown>;
        if (tempObj['sibling'] !== null && tempObj['sibling'] !== undefined) break;
        current = tempObj['return'];
      }
      if (current !== null && current !== undefined) {
        current = (current as Record<string, unknown>)['sibling'];
      }
    }
  }
}

// =========================================================================
// Commit Data
// =========================================================================

export interface RenderCause {
  fiberId: string;
  componentName: string;
  causes: Array<{
    type: 'props-changed' | 'state-changed' | 'parent-rerendered' | 'context-changed' | 'hooks-changed';
    details: string;
    changedKeys?: string[];
  }>;
}

export interface ParsedCommitData {
  id: string;
  timestamp: number;
  priorityLevel: 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';
  duration: number;
  rootFiber: FiberData | null;
  fibers: FiberData[];
  reactVersion?: string;
  renderCauses?: RenderCause[];
  /** If incremental diffing is on, contains only the changed fiber IDs */
  changedFiberIds?: string[];
  /** Indicates this is a delta from a previous commit */
  isDelta?: boolean;
}

export function parseFiberRoot(
  rootFiber: unknown,
  priorityLevel = 0,
  options: ParseOptions = {},
): ParsedCommitData {
  const fibers: FiberData[] = [];
  const fiberMap = new Map<string, FiberData>();
  let rootFiberData: FiberData | null = null;
  const rootObj = rootFiber as Record<string, unknown>;
  const duration = (rootObj['actualDuration'] as number) ?? 0;

  walkFiberTree(rootFiber, (fiber) => {
    const fiberData = parseFiberNode(fiber, options);
    fibers.push(fiberData);
    fiberMap.set(fiberData.id, fiberData);
    if (fiber === rootFiber) rootFiberData = fiberData;
  });

  walkFiberTree(rootFiber, (fiber) => {
    const fiberData = fiberMap.get(getFiberId(fiber))!;
    const fiberObj = fiber as Record<string, unknown>;
    if (fiberObj['child']) { const c = fiberMap.get(getFiberId(fiberObj['child'])); if (c) fiberData.child = c; }
    if (fiberObj['sibling']) { const s = fiberMap.get(getFiberId(fiberObj['sibling'])); if (s) fiberData.sibling = s; }
    if (fiberObj['return']) { const r = fiberMap.get(getFiberId(fiberObj['return'])); if (r) fiberData.return = r; }
  });

  // Compute changed fiber IDs for incremental diffing
  let changedFiberIds: string[] | undefined;
  if (options.previousFiberIds && options.previousFiberIds.size > 0) {
    const currentIds = new Set(fibers.map((f) => f.id));
    // New fibers not in previous tree
    const added = fibers.filter((f) => !options.previousFiberIds!.has(f.id)).map((f) => f.id);
    // Fibers that existed before but their duration changed (re-rendered)
    const changed = fibers.filter(
      (f) => options.previousFiberIds!.has(f.id) && f.actualDuration > 0
    ).map((f) => f.id);
    // Removed fibers that existed in previous but not current
    const removed = Array.from(options.previousFiberIds).filter((id) => !currentIds.has(id));

    changedFiberIds = [...new Set([...added, ...changed])];
  }

  return {
    id: generateCommitId(),
    timestamp: Date.now(),
    priorityLevel: getPriorityLevelName(priorityLevel),
    duration,
    rootFiber: rootFiberData,
    fibers,
    changedFiberIds,
    isDelta: options.previousFiberIds !== null && options.previousFiberIds !== undefined,
  };
}

function getPriorityLevelName(level: number): 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle' {
  switch (level) { case 1: return 'Immediate'; case 2: return 'UserBlocking'; case 3: return 'Normal'; case 4: return 'Low'; case 5: return 'Idle'; default: return 'Normal'; }
}

export function getComponentName(fiber: unknown): string {
  if (!fiber || typeof fiber !== 'object') return 'Unknown';
  const fiberObj = fiber as Record<string, unknown>;
  const type = fiberObj['type'];
  const tag = fiberObj['tag'];

  switch (tag) {
    case 0: case 1: case 2:
      if (typeof type === 'function') return (type as { displayName?: string; name?: string }).displayName || (type as { name?: string }).name || 'Anonymous';
      return 'Component';
    case 3: return 'HostRoot';
    case 4: return 'Portal';
    case 5: return typeof type === 'string' ? type : 'HostComponent';
    case 6: return 'Text';
    case 7: return 'Fragment';
    case 8: return 'Mode';
    case 9: return 'Context.Consumer';
    case 10: return 'Context.Provider';
    case 11:
      if (typeof type === 'object' && type !== null) {
        const renderFn = (type as { render?: unknown }).render;
        if (typeof renderFn === 'function') return (renderFn as { displayName?: string; name?: string }).displayName || (renderFn as { name?: string }).name || 'ForwardRef';
      }
      return 'ForwardRef';
    case 12: return 'Profiler';
    case 13: return 'Suspense';
    case 14: case 15:
      if (typeof type === 'object' && type !== null) {
        const innerType = (type as { type?: unknown }).type || type;
        if (typeof innerType === 'function') {
          const name = (innerType as { displayName?: string; name?: string }).displayName || (innerType as { name?: string }).name;
          return name ? `${name} (memo)` : 'Memo';
        }
      }
      return 'Memo';
    case 16: return 'Lazy';
    case 17: return 'IncompleteClass';
    case 21: return 'Scope';
    case 22: return 'Offscreen';
    case 23: return 'LegacyHidden';
    case 24: return 'Cache';
    case 25: return 'TracingMarker';
    default: return `Unknown(${tag})`;
  }
}

export function getReactVersion(): string | undefined {
  const hook = (window as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: { renderers?: Map<number, { version?: string }> } }).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook?.renderers) { for (const [, renderer] of hook.renderers) { if (renderer?.version) return renderer.version; } }
  const win = window as { React?: { version?: string } };
  if (typeof window !== 'undefined' && win.React?.version) return win.React.version;
  return undefined;
}

function generateCommitId(): string {
  return `commit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
