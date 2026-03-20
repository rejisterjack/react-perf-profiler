/**
 * Redux Action Tracker Plugin
 * @module panel/plugins/built-in/ReduxActionTracker
 *
 * Tracks Redux actions dispatched during profiling and correlates them with React commits.
 * Useful for identifying which actions trigger unnecessary re-renders.
 */

import type { AnalysisPlugin, CommitData, AnalysisResult, PluginAPI, PluginContext } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Tracked Redux action
 */
export interface TrackedAction {
  /** Unique action ID */
  id: string;
  /** Action type */
  type: string;
  /** Action payload */
  payload?: unknown;
  /** Timestamp when action was dispatched */
  timestamp: number;
  /** Commit IDs that occurred after this action */
  relatedCommitIds: string[];
  /** Duration from action to first related commit */
  timeToCommit?: number;
  /** Whether action caused any re-renders */
  causedRerender: boolean;
}

/**
 * Redux tracking state stored in plugin data
 */
export interface ReduxTrackingState {
  /** All tracked actions */
  actions: TrackedAction[];
  /** Action to commit correlation map */
  actionCommitMap: Record<string, string[]>;
  /** Actions per commit */
  commitsPerAction: Record<string, number>;
  /** Performance metrics */
  metrics: {
    totalActions: number;
    actionsCausingRerenders: number;
    averageTimeToCommit: number;
    mostExpensiveActionTypes: Array<{ type: string; count: number; avgTime: number }>;
  };
}

// =============================================================================
// Constants
// =============================================================================

const PLUGIN_ID = 'react-perf-profiler.built-in.redux-action-tracker';
const DATA_KEY = 'reduxTracking';
const ACTION_WINDOW_MS = 50; // Window to correlate actions with commits

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Redux Action Tracker Plugin
 *
 * Tracks Redux actions and correlates them with React commits to identify
 * which actions cause unnecessary re-renders.
 *
 * @example
 * ```typescript
 * import { reduxActionTracker } from './built-in/ReduxActionTracker';
 *
 * // Register plugin
 * pluginManager.register(reduxActionTracker);
 *
 * // In your app, dispatch actions with metadata
 * store.dispatch({
 *   type: 'USER_UPDATE',
 *   payload: userData,
 *   __reduxProfiler: { track: true }
 * });
 * ```
 */
export const reduxActionTracker: AnalysisPlugin = {
  metadata: {
    id: PLUGIN_ID,
    name: 'Redux Action Tracker',
    version: '1.0.0',
    description: 'Tracks Redux actions and correlates them with React commits',
    enabledByDefault: false,
    settingsSchema: [
      {
        key: 'trackAllActions',
        name: 'Track All Actions',
        description: 'Track all dispatched actions, not just marked ones',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'actionWindowMs',
        name: 'Action Window (ms)',
        description: 'Time window to correlate actions with commits',
        type: 'number',
        defaultValue: 50,
        min: 10,
        max: 500,
      },
      {
        key: 'maxActionsTracked',
        name: 'Max Actions Tracked',
        description: 'Maximum number of actions to keep in memory',
        type: 'number',
        defaultValue: 1000,
        min: 100,
        max: 10000,
      },
      {
        key: 'ignoredActionTypes',
        name: 'Ignored Action Types',
        description: 'Comma-separated list of action types to ignore',
        type: 'string',
        defaultValue: '@@redux/INIT,@@INIT',
      },
    ],
  },

  hooks: {
    /**
     * Called when a new commit is captured
     * Correlates the commit with recent Redux actions
     */
    onCommit(commit: CommitData, api: PluginAPI, context: PluginContext): void {
      const settings = context.getSettings<{
        actionWindowMs?: number;
        ignoredActionTypes?: string;
      }>();

      const state = api.getPluginData<ReduxTrackingState>(DATA_KEY) || {
        actions: [],
        actionCommitMap: {},
        commitsPerAction: {},
        metrics: {
          totalActions: 0,
          actionsCausingRerenders: 0,
          averageTimeToCommit: 0,
          mostExpensiveActionTypes: [],
        },
      };

      const windowMs = settings.actionWindowMs ?? ACTION_WINDOW_MS;
      const commitTime = commit.timestamp;

      // Find actions within the correlation window
      const correlatedActions = state.actions.filter((action) => {
        const timeDiff = commitTime - action.timestamp;
        return timeDiff >= 0 && timeDiff <= windowMs;
      });

      // Update action correlations
      for (const action of correlatedActions) {
        if (!action.relatedCommitIds.includes(commit.id)) {
          action.relatedCommitIds.push(commit.id);
          action.causedRerender = true;

          if (action.relatedCommitIds.length === 1) {
            action.timeToCommit = commitTime - action.timestamp;
          }
        }
      }

      api.setPluginData(DATA_KEY, state);
    },

    /**
     * Called during analysis phase
     * Generates Redux-specific analysis results
     */
    onAnalyze(commits: CommitData[], api: PluginAPI, context: PluginContext): Partial<AnalysisResult> {
      const state = api.getPluginData<ReduxTrackingState>(DATA_KEY);
      if (!state || state.actions.length === 0) {
        return {};
      }

      const settings = context.getSettings<{
        ignoredActionTypes?: string;
      }>();

      const ignoredTypes = new Set(
        (settings.ignoredActionTypes ?? '').split(',').map((s) => s.trim())
      );

      // Filter out ignored actions
      const relevantActions = state.actions.filter(
        (action) => !ignoredTypes.has(action.type)
      );

      // Calculate metrics
      const actionsWithRerenders = relevantActions.filter((a) => a.causedRerender);
      const avgTimeToCommit =
        actionsWithRerenders.reduce((sum, a) => sum + (a.timeToCommit || 0), 0) /
        Math.max(1, actionsWithRerenders.length);

      // Group by action type for analysis
      const actionTypeStats = new Map<
        string,
        { count: number; totalTime: number; rerenders: number }
      >();

      for (const action of relevantActions) {
        const stats = actionTypeStats.get(action.type) || {
          count: 0,
          totalTime: 0,
          rerenders: 0,
        };
        stats.count++;
        stats.totalTime += action.timeToCommit || 0;
        if (action.causedRerender) {
          stats.rerenders++;
        }
        actionTypeStats.set(action.type, stats);
      }

      // Sort by most expensive (by count * avg time)
      const mostExpensive = Array.from(actionTypeStats.entries())
        .map(([type, stats]) => ({
          type,
          count: stats.count,
          avgTime: stats.totalTime / Math.max(1, stats.rerenders),
        }))
        .sort((a, b) => b.count * b.avgTime - a.count * a.avgTime)
        .slice(0, 10);

      // Update metrics
      state.metrics = {
        totalActions: relevantActions.length,
        actionsCausingRerenders: actionsWithRerenders.length,
        averageTimeToCommit: avgTimeToCommit,
        mostExpensiveActionTypes: mostExpensive,
      };

      api.setPluginData(DATA_KEY, state);

      return {
        // Add custom metrics to analysis result
        reduxMetrics: state.metrics,
      } as Partial<AnalysisResult>;
    },

    /**
     * Called when exporting data
     * Includes Redux tracking data in export
     */
    onExport(
      data: Record<string, unknown>,
      api: PluginAPI,
      context: PluginContext
    ): Record<string, unknown> {
      const state = api.getPluginData<ReduxTrackingState>(DATA_KEY);
      if (!state) {
        return data;
      }

      return {
        ...data,
        reduxTracking: {
          version: '1.0.0',
          actions: state.actions,
          metrics: state.metrics,
          exportedAt: Date.now(),
        },
      };
    },

    /**
     * Called when importing data
     * Restores Redux tracking state
     */
    onImport(
      data: Record<string, unknown>,
      api: PluginAPI,
      context: PluginContext
    ): void {
      const reduxData = data.reduxTracking as
        | {
            version: string;
            actions: TrackedAction[];
            metrics: ReduxTrackingState['metrics'];
          }
        | undefined;

      if (reduxData?.actions) {
        const state: ReduxTrackingState = {
          actions: reduxData.actions,
          actionCommitMap: {},
          commitsPerAction: {},
          metrics: reduxData.metrics || {
            totalActions: reduxData.actions.length,
            actionsCausingRerenders: 0,
            averageTimeToCommit: 0,
            mostExpensiveActionTypes: [],
          },
        };

        // Rebuild action commit map
        for (const action of state.actions) {
          state.actionCommitMap[action.id] = action.relatedCommitIds;
        }

        api.setPluginData(DATA_KEY, state);
        context.log('info', `Restored ${state.actions.length} tracked actions`);
      }
    },

    /**
     * Called when data is cleared
     * Clears Redux tracking state
     */
    onClearData(api: PluginAPI, context: PluginContext): void {
      const emptyState: ReduxTrackingState = {
        actions: [],
        actionCommitMap: {},
        commitsPerAction: {},
        metrics: {
          totalActions: 0,
          actionsCausingRerenders: 0,
          averageTimeToCommit: 0,
          mostExpensiveActionTypes: [],
        },
      };

      api.setPluginData(DATA_KEY, emptyState);
      context.log('info', 'Redux tracking data cleared');
    },
  },
};

// =============================================================================
// Public API for Redux Integration
// =============================================================================

/**
 * Redux middleware for tracking actions
 * Add this to your Redux store middleware chain
 *
 * @example
 * ```typescript
 * import { createStore, applyMiddleware } from 'redux';
 * import { createReduxProfilerMiddleware } from 'react-perf-profiler/panel/plugins/built-in/ReduxActionTracker';
 *
 * const store = createStore(
 *   reducer,
 *   applyMiddleware(createReduxProfilerMiddleware())
 * );
 * ```
 */
export function createReduxProfilerMiddleware() {
  return (store: unknown) => (next: (action: unknown) => unknown) => (action: unknown) => {
    // Track the action
    trackReduxAction(action as { type: string; payload?: unknown });

    // Pass through to next middleware
    return next(action);
  };
}

/**
 * Track a Redux action manually
 * Call this from your app to track actions with the profiler
 */
export function trackReduxAction(action: { type: string; payload?: unknown }): void {
  // This function would be called from the app side
  // In a real implementation, this would send a message to the profiler
  // For now, we just log it
  if (typeof window !== 'undefined' && (window as unknown as { __REACT_PROFILER__?: { trackAction?: (action: TrackedAction) => void } }).__REACT_PROFILER__?.trackAction) {
    const trackedAction: TrackedAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: action.type,
      payload: action.payload,
      timestamp: Date.now(),
      relatedCommitIds: [],
      causedRerender: false,
    };

    (window as unknown as { __REACT_PROFILER__: { trackAction: (action: TrackedAction) => void } }).__REACT_PROFILER__.trackAction(trackedAction);
  }
}

export default reduxActionTracker;
