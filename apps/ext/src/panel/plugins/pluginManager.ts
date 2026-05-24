import type { PluginManifest, PluginContext, PluginInstance } from './types';
import type { CommitData, ComponentMetrics } from '@/src/shared/types';

type EventCallback = (...args: unknown[]) => void;

export class PluginManager {
  private plugins = new Map<string, PluginInstance>();
  private listeners = new Map<string, Set<EventCallback>>();
  private getCommitsFn: () => CommitData[];
  private getMetricsFn: () => Map<string, ComponentMetrics>;
  private getSettingFn: (key: string) => unknown;

  constructor(deps: {
    getCommits: () => CommitData[];
    getMetrics: () => Map<string, ComponentMetrics>;
    getSetting: (key: string) => unknown;
  }) {
    this.getCommitsFn = deps.getCommits;
    this.getMetricsFn = deps.getMetrics;
    this.getSettingFn = deps.getSetting;
  }

  registerPlugin(manifest: PluginManifest, pluginExports: Record<string, unknown>): void {
    this.plugins.set(manifest.id, { manifest, enabled: true, exports: pluginExports });
  }

  unregisterPlugin(id: string): void {
    this.plugins.delete(id);
  }

  getPlugin(id: string): PluginInstance | undefined {
    return this.plugins.get(id);
  }

  listPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  setEnabled(id: string, enabled: boolean): void {
    const plugin = this.plugins.get(id);
    if (plugin) plugin.enabled = enabled;
  }

  createContext(): PluginContext {
    return {
      getCommits: () => this.getCommitsFn(),
      getComponentMetrics: () => this.getMetricsFn(),
      getSetting: (key) => this.getSettingFn(key),
      on: (event, callback) => {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(callback);
        return () => this.listeners.get(event)?.delete(callback);
      },
    };
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => { try { cb(...args); } catch { /* ignore plugin errors */ } });
  }
}
