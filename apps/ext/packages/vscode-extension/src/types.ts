/**
 * Types shared across the VS Code extension modules.
 */

export interface ComponentPerfData {
  name: string;
  renderCount: number;
  wastedRenderRate: number;
  avgRenderTime: number;
  maxRenderTime: number;
  isMemoized: boolean;
  issues: string[];
  sourceFile?: string;
  sourceLine?: number;
}

export interface AnalysisPayload {
  timestamp: number;
  performanceScore: number;
  totalCommits: number;
  components: Record<string, ComponentPerfData>;
  budgetViolations: Array<{
    componentName: string;
    metric: string;
    actualValue: number;
    threshold: number;
  }>;
}

export interface WSMessage {
  type: 'analysis' | 'commit' | 'budget_violation' | 'ping' | 'error';
  payload: unknown;
}
