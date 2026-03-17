/**
 * Store exports for React Perf Profiler
 * Central export point for all Zustand stores and selectors
 */

// ============================================================================
// Store Exports
// ============================================================================

export { 
  useProfilerStore, 
  type ProfilerState, 
  type PerformanceMetrics, 
  type TreeNode, 
  type ComponentData,
  type ViewMode,
  type ProfilerStore,
} from './profilerStore';
export { useConnectionStore, type ConnectionState } from './connectionStore';
export { useSettingsStore, type SettingsState, DEFAULT_SETTINGS } from './settingsStore';

// ============================================================================
// Selector Exports
// ============================================================================

export {
  // Base selectors
  selectCommits,
  selectSelectedCommitId,
  selectSelectedComponent,
  selectFilterText,
  selectSeverityFilter,
  selectComponentTypeFilter,
  selectWastedRenderReports,
  selectExpandedNodes,
  selectViewMode,
  selectIsDetailPanelOpen,
  
  // Derived selectors
  selectSelectedCommit,
  selectLastCommit,
  selectSelectedComponentData,
  selectFilteredCommits,
  selectVisibleCommits,
  selectAllComponentNames,
  selectFilteredComponentNames,
  selectAllComponentData,
  selectFilteredComponentData,
  selectCriticalIssuesCount,
  selectWarningIssuesCount,
  selectIssuesCountBySeverity,
  selectTreeData,
  selectTimelineData,
  selectFlamegraphData,
  selectSessionStats,
  
  // Selector collection
  selectors,
} from './selectors';

// ============================================================================
// Combined Hooks for Common Use Cases
// ============================================================================

import { useProfilerStore } from './profilerStore';
import { useSettingsStore } from './settingsStore';
import { useConnectionStore } from './connectionStore';
import type { CommitData, WastedRenderReport, MemoReport } from '@/shared/types';
import type { ComponentData, PerformanceMetrics } from './profilerStore';

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
        const hasMatch = commit.nodes.some((node) =>
          node.displayName?.toLowerCase().includes(normalizedFilter)
        );
        if (!hasMatch) return false;
      }
      
      // Apply component type filter
      if (state.componentTypeFilter && state.componentTypeFilter !== 'all') {
        const hasMatchingType = commit.nodes.some((node) => {
          const isMemoized = node.isMemoized;
          return state.componentTypeFilter === 'memoized' ? isMemoized : !isMemoized;
        });
        if (!hasMatchingType) return false;
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
      for (const node of commit.nodes) {
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
    componentData.wastedRenderRate = (componentData.wastedRenders / componentData.renderCount) * 100;
    
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
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
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
  // Load settings from storage
  await useSettingsStore.getState().loadSettings();
  
  // Connect to background script
  useConnectionStore.getState().connect();
  
  // Register message handler for commits
  useConnectionStore.getState().onMessage?.((message: { type: string; payload?: unknown }) => {
    if (message.type === 'COMMIT_DATA' && message.payload) {
      const commit = message.payload as CommitData;
      useProfilerStore.getState().addCommit(commit);
    }
  });
}

/**
 * Cleanup all stores
 * Should be called when the panel unloads
 */
export function cleanupStores(): void {
  useConnectionStore.getState().disconnect();
}
