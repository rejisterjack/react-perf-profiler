/**
 * Plugin System Types
 * @module panel/plugins/types
 *
 * Defines the core interfaces and types for the React Perf Profiler plugin system.
 * Plugins can extend profiler functionality with custom analysis, UI panels, and data processing.
 */

import type { CommitData, AnalysisResult, FiberNode } from '@/shared/types';
import type { RSCPayload, RSCAnalysisResult } from '@/shared/types/rsc';
import type { ReactNode } from 'react';

// =============================================================================
// Plugin Metadata
// =============================================================================

/**
 * Plugin metadata and configuration
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
 */
export interface PluginSettingSchema {
  /** Setting key */
  key: string;
  /** Setting display name */
  name: string;
  /** Setting description */
  description?: string;
  /** Setting type */
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
  /** Listen to custom events */
  on: (eventName: string, handler: (payload: unknown) => void) => () => void;
}

/**
 * Plugin API for interacting with the profiler
 * Passed to plugin hooks for accessing and modifying profiler state
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
  /** Register a custom panel */
  registerPanel: (panel: PluginPanel) => () => void;
  /** Show notification */
  showNotification: (notification: PluginNotification) => void;
  /** Register a context menu item */
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
 */
export type OnCommitHook = (
  commit: CommitData,
  api: PluginAPI,
  context: PluginContext
) => CommitData | void | Promise<CommitData | void>;

/**
 * Hook called during analysis phase
 * Plugins can contribute to analysis results
 */
export type OnAnalyzeHook = (
  commits: CommitData[],
  api: PluginAPI,
  context: PluginContext
) => Partial<AnalysisResult> | void | Promise<Partial<AnalysisResult> | void>;

/**
 * Hook called when exporting data
 * Plugins can contribute their data to the export
 */
export type OnExportHook = (
  exportData: Record<string, unknown>,
  api: PluginAPI,
  context: PluginContext
) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;

/**
 * Hook called when importing data
 * Plugins can restore their state from imported data
 */
export type OnImportHook = (
  importData: Record<string, unknown>,
  api: PluginAPI,
  context: PluginContext
) => void | Promise<void>;

/**
 * Hook called when a new RSC payload is received
 */
export type OnRSCPayloadHook = (
  payload: RSCPayload,
  api: PluginAPI,
  context: PluginContext
) => RSCPayload | void | Promise<RSCPayload | void>;

/**
 * Hook called when RSC analysis completes
 */
export type OnRSCAnalyzeHook = (
  result: RSCAnalysisResult,
  api: PluginAPI,
  context: PluginContext
) => Partial<RSCAnalysisResult> | void | Promise<Partial<RSCAnalysisResult> | void>;

/**
 * Hook called when plugin is enabled
 */
export type OnEnableHook = (api: PluginAPI, context: PluginContext) => void | Promise<void>;

/**
 * Hook called when plugin is disabled
 */
export type OnDisableHook = (api: PluginAPI, context: PluginContext) => void | Promise<void>;

/**
 * Hook called when recording starts
 */
export type OnRecordingStartHook = (api: PluginAPI, context: PluginContext) => void;

/**
 * Hook called when recording stops
 */
export type OnRecordingStopHook = (api: PluginAPI, context: PluginContext) => void;

/**
 * Hook called when data is cleared
 */
export type OnClearDataHook = (api: PluginAPI, context: PluginContext) => void;

// =============================================================================
// Main Plugin Interface
// =============================================================================

/**
 * Main AnalysisPlugin interface
 * Implement this interface to create a custom profiler plugin
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
 * };
 * ```
 */
export interface AnalysisPlugin {
  /** Plugin metadata */
  metadata: PluginMetadata;

  /** Plugin hooks for various lifecycle events */
  hooks?: {
    /** Called on each commit during profiling */
    onCommit?: OnCommitHook;
    /** Called during analysis phase */
    onAnalyze?: OnAnalyzeHook;
    /** Called when exporting data */
    onExport?: OnExportHook;
    /** Called when importing data */
    onImport?: OnImportHook;
    /** Called when RSC payload is received */
    onRSCPayload?: OnRSCPayloadHook;
    /** Called during RSC analysis */
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

  /** Optional: React component for plugin settings UI */
  SettingsComponent?: React.ComponentType<{ api: PluginAPI; context: PluginContext }>;

  /** Optional: Destroy function for cleanup */
  destroy?: () => void;
}

// =============================================================================
// UI Types
// =============================================================================

/**
 * Plugin panel definition for custom UI
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
