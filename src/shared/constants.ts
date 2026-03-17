/**
 * Constants for React Perf Profiler
 * Contains default configurations, thresholds, colors, and storage keys
 */

import type { ProfilerConfig, Severity, Theme } from './types';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default profiler configuration values
 */
export const DEFAULT_PROFILER_CONFIG: ProfilerConfig = {
  /** Default: Store up to 100 commits in memory */
  maxCommits: 100,
  /** Default: Process up to 1000 nodes per commit */
  maxNodesPerCommit: 1000,
  /** Default: Use 2 Web Workers for analysis */
  analysisWorkerCount: 2,
  /** Default: Enable time-travel debugging */
  enableTimeTravel: true,
  /** Default: Flag renders with > 30% waste rate */
  wastedRenderThreshold: 30,
};

/**
 * Maximum values for configuration bounds
 */
export const CONFIG_LIMITS = {
  /** Maximum commits allowed (to prevent memory issues) */
  maxCommits: { min: 10, max: 1000 },
  /** Maximum nodes per commit allowed */
  maxNodesPerCommit: { min: 100, max: 10000 },
  /** Maximum worker count allowed */
  analysisWorkerCount: { min: 1, max: 8 },
  /** Wasted render threshold bounds */
  wastedRenderThreshold: { min: 5, max: 95 },
} as const;

// ============================================================================
// Severity Thresholds
// ============================================================================

/**
 * Thresholds for determining severity of wasted render issues
 * Based on percentage of wasted renders
 */
export const SEVERITY_THRESHOLDS: Record<Severity, { min: number; max: number }> = {
  /** Critical: > 70% of renders are wasted */
  critical: { min: 70, max: 100 },
  /** Warning: 30-70% of renders are wasted */
  warning: { min: 30, max: 69.99 },
  /** Info: < 30% of renders are wasted */
  info: { min: 0, max: 29.99 },
};

/**
 * Thresholds for determining severity based on estimated time savings
 * Values in milliseconds
 */
export const SAVINGS_THRESHOLDS_MS = {
  /** Critical if fixing saves > 100ms per render */
  critical: 100,
  /** Warning if fixing saves 20-100ms per render */
  warning: 20,
  /** Info if fixing saves < 20ms per render */
  info: 0,
} as const;

/**
 * Memoization effectiveness thresholds
 */
export const MEMO_EFFECTIVENESS_THRESHOLDS = {
  /** Excellent hit rate: >= 80% */
  excellent: 80,
  /** Good hit rate: 60-79% */
  good: 60,
  /** Poor hit rate: 40-59% */
  poor: 40,
  /** Ineffective hit rate: < 40% */
  ineffective: 0,
} as const;

// ============================================================================
// Color Codes (for UI)
// ============================================================================

/**
 * Color palette for the profiler UI
 * Hex colors with proper contrast ratios
 */
export const COLORS = {
  // Severity colors
  severity: {
    critical: '#DC2626', // Red 600
    warning: '#F59E0B',  // Amber 500
    info: '#3B82F6',     // Blue 500
  },
  // Action colors
  action: {
    memo: '#8B5CF6',      // Violet 500
    useMemo: '#10B981',   // Emerald 500
    useCallback: '#06B6D4', // Cyan 500
    colocate: '#F97316',  // Orange 500
    none: '#6B7280',      // Gray 500
  },
  // Chart colors (for flame graphs, etc.)
  chart: {
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    tertiary: '#10B981',
    quaternary: '#F59E0B',
    quinary: '#EC4899',
    senary: '#06B6D4',
  },
  // Neutral colors
  neutral: {
    white: '#FFFFFF',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
    black: '#000000',
  },
  // Fiber tag colors (for component type identification)
  fiberTag: {
    function: '#3B82F6',     // Blue
    class: '#8B5CF6',        // Violet
    memo: '#10B981',         // Emerald
    forwardRef: '#F59E0B',   // Amber
    host: '#6B7280',         // Gray
    context: '#EC4899',      // Pink
    suspense: '#DC2626',     // Red
    fragment: '#06B6D4',     // Cyan
    portal: '#F97316',       // Orange
  },
} as const;

/**
 * Dark theme configuration
 */
export const DARK_THEME: Theme = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#3B82F6',
  background: {
    primary: '#111827',
    secondary: '#1F2937',
    tertiary: '#374151',
  },
  text: {
    primary: '#F9FAFB',
    secondary: '#D1D5DB',
    muted: '#9CA3AF',
  },
  border: '#374151',
};

/**
 * Light theme configuration
 */
export const LIGHT_THEME: Theme = {
  primary: '#2563EB',
  secondary: '#7C3AED',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',
  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
  },
  text: {
    primary: '#111827',
    secondary: '#4B5563',
    muted: '#6B7280',
  },
  border: '#E5E7EB',
};

// ============================================================================
// Storage Keys
// ============================================================================

/**
 * Chrome storage keys for persisting data
 */
export const STORAGE_KEYS = {
  /** Key for profiler configuration */
  CONFIG: 'react-perf-profiler:config',
  /** Key for saved commits */
  COMMITS: 'react-perf-profiler:commits',
  /** Key for component metrics */
  METRICS: 'react-perf-profiler:metrics',
  /** Key for analysis reports */
  REPORTS: 'react-perf-profiler:reports',
  /** Key for user preferences */
  PREFERENCES: 'react-perf-profiler:preferences',
  /** Key for theme setting */
  THEME: 'react-perf-profiler:theme',
  /** Key for last used filters */
  FILTERS: 'react-perf-profiler:filters',
  /** Key for sort configuration */
  SORT_CONFIG: 'react-perf-profiler:sort-config',
  /** Key for column visibility */
  COLUMN_VISIBILITY: 'react-perf-profiler:column-visibility',
  /** Key for onboarding state */
  ONBOARDING_COMPLETE: 'react-perf-profiler:onboarding-complete',
  /** Key for dismissed notifications */
  DISMISSED_NOTIFICATIONS: 'react-perf-profiler:dismissed-notifications',
  /** Key for export history */
  EXPORT_HISTORY: 'react-perf-profiler:export-history',
  /** Key for session data (cleared on browser close) */
  SESSION: 'react-perf-profiler:session',
} as const;

/**
 * Session storage keys (not persisted across browser sessions)
 */
export const SESSION_STORAGE_KEYS = {
  /** Current profiling session state */
  PROFILING_STATE: 'profiling-state',
  /** Active tab ID */
  ACTIVE_TAB: 'active-tab',
  /** Pending analysis queue */
  PENDING_ANALYSIS: 'pending-analysis',
  /** Web Worker pool state */
  WORKER_STATE: 'worker-state',
} as const;

// ============================================================================
// Message Type Constants (Enums)
// ============================================================================

/**
 * Message types for extension communication
 * String enum for runtime type safety
 */
export enum MessageTypeEnum {
  COMMIT = 'COMMIT',
  START_PROFILING = 'START_PROFILING',
  STOP_PROFILING = 'STOP_PROFILING',
  CLEAR_DATA = 'CLEAR_DATA',
  GET_DATA = 'GET_DATA',
  COMPONENT_SELECTED = 'COMPONENT_SELECTED',
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
  INIT = 'INIT',
  PING = 'PING',
  PONG = 'PONG',
  ERROR = 'ERROR',
}

/**
 * Port names for long-lived connections
 */
export enum PortNameEnum {
  /** Content script to background connection */
  CONTENT_BACKGROUND = 'content-background',
  /** DevTools panel to background connection */
  DEVTOOLS_BACKGROUND = 'devtools-background',
  /** Popup to background connection */
  POPUP_BACKGROUND = 'popup-background',
  /** Background to native host connection */
  BACKGROUND_NATIVE = 'background-native',
}

/**
 * Severity levels as enum
 */
export enum SeverityEnum {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * Recommended actions as enum
 */
export enum RecommendedActionEnum {
  MEMO = 'memo',
  USE_MEMO = 'useMemo',
  USE_CALLBACK = 'useCallback',
  COLOCATE = 'colocate',
  NONE = 'none',
}

// ============================================================================
// Timing Constants
// ============================================================================

/**
 * Timing constants for various operations
 * Values in milliseconds unless otherwise noted
 */
export const TIMING = {
  /** Debounce delay for UI updates */
  UI_DEBOUNCE_MS: 16, // ~1 frame at 60fps
  /** Throttle delay for commit processing */
  COMMIT_THROTTLE_MS: 50,
  /** Maximum time to wait for analysis */
  ANALYSIS_TIMEOUT_MS: 30000,
  /** Interval for auto-save */
  AUTO_SAVE_INTERVAL_MS: 5000,
  /** Maximum time for message response */
  MESSAGE_TIMEOUT_MS: 5000,
  /** Polling interval for connection status */
  CONNECTION_POLL_MS: 1000,
  /** Animation duration for UI transitions */
  ANIMATION_DURATION_MS: 200,
  /** Tooltip show delay */
  TOOLTIP_DELAY_MS: 300,
} as const;

// ============================================================================
// Data Format Constants
// ============================================================================

/**
 * Current data format version for persisted data
 * Increment when making breaking changes to storage format
 */
export const DATA_FORMAT_VERSION = 1;

/**
 * Maximum limits for data storage
 */
export const STORAGE_LIMITS = {
  /** Maximum size of a single storage item (bytes) - Chrome limit is ~8MB */
  MAX_ITEM_SIZE: 5 * 1024 * 1024, // 5MB
  /** Maximum total storage size (bytes) */
  MAX_TOTAL_SIZE: 8 * 1024 * 1024, // 8MB
  /** Maximum characters for component names */
  MAX_COMPONENT_NAME_LENGTH: 256,
  /** Maximum number of prop changes to store per component */
  MAX_PROP_CHANGES: 100,
  /** Maximum depth for fiber tree traversal */
  MAX_FIBER_DEPTH: 500,
  /** Maximum duration for a single render (ms) - renders taking longer are considered anomalous */
  MAX_RENDER_DURATION_MS: 10000,
} as const;

// ============================================================================
// Fiber Tag Display Names
// ============================================================================

/**
 * Human-readable names for fiber tags
 */
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
  12: 'SimpleMemoComponent',
  13: 'LazyComponent',
  14: 'IncompleteClassComponent',
  15: 'SuspenseComponent',
  16: 'SuspenseListComponent',
  21: 'MemoComponent',
};

// ============================================================================
// File Export Constants
// ============================================================================

/**
 * Supported export formats
 */
export const EXPORT_FORMATS = {
  json: {
    extension: '.json',
    mimeType: 'application/json',
    description: 'JSON format',
  },
  csv: {
    extension: '.csv',
    mimeType: 'text/csv',
    description: 'CSV format',
  },
  html: {
    extension: '.html',
    mimeType: 'text/html',
    description: 'HTML Report',
  },
} as const;

/**
 * Default filenames for exports
 */
export const DEFAULT_EXPORT_FILENAMES = {
  json: 'react-perf-profile',
  csv: 'react-perf-metrics',
  html: 'react-perf-report',
} as const;
