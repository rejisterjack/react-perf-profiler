/**
 * LLM Manager
 * Central manager for AI-powered optimization suggestions
 * @module panel/utils/llm/LLMManager
 */

import { ClaudeProvider } from './ClaudeProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { OllamaProvider, RECOMMENDED_OLLAMA_MODELS } from './OllamaProvider';
import type {
  LLMConfig,
  LLMProvider,
  LLMProviderType,
  AIOptimizationSuggestion,
  AnalysisContext,
  PerformancePrediction,
  AnonymizationRules,
} from './types';
import type { WastedRenderReport } from '../wastedRenderAnalysis';
import type { MemoEffectivenessReport } from '../memoAnalysis';
import { logger } from '@/shared/logger';

/**
 * LLM Manager
 * Manages LLM providers and generates AI optimization suggestions
 */
export class LLMManager {
  private provider: LLMProvider | null = null;
  private config: LLMConfig;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      provider: 'none',
      enabled: false,
      privacyMode: 'anonymized',
      temperature: 0.2,
      maxTokens: 4096,
      ...config,
    };

    this.updateProvider();
  }

  // =============================================================================
  // Configuration
  // =============================================================================

  /**
   * Update configuration
   */
  setConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateProvider();
    this.notifyListeners();
    this.saveConfig();
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled && !!this.provider?.isReady();
  }

  // =============================================================================
  // Provider Management
  // =============================================================================

  private updateProvider(): void {
    if (!this.config.enabled) {
      this.provider = null;
      return;
    }

    switch (this.config.provider) {
      case 'claude':
        this.provider = new ClaudeProvider(this.config);
        break;
      case 'openai':
        this.provider = new OpenAIProvider(this.config);
        break;
      case 'ollama':
        this.provider = new OllamaProvider(this.config);
        break;
      default:
        this.provider = null;
    }
  }

  private createProvider(type: LLMProviderType): LLMProvider | null {
    switch (type) {
      case 'claude':
        return new ClaudeProvider(this.config);
      case 'openai':
        return new OpenAIProvider(this.config);
      case 'ollama':
        return new OllamaProvider(this.config);
      default:
        return null;
    }
  }

  /**
   * Test provider connection
   */
  async testProvider(type: LLMProviderType): Promise<boolean> {
    const testProvider = this.createProvider(type);
    if (!testProvider) return false;
    return testProvider.validateConfig();
  }

  // =============================================================================
  // AI Suggestions
  // =============================================================================

  /**
   * Generate AI optimization suggestion for a component
   */
  async generateSuggestion(context: AnalysisContext): Promise<AIOptimizationSuggestion | null> {
    if (!this.isEnabled() || !this.provider) {
      return null;
    }

    try {
      const prompt = this.buildOptimizationPrompt(context);
      const anonymizedPrompt = this.anonymizeCode(prompt);
      
      const response = await this.provider.complete(anonymizedPrompt);
      
      if (response.error || !response.text) {
        logger.error('LLM generation failed', {
          error: response.error,
          source: 'LLMManager',
        });
        return null;
      }

      return this.parseSuggestion(
        response.text,
        context,
        response.model,
        response.usage?.totalTokens
      );
    } catch (error) {
      logger.error('Failed to generate suggestion', {
        error: error instanceof Error ? error.message : String(error),
        source: 'LLMManager',
      });
      return null;
    }
  }

  /**
   * Generate suggestions for multiple components
   */
  async generateBatchSuggestions(
    contexts: AnalysisContext[]
  ): Promise<AIOptimizationSuggestion[]> {
    if (!this.isEnabled()) return [];

    const suggestions: AIOptimizationSuggestion[] = [];
    
    // Process in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < contexts.length; i += batchSize) {
      const batch = contexts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(ctx => this.generateSuggestion(ctx))
      );
      
      for (const result of batchResults) {
        if (result) suggestions.push(result);
      }
      
      // Small delay between batches
      if (i + batchSize < contexts.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return suggestions;
  }

  /**
   * Predict performance impact of optimization
   */
  async predictImpact(
    context: AnalysisContext,
    optimization: string
  ): Promise<PerformancePrediction | null> {
    if (!this.isEnabled() || !this.provider) return null;

    try {
      const prompt = this.buildPredictionPrompt(context, optimization);
      const response = await this.provider.complete(prompt);
      
      if (response.error || !response.text) return null;

      return this.parsePrediction(response.text, context);
    } catch (error) {
      logger.error('Failed to predict impact', {
        error: error instanceof Error ? error.message : String(error),
        source: 'LLMManager',
      });
      return null;
    }
  }

  /**
   * Explain a performance issue in plain English
   */
  async explainIssue(
    report: WastedRenderReport | MemoEffectivenessReport
  ): Promise<string | null> {
    if (!this.isEnabled() || !this.provider) return null;

    const prompt = `Explain this React performance issue in simple terms:

${JSON.stringify(report, null, 2)}

Provide a clear explanation of:
1. What's causing the issue
2. Why it matters for performance
3. What the user should do about it

Keep it under 3 sentences and non-technical.`;

    try {
      const response = await this.provider.complete(prompt);
      return response.text || null;
    } catch {
      return null;
    }
  }

  // =============================================================================
  // Prompt Building
  // =============================================================================

  private buildOptimizationPrompt(context: AnalysisContext): string {
    const wastedRate = ((context.wastedRenderCount / context.renderCount) * 100).toFixed(1);
    
    return `Analyze this React component for performance optimization opportunities:

## Component: ${context.componentName}

### Performance Metrics
- Render count: ${context.renderCount}
- Wasted renders: ${context.wastedRenderCount} (${wastedRate}%)
- Average render time: ${context.averageRenderTime.toFixed(2)}ms

### Props
${context.props?.map(p => `- ${p.name}: ${p.type} ${p.isStable ? '(stable)' : '(unstable)'}`).join('\n') || 'None'}

### Hooks
${context.hooks?.map(h => `- ${h.name} with deps: [${h.dependencies.join(', ')}]`).join('\n') || 'None'}

${context.wastedRenderReport ? `
### Wasted Render Analysis
- Rate: ${(context.wastedRenderReport.wastedRenderRate * 100).toFixed(1)}%
- Severity: ${context.wastedRenderReport.severity}
- Recommendation: ${context.wastedRenderReport.recommendedAction}
` : ''}

${context.memoReport ? `
### Memo Analysis
- Current hit rate: ${(context.memoReport.currentHitRate * 100).toFixed(1)}%
- Issues: ${context.memoReport.issues.map(i => i.type).join(', ')}
` : ''}

### Current Code
\`\`\`jsx
${context.componentCode || '// Code not available'}
\`\`\`

Provide a specific, actionable optimization:

1. **Title**: Brief description of the optimization
2. **Type**: One of: memo, useMemo, useCallback, split-props, colocate-state, fix-deps, custom-hook
3. **Severity**: critical, warning, or info
4. **Explanation**: Why this optimization helps (2-3 sentences)
5. **Current Code**: The problematic code section
6. **Suggested Code**: The optimized replacement
7. **Estimated Improvement**: Expected render time/count reduction
8. **Dependencies**: Any additional dependencies needed

Format your response as JSON with these exact keys: title, type, severity, explanation, currentCode, suggestedCode, estimatedImprovement, dependencies`;
  }

  private buildPredictionPrompt(
    context: AnalysisContext,
    optimization: string
  ): string {
    return `Predict the performance impact of this React optimization:

## Component: ${context.componentName}

### Current Metrics
- Render count: ${context.renderCount}
- Average render time: ${context.averageRenderTime.toFixed(2)}ms
- Wasted renders: ${context.wastedRenderCount}

### Proposed Optimization
${optimization}

Predict:
1. New estimated render time (in ms)
2. Improvement percentage
3. Confidence level (0-1)
4. Brief reasoning

Respond as JSON: { currentRenderTime, predictedRenderTime, improvementPercentage, confidence, reasoning }`;
  }

  // =============================================================================
  // Response Parsing
  // =============================================================================

  private parseSuggestion(
    text: string,
    context: AnalysisContext,
    model?: string,
    tokensUsed?: number
  ): AIOptimizationSuggestion | null {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/) || text.match(/({[\s\S]*})/);
      const jsonStr = jsonMatch?.[1] || text;
      
      const parsed = JSON.parse(jsonStr);

      return {
        id: crypto.randomUUID(),
        componentName: context.componentName,
        type: parsed.type || 'memo',
        severity: parsed.severity || 'warning',
        title: parsed.title || 'Optimization Suggestion',
        description: parsed.explanation || '',
        explanation: parsed.explanation || '',
        currentCode: parsed.currentCode || '',
        suggestedCode: parsed.suggestedCode || '',
        diff: this.generateDiff(parsed.currentCode || '', parsed.suggestedCode || ''),
        estimatedImprovement: {
          renderTimeReduction: parsed.estimatedImprovement,
          confidence: 0.8,
        },
        dependencies: parsed.dependencies || [],
        applied: false,
        llmModel: model,
        tokensUsed,
      };
    } catch (error) {
      logger.error('Failed to parse LLM suggestion', {
        error: error instanceof Error ? error.message : String(error),
        source: 'LLMManager',
      });
      return null;
    }
  }

  private parsePrediction(text: string, context: AnalysisContext): PerformancePrediction | null {
    try {
      const jsonMatch = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/) || text.match(/({[\s\S]*})/);
      const jsonStr = jsonMatch?.[1] || text;
      const parsed = JSON.parse(jsonStr);

      return {
        currentRenderTime: parsed.currentRenderTime || context.averageRenderTime,
        predictedRenderTime: parsed.predictedRenderTime,
        improvementPercentage: parsed.improvementPercentage,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
      };
    } catch {
      return null;
    }
  }

  private generateDiff(before: string, after: string): import('./types').CodeDiff {
    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');
    
    // Simple diff - in production, use a proper diff library
    const changes: Array<{ type: 'add' | 'remove' | 'unchanged'; line: string; lineNumber: number }> = [];
    
    beforeLines.forEach((line, i) => {
      if (!afterLines.includes(line)) {
        changes.push({ type: 'remove', line, lineNumber: i + 1 });
      }
    });
    
    afterLines.forEach((line, i) => {
      if (!beforeLines.includes(line)) {
        changes.push({ type: 'add', line, lineNumber: i + 1 });
      }
    });

    return { before, after, changes };
  }

  // =============================================================================
  // Privacy / Anonymization
  // =============================================================================

  private anonymizeCode(code: string): string {
    if (this.config.privacyMode === 'full') return code;
    if (this.config.privacyMode === 'local') return code; // Local LLM, no need to anonymize

    // Anonymized mode: replace component/prop names with generic ones
    const rules: AnonymizationRules = {
      componentNames: new Map(),
      propNames: new Map(),
      functionNames: new Map(),
      variableNames: new Map(),
    };

    let anonymized = code;
    let counter = 1;

    // Replace component names (PascalCase)
    anonymized = anonymized.replace(/\b[A-Z][a-zA-Z0-9]*\b/g, (match) => {
      if (!rules.componentNames.has(match)) {
        rules.componentNames.set(match, `Component${counter++}`);
      }
      return rules.componentNames.get(match)!;
    });

    return anonymized;
  }

  // =============================================================================
  // Persistence
  // =============================================================================

  private async saveConfig(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    
    // Don't save API keys in plain text - use chrome.storage.local which is encrypted
    await chrome.storage.local.set({
      llm_config: {
        provider: this.config.provider,
        enabled: this.config.enabled,
        privacyMode: this.config.privacyMode,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        model: this.config.model,
        // API key is stored separately with encryption
      },
    });

    if (this.config.apiKey) {
      await chrome.storage.local.set({ llm_api_key: this.config.apiKey });
    }
  }

  async loadConfig(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    
    const result = await chrome.storage.local.get(['llm_config', 'llm_api_key']);
    
    if (result.llm_config) {
      this.config = {
        ...this.config,
        ...result.llm_config,
        apiKey: result.llm_api_key,
      };
      this.updateProvider();
    }
  }

  // =============================================================================
  // Event Handling
  // =============================================================================

  subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.isEnabled());
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// Singleton instance
let llmManager: LLMManager | null = null;

export function getLLMManager(config?: Partial<LLMConfig>): LLMManager {
  if (!llmManager) {
    llmManager = new LLMManager(config);
    llmManager.loadConfig();
  }
  return llmManager;
}

export function resetLLMManager(): void {
  llmManager = null;
}

export { RECOMMENDED_OLLAMA_MODELS };
