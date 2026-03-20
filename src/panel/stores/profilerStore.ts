/**
 * Zustand store for profiler state management
 * @module panel/stores/profilerStore
 */

import { create } from 'zustand';
import type {
  CommitData,
  AnalysisResult,
  WastedRenderReport,
  MemoReport,
  ProfilerConfig,
} from '@/shared/types';
import type {
  RSCPayload,
  RSCAnalysisResult,
  RSCMetrics,
} from '@/shared/types/rsc';

/**
 * Performance metrics for the profiler
 */
export interface PerformanceMetrics {
  /** Overall performance score (0-100) */
  score: number;
  /** Average render time across all components */
  averageRenderTime: number;
  /** Percentage of renders that were wasted */
  wastedRenderRate: number;
  /** Average memo hit rate for memoized components */
  averageMemoHitRate: number;
  /** Total number of unique components */
  totalComponents: number;
}

/**
 * Component data aggregated across commits
 */
export interface ComponentData {
  /** Component name */
  name: string;
  /** Number of renders */
  renderCount: number;
  /** Number of wasted renders */
  wastedRenders: number;
  /** Percentage of renders that were wasted */
  wastedRenderRate: number;
  /** Average render duration in ms */
  averageDuration: number;
  /** Total render duration in ms */
  totalDuration: number;
  /** Whether component is memoized */
  isMemoized: boolean;
  /** Memo hit rate (0-100) */
  memoHitRate: number;
  /** IDs of commits this component appears in */
  commitIds: string[];
  /** Severity level */
  severity: 'none' | 'info' | 'warning' | 'critical';
}

/**
 * Tree node data structure for component tree
 */
export interface TreeNode {
  /** Unique node ID */
  id: string;
  /** Component name */
  name: string;
  /** Tree depth */
  depth: number;
  /** Whether node has children */
  hasChildren: boolean;
  /** Whether node is expanded */
  isExpanded: boolean;
  /** Whether node is selected */
  isSelected: boolean;
  /** Number of renders */
  renderCount: number;
  /** Number of wasted renders */
  wastedRenders: number;
  /** Average render duration */
  averageDuration: number;
  /** Whether component is memoized */
  isMemoized: boolean;
  /** Severity level */
  severity: 'none' | 'info' | 'warning' | 'critical';
  /** Parent node ID */
  parentId: string | null;
  /** Child node IDs */
  childIds: string[];
  /** Original fiber ID */
  fiberId: number;
}

/**
 * View mode for the profiler
 */
export type ViewMode = 'tree' | 'flamegraph' | 'timeline' | 'analysis';

/**
 * State interface for the profiler store
 */
export interface ProfilerState {
  /** Whether currently recording profiling data */
  isRecording: boolean;
  /** Recording start time */
  recordingStartTime: number | null;
  /** Recording duration in milliseconds */
  recordingDuration: number;
  /** Array of captured commits */
  commits: CommitData[];
  /** Analysis results from processing commits */
  analysisResults: AnalysisResult | null;
  /** Wasted render reports by component */
  wastedRenderReports: WastedRenderReport[];
  /** Memo effectiveness reports by component */
  memoReports: MemoReport[];
  /** Profiler configuration */
  config: ProfilerConfig;
  /** Currently selected commit ID */
  selectedCommitId: string | null;
  /** Currently selected component name */
  selectedComponent: string | null;
  /** Alias for selectedComponent - component name currently selected */
  selectedComponentName: string | null;
  /** Time travel position (index into commits) */
  timeTravelIndex: number | null;
  /** Current view mode */
  viewMode: ViewMode;
  /** Filter text for component search */
  filterText: string;
  /** Set of expanded node IDs */
  expandedNodes: Set<string>;
  /** Whether analysis is running */
  isAnalyzing: boolean;
  /** Analysis error message */
  analysisError: string | null;
  /** Performance score data */
  performanceScore: PerformanceMetrics | null;
  /** Component data map */
  componentData: Map<string, ComponentData>;
  /** Whether detail panel is open */
  isDetailPanelOpen: boolean;
  /** Width of the sidebar in pixels */
  sidebarWidth: number;
  /** Whether detail panel is open (alias) */
  detailPanelOpen: boolean;
  /** Width of the detail panel in pixels */
  detailPanelWidth: number;
  /** Filter for component types */
  componentTypeFilter: 'all' | 'memoized' | 'unmemoized';
  /** Filter for severity levels */
  severityFilter: ('critical' | 'warning' | 'info')[];
  /** Array of captured RSC payloads */
  rscPayloads: RSCPayload[];
  /** Current RSC analysis results */
  rscAnalysis: RSCAnalysisResult | null;
  /** Aggregated RSC metrics */
  rscMetrics: RSCMetrics | null;
  /** Loading state for RSC analysis */
  isAnalyzingRSC: boolean;
}

/**
 * Actions interface for the profiler store
 */
interface ProfilerActions {
  /** Start recording profiling data */
  startRecording: () => void;
  /** Stop recording profiling data */
  stopRecording: () => void;
  /** Clear all captured data */
  clearData: () => void;
  /** Add a new commit to the store */
  addCommit: (commit: CommitData) => void;
  /** Add multiple commits to the store */
  addCommits: (commits: CommitData[]) => void;
  /** Set analysis results */
  setAnalysisResults: (results: AnalysisResult) => void;
  /** Set wasted render reports */
  setWastedRenderReports: (reports: WastedRenderReport[]) => void;
  /** Set memo effectiveness reports */
  setMemoReports: (reports: MemoReport[]) => void;
  /** Export all data as JSON string */
  exportData: () => string;
  /** Import data from JSON string */
  importData: (json: string) => void;
  /** Update profiler configuration */
  updateConfig: (config: Partial<ProfilerConfig>) => void;
  /** Select a specific commit */
  selectCommit: (commitId: string | null) => void;
  /** Select a specific component */
  selectComponent: (componentName: string | null) => void;
  /** Set time travel position */
  setTimeTravelIndex: (index: number | null) => void;
  /** Toggle node expansion */
  toggleNode: (nodeId: string) => void;
  /** Expand all nodes */
  expandAll: () => void;
  /** Collapse all nodes */
  collapseAll: () => void;
  /** Set filter text */
  setFilterText: (text: string) => void;
  /** Set view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Run analysis */
  runAnalysis: () => Promise<void>;
  /** Toggle detail panel */
  toggleDetailPanel: () => void;
  /** Set sidebar width */
  setSidebarWidth: (width: number) => void;
  /** Set detail panel width */
  setDetailPanelWidth: (width: number) => void;
  /** Set component type filter */
  setComponentTypeFilter: (filter: 'all' | 'memoized' | 'unmemoized') => void;
  /** Set severity filter */
  setSeverityFilter: (filter: ('critical' | 'warning' | 'info')[]) => void;
  /** Expand all nodes (alias) */
  expandAllNodes: () => void;
  /** Collapse all nodes (alias) */
  collapseAllNodes: () => void;
  /** Toggle node expanded state */
  toggleNodeExpanded: (nodeId: string) => void;
  /** Add a new RSC payload */
  addRSCPayload: (payload: RSCPayload) => void;
  /** Clear all RSC data */
  clearRSCData: () => void;
  /** Set RSC analysis results */
  setRSCAnalysis: (analysis: RSCAnalysisResult) => void;
  /** Trigger RSC analysis */
  analyzeRSC: () => Promise<void>;
  /** Get total payload size across all payloads */
  getRSCTotalPayloadSize: () => number;
  /** Get overall cache hit rate */
  getRSCCacheHitRate: () => number;
  /** Get total number of boundaries */
  getRSCBoundaryCount: () => number;
  /** Check if RSC data exists */
  getRSCHasData: () => boolean;
}

/**
 * Combined store type
 */
export type ProfilerStore = ProfilerState & ProfilerActions;

/**
 * Selector for tree data
 */
export const selectTreeData = (state: ProfilerState) => state.componentData;

/**
 * Selector for the currently selected commit
 */
export const selectSelectedCommit = (state: ProfilerState) => {
  if (!state.selectedCommitId) return null;
  return state.commits.find((c) => c.id === state.selectedCommitId) || null;
};

/** Default profiler configuration */
const defaultConfig: ProfilerConfig = {
  maxCommits: 100,
  maxNodesPerCommit: 10000,
  analysisWorkerCount: 2,
  enableTimeTravel: true,
};

/** Maximum commits limit */
const MAX_COMMITS = 500;

/** Minimum sidebar width */
const MIN_SIDEBAR_WIDTH = 180;

/** Maximum sidebar width */
const MAX_SIDEBAR_WIDTH = 600;

// Store implementation
const storeImplementation = (set: any, get: any): ProfilerStore => ({
  // State
  isRecording: false,
  recordingStartTime: null,
  recordingDuration: 0,
  commits: [],
  analysisResults: null,
  wastedRenderReports: [],
  memoReports: [],
  config: defaultConfig,
  selectedCommitId: null,
  selectedComponent: null,
  selectedComponentName: null,
  timeTravelIndex: null,
  viewMode: 'tree',
  filterText: '',
  expandedNodes: new Set<string>(),
  isAnalyzing: false,
  analysisError: null,
  performanceScore: null,
  componentData: new Map<string, ComponentData>(),
  isDetailPanelOpen: true,
  sidebarWidth: 280,
  detailPanelOpen: true,
  detailPanelWidth: 400,
  componentTypeFilter: 'all',
  severityFilter: ['critical', 'warning', 'info'],
  rscPayloads: [],
  rscAnalysis: null,
  rscMetrics: null,
  isAnalyzingRSC: false,

  // Actions
  startRecording: () => {
    set({
      isRecording: true,
      recordingStartTime: Date.now(),
      recordingDuration: 0,
      commits: [],
      wastedRenderReports: [],
      memoReports: [],
      analysisResults: null,
    });
  },

  stopRecording: () => {
    const { recordingStartTime } = get();
    const duration = recordingStartTime ? Date.now() - recordingStartTime : 0;
    set({ isRecording: false, recordingDuration: duration });
  },

  clearData: () => {
    set({
      commits: [],
      analysisResults: null,
      wastedRenderReports: [],
      memoReports: [],
      selectedCommitId: null,
      selectedComponent: null,
      selectedComponentName: null,
      timeTravelIndex: null,
      performanceScore: null,
      componentData: new Map<string, ComponentData>(),
      expandedNodes: new Set<string>(),
      analysisError: null,
      recordingDuration: 0,
      recordingStartTime: null,
      rscPayloads: [],
      rscAnalysis: null,
      rscMetrics: null,
    });
  },

  addCommit: (commit: CommitData) => {
    const { commits } = get();
    const newCommits = [...commits, commit];

    // Enforce max commits limit of 500
    if (newCommits.length > MAX_COMMITS) {
      newCommits.shift();
    }

    set({ commits: newCommits });
  },

  addCommits: (commitsToAdd: CommitData[]) => {
    const { commits } = get();
    const newCommits = [...commits, ...commitsToAdd];

    // Enforce max commits limit of 500, keeping most recent
    if (newCommits.length > MAX_COMMITS) {
      newCommits.splice(0, newCommits.length - MAX_COMMITS);
    }

    set({ commits: newCommits });
  },

  setAnalysisResults: (results: AnalysisResult) => {
    set({
      analysisResults: results,
      wastedRenderReports: results.wastedRenderReports,
      memoReports: results.memoReports,
    });
  },

  setWastedRenderReports: (reports: WastedRenderReport[]) => {
    set({ wastedRenderReports: reports });
  },

  setMemoReports: (reports: MemoReport[]) => {
    set({ memoReports: reports });
  },

  exportData: () => {
    const { commits, recordingDuration } = get();
    const data = {
      version: 1,
      commits,
      recordingDuration,
    };
    return JSON.stringify(data);
  },

  importData: (json: string) => {
    try {
      const data = JSON.parse(json);

      set({
        commits: data.commits || [],
        recordingDuration: data.recordingDuration || 0,
        selectedCommitId: null,
        selectedComponent: null,
        selectedComponentName: null,
        timeTravelIndex: null,
        analysisError: null,
      });
    } catch (error) {
      set({
        analysisError: error instanceof Error ? error.message : 'Invalid JSON data',
      });
    }
  },

  updateConfig: (newConfig: Partial<ProfilerConfig>) => {
    set((state: ProfilerState) => ({
      config: { ...state.config, ...newConfig },
    }));
  },

  selectCommit: (commitId: string | null) => {
    set({ selectedCommitId: commitId });
  },

  selectComponent: (componentName: string | null) => {
    set({
      selectedComponent: componentName,
      selectedComponentName: componentName,
      detailPanelOpen: componentName !== null,
    });
  },

  setTimeTravelIndex: (index: number | null) => {
    set({ timeTravelIndex: index });
  },

  toggleNode: (nodeId: string) => {
    const { expandedNodes } = get();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    set({ expandedNodes: newExpanded });
  },

  expandAll: () => {
    set({ expandedNodes: new Set<string>() });
  },

  collapseAll: () => {
    set({ expandedNodes: new Set<string>() });
  },

  setFilterText: (text: string) => {
    set({ filterText: text });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  runAnalysis: async () => {
    set({ isAnalyzing: true, analysisError: null });

    // Allow state update to propagate before starting analysis
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const { commits } = get();

      // Check if there are commits to analyze
      if (commits.length === 0) {
        set({
          isAnalyzing: false,
          analysisError: 'No commits to analyze',
        });
        return;
      }

      // Simulate analysis - in real implementation, this would use the worker
      const wastedReports: WastedRenderReport[] = [];
      const memoReports: MemoReport[] = [];

      // Aggregate component data
      const componentMap = new Map<string, ComponentData>();

      for (const commit of commits) {
        for (const node of commit.nodes ?? []) {
          const name = node.displayName;
          if (!name) continue;

          let data = componentMap.get(name);
          if (!data) {
            data = {
              name,
              renderCount: 0,
              wastedRenders: 0,
              wastedRenderRate: 0,
              averageDuration: 0,
              totalDuration: 0,
              isMemoized: node.isMemoized,
              memoHitRate: 0,
              commitIds: [],
              severity: 'none',
            };
            componentMap.set(name, data);
          }

          data.renderCount++;
          data.totalDuration += node.actualDuration;
          data.commitIds.push(commit.id);
        }
      }

      // Calculate averages
      for (const data of componentMap.values()) {
        data.averageDuration = data.totalDuration / data.renderCount;
      }

      // Calculate performance score
      const totalComponents = componentMap.size;
      const totalRenderTime = Array.from(componentMap.values()).reduce(
        (sum, c) => sum + c.totalDuration,
        0
      );
      const avgRenderTime = totalComponents > 0 ? totalRenderTime / totalComponents : 0;

      const performanceScore: PerformanceMetrics = {
        score: Math.max(0, Math.min(100, 100 - avgRenderTime * 5)),
        averageRenderTime: avgRenderTime,
        wastedRenderRate: 0,
        averageMemoHitRate: 0,
        totalComponents,
      };

      set({
        isAnalyzing: false,
        performanceScore,
        componentData: componentMap,
        wastedRenderReports: wastedReports,
        memoReports: memoReports,
      });
    } catch (error) {
      set({
        isAnalyzing: false,
        analysisError: error instanceof Error ? error.message : 'Analysis failed',
      });
    }
  },

  toggleDetailPanel: () => {
    set((state: ProfilerState) => ({
      isDetailPanelOpen: !state.isDetailPanelOpen,
      detailPanelOpen: !state.detailPanelOpen,
    }));
  },

  setSidebarWidth: (width: number) => {
    // Constrain width between min and max values
    const constrainedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
    set({ sidebarWidth: constrainedWidth });
  },

  setDetailPanelWidth: (width: number) => {
    set({ detailPanelWidth: width });
  },

  setComponentTypeFilter: (filter: 'all' | 'memoized' | 'unmemoized') => {
    set({ componentTypeFilter: filter });
  },

  setSeverityFilter: (filter: ('critical' | 'warning' | 'info')[]) => {
    set({ severityFilter: filter });
  },

  expandAllNodes: () => {
    const { commits } = get();
    const allNodeIds = new Set<string>();

    for (const commit of commits) {
      for (const node of commit.nodes ?? []) {
        if (node.id) {
          allNodeIds.add(node.id);
        }
      }
    }

    set({ expandedNodes: allNodeIds });
  },

  collapseAllNodes: () => {
    set({ expandedNodes: new Set<string>() });
  },

  toggleNodeExpanded: (nodeId: string) => {
    const { expandedNodes } = get();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    set({ expandedNodes: newExpanded });
  },

  addRSCPayload: (payload: RSCPayload) => {
    const { rscPayloads } = get();
    set({ rscPayloads: [...rscPayloads, payload] });
  },

  clearRSCData: () => {
    set({
      rscPayloads: [],
      rscAnalysis: null,
      rscMetrics: null,
    });
  },

  setRSCAnalysis: (analysis: RSCAnalysisResult) => {
    set({
      rscAnalysis: analysis,
      rscMetrics: analysis.metrics,
    });
  },

  analyzeRSC: async () => {
    set({ isAnalyzingRSC: true });

    // Allow state update to propagate before starting analysis
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const { rscPayloads } = get();

      if (rscPayloads.length === 0) {
        set({
          isAnalyzingRSC: false,
        });
        return;
      }

      // Aggregate metrics from all payloads
      let totalPayloadSize = 0;
      const totalTransferTime = 0;
      const totalSerializationCost = 0;
      const totalDeserializationCost = 0;
      let totalServerComponents = 0;
      let totalClientComponents = 0;
      let totalBoundaries = 0;
      let totalCacheHits = 0;
      let totalCacheMisses = 0;

      const allBoundaryMetrics: NonNullable<RSCMetrics['boundaryMetrics']> = [];

      for (const payload of rscPayloads) {
        totalPayloadSize += payload.totalSize;
        totalServerComponents += payload.serverComponentCount;
        totalClientComponents += payload.clientComponentCount;
        totalBoundaries += payload.boundaries.length;

        for (const boundary of payload.boundaries) {
          if (boundary.cacheStatus === 'hit') {
            totalCacheHits++;
          } else if (boundary.cacheStatus === 'miss') {
            totalCacheMisses++;
          }

          allBoundaryMetrics.push({
            boundaryId: boundary.id,
            componentName: boundary.componentName,
            renderTime: 0,
            payloadSize: boundary.propsSize,
            propsSize: boundary.propsSize,
            cacheStatus: boundary.cacheStatus ?? 'none',
            renderCount: 1,
            causedCacheMiss: boundary.cacheStatus === 'miss',
          });
        }
      }

      const cacheHitRatio =
        totalCacheHits + totalCacheMisses > 0
          ? totalCacheHits / (totalCacheHits + totalCacheMisses)
          : 0;

      // Calculate stream metrics
      const totalChunks = rscPayloads.reduce(
        (sum: number, p: RSCPayload) => sum + p.chunks.length,
        0
      );
      const chunkSizes = rscPayloads.flatMap((p: RSCPayload) =>
        p.chunks.map((c) => c.size)
      );

      const streamMetrics: RSCMetrics['streamMetrics'] = {
        chunkCount: totalChunks,
        averageChunkSize:
          chunkSizes.length > 0
            ? chunkSizes.reduce((a: number, b: number) => a + b, 0) / chunkSizes.length
            : 0,
        maxChunkSize: chunkSizes.length > 0 ? Math.max(...chunkSizes) : 0,
        minChunkSize:
          chunkSizes.length > 0 ? Math.min(...chunkSizes) : 0,
        boundaryChunks: rscPayloads.reduce(
          (sum: number, p: RSCPayload) => sum + p.chunks.filter((c) => c.containsBoundary).length,
          0
        ),
        interleavedChunks: 0,
        timeToFirstChunk: 0,
        streamDuration: 0,
        suspenseResolutions: 0,
        hadOutOfOrderChunks: false,
      };

      const rscMetrics: RSCMetrics = {
        payloadSize: totalPayloadSize,
        transferTime: totalTransferTime,
        serializationCost: totalSerializationCost,
        deserializationCost: totalDeserializationCost,
        serverComponentCount: totalServerComponents,
        clientComponentCount: totalClientComponents,
        boundaryCount: totalBoundaries,
        boundaryMetrics: allBoundaryMetrics,
        streamMetrics,
        cacheHitRatio,
      };

      set({
        isAnalyzingRSC: false,
        rscMetrics,
      });
    } catch (_error) {
      set({
        isAnalyzingRSC: false,
      });
    }
  },

  getRSCTotalPayloadSize: () => {
    const { rscPayloads } = get();
    return rscPayloads.reduce((sum: number, payload: RSCPayload) => sum + payload.totalSize, 0);
  },

  getRSCCacheHitRate: () => {
    const { rscPayloads } = get();
    let totalCacheHits = 0;
    let totalCacheMisses = 0;

    for (const payload of rscPayloads) {
      for (const boundary of payload.boundaries) {
        if (boundary.cacheStatus === 'hit') {
          totalCacheHits++;
        } else if (boundary.cacheStatus === 'miss') {
          totalCacheMisses++;
        }
      }
    }

    const total = totalCacheHits + totalCacheMisses;
    return total > 0 ? totalCacheHits / total : 0;
  },

  getRSCBoundaryCount: () => {
    const { rscPayloads } = get();
    return rscPayloads.reduce(
      (sum: number, payload: RSCPayload) => sum + payload.boundaries.length,
      0
    );
  },

  getRSCHasData: () => {
    const { rscPayloads } = get();
    return rscPayloads.length > 0;
  },
});

/**
 * Zustand store for managing profiler state
 * @example
 * const { isRecording, commits, startRecording } = useProfilerStore();
 */
export const useProfilerStore = create<ProfilerStore>(storeImplementation);
