/**
 * Plugin System Types
 * @module panel/plugins/types
 *
 * Defines the core interfaces and types for the React Perf Profiler plugin system.
 * Plugins can extend profiler functionality with custom analysis, UI panels, and data processing.
 *
 * @example
 * ```typescript
 * import type { AnalysisPlugin, PluginContext, PluginAPI } from './types';
 *
 * const myPlugin: AnalysisPlugin = {
 *   metadata: { id: 'com.example.plugin', name: 'My Plugin', version: '1.0.0' },
 *   hooks: {
 *     onCommit: (commit, api, context) => {
 *       context.log('info', 'Commit captured', commit.id);
 *     }
 *   }
 * };
 * ```
 */

import type { CommitData, AnalysisResult, FiberNode } from '@/shared/types';
import type { RSCPayload, RSCAnalysisResult } from '@/shared/types/rsc';
import type { ReactNode, ComponentType } from 'react';

// Re-export shared types for convenience
export type { CommitData, AnalysisResult, FiberNode } from '@/shared/types';
export type { RSCPayload, RSCAnalysisResult } from '@/shared/types/rsc';

// =============================================================================
// Plugin Metrics
// =============================================================================

/**
 * Metric contributed by a plugin to be displayed in the metrics panel
 * Plugins can expose custom metrics that will be aggregated and displayed
 *
 * @example
 * ```typescript
 * const metrics: PluginMetric[] = [{
 *   id: 'redux-action-count',
 *   name: 'Redux Actions',
 *   value: 42,
 *   formattedValue: '42 actions',
 *   trend: 'up',
 *   description: 'Total Redux actions dispatched'
 * }];
 * ```
 */
export interface PluginMetric {
  /** Unique metric identifier (should be unique within the plugin) */
  id: string;
  /** Human-readable metric name */
  name: string;
  /** Metric value (can be any type) */
  value: number | string | boolean;
  /** Formatted value for display */
  formattedValue?: string;
  /** Optional unit label */
  unit?: string;
  /** Trend direction for numeric metrics */
  trend?: 'up' | 'down' | 'neutral';
  /** Whether the trend is positive (green) or negative (red) */
  trendPositive?: boolean;
  /** Metric description */
  description?: string;
  /** Metric category for grouping */
  category?: string;
  /** Display priority (lower = higher priority) */
  priority?: number;
  /** Plugin ID that contributed this metric */
  pluginId?: string;
  /** Plugin name that contributed this metric */
  pluginName?: string;
  /** Severity level for metrics that indicate issues */
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

// =============================================================================
// Plugin Metadata
// =============================================================================

/**
 * Plugin metadata and configuration
 * Defines the identity and basic configuration of a plugin
 *
 * @example
 * ```typescript
 * const metadata: PluginMetadata = {
 *   id: 'com.example.my-plugin',
 *   name: 'My Custom Analysis',
 *   version: '1.0.0',
 *   description: 'Analyzes custom performance metrics',
 *   author: 'John Doe',
 *   enabledByDefault: false
 * };
 * ```
 */
export interface PluginMetadata {
  /** Unique plugin identifier (should be reverse-domain format, e.g., 'com.example.my-plugin') */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Plugin homepage/repository URL */
  homepage?: string;
  /** Whether plugin is enabled by default */
  enabledByDefault?: boolean;
  /** Plugin settings schema */
  settingsSchema?: PluginSettingSchema[];
}

/**
 * Plugin setting schema for configuration UI
 * Defines a single setting field that will be rendered in the settings panel
 *
 * @example
 * ```typescript
 * const setting: PluginSettingSchema = {
 *   key: 'maxActions',
 *   name: 'Maximum Actions',
 *   description: 'Maximum number of actions to track',
 *   type: 'number',
 *   defaultValue: 100,
 *   min: 10,
 *   max: 1000
 * };
 * ```
 */
export interface PluginSettingSchema {
  /** Setting key (used to store and retrieve the value) */
  key: string;
  /** Setting display name */
  name: string;
  /** Setting description */
  description?: string;
  /** Setting type (determines the UI control) */
  type: 'string' | 'number' | 'boolean' | 'select' | 'array';
  /** Default value */
  defaultValue?: unknown;
  /** Options for select type */
  options?: { label: string; value: string | number }[];
  /** Whether setting is required */
  required?: boolean;
  /** Validation regex for string type */
  validation?: RegExp;
  /** Min value for number type */
  min?: number;
  /** Max value for number type */
  max?: number;
}

// =============================================================================
// Plugin Context & API
// =============================================================================

/**
 * Shared utilities available to all plugins via context
 * Provides plugin-specific utilities for logging, settings, and events
 *
 * @example
 * ```typescript
 * const context: PluginContext = {
 *   pluginId: 'com.example.plugin',
 *   getSettings: () => ({ maxItems: 100 }),
 *   setSettings: (settings) => { ... },
 *   log: (level, message) => console[level](message),
 *   emit: (event, payload) => { ... },
 *   on: (event, handler) => { ... }
 * };
 * ```
 */
export interface PluginContext {
  /** Current plugin metadata */
  pluginId: string;
  /** Get plugin's own settings */
  getSettings: <T = Record<string, unknown>>() => T;
  /** Update plugin settings */
  setSettings: (settings: Record<string, unknown>) => void;
  /** Log message with plugin prefix */
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: unknown[]) => void;
  /** Emit custom event */
  emit: (eventName: string, payload?: unknown) => void;
  /** Listen to custom events. Returns unsubscribe function. */
  on: (eventName: string, handler: (payload: unknown) => void) => () => void;
}

/**
 * Plugin API for interacting with the profiler
 * Passed to plugin hooks for accessing and modifying profiler state
 *
 * @example
 * ```typescript
 * // Access profiler data
 * const commits = api.getCommits();
 * const results = api.getAnalysisResults();
 *
 * // Store plugin-specific data
 * api.setPluginData('myKey', { foo: 'bar' });
 * const data = api.getPluginData('myKey');
 *
 * // Register UI components
 * api.registerPanel({ id: 'my-panel', title: 'My Panel', component: MyComponent, position: 'sidebar' });
 * ```
 */
export interface PluginAPI {
  // Data Access
  /** Get all captured commits */
  getCommits: () => CommitData[];
  /** Get current analysis results */
  getAnalysisResults: () => AnalysisResult | null;
  /** Get RSC payloads */
  getRSCPayloads: () => RSCPayload[];
  /** Get RSC analysis results */
  getRSCAnalysis: () => RSCAnalysisResult | null;
  /** Get profiler configuration */
  getConfig: () => Record<string, unknown>;
  /** Get currently selected commit */
  getSelectedCommit: () => CommitData | null;
  /** Get currently selected component */
  getSelectedComponent: () => string | null;
  /** Check if currently recording */
  isRecording: () => boolean;

  // Data Contribution
  /** Add custom analysis data */
  setPluginData: <T = unknown>(key: string, data: T) => void;
  /** Get previously stored plugin data */
  getPluginData: <T = unknown>(key: string) => T | undefined;
  /** Remove plugin data */
  removePluginData: (key: string) => void;
  /** Clear all plugin data for this plugin */
  clearPluginData: () => void;

  // UI Integration
  /** Register a custom panel. Returns unregister function. */
  registerPanel: (panel: PluginPanel) => () => void;
  /** Show notification */
  showNotification: (notification: PluginNotification) => void;
  /** Register a context menu item. Returns unregister function. */
  registerContextMenuItem: (item: PluginContextMenuItem) => () => void;

  // Actions
  /** Run analysis with current data */
  runAnalysis: () => Promise<void>;
  /** Export data with plugin contributions */
  exportData: () => string;
  /** Navigate to specific commit */
  selectCommit: (commitId: string) => void;
  /** Navigate to specific component */
  selectComponent: (componentName: string) => void;

  // Utilities
  /** Get fiber node by ID */
  getFiberNode: (commitId: string, nodeId: number) => FiberNode | undefined;
  /** Walk fiber tree */
  walkFiberTree: (
    commitId: string,
    callback: (node: FiberNode, depth: number) => boolean | void
  ) => void;
  /** Debounce function */
  debounce: <T extends (...args: unknown[]) => unknown>(
    fn: T,
    ms: number
  ) => (...args: Parameters<T>) => ReturnType<T>;
  /** Throttle function */
  throttle: <T extends (...args: unknown[]) => unknown>(
    fn: T,
    ms: number
  ) => (...args: Parameters<T>) => ReturnType<T>;
}

// =============================================================================
// Plugin Hooks
// =============================================================================

/**
 * Hook called when a new commit is captured during profiling
 * Allows plugins to observe and transform commit data
 *
 * @param commit - The captured commit data
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 * @returns Modified commit data or void (to transform the commit)
 *
 * @example
 * ```typescript
 * onCommit: (commit, api, context) => {
 *   context.log('info', 'New commit', commit.id);
 *   // Optionally transform and return modified commit
 *   return { ...commit, customData: true };
 * }
 * ```
 */
export type OnCommitHook = (
  commit: CommitData,
  api: PluginAPI,
  context: PluginContext
) => CommitData | void | Promise<CommitData | void>;

/**
 * Hook called when analysis phase completes
 * Plugins can contribute to analysis results and expose metrics
 *
 * @param result - The completed analysis result
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 * @returns Plugin metrics to be displayed, or void
 *
 * @example
 * ```typescript
 * onAnalysisComplete: (result, api, context) => {
 *   return [
 *     { id: 'custom-metric', name: 'Custom Metric', value: 42 }
 *   ];
 * }
 * ```
 */
export type OnAnalysisCompleteHook = (
  result: AnalysisResult,
  api: PluginAPI,
  context: PluginContext
) => PluginMetric[] | void | Promise<PluginMetric[] | void>;

/**
 * Hook called during analysis phase
 * Plugins can contribute to analysis results
 *
 * @param commits - Array of all captured commits
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 * @returns Partial analysis results to merge, or void
 *
 * @example
 * ```typescript
 * onAnalyze: (commits, api, context) => {
 *   const customMetric = calculateMetric(commits);
 *   return { customMetric };
 * }
 * ```
 */
export type OnAnalyzeHook = (
  commits: CommitData[],
  api: PluginAPI,
  context: PluginContext
) => Partial<AnalysisResult> | void | Promise<Partial<AnalysisResult> | void>;

/**
 * Hook called when exporting data
 * Plugins can contribute their data to the export
 *
 * @param exportData - Current export data object
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 * @returns Modified export data or void
 *
 * @example
 * ```typescript
 * onExport: (data, api, context) => {
 *   return {
 *     ...data,
 *     myPlugin: api.getPluginData('myData')
 *   };
 * }
 * ```
 */
export type OnExportHook = (
  exportData: Record<string, unknown>,
  api: PluginAPI,
  context: PluginContext
) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;

/**
 * Hook called when importing data
 * Plugins can restore their state from imported data
 *
 * @param importData - Imported data object
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 *
 * @example
 * ```typescript
 * onImport: (data, api, context) => {
 *   if (data.myPlugin) {
 *     api.setPluginData('myData', data.myPlugin);
 *   }
 * }
 * ```
 */
export type OnImportHook = (
  importData: Record<string, unknown>,
  api: PluginAPI,
  context: PluginContext
) => void | Promise<void>;

/**
 * Hook called when a new RSC payload is received
 *
 * @param payload - The RSC payload
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 * @returns Modified payload or void
 */
export type OnRSCPayloadHook = (
  payload: RSCPayload,
  api: PluginAPI,
  context: PluginContext
) => RSCPayload | void | Promise<RSCPayload | void>;

/**
 * Hook called when RSC analysis completes
 *
 * @param result - The RSC analysis result
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 * @returns Partial RSC analysis results to merge, or void
 */
export type OnRSCAnalyzeHook = (
  result: RSCAnalysisResult,
  api: PluginAPI,
  context: PluginContext
) => Partial<RSCAnalysisResult> | void | Promise<Partial<RSCAnalysisResult> | void>;

/**
 * Hook called when plugin is enabled
 *
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 *
 * @example
 * ```typescript
 * onEnable: async (api, context) => {
 *   context.log('info', 'Plugin enabled');
 *   api.setPluginData('initialized', true);
 * }
 * ```
 */
export type OnEnableHook = (api: PluginAPI, context: PluginContext) => void | Promise<void>;

/**
 * Hook called when plugin is disabled
 *
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 *
 * @example
 * ```typescript
 * onDisable: async (api, context) => {
 *   context.log('info', 'Plugin disabled');
 *   api.clearPluginData();
 * }
 * ```
 */
export type OnDisableHook = (api: PluginAPI, context: PluginContext) => void | Promise<void>;

/**
 * Hook called when recording starts
 *
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 */
export type OnRecordingStartHook = (api: PluginAPI, context: PluginContext) => void;

/**
 * Hook called when recording stops
 *
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 */
export type OnRecordingStopHook = (api: PluginAPI, context: PluginContext) => void;

/**
 * Hook called when data is cleared
 *
 * @param api - Plugin API for interacting with the profiler
 * @param context - Plugin context for logging and settings
 */
export type OnClearDataHook = (api: PluginAPI, context: PluginContext) => void;

// =============================================================================
// Main Plugin Interface
// =============================================================================

/**
 * Main AnalysisPlugin interface
 * Implement this interface to create a custom profiler plugin
 *
 * Plugins can hook into various lifecycle events, contribute to analysis,
 * and register custom UI panels.
 *
 * @example
 * ```typescript
 * const myPlugin: AnalysisPlugin = {
 *   metadata: {
 *     id: 'com.example.my-plugin',
 *     name: 'My Custom Analysis',
 *     version: '1.0.0',
 *   },
 *   hooks: {
 *     onCommit: (commit, api, ctx) => {
 *       ctx.log('info', 'New commit captured', commit.id);
 *     },
 *     onAnalyze: (commits, api, ctx) => {
 *       return { customMetric: calculateMetric(commits) };
 *     },
 *   },
 *   SettingsComponent: MySettingsComponent,
 * };
 * ```
 */
export interface AnalysisPlugin {
  /** Plugin metadata (id, name, version, etc.) */
  metadata: PluginMetadata;

  /** Plugin hooks for various lifecycle events */
  hooks?: {
    /** Called on each commit during profiling. Can transform commit data. */
    onCommit?: OnCommitHook;
    /** Called during analysis phase. Can contribute to analysis results. */
    onAnalyze?: OnAnalyzeHook;
    /** Called when analysis completes. Return metrics to display. */
    onAnalysisComplete?: OnAnalysisCompleteHook;
    /** Called when exporting data. Can add plugin data to export. */
    onExport?: OnExportHook;
    /** Called when importing data. Can restore plugin state. */
    onImport?: OnImportHook;
    /** Called when RSC payload is received. Can transform payload. */
    onRSCPayload?: OnRSCPayloadHook;
    /** Called during RSC analysis. Can contribute to RSC results. */
    onRSCAnalyze?: OnRSCAnalyzeHook;
    /** Called when plugin is enabled */
    onEnable?: OnEnableHook;
    /** Called when plugin is disabled */
    onDisable?: OnDisableHook;
    /** Called when recording starts */
    onRecordingStart?: OnRecordingStartHook;
    /** Called when recording stops */
    onRecordingStop?: OnRecordingStopHook;
    /** Called when data is cleared */
    onClearData?: OnClearDataHook;
  };

  /**
   * Optional: Get metrics to display in the metrics panel
   * Called when the metrics panel is rendered
   */
  getMetrics?: (api: PluginAPI, context: PluginContext) => PluginMetric[];

  /**
   * Optional: Get UI component for the plugin panel
   * The returned component will be rendered in the plugin panel
   */
  getUI?: (api: PluginAPI, context: PluginContext) => ComponentType<PluginUIProps> | null;

  /** Optional: React component for plugin settings UI */
  SettingsComponent?: ComponentType<{ api: PluginAPI; context: PluginContext }>;

  /** Optional: Destroy function for cleanup when plugin is unregistered */
  destroy?: () => void;
}

/**
 * Props passed to plugin UI components
 */
export interface PluginUIProps {
  /** Plugin API instance */
  api: PluginAPI;
  /** Plugin context instance */
  context: PluginContext;
  /** Current width of the panel */
  width?: number;
  /** Current height of the panel */
  height?: number;
}

// =============================================================================
// UI Types
// =============================================================================

/**
 * Plugin panel definition for custom UI
 * Plugins can register panels to appear in various positions in the UI
 *
 * @example
 * ```typescript
 * const panel: PluginPanel = {
 *   id: 'my-custom-panel',
 *   title: 'Custom Analysis',
 *   icon: 'Chart',
 *   component: MyPanelComponent,
 *   position: 'sidebar',
 *   order: 10
 * };
 * ```
 */
export interface PluginPanel {
  /** Unique panel ID */
  id: string;
  /** Panel title */
  title: string;
  /** Panel icon (IconName) */
  icon?: string;
  /** Panel component */
  component: ReactNode;
  /** Panel position */
  position: 'sidebar' | 'main' | 'detail' | 'modal';
  /** Panel order (lower = first) */
  order?: number;
}

/**
 * Plugin notification
 *
 * @example
 * ```typescript
 * api.showNotification({
 *   type: 'success',
 *   title: 'Analysis Complete',
 *   message: 'Found 3 optimization opportunities',
 *   duration: 5000
 * });
 * ```
 */
export interface PluginNotification {
  /** Notification type */
  type: 'info' | 'success' | 'warning' | 'error';
  /** Notification title */
  title: string;
  /** Notification message */
  message?: string;
  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  duration?: number;
}

/**
 * Plugin context menu item
 *
 * @example
 * ```typescript
 * const menuItem: PluginContextMenuItem = {
 *   id: 'my-action',
 *   label: 'Run Custom Analysis',
 *   icon: 'Play',
 *   onClick: () => { ... },
 *   condition: () => api.getCommits().length > 0
 * };
 * ```
 */
export interface PluginContextMenuItem {
  /** Menu item ID */
  id: string;
  /** Menu item label */
  label: string;
  /** Icon name */
  icon?: string;
  /** Click handler */
  onClick: () => void;
  /** Condition to show item */
  condition?: () => boolean;
  /** Submenu items */
  submenu?: PluginContextMenuItem[];
}

// =============================================================================
// Plugin State
// =============================================================================

/**
 * Plugin state stored in the profiler store
 * Tracks the runtime state of each registered plugin
 */
export interface PluginState {
  /** Whether plugin is currently enabled */
  enabled: boolean;
  /** Plugin settings */
  settings: Record<string, unknown>;
  /** Plugin-contributed data */
  data: Record<string, unknown>;
  /** Plugin panels */
  panels: PluginPanel[];
  /** Registered context menu items */
  contextMenuItems: PluginContextMenuItem[];
  /** Plugin error state */
  error?: string;
  /** When plugin was last enabled */
  enabledAt?: number;
}

/**
 * Map of plugin states by plugin ID
 */
export type PluginStateMap = Map<string, PluginState>;

// =============================================================================
// Hook Execution Result
// =============================================================================

/**
 * Result of executing a plugin hook
 * Used internally by the PluginManager to track hook execution
 */
export interface HookExecutionResult<T> {
  /** Whether hook executed successfully */
  success: boolean;
  /** Plugin ID */
  pluginId: string;
  /** Hook result data */
  data?: T;
  /** Error if hook failed */
  error?: Error;
  /** Execution duration in ms */
  duration: number;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Type for plugin event handlers
 */
export type PluginEventHandler = (payload: unknown) => void;

/**
 * Plugin event map for type-safe events
 * Defines the built-in event types that plugins can listen to
 *
 * @example
 * ```typescript
 * context.on('plugin:enabled', ({ pluginId }) => {
 *   console.log(`Plugin ${pluginId} was enabled`);
 * });
 * ```
 */
export interface PluginEventMap {
  'plugin:enabled': { pluginId: string };
  'plugin:disabled': { pluginId: string };
  'plugin:error': { pluginId: string; error: Error };
  'plugin:data:changed': { pluginId: string; key: string };
  'commit:captured': { commitId: string };
  'analysis:completed': { result: AnalysisResult };
  'recording:started': void;
  'recording:stopped': void;
  'data:cleared': void;
  [key: string]: unknown;
}

/**
 * Extract event payload type from event name
 */
export type PluginEventPayload<T extends keyof PluginEventMap> = PluginEventMap[T];
