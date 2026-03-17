/**
 * User settings state management store
 * Handles user preferences and profiler configuration
 * Persists to chrome.storage for persistence across sessions
 */

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
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
            console.error('Storage get error:', chrome.runtime.lastError);
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
              console.error('Storage set error:', chrome.runtime.lastError);
            }
            resolve();
          });
        } catch (error) {
          console.error('Failed to parse value for storage:', error);
          resolve();
        }
      });
    },
    
    removeItem: async (name: string): Promise<void> => {
      return new Promise((resolve) => {
        chrome.storage.local.remove(name, () => {
          if (chrome.runtime.lastError) {
            console.error('Storage remove error:', chrome.runtime.lastError);
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
  'loadSettings' | 'saveSettings' | 'updateSetting' | 'resetSettings' | 'loaded'
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
  
  // ==========================================================================
  // State
  // ==========================================================================
  
  /** Whether settings have been loaded from storage */
  loaded: boolean;
  
  // ==========================================================================
  // Actions
  // ==========================================================================
  
  /** Load settings from chrome.storage */
  loadSettings: () => Promise<void>;
  /** Save settings to chrome.storage */
  saveSettings: () => Promise<void>;
  /** Update a single setting value */
  updateSetting: <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => void;
  /** Reset all settings to defaults */
  resetSettings: () => void;
  /** Get profiler config from settings */
  getProfilerConfig: () => ProfilerConfig;
  /** Batch update multiple settings */
  updateSettings: (updates: Partial<SettingsState>) => void;
}

// ============================================================================
// Store Creation
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // ========================================================================
        // Initial State
        // ========================================================================
        
        ...DEFAULT_SETTINGS,
        loaded: false,
        
        // ========================================================================
        // Actions
        // ========================================================================
        
        loadSettings: async () => {
          return new Promise((resolve) => {
            chrome.storage.local.get(['profiler-settings'], (result) => {
              if (chrome.runtime.lastError) {
                console.error('Failed to load settings:', chrome.runtime.lastError);
                set((state) => {
                  state.loaded = true;
                });
                resolve();
                return;
              }
              
              const savedSettings = result['profiler-settings'];
              if (savedSettings) {
                try {
                  const parsed = typeof savedSettings === 'string' 
                    ? JSON.parse(savedSettings) 
                    : savedSettings;
                  
                  // Merge with defaults to ensure all keys exist
                  set((state) => {
                    Object.assign(state, DEFAULT_SETTINGS, parsed, { loaded: true });
                  });
                } catch (error) {
                  console.error('Failed to parse saved settings:', error);
                  set((state) => {
                    state.loaded = true;
                  });
                }
              } else {
                set((state) => {
                  state.loaded = true;
                });
              }
              
              resolve();
            });
          });
        },
        
        saveSettings: async () => {
          const settings = get();
          const settingsToSave = {
            maxCommits: settings.maxCommits,
            enableTimeTravel: settings.enableTimeTravel,
            showInlineDetails: settings.showInlineDetails,
            colorScheme: settings.colorScheme,
            wastedRenderThreshold: settings.wastedRenderThreshold,
            memoHitRateThreshold: settings.memoHitRateThreshold,
            sidebarWidth: settings.sidebarWidth,
            detailPanelOpen: settings.detailPanelOpen,
            defaultViewMode: settings.defaultViewMode,
            maxNodesPerCommit: settings.maxNodesPerCommit,
            analysisWorkerCount: settings.analysisWorkerCount,
            enableAutoAnalysis: settings.enableAutoAnalysis,
            exportIncludeMetrics: settings.exportIncludeMetrics,
            exportIncludeReports: settings.exportIncludeReports,
          };
          
          return new Promise((resolve) => {
            chrome.storage.local.set({
              'profiler-settings': settingsToSave,
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('Failed to save settings:', chrome.runtime.lastError);
              }
              resolve();
            });
          });
        },
        
        updateSetting: <K extends keyof SettingsState>(
          key: K,
          value: SettingsState[K]
        ) => {
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
          }
          
          set((state) => {
            state[key] = validatedValue;
          });
          
          // Auto-save after update
          get().saveSettings();
        },
        
        resetSettings: () => {
          set((state) => {
            Object.assign(state, DEFAULT_SETTINGS, { loaded: true });
          });
          get().saveSettings();
        },
        
        getProfilerConfig: (): ProfilerConfig => {
          const settings = get();
          return {
            maxCommits: settings.maxCommits,
            maxNodesPerCommit: settings.maxNodesPerCommit,
            analysisWorkerCount: settings.analysisWorkerCount,
            enableTimeTravel: settings.enableTimeTravel,
            wastedRenderThreshold: settings.wastedRenderThreshold,
          };
        },
        
        updateSettings: (updates: Partial<SettingsState>) => {
          set((state) => {
            Object.entries(updates).forEach(([key, value]) => {
              const typedKey = key as keyof SettingsState;
              // Skip actions and internal state
              if (typeof value !== 'function' && typedKey !== 'loaded') {
                (state[typedKey] as unknown) = value;
              }
            });
          });
          get().saveSettings();
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
        // Skip hydration for custom loading
        skipHydration: true,
      }
    ),
    {
      name: 'settings-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

export default useSettingsStore;
