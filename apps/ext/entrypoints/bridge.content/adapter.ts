/**
 * Framework Adapter Interface — abstraction for framework-specific profiling.
 */

export interface ParsedCommitData {
  id: string;
  timestamp: number;
  priorityLevel: 'Immediate' | 'UserBlocking' | 'Normal' | 'Low' | 'Idle';
  duration: number;
  rootFiber: unknown;
  fibers: unknown[];
  reactVersion?: string;
  renderCauses?: unknown[];
  changedFiberIds?: string[];
  isDelta?: boolean;
}

export interface FrameworkAdapter {
  readonly name: 'react' | 'vue';
  detect(): boolean;
  getVersion(): string | undefined;
  parseCommit(root: unknown, options?: Record<string, unknown>): ParsedCommitData;
  hookIntoFramework(callback: (data: ParsedCommitData) => void): () => void;
}
