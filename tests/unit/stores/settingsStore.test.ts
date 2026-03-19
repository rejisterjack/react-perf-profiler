import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore, DEFAULT_SETTINGS } from '@/panel/stores/settingsStore';

// Mock chrome storage
const mockStorage: Record<string, any> = {};
const mockChromeStorageLocal = {
  get: vi.fn((keys, callback) => {
    const result: Record<string, any> = {};
    keys.forEach((key: string) => {
      result[key] = mockStorage[key];
    });
    callback(result);
  }),
  set: vi.fn((items, callback) => {
    Object.assign(mockStorage, items);
    callback();
  }),
  remove: vi.fn((key, callback) => {
    delete mockStorage[key];
    callback();
  }),
};

vi.stubGlobal('chrome', {
  storage: {
    local: mockChromeStorageLocal,
  },
  runtime: {
    lastError: null,
  },
});

// Get initial state excluding actions
const getInitialState = () => ({
  maxCommits: 100,
  enableTimeTravel: true,
  showInlineDetails: true,
  colorScheme: 'system' as const,
  wastedRenderThreshold: 20,
  memoHitRateThreshold: 70,
  sidebarWidth: 280,
  detailPanelOpen: true,
  defaultViewMode: 'tree' as const,
  maxNodesPerCommit: 10000,
  analysisWorkerCount: 2,
  enableAutoAnalysis: false,
  exportIncludeMetrics: true,
  exportIncludeReports: true,
  loaded: false,
});

describe('settingsStore', () => {
  beforeEach(() => {
    // Reset state while preserving methods
    const currentState = useSettingsStore.getState();
    useSettingsStore.setState({
      ...currentState,
      ...getInitialState(),
    });
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe('default settings', () => {
    it('should have correct default values', () => {
      const state = useSettingsStore.getState();

      expect(state.maxCommits).toBe(100);
      expect(state.enableTimeTravel).toBe(true);
      expect(state.showInlineDetails).toBe(true);
      expect(state.colorScheme).toBe('system');
      expect(state.wastedRenderThreshold).toBe(20);
      expect(state.memoHitRateThreshold).toBe(70);
      expect(state.sidebarWidth).toBe(280);
      expect(state.detailPanelOpen).toBe(true);
      expect(state.defaultViewMode).toBe('tree');
      expect(state.maxNodesPerCommit).toBe(10000);
      expect(state.analysisWorkerCount).toBe(2);
      expect(state.enableAutoAnalysis).toBe(false);
      expect(state.exportIncludeMetrics).toBe(true);
      expect(state.exportIncludeReports).toBe(true);
      expect(state.loaded).toBe(false);
    });
  });

  describe('loadSettings', () => {
    it('should load settings from storage', async () => {
      mockStorage['profiler-settings'] = {
        maxCommits: 200,
        colorScheme: 'dark',
      };

      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(useSettingsStore.getState().maxCommits).toBe(200);
      expect(useSettingsStore.getState().colorScheme).toBe('dark');
      expect(useSettingsStore.getState().loaded).toBe(true);
    });

    it('should merge with defaults when loading partial settings', async () => {
      mockStorage['profiler-settings'] = {
        maxCommits: 150,
      };

      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(useSettingsStore.getState().maxCommits).toBe(150);
      expect(useSettingsStore.getState().colorScheme).toBe('system'); // Default
      expect(useSettingsStore.getState().loaded).toBe(true);
    });

    it('should handle storage error', async () => {
      mockChromeStorageLocal.get.mockImplementationOnce((keys, callback) => {
        (global as any).chrome.runtime.lastError = { message: 'Storage error' };
        callback({});
      });

      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(useSettingsStore.getState().loaded).toBe(true);
      (global as any).chrome.runtime.lastError = null;
    });

    it('should handle invalid JSON in storage', async () => {
      mockStorage['profiler-settings'] = 'invalid json';

      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(useSettingsStore.getState().loaded).toBe(true);
    });

    it('should handle empty storage', async () => {
      const store = useSettingsStore.getState();
      await store.loadSettings();

      expect(useSettingsStore.getState().maxCommits).toBe(100); // Default
      expect(useSettingsStore.getState().loaded).toBe(true);
    });
  });

  describe('saveSettings', () => {
    it('should save settings to storage', async () => {
      useSettingsStore.setState({ maxCommits: 250 });

      const store = useSettingsStore.getState();
      await store.saveSettings();

      expect(mockChromeStorageLocal.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'profiler-settings': expect.objectContaining({
            maxCommits: 250,
          }),
        }),
        expect.any(Function)
      );
    });

    it('should only save persistent fields', async () => {
      const store = useSettingsStore.getState();
      await store.saveSettings();

      const savedData = mockChromeStorageLocal.set.mock.calls[0][0]['profiler-settings'];
      expect(savedData.loaded).toBeUndefined();
    });

    it('should handle storage error', async () => {
      mockChromeStorageLocal.set.mockImplementationOnce((items, callback) => {
        (global as any).chrome.runtime.lastError = { message: 'Storage error' };
        callback();
      });

      const store = useSettingsStore.getState();
      await expect(store.saveSettings()).resolves.not.toThrow();
      (global as any).chrome.runtime.lastError = null;
    });
  });

  describe('updateSetting', () => {
    it('should update a single setting', () => {
      const store = useSettingsStore.getState();
      store.updateSetting('maxCommits', 200);

      expect(useSettingsStore.getState().maxCommits).toBe(200);
    });

    it('should validate maxCommits range', () => {
      const store = useSettingsStore.getState();

      store.updateSetting('maxCommits', 5);
      expect(useSettingsStore.getState().maxCommits).toBe(10); // Min

      store.updateSetting('maxCommits', 2000);
      expect(useSettingsStore.getState().maxCommits).toBe(1000); // Max

      store.updateSetting('maxCommits', 500);
      expect(useSettingsStore.getState().maxCommits).toBe(500); // Valid
    });

    it('should validate percentage settings', () => {
      const store = useSettingsStore.getState();

      store.updateSetting('wastedRenderThreshold', -10);
      expect(useSettingsStore.getState().wastedRenderThreshold).toBe(0); // Min

      store.updateSetting('wastedRenderThreshold', 150);
      expect(useSettingsStore.getState().wastedRenderThreshold).toBe(100); // Max

      store.updateSetting('memoHitRateThreshold', 80);
      expect(useSettingsStore.getState().memoHitRateThreshold).toBe(80); // Valid
    });

    it('should validate sidebarWidth range', () => {
      const store = useSettingsStore.getState();

      store.updateSetting('sidebarWidth', 100);
      expect(useSettingsStore.getState().sidebarWidth).toBe(180); // Min

      store.updateSetting('sidebarWidth', 1000);
      expect(useSettingsStore.getState().sidebarWidth).toBe(600); // Max
    });

    it('should validate maxNodesPerCommit range', () => {
      const store = useSettingsStore.getState();

      store.updateSetting('maxNodesPerCommit', 50);
      expect(useSettingsStore.getState().maxNodesPerCommit).toBe(100); // Min

      store.updateSetting('maxNodesPerCommit', 100000);
      expect(useSettingsStore.getState().maxNodesPerCommit).toBe(50000); // Max
    });

    it('should validate analysisWorkerCount range', () => {
      const store = useSettingsStore.getState();

      store.updateSetting('analysisWorkerCount', 0);
      expect(useSettingsStore.getState().analysisWorkerCount).toBe(1); // Min

      store.updateSetting('analysisWorkerCount', 16);
      expect(useSettingsStore.getState().analysisWorkerCount).toBe(8); // Max
    });

    it('should auto-save after update', async () => {
      const store = useSettingsStore.getState();
      store.updateSetting('maxCommits', 300);

      // Wait for async save
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockChromeStorageLocal.set).toHaveBeenCalled();
    });
  });

  describe('resetSettings', () => {
    it('should reset all settings to defaults', () => {
      useSettingsStore.setState({
        maxCommits: 999,
        colorScheme: 'dark',
        enableTimeTravel: false,
      });

      const store = useSettingsStore.getState();
      store.resetSettings();

      expect(useSettingsStore.getState().maxCommits).toBe(100);
      expect(useSettingsStore.getState().colorScheme).toBe('system');
      expect(useSettingsStore.getState().enableTimeTravel).toBe(true);
      expect(useSettingsStore.getState().loaded).toBe(true);
    });

    it('should save after reset', async () => {
      const store = useSettingsStore.getState();
      store.resetSettings();

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockChromeStorageLocal.set).toHaveBeenCalled();
    });
  });

  describe('getProfilerConfig', () => {
    it('should return profiler config from settings', () => {
      useSettingsStore.setState({
        maxCommits: 250,
        maxNodesPerCommit: 5000,
        analysisWorkerCount: 4,
        enableTimeTravel: false,
        wastedRenderThreshold: 30,
      });

      const store = useSettingsStore.getState();
      const config = store.getProfilerConfig();

      expect(config).toEqual({
        maxCommits: 250,
        maxNodesPerCommit: 5000,
        analysisWorkerCount: 4,
        enableTimeTravel: false,
        wastedRenderThreshold: 30,
      });
    });
  });

  describe('updateSettings', () => {
    it('should update multiple settings at once', () => {
      const store = useSettingsStore.getState();
      store.updateSettings({
        maxCommits: 150,
        colorScheme: 'light',
        enableTimeTravel: false,
      });

      expect(useSettingsStore.getState().maxCommits).toBe(150);
      expect(useSettingsStore.getState().colorScheme).toBe('light');
      expect(useSettingsStore.getState().enableTimeTravel).toBe(false);
    });

    it('should skip functions and loaded state', () => {
      const store = useSettingsStore.getState();
      store.updateSettings({
        maxCommits: 150,
        loaded: true, // Should be ignored
      } as any);

      expect(useSettingsStore.getState().loaded).toBe(false); // Unchanged
    });

    it('should auto-save after batch update', async () => {
      const store = useSettingsStore.getState();
      store.updateSettings({ maxCommits: 150 });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockChromeStorageLocal.set).toHaveBeenCalled();
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('should contain all expected default values', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('maxCommits');
      expect(DEFAULT_SETTINGS).toHaveProperty('enableTimeTravel');
      expect(DEFAULT_SETTINGS).toHaveProperty('showInlineDetails');
      expect(DEFAULT_SETTINGS).toHaveProperty('colorScheme');
      expect(DEFAULT_SETTINGS).toHaveProperty('wastedRenderThreshold');
      expect(DEFAULT_SETTINGS).toHaveProperty('memoHitRateThreshold');
      expect(DEFAULT_SETTINGS).toHaveProperty('sidebarWidth');
      expect(DEFAULT_SETTINGS).toHaveProperty('detailPanelOpen');
      expect(DEFAULT_SETTINGS).toHaveProperty('defaultViewMode');
      expect(DEFAULT_SETTINGS).toHaveProperty('maxNodesPerCommit');
      expect(DEFAULT_SETTINGS).toHaveProperty('analysisWorkerCount');
      expect(DEFAULT_SETTINGS).toHaveProperty('enableAutoAnalysis');
      expect(DEFAULT_SETTINGS).toHaveProperty('exportIncludeMetrics');
      expect(DEFAULT_SETTINGS).toHaveProperty('exportIncludeReports');
    });

    it('should not include action methods', () => {
      expect(DEFAULT_SETTINGS).not.toHaveProperty('loadSettings');
      expect(DEFAULT_SETTINGS).not.toHaveProperty('saveSettings');
      expect(DEFAULT_SETTINGS).not.toHaveProperty('updateSetting');
      expect(DEFAULT_SETTINGS).not.toHaveProperty('resetSettings');
    });
  });
});
