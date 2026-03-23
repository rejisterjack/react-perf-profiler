/**
 * Store exports for React Perf Profiler
 * Central export point for all Zustand stores and selectors
 */

// ============================================================================
// Store Exports
// ============================================================================

export { type ConnectionState, useConnectionStore } from './connectionStore';
export {
  type ComponentData,
  type PerformanceMetrics,
  type ProfilerState,
  type ProfilerStore,
  type TreeNode,
  useProfilerStore,
  type ViewMode,
} from './profilerStore';
export { DEFAULT_SETTINGS, type SettingsState, useSettingsStore } from './settingsStore';

// ============================================================================
// Selector Exports
// ============================================================================

export {
  selectAllComponentData,
  selectAllComponentNames,
  // Base selectors
  selectCommits,
  selectCriticalIssuesCount,
  selectExpandedNodes,
  selectFilteredCommits,
  selectFilteredComponentData,
  selectFilteredComponentNames,
  selectFilterText,
  selectFlamegraphData,
  selectIsDetailPanelOpen,
  selectIssuesCountBySeverity,
  selectLastCommit,
  // Selector collection
  selectors,
  // Derived selectors
  selectSelectedCommit,
  selectSelectedCommitId,
  selectSelectedComponent,
  selectSelectedComponentData,
  selectSessionStats,
  selectTimelineData,
  selectTreeData,
  selectViewMode,
  selectVisibleCommits,
  selectWarningIssuesCount,
  selectWastedRenderReports,
} from './selectors';

// ============================================================================
// Combined Hooks for Common Use Cases
// ============================================================================

import type { CommitData, MemoReport, WastedRenderReport } from '@/shared/types';
import { useConnectionStore } from './connectionStore';
import type { ComponentData, PerformanceMetrics } from './profilerStore';
import { useProfilerStore } from './profilerStore';
import { useSettingsStore } from './settingsStore';

/**
 * Hook to get the currently selected commit with reactive updates
 */
export function useSelectedCommit(): CommitData | null {
  return useProfilerStore((state) => {
    if (!state.selectedCommitId) return null;
    return state.commits.find((c) => c.id === state.selectedCommitId) || null;
  });
}

/**
 * Hook to get filtered commits based on current filters
 */
export function useFilteredCommits(): CommitData[] {
  return useProfilerStore((state) => {
    const normalizedFilter = state.filterText.toLowerCase().trim();

    return state.commits.filter((commit) => {
      // Apply text filter
      if (normalizedFilter) {
        const nodes = commit.nodes ?? [];
        const hasMatch = nodes.some((node) =>
          node.displayName?.toLowerCase().includes(normalizedFilter)
        );
        if (!hasMatch) return false;
      }

      return true;
    });
  });
}

/**
 * Hook to get the currently selected component data
 */
export function useSelectedComponent(): ComponentData | null {
  return useProfilerStore((state) => {
    if (!state.selectedComponent) return null;

    const componentData: ComponentData = {
      name: state.selectedComponent,
      renderCount: 0,
      wastedRenders: 0,
      wastedRenderRate: 0,
      averageDuration: 0,
      totalDuration: 0,
      isMemoized: false,
      memoHitRate: 0,
      commitIds: [],
      severity: 'none',
    };

    for (const commit of state.commits) {
      const nodes = commit.nodes ?? [];
      for (const node of nodes) {
        if (node.displayName === state.selectedComponent) {
          componentData.renderCount++;
          componentData.totalDuration += node.actualDuration;
          componentData.commitIds.push(commit.id);

          if (node.isMemoized) {
            componentData.isMemoized = true;
          }

          if (node.actualDuration < 0.1) {
            componentData.wastedRenders++;
          }
        }
      }
    }

    if (componentData.renderCount === 0) return null;

    componentData.averageDuration = componentData.totalDuration / componentData.renderCount;
    componentData.wastedRenderRate =
      (componentData.wastedRenders / componentData.renderCount) * 100;

    if (componentData.wastedRenderRate > 50) {
      componentData.severity = 'critical';
    } else if (componentData.wastedRenderRate > 20) {
      componentData.severity = 'warning';
    } else if (componentData.wastedRenderRate > 5) {
      componentData.severity = 'info';
    }

    return componentData;
  });
}

/**
 * Hook to get critical issues count
 */
export function useCriticalIssuesCount(): number {
  return useProfilerStore(
    (state) => state.wastedRenderReports.filter((r) => r.severity === 'critical').length
  );
}

/**
 * Hook to get all issues count
 */
export function useTotalIssuesCount(): number {
  return useProfilerStore((state) => state.wastedRenderReports.length);
}

/**
 * Hook to check if profiler has any data
 */
export function useHasData(): boolean {
  return useProfilerStore((state) => state.commits.length > 0);
}

/**
 * Hook to get recording progress (duration while recording)
 */
export function useRecordingProgress(): { isRecording: boolean; duration: number } {
  return useProfilerStore((state) => ({
    isRecording: state.isRecording,
    duration: state.recordingDuration,
  }));
}

/**
 * Hook to get performance score
 */
export function usePerformanceScore(): PerformanceMetrics | null {
  return useProfilerStore((state) => state.performanceScore);
}

/**
 * Hook to get wasted render reports sorted by severity
 */
export function useWastedRenderReports(): WastedRenderReport[] {
  return useProfilerStore((state) =>
    [...state.wastedRenderReports].sort((a, b) => {
      const severityOrder: Record<string, number> = {
        critical: 0,
        warning: 1,
        info: 2,
        low: 1,
        medium: 1,
        high: 0,
      };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity]! - severityOrder[b.severity]!;
      }
      return (b.wastedRenderRate || 0) - (a.wastedRenderRate || 0);
    })
  );
}

/**
 * Hook to get memo effectiveness reports
 */
export function useMemoReports(): MemoReport[] {
  return useProfilerStore((state) => state.memoReports);
}

// ============================================================================
// Combined Store Actions
// ============================================================================

/**
 * Start a new profiling session
 * Clears existing data and starts recording
 */
export function startProfilingSession(): void {
  useProfilerStore.getState().clearData();
  useProfilerStore.getState().startRecording();
  useConnectionStore.getState().sendMessage({ type: 'START_PROFILING' });
}

/**
 * Stop the current profiling session
 * Stops recording and runs analysis
 */
export async function stopProfilingSession(): Promise<void> {
  useProfilerStore.getState().stopRecording();
  useConnectionStore.getState().sendMessage({ type: 'STOP_PROFILING' });

  // Auto-run analysis if enabled
  const { enableAutoAnalysis } = useSettingsStore.getState();
  if (enableAutoAnalysis) {
    await useProfilerStore.getState().runAnalysis();
  }
}

/**
 * Clear all profiler data and reset state
 */
export function clearProfilingData(): void {
  useProfilerStore.getState().clearData();
  useConnectionStore.getState().sendMessage({ type: 'CLEAR_DATA' });
}

/**
 * Export profiling data as JSON
 */
export function exportProfilingData(): string {
  return useProfilerStore.getState().exportData();
}

/**
 * Import profiling data from JSON
 */
export function importProfilingData(json: string): void {
  useProfilerStore.getState().importData(json);
}

// ============================================================================
// Store Initialization
// ============================================================================

/**
 * Initialize all stores
 * Should be called once when the panel loads
 */
export async function initializeStores(): Promise<void> {
  // Note: Settings are automatically loaded by Zustand persist middleware
  // No manual loading needed - just verify store is hydrated
  const { loaded } = useSettingsStore.getState();
  if (!loaded) {
    // Wait a brief moment for hydration to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Connect to background script
  useConnectionStore.getState().connect();

  // Register message handler for commits
  const connectionStore = useConnectionStore.getState();
  if ('onMessage' in connectionStore && typeof connectionStore.onMessage === 'function') {
    (
      connectionStore as unknown as {
        onMessage: (cb: (message: { type: string; payload?: unknown }) => void) => void;
      }
    ).onMessage((message: { type: string; payload?: unknown }) => {
      if (message.type === 'COMMIT_DATA' && message.payload) {
        const commit = message.payload as CommitData;
        useProfilerStore.getState().addCommit(commit);
      }
    });
  }
}

/**
 * Cleanup all stores
 * Should be called when the panel unloads
 */
export function cleanupStores(): void {
  useConnectionStore.getState().disconnect();
}
