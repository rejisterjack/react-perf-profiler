/**
 * TanStack Query (React Query) Plugin
 * Tracks query cache performance and fetch patterns
 * @module panel/plugins/built-in/state-managers/TanStackQueryTracker
 */

import type { AnalysisPlugin, PluginAPI, PluginContext, PluginMetric } from '@/panel/plugins/types';

/**
 * Query cache entry
 */
interface QueryData {
  queryKey: string;
  fetchCount: number;
  cacheHits: number;
  cacheMisses: number;
  averageFetchTime: number;
  lastFetchTime: number;
  isStale: boolean;
}

/**
 * TanStack Query Tracker Plugin
 */
export const TanStackQueryTracker: AnalysisPlugin = {
  metadata: {
    id: 'react-perf-profiler.built-in.tanstack-query-tracker',
    name: 'TanStack Query Tracker',
    version: '1.0.0',
    description: 'Tracks React Query cache hits, misses, and fetch performance',
    author: 'React Perf Profiler',
    enabledByDefault: false,
  },

  hooks: {
    onRecordingStart: (api, _context) => {
      api.setPluginData('queries', new Map<string, QueryData>());
      api.setPluginData('cacheStats', { hits: 0, misses: 0 });
      
      hookTanStackQuery(api, _context);
    },

    onCommit: (commit, api, _context) => {
      const queries = api.getPluginData<Map<string, QueryData>>('queries');
      if (!queries) return;

      // Track query-related renders
      for (const node of commit.nodes || []) {
        const queryKey = detectQueryUsage(node);
        if (queryKey) {
          const query = queries.get(queryKey) || {
            queryKey,
            fetchCount: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageFetchTime: 0,
            lastFetchTime: 0,
            isStale: false,
          };

          // Update based on render context
          queries.set(queryKey, query);
        }
      }
    },

    onAnalysisComplete: (result, api, _context) => {
      const queries = api.getPluginData<Map<string, QueryData>>('queries');
      const cacheStats = api.getPluginData<{ hits: number; misses: number }>('cacheStats');
      
      if (!queries) return [];

      const metrics: PluginMetric[] = [];
      let totalHits = 0;
      let totalMisses = 0;

      for (const [key, query] of queries) {
        totalHits += query.cacheHits;
        totalMisses += query.cacheMisses;

        const hitRate = query.cacheHits + query.cacheMisses > 0
          ? query.cacheHits / (query.cacheHits + query.cacheMisses)
          : 0;

        metrics.push({
          id: `query-${key}-hitrate`,
          name: `${key} Cache Hit Rate`,
          value: hitRate,
          formattedValue: `${(hitRate * 100).toFixed(1)}%`,
          category: 'TanStack Query',
          description: `Cache efficiency for query "${key}"`,
          trend: hitRate > 0.8 ? 'up' : 'down',
          trendPositive: hitRate > 0.8,
        });

        if (query.averageFetchTime > 500) {
          metrics.push({
            id: `query-${key}-slow`,
            name: `${key} Slow Fetch`,
            value: query.averageFetchTime,
            formattedValue: `${query.averageFetchTime.toFixed(0)}ms`,
            category: 'TanStack Query',
            description: `Slow query detected`,
            severity: 'warning',
          });
        }
      }

      // Overall cache hit rate
      const totalRequests = totalHits + totalMisses;
      const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

      metrics.unshift({
        id: 'query-overall-hitrate',
        name: 'Overall Cache Hit Rate',
        value: overallHitRate,
        formattedValue: `${(overallHitRate * 100).toFixed(1)}%`,
        category: 'TanStack Query',
        description: 'Query cache efficiency across all queries',
        trend: overallHitRate > 0.8 ? 'up' : 'down',
        trendPositive: overallHitRate > 0.8,
      });

      return metrics;
    },

    onClearData: (api, _context) => {
      api.clearPluginData();
    },
  },
};

/**
 * Hook into TanStack Query
 */
function hookTanStackQuery(api: PluginAPI, context: PluginContext): void {
  if (typeof window === 'undefined') return;

  // Look for React Query devtools or global
  const queryClient = (window as any).__REACT_QUERY_GLOBAL_CONTEXT__?.client;
  
  if (!queryClient) {
    context.log('info', 'TanStack Query not detected');
    return;
  }

  context.log('info', 'TanStack Query detected');

  // Hook into cache
  const cache = queryClient.getQueryCache();
  
  cache.subscribe((event: any) => {
    const queries = api.getPluginData<Map<string, QueryData>>('queries');
    const cacheStats = api.getPluginData<{ hits: number; misses: number }>('cacheStats');
    
    if (!queries || !cacheStats) return;

    const query = event.query;
    const queryKey = JSON.stringify(query.queryKey);

    const data = queries.get(queryKey) || {
      queryKey,
      fetchCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageFetchTime: 0,
      lastFetchTime: 0,
      isStale: query.isStale(),
    };

    switch (event.type) {
      case 'updated':
        if (event.action.type === 'success') {
          data.fetchCount++;
          data.lastFetchTime = Date.now();
          cacheStats.misses++;
        }
        break;
      case 'observerAdded':
        // Cache hit when observer is added and data exists
        if (query.state.data) {
          data.cacheHits++;
          cacheStats.hits++;
        }
        break;
    }

    queries.set(queryKey, data);
    api.setPluginData('cacheStats', cacheStats);
  });
}

/**
 * Detect query usage in component
 */
function detectQueryUsage(node: any): string | null {
  const displayName = node.displayName || '';
  
  if (displayName.includes('useQuery') || displayName.includes('useMutation')) {
    return displayName;
  }

  if (node.props?.queryKey) {
    return JSON.stringify(node.props.queryKey);
  }

  return null;
}

export default TanStackQueryTracker;
