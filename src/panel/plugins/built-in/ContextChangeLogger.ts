/**
 * Context Change Logger Plugin
 * @module panel/plugins/built-in/ContextChangeLogger
 *
 * Tracks React Context value changes and logs which components are consuming them.
 * Helps identify context-related performance issues and unnecessary re-renders.
 */

import type {
  AnalysisPlugin,
  CommitData,
  FiberNode,
  AnalysisResult,
  PluginAPI,
  PluginContext,
} from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Tracked Context change
 */
export interface ContextChange {
  /** Unique change ID */
  id: string;
  /** Context display name */
  contextName: string;
  /** Timestamp */
  timestamp: number;
  /** Commit IDs where this change was detected */
  commitIds: string[];
  /** Number of components that re-rendered due to this change */
  affectedComponents: number;
  /** Component names that were affected */
  affectedComponentNames: string[];
  /** Whether this change caused a significant re-render cascade */
  significant: boolean;
  /** Estimated render time cost in ms */
  estimatedCost: number;
}

/**
 * Context tracking state
 */
export interface ContextTrackingState {
  /** All tracked context changes */
  changes: ContextChange[];
  /** Context usage statistics */
  contextStats: Record<
    string,
    {
      changeCount: number;
      totalAffectedComponents: number;
      totalCost: number;
    }
  >;
  /** Component to context mapping */
  componentContextMap: Record<string, string[]>;
  /** Detected context providers */
  detectedContexts: string[];
  /** Performance metrics */
  metrics: {
    totalContextChanges: number;
    contextsCausingRerenders: number;
    mostProblematicContext: string | null;
    averageComponentsAffected: number;
  };
}

/**
 * Context detection config
 */
interface ContextDetectionConfig {
  /** Minimum number of affected components to mark as significant */
  significantThreshold: number;
  /** Minimum estimated cost (ms) to mark as significant */
  costThreshold: number;
  /** Context names to ignore */
  ignoredContexts: string[];
}

// =============================================================================
// Constants
// =============================================================================

const PLUGIN_ID = 'react-perf-profiler.built-in.context-change-logger';
const DATA_KEY = 'contextTracking';

// Default context names to ignore (common React contexts)
const DEFAULT_IGNORED_CONTEXTS = [
  'ReactStrictMode',
  'SuspenseContext',
  'TransitionContext',
  'BatchContext',
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Detect if a fiber node is a context provider
 */
function isContextProvider(node: FiberNode): boolean {
  // Context providers typically have specific display name patterns
  const name = node.displayName || '';
  return (
    name.includes('Provider') ||
    name.endsWith('.Provider') ||
    name.startsWith('Context.Provider')
  );
}

/**
 * Detect if a fiber node is a context consumer
 */
function isContextConsumer(node: FiberNode): boolean {
  const name = node.displayName || '';
  return (
    name.includes('Consumer') ||
    name.endsWith('.Consumer') ||
    name.includes('useContext') ||
    name.startsWith('Context.Consumer')
  );
}

/**
 * Extract context name from provider/consumer display name
 */
function extractContextName(displayName: string): string {
  // Handle various naming conventions:
  // - MyContext.Provider -> MyContext
  // - MyContext.Consumer -> MyContext
  // - Provider (for anonymous contexts)
  return displayName
    .replace(/\.Provider$/, '')
    .replace(/\.Consumer$/, '')
    .replace(/Provider$/, '')
    .replace(/Consumer$/, '')
    .trim() || 'AnonymousContext';
}

/**
 * Detect context-related nodes in a commit
 */
function detectContextNodes(
  commit: CommitData,
  config: ContextDetectionConfig
): {
  providers: Array<{ node: FiberNode; contextName: string }>;
  consumers: Array<{ node: FiberNode; contextName: string }>;
} {
  const providers: Array<{ node: FiberNode; contextName: string }> = [];
  const consumers: Array<{ node: FiberNode; contextName: string }> = [];

  if (!commit.nodes) {
    return { providers, consumers };
  }

  for (const node of commit.nodes) {
    if (isContextProvider(node)) {
      const contextName = extractContextName(node.displayName || '');
      if (!config.ignoredContexts.includes(contextName)) {
        providers.push({ node, contextName });
      }
    } else if (isContextConsumer(node)) {
      const contextName = extractContextName(node.displayName || '');
      if (!config.ignoredContexts.includes(contextName)) {
        consumers.push({ node, contextName });
      }
    }
  }

  return { providers, consumers };
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Context Change Logger Plugin
 *
 * Tracks React Context usage and changes to help identify context-related
 * performance issues.
 *
 * @example
 * ```typescript
 * import { contextChangeLogger } from './built-in/ContextChangeLogger';
 *
 * // Register plugin
 * pluginManager.register(contextChangeLogger);
 *
 * // Analyze results to see context-related issues
 * const analysis = useProfilerStore(state => state.analysisResults);
 * const contextMetrics = analysis?.contextMetrics;
 * ```
 */
export const contextChangeLogger: AnalysisPlugin = {
  metadata: {
    id: PLUGIN_ID,
    name: 'Context Change Logger',
    version: '1.0.0',
    description: 'Tracks React Context value changes and their impact on rendering',
    enabledByDefault: false,
    settingsSchema: [
      {
        key: 'significantThreshold',
        name: 'Significant Threshold',
        description: 'Minimum number of affected components to mark change as significant',
        type: 'number',
        defaultValue: 5,
        min: 1,
        max: 50,
      },
      {
        key: 'costThreshold',
        name: 'Cost Threshold (ms)',
        description: 'Minimum estimated cost to mark change as significant',
        type: 'number',
        defaultValue: 16,
        min: 1,
        max: 100,
      },
      {
        key: 'ignoredContexts',
        name: 'Ignored Contexts',
        description: 'Comma-separated list of context names to ignore',
        type: 'string',
        defaultValue: DEFAULT_IGNORED_CONTEXTS.join(','),
      },
      {
        key: 'trackAllContexts',
        name: 'Track All Contexts',
        description: 'Track all contexts, not just those causing re-renders',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },

  hooks: {
    /**
     * Called when a new commit is captured
     * Detects context-related changes
     */
    onCommit(commit: CommitData, api: PluginAPI, context: PluginContext): void {
      const settings = context.getSettings<{
        significantThreshold?: number;
        costThreshold?: number;
        ignoredContexts?: string;
      }>();

      const config: ContextDetectionConfig = {
        significantThreshold: settings.significantThreshold ?? 5,
        costThreshold: settings.costThreshold ?? 16,
        ignoredContexts: (settings.ignoredContexts || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const state = api.getPluginData<ContextTrackingState>(DATA_KEY) || {
        changes: [],
        contextStats: {},
        componentContextMap: {},
        detectedContexts: [],
        metrics: {
          totalContextChanges: 0,
          contextsCausingRerenders: 0,
          mostProblematicContext: null,
          averageComponentsAffected: 0,
        },
      };

      const { providers, consumers } = detectContextNodes(commit, config);

      // Track detected contexts
      for (const { contextName } of providers) {
        if (!state.detectedContexts.includes(contextName)) {
          state.detectedContexts.push(contextName);
        }
      }

      // If there are providers in this commit, track the change
      if (providers.length > 0) {
        for (const { contextName } of providers) {
          const affectedComponentNames = consumers
            .filter((c) => c.contextName === contextName || c.contextName === 'AnonymousContext')
            .map((c) => c.node.displayName || 'Unknown');

          const estimatedCost = consumers.reduce((sum, c) => sum + c.node.actualDuration, 0);

          const change: ContextChange = {
            id: `${contextName}-${commit.id}-${Date.now()}`,
            contextName,
            timestamp: commit.timestamp,
            commitIds: [commit.id],
            affectedComponents: consumers.length,
            affectedComponentNames,
            significant:
              consumers.length >= config.significantThreshold ||
              estimatedCost >= config.costThreshold,
            estimatedCost,
          };

          state.changes.push(change);

          // Update context stats
          const stats = state.contextStats[contextName] || {
            changeCount: 0,
            totalAffectedComponents: 0,
            totalCost: 0,
          };
          stats.changeCount++;
          stats.totalAffectedComponents += consumers.length;
          stats.totalCost += estimatedCost;
          state.contextStats[contextName] = stats;
        }
      }

      // Update component context map
      for (const { node, contextName } of consumers) {
        const componentName = node.displayName || 'Unknown';
        if (!state.componentContextMap[componentName]) {
          state.componentContextMap[componentName] = [];
        }
        if (!state.componentContextMap[componentName].includes(contextName)) {
          state.componentContextMap[componentName].push(contextName);
        }
      }

      api.setPluginData(DATA_KEY, state);
    },

    /**
     * Called during analysis phase
     * Generates context-related analysis results
     */
    onAnalyze(
      commits: CommitData[],
      api: PluginAPI,
      context: PluginContext
    ): Partial<AnalysisResult> {
      const state = api.getPluginData<ContextTrackingState>(DATA_KEY);
      if (!state || state.changes.length === 0) {
        return {};
      }

      // Calculate metrics
      const significantChanges = state.changes.filter((c) => c.significant);
      const totalAffected = state.changes.reduce((sum, c) => sum + c.affectedComponents, 0);

      // Find most problematic context
      let mostProblematic: string | null = null;
      let maxImpact = 0;

      for (const [contextName, stats] of Object.entries(state.contextStats)) {
        const impact = stats.totalAffectedComponents * stats.totalCost;
        if (impact > maxImpact) {
          maxImpact = impact;
          mostProblematic = contextName;
        }
      }

      state.metrics = {
        totalContextChanges: state.changes.length,
        contextsCausingRerenders: state.detectedContexts.length,
        mostProblematicContext: mostProblematic,
        averageComponentsAffected: totalAffected / Math.max(1, state.changes.length),
      };

      // Build context-related issues for the analysis
      const contextIssues = significantChanges
        .filter((change) => change.significant)
        .slice(0, 10)
        .map((change) => ({
          type: 'context-re-render' as const,
          componentName: change.contextName,
          description: `Context "${change.contextName}" caused ${change.affectedComponents} components to re-render`,
          severity: change.affectedComponents > 10 ? ('high' as const) : ('medium' as const),
          suggestion: `Consider splitting "${change.contextName}" into smaller contexts or using selectors`,
          affectedComponents: change.affectedComponentNames,
          estimatedCost: change.estimatedCost,
        }));

      api.setPluginData(DATA_KEY, state);

      return {
        contextMetrics: state.metrics,
        contextIssues,
        detectedContexts: state.detectedContexts,
        componentContextMap: state.componentContextMap,
      } as Partial<AnalysisResult>;
    },

    /**
     * Called when exporting data
     */
    onExport(
      data: Record<string, unknown>,
      api: PluginAPI,
      context: PluginContext
    ): Record<string, unknown> {
      const state = api.getPluginData<ContextTrackingState>(DATA_KEY);
      if (!state) {
        return data;
      }

      return {
        ...data,
        contextTracking: {
          version: '1.0.0',
          changes: state.changes,
          contextStats: state.contextStats,
          detectedContexts: state.detectedContexts,
          metrics: state.metrics,
          exportedAt: Date.now(),
        },
      };
    },

    /**
     * Called when importing data
     */
    onImport(
      data: Record<string, unknown>,
      api: PluginAPI,
      context: PluginContext
    ): void {
      const contextData = data.contextTracking as
        | {
            version: string;
            changes: ContextChange[];
            contextStats: ContextTrackingState['contextStats'];
            detectedContexts: string[];
            metrics: ContextTrackingState['metrics'];
          }
        | undefined;

      if (contextData?.changes) {
        const state: ContextTrackingState = {
          changes: contextData.changes,
          contextStats: contextData.contextStats || {},
          componentContextMap: {},
          detectedContexts: contextData.detectedContexts || [],
          metrics: contextData.metrics || {
            totalContextChanges: contextData.changes.length,
            contextsCausingRerenders: 0,
            mostProblematicContext: null,
            averageComponentsAffected: 0,
          },
        };

        api.setPluginData(DATA_KEY, state);
        context.log('info', `Restored ${state.changes.length} context changes`);
      }
    },

    /**
     * Called when data is cleared
     */
    onClearData(api: PluginAPI, context: PluginContext): void {
      const emptyState: ContextTrackingState = {
        changes: [],
        contextStats: {},
        componentContextMap: {},
        detectedContexts: [],
        metrics: {
          totalContextChanges: 0,
          contextsCausingRerenders: 0,
          mostProblematicContext: null,
          averageComponentsAffected: 0,
        },
      };

      api.setPluginData(DATA_KEY, emptyState);
      context.log('info', 'Context tracking data cleared');
    },
  },
};

export default contextChangeLogger;
