import type { CommitData, ComponentMetrics } from '@/src/shared/types';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
}

export interface PluginContext {
  getCommits(): CommitData[];
  getComponentMetrics(): Map<string, ComponentMetrics>;
  getSetting(key: string): unknown;
  on(event: string, callback: (...args: unknown[]) => void): () => void;
}

export interface PluginInstance {
  manifest: PluginManifest;
  enabled: boolean;
  exports: Record<string, unknown>;
}
