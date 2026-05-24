/**
 * React Framework Adapter — wraps existing React bridge logic into the adapter interface.
 */

import type { FrameworkAdapter, ParsedCommitData } from '../adapter';
import { parseFiberRoot, getReactVersion, type PropSerializationLimits } from '../fiberParser';

export class ReactAdapter implements FrameworkAdapter {
  readonly name = 'react' as const;

  detect(): boolean {
    return !!(window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  }

  getVersion(): string | undefined {
    return getReactVersion();
  }

  parseCommit(root: unknown, options?: Record<string, unknown>): ParsedCommitData {
    const priorityLevel = (options?.priorityLevel as number) ?? 0;
    return parseFiberRoot(root, priorityLevel, {
      sourceCorrelation: options?.sourceCorrelation as boolean | undefined,
      propLimits: options?.propLimits as PropSerializationLimits | undefined,
      previousFiberIds: options?.previousFiberIds as Set<string> | null | undefined,
    });
  }

  hookIntoFramework(callback: (data: ParsedCommitData) => void): () => void {
    const hook = (window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || typeof hook !== 'object') return () => {};

    const hookObj = hook as Record<string, unknown>;
    const original = typeof hookObj.onCommitFiberRoot === 'function'
      ? hookObj.onCommitFiberRoot.bind(hook)
      : null;

    hookObj.onCommitFiberRoot = (rendererID: number, root: unknown, priorityLevel: number) => {
      if (original) {
        try { original(rendererID, root, priorityLevel); } catch { /* ignore */ }
      }
      const data = this.parseCommit(root, { priorityLevel });
      callback(data);
    };

    return () => {
      if (original) hookObj.onCommitFiberRoot = original;
    };
  }
}
