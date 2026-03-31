/**
 * OpenAI LLM Provider
 * @module panel/utils/llm/OpenAIProvider
 */

import type { LLMProvider, LLMConfig, LLMResponse } from './types';
import { logger } from '@/shared/logger';

/**
 * OpenAI API Provider
 * Supports GPT-4 and GPT-3.5 models
 */
export class OpenAIProvider implements LLMProvider {
  readonly type = 'openai' as const;
  readonly name = 'OpenAI';
  
  private config: LLMConfig;
  private readonly API_URL = 'https://api.openai.com/v1/chat/completions';
  
  constructor(config: LLMConfig) {
    this.config = {
      model: 'gpt-4-turbo-preview',
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
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert React performance optimization assistant. Provide specific, actionable code suggestions.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
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
      const choice = data.choices?.[0];
      
      return {
        text: choice?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        model: data.model,
        finishReason: choice?.finish_reason,
      };
    } catch (error) {
      logger.error('OpenAI API error', {
        error: error instanceof Error ? error.message : String(error),
        source: 'OpenAIProvider',
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
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert React performance optimization assistant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
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
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }
}
