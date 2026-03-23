/**
 * Plugin Manager
 * @module panel/plugins/PluginManager
 *
 * Manages plugin lifecycle, hook execution, and error isolation.
 * Ensures that plugin failures don't break the profiler or other plugins.
 *
 * @example
 * ```typescript
 * import { PluginManager } from './PluginManager';
 * import { myPlugin } from './built-in/MyPlugin';
 *
 * const manager = new PluginManager(api);
 * manager.register(myPlugin);
 *
 * // Broadcast events to all enabled plugins
 * await manager.executeOnCommit(commitData);
 * ```
 */

import type {
  AnalysisPlugin,
  PluginAPI,
  PluginContext,
  PluginState,
  PluginStateMap,
  HookExecutionResult,
  PluginMetric,
  PluginMetadata,
} from './types';
import type { CommitData, AnalysisResult } from '@/shared/types';
import type { RSCPayload, RSCAnalysisResult } from '@/shared/types/rsc';
import { logger } from '@/shared/logger';

// =============================================================================
// Types
// =============================================================================

interface PluginEntry {
  plugin: AnalysisPlugin;
  state: PluginState;
  context: PluginContext;
}

type HookType =
  | 'onCommit'
  | 'onAnalyze'
  | 'onAnalysisComplete'
  | 'onExport'
  | 'onImport'
  | 'onRSCPayload'
  | 'onRSCAnalyze'
  | 'onEnable'
  | 'onDisable'
  | 'onRecordingStart'
  | 'onRecordingStop'
  | 'onClearData';

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Custom error class for plugin-related errors
 * Contains additional context about which plugin and hook caused the error
 *
 * @example
 * ```typescript
 * try {
 *   await plugin.hooks.onCommit(commit, api, context);
 * } catch (cause) {
 *   throw new PluginError('Hook execution failed', pluginId, 'onCommit', cause);
 * }
 * ```
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginId: string,
    public readonly hookType?: HookType,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

/**
 * Wraps a function with error isolation
 * Errors are caught and logged, but don't propagate to prevent breaking other plugins
 *
 * @param fn - The function to wrap
 * @param pluginId - The plugin ID for error context
 * @param hookType - The hook type for error context
 * @param onError - Error handler callback
 * @returns Wrapped function that catches errors
 */
function withErrorIsolation<T extends (...args: unknown[]) => unknown>(
  fn: T,
  pluginId: string,
  hookType: HookType,
  onError: (error: PluginError) => void
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    try {
      const result = await fn(...args);
      return result as ReturnType<T>;
    } catch (error) {
      const pluginError = new PluginError(
        error instanceof Error ? error.message : 'Unknown error',
        pluginId,
        hookType,
        error instanceof Error ? error : undefined
      );
      onError(pluginError);
      return undefined;
    }
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates a plugin structure
 * Ensures all required fields are present and valid
 *
 * @param plugin - The plugin to validate
 * @throws Error if plugin is invalid
 *
 * @example
 * ```typescript
 * validatePlugin(myPlugin); // Throws if invalid
 * ```
 */
export function validatePlugin(plugin: AnalysisPlugin): void {
  if (!plugin) {
    throw new Error('Plugin is required');
  }

  if (!plugin.metadata) {
    throw new Error('Plugin metadata is required');
  }

  const { metadata } = plugin;

  if (!metadata.id) {
    throw new Error('Plugin metadata.id is required');
  }

  // Validate ID format (reverse domain notation recommended)
  if (typeof metadata.id !== 'string' || metadata.id.length === 0) {
    throw new Error('Plugin metadata.id must be a non-empty string');
  }

  if (!metadata.name) {
    throw new Error('Plugin metadata.name is required');
  }

  if (!metadata.version) {
    throw new Error('Plugin metadata.version is required');
  }

  // Basic semver validation (x.y.z format)
  const semverRegex = /^\d+\.\d+\.\d+/;
  if (!semverRegex.test(metadata.version)) {
    throw new Error('Plugin metadata.version must follow semver format (e.g., 1.0.0)');
  }

  // Validate hooks object if present
  if (plugin.hooks) {
    const validHooks: HookType[] = [
      'onCommit',
      'onAnalyze',
      'onAnalysisComplete',
      'onExport',
      'onImport',
      'onRSCPayload',
      'onRSCAnalyze',
      'onEnable',
      'onDisable',
      'onRecordingStart',
      'onRecordingStop',
      'onClearData',
    ];

    for (const hookName of Object.keys(plugin.hooks)) {
      if (!validHooks.includes(hookName as HookType)) {
        throw new Error(`Invalid hook type: ${hookName}`);
      }

      const hook = plugin.hooks[hookName as keyof typeof plugin.hooks];
      if (hook && typeof hook !== 'function') {
        throw new Error(`Hook ${hookName} must be a function`);
      }
    }
  }

  // Validate getMetrics if present
  if (plugin.getMetrics && typeof plugin.getMetrics !== 'function') {
    throw new Error('Plugin getMetrics must be a function');
  }

  // Validate getUI if present
  if (plugin.getUI && typeof plugin.getUI !== 'function') {
    throw new Error('Plugin getUI must be a function');
  }

  // validate destroy if present
  if (plugin.destroy && typeof plugin.destroy !== 'function') {
    throw new Error('Plugin destroy must be a function');
  }
}

// =============================================================================
// Plugin Manager Class
// =============================================================================

/**
 * Plugin Manager
 * Central registry for all plugins. Manages registration, lifecycle, and hook execution.
 *
 * Features:
 * - Plugin registration and unregistration
 * - Enable/disable plugins
 * - Event broadcasting to all enabled plugins
 * - Plugin metadata storage
 * - Error isolation (plugin failures don't break other plugins)
 * - Metrics collection from plugins
 *
 * @example
 * ```typescript
 * const manager = new PluginManager(api);
 *
 * // Register a plugin
 * manager.register(myPlugin);
 *
 * // Enable/disable plugins
 * await manager.enablePlugin('plugin-id');
 * await manager.disablePlugin('plugin-id');
 *
 * // Broadcast events
 * await manager.executeOnCommit(commitData);
 * await manager.executeOnAnalyze(commits);
 *
 * // Get plugin info
 * const plugins = manager.getAllPlugins();
 * const enabled = manager.getEnabledPlugins();
 * const metrics = manager.getAllPluginMetrics();
 * ```
 */
export class PluginManager {
  private plugins: Map<string, PluginEntry> = new Map();
  private api: PluginAPI;
  private eventHandlers: Map<string, Set<(payload: unknown) => void>> = new Map();
  private globalErrorHandlers: Set<(error: PluginError) => void> = new Set();

  constructor(api: PluginAPI) {
    this.api = api;
  }

  // ===========================================================================
  // Registration
  // ===========================================================================

  /**
   * Register a new plugin
   * The plugin will be added to the registry but not automatically enabled
   * unless enabledByDefault is true in its metadata.
   *
   * @param plugin - The plugin to register
   * @param initialSettings - Initial settings for the plugin (optional)
   * @returns Unregister function that removes the plugin when called
   * @throws Error if plugin is invalid or already registered
   *
   * @example
   * ```typescript
   * const unregister = manager.register(myPlugin, { option: 'value' });
   *
   * // Later...
   * unregister(); // Removes the plugin
   * ```
   */
  register(plugin: AnalysisPlugin, initialSettings?: Record<string, unknown>): () => void {
    validatePlugin(plugin);

    const { id } = plugin.metadata;

    if (this.plugins.has(id)) {
      throw new Error(`Plugin with id '${id}' is already registered`);
    }

    // Create plugin context
    const context = this.createPluginContext(id);

    // Create initial state
    const state: PluginState = {
      enabled: plugin.metadata.enabledByDefault ?? false,
      settings: {
        ...this.getDefaultSettings(plugin),
        ...initialSettings,
      },
      data: {},
      panels: [],
      contextMenuItems: [],
    };

    // Store plugin entry
    const entry: PluginEntry = { plugin, state, context };
    this.plugins.set(id, entry);

    // Enable plugin if enabledByDefault
    if (state.enabled) {
      this.enablePlugin(id).catch((error) => {
        context.log('error', 'Failed to auto-enable plugin:', error);
      });
    }

    context.log('info', `Plugin registered: ${plugin.metadata.name} v${plugin.metadata.version}`);

    // Return unregister function
    return () => {
      this.unregister(id);
    };
  }

  /**
   * Unregister a plugin
   * Disables the plugin first (running cleanup hooks), then removes it from the registry.
   *
   * @param pluginId - Plugin ID to unregister
   *
   * @example
   * ```typescript
   * manager.unregister('my-plugin-id');
   * ```
   */
  unregister(pluginId: string): void {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      return;
    }

    // Disable first to run cleanup
    if (entry.state.enabled) {
      this.disablePlugin(pluginId).catch(() => {
        // Ignore errors during unregister
      });
    }

    // Call destroy if provided
    if (entry.plugin.destroy) {
      try {
        entry.plugin.destroy();
      } catch (error) {
        entry.context.log('error', 'Error during plugin destroy:', error);
      }
    }

    this.plugins.delete(pluginId);
    entry.context.log('info', 'Plugin unregistered');
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Enable a plugin
   * Runs the onEnable hook if present and updates the plugin state.
   *
   * @param pluginId - Plugin ID to enable
   * @throws Error if plugin is not found
   *
   * @example
   * ```typescript
   * await manager.enablePlugin('my-plugin-id');
   * ```
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin '${pluginId}' not found`);
    }

    if (entry.state.enabled) {
      return; // Already enabled
    }

    entry.state.enabled = true;
    entry.state.enabledAt = Date.now();

    // Run onEnable hook
    if (entry.plugin.hooks?.onEnable) {
      const wrapped = withErrorIsolation(
        entry.plugin.hooks.onEnable as (...args: unknown[]) => unknown,
        pluginId,
        'onEnable',
        (error) => this.handlePluginError(error)
      );
      await wrapped(this.api, entry.context);
    }

    entry.context.emit('plugin:enabled', { pluginId });
    entry.context.log('info', 'Plugin enabled');
  }

  /**
   * Disable a plugin
   * Runs the onDisable hook if present and updates the plugin state.
   * Clears plugin panels and context menu items.
   *
   * @param pluginId - Plugin ID to disable
   * @throws Error if plugin is not found
   *
   * @example
   * ```typescript
   * await manager.disablePlugin('my-plugin-id');
   * ```
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin '${pluginId}' not found`);
    }

    if (!entry.state.enabled) {
      return; // Already disabled
    }

    // Run onDisable hook
    if (entry.plugin.hooks?.onDisable) {
      const wrapped = withErrorIsolation(
        entry.plugin.hooks.onDisable as (...args: unknown[]) => unknown,
        pluginId,
        'onDisable',
        (error) => this.handlePluginError(error)
      );
      await wrapped(this.api, entry.context);
    }

    // Clear plugin panels
    entry.state.panels = [];
    entry.state.contextMenuItems = [];

    entry.state.enabled = false;
    entry.context.emit('plugin:disabled', { pluginId });
    entry.context.log('info', 'Plugin disabled');
  }

  /**
   * Toggle plugin enabled state
   * Enables if disabled, disables if enabled.
   *
   * @param pluginId - Plugin ID to toggle
   * @throws Error if plugin is not found
   *
   * @example
   * ```typescript
   * await manager.togglePlugin('my-plugin-id');
   * ```
   */
  async togglePlugin(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin '${pluginId}' not found`);
    }

    if (entry.state.enabled) {
      await this.disablePlugin(pluginId);
    } else {
      await this.enablePlugin(pluginId);
    }
  }

  // ===========================================================================
  // Hook Execution
  // ===========================================================================

  /**
   * Execute a hook on all enabled plugins in sequence
   * Results are merged according to the hook type.
   * Each plugin receives the result of the previous plugin (pipeline pattern).
   *
   * @param hookType - The type of hook to execute
   * @param input - The initial input value
   * @param mergeResults - Function to merge results from all plugins
   * @returns The final merged result
   */
  private async executeHookSequential<T, R>(
    hookType: HookType,
    input: T,
    mergeResults: (results: (T | undefined)[]) => R
  ): Promise<R> {
    const results: (T | undefined)[] = [input];

    for (const [pluginId, entry] of this.plugins) {
      if (!entry.state.enabled) continue;

      const hook = entry.plugin.hooks?.[hookType] as
        | ((arg: T, api: PluginAPI, context: PluginContext) => T | Promise<T>)
        | undefined;

      if (!hook) continue;

      const startTime = performance.now();
      const wrapped = withErrorIsolation(
        hook as (...args: unknown[]) => unknown,
        pluginId,
        hookType,
        (error) => this.handlePluginError(error)
      );

      const lastResult = results[results.length - 1];
      if (lastResult === undefined) {
        continue;
      }

      const result = await wrapped(lastResult, this.api, entry.context);
      const duration = performance.now() - startTime;

      if (result !== undefined) {
        results.push(result as T);
      }

      // Log slow hooks in development
      if (duration > 100) {
        entry.context.log('warn', `Slow ${hookType} hook: ${duration.toFixed(2)}ms`);
      }
    }

    return mergeResults(results);
  }

  /**
   * Execute a hook on all enabled plugins in parallel
   * Results are collected as an array and processed by the provided function.
   *
   * @param hookType - The type of hook to execute
   * @param input - The input value (same for all plugins)
   * @param processResults - Function to process the array of results
   * @returns The processed result
   */
  private async executeHookParallel<T, R>(
    hookType: HookType,
    input: T,
    processResults: (results: HookExecutionResult<R>[]) => R
  ): Promise<R> {
    const promises: Promise<HookExecutionResult<R>>[] = [];

    for (const [pluginId, entry] of this.plugins) {
      if (!entry.state.enabled) continue;

      const hook = entry.plugin.hooks?.[hookType] as
        | ((arg: T, api: PluginAPI, context: PluginContext) => R | Promise<R>)
        | undefined;

      if (!hook) continue;

      const promise = (async (): Promise<HookExecutionResult<R>> => {
        const startTime = performance.now();
        try {
          const result = await hook(input, this.api, entry.context);
          const duration = performance.now() - startTime;

          // Log slow hooks
          if (duration > 100) {
            entry.context.log('warn', `Slow ${hookType} hook: ${duration.toFixed(2)}ms`);
          }

          return {
            success: true,
            pluginId,
            data: result as R,
            duration,
          };
        } catch (error) {
          const duration = performance.now() - startTime;
          const pluginError = new PluginError(
            error instanceof Error ? error.message : 'Unknown error',
            pluginId,
            hookType,
            error instanceof Error ? error : undefined
          );
          this.handlePluginError(pluginError);

          return {
            success: false,
            pluginId,
            error: error instanceof Error ? error : new Error(String(error)),
            duration,
          };
        }
      })();

      promises.push(promise);
    }

    const results = await Promise.all(promises);
    return processResults(results);
  }

  // ===========================================================================
  // Specific Hook Executors
  // ===========================================================================

  /**
   * Execute onCommit hooks - sequential, each can transform the commit
   *
   * @param commit - The commit data to process
   * @returns The potentially transformed commit data
   */
  async executeOnCommit(commit: CommitData): Promise<CommitData> {
    return this.executeHookSequential<CommitData, CommitData>(
      'onCommit',
      commit,
      (results) => {
        // Return the last non-undefined result, or original commit
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i] !== undefined) {
            return results[i] as CommitData;
          }
        }
        return commit;
      }
    );
  }

  /**
   * Execute onAnalyze hooks - parallel, results are merged
   *
   * @param commits - Array of commits to analyze
   * @returns Array of partial analysis results from all plugins
   */
  async executeOnAnalyze(
    commits: CommitData[]
  ): Promise<Partial<AnalysisResult>[]> {
    return this.executeHookParallel(
      'onAnalyze',
      commits,
      (results) => results.filter((r) => r.success && r.data).map((r) => r.data as Partial<AnalysisResult>)
    );
  }

  /**
   * Execute onAnalysisComplete hooks - parallel, results are aggregated
   *
   * @param result - The completed analysis result
   * @returns Array of plugin metrics from all plugins
   */
  async executeOnAnalysisComplete(
    result: AnalysisResult
  ): Promise<PluginMetric[]> {
    return this.executeHookParallel(
      'onAnalysisComplete',
      result,
      (hookResults) => {
        const allMetrics: PluginMetric[] = [];
        for (const hr of hookResults) {
          if (hr.success && hr.data && Array.isArray(hr.data)) {
            // Prefix metric IDs with plugin ID to avoid conflicts
            const prefixedMetrics = (hr.data as PluginMetric[]).map((m) => ({
              ...m,
              id: `${hr.pluginId}:${m.id}`,
            }));
            allMetrics.push(...prefixedMetrics);
          }
        }
        return allMetrics;
      }
    );
  }

  /**
   * Execute onExport hooks - sequential, each can add to export data
   *
   * @param data - The export data object
   * @returns The merged export data
   */
  async executeOnExport(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.executeHookSequential(
      'onExport',
      data,
      (results) => {
        // Merge all results
        return results.reduce<Record<string, unknown>>(
          (acc, result) => ({
            ...acc,
            ...(result as Record<string, unknown> || {}),
          }),
          {}
        );
      }
    );
  }

  /**
   * Execute onImport hooks - parallel for side effects
   *
   * @param data - The import data object
   */
  async executeOnImport(data: Record<string, unknown>): Promise<void> {
    await this.executeHookParallel(
      'onImport',
      data,
      () => undefined // We don't care about the results, just side effects
    );
  }

  /**
   * Execute onRSCPayload hooks - sequential, each can transform the payload
   *
   * @param payload - The RSC payload to process
   * @returns The potentially transformed payload
   */
  async executeOnRSCPayload(payload: RSCPayload): Promise<RSCPayload> {
    return this.executeHookSequential<RSCPayload, RSCPayload>(
      'onRSCPayload',
      payload,
      (results) => {
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i] !== undefined) {
            return results[i] as RSCPayload;
          }
        }
        return payload;
      }
    );
  }

  /**
   * Execute onRSCAnalyze hooks - parallel, results are merged
   *
   * @param result - The RSC analysis result
   * @returns Array of partial RSC analysis results
   */
  async executeOnRSCAnalyze(
    result: RSCAnalysisResult
  ): Promise<Partial<RSCAnalysisResult>[]> {
    return this.executeHookParallel(
      'onRSCAnalyze',
      result,
      (results) => results.filter((r) => r.success && r.data).map((r) => r.data as Partial<RSCAnalysisResult>)
    );
  }

  /**
   * Execute onRecordingStart hooks
   */
  async executeOnRecordingStart(): Promise<void> {
    const promises: Promise<unknown>[] = [];

    for (const [pluginId, entry] of this.plugins) {
      if (!entry.state.enabled) continue;

      const hook = entry.plugin.hooks?.onRecordingStart;
      if (!hook) continue;

      const wrapped = withErrorIsolation(
        hook as (...args: unknown[]) => unknown,
        pluginId,
        'onRecordingStart',
        (error) => this.handlePluginError(error)
      );

      promises.push(wrapped(this.api, entry.context));
    }

    await Promise.all(promises);
  }

  /**
   * Execute onRecordingStop hooks
   */
  async executeOnRecordingStop(): Promise<void> {
    const promises: Promise<unknown>[] = [];

    for (const [pluginId, entry] of this.plugins) {
      if (!entry.state.enabled) continue;

      const hook = entry.plugin.hooks?.onRecordingStop;
      if (!hook) continue;

      const wrapped = withErrorIsolation(
        hook as (...args: unknown[]) => unknown,
        pluginId,
        'onRecordingStop',
        (error) => this.handlePluginError(error)
      );

      promises.push(wrapped(this.api, entry.context));
    }

    await Promise.all(promises);
  }

  /**
   * Execute onClearData hooks
   */
  async executeOnClearData(): Promise<void> {
    const promises: Promise<unknown>[] = [];

    for (const [pluginId, entry] of this.plugins) {
      if (!entry.state.enabled) continue;

      const hook = entry.plugin.hooks?.onClearData;
      if (!hook) continue;

      const wrapped = withErrorIsolation(
        hook as (...args: unknown[]) => unknown,
        pluginId,
        'onClearData',
        (error) => this.handlePluginError(error)
      );

      promises.push(wrapped(this.api, entry.context));
    }

    await Promise.all(promises);
  }

  // ===========================================================================
  // Metrics
  // ===========================================================================

  /**
   * Get metrics from a specific plugin
   *
   * @param pluginId - The plugin ID
   * @returns Array of plugin metrics, or empty array if plugin has no metrics
   */
  getPluginMetrics(pluginId: string): PluginMetric[] {
    const entry = this.plugins.get(pluginId);
    if (!entry || !entry.state.enabled || !entry.plugin.getMetrics) {
      return [];
    }

    try {
      const metrics = entry.plugin.getMetrics(this.api, entry.context);
      // Prefix metric IDs with plugin ID to avoid conflicts
      return metrics.map((m) => ({
        ...m,
        id: `${pluginId}:${m.id}`,
        pluginId,
        pluginName: entry.plugin.metadata.name,
      }));
    } catch (error) {
      entry.context.log('error', 'Error getting plugin metrics:', error);
      return [];
    }
  }

  /**
   * Get metrics from all enabled plugins
   *
   * @returns Array of all plugin metrics
   */
  getAllPluginMetrics(): PluginMetric[] {
    const allMetrics: PluginMetric[] = [];

    for (const [pluginId] of this.plugins) {
      const metrics = this.getPluginMetrics(pluginId);
      allMetrics.push(...metrics);
    }

    // Sort by priority (lower first), then by plugin ID
    return allMetrics.sort((a, b) => {
      const priorityDiff = (a.priority ?? 999) - (b.priority ?? 999);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.pluginId ?? '').localeCompare(b.pluginId ?? '');
    });
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  /**
   * Get all registered plugins
   *
   * @returns Array of all registered plugins
   */
  getAllPlugins(): AnalysisPlugin[] {
    return Array.from(this.plugins.values()).map((entry) => entry.plugin);
  }

  /**
   * Get a specific plugin by ID
   *
   * @param pluginId - The plugin ID
   * @returns The plugin, or undefined if not found
   */
  getPlugin(pluginId: string): AnalysisPlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Get plugin state
   *
   * @param pluginId - The plugin ID
   * @returns The plugin state, or undefined if not found
   */
  getPluginState(pluginId: string): PluginState | undefined {
    return this.plugins.get(pluginId)?.state;
  }

  /**
   * Get all enabled plugins
   *
   * @returns Array of enabled plugins
   */
  getEnabledPlugins(): AnalysisPlugin[] {
    return Array.from(this.plugins.values())
      .filter((entry) => entry.state.enabled)
      .map((entry) => entry.plugin);
  }

  /**
   * Get all plugin states
   *
   * @returns Map of plugin ID to plugin state
   */
  getAllPluginStates(): PluginStateMap {
    const map = new Map<string, PluginState>();
    for (const [id, entry] of this.plugins) {
      map.set(id, entry.state);
    }
    return map;
  }

  /**
   * Check if a plugin is enabled
   *
   * @param pluginId - The plugin ID
   * @returns True if plugin is enabled
   */
  isPluginEnabled(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.state.enabled ?? false;
  }

  /**
   * Get plugin metadata
   *
   * @param pluginId - The plugin ID
   * @returns The plugin metadata, or undefined if not found
   */
  getPluginMetadata(pluginId: string): PluginMetadata | undefined {
    return this.plugins.get(pluginId)?.plugin.metadata;
  }

  /**
   * Get all plugin metadata
   *
   * @returns Array of all plugin metadata
   */
  getAllPluginMetadata(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map((entry) => entry.plugin.metadata);
  }

  // ===========================================================================
  // Settings
  // ===========================================================================

  /**
   * Update plugin settings
   *
   * @param pluginId - The plugin ID
   * @param settings - The settings to update (merged with existing)
   * @throws Error if plugin is not found
   */
  updatePluginSettings(pluginId: string, settings: Record<string, unknown>): void {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin '${pluginId}' not found`);
    }

    entry.state.settings = {
      ...entry.state.settings,
      ...settings,
    };

    entry.context.emit('plugin:data:changed', { pluginId, key: 'settings' });
  }

  /**
   * Get plugin settings
   *
   * @param pluginId - The plugin ID
   * @returns The plugin settings
   * @throws Error if plugin is not found
   */
  getPluginSettings<T = Record<string, unknown>>(pluginId: string): T {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin '${pluginId}' not found`);
    }

    return entry.state.settings as T;
  }

  /**
   * Reset plugin settings to defaults
   *
   * @param pluginId - The plugin ID
   * @throws Error if plugin is not found
   */
  resetPluginSettings(pluginId: string): void {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin '${pluginId}' not found`);
    }

    entry.state.settings = this.getDefaultSettings(entry.plugin);
    entry.context.emit('plugin:data:changed', { pluginId, key: 'settings' });
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Register a global error handler
   * Handlers are called whenever a plugin hook throws an error.
   *
   * @param handler - The error handler function
   * @returns Unregister function
   */
  onError(handler: (error: PluginError) => void): () => void {
    this.globalErrorHandlers.add(handler);
    return () => {
      this.globalErrorHandlers.delete(handler);
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private createPluginContext(pluginId: string): PluginContext {
    return {
      pluginId,
      getSettings: <T = Record<string, unknown>>() => this.getPluginSettings<T>(pluginId),
      setSettings: (settings: Record<string, unknown>) =>
        this.updatePluginSettings(pluginId, settings),
      log: (level, message, ...args) => {
        const prefix = `[${pluginId}]`;
        // eslint-disable-next-line no-console
        console[level](prefix, message, ...args);
      },
      emit: (eventName, payload) => {
        const handlers = this.eventHandlers.get(eventName);
        if (handlers) {
          handlers.forEach((handler) => {
            try {
              handler(payload);
            } catch (error) {
              // Ignore handler errors
            }
          });
        }
      },
      on: (eventName, handler) => {
        if (!this.eventHandlers.has(eventName)) {
          this.eventHandlers.set(eventName, new Set());
        }
        this.eventHandlers.get(eventName)!.add(handler);
        return () => {
          this.eventHandlers.get(eventName)?.delete(handler);
        };
      },
    };
  }

  private getDefaultSettings(plugin: AnalysisPlugin): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};

    if (plugin.metadata.settingsSchema) {
      for (const setting of plugin.metadata.settingsSchema) {
        if (setting.defaultValue !== undefined) {
          defaults[setting.key] = setting.defaultValue;
        }
      }
    }

    return defaults;
  }

  private handlePluginError(error: PluginError): void {
    logger.error(`[Plugin Error] ${error.pluginId}: ${error.message}`, {
      pluginId: error.pluginId,
      cause: error.cause,
      source: 'PluginManager',
    });

    // Notify global handlers
    this.globalErrorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch {
        // Ignore handler errors
      }
    });

    // Update plugin state with error
    const entry = this.plugins.get(error.pluginId);
    if (entry) {
      entry.state.error = error.message;
      entry.context.emit('plugin:error', { pluginId: error.pluginId, error });
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalPluginManager: PluginManager | null = null;

/**
 * Get or create the global plugin manager instance
 *
 * @param api - Optional API instance to create the manager with
 * @returns The global plugin manager
 * @throws Error if the manager hasn't been initialized and no API is provided
 */
export function getPluginManager(api?: PluginAPI): PluginManager {
  if (!globalPluginManager && api) {
    globalPluginManager = new PluginManager(api);
  }
  if (!globalPluginManager) {
    throw new Error('PluginManager not initialized');
  }
  return globalPluginManager;
}

/**
 * Reset the global plugin manager (useful for testing)
 */
export function resetPluginManager(): void {
  globalPluginManager = null;
}
