/**
 * AI Manager — orchestrates AI provider calls for React profiling analysis.
 */

import type { AIAnalysisRequest, AIConfig, AISuggestion } from './types';
import { analyzeWithClaude } from './claudeProvider';
import { analyzeWithOpenAI } from './openaiProvider';
import { analyzeWithOllama } from './ollamaProvider';

const TIMEOUT_MS = 30_000;

export class AIManager {
  /**
   * Analyze component performance using the configured AI provider.
   * Routes to the correct provider, applies a 30s timeout, and handles errors.
   */
  async analyze(
    request: AIAnalysisRequest,
    config: AIConfig,
  ): Promise<AISuggestion[]> {
    const analysisPromise = this.routeToProvider(request, config);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`AI analysis timed out after ${TIMEOUT_MS / 1000}s`));
      }, TIMEOUT_MS);
    });

    try {
      return await Promise.race([analysisPromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('AI analysis failed with an unknown error');
    }
  }

  private async routeToProvider(
    request: AIAnalysisRequest,
    config: AIConfig,
  ): Promise<AISuggestion[]> {
    switch (config.provider) {
      case 'claude':
        return analyzeWithClaude(request, config);

      case 'openai':
        return analyzeWithOpenAI(request, config);

      case 'ollama':
        return analyzeWithOllama(request, config);

      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }
}
