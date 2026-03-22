/**
 * Zustand store for profiler state management
 * @module panel/stores/profilerStore
 */

import { create } from 'zustand';
import type { StoreApi } from 'zustand';
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
  RSCAnalysisConfig,
} from '@/shared/types/rsc';
import type { ExportedProfileV1, ImportValidationResult } from '@/shared/types/export';
import { createExportProfile, validateImportData, isExportedProfileV1 } from '@/shared/types/export';
import {
  MAX_PERFORMANCE_SCORE,
  MIN_PERFORMANCE_SCORE,
  RENDER_TIME_SCORE,
} from '@/shared/constants';
import { autoMigrateProfileWithLogging, MigrationError, CorruptedProfileError } from '@/shared/export/migrations';
import type { MigrationLogEntry } from '@/shared/types/export';
import { rscWorker } from '@/panel/workers/workerClient';

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
  /** Component data map with LRU eviction */
  componentData: ComponentDataLRUCache;
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
  /** Error message for RSC analysis */
  rscAnalysisError: string | null;
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
  /** Validate import data and return validation result */
  validateImportData: (json: string) => ImportValidationResult;
  /** Import data with migration if needed */
  importDataWithMigration: (json: string) => { success: boolean; error?: string; migrated?: boolean; migrationLog?: MigrationLogEntry[] };
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
  /** Trigger RSC analysis using Web Worker */
  analyzeRSC: (config?: Partial<RSCAnalysisConfig>) => Promise<void>;
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
  maxComponentDataEntries: 1000,
};

/** Maximum component data entries (absolute limit) */
const MAX_COMPONENT_DATA_ENTRIES = 10000;

/** Maximum RSC payloads to store */
const MAX_RSC_PAYLOADS = 100;

/** Maximum expanded nodes to track */
const MAX_EXPANDED_NODES = 1000;

/**
 * LRU Cache manager for component data
 * Tracks access order and evicts least recently used entries when limit is exceeded
 */
class ComponentDataLRUCache {
  private cache: Map<string, ComponentData>;
  private accessOrder: string[];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = maxSize;
  }

  /**
   * Get the current max size
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Update max size and trigger eviction if needed
   */
  setMaxSize(newSize: number): void {
    this.maxSize = Math.min(newSize, MAX_COMPONENT_DATA_ENTRIES);
    this.enforceLimit();
  }

  /**
   * Get a component and update its access order (mark as recently used)
   */
  get(key: string): ComponentData | undefined {
    const data = this.cache.get(key);
    if (data) {
      this.updateAccessOrder(key);
    }
    return data;
  }

  /**
   * Set a component and update access order
   */
  set(key: string, value: ComponentData): void {
    if (this.cache.has(key)) {
      // Update existing entry
      this.cache.set(key, value);
      this.updateAccessOrder(key);
    } else {
      // Add new entry
      this.cache.set(key, value);
      this.accessOrder.push(key);
      this.enforceLimit();
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a component from cache
   */
  delete(key: string): boolean {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return this.cache.delete(key);
  }

  /**
   * Get all values
   */
  values(): IterableIterator<ComponentData> {
    return this.cache.values();
  }

  /**
   * Iterate over all entries with callback
   */
  forEach(
    callbackfn: (value: ComponentData, key: string, map: Map<string, ComponentData>) => void
  ): void {
    this.cache.forEach(callbackfn);
  }

  /**
   * Get all entries
   */
  entries(): IterableIterator<[string, ComponentData]> {
    return this.cache.entries();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get underlying map (for compatibility)
   */
  getMap(): Map<string, ComponentData> {
    return this.cache;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Update access order for a key (move to end = most recently used)
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Enforce the size limit by evicting least recently used entries
   */
  private enforceLimit(): void {
    while (this.accessOrder.length > this.maxSize) {
      const lruKey = this.accessOrder.shift(); // Remove oldest (least recently used)
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }
  }

  /**
   * Get keys in LRU order (oldest first)
   */
  getKeysByAccessOrder(): string[] {
    return [...this.accessOrder];
  }

  /**
   * Get eviction candidates (least recently used keys)
   * @param count Number of candidates to return
   */
  getEvictionCandidates(count: number): string[] {
    return this.accessOrder.slice(0, Math.min(count, this.accessOrder.length));
  }
}

/** Maximum commits limit */
const MAX_COMMITS = 500;

/** Minimum sidebar width */
const MIN_SIDEBAR_WIDTH = 180;

/** Maximum sidebar width */
const MAX_SIDEBAR_WIDTH = 600;

// Store implementation
const storeImplementation = (
  set: StoreApi<ProfilerStore>['setState'],
  get: StoreApi<ProfilerStore>['getState']
): ProfilerStore => ({
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
  componentData: new ComponentDataLRUCache(defaultConfig.maxComponentDataEntries),
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
  rscAnalysisError: null,

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
      componentData: new ComponentDataLRUCache(get().config.maxComponentDataEntries),
      expandedNodes: new Set<string>(),
      analysisError: null,
      recordingDuration: 0,
      recordingStartTime: null,
      rscPayloads: [],
      rscAnalysis: null,
      rscMetrics: null,
      rscAnalysisError: null,
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
    const { commits, recordingDuration, analysisResults, rscPayloads, rscAnalysis } = get();
    
    // Extract React version from first commit if available
    const reactVersion = commits[0]?.reactVersion ?? 'unknown';
    
    const profile: ExportedProfileV1 = createExportProfile(commits, recordingDuration, {
      reactVersion,
      analysisResults: analysisResults ?? undefined,
      rscPayloads: rscPayloads.length > 0 ? rscPayloads : undefined,
      rscAnalysis: rscAnalysis ?? undefined,
    });
    
    return JSON.stringify(profile, null, 2);
  },

  validateImportData: (json: string): ImportValidationResult => {
    try {
      const data = JSON.parse(json);
      return validateImportData(data);
    } catch {
      return {
        isValid: false,
        version: 'unknown',
        isSupported: false,
        migrationAvailable: false,
        error: 'Invalid JSON file',
      };
    }
  },

  importDataWithMigration: (json: string) => {
    try {
      const data = JSON.parse(json);
      
      // Validate the import data
      const validation = validateImportData(data);
      
      if (!validation.isValid) {
        return { 
          success: false, 
          error: validation.error || 'Invalid import data' 
        };
      }

      let profile: ExportedProfileV1;
      let migrated = false;
      let migrationLog: MigrationLogEntry[] | undefined;

      // Check if migration is needed
      if (validation.migrationAvailable && validation.migrationTarget) {
        try {
          const result = autoMigrateProfileWithLogging(data);
          profile = result.profile;
          migrated = result.migrated;
          migrationLog = result.log;
        } catch (migrateError) {
          let errorMessage = 'Failed to migrate profile to current format';
          
          if (migrateError instanceof MigrationError) {
            errorMessage = `Migration failed: ${migrateError.message}`;
            migrationLog = migrateError.log;
          } else if (migrateError instanceof CorruptedProfileError) {
            errorMessage = `Corrupted profile: ${migrateError.message}`;
          }
          
          return { 
            success: false, 
            error: errorMessage,
            migrationLog
          };
        }
      } else if (isExportedProfileV1(data)) {
        profile = data;
      } else {
        // Try auto-migration for unknown formats
        try {
          const result = autoMigrateProfileWithLogging(data);
          profile = result.profile;
          migrated = result.migrated;
          migrationLog = result.log;
        } catch (migrateError) {
          let errorMessage = 'Unsupported profile format';
          
          if (migrateError instanceof MigrationError) {
            errorMessage = `Migration failed: ${migrateError.message}`;
            migrationLog = migrateError.log;
          } else if (migrateError instanceof CorruptedProfileError) {
            errorMessage = `Corrupted profile: ${migrateError.message}`;
          }
          
          return { 
            success: false, 
            error: errorMessage,
            migrationLog
          };
        }
      }

      // Import the data
      set({
        commits: profile.data.commits || [],
        recordingDuration: profile.recordingDuration || 0,
        rscPayloads: profile.data.rscPayloads || [],
        rscAnalysis: profile.data.rscAnalysis || null,
        analysisResults: profile.data.analysisResults || null,
        wastedRenderReports: profile.data.analysisResults?.wastedRenderReports || [],
        memoReports: profile.data.analysisResults?.memoReports || [],
        selectedCommitId: null,
        selectedComponent: null,
        selectedComponentName: null,
        timeTravelIndex: null,
        analysisError: null,
      });

      return { success: true, migrated, migrationLog };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid JSON data';
      set({ analysisError: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  importData: (json: string) => {
    const result = get().importDataWithMigration(json);
    if (!result.success) {
      set({ analysisError: result.error || 'Import failed' });
    }
  },

  updateConfig: (newConfig: Partial<ProfilerConfig>) => {
    set((state: ProfilerState) => {
      // Update cache size if maxComponentDataEntries changed
      if (newConfig.maxComponentDataEntries !== undefined) {
        state.componentData.setMaxSize(newConfig.maxComponentDataEntries);
      }
      return {
        config: { ...state.config, ...newConfig },
      };
    });
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

      // Aggregate component data using LRU cache
      const { componentData, config } = get();
      
      // Ensure cache size is up to date
      componentData.setMaxSize(config.maxComponentDataEntries);

      for (const commit of commits) {
        for (const node of commit.nodes ?? []) {
          const name = node.displayName;
          if (!name) continue;

          let data = componentData.get(name);
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
          }

          data.renderCount++;
          data.totalDuration += node.actualDuration;
          data.commitIds.push(commit.id);
          
          // Set/update in LRU cache (this updates access order)
          componentData.set(name, data);
        }
      }

      // Calculate averages
      for (const data of componentData.values()) {
        data.averageDuration = data.totalDuration / data.renderCount;
      }

      // Calculate performance score
      const totalComponents = componentData.size;
      const totalRenderTime = Array.from(componentData.values()).reduce(
        (sum, c) => sum + c.totalDuration,
        0
      );
      const avgRenderTime = totalComponents > 0 ? totalRenderTime / totalComponents : 0;

      // Calculate performance score based on average render time
      // Score decreases as average render time increases
      // Formula: score = MAX - (avgRenderTime * MULTIPLIER)
      // With MULTIPLIER=5: 20ms avg = 0 points, 10ms = 50 points, 5ms = 75 points
      const calculatedScore =
        MAX_PERFORMANCE_SCORE - avgRenderTime * RENDER_TIME_SCORE.MULTIPLIER;
      const clampedScore = Math.max(
        MIN_PERFORMANCE_SCORE,
        Math.min(MAX_PERFORMANCE_SCORE, calculatedScore)
      );

      const performanceScore: PerformanceMetrics = {
        score: clampedScore,
        averageRenderTime: avgRenderTime,
        wastedRenderRate: 0,
        averageMemoHitRate: 0,
        totalComponents,
      };

      set({
        isAnalyzing: false,
        performanceScore,
        componentData,
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
        if (node.id !== undefined && node.id !== null) {
          allNodeIds.add(String(node.id));
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
      
      // Enforce max expanded nodes limit using FIFO eviction
      if (newExpanded.size > MAX_EXPANDED_NODES) {
        const firstKey = newExpanded.values().next().value;
        if (firstKey !== undefined) {
          newExpanded.delete(firstKey);
        }
      }
    }
    set({ expandedNodes: newExpanded });
  },

  addRSCPayload: (payload: RSCPayload) => {
    const { rscPayloads } = get();
    const newPayloads = [...rscPayloads, payload];
    
    // Enforce max RSC payloads limit
    if (newPayloads.length > MAX_RSC_PAYLOADS) {
      newPayloads.shift(); // Remove oldest
    }
    
    set({ rscPayloads: newPayloads });
  },

  clearRSCData: () => {
    set({
      rscPayloads: [],
      rscAnalysis: null,
      rscMetrics: null,
      rscAnalysisError: null,
    });
  },

  setRSCAnalysis: (analysis: RSCAnalysisResult) => {
    set({
      rscAnalysis: analysis,
      rscMetrics: analysis.metrics,
    });
  },

  analyzeRSC: async (config?: Partial<RSCAnalysisConfig>) => {
    set({ isAnalyzingRSC: true, rscAnalysisError: null });

    // Allow state update to propagate before starting analysis
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const { rscPayloads, commits } = get();

      if (rscPayloads.length === 0) {
        set({
          isAnalyzingRSC: false,
        });
        return;
      }

      // Extract fiber data from commits for boundary detection
      const fiberData = commits.flatMap((commit: CommitData) => commit.nodes ?? []);

      // Convert payloads to raw data for worker (they're already parsed, so we need to serialize)
      const rawPayloads = rscPayloads.map((payload: RSCPayload) => {
        // If payload has chunks with raw data, use that; otherwise serialize the payload
        const firstChunk = payload.chunks[0];
        if (firstChunk && typeof firstChunk.data === 'string') {
          // Reconstruct from chunks if available
          return payload.chunks.map((chunk: RSCPayload['chunks'][0]) => chunk.data ?? '').join('\n');
        }
        // Otherwise serialize the parsed payload
        return JSON.stringify(payload);
      });

      // Use the RSC worker for analysis
      const analysisResult = await rscWorker.analyzeRSC(rawPayloads, fiberData, config);

      // Calculate aggregated metrics from all payloads as fallback
      // (the worker should provide this, but we keep this for compatibility)
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
        rscAnalysis: analysisResult,
      });
    } catch (error) {
      set({
        isAnalyzingRSC: false,
        rscAnalysisError: error instanceof Error ? error.message : 'RSC analysis failed',
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
