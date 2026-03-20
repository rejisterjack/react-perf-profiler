/**
 * Plugin Manager
 * @module panel/plugins/PluginManager
 *
 * Manages plugin lifecycle, hook execution, and error isolation.
 * Ensures that plugin failures don't break the profiler or other plugins.
 */

import type {
  AnalysisPlugin,
  PluginAPI,
  PluginContext,
  PluginState,
  PluginStateMap,
  PluginPanel,
  PluginContextMenuItem,
  HookExecutionResult,
  OnCommitHook,
  OnAnalyzeHook,
  OnExportHook,
  OnImportHook,
  OnRSCPayloadHook,
  OnRSCAnalyzeHook,
} from './types';

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
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginId: string,
    public readonly hookType?: HookType,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

/**
 * Wraps a function with error isolation
 * Errors are caught and logged, but don't propagate
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
 * @throws Error if plugin is invalid
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
}

// =============================================================================
// Plugin Manager Class
// =============================================================================

/**
 * Plugin Manager
 * Central registry for all plugins. Manages registration, lifecycle, and hook execution.
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
   * @param plugin - The plugin to register
   * @param initialSettings - Initial settings for the plugin
   * @returns Unregister function
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
   * @param pluginId - Plugin ID to unregister
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
   * @param pluginId - Plugin ID to enable
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
        entry.plugin.hooks.onEnable,
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
   * @param pluginId - Plugin ID to disable
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
        entry.plugin.hooks.onDisable,
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
   * @param pluginId - Plugin ID to toggle
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
   * Results are merged according to the hook type
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
   * Results are collected as an array
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
   * Execute onExport hooks - sequential, each can add to export data
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
    const promises: Promise<void>[] = [];

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
    const promises: Promise<void>[] = [];

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
    const promises: Promise<void>[] = [];

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
  // Queries
  // ===========================================================================

  /**
   * Get all registered plugins
   */
  getAllPlugins(): AnalysisPlugin[] {
    return Array.from(this.plugins.values()).map((entry) => entry.plugin);
  }

  /**
   * Get a specific plugin by ID
   */
  getPlugin(pluginId: string): AnalysisPlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Get plugin state
   */
  getPluginState(pluginId: string): PluginState | undefined {
    return this.plugins.get(pluginId)?.state;
  }

  /**
   * Get all enabled plugins
   */
  getEnabledPlugins(): AnalysisPlugin[] {
    return Array.from(this.plugins.values())
      .filter((entry) => entry.state.enabled)
      .map((entry) => entry.plugin);
  }

  /**
   * Get all plugin states
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
   */
  isPluginEnabled(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.state.enabled ?? false;
  }

  /**
   * Update plugin settings
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
   */
  getPluginSettings<T = Record<string, unknown>>(pluginId: string): T {
    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin '${pluginId}' not found`);
    }

    return entry.state.settings as T;
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Register a global error handler
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
    // Log to console
    // eslint-disable-next-line no-console
    console.error(`[Plugin Error] ${error.pluginId}:`, error.message, error.cause);

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
