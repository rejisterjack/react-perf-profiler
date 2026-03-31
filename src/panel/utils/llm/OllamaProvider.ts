/**
 * Ollama Local LLM Provider
 * For privacy-conscious users who want to run models locally
 * @module panel/utils/llm/OllamaProvider
 */

import type { LLMProvider, LLMConfig, LLMResponse } from './types';
import { logger } from '@/shared/logger';

/**
 * Ollama Local LLM Provider
 * Runs models locally via Ollama (ollama.com)
 */
export class OllamaProvider implements LLMProvider {
  readonly type = 'ollama' as const;
  readonly name = 'Ollama (Local)';
  
  private config: LLMConfig;
  private readonly DEFAULT_URL = 'http://localhost:11434';
  
  constructor(config: LLMConfig) {
    this.config = {
      baseUrl: this.DEFAULT_URL,
      model: 'codellama',
      temperature: 0.2,
      maxTokens: 4096,
      ...config,
    };
  }

  isReady(): boolean {
    return this.config.enabled;
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }

  async complete(prompt: string, options?: Partial<LLMConfig>): Promise<LLMResponse> {
    const config = { ...this.config, ...options };
    
    try {
      const response = await fetch(`${config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt: this.formatPrompt(prompt),
          stream: false,
          options: {
            temperature: config.temperature,
            num_predict: config.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          text: '',
          error: error.error || `Ollama error: ${response.status}`,
        };
      }

      const data = await response.json();
      
      return {
        text: data.response || '',
        model: config.model,
      };
    } catch (error) {
      logger.error('Ollama API error', {
        error: error instanceof Error ? error.message : String(error),
        source: 'OllamaProvider',
      });
      return {
        text: '',
        error: error instanceof Error 
          ? error.message 
          : 'Failed to connect to Ollama. Is it running?',
      };
    }
  }

  async stream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: Partial<LLMConfig>
  ): Promise<void> {
    const config = { ...this.config, ...options };
    
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: this.formatPrompt(prompt),
        stream: true,
        options: {
          temperature: config.temperature,
          num_predict: config.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Ollama error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            onChunk(parsed.response);
          }
          if (parsed.done) return;
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(model: string, onProgress?: (status: string) => void): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: true }),
      });

      if (!response.ok) return false;

      const reader = response.body?.getReader();
      if (!reader) return false;

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (onProgress && parsed.status) {
              onProgress(parsed.status);
            }
            if (parsed.status === 'success') return true;
          } catch {
            // Ignore parse errors
          }
        }
      }

      return true;
    } catch (error) {
      logger.error('Ollama pull error', {
        error: error instanceof Error ? error.message : String(error),
        source: 'OllamaProvider',
      });
      return false;
    }
  }

  /**
   * Format prompt for code models
   */
  private formatPrompt(prompt: string): string {
    return `<s>[INST] You are an expert React performance optimization assistant. 
Provide specific, actionable code suggestions.

${prompt} [/INST]`;
  }
}

/**
 * Recommended models for React optimization
 */
export const RECOMMENDED_OLLAMA_MODELS = [
  { name: 'codellama', description: 'Meta CodeLlama - Best for code', size: '3.8GB' },
  { name: 'codellama:7b', description: 'CodeLlama 7B - Faster, good quality', size: '3.8GB' },
  { name: 'codellama:13b', description: 'CodeLlama 13B - Better quality', size: '7.4GB' },
  { name: 'mistral', description: 'Mistral 7B - General purpose', size: '4.1GB' },
  { name: 'llama2', description: 'Llama 2 7B - General purpose', size: '3.8GB' },
  { name: 'mixtral', description: 'Mixtral 8x7B - Best quality', size: '26GB' },
];
