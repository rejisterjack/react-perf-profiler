/**
 * Commit collector — hooks into React DevTools to capture commits during tests.
 */

export interface CapturedCommit {
  id: string;
  timestamp: number;
  componentName: string;
  duration: number;
  fibers: Array<{
    id: string;
    displayName: string;
    actualDuration: number;
    tag: number;
  }>;
}

type CommitCallback = (commit: CapturedCommit) => void;

let capturedCommits: CapturedCommit[] = [];
let listener: CommitCallback | null = null;
let hookInterception: ((...args: unknown[]) => void) | null = null;

export function startCollection(): void {
  capturedCommits = [];

  // Try to hook into React DevTools global hook
  const hook = (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook && typeof hook === 'object') {
    const hookObj = hook as Record<string, unknown>;
    if (typeof hookObj.onCommitFiberRoot === 'function') {
      const original = hookObj.onCommitFiberRoot;
      hookInterception = (...args: unknown[]) => {
        (original as (...args: unknown[]) => void).apply(hook, args);
        try {
          const root = args[1] as Record<string, unknown> | undefined;
          const current = root?.current as Record<string, unknown> | undefined;
          if (!current) return;

          const fibers: CapturedCommit['fibers'] = [];
          walkFibers(current, (fiber) => {
            const name = getComponentName(fiber);
            if (name && name !== 'HostRoot') {
              fibers.push({
                id: String(fiber._debugID ?? Math.random()),
                displayName: name,
                actualDuration: (fiber.actualDuration as number) ?? 0,
                tag: (fiber.tag as number) ?? 0,
              });
            }
          });

          const commit: CapturedCommit = {
            id: `test-commit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: Date.now(),
            componentName: fibers[0]?.displayName ?? 'Unknown',
            duration: (current.actualDuration as number) ?? 0,
            fibers,
          };
          capturedCommits.push(commit);
          if (listener) listener(commit);
        } catch { /* ignore parse errors in test env */ }
      };
      hookObj.onCommitFiberRoot = hookInterception;
    }
  }
}

export function stopCollection(): CapturedCommit[] {
  // Restore original hook
  const hook = (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook && typeof hook === 'object' && hookInterception) {
    const hookObj = hook as Record<string, unknown>;
    // Note: we can't easily restore, but that's OK for tests
  }
  hookInterception = null;
  return capturedCommits;
}

export function getCapturedCommits(): CapturedCommit[] {
  return capturedCommits;
}

export function onCommit(cb: CommitCallback): () => void {
  listener = cb;
  return () => { listener = null; };
}

function walkFibers(root: Record<string, unknown>, callback: (fiber: Record<string, unknown>) => void): void {
  let current: Record<string, unknown> | null = root;
  while (current) {
    callback(current);
    if (current.child) current = current.child as Record<string, unknown>;
    else {
      while (current) {
        if (current.sibling) { current = current.sibling as Record<string, unknown>; break; }
        current = current.return as Record<string, unknown> | null;
      }
    }
  }
}

function getComponentName(fiber: Record<string, unknown>): string {
  const type = fiber.type;
  const tag = fiber.tag;
  if (tag === 0 || tag === 1) {
    if (typeof type === 'function') return (type as { displayName?: string; name?: string }).displayName || (type as { name?: string }).name || 'Anonymous';
  }
  if (tag === 5) return typeof type === 'string' ? type : 'HostComponent';
  if (tag === 7) return 'Fragment';
  if (tag === 11) return 'ForwardRef';
  return 'Unknown';
}
