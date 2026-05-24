/**
 * Vue Framework Adapter — hooks into Vue 3 DevTools for profiling.
 */

import type { FrameworkAdapter, ParsedCommitData } from '../adapter';
import { parseVNodeTree } from './vueParser';

export class VueAdapter implements FrameworkAdapter {
  readonly name = 'vue' as const;

  detect(): boolean {
    const win = window as unknown as Record<string, unknown>;
    return !!(win.__VUE_DEVTOOLS_GLOBAL_HOOK__);
  }

  getVersion(): string | undefined {
    const win = window as unknown as Record<string, unknown>;
    const hook = win.__VUE_DEVTOOLS_GLOBAL_HOOK__;
    if (hook && typeof hook === 'object') {
      return (hook as Record<string, unknown>).version as string | undefined;
    }
    const vue = win.Vue;
    if (vue && typeof vue === 'object') {
      return (vue as Record<string, unknown>).version as string | undefined;
    }
    return undefined;
  }

  parseCommit(root: unknown, _options?: Record<string, unknown>): ParsedCommitData {
    const fibers = parseVNodeTree(root);
    return {
      id: `vue-commit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      priorityLevel: 'Normal',
      duration: 0,
      rootFiber: fibers[0] ?? null,
      fibers,
    };
  }

  hookIntoFramework(callback: (data: ParsedCommitData) => void): () => void {
    const win = window as unknown as Record<string, unknown>;
    const hook = win.__VUE_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || typeof hook !== 'object') return () => {};

    const hookObj = hook as Record<string, unknown>;
    const handler = (...args: unknown[]) => {
      const appRecord = args[0];
      if (appRecord) {
        const data = this.parseCommit(appRecord);
        callback(data);
      }
    };

    if (typeof hookObj.on === 'function') {
      (hookObj.on as (event: string, handler: (...args: unknown[]) => void) => void)('component:updated', handler);
      (hookObj.on as (event: string, handler: (...args: unknown[]) => void) => void)('component:added', handler);
    }

    return () => {
      if (typeof hookObj.off === 'function') {
        (hookObj.off as (event: string, handler: (...args: unknown[]) => void) => void)('component:updated', handler);
        (hookObj.off as (event: string, handler: (...args: unknown[]) => void) => void)('component:added', handler);
      }
    };
  }
}
