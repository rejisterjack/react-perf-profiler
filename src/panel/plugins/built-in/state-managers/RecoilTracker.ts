/**
 * Recoil State Manager Plugin
 * Tracks Recoil selectors and atom dependencies
 * @module panel/plugins/built-in/state-managers/RecoilTracker
 */

import type { AnalysisPlugin, PluginAPI, PluginContext, PluginMetric } from '@/panel/plugins/types';

/**
 * Recoil node data (atom or selector)
 */
interface RecoilNodeData {
  key: string;
  type: 'atom' | 'selector';
  subscriberCount: number;
  updateCount: number;
  evaluationTime: number;
  dependencies: string[];
}

/**
 * Recoil Tracker Plugin
 */
export const RecoilTracker: AnalysisPlugin = {
  metadata: {
    id: 'react-perf-profiler.built-in.recoil-tracker',
    name: 'Recoil State Tracker',
    version: '1.0.0',
    description: 'Tracks Recoil atoms, selectors, and dependency flow',
    author: 'React Perf Profiler',
    enabledByDefault: false,
  },

  hooks: {
    onRecordingStart: (api, _context) => {
      api.setPluginData('nodes', new Map<string, RecoilNodeData>());
      api.setPluginData('selectorFlow', []);
      
      hookRecoil(api, _context);
    },

    onCommit: (commit, api, _context) => {
      const nodes = api.getPluginData<Map<string, RecoilNodeData>>('nodes');
      if (!nodes) return;

      // Track Recoil usage
      for (const node of commit.nodes || []) {
        const recoilKey = detectRecoilUsage(node);
        if (recoilKey) {
          const data = nodes.get(recoilKey) || {
            key: recoilKey,
            type: guessNodeType(recoilKey),
            subscriberCount: 0,
            updateCount: 0,
            evaluationTime: 0,
            dependencies: [],
          };
          
          data.subscriberCount++;
          nodes.set(recoilKey, data);
        }
      }
    },

    onAnalysisComplete: (result, api, _context) => {
      const nodes = api.getPluginData<Map<string, RecoilNodeData>>('nodes');
      if (!nodes) return [];

      const metrics: PluginMetric[] = [];
      const slowSelectors: string[] = [];
      const expensiveAtoms: string[] = [];

      for (const [key, node] of nodes) {
        // Slow selector detection
        if (node.type === 'selector' && node.evaluationTime > 16) {
          slowSelectors.push(key);
          
          metrics.push({
            id: `recoil-${key}-slow`,
            name: `Slow Selector: ${key}`,
            value: node.evaluationTime,
            formattedValue: `${node.evaluationTime.toFixed(2)}ms`,
            category: 'Recoil',
            description: 'Selector taking longer than one frame to evaluate',
            severity: node.evaluationTime > 50 ? 'critical' : 'warning',
          });
        }

        // Expensive atoms (many subscribers)
        if (node.type === 'atom' && node.subscriberCount > 20) {
          expensiveAtoms.push(key);
        }

        // Selector with deep dependencies
        if (node.type === 'selector' && node.dependencies.length > 3) {
          metrics.push({
            id: `recoil-${key}-deep`,
            name: `Deep Selector: ${key}`,
            value: node.dependencies.length,
            formattedValue: `${node.dependencies.length} deps`,
            category: 'Recoil',
            description: 'Deep selector chain may cause cascading updates',
          });
        }
      }

      if (slowSelectors.length > 0) {
        metrics.unshift({
          id: 'recoil-slow-selectors',
          name: 'Slow Selectors Detected',
          value: slowSelectors.length,
          formattedValue: `${slowSelectors.length} selectors`,
          category: 'Recoil',
          description: `Consider memoizing: ${slowSelectors.join(', ')}`,
          severity: 'warning',
        });
      }

      if (expensiveAtoms.length > 0) {
        metrics.push({
          id: 'recoil-expensive-atoms',
          name: 'Widely-Used Atoms',
          value: expensiveAtoms.length,
          formattedValue: `${expensiveAtoms.length} atoms`,
          category: 'Recoil',
          description: `Atoms with many subscribers: ${expensiveAtoms.join(', ')}`,
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
 * Hook into Recoil
 */
function hookRecoil(api: PluginAPI, context: PluginContext): void {
  if (typeof window === 'undefined') return;

  const recoil = (window as any).__RECOIL__ || (window as any).recoil;
  
  if (!recoil) {
    context.log('info', 'Recoil not detected');
    return;
  }

  context.log('info', 'Recoil detected');

  // Hook into Recoil Store if available
  const store = recoil.__INTERNAL?.current?.getState?.();
  if (store) {
    // Monitor node subscriptions
    const originalSubscribe = store.subscribeToTransactions;
    if (originalSubscribe) {
      store.subscribeToTransactions = function(callback: any) {
        return originalSubscribe.call(this, (state: any) => {
          // Track transaction
          const nodes = api.getPluginData<Map<string, RecoilNodeData>>('nodes');
          if (nodes && state?.modifiedAtoms) {
            for (const key of state.modifiedAtoms) {
              const node = nodes.get(key);
              if (node) {
                node.updateCount++;
              }
            }
          }
          
          return callback(state);
        });
      };
    }
  }
}

/**
 * Detect Recoil usage in component
 */
function detectRecoilUsage(node: any): string | null {
  const displayName = node.displayName || '';
  
  if (displayName.includes('useRecoil') || displayName.includes('Recoil')) {
    return displayName;
  }

  if (node.props?.recoilState) {
    return node.props.recoilState;
  }

  return null;
}

/**
 * Guess if node is atom or selector from key
 */
function guessNodeType(key: string): 'atom' | 'selector' {
  if (key.toLowerCase().includes('selector')) return 'selector';
  if (key.toLowerCase().includes('atom')) return 'atom';
  return 'atom'; // Default
}

export default RecoilTracker;
