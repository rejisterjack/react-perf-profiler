import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PluginManager,
  validatePlugin,
  PluginError,
} from '@/panel/plugins/PluginManager';
import type { AnalysisPlugin, PluginAPI, PluginContext } from '@/panel/plugins/types';

// Mock Plugin API
const createMockAPI = (): PluginAPI => ({
  getStore: vi.fn(),
  getProfilerStore: vi.fn(),
  getSettingsStore: vi.fn(),
  getConnectionStore: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  getPluginData: vi.fn(),
  setPluginData: vi.fn(),
});

// Create a valid mock plugin
const createMockPlugin = (overrides: Partial<AnalysisPlugin> = {}): AnalysisPlugin => ({
  metadata: {
    id: 'test.plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    enabledByDefault: false,
    ...overrides.metadata,
  },
  hooks: {
    onEnable: vi.fn(),
    onDisable: vi.fn(),
    onCommit: vi.fn(),
    ...overrides.hooks,
  },
  getMetrics: vi.fn(() => []),
  ...overrides,
});

describe('PluginManager', () => {
  let manager: PluginManager;
  let mockAPI: PluginAPI;

  beforeEach(() => {
    mockAPI = createMockAPI();
    manager = new PluginManager(mockAPI);
  });

  describe('validatePlugin', () => {
    it('should throw error for null plugin', () => {
      expect(() => validatePlugin(null as any)).toThrow('Plugin is required');
    });

    it('should throw error for missing metadata', () => {
      expect(() => validatePlugin({} as any)).toThrow('Plugin metadata is required');
    });

    it('should throw error for missing id', () => {
      expect(() =>
        validatePlugin({ metadata: { name: 'Test', version: '1.0.0' } } as any)
      ).toThrow('Plugin metadata.id is required');
    });

    it('should throw error for invalid id type', () => {
      expect(() =>
        validatePlugin({ metadata: { id: '', name: 'Test', version: '1.0.0' } } as any)
      ).toThrow('Plugin metadata.id must be a non-empty string');
    });

    it('should throw error for missing name', () => {
      expect(() =>
        validatePlugin({ metadata: { id: 'test', version: '1.0.0' } } as any)
      ).toThrow('Plugin metadata.name is required');
    });

    it('should throw error for missing version', () => {
      expect(() =>
        validatePlugin({ metadata: { id: 'test', name: 'Test' } } as any)
      ).toThrow('Plugin metadata.version is required');
    });

    it('should throw error for invalid version format', () => {
      expect(() =>
        validatePlugin({ metadata: { id: 'test', name: 'Test', version: '1' } } as any)
      ).toThrow('Plugin metadata.version must follow semver format');
    });

    it('should validate valid plugin', () => {
      expect(() => validatePlugin(createMockPlugin())).not.toThrow();
    });

    it('should throw error for invalid hook type', () => {
      expect(() =>
        validatePlugin({
          metadata: { id: 'test', name: 'Test', version: '1.0.0' },
          hooks: { invalidHook: vi.fn() },
        } as any)
      ).toThrow('Invalid hook type: invalidHook');
    });

    it('should throw error for non-function hook', () => {
      expect(() =>
        validatePlugin({
          metadata: { id: 'test', name: 'Test', version: '1.0.0' },
          hooks: { onCommit: 'not a function' },
        } as any)
      ).toThrow('Hook onCommit must be a function');
    });
  });

  describe('register', () => {
    it('should register a valid plugin', () => {
      const plugin = createMockPlugin();
      const unregister = manager.register(plugin);

      expect(unregister).toBeDefined();
      expect(manager.getAllPlugins()).toHaveLength(1);
      expect(manager.getPlugin('test.plugin')).toBe(plugin);
    });

    it('should throw error for duplicate plugin id', () => {
      const plugin = createMockPlugin();
      manager.register(plugin);

      expect(() => manager.register(plugin)).toThrow("Plugin with id 'test.plugin' is already registered");
    });

    it('should auto-enable plugin when enabledByDefault is true', async () => {
      const plugin = createMockPlugin({
        metadata: { id: 'auto.plugin', name: 'Auto Plugin', version: '1.0.0', enabledByDefault: true },
      });

      manager.register(plugin);
      
      // Wait for async enable
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(manager.isPluginEnabled('auto.plugin')).toBe(true);
    });

    it('should return unregister function that removes plugin', () => {
      const plugin = createMockPlugin();
      const unregister = manager.register(plugin);

      unregister();

      expect(manager.getAllPlugins()).toHaveLength(0);
    });

    it('should pass initial settings to plugin', () => {
      const plugin = createMockPlugin();
      const settings = { option: 'value' };

      manager.register(plugin, settings);

      expect(manager.getPluginSettings('test.plugin')).toEqual(settings);
    });
  });

  describe('enablePlugin', () => {
    it('should enable a disabled plugin', async () => {
      const plugin = createMockPlugin();
      manager.register(plugin);

      await manager.enablePlugin('test.plugin');

      expect(manager.isPluginEnabled('test.plugin')).toBe(true);
    });

    it('should throw error for unknown plugin', async () => {
      await expect(manager.enablePlugin('unknown')).rejects.toThrow("Plugin 'unknown' not found");
    });

    it('should call onEnable hook when enabling', async () => {
      const onEnable = vi.fn();
      const plugin = createMockPlugin({ hooks: { onEnable } });
      manager.register(plugin);

      await manager.enablePlugin('test.plugin');

      expect(onEnable).toHaveBeenCalledWith(mockAPI, expect.any(Object));
    });

    it('should not re-enable already enabled plugin', async () => {
      const onEnable = vi.fn();
      const plugin = createMockPlugin({ hooks: { onEnable } });
      manager.register(plugin);

      await manager.enablePlugin('test.plugin');
      await manager.enablePlugin('test.plugin');

      expect(onEnable).toHaveBeenCalledTimes(1);
    });
  });

  describe('disablePlugin', () => {
    it('should disable an enabled plugin', async () => {
      const plugin = createMockPlugin();
      manager.register(plugin);
      await manager.enablePlugin('test.plugin');

      await manager.disablePlugin('test.plugin');

      expect(manager.isPluginEnabled('test.plugin')).toBe(false);
    });

    it('should throw error for unknown plugin', async () => {
      await expect(manager.disablePlugin('unknown')).rejects.toThrow("Plugin 'unknown' not found");
    });

    it('should call onDisable hook when disabling', async () => {
      const onDisable = vi.fn();
      const plugin = createMockPlugin({ hooks: { onDisable } });
      manager.register(plugin);
      await manager.enablePlugin('test.plugin');

      await manager.disablePlugin('test.plugin');

      expect(onDisable).toHaveBeenCalledWith(mockAPI, expect.any(Object));
    });

    it('should not re-disable already disabled plugin', async () => {
      const onDisable = vi.fn();
      const plugin = createMockPlugin({ hooks: { onDisable } });
      manager.register(plugin);

      await manager.disablePlugin('test.plugin');

      expect(onDisable).not.toHaveBeenCalled();
    });
  });

  describe('togglePlugin', () => {
    it('should toggle plugin state', async () => {
      const plugin = createMockPlugin();
      manager.register(plugin);

      expect(manager.isPluginEnabled('test.plugin')).toBe(false);

      await manager.togglePlugin('test.plugin');
      expect(manager.isPluginEnabled('test.plugin')).toBe(true);

      await manager.togglePlugin('test.plugin');
      expect(manager.isPluginEnabled('test.plugin')).toBe(false);
    });
  });

  describe('getPluginMetrics', () => {
    it('should return metrics from enabled plugin', () => {
      const metrics = [{ id: 'metric1', name: 'Metric 1', value: 42 }];
      const plugin = createMockPlugin({
        getMetrics: vi.fn(() => metrics),
      });
      manager.register(plugin);
      manager.enablePlugin('test.plugin');

      const result = manager.getPluginMetrics('test.plugin');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test.plugin:metric1');
    });

    it('should return empty array for disabled plugin', () => {
      const plugin = createMockPlugin({
        getMetrics: vi.fn(() => [{ id: 'm1', name: 'M1', value: 1 }]),
      });
      manager.register(plugin);

      const result = manager.getPluginMetrics('test.plugin');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when plugin has no getMetrics', () => {
      const plugin = createMockPlugin();
      delete (plugin as any).getMetrics;
      manager.register(plugin);
      manager.enablePlugin('test.plugin');

      const result = manager.getPluginMetrics('test.plugin');

      expect(result).toHaveLength(0);
    });
  });

  describe('getAllPluginMetrics', () => {
    it('should return metrics from all enabled plugins', async () => {
      const plugin1 = createMockPlugin({
        metadata: { id: 'plugin1', name: 'Plugin 1', version: '1.0.0' },
        getMetrics: vi.fn(() => [{ id: 'm1', name: 'M1', value: 1, priority: 1 }]),
      });
      const plugin2 = createMockPlugin({
        metadata: { id: 'plugin2', name: 'Plugin 2', version: '1.0.0' },
        getMetrics: vi.fn(() => [{ id: 'm2', name: 'M2', value: 2, priority: 2 }]),
      });

      manager.register(plugin1);
      manager.register(plugin2);
      await manager.enablePlugin('plugin1');
      await manager.enablePlugin('plugin2');

      const result = manager.getAllPluginMetrics();

      expect(result).toHaveLength(2);
    });
  });

  describe('getEnabledPlugins', () => {
    it('should return only enabled plugins', async () => {
      const plugin1 = createMockPlugin({
        metadata: { id: 'plugin1', name: 'Plugin 1', version: '1.0.0' },
      });
      const plugin2 = createMockPlugin({
        metadata: { id: 'plugin2', name: 'Plugin 2', version: '1.0.0' },
      });

      manager.register(plugin1);
      manager.register(plugin2);
      await manager.enablePlugin('plugin1');

      const enabled = manager.getEnabledPlugins();

      expect(enabled).toHaveLength(1);
      expect(enabled[0].metadata.id).toBe('plugin1');
    });
  });

  describe('updatePluginSettings', () => {
    it('should update plugin settings', () => {
      const plugin = createMockPlugin();
      manager.register(plugin, { initial: 'value' });

      manager.updatePluginSettings('test.plugin', { newOption: 'newValue' });

      const settings = manager.getPluginSettings('test.plugin');
      expect(settings).toEqual({ initial: 'value', newOption: 'newValue' });
    });

    it('should throw error for unknown plugin', () => {
      expect(() => manager.updatePluginSettings('unknown', {})).toThrow(
        "Plugin 'unknown' not found"
      );
    });
  });

  describe('executeOnCommit', () => {
    it('should execute onCommit hook on enabled plugins', async () => {
      const onCommit = vi.fn((commit) => commit);
      const plugin = createMockPlugin({ hooks: { onCommit } });
      manager.register(plugin);
      await manager.enablePlugin('test.plugin');

      const commit = { id: 'commit1', nodes: [], timestamp: Date.now() };
      await manager.executeOnCommit(commit as any);

      expect(onCommit).toHaveBeenCalledWith(commit, mockAPI, expect.any(Object));
    });

    it('should not execute on disabled plugins', async () => {
      const onCommit = vi.fn();
      const plugin = createMockPlugin({ hooks: { onCommit } });
      manager.register(plugin);

      const commit = { id: 'commit1', nodes: [], timestamp: Date.now() };
      await manager.executeOnCommit(commit as any);

      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe('executeOnAnalyze', () => {
    it('should execute onAnalyze hook on enabled plugins', async () => {
      const onAnalyze = vi.fn(() => ({ customData: true }));
      const plugin = createMockPlugin({ hooks: { onAnalyze } });
      manager.register(plugin);
      await manager.enablePlugin('test.plugin');

      const commits = [{ id: 'c1', nodes: [], timestamp: Date.now() }];
      const results = await manager.executeOnAnalyze(commits as any);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ customData: true });
    });
  });

  describe('executeOnAnalysisComplete', () => {
    it('should execute onAnalysisComplete hook on enabled plugins', async () => {
      const metrics = [{ id: 'm1', name: 'M1', value: 1 }];
      const onAnalysisComplete = vi.fn(() => metrics);
      const plugin = createMockPlugin({ hooks: { onAnalysisComplete } });
      manager.register(plugin);
      await manager.enablePlugin('test.plugin');

      const result = { wastedRenderReports: [], memoReports: [] };
      const allMetrics = await manager.executeOnAnalysisComplete(result as any);

      expect(allMetrics).toHaveLength(1);
      expect(allMetrics[0].id).toBe('test.plugin:m1');
    });
  });
});

describe('PluginError', () => {
  it('should create error with plugin info', () => {
    const originalError = new Error('Original');
    const error = new PluginError('Test error', 'plugin-id', 'onCommit', originalError);

    expect(error.message).toBe('Test error');
    expect(error.pluginId).toBe('plugin-id');
    expect(error.hookType).toBe('onCommit');
    expect(error.originalError).toBe(originalError);
    expect(error.name).toBe('PluginError');
  });
});
