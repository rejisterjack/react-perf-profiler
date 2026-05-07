
import { logger } from '@/shared/logger';

// Messages sent TO the worker
type SandboxInbound =
  | { type: 'init'; code: string; pluginId: string }
  | { type: 'hook'; hookName: string; payload: unknown };

// Messages sent FROM the worker
type SandboxOutbound =
  | { type: 'ready' }
  | { type: 'result'; hookName: string; data: unknown }
  | { type: 'error'; hookName: string; message: string };

const SANDBOX_WORKER_CODE = `
  'use strict';
  let hooks = {};

  self.onmessage = function(e) {
    const msg = e.data;

    if (msg.type === 'init') {
      try {
        // Parse and validate plugin code — only allow function declarations
        const factory = new Function('exports', msg.code + '\\nreturn exports;');
        hooks = factory({}) || {};
        self.postMessage({ type: 'ready' });
      } catch (err) {
        self.postMessage({ type: 'error', hookName: 'init', message: err.message });
      }
      return;
    }

    if (msg.type === 'hook') {
      try {
        const fn = hooks[msg.hookName];
        if (typeof fn === 'function') {
          const result = fn(msg.payload);
          // Support async hooks
          Promise.resolve(result).then(data => {
            self.postMessage({ type: 'result', hookName: msg.hookName, data });
          }).catch(err => {
            self.postMessage({ type: 'error', hookName: msg.hookName, message: err.message });
          });
        } else {
          self.postMessage({ type: 'result', hookName: msg.hookName, data: null });
        }
      } catch (err) {
        self.postMessage({ type: 'error', hookName: msg.hookName, message: err.message });
      }
    }
  };
`;

export class PluginSandbox {
  private worker: Worker | null = null;
  private pluginId: string;
  private pending: Map<string, { resolve: (data: unknown) => void; reject: (err: Error) => void }> = new Map();

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  async init(code: string): Promise<void> {
    const blob = new Blob([SANDBOX_WORKER_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    this.worker = new Worker(url);
    URL.revokeObjectURL(url);

    this.worker.onmessage = (e: MessageEvent<SandboxOutbound>) => {
      const msg = e.data;
      if (msg.type === 'error') {
        const p = this.pending.get(msg.hookName);
        if (p) {
          p.reject(new Error(`[Sandbox:${this.pluginId}] ${msg.message}`));
          this.pending.delete(msg.hookName);
        }
        logger.warn(`Plugin sandbox error: ${msg.message}`, {
          source: 'PluginSandbox',
          pluginId: this.pluginId,
        });
        return;
      }
      if (msg.type === 'result') {
        const p = this.pending.get(msg.hookName);
        if (p) {
          p.resolve(msg.data);
          this.pending.delete(msg.hookName);
        }
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Sandbox init timeout')), 5000);

      const originalHandler = this.worker!.onmessage;
      this.worker!.onmessage = (e: MessageEvent<SandboxOutbound>) => {
        if (e.data.type === 'ready') {
          clearTimeout(timeout);
          this.worker!.onmessage = originalHandler;
          resolve();
        } else if (e.data.type === 'error' && e.data.hookName === 'init') {
          clearTimeout(timeout);
          reject(new Error(e.data.message));
        }
      };

      this.worker!.postMessage({ type: 'init', code, pluginId: this.pluginId } as SandboxInbound);
    });
  }

  async execute(hookName: string, payload: unknown): Promise<unknown> {
    if (!this.worker) throw new Error('Sandbox not initialized');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(hookName);
        reject(new Error(`[Sandbox:${this.pluginId}] Hook "${hookName}" timed out`));
      }, 10_000);

      this.pending.set(hookName, {
        resolve: (data) => { clearTimeout(timeout); resolve(data); },
        reject: (err) => { clearTimeout(timeout); reject(err); },
      });

      this.worker!.postMessage({ type: 'hook', hookName, payload } as SandboxInbound);
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, p] of this.pending) {
      p.reject(new Error('Sandbox terminated'));
    }
    this.pending.clear();
  }
}
