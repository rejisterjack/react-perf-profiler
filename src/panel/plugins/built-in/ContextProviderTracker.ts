/**
 * Context Provider Tracker Plugin
 * @module panel/plugins/built-in/ContextProviderTracker
 *
 * Tracks React Context providers, their nesting levels, and performance impact.
 * Helps identify deep context nesting and over-provisioned contexts.
 *
 * @example
 * ```typescript
 * import { contextProviderTracker } from './built-in/ContextProviderTracker';
 *
 * // Register plugin
 * pluginManager.register(contextProviderTracker);
 *
 * // Analyze results
 * const analysis = useProfilerStore(state => state.analysisResults);
 * const providerMetrics = analysis?.providerMetrics;
 * ```
 */

import type {
  AnalysisPlugin,
  PluginAPI,
  PluginContext,
  PluginMetric,
} from '../types';
import type { CommitData, AnalysisResult, FiberNode } from '@/shared/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Tracked Context Provider instance
 */
export interface TrackedProvider {
  /** Unique provider ID */
  id: string;
  /** Context display name */
  contextName: string;
  /** Component that owns this provider */
  componentName: string;
  /** Nesting depth (0 = root level) */
  depth: number;
  /** Parent provider IDs */
  parentIds: string[];
  /** Child provider IDs */
  childIds: string[];
  /** First seen timestamp */
  firstSeen: number;
  /** Number of commits this provider appeared in */
  commitCount: number;
  /** Whether this provider causes frequent updates */
  highFrequency: boolean;
  /** Estimated render cost */
  estimatedCost: number;
}

/**
 * Context nesting information
 */
export interface ContextNestingInfo {
  /** Maximum nesting depth observed */
  maxDepth: number;
  /** Provider chains (sequences of nested providers) */
  chains: Array<{
    /** Chain ID */
    id: string;
    /** Provider IDs in this chain */
    providerIds: string[];
    /** Chain length */
    length: number;
    /** Context names in order */
    contextNames: string[];
  }>;
  /** Contexts that are frequently nested together */
  frequentPairs: Array<{
    /** First context name */
    contextA: string;
    /** Second context name */
    contextB: string;
    /** Number of times nested together */
    count: number;
  }>;
}

/**
 * Provider tracking state
 */
export interface ProviderTrackingState {
  /** All tracked providers */
  providers: Map<string, TrackedProvider>;
  /** Context name to provider IDs mapping */
  contextToProviders: Map<string, string[]>;
  /** Nesting information */
  nesting: ContextNestingInfo;
  /** Provider update frequency tracking */
  updateFrequency: Map<string, number[]>;
  /** Performance metrics */
  metrics: {
    /** Total unique providers */
    totalProviders: number;
    /** Total unique contexts */
    totalContexts: number;
    /** Average nesting depth */
    averageDepth: number;
    /** Providers flagged as high-frequency */
    highFrequencyCount: number;
    /** Estimated total render cost */
    totalEstimatedCost: number;
  };
}

/**
 * Provider analysis result
 */
export interface ProviderAnalysisResult {
  /** Provider metrics */
  metrics: ProviderTrackingState['metrics'];
  /** Nesting analysis */
  nesting: ContextNestingInfo;
  /** Problematic providers (potential issues) */
  problematicProviders: Array<{
    providerId: string;
    contextName: string;
    issue: 'deep-nesting' | 'high-frequency' | 'over-provisioned';
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestion: string;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const PLUGIN_ID = 'react-perf-profiler.built-in.context-provider-tracker';
const DATA_KEY = 'providerTracking';

/** Default depth threshold for flagging deep nesting */
const DEFAULT_DEPTH_THRESHOLD = 5;

/** Default update frequency threshold (updates per second) */
const DEFAULT_FREQUENCY_THRESHOLD = 10;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Detect if a fiber node is a context provider
 */
function isContextProvider(node: FiberNode): boolean {
  const name = node.displayName || '';
  return (
    name.includes('Provider') ||
    name.endsWith('.Provider') ||
    name.startsWith('Context.Provider') ||
    name.includes('ContextProvider')
  );
}

/**
 * Extract context name from provider display name
 */
function extractContextName(displayName: string): string {
  return displayName
    .replace(/\.Provider$/, '')
    .replace(/Provider$/, '')
    .replace(/Context$/, '')
    .trim() || 'AnonymousContext';
}

/**
 * Calculate provider depth from root
 */
function calculateProviderDepth(
  node: FiberNode,
  commitNodes: Map<number, FiberNode>,
  visited = new Set<number>()
): number {
  if (visited.has(node.id)) return 0;
  visited.add(node.id);

  let depth = 0;
  let currentId: number | null = node.parentId;

  while (currentId !== null) {
    const parent = commitNodes.get(currentId);
    if (!parent) break;

    if (isContextProvider(parent)) {
      depth++;
    }
    currentId = parent.parentId;
  }

  return depth;
}

/**
 * Find parent providers for a node
 */
function findParentProviders(
  node: FiberNode,
  commitNodes: Map<number, FiberNode>
): string[] {
  const parents: string[] = [];
  let currentId: number | null = node.parentId;

  while (currentId !== null) {
    const parent = commitNodes.get(currentId);
    if (!parent) break;

    if (isContextProvider(parent)) {
      const contextName = extractContextName(parent.displayName || '');
      parents.push(`${contextName}-${parent.id}`);
    }
    currentId = parent.parentId;
  }

  return parents;
}

/**
 * Detect provider chains in the tree
 */
function detectProviderChains(
  providers: Map<string, TrackedProvider>
): ContextNestingInfo['chains'] {
  const chains: ContextNestingInfo['chains'] = [];
  const visited = new Set<string>();

  for (const [id, provider] of providers) {
    if (provider.parentIds.length === 0 && !visited.has(id)) {
      // This is a root provider, trace the chain
      const chainIds: string[] = [];
      const contextNames: string[] = [];
      let currentId: string | undefined = id;

      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        const current = providers.get(currentId);
        if (!current) break;

        chainIds.push(currentId);
        contextNames.push(current.contextName);

        // Find first child (simple chain detection)
        currentId = current.childIds[0];
      }

      if (chainIds.length > 1) {
        chains.push({
          id: `chain-${chains.length}`,
          providerIds: chainIds,
          length: chainIds.length,
          contextNames,
        });
      }
    }
  }

  return chains;
}

/**
 * Find frequently nested context pairs
 */
function findFrequentPairs(
  providers: Map<string, TrackedProvider>
): ContextNestingInfo['frequentPairs'] {
  const pairCounts = new Map<string, { a: string; b: string; count: number }>();

  for (const provider of providers.values()) {
    for (const parentId of provider.parentIds) {
      const parent = providers.get(parentId);
      if (!parent) continue;

      const pair = [parent.contextName, provider.contextName].sort();
      const key = pair.join('::');
      const existing = pairCounts.get(key);

      if (existing) {
        existing.count++;
      } else {
        pairCounts.set(key, { a: pair[0]!, b: pair[1]!, count: 1 });
      }
    }
  }

  return Array.from(pairCounts.values())
    .filter((p) => p.count > 2)
    .map((p) => ({ contextA: p.a, contextB: p.b, count: p.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Context Provider Tracker Plugin
 *
 * Tracks React Context providers and analyzes their nesting patterns
 * to help identify performance issues related to context usage.
 */
export const contextProviderTracker: AnalysisPlugin = {
  metadata: {
    id: PLUGIN_ID,
    name: 'Context Provider Tracker',
    version: '1.0.0',
    description: 'Tracks context providers and analyzes nesting patterns',
    enabledByDefault: false,
    settingsSchema: [
      {
        key: 'depthThreshold',
        name: 'Depth Threshold',
        description: 'Maximum allowed nesting depth before warning',
        type: 'number',
        defaultValue: DEFAULT_DEPTH_THRESHOLD,
        min: 2,
        max: 20,
      },
      {
        key: 'frequencyThreshold',
        name: 'Frequency Threshold',
        description: 'Updates per second threshold for high-frequency warning',
        type: 'number',
        defaultValue: DEFAULT_FREQUENCY_THRESHOLD,
        min: 1,
        max: 100,
      },
      {
        key: 'trackAnonymousContexts',
        name: 'Track Anonymous Contexts',
        description: 'Track contexts without display names',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },

  hooks: {
    /**
     * Called when a new commit is captured
     * Tracks providers and their nesting
     */
    onCommit(commit: CommitData, api: PluginAPI, context: PluginContext): void {
      const settings = context.getSettings<{
        trackAnonymousContexts?: boolean;
      }>();

      const state = api.getPluginData<ProviderTrackingState>(DATA_KEY) || {
        providers: new Map(),
        contextToProviders: new Map(),
        nesting: {
          maxDepth: 0,
          chains: [],
          frequentPairs: [],
        },
        updateFrequency: new Map(),
        metrics: {
          totalProviders: 0,
          totalContexts: 0,
          averageDepth: 0,
          highFrequencyCount: 0,
          totalEstimatedCost: 0,
        },
      };

      if (!commit.nodes) return;

      const nodeMap = new Map(commit.nodes.map((n) => [n.id, n]));

      for (const node of commit.nodes) {
        if (!isContextProvider(node)) continue;

        const contextName = extractContextName(node.displayName || '');

        // Skip anonymous contexts if not tracking them
        if (contextName === 'AnonymousContext' && !settings.trackAnonymousContexts) {
          continue;
        }

        const providerId = `${contextName}-${node.id}`;
        const depth = calculateProviderDepth(node, nodeMap);
        const parentIds = findParentProviders(node, nodeMap);

        // Update or create provider tracking
        let provider = state.providers.get(providerId);
        if (!provider) {
          provider = {
            id: providerId,
            contextName,
            componentName: node.displayName || 'Unknown',
            depth,
            parentIds,
            childIds: [],
            firstSeen: commit.timestamp,
            commitCount: 0,
            highFrequency: false,
            estimatedCost: 0,
          };
          state.providers.set(providerId, provider);

          // Update context to providers mapping
          const existing = state.contextToProviders.get(contextName) || [];
          if (!existing.includes(providerId)) {
            existing.push(providerId);
            state.contextToProviders.set(contextName, existing);
          }
        }

        provider.commitCount++;
        provider.depth = Math.max(provider.depth, depth);

        // Update child relationships
        for (const parentId of parentIds) {
          const parent = state.providers.get(parentId);
          if (parent && !parent.childIds.includes(providerId)) {
            parent.childIds.push(providerId);
          }
        }

        // Track update frequency
        const timestamps = state.updateFrequency.get(providerId) || [];
        timestamps.push(commit.timestamp);
        // Keep only last 100 timestamps
        if (timestamps.length > 100) timestamps.shift();
        state.updateFrequency.set(providerId, timestamps);

        // Update max depth
        state.nesting.maxDepth = Math.max(state.nesting.maxDepth, depth);
      }

      api.setPluginData(DATA_KEY, state);
    },

    /**
     * Called during analysis phase
     * Generates provider analysis results
     */
    onAnalyze(
      _commits: CommitData[],
      api: PluginAPI,
      context: PluginContext
    ): Partial<AnalysisResult> {
      const state = api.getPluginData<ProviderTrackingState>(DATA_KEY);
      if (!state || state.providers.size === 0) {
        return {};
      }

      const settings = context.getSettings<{
        depthThreshold?: number;
        frequencyThreshold?: number;
      }>();

      const depthThreshold = settings.depthThreshold ?? DEFAULT_DEPTH_THRESHOLD;
      const frequencyThreshold = settings.frequencyThreshold ?? DEFAULT_FREQUENCY_THRESHOLD;

      // Detect chains and frequent pairs
      state.nesting.chains = detectProviderChains(state.providers);
      state.nesting.frequentPairs = findFrequentPairs(state.providers);

      // Calculate metrics
      let totalDepth = 0;
      let highFrequencyCount = 0;
      let totalEstimatedCost = 0;

      const problematicProviders: ProviderAnalysisResult['problematicProviders'] = [];

      for (const provider of state.providers.values()) {
        totalDepth += provider.depth;

        // Calculate update frequency
        const timestamps = state.updateFrequency.get(provider.id) || [];
        if (timestamps.length >= 2) {
          const timeSpan =
            (timestamps[timestamps.length - 1]! - timestamps[0]!) / 1000;
          const frequency = timeSpan > 0 ? timestamps.length / timeSpan : 0;

          if (frequency > frequencyThreshold) {
            provider.highFrequency = true;
            highFrequencyCount++;

            problematicProviders.push({
              providerId: provider.id,
              contextName: provider.contextName,
              issue: 'high-frequency',
              severity: frequency > frequencyThreshold * 2 ? 'high' : 'medium',
              description: `Context "${provider.contextName}" updates ${frequency.toFixed(1)} times/second`,
              suggestion: 'Consider using atomic state selectors or splitting the context',
            });
          }
        }

        // Check for deep nesting
        if (provider.depth > depthThreshold) {
          problematicProviders.push({
            providerId: provider.id,
            contextName: provider.contextName,
            issue: 'deep-nesting',
            severity: provider.depth > depthThreshold + 3 ? 'high' : 'medium',
            description: `Context "${provider.contextName}" is nested ${provider.depth} levels deep`,
            suggestion: 'Consider flattening your provider hierarchy or co-locating state',
          });
        }

        // Estimate render cost (simplified)
        provider.estimatedCost = provider.commitCount * (provider.depth + 1);
        totalEstimatedCost += provider.estimatedCost;
      }

      state.metrics = {
        totalProviders: state.providers.size,
        totalContexts: state.contextToProviders.size,
        averageDepth: totalDepth / Math.max(1, state.providers.size),
        highFrequencyCount,
        totalEstimatedCost,
      };

      api.setPluginData(DATA_KEY, state);

      return {
        providerMetrics: state.metrics,
        providerNesting: state.nesting,
        providerIssues: problematicProviders,
      } as Partial<AnalysisResult>;
    },

    /**
     * Called when analysis completes
     * Returns metrics to display
     */
    onAnalysisComplete(
      _result: AnalysisResult,
      api: PluginAPI,
      _context: PluginContext
    ): PluginMetric[] {
      const state = api.getPluginData<ProviderTrackingState>(DATA_KEY);
      if (!state) return [];

      return [
        {
          id: 'total-providers',
          name: 'Total Providers',
          value: state.metrics.totalProviders,
          formattedValue: String(state.metrics.totalProviders),
          description: 'Number of unique context providers',
          category: 'Context',
          priority: 1,
        },
        {
          id: 'total-contexts',
          name: 'Unique Contexts',
          value: state.metrics.totalContexts,
          formattedValue: String(state.metrics.totalContexts),
          description: 'Number of unique context types',
          category: 'Context',
          priority: 2,
        },
        {
          id: 'max-nesting-depth',
          name: 'Max Nesting Depth',
          value: state.nesting.maxDepth,
          formattedValue: String(state.nesting.maxDepth),
          description: 'Maximum provider nesting depth',
          trend: state.nesting.maxDepth > 5 ? 'up' : 'neutral',
          trendPositive: state.nesting.maxDepth <= 5,
          category: 'Context',
          priority: 3,
        },
        {
          id: 'avg-nesting-depth',
          name: 'Avg Nesting Depth',
          value: Number(state.metrics.averageDepth.toFixed(2)),
          formattedValue: state.metrics.averageDepth.toFixed(2),
          description: 'Average provider nesting depth',
          category: 'Context',
          priority: 4,
        },
        {
          id: 'high-frequency-providers',
          name: 'High-Frequency Providers',
          value: state.metrics.highFrequencyCount,
          formattedValue: String(state.metrics.highFrequencyCount),
          description: 'Providers updating more than threshold',
          trend: state.metrics.highFrequencyCount > 0 ? 'up' : 'neutral',
          trendPositive: state.metrics.highFrequencyCount === 0,
          category: 'Context',
          priority: 5,
        },
        {
          id: 'provider-chains',
          name: 'Provider Chains',
          value: state.nesting.chains.length,
          formattedValue: String(state.nesting.chains.length),
          description: 'Detected provider nesting chains',
          category: 'Context',
          priority: 6,
        },
      ];
    },

    /**
     * Called when exporting data
     */
    onExport(
      data: Record<string, unknown>,
      api: PluginAPI,
      _context: PluginContext
    ): Record<string, unknown> {
      const state = api.getPluginData<ProviderTrackingState>(DATA_KEY);
      if (!state) {
        return data;
      }

      // Convert Maps to serializable objects
      const serializableState = {
        providers: Array.from(state.providers.entries()),
        contextToProviders: Array.from(state.contextToProviders.entries()),
        nesting: state.nesting,
        updateFrequency: Array.from(state.updateFrequency.entries()),
        metrics: state.metrics,
      };

      return {
        ...data,
        providerTracking: {
          version: '1.0.0',
          state: serializableState,
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
      const providerData = data['providerTracking'] as
        | {
            version: string;
            state: {
              providers: [string, TrackedProvider][];
              contextToProviders: [string, string[]][];
              nesting: ContextNestingInfo;
              updateFrequency: [string, number[]][];
              metrics: ProviderTrackingState['metrics'];
            };
          }
        | undefined;

      if (providerData?.state) {
        const state: ProviderTrackingState = {
          providers: new Map(providerData.state.providers),
          contextToProviders: new Map(providerData.state.contextToProviders),
          nesting: providerData.state.nesting,
          updateFrequency: new Map(providerData.state.updateFrequency),
          metrics: providerData.state.metrics,
        };

        api.setPluginData(DATA_KEY, state);
        context.log('info', `Restored ${state.providers.size} tracked providers`);
      }
    },

    /**
     * Called when data is cleared
     */
    onClearData(api: PluginAPI, context: PluginContext): void {
      const emptyState: ProviderTrackingState = {
        providers: new Map(),
        contextToProviders: new Map(),
        nesting: {
          maxDepth: 0,
          chains: [],
          frequentPairs: [],
        },
        updateFrequency: new Map(),
        metrics: {
          totalProviders: 0,
          totalContexts: 0,
          averageDepth: 0,
          highFrequencyCount: 0,
          totalEstimatedCost: 0,
        },
      };

      api.setPluginData(DATA_KEY, emptyState);
      context.log('info', 'Provider tracking data cleared');
    },
  },

  /**
   * Get metrics for display
   */
  getMetrics(api: PluginAPI): PluginMetric[] {
    const state = api.getPluginData<ProviderTrackingState>(DATA_KEY);
    if (!state) return [];

    return [
      {
        id: 'provider-count',
        name: 'Context Providers',
        value: state.metrics.totalProviders,
        formattedValue: `${state.metrics.totalProviders} providers`,
        category: 'Context',
      },
      {
        id: 'nesting-depth',
        name: 'Nesting Depth',
        value: state.nesting.maxDepth,
        formattedValue: `${state.nesting.maxDepth} levels`,
        trend: state.nesting.maxDepth > 5 ? 'up' : 'neutral',
        trendPositive: state.nesting.maxDepth <= 5,
        category: 'Context',
      },
    ];
  },
};

export default contextProviderTracker;
