/**
 * Settings store — user preferences persisted to chrome.storage.local
 */

import { create } from 'zustand';
import { DEFAULT_PROFILER_CONFIG } from '@/src/shared/constants';
import type { Theme } from '@/src/shared/types';
import type { APMConfig } from '@/src/panel/integrations/types';

export type EditorProtocol = 'vscode' | 'cursor' | 'custom';
export type CompactMode = 'auto' | 'always' | 'never';

interface SettingsStore {
  maxCommits: number;
  enableTimeTravel: boolean;
  colorScheme: Theme;
  wastedRenderThreshold: number;
  memoHitRateThreshold: number;
  showNotifications: boolean;
  autoStartProfiling: boolean;
  autoProfileUrlPatterns: string[];
  incrementalDiffing: boolean;
  sourceCorrelation: boolean;
  renderCauseTracking: boolean;
  maxPropDepth: number;
  maxPropKeys: number;
  editorProtocol: EditorProtocol;
  compactMode: CompactMode;
  apmConfig: APMConfig;

  updateSetting: <K extends keyof Omit<SettingsStore, 'updateSetting' | 'resetSettings'>>(key: K, value: SettingsStore[K]) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  maxCommits: DEFAULT_PROFILER_CONFIG.maxCommits,
  enableTimeTravel: DEFAULT_PROFILER_CONFIG.enableTimeTravel,
  colorScheme: 'system' as Theme,
  wastedRenderThreshold: DEFAULT_PROFILER_CONFIG.wastedRenderThreshold,
  memoHitRateThreshold: 0.7,
  showNotifications: true,
  autoStartProfiling: false,
  autoProfileUrlPatterns: ['*'],
  incrementalDiffing: true,
  sourceCorrelation: true,
  renderCauseTracking: true,
  maxPropDepth: 3,
  maxPropKeys: 20,
  editorProtocol: 'vscode' as EditorProtocol,
  compactMode: 'auto' as CompactMode,
  apmConfig: {
    enabled: false,
    provider: 'webhook' as const,
    endpoint: '',
    sendOnAnalysis: true,
    sendOnBudgetViolation: false,
    minSeverity: 'high' as const,
  } as APMConfig,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...defaultSettings,

  updateSetting: (key, value) => {
    set({ [key]: value });
    if (key === 'autoStartProfiling' || key === 'autoProfileUrlPatterns') {
      try {
        const state = useSettingsStore.getState();
        chrome.storage.local.set({
          'perf-profiler-auto-profile': {
            enabled: state.autoStartProfiling,
            urlPatterns: state.autoProfileUrlPatterns,
          },
        });
      } catch { /* ignore */ }
    }
  },
  resetSettings: () => {
    set(defaultSettings);
    try {
      chrome.storage.local.set({
        'perf-profiler-auto-profile': {
          enabled: false,
          urlPatterns: ['*'],
        },
      });
    } catch { /* ignore */ }
  },
}));
