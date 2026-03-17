/**
 * Zustand store for profiler state management
 * @module panel/stores/profilerStore
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  CommitData,
  AnalysisResult,
  WastedRenderReport,
  MemoReport,
  ProfilerConfig,
  ComponentMetrics,
} from '@/shared/types';

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
}

/**
 * Combined store type
 */
export type ProfilerStore = ProfilerState & ProfilerActions;

/** Default profiler configuration */
const defaultConfig: ProfilerConfig = {
  maxCommits: 100,
  maxNodesPerCommit: 10000,
  analysisWorkerCount: 2,
  enableTimeTravel: true,
};

/**
 * Zustand store for managing profiler state
 * @example
 * const { isRecording, commits, startRecording } = useProfilerStore();
 */
export const useProfilerStore = create<ProfilerStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        isRecording: false,
        recordingDuration: 0,
        commits: [],
        analysisResults: null,
        wastedRenderReports: [],
        memoReports: [],
        config: defaultConfig,
        selectedCommitId: null,
        selectedComponent: null,
        timeTravelIndex: null,
        viewMode: 'tree',
        filterText: '',
        expandedNodes: new Set<string>(),
        isAnalyzing: false,
        analysisError: null,
        performanceScore: null,
        componentData: new Map<string, ComponentData>(),
        isDetailPanelOpen: true,

        // Actions
        startRecording: () => {
          set({ isRecording: true, recordingDuration: 0 });
        },

        stopRecording: () => {
          set({ isRecording: false });
        },

        clearData: () => {
          set({
            commits: [],
            analysisResults: null,
            wastedRenderReports: [],
            memoReports: [],
            selectedCommitId: null,
            selectedComponent: null,
            timeTravelIndex: null,
            performanceScore: null,
            componentData: new Map<string, ComponentData>(),
            expandedNodes: new Set<string>(),
            analysisError: null,
          });
        },

        addCommit: (commit) => {
          const { commits, config } = get();
          const newCommits = [...commits, commit];
          
          // Enforce max commits limit using circular buffer
          if (newCommits.length > config.maxCommits) {
            newCommits.shift();
          }
          
          set({ commits: newCommits });
        },

        setAnalysisResults: (results) => {
          set({
            analysisResults: results,
            wastedRenderReports: results.wastedRenderReports,
            memoReports: results.memoReports,
          });
        },

        setWastedRenderReports: (reports) => {
          set({ wastedRenderReports: reports });
        },

        setMemoReports: (reports) => {
          set({ memoReports: reports });
        },

        exportData: () => {
          const { commits, analysisResults, config } = get();
          const data = {
            version: '1.0.0',
            exportedAt: Date.now(),
            commits,
            analysisResults,
            config,
          };
          return JSON.stringify(data, null, 2);
        },

        importData: (json) => {
          try {
            const data = JSON.parse(json);
            
            if (!data.commits || !Array.isArray(data.commits)) {
              throw new Error('Invalid data format: commits array missing');
            }
            
            set({
              commits: data.commits,
              analysisResults: data.analysisResults || null,
              selectedCommitId: null,
              selectedComponent: null,
              timeTravelIndex: null,
            });
          } catch (error) {
            console.error('Failed to import profiler data:', error);
            throw error;
          }
        },

        updateConfig: (newConfig) => {
          set((state) => ({
            config: { ...state.config, ...newConfig },
          }));
        },

        selectCommit: (commitId) => {
          set({ selectedCommitId: commitId });
        },

        selectComponent: (componentName) => {
          set({ selectedComponent: componentName });
        },

        setTimeTravelIndex: (index) => {
          set({ timeTravelIndex: index });
        },

        toggleNode: (nodeId) => {
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
          // Expand all nodes - would need to know all node IDs
          // This is a placeholder implementation
          set({ expandedNodes: new Set<string>() });
        },

        collapseAll: () => {
          set({ expandedNodes: new Set<string>() });
        },

        setFilterText: (text) => {
          set({ filterText: text });
        },

        setViewMode: (mode) => {
          set({ viewMode: mode });
        },

        runAnalysis: async () => {
          set({ isAnalyzing: true, analysisError: null });
          
          try {
            // Simulate analysis - in real implementation, this would use the worker
            const { commits } = get();
            
            // Simple analysis to generate mock results
            const wastedReports: WastedRenderReport[] = [];
            const memoReports: MemoReport[] = [];
            
            // Aggregate component data
            const componentMap = new Map<string, ComponentData>();
            
            for (const commit of commits) {
              for (const node of commit.nodes) {
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
            const totalRenderTime = Array.from(componentMap.values())
              .reduce((sum, c) => sum + c.totalDuration, 0);
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
          set((state) => ({ isDetailPanelOpen: !state.isDetailPanelOpen }));
        },
      }),
      {
        name: 'react-perf-profiler-storage',
        partialize: (state) => ({
          config: state.config,
          viewMode: state.viewMode,
        }),
      }
    ),
    { name: 'ProfilerStore' }
  )
);
