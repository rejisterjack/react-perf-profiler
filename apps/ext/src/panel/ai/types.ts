/**
 * AI integration types for the React profiling extension.
 */

import type { ComponentMetrics, CommitData, RenderCause, SourceLocation } from '@/src/shared/types';

export type AIProvider = 'claude' | 'openai' | 'ollama';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AISuggestion {
  componentName: string;
  issue: string;
  suggestion: string;
  codeExample: string;
  confidence: number;
  category?: 'memoization' | 'state-colocation' | 'prop-optimization' | 'context-optimization' | 'lazy-loading' | 'render-strategy' | 'useCallback' | 'useMemo';
}

export interface AIRenderContext {
  /** Render causes for this component across commits */
  renderCauses: RenderCause[];
  /** Source location if available (dev builds) */
  sourceLocation: SourceLocation | null;
  /** Prop names that change frequently */
  unstableProps: string[];
  /** Parent component chain */
  parentChain: string[];
  /** Child components that also re-render */
  childRenders: string[];
  /** Summary of the component's Fiber tree neighborhood */
  treeDepth: number;
  treeSiblingCount: number;
}

export interface AIAnalysisRequest {
  componentName: string;
  metrics: ComponentMetrics;
  commits: CommitData[];
  /** Structural context for deeper analysis */
  renderContext?: AIRenderContext;
}
