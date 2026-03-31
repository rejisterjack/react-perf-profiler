/**
 * Claude (Anthropic) LLM Provider
 * @module panel/utils/llm/ClaudeProvider
 */

import type { LLMProvider, LLMConfig, LLMResponse } from './types';
import { logger } from '@/shared/logger';

/**
 * Claude API Provider
 * Supports Anthropic's Claude 3 models (Haiku, Sonnet, Opus)
 */
export class ClaudeProvider implements LLMProvider {
  readonly type = 'claude' as const;
  readonly name = 'Claude (Anthropic)';
  
  private config: LLMConfig;
  private readonly API_URL = 'https://api.anthropic.com/v1/messages';
  
  constructor(config: LLMConfig) {
    this.config = {
      model: 'claude-3-haiku-20240307',
      temperature: 0.2,
      maxTokens: 4096,
      ...config,
    };
  }

  isReady(): boolean {
    return !!this.config.apiKey && this.config.enabled;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    
    try {
      // Test with a simple request
      const response = await this.complete('Hello', { maxTokens: 10 });
      return !response.error;
    } catch {
      return false;
    }
  }

  async complete(prompt: string, options?: Partial<LLMConfig>): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      return { text: '', error: 'API key not configured' };
    }

    const config = { ...this.config, ...options };
    
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          text: '',
          error: error.error?.message || `API error: ${response.status}`,
        };
      }

      const data = await response.json();
      
      return {
        text: data.content?.[0]?.text || '',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
        model: data.model,
        finishReason: data.stop_reason,
      };
    } catch (error) {
      logger.error('Claude API error', {
        error: error instanceof Error ? error.message : String(error),
        source: 'ClaudeProvider',
      });
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async stream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: Partial<LLMConfig>
  ): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('API key not configured');
    }

    const config = { ...this.config, ...options };
    
    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            const text = parsed.delta?.text || parsed.content_block?.text;
            if (text) onChunk(text);
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }
}
