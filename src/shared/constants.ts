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
  /** Default: Store up to 1000 component entries in LRU cache */
  maxComponentDataEntries: 1000,
  /** Default: 20% threshold for wasted renders */
  wastedRenderThreshold: 20,
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
  /** High: 50-70% of renders are wasted */
  high: { min: 50, max: 69.99 },
  /** Medium: 30-50% of renders are wasted */
  medium: { min: 30, max: 49.99 },
  /** Low: < 30% of renders are wasted */
  low: { min: 0, max: 29.99 },
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
 * Render duration severity thresholds (milliseconds)
 * Used for consistent severity classification across the UI
 * Based on 60fps frame budget (16.67ms per frame)
 */
export const RENDER_SEVERITY_MS = {
  /** Critical: >= 16ms (exceeds 60fps frame budget) */
  CRITICAL: 16,
  /** Warning: >= 8ms (approaching frame budget) */
  WARNING: 8,
  /** Info: >= 2ms (minor but notable) */
  INFO: 2,
} as const;

export type RenderSeverity = 'critical' | 'warning' | 'info' | 'none';

/**
 * Get severity level from render duration
 * @param durationMs - Render duration in milliseconds
 * @returns Severity level: 'critical', 'warning', 'info', or 'none'
 */
export function getRenderSeverity(durationMs: number): RenderSeverity {
  if (durationMs >= RENDER_SEVERITY_MS.CRITICAL) return 'critical';
  if (durationMs >= RENDER_SEVERITY_MS.WARNING) return 'warning';
  if (durationMs >= RENDER_SEVERITY_MS.INFO) return 'info';
  return 'none';
}

/**
 * Get color for render severity level
 * @param severity - Severity level
 * @returns CSS color value
 */
export function getRenderSeverityColor(severity: RenderSeverity): string {
  switch (severity) {
    case 'critical':
      return 'var(--severity-critical, #dc2626)';
    case 'warning':
      return 'var(--severity-warning, #f59e0b)';
    case 'info':
      return 'var(--severity-info, #3b82f6)';
    default:
      return 'var(--text-secondary, #9ca3af)';
  }
}

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
    warning: '#F59E0B', // Amber 500
    info: '#3B82F6', // Blue 500
  },
  // Action colors
  action: {
    memo: '#8B5CF6', // Violet 500
    useMemo: '#10B981', // Emerald 500
    useCallback: '#06B6D4', // Cyan 500
    colocate: '#F97316', // Orange 500
    none: '#6B7280', // Gray 500
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
    function: '#3B82F6', // Blue
    class: '#8B5CF6', // Violet
    memo: '#10B981', // Emerald
    forwardRef: '#F59E0B', // Amber
    host: '#6B7280', // Gray
    context: '#EC4899', // Pink
    suspense: '#DC2626', // Red
    fragment: '#06B6D4', // Cyan
    portal: '#F97316', // Orange
  },
} as const;

/**
 * Dark theme configuration
 */
export const DARK_THEME: Theme = 'dark';

/**
 * Light theme configuration
 */
export const LIGHT_THEME: Theme = 'light';

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
  /** Panel to background connection */
  PANEL_BACKGROUND = 'react-perf-profiler-panel',
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
 * Matches React 18 fiber tag constants
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

// ============================================================================
// Performance Scoring Constants
// ============================================================================

/**
 * Maximum possible performance score
 */
export const MAX_PERFORMANCE_SCORE = 100;

/**
 * Minimum possible performance score
 */
export const MIN_PERFORMANCE_SCORE = 0;

/**
 * Score calculation weights and multipliers for render time scoring
 * 
 * Formula: score = MAX_SCORE - (avgRenderTime * RENDER_TIME_MULTIPLIER)
 * 
 * The multiplier of 5 means:
 * - 20ms average render time = 0 points (unacceptable performance)
 * - 10ms average render time = 50 points (poor performance)
 * - 5ms average render time = 75 points (good performance)
 * - 2ms average render time = 90 points (excellent performance)
 */
export const RENDER_TIME_SCORE = {
  /** Multiplier for converting average render time to score penalty */
  MULTIPLIER: 5,
  /** Threshold where render time becomes problematic (ms) */
  WARNING_THRESHOLD: 10,
  /** Threshold where render time is critical (ms) */
  CRITICAL_THRESHOLD: 20,
} as const;

/**
 * Score calculation for wasted render rate
 * 
 * Formula: score = MAX_SCORE - (wastedRenderRate * WASTED_RENDER_MULTIPLIER)
 * 
 * The multiplier of 2 means:
 * - 50% wasted renders = 0 points (unacceptable - half of renders are wasted)
 * - 25% wasted renders = 50 points (poor performance)
 * - 10% wasted renders = 80 points (good performance)
 */
export const WASTED_RENDER_SCORE = {
  /** Multiplier for converting wasted render rate to score penalty */
  MULTIPLIER: 2,
  /** Threshold where wasted renders become problematic (%) */
  WARNING_THRESHOLD: 25,
  /** Threshold where wasted renders are critical (%) */
  CRITICAL_THRESHOLD: 50,
} as const;

/**
 * Score calculation for component count complexity
 * 
 * Formula: score = clamp(MIN_BASELINE, MAX_SCORE - (totalComponents / DIVISOR), MAX_SCORE)
 * 
 * The divisor of 10 means:
 * - 1000 components = 0 points added to baseline (extremely complex)
 * - 500 components = 50 points (complex)
 * - 100 components = 90 points (manageable)
 */
export const COMPONENT_COUNT_SCORE = {
  /** Divisor for scaling component count to score */
  DIVISOR: 10,
  /** Minimum baseline score regardless of component count */
  MIN_BASELINE: 20,
  /** Maximum number of components before hitting minimum baseline */
  MAX_COMPONENTS_BEFORE_MIN: 800,
} as const;

/**
 * Score calculation for render duration analysis
 * 
 * Used in calculateRenderDurationScore:
 * Formula: score = max(0, MAX_SCORE - (averageDuration / REFERENCE_MS) * PENALTY_MULTIPLIER)
 * 
 * Reference of 8ms means:
 * - 8ms average duration = full score (excellent - well within 16ms frame budget)
 * - 16ms average duration = 60 points (acceptable - using full frame budget)
 * - 40ms average duration = 0 points (unacceptable - multiple frame drops)
 */
export const RENDER_DURATION_SCORE = {
  /** Reference duration for scoring baseline (ms) - 8ms allows for overhead within 16ms frame */
  REFERENCE_MS: 8,
  /** Penalty multiplier for exceeding reference duration */
  PENALTY_MULTIPLIER: 20,
  /** Threshold for slow render classification (ms) */
  SLOW_RENDER_THRESHOLD: 16,
} as const;

/**
 * Score calculation for component count scoring (alternative formula)
 * 
 * Formula: score = max(0, round(MAX_SCORE - excessRatio * PENALTY_MULTIPLIER))
 * 
 * Used when component count exceeds a threshold, to penalize excess complexity
 */
export const COMPONENT_COMPLEXITY_SCORE = {
  /** Default threshold for "too many components" */
  DEFAULT_THRESHOLD: 500,
  /** Penalty multiplier for each unit of excess beyond threshold */
  EXCESS_PENALTY_MULTIPLIER: 50,
} as const;

/**
 * Penalty deductions for RSC (React Server Components) analysis issues
 * 
 * These are subtracted from the base score based on issue severity
 */
export const RSC_ISSUE_PENALTIES = {
  /** Deduction for each critical severity issue */
  CRITICAL: 15,
  /** Deduction for each high severity issue */
  HIGH: 10,
  /** Deduction for each medium severity issue */
  MEDIUM: 5,
  /** Deduction for each low severity issue */
  LOW: 0,
} as const;

/**
 * RSC payload scoring constants
 */
export const RSC_PAYLOAD_SCORE = {
  /** Size threshold in MB where payload size becomes problematic */
  SIZE_THRESHOLD_MB: 1,
  /** Maximum penalty for large payload size */
  MAX_SIZE_PENALTY: 30,
  /** Multiplier for payload size penalty (penalty = sizeInMB * MULTIPLIER) */
  SIZE_MULTIPLIER: 10,
  /** Multiplier for cache miss penalty (penalty = (1 - hitRatio) * MULTIPLIER) */
  CACHE_MISS_MULTIPLIER: 20,
} as const;

/**
 * Score calculation for wasted render analysis
 * 
 * Formula: score = max(0, round(MAX_SCORE - avgWastedRate))
 * 
 * This is a 1:1 penalty - each percentage point of wasted renders reduces score by 1
 */
export const WASTED_RENDER_ANALYSIS_SCORE = {
  /** 1:1 penalty for wasted render percentage */
  PENALTY_RATE: 1,
} as const;

/**
 * Default weights for performance score calculation
 * Must sum to 1.0 (100%)
 * 
 * These weights determine how much each category contributes to the overall score:
 * - Wasted renders: 35% (highest priority - direct performance impact)
 * - Memoization: 25% (important for preventing unnecessary work)
 * - Render time: 25% (actual user-perceived performance)
 * - Component count: 15% (complexity factor)
 */
export const PERFORMANCE_SCORE_WEIGHTS = {
  /** Weight for wasted render category (35%) */
  WASTED_RENDER: 0.35,
  /** Weight for memoization effectiveness category (25%) */
  MEMOIZATION: 0.25,
  /** Weight for render time category (25%) */
  RENDER_TIME: 0.25,
  /** Weight for component count category (15%) */
  COMPONENT_COUNT: 0.15,
} as const;

/**
 * Thresholds for performance score calculations
 */
export const PERFORMANCE_SCORE_THRESHOLDS = {
  /** Hit rate threshold below which memoization is considered ineffective (50%) */
  LOW_HIT_RATE: 0.5,
  /** Impact threshold above which issues are considered critical (70%) */
  CRITICAL_IMPACT: 0.7,
  /** Number of problematic components before max adjustment (5) */
  MAX_PROBLEMATIC_COMPONENTS: 5,
  /** Base score multiplier for normalization (70%) */
  BASE_MULTIPLIER: 0.7,
  /** Adjustment range for normalization (30%) */
  ADJUSTMENT_RANGE: 0.3,
} as const;

/**
 * Severity order for sorting issues
 * Higher number = higher severity
 */
export const SEVERITY_ORDER = {
  critical: 3,
  warning: 2,
  info: 1,
} as const;

/**
 * Issue counting thresholds for performance scoring
 */
export const ISSUE_COUNT_THRESHOLDS = {
  /** Divisor for calculating component weight from issue count */
  WEIGHT_DIVISOR: 3,
  /** Threshold for warning severity based on issue count */
  WARNING_MIN_ISSUES: 3,
} as const;

/**
 * Render time thresholds for issue classification (in ms)
 */
export const RENDER_TIME_THRESHOLDS = {
  /** Critical threshold for slow renders (>100ms) */
  CRITICAL_MS: 100,
  /** Warning threshold for slow renders (>50ms) */
  WARNING_MS: 50,
} as const;

/**
 * Component count multiplier for severity calculation
 */
export const COMPONENT_COUNT_MULTIPLIER = {
  /** Multiplier for critical severity threshold */
  CRITICAL: 2,
} as const;

/**
 * Performance score penalty weights for different issue types
 * 
 * Used in performanceScore.ts to calculate deductions from the base score
 * based on severity and issue categories
 */
export const PERFORMANCE_SCORE_PENALTIES = {
  /** Wasted render severity penalties - multiplied by wasted render rate */
  wastedRender: {
    /** Critical severity: highest penalty for severe wasted render issues */
    CRITICAL: 15,
    /** Warning severity: moderate penalty for noticeable wasted render issues */
    WARNING: 8,
    /** Info severity: minimal penalty for minor wasted render issues */
    INFO: 3,
    /** Minimum penalty for info severity (ensures score < 100 even for minor issues) */
    INFO_MIN: 1,
  },
  /** Memoization effectiveness penalties - multiplied by component weight */
  memoization: {
    /** Penalty for components that should have memo but don't */
    MISSING_MEMO: 10,
    /** Penalty for components with memo that isn't effective */
    INEFFECTIVE_MEMO: 15,
    /** Penalty multiplier for low hit rate (multiplied by (1 - hitRate)) */
    LOW_HIT_RATE: 10,
  },
} as const;

/**
 * Thresholds for wasted render opportunities and impact classification
 */
export const WASTED_RENDER_THRESHOLDS = {
  /** Minimum wasted render rate to be considered an opportunity (%) */
  OPPORTUNITY_MIN: 20,
  /** Threshold for high impact classification (%) */
  HIGH_IMPACT: 50,
  /** Maximum number of top opportunities to display */
  TOP_OPPORTUNITIES_LIMIT: 5,
} as const;

/**
 * Frame budget constants for 60fps performance target
 * 
 * At 60fps, each frame has 16.67ms to render.
 * We use 16ms as a practical threshold for identifying performance issues.
 */
export const FRAME_BUDGET = {
  /** Target frame duration for 60fps in milliseconds (1000ms / 60 frames) */
  MS: 16,
  /** Frame duration threshold for identifying slow renders */
  SLOW_RENDER_THRESHOLD_MS: 16,
} as const;

/**
 * Frame timing constants for render performance
 */
export const FRAME_TIMING = {
  /** Target frame duration for 60fps (ms) - 1000ms / 60 frames */
  FRAME_BUDGET_MS: 16.67,
  /** Commonly used approximation of frame budget (ms) */
  FRAME_BUDGET_APPROXIMATE_MS: 16,
  /** Number of milliseconds in one second */
  MS_PER_SECOND: 1000,
  /** Target frames per second */
  TARGET_FPS: 60,
} as const;

/**
 * Binary size constants for calculations
 */
export const BINARY_SIZE = {
  /** Bytes per kilobyte */
  BYTES_PER_KB: 1024,
  /** Bytes per megabyte */
  BYTES_PER_MB: 1024 * 1024,
} as const;

/**
 * Time duration constants (in milliseconds)
 */
export const TIME_DURATION = {
  /** One second in milliseconds */
  SECOND: 1000,
  /** One minute in milliseconds */
  MINUTE: 60 * 1000,
  /** Five minutes in milliseconds */
  FIVE_MINUTES: 5 * 60 * 1000,
  /** Maximum exponential backoff delay (ms) */
  MAX_BACKOFF_DELAY_MS: 30000,
} as const;

/**
 * Percentage calculation constants
 */
export const PERCENTAGE = {
  /** Full percentage (100%) */
  FULL: 100,
  /** Half percentage (50%) */
  HALF: 50,
  /** Quarter percentage (25%) */
  QUARTER: 25,
  /** Multiplier to convert ratio to percentage */
  RATIO_TO_PERCENT: 100,
} as const;

/**
 * Retry and polling constants
 */
export const RETRY_CONSTANTS = {
  /** Base multiplier for exponential backoff */
  BACKOFF_BASE: 2,
} as const;

/**
 * Random variation constants for simulations
 */
export const RANDOM_VARIATION = {
  /** Small random range for progress increments */
  PROGRESS_INCREMENT_MAX: 5,
} as const;

// ============================================================================
// External URLs
// ============================================================================

/**
 * GitHub repository URL for issue reporting
 * Can be overridden via environment variable VITE_GITHUB_REPO_URL
 */
export const GITHUB_REPO_URL = 
  import.meta.env?.['VITE_GITHUB_REPO_URL'] || 
  'https://github.com/react-perf-profiler/react-perf-profiler';

/**
 * Generic issue reporting URL (fallback when GitHub is unavailable)
 */
export const GENERIC_ISSUE_REPORT_URL =
  import.meta.env?.['VITE_ISSUE_REPORT_URL'] ||
  'https://react-perf-profiler.github.io/support';

// ============================================================================
// UI Layout Constants
// ============================================================================

/**
 * Default width of the sidebar panel in pixels
 */
export const DEFAULT_SIDEBAR_WIDTH = 280;

/**
 * Default width of the detail panel in pixels
 */
export const DEFAULT_DETAIL_PANEL_WIDTH = 400;

// ============================================================================
// Keyboard Shortcut Constants
// ============================================================================

/**
 * Duration (ms) to show shortcut feedback indicator before hiding it
 */
export const SHORTCUT_FEEDBACK_TIMEOUT_MS = 2000;

// ============================================================================
// Memoization Analysis Constants
// ============================================================================

/**
 * Default threshold for considering memo effective (0-1)
 * A hit rate above this value means memo is working well
 */
export const MEMO_EFFECTIVENESS_DEFAULT_THRESHOLD = 0.7;

/**
 * Minimum render count before analyzing a component for memo effectiveness
 */
export const MEMO_MIN_RENDERS_DEFAULT = 3;

/**
 * Stability threshold below which a prop is considered stable (0-1)
 * Change frequency below this means prop rarely changes
 */
export const MEMO_STABILITY_THRESHOLD_DEFAULT = 0.2;

// ============================================================================
// RSC Parser Constants
// ============================================================================

/**
 * Prop size threshold in bytes above which crossing a server/client boundary
 * is flagged as potentially problematic (50KB)
 */
export const RSC_LARGE_PROPS_THRESHOLD_BYTES = 50 * 1024;

// ============================================================================
// RSC Worker Threshold Constants
// ============================================================================

/**
 * RSC cache hit ratio thresholds for issue severity classification
 */
export const RSC_CACHE_HIT_THRESHOLDS = {
  /** Cache hit ratio below this is classified as 'critical' severity */
  CRITICAL: 0.5,
} as const;

/**
 * RSC client boundary count thresholds
 */
export const RSC_BOUNDARY_THRESHOLDS = {
  /** Maximum client boundaries before flagging as a concern */
  MAX_CLIENT_BOUNDARIES: 5,
} as const;

/**
 * RSC serialization cost thresholds in milliseconds
 */
export const RSC_SERIALIZATION_THRESHOLDS = {
  /** Cost above this triggers a warning-level issue (ms) */
  WARNING_MS: 10,
  /** Cost above this triggers a high-severity issue (ms) */
  HIGH_MS: 50,
} as const;
