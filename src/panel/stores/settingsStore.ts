/**
 * User settings state management store
 * Handles user preferences and profiler configuration
 * Persists to chrome.storage via Zustand persist middleware
 */

import { create } from 'zustand';
import { createJSONStorage, devtools, persist, type StateStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ProfilerConfig } from '../../shared/types';

// ============================================================================
// Chrome Storage Adapter for Zustand Persist
// ============================================================================

/**
 * Creates a StateStorage adapter using chrome.storage.local
 * This allows Zustand persist middleware to work with Chrome extension storage
 */
function createChromeStorage(): StateStorage {
  return {
    getItem: async (name: string): Promise<string | null> => {
      return new Promise((resolve) => {
        chrome.storage.local.get([name], (result) => {
          if (chrome.runtime.lastError) {
            console.error('Failed to get storage item:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          const value = result[name];
          resolve(value ? JSON.stringify(value) : null);
        });
      });
    },

    setItem: async (name: string, value: string): Promise<void> => {
      return new Promise((resolve) => {
        try {
          const parsed = JSON.parse(value);
          chrome.storage.local.set({ [name]: parsed }, () => {
            if (chrome.runtime.lastError) {
              console.error('Failed to set storage item:', chrome.runtime.lastError);
            }
            resolve();
          });
        } catch (error) {
          console.error('Failed to parse storage value:', error);
          resolve();
        }
      });
    },

    removeItem: async (name: string): Promise<void> => {
      return new Promise((resolve) => {
        chrome.storage.local.remove(name, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to remove storage item:', chrome.runtime.lastError);
          }
          resolve();
        });
      });
    },
  };
}

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_SETTINGS: Omit<
  SettingsState,
  'updateSetting' | 'resetSettings' | 'loaded' | 'getProfilerConfig' | 'updateSettings'
> = {
  // Profiler settings
  maxCommits: 100,
  enableTimeTravel: true,
  showInlineDetails: true,
  colorScheme: 'system',

  // Analysis settings
  wastedRenderThreshold: 20,
  memoHitRateThreshold: 70,

  // UI settings
  sidebarWidth: 280,
  detailPanelOpen: true,
  defaultViewMode: 'tree',

  // Advanced settings
  maxNodesPerCommit: 10000,
  analysisWorkerCount: 2,
  enableAutoAnalysis: false,
  exportIncludeMetrics: true,
  exportIncludeReports: true,
  maxComponentDataEntries: 1000,
};

// ============================================================================
// Settings State Interface
// ============================================================================

export interface SettingsState {
  // ==========================================================================
  // Profiler Settings
  // ==========================================================================

  /** Maximum number of commits to store in memory */
  maxCommits: number;
  /** Enable time-travel debugging feature */
  enableTimeTravel: boolean;
  /** Show inline details in component tree */
  showInlineDetails: boolean;
  /** UI color scheme preference */
  colorScheme: 'light' | 'dark' | 'system';

  // ==========================================================================
  // Analysis Settings
  // ==========================================================================

  /** Threshold percentage for flagging wasted renders (0-100) */
  wastedRenderThreshold: number;
  /** Minimum hit rate percentage for effective memoization (0-100) */
  memoHitRateThreshold: number;

  // ==========================================================================
  // UI Settings
  // ==========================================================================

  /** Default sidebar width in pixels */
  sidebarWidth: number;
  /** Whether detail panel is open by default */
  detailPanelOpen: boolean;
  /** Default view mode for the profiler */
  defaultViewMode: 'tree' | 'flamegraph' | 'timeline' | 'analysis';

  // ==========================================================================
  // Advanced Settings
  // ==========================================================================

  /** Maximum number of nodes per commit to process */
  maxNodesPerCommit: number;
  /** Number of Web Workers to use for analysis */
  analysisWorkerCount: number;
  /** Automatically run analysis after recording stops */
  enableAutoAnalysis: boolean;
  /** Include metrics in exports */
  exportIncludeMetrics: boolean;
  /** Include reports in exports */
  exportIncludeReports: boolean;
  /** Maximum number of component entries to keep in LRU cache */
  maxComponentDataEntries: number;

  // ==========================================================================
  // State
  // ==========================================================================

  /** Whether settings have been loaded from storage */
  loaded: boolean;

  // ==========================================================================
  // Actions
  // ==========================================================================

  /** Update a single setting value (auto-persisted) */
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  /** Reset all settings to defaults (auto-persisted) */
  resetSettings: () => void;
  /** Get profiler config from settings */
  getProfilerConfig: () => ProfilerConfig;
  /** Batch update multiple settings (auto-persisted) */
  updateSettings: (updates: Partial<SettingsState>) => void;
}

// ============================================================================
// Store Creation
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...DEFAULT_SETTINGS,
        loaded: false,

        updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
          // Validate the value before setting
          let validatedValue = value;

          switch (key) {
            case 'maxCommits':
              validatedValue = Math.max(10, Math.min(1000, value as number)) as SettingsState[K];
              break;
            case 'wastedRenderThreshold':
            case 'memoHitRateThreshold':
              validatedValue = Math.max(0, Math.min(100, value as number)) as SettingsState[K];
              break;
            case 'sidebarWidth':
              validatedValue = Math.max(180, Math.min(600, value as number)) as SettingsState[K];
              break;
            case 'maxNodesPerCommit':
              validatedValue = Math.max(100, Math.min(50000, value as number)) as SettingsState[K];
              break;
            case 'analysisWorkerCount':
              validatedValue = Math.max(1, Math.min(8, value as number)) as SettingsState[K];
              break;
            case 'maxComponentDataEntries':
              validatedValue = Math.max(100, Math.min(10000, value as number)) as SettingsState[K];
              break;
          }

          set((state: SettingsState) => {
            state[key] = validatedValue;
            return state;
          });
          // Note: Zustand persist middleware handles persistence automatically
        },

        resetSettings: () => {
          set((state: SettingsState) => {
            Object.assign(state, DEFAULT_SETTINGS, { loaded: true });
            return state;
          });
          // Note: Zustand persist middleware handles persistence automatically
        },

        getProfilerConfig: (): ProfilerConfig => {
          const settings = get();
          return {
            maxCommits: settings.maxCommits,
            maxNodesPerCommit: settings.maxNodesPerCommit,
            analysisWorkerCount: settings.analysisWorkerCount,
            enableTimeTravel: settings.enableTimeTravel,
            wastedRenderThreshold: settings.wastedRenderThreshold,
            maxComponentDataEntries: settings.maxComponentDataEntries,
          };
        },

        updateSettings: (updates: Partial<SettingsState>) => {
          set((state: SettingsState) => {
            Object.entries(updates).forEach(([key, value]) => {
              const typedKey = key as keyof SettingsState;
              // Skip actions and internal state
              if (typeof value !== 'function' && typedKey !== 'loaded') {
                (state[typedKey] as unknown) = value;
              }
            });
            return state;
          });
          // Note: Zustand persist middleware handles persistence automatically
        },
      })),
      {
        name: 'profiler-settings',
        storage: createJSONStorage(createChromeStorage),
        // Only persist these fields
        partialize: (state) => ({
          maxCommits: state.maxCommits,
          enableTimeTravel: state.enableTimeTravel,
          showInlineDetails: state.showInlineDetails,
          colorScheme: state.colorScheme,
          wastedRenderThreshold: state.wastedRenderThreshold,
          memoHitRateThreshold: state.memoHitRateThreshold,
          sidebarWidth: state.sidebarWidth,
          detailPanelOpen: state.detailPanelOpen,
          defaultViewMode: state.defaultViewMode,
          maxNodesPerCommit: state.maxNodesPerCommit,
          analysisWorkerCount: state.analysisWorkerCount,
          enableAutoAnalysis: state.enableAutoAnalysis,
          exportIncludeMetrics: state.exportIncludeMetrics,
          exportIncludeReports: state.exportIncludeReports,
        }),
        onRehydrateStorage: () => (state) => {
          // Mark as loaded after rehydration completes
          if (state) {
            state.loaded = true;
          }
        },
      }
    ),
    {
      name: 'settings-store',
      enabled: process.env['NODE_ENV'] === 'development',
    }
  )
);

export default useSettingsStore;
