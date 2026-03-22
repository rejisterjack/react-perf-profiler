/**
 * Plugin System Index
 * @module panel/plugins
 *
 * Central export point for the React Perf Profiler plugin system.
 * Includes the plugin manager, built-in plugins, types, and UI components.
 *
 * @example
 * ```typescript
 * // Register all built-in plugins
 * import { registerBuiltInPlugins } from '@/panel/plugins';
 * registerBuiltInPlugins(pluginManager);
 *
 * // Use specific plugins
 * import { reduxActionTracker } from '@/panel/plugins/built-in/ReduxActionTracker';
 * pluginManager.register(reduxActionTracker);
 * ```
 */

// =============================================================================
// Plugin Manager
// =============================================================================

export {
  PluginManager,
  getPluginManager,
  resetPluginManager,
  validatePlugin,
  PluginError,
} from './PluginManager';

// =============================================================================
// Types
// =============================================================================

// Import shared types for use in this file
import type { CommitData, AnalysisResult } from '@/shared/types';
import { pluginLogger } from '@/shared/logger';

export type {
  // Plugin Interfaces
  AnalysisPlugin,
  PluginMetadata,
  PluginSettingSchema,
  PluginContext,
  PluginAPI,
  PluginUIProps,
  
  // Shared Types (re-exported)
  CommitData,
  AnalysisResult,
  FiberNode,
  
  // Metrics
  PluginMetric,
  
  // Hooks
  OnCommitHook,
  OnAnalyzeHook,
  OnAnalysisCompleteHook,
  OnExportHook,
  OnImportHook,
  OnRSCPayloadHook,
  OnRSCAnalyzeHook,
  OnEnableHook,
  OnDisableHook,
  OnRecordingStartHook,
  OnRecordingStopHook,
  OnClearDataHook,
  
  // UI Types
  PluginPanel,
  PluginNotification,
  PluginContextMenuItem,
  
  // State
  PluginState,
  PluginStateMap,
  HookExecutionResult,
  
  // Events
  PluginEventHandler,
  PluginEventMap,
  PluginEventPayload,
} from './types';

// =============================================================================
// Built-in Plugins
// =============================================================================

export {
  reduxActionTracker,
  createReduxProfilerMiddleware,
  trackReduxAction,
} from './built-in/ReduxActionTracker';

export type {
  TrackedAction,
  ReduxTrackingState,
} from './built-in/ReduxActionTracker';

export {
  contextChangeLogger,
} from './built-in/ContextChangeLogger';

export type {
  ContextChange,
  ContextTrackingState,
} from './built-in/ContextChangeLogger';

export {
  contextProviderTracker,
} from './built-in/ContextProviderTracker';

export type {
  TrackedProvider,
  ContextNestingInfo,
  ProviderTrackingState,
  ProviderAnalysisResult,
} from './built-in/ContextProviderTracker';

// =============================================================================
// Built-in Plugin Registration
// =============================================================================

import type { PluginManager } from './PluginManager';
import { reduxActionTracker } from './built-in/ReduxActionTracker';
import { contextChangeLogger } from './built-in/ContextChangeLogger';
import { contextProviderTracker } from './built-in/ContextProviderTracker';

/**
 * Array of all built-in plugins
 */
export const builtInPlugins = [
  reduxActionTracker,
  contextChangeLogger,
  contextProviderTracker,
];

/**
 * Register all built-in plugins with the plugin manager
 *
 * @param pluginManager - The plugin manager instance
 * @param options - Optional configuration
 * @param options.enableAll - Whether to enable all plugins by default (default: false)
 * @param options.enable - Array of plugin IDs to enable
 * @param options.disable - Array of plugin IDs to skip
 *
 * @example
 * ```typescript
 * // Register all built-in plugins (disabled by default)
 * registerBuiltInPlugins(pluginManager);
 *
 * // Register and enable specific plugins
 * registerBuiltInPlugins(pluginManager, {
 *   enable: ['react-perf-profiler.built-in.redux-action-tracker']
 * });
 *
 * // Register all except one
 * registerBuiltInPlugins(pluginManager, {
 *   disable: ['react-perf-profiler.built-in.context-change-logger']
 * });
 * ```
 */
export function registerBuiltInPlugins(
  pluginManager: PluginManager,
  options?: {
    enableAll?: boolean;
    enable?: string[];
    disable?: string[];
  }
): void {
  const { enableAll = false, enable = [], disable = [] } = options ?? {};

  for (const plugin of builtInPlugins) {
    const id = plugin.metadata.id;

    // Skip if in disable list
    if (disable.includes(id)) {
      continue;
    }

    // Determine initial enabled state
    const shouldEnable = enableAll || enable.includes(id);
    const initialSettings = shouldEnable ? { enabled: true } : undefined;

    try {
      pluginManager.register(plugin, initialSettings);

      // Enable if requested
      if (shouldEnable) {
        pluginManager.enablePlugin(id).catch((error) => {
          pluginLogger.error(`Failed to enable plugin ${id}`, { 
            error: error instanceof Error ? error.message : String(error),
            pluginId: id 
          });
        });
      }
    } catch (error) {
      pluginLogger.error(`Failed to register plugin ${id}`, { 
        error: error instanceof Error ? error.message : String(error),
        pluginId: id 
      });
    }
  }
}

// =============================================================================
// Plugin Template
// =============================================================================

import type { AnalysisPlugin, PluginMetric, PluginAPI, PluginContext } from './types';

/**
 * Creates a plugin template with common defaults
 * Useful for creating custom plugins quickly
 *
 * @param config - Plugin configuration
 * @returns A complete AnalysisPlugin instance
 *
 * @example
 * ```typescript
 * const myPlugin = createPluginTemplate({
 *   id: 'com.example.my-plugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 *   onCommit: (commit, api, context) => {
 *     context.log('info', 'Commit captured!', commit.id);
 *   }
 * });
 *
 * pluginManager.register(myPlugin);
 * ```
 */
export function createPluginTemplate(config: {
  /** Plugin ID (reverse domain format) */
  id: string;
  /** Plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Whether enabled by default */
  enabledByDefault?: boolean;
  /** Settings schema */
  settingsSchema?: Array<{
    key: string;
    name: string;
    description?: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'array';
    defaultValue?: unknown;
    options?: { label: string; value: string | number }[];
    required?: boolean;
  }>;
  /** Called on each commit */
  onCommit?: (commit: CommitData, api: PluginAPI, context: PluginContext) => CommitData | void | Promise<CommitData | void>;
  /** Called during analysis */
  onAnalyze?: (commits: CommitData[], api: PluginAPI, context: PluginContext) => Partial<AnalysisResult> | void | Promise<Partial<AnalysisResult> | void>;
  /** Called when analysis completes */
  onAnalysisComplete?: (result: AnalysisResult, api: PluginAPI, context: PluginContext) => PluginMetric[] | void | Promise<PluginMetric[] | void>;
  /** Called when exporting */
  onExport?: (data: Record<string, unknown>, api: PluginAPI, context: PluginContext) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;
  /** Called when importing */
  onImport?: (data: Record<string, unknown>, api: PluginAPI, context: PluginContext) => void | Promise<void>;
  /** Called when plugin enabled */
  onEnable?: (api: PluginAPI, context: PluginContext) => void | Promise<void>;
  /** Called when plugin disabled */
  onDisable?: (api: PluginAPI, context: PluginContext) => void | Promise<void>;
  /** Called when recording starts */
  onRecordingStart?: (api: PluginAPI, context: PluginContext) => void;
  /** Called when recording stops */
  onRecordingStop?: (api: PluginAPI, context: PluginContext) => void;
  /** Called when data cleared */
  onClearData?: (api: PluginAPI, context: PluginContext) => void;
  /** Get metrics function */
  getMetrics?: (api: PluginAPI, context: PluginContext) => PluginMetric[];
}): AnalysisPlugin {
  return {
    metadata: {
      id: config.id,
      name: config.name,
      version: config.version,
      description: config.description,
      author: config.author,
      enabledByDefault: config.enabledByDefault ?? false,
      settingsSchema: config.settingsSchema,
    },
    hooks: {
      ...(config.onCommit && { onCommit: config.onCommit }),
      ...(config.onAnalyze && { onAnalyze: config.onAnalyze }),
      ...(config.onAnalysisComplete && { onAnalysisComplete: config.onAnalysisComplete }),
      ...(config.onExport && { onExport: config.onExport }),
      ...(config.onImport && { onImport: config.onImport }),
      ...(config.onEnable && { onEnable: config.onEnable }),
      ...(config.onDisable && { onDisable: config.onDisable }),
      ...(config.onRecordingStart && { onRecordingStart: config.onRecordingStart }),
      ...(config.onRecordingStop && { onRecordingStop: config.onRecordingStop }),
      ...(config.onClearData && { onClearData: config.onClearData }),
    },
    ...(config.getMetrics && { getMetrics: config.getMetrics }),
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Helper to format metric values for display
 *
 * @param value - The value to format
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatMetricValue(
  value: number | string | boolean,
  options?: {
    type?: 'number' | 'duration' | 'percentage' | 'bytes';
    decimals?: number;
    suffix?: string;
  }
): string {
  const { type = 'number', decimals = 2, suffix = '' } = options ?? {};

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'string') {
    return value + suffix;
  }

  switch (type) {
    case 'duration':
      return `${value.toFixed(decimals)}ms${suffix}`;
    case 'percentage':
      return `${value.toFixed(decimals)}%${suffix}`;
    case 'bytes':
      if (value >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(decimals)}MB${suffix}`;
      }
      if (value >= 1024) {
        return `${(value / 1024).toFixed(decimals)}KB${suffix}`;
      }
      return `${value.toFixed(decimals)}B${suffix}`;
    default:
      return `${value.toFixed(decimals)}${suffix}`;
  }
}

/**
 * Creates a standard metric object
 *
 * @param config - Metric configuration
 * @returns PluginMetric object
 */
export function createMetric(config: {
  id: string;
  name: string;
  value: number | string | boolean;
  type?: 'number' | 'duration' | 'percentage' | 'bytes';
  description?: string;
  category?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendPositive?: boolean;
  priority?: number;
}): PluginMetric {
  const { id, name, value, type = 'number', description, category, trend, trendPositive, priority } = config;

  return {
    id,
    name,
    value,
    formattedValue: formatMetricValue(value, { type }),
    unit: type === 'duration' ? 'ms' : type === 'percentage' ? '%' : type === 'bytes' ? 'B' : undefined,
    description,
    category,
    trend,
    trendPositive,
    priority,
  };
}
