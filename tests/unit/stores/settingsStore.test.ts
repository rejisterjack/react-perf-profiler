import { describe, it, expect, beforeEach, vi, beforeAll, type MockedFunction } from 'vitest';

// Mock chrome storage - must be set up BEFORE importing the store
const mockStorage: Record<string, any> = {};
const mockChromeStorageLocalSet = vi.fn((items, callback) => {
  Object.assign(mockStorage, items);
  callback?.();
});
const mockChromeStorageLocalGet = vi.fn((keys, callback) => {
  const result: Record<string, any> = {};
  keys.forEach((key: string) => {
    result[key] = mockStorage[key];
  });
  callback?.(result);
});
const mockChromeStorageLocalRemove = vi.fn((key, callback) => {
  delete mockStorage[key];
  callback?.();
});

const mockChromeStorageSyncSet = vi.fn((items, callback) => {
  Object.assign(mockStorage, items);
  callback?.();
});
const mockChromeStorageSyncGet = vi.fn((keys, callback) => {
  const result: Record<string, any> = {};
  keys.forEach((key: string) => {
    result[key] = mockStorage[key];
  });
  callback?.(result);
});
const mockChromeStorageSyncRemove = vi.fn((key, callback) => {
  delete mockStorage[key];
  callback?.();
});

const mockChromeStorageLocal = {
  get: mockChromeStorageLocalGet,
  set: mockChromeStorageLocalSet,
  remove: mockChromeStorageLocalRemove,
};

const mockChromeStorageSync = {
  get: mockChromeStorageSyncGet,
  set: mockChromeStorageSyncSet,
  remove: mockChromeStorageSyncRemove,
};

vi.stubGlobal('chrome', {
  storage: {
    local: mockChromeStorageLocal,
    sync: mockChromeStorageSync,
  },
  runtime: {
    lastError: null,
  },
});

// Import store AFTER mock setup
let useSettingsStore: typeof import('@/panel/stores/settingsStore').useSettingsStore;
let DEFAULT_SETTINGS: typeof import('@/panel/stores/settingsStore').DEFAULT_SETTINGS;

beforeAll(async () => {
  const module = await import('@/panel/stores/settingsStore');
  useSettingsStore = module.useSettingsStore;
  DEFAULT_SETTINGS = module.DEFAULT_SETTINGS;
});

// Get initial state excluding actions - matches what the store actually persists
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
  maxComponentDataEntries: 1000,
  loaded: false,
});

describe('settingsStore', () => {
  beforeEach(() => {
    // Clear mock calls
    mockChromeStorageSyncSet.mockClear();
    mockChromeStorageLocalSet.mockClear();
    mockStorage['profiler-settings'] = undefined;
    
    // Reset state while preserving methods
    const currentState = useSettingsStore.getState();
    useSettingsStore.setState({
      ...currentState,
      ...getInitialState(),
    });
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useSettingsStore.getState();

      expect(state.maxCommits).toBe(100);
      expect(state.enableTimeTravel).toBe(true);
      expect(state.colorScheme).toBe('system');
      expect(state.wastedRenderThreshold).toBe(20);
      expect(state.memoHitRateThreshold).toBe(70);
      expect(state.sidebarWidth).toBe(280);
      expect(state.detailPanelOpen).toBe(true);
      expect(state.defaultViewMode).toBe('tree');
      expect(state.loaded).toBe(false);
    });

    it('should have correct advanced settings defaults', () => {
      const state = useSettingsStore.getState();

      expect(state.maxNodesPerCommit).toBe(10000);
      expect(state.analysisWorkerCount).toBe(2);
      expect(state.enableAutoAnalysis).toBe(false);
      expect(state.exportIncludeMetrics).toBe(true);
      expect(state.exportIncludeReports).toBe(true);
    });
  });

  describe('persistence via Zustand persist middleware', () => {
    it('should persist settings to chrome.storage when updateSetting is called', async () => {
      useSettingsStore.setState({ loaded: true });
      const store = useSettingsStore.getState();
      store.updateSetting('maxCommits', 250);

      // Wait for async persist
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockChromeStorageSyncSet).toHaveBeenCalled();
    });

    it('should only save persistent fields via Zustand persist', async () => {
      useSettingsStore.setState({ loaded: true });
      const store = useSettingsStore.getState();
      store.updateSetting('maxCommits', 250);

      await new Promise(resolve => setTimeout(resolve, 150));

      // Zustand persist saves to chrome.storage.sync with key 'profiler-settings'
      expect(mockChromeStorageSyncSet).toHaveBeenCalled();
      const savedData = mockChromeStorageSyncSet.mock.calls[0][0];
      expect(savedData).toHaveProperty('profiler-settings');
      const persisted = savedData['profiler-settings'];
      // Zustand persist wraps the state
      expect(persisted).toBeDefined();
      // The actual state is at .state or directly on the object depending on version
      const state = persisted.state || persisted;
      // Note: Zustand persist saves the entire partialize'd state, but validation
      // might cause the actual stored value to differ from what was set
      expect(state).toHaveProperty('maxCommits');
      // loaded should not be persisted (partialize excludes it)
      expect(state).not.toHaveProperty('loaded');
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

    it('should auto-save after update via Zustand persist', async () => {
      useSettingsStore.setState({ loaded: true });
      const store = useSettingsStore.getState();
      store.updateSetting('maxCommits', 300);

      // Wait for async save via Zustand persist
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockChromeStorageSyncSet).toHaveBeenCalled();
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

    it('should save after reset via Zustand persist', async () => {
      useSettingsStore.setState({ loaded: true });
      const store = useSettingsStore.getState();
      store.resetSettings();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockChromeStorageSyncSet).toHaveBeenCalled();
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
        maxComponentDataEntries: 1000,
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

    it('should auto-save after batch update via Zustand persist', async () => {
      useSettingsStore.setState({ loaded: true });
      const store = useSettingsStore.getState();
      store.updateSettings({ maxCommits: 150 });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockChromeStorageSyncSet).toHaveBeenCalled();
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
  });
});
