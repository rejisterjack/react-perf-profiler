/**
 * Jotai State Manager Plugin
 * Tracks atom dependencies and updates
 * @module panel/plugins/built-in/state-managers/JotaiTracker
 */

import type { AnalysisPlugin, PluginAPI, PluginContext, PluginMetric } from '@/panel/plugins/types';

/**
 * Atom tracking data
 */
interface AtomData {
  key: string;
  label?: string;
  subscriberCount: number;
  updateCount: number;
  dependencies: Set<string>;
  dependents: Set<string>;
}

/**
 * Jotai Tracker Plugin
 */
export const JotaiTracker: AnalysisPlugin = {
  metadata: {
    id: 'react-perf-profiler.built-in.jotai-tracker',
    name: 'Jotai Atom Tracker',
    version: '1.0.0',
    description: 'Tracks Jotai atom dependencies and subscription patterns',
    author: 'React Perf Profiler',
    enabledByDefault: false,
  },

  hooks: {
    onRecordingStart: (api, _context) => {
      api.setPluginData('atoms', new Map<string, AtomData>());
      api.setPluginData('dependencyGraph', new Map<string, Set<string>>());
      
      hookJotai(api, _context);
    },

    onCommit: (commit, api, _context) => {
      const atoms = api.getPluginData<Map<string, AtomData>>('atoms');
      if (!atoms) return;

      // Track atom usage in components
      for (const node of commit.nodes || []) {
        const atomKey = detectJotaiUsage(node);
        if (atomKey) {
          const atom = atoms.get(atomKey) || {
            key: atomKey,
            subscriberCount: 0,
            updateCount: 0,
            dependencies: new Set(),
            dependents: new Set(),
          };
          
          atom.subscriberCount++;
          atoms.set(atomKey, atom);
        }
      }
    },

    onAnalysisComplete: (result, api, _context) => {
      const atoms = api.getPluginData<Map<string, AtomData>>('atoms');
      if (!atoms) return [];

      const metrics: PluginMetric[] = [];
      const highFrequencyAtoms: string[] = [];

      for (const [key, atom] of atoms) {
        // Atom with many subscribers
        if (atom.subscriberCount > 10) {
          metrics.push({
            id: `jotai-${key}-subscribers`,
            name: `Atom "${atom.label || key}" Subscribers`,
            value: atom.subscriberCount,
            formattedValue: `${atom.subscriberCount} components`,
            category: 'Jotai',
            description: 'Consider splitting this atom for better performance',
            severity: atom.subscriberCount > 50 ? 'warning' : 'info',
          });
        }

        // High update frequency
        if (atom.updateCount > 100) {
          highFrequencyAtoms.push(atom.label || key);
        }

        // Dependency chain analysis
        if (atom.dependencies.size > 5) {
          metrics.push({
            id: `jotai-${key}-deps`,
            name: `Atom "${atom.label || key}" Dependencies`,
            value: atom.dependencies.size,
            formattedValue: `${atom.dependencies.size} atoms`,
            category: 'Jotai',
            description: 'Deep dependency chain may cause cascading updates',
          });
        }
      }

      if (highFrequencyAtoms.length > 0) {
        metrics.push({
          id: 'jotai-high-frequency',
          name: 'High-Frequency Atoms',
          value: highFrequencyAtoms.length,
          formattedValue: `${highFrequencyAtoms.length} atoms`,
          category: 'Jotai',
          description: `Frequently updated: ${highFrequencyAtoms.join(', ')}`,
          severity: 'warning',
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
 * Hook into Jotai
 */
function hookJotai(api: PluginAPI, context: PluginContext): void {
  if (typeof window === 'undefined') return;

  const jotai = (window as any).__JOTAI__ || (window as any).jotai;
  
  if (!jotai) {
    context.log('info', 'Jotai not detected');
    return;
  }

  context.log('info', 'Jotai detected');

  // Hook into atom registration
  const originalAtom = jotai.atom;
  if (originalAtom) {
    jotai.atom = (initialValue: any, ...args: any[]) => {
      const atom = originalAtom(initialValue, ...args);
      
      const atoms = api.getPluginData<Map<string, AtomData>>('atoms');
      if (atoms) {
        atoms.set(atom.toString(), {
          key: atom.toString(),
          label: atom.debugLabel,
          subscriberCount: 0,
          updateCount: 0,
          dependencies: new Set(),
          dependents: new Set(),
        });
      }

      return atom;
    };
  }
}

/**
 * Detect Jotai usage in component
 */
function detectJotaiUsage(node: any): string | null {
  const displayName = node.displayName || '';
  
  if (displayName.includes('useAtom') || displayName.includes('atom')) {
    return displayName;
  }

  return null;
}

export default JotaiTracker;
