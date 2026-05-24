/**
 * Constants for React Perf Profiler
 */

import type { ProfilerConfig, Severity, Theme } from './types';

// Default Configuration
export const DEFAULT_PROFILER_CONFIG: ProfilerConfig = {
  maxCommits: 100,
  maxNodesPerCommit: 1000,
  analysisWorkerCount: 2,
  enableTimeTravel: true,
  maxComponentDataEntries: 1000,
  wastedRenderThreshold: 20,
};

export const CONFIG_LIMITS = {
  maxCommits: { min: 10, max: 1000 },
  maxNodesPerCommit: { min: 100, max: 10000 },
  analysisWorkerCount: { min: 1, max: 8 },
  wastedRenderThreshold: { min: 5, max: 95 },
} as const;

// Severity Thresholds
export const SEVERITY_THRESHOLDS: Record<Severity, { min: number; max: number }> = {
  critical: { min: 70, max: 100 },
  high: { min: 50, max: 69.99 },
  medium: { min: 30, max: 49.99 },
  low: { min: 0, max: 29.99 },
};

export const RENDER_SEVERITY_MS = {
  CRITICAL: 16,
  WARNING: 8,
  INFO: 2,
} as const;

export type RenderSeverity = 'critical' | 'warning' | 'info' | 'none';

export function getRenderSeverity(durationMs: number): RenderSeverity {
  if (durationMs >= RENDER_SEVERITY_MS.CRITICAL) return 'critical';
  if (durationMs >= RENDER_SEVERITY_MS.WARNING) return 'warning';
  if (durationMs >= RENDER_SEVERITY_MS.INFO) return 'info';
  return 'none';
}

export const MEMO_EFFECTIVENESS_THRESHOLDS = {
  excellent: 80,
  good: 60,
  poor: 40,
  ineffective: 0,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  CONFIG: 'react-perf-profiler:config',
  COMMITS: 'react-perf-profiler:commits',
  METRICS: 'react-perf-profiler:metrics',
  REPORTS: 'react-perf-profiler:reports',
  PREFERENCES: 'react-perf-profiler:preferences',
  THEME: 'react-perf-profiler:theme',
  FILTERS: 'react-perf-profiler:filters',
  SORT_CONFIG: 'react-perf-profiler:sort-config',
  COLUMN_VISIBILITY: 'react-perf-profiler:column-visibility',
  ONBOARDING_COMPLETE: 'react-perf-profiler:onboarding-complete',
  DISMISSED_NOTIFICATIONS: 'react-perf-profiler:dismissed-notifications',
  EXPORT_HISTORY: 'react-perf-profiler:export-history',
  SESSION: 'react-perf-profiler:session',
} as const;

// Message Type Constants
export enum MessageTypeEnum {
  COMMIT = 'COMMIT',
  COMMIT_BATCH = 'COMMIT_BATCH',
  COMMIT_DATA = 'COMMIT_DATA',
  START_PROFILING = 'START_PROFILING',
  STOP_PROFILING = 'STOP_PROFILING',
  CLEAR_DATA = 'CLEAR_DATA',
  GET_DATA = 'GET_DATA',
  COMPONENT_SELECTED = 'COMPONENT_SELECTED',
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
  ANALYSIS_PROGRESS = 'ANALYSIS_PROGRESS',
  INIT = 'INIT',
  PING = 'PING',
  PONG = 'PONG',
  ERROR = 'ERROR',
  GET_BRIDGE_STATUS = 'GET_BRIDGE_STATUS',
  DETECT_REACT = 'DETECT_REACT',
  FORCE_INIT = 'FORCE_INIT',
  BRIDGE_STATUS = 'BRIDGE_STATUS',
  REACT_DETECT_RESULT = 'REACT_DETECT_RESULT',
  BRIDGE_INIT = 'BRIDGE_INIT',
  BRIDGE_ERROR = 'BRIDGE_ERROR',
  BRIDGE_INJECTED = 'BRIDGE_INJECTED',
  BRIDGE_RETRY_SCHEDULED = 'BRIDGE_RETRY_SCHEDULED',
  CONNECTION_STATUS = 'CONNECTION_STATUS',
  STATUS_UPDATE = 'STATUS_UPDATE',
  PROFILING_STARTED = 'PROFILING_STARTED',
  PROFILING_STOPPED = 'PROFILING_STOPPED',
  WEB_VITALS = 'WEB_VITALS',
  DATA_RESPONSE = 'DATA_RESPONSE',
  DATA_CLEARED = 'DATA_CLEARED',
  SET_RECORDING_FILTERS = 'SET_RECORDING_FILTERS',
  SET_CONFIG = 'SET_CONFIG',
  SCORE_HISTORY_UPDATE = 'SCORE_HISTORY_UPDATE',
}

export enum PortNameEnum {
  CONTENT_BACKGROUND = 'content-background',
  DEVTOOLS_BACKGROUND = 'devtools-background',
  POPUP_BACKGROUND = 'popup-background',
  PANEL_BACKGROUND = 'react-perf-profiler-panel',
}

// Timing Constants
export const TIMING = {
  UI_DEBOUNCE_MS: 16,
  COMMIT_THROTTLE_MS: 50,
  ANALYSIS_TIMEOUT_MS: 30000,
  AUTO_SAVE_INTERVAL_MS: 5000,
  MESSAGE_TIMEOUT_MS: 5000,
  CONNECTION_POLL_MS: 1000,
  ANIMATION_DURATION_MS: 200,
  TOOLTIP_DELAY_MS: 300,
} as const;

// Performance Scoring
export const MAX_PERFORMANCE_SCORE = 100;
export const MIN_PERFORMANCE_SCORE = 0;

export const PERFORMANCE_SCORE_WEIGHTS = {
  WASTED_RENDER: 0.35,
  MEMOIZATION: 0.25,
  RENDER_TIME: 0.25,
  COMPONENT_COUNT: 0.15,
} as const;

// UI Layout
export const DEFAULT_SIDEBAR_WIDTH = 280;
export const DEFAULT_DETAIL_PANEL_WIDTH = 400;

// Fiber Tag Names
export const FIBER_TAG_NAMES: Record<number, string> = {
  0: 'FunctionComponent',
  1: 'ClassComponent',
  2: 'IndeterminateComponent',
  3: 'HostRoot',
  4: 'HostPortal',
  5: 'HostComponent',
  6: 'HostText',
  7: 'Fragment',
  8: 'Mode',
  9: 'ContextConsumer',
  10: 'ContextProvider',
  11: 'ForwardRef',
  12: 'Profiler',
  13: 'SuspenseComponent',
  14: 'MemoComponent',
  15: 'SimpleMemoComponent',
  16: 'LazyComponent',
  17: 'IncompleteClassComponent',
  18: 'DehydratedFragment',
  19: 'SuspenseListComponent',
  21: 'ScopeComponent',
  22: 'OffscreenComponent',
  23: 'LegacyHiddenComponent',
  24: 'CacheComponent',
  25: 'TracingMarkerComponent',
};

// Export
export const EXPORT_FORMATS = {
  json: { extension: '.json', mimeType: 'application/json', description: 'JSON format' },
  csv: { extension: '.csv', mimeType: 'text/csv', description: 'CSV format' },
  html: { extension: '.html', mimeType: 'text/html', description: 'HTML Report' },
  cpuprofile: { extension: '.cpuprofile', mimeType: 'application/json', description: 'Chrome CPU Profile' },
} as const;

// Frame Budget
export const FRAME_BUDGET = {
  MS: 16,
  SLOW_RENDER_THRESHOLD_MS: 16,
} as const;

// Colors
export const COLORS = {
  severity: { critical: '#DC2626', warning: '#F59E0B', info: '#3B82F6' },
  action: { memo: '#8B5CF6', useMemo: '#10B981', useCallback: '#06B6D4', colocate: '#F97316', none: '#6B7280' },
  chart: { primary: '#3B82F6', secondary: '#8B5CF6', tertiary: '#10B981', quaternary: '#F59E0B', quinary: '#EC4899', senary: '#06B6D4' },
  fiberTag: { function: '#3B82F6', class: '#8B5CF6', memo: '#10B981', forwardRef: '#F59E0B', host: '#6B7280', context: '#EC4899', suspense: '#DC2626', fragment: '#06B6D4', portal: '#F97316' },
} as const;

// Data Format
export const DATA_FORMAT_VERSION = 1;

export const STORAGE_LIMITS = {
  MAX_ITEM_SIZE: 5 * 1024 * 1024,
  MAX_TOTAL_SIZE: 8 * 1024 * 1024,
  MAX_COMPONENT_NAME_LENGTH: 256,
  MAX_PROP_CHANGES: 100,
  MAX_FIBER_DEPTH: 500,
  MAX_RENDER_DURATION_MS: 10000,
} as const;

// Memo Analysis
export const MEMO_EFFECTIVENESS_DEFAULT_THRESHOLD = 0.7;
export const MEMO_MIN_RENDERS_DEFAULT = 3;
export const MEMO_STABILITY_THRESHOLD_DEFAULT = 0.2;

// Retry Constants
export const RETRY_CONSTANTS = {
  MAX_RETRY_ATTEMPTS: 5,
  INITIAL_RETRY_DELAY: 500,
  MAX_RETRY_DELAY_MS: 30000,
  BACKOFF_BASE: 2,
} as const;
