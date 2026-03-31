/**
 * LLM Integration Types
 * @module panel/utils/llm/types
 */

import type { WastedRenderReport, MemoReport } from '@/shared/types';

/**
 * LLM Provider types
 */
export type LLMProviderType = 'claude' | 'openai' | 'ollama' | 'none';

/**
 * LLM Configuration
 */
export interface LLMConfig {
  provider: LLMProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enabled: boolean;
  privacyMode: 'local' | 'anonymized' | 'full'; // local=ollama, anonymized=strip names, full=send as-is
}

/**
 * LLM Provider interface
 */
export interface LLMProvider {
  readonly type: LLMProviderType;
  readonly name: string;
  
  /**
   * Check if provider is configured and ready
   */
  isReady(): boolean;
  
  /**
   * Send completion request
   */
  complete(prompt: string, options?: Partial<LLMConfig>): Promise<LLMResponse>;
  
  /**
   * Stream completion (for real-time suggestions)
   */
  stream?(prompt: string, onChunk: (chunk: string) => void, options?: Partial<LLMConfig>): Promise<void>;
  
  /**
   * Validate configuration
   */
  validateConfig(): Promise<boolean>;
}

/**
 * LLM Response
 */
export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
  error?: string;
}

/**
 * AI Optimization Suggestion
 */
export interface AIOptimizationSuggestion {
  id: string;
  componentName: string;
  type: 'memo' | 'useMemo' | 'useCallback' | 'split-props' | 'colocate-state' | 'fix-deps' | 'custom-hook';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  explanation: string;
  currentCode: string;
  suggestedCode: string;
  diff: CodeDiff;
  estimatedImprovement: {
    renderTimeReduction?: string;
    renderCountReduction?: string;
    confidence: number; // 0-1
  };
  dependencies: string[];
  applied: boolean;
  appliedAt?: number;
  llmModel?: string;
  tokensUsed?: number;
}

/**
 * Code diff
 */
export interface CodeDiff {
  before: string;
  after: string;
  changes: Array<{
    type: 'add' | 'remove' | 'unchanged';
    line: string;
    lineNumber: number;
  }>;
}

/**
 * Analysis context for LLM
 */
export interface AnalysisContext {
  componentName: string;
  wastedRenderReport?: WastedRenderReport;
  memoReport?: MemoReport;
  componentCode?: string;
  parentComponent?: string;
  childComponents?: string[];
  props?: Array<{
    name: string;
    type: string;
    isStable: boolean;
  }>;
  hooks?: Array<{
    name: string;
    dependencies: string[];
  }>;
  renderCount: number;
  wastedRenderCount: number;
  averageRenderTime: number;
}

/**
 * LLM Prompt templates
 */
export interface PromptTemplates {
  optimizeComponent: string;
  analyzeMemo: string;
  suggestArchitecture: string;
  explainIssue: string;
  predictImpact: string;
}

/**
 * Privacy anonymization rules
 */
export interface AnonymizationRules {
  componentNames: Map<string, string>; // original -> generic
  propNames: Map<string, string>;
  functionNames: Map<string, string>;
  variableNames: Map<string, string>;
}

/**
 * Performance prediction
 */
export interface PerformancePrediction {
  currentRenderTime: number;
  predictedRenderTime: number;
  improvementPercentage: number;
  confidence: number;
  reasoning: string;
}
