/**
 * Zustand State Manager Plugin
 * Tracks Zustand store subscriptions and state changes
 * @module panel/plugins/built-in/state-managers/ZustandTracker
 */

import type { AnalysisPlugin, PluginAPI, PluginContext, PluginMetric } from '@/panel/plugins/types';

/**
 * Zustand store tracking data
 */
interface StoreData {
  name: string;
  subscribeCount: number;
  updateCount: number;
  selectors: Map<string, number>;
  lastUpdate: number;
}

/**
 * Zustand Tracker Plugin
 */
export const ZustandTracker: AnalysisPlugin = {
  metadata: {
    id: 'react-perf-profiler.built-in.zustand-tracker',
    name: 'Zustand Store Tracker',
    version: '1.0.0',
    description: 'Tracks Zustand store subscriptions and selector performance',
    author: 'React Perf Profiler',
    enabledByDefault: false,
  },

  hooks: {
    onRecordingStart: (api, _context) => {
      api.setPluginData('stores', new Map<string, StoreData>());
      api.setPluginData('renderTriggers', []);
      
      // Hook into Zustand if available
      hookZustand(api, _context);
    },

    onCommit: (commit, api, _context) => {
      const stores = api.getPluginData<Map<string, StoreData>>('stores');
      if (!stores) return;

      // Check if any component is a Zustand subscriber
      for (const node of commit.nodes || []) {
        const storeName = detectZustandUsage(node);
        if (storeName) {
          const store = stores.get(storeName) || {
            name: storeName,
            subscribeCount: 0,
            updateCount: 0,
            selectors: new Map(),
            lastUpdate: Date.now(),
          };
          
          store.subscribeCount++;
          stores.set(storeName, store);
        }
      }
    },

    onAnalysisComplete: (result, api, _context) => {
      const stores = api.getPluginData<Map<string, StoreData>>('stores');
      if (!stores) return [];

      const metrics: PluginMetric[] = [];
      
      for (const [name, store] of stores) {
        metrics.push({
          id: `zustand-${name}-subscribers`,
          name: `${name} Subscribers`,
          value: store.subscribeCount,
          formattedValue: `${store.subscribeCount} components`,
          category: 'Zustand',
          description: `Components subscribed to ${name} store`,
        });

        metrics.push({
          id: `zustand-${name}-updates`,
          name: `${name} Updates`,
          value: store.updateCount,
          formattedValue: `${store.updateCount} updates`,
          category: 'Zustand',
          description: `State updates in ${name} store`,
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
 * Hook into Zustand global store
 */
function hookZustand(api: PluginAPI, context: PluginContext): void {
  if (typeof window === 'undefined') return;

  // Check if Zustand is available
  const zustand = (window as any).__ZUSTAND__ || (window as any).zustand;
  if (!zustand) {
    context.log('info', 'Zustand not detected');
    return;
  }

  context.log('info', 'Zustand detected, hooking into stores');

  // Hook store creation
  const originalCreate = zustand.create;
  if (originalCreate) {
    (window as any).__ZUSTAND__.create = function(...args: any[]) {
      const store = originalCreate.apply(this, args);
      const storeName = args[0]?.name || 'anonymous';

      // Wrap setState to track updates
      const originalSetState = store.setState;
      store.setState = function(...setArgs: any[]) {
        const stores = api.getPluginData<Map<string, StoreData>>('stores');
        if (stores) {
          const data = stores.get(storeName) || {
            name: storeName,
            subscribeCount: 0,
            updateCount: 0,
            selectors: new Map(),
            lastUpdate: Date.now(),
          };
          data.updateCount++;
          data.lastUpdate = Date.now();
          stores.set(storeName, data);
        }

        return originalSetState.apply(this, setArgs);
      };

      return store;
    };
  }
}

/**
 * Detect if a component uses Zustand
 */
function detectZustandUsage(node: any): string | null {
  // Check for Zustand hook patterns in component
  const displayName = node.displayName || '';
  
  // Look for store hook usage in props or hooks
  if (node.props?.useStore || node.props?.store) {
    return node.props.storeName || 'store';
  }

  // Check display name patterns
  if (displayName.includes('Store') || displayName.includes('useStore')) {
    return displayName;
  }

  return null;
}

export default ZustandTracker;
