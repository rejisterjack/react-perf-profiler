/**
 * LLM Integration Module
 * @module panel/utils/llm
 */

export { LLMManager, getLLMManager, resetLLMManager } from './LLMManager';
export { ClaudeProvider } from './ClaudeProvider';
export { OpenAIProvider } from './OpenAIProvider';
export { OllamaProvider, RECOMMENDED_OLLAMA_MODELS } from './OllamaProvider';
export type {
  LLMConfig,
  LLMProvider,
  LLMProviderType,
  LLMResponse,
  AIOptimizationSuggestion,
  CodeDiff,
  AnalysisContext,
  PerformancePrediction,
  PromptTemplates,
  AnonymizationRules,
} from './types';
