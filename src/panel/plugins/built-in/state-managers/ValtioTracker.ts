/**
 * Valtio State Manager Plugin
 * Tracks proxy state usage and mutations
 * @module panel/plugins/built-in/state-managers/ValtioTracker
 */

import type { AnalysisPlugin, PluginAPI, PluginContext, PluginMetric } from '@/panel/plugins/types';

/**
 * Valtio proxy tracking data
 */
interface ProxyData {
  name: string;
  subscriberCount: number;
  mutationCount: number;
  readCount: number;
  lastMutation: number;
  properties: Map<string, number>; // Property access counts
}

/**
 * Valtio Tracker Plugin
 */
export const ValtioTracker: AnalysisPlugin = {
  metadata: {
    id: 'react-perf-profiler.built-in.valtio-tracker',
    name: 'Valtio Proxy Tracker',
    version: '1.0.0',
    description: 'Tracks Valtio proxy state mutations and subscriptions',
    author: 'React Perf Profiler',
    enabledByDefault: false,
  },

  hooks: {
    onRecordingStart: (api, _context) => {
      api.setPluginData('proxies', new Map<string, ProxyData>());
      api.setPluginData('mutationLog', []);
      
      hookValtio(api, _context);
    },

    onCommit: (commit, api, _context) => {
      const proxies = api.getPluginData<Map<string, ProxyData>>('proxies');
      if (!proxies) return;

      // Track proxy usage in components
      for (const node of commit.nodes || []) {
        const proxyName = detectValtioUsage(node);
        if (proxyName) {
          const proxy = proxies.get(proxyName) || {
            name: proxyName,
            subscriberCount: 0,
            mutationCount: 0,
            readCount: 0,
            lastMutation: 0,
            properties: new Map(),
          };
          
          proxy.subscriberCount++;
          proxies.set(proxyName, proxy);
        }
      }
    },

    onAnalysisComplete: (result, api, _context) => {
      const proxies = api.getPluginData<Map<string, ProxyData>>('proxies');
      if (!proxies) return [];

      const metrics: PluginMetric[] = [];
      const highMutationProxies: string[] = [];
      const unusedProxies: string[] = [];

      for (const [name, proxy] of proxies) {
        // High mutation rate
        if (proxy.mutationCount > 50) {
          highMutationProxies.push(name);
          
          metrics.push({
            id: `valtio-${name}-mutations`,
            name: `${name} Mutations`,
            value: proxy.mutationCount,
            formattedValue: `${proxy.mutationCount} mutations`,
            category: 'Valtio',
            description: 'High mutation rate may cause excessive re-renders',
            severity: proxy.mutationCount > 100 ? 'warning' : 'info',
          });
        }

        // Unused proxy (subscribed but never read)
        if (proxy.subscriberCount > 0 && proxy.readCount === 0) {
          unusedProxies.push(name);
        }

        // Property access heatmap
        const hotProperties = Array.from(proxy.properties.entries())
          .filter(([, count]) => count > 20)
          .map(([prop]) => prop);

        if (hotProperties.length > 0) {
          metrics.push({
            id: `valtio-${name}-hotprops`,
            name: `${name} Hot Properties`,
            value: hotProperties.length,
            formattedValue: `${hotProperties.length} properties`,
            category: 'Valtio',
            description: `Frequently accessed: ${hotProperties.join(', ')}`,
          });
        }
      }

      if (highMutationProxies.length > 0) {
        metrics.unshift({
          id: 'valtio-high-mutation',
          name: 'High Mutation Rate',
          value: highMutationProxies.length,
          formattedValue: `${highMutationProxies.length} proxies`,
          category: 'Valtio',
          description: 'Consider batching or debouncing updates',
          severity: 'warning',
        });
      }

      if (unusedProxies.length > 0) {
        metrics.push({
          id: 'valtio-unused',
          name: 'Unused Proxy Subscriptions',
          value: unusedProxies.length,
          formattedValue: `${unusedProxies.length} proxies`,
          category: 'Valtio',
          description: `Unused: ${unusedProxies.join(', ')}`,
        });
      }

      return metrics;
    },

    onClearData: (api, _context) => {
      api.clearPluginData();
    },
  },
};

/**
 * Hook into Valtio
 */
function hookValtio(api: PluginAPI, context: PluginContext): void {
  if (typeof window === 'undefined') return;

  const valtio = (window as any).__VALTIO__ || (window as any).valtio;
  
  if (!valtio) {
    context.log('info', 'Valtio not detected');
    return;
  }

  context.log('info', 'Valtio detected');

  // Hook proxy creation
  const originalProxy = valtio.proxy;
  if (originalProxy) {
    valtio.proxy = (initialObject: any, options?: any) => {
      const proxy = originalProxy(initialObject, options);
      const proxyName = options?.name || 'anonymous';

      // Wrap in tracking proxy
      const trackingProxy = new Proxy(proxy, {
        set(target, prop, value) {
          const proxies = api.getPluginData<Map<string, ProxyData>>('proxies');
          if (proxies) {
            const data = proxies.get(proxyName) || {
              name: proxyName,
              subscriberCount: 0,
              mutationCount: 0,
              readCount: 0,
              lastMutation: 0,
              properties: new Map(),
            };
            data.mutationCount++;
            data.lastMutation = Date.now();
            proxies.set(proxyName, data);
          }
          return Reflect.set(target, prop, value);
        },
        get(target, prop) {
          const proxies = api.getPluginData<Map<string, ProxyData>>('proxies');
          if (proxies && typeof prop === 'string') {
            const data = proxies.get(proxyName);
            if (data) {
              data.readCount++;
              const current = data.properties.get(prop) || 0;
              data.properties.set(prop, current + 1);
            }
          }
          return Reflect.get(target, prop);
        },
      });

      return trackingProxy;
    };
  }
}

/**
 * Detect Valtio usage in component
 */
function detectValtioUsage(node: any): string | null {
  const displayName = node.displayName || '';
  
  if (displayName.includes('useSnapshot') || displayName.includes('proxy')) {
    return displayName;
  }

  return null;
}

export default ValtioTracker;
