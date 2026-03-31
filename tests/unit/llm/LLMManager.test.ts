/**
 * LLM Manager Tests
 * @module tests/unit/llm/LLMManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMManager } from '@/panel/utils/llm/LLMManager';
import type { LLMConfig } from '@/panel/utils/llm/types';

// Mock chrome.storage
const mockStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in mockStorage) {
            result[key] = mockStorage[key];
          }
        }
        return result;
      }),
    },
  },
} as any;

describe('LLMManager', () => {
  let manager: LLMManager;

  beforeEach(() => {
    manager = new LLMManager();
    // Clear mock storage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  describe('configuration', () => {
    it('should have default config with provider disabled', () => {
      const config = manager.getConfig();
      expect(config.provider).toBe('none');
      expect(config.enabled).toBe(false);
    });

    it('should update config', () => {
      const newConfig: Partial<LLMConfig> = {
        provider: 'claude',
        apiKey: 'test-key',
        enabled: true,
      };

      manager.setConfig(newConfig as LLMConfig);
      
      const config = manager.getConfig();
      expect(config.provider).toBe('claude');
      expect(config.apiKey).toBe('test-key');
    });

    it('should persist config to chrome.storage', async () => {
      manager.setConfig({
        provider: 'openai',
        apiKey: 'test-key',
        enabled: true,
      } as LLMConfig);

      await manager.saveConfig();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          llm_config: expect.any(Object),
        })
      );
    });

    it('should load config from chrome.storage', async () => {
      const savedConfig: LLMConfig = {
        provider: 'ollama',
        model: 'codellama',
        baseUrl: 'http://localhost:11434',
        enabled: true,
        privacyMode: 'local',
      };

      mockStorage['llm_config'] = savedConfig;

      await manager.loadConfig();
      const config = manager.getConfig();

      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('codellama');
    });

    it('should check if enabled correctly', () => {
      expect(manager.isEnabled()).toBe(false);

      manager.setConfig({
        provider: 'claude',
        apiKey: 'test-key',
        enabled: true,
      } as LLMConfig);

      expect(manager.isEnabled()).toBe(true);
    });

    it('should disable when provider is none', () => {
      manager.setConfig({
        provider: 'none',
        enabled: true,
      } as LLMConfig);

      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe('subscriptions', () => {
    it('should notify subscribers when enabled state changes', () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe(callback);

      manager.setConfig({
        provider: 'claude',
        apiKey: 'test',
        enabled: true,
      } as LLMConfig);

      expect(callback).toHaveBeenCalledWith(true);

      manager.setConfig({
        provider: 'none',
        enabled: false,
      } as LLMConfig);

      expect(callback).toHaveBeenCalledWith(false);

      unsubscribe();
    });

    it('should stop notifying after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe(callback);

      unsubscribe();

      manager.setConfig({
        provider: 'claude',
        apiKey: 'test',
        enabled: true,
      } as LLMConfig);

      // Should not be called after unsubscribe
      expect(callback).not.toHaveBeenCalledWith(true);
    });
  });

  describe('privacy modes', () => {
    it('should support anonymized privacy mode', () => {
      manager.setConfig({
        provider: 'claude',
        apiKey: 'test',
        enabled: true,
        privacyMode: 'anonymized',
      } as LLMConfig);

      expect(manager.getConfig().privacyMode).toBe('anonymized');
    });

    it('should support full privacy mode', () => {
      manager.setConfig({
        provider: 'claude',
        apiKey: 'test',
        enabled: true,
        privacyMode: 'full',
      } as LLMConfig);

      expect(manager.getConfig().privacyMode).toBe('full');
    });

    it('should support local privacy mode', () => {
      manager.setConfig({
        provider: 'ollama',
        enabled: true,
        privacyMode: 'local',
      } as LLMConfig);

      expect(manager.getConfig().privacyMode).toBe('local');
    });
  });
});
