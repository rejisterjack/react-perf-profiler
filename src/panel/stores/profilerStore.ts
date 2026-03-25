/**
 * Zustand store for profiler state management
 * @module panel/stores/profilerStore
 */

import type { StoreApi } from 'zustand';
import { create } from 'zustand';
import { analysisWorker, rscWorker } from '@/panel/workers/workerClient';
import { CircularBuffer } from '@/panel/utils/circularBuffer';
import {
  DEFAULT_DETAIL_PANEL_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_PERFORMANCE_SCORE,
  MIN_PERFORMANCE_SCORE,
  RENDER_TIME_SCORE,
} from '@/shared/constants';
import {
  autoMigrateProfileWithLogging,
  CorruptedProfileError,
  MigrationError,
} from '@/shared/export/migrations';
import type {
  AnalysisResult,
  CommitData,
  MemoReport,
  ProfilerConfig,
  WastedRenderReport,
} from '@/shared/types';
import type {
  ExportedProfileV1,
  ExportedProfileV2,
  ImportValidationResult,
  MigrationLogEntry,
} from '@/shared/types/export';
import {
  createExportProfile,
  isExportedProfileV1,
  validateImportData,
} from '@/shared/types/export';
import type {
  RSCAnalysisConfig,
  RSCAnalysisResult,
  RSCMetrics,
  RSCPayload,
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
export type ViewMode = 'tree' | 'flamegraph' | 'timeline' | 'analysis' | 'compare';

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
  /** Array of captured commits (computed from circular buffer) */
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
  /** Component data map with LRU eviction */
  componentData: ComponentDataLRUCache;
  /** Whether detail panel is open */
  isDetailPanelOpen: boolean;
  /** Width of the sidebar in pixels */
  sidebarWidth: number;
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
  /** Import data from JSON string with migration if needed */
  importData: (json: string) => { success: boolean; error?: string; migrated?: boolean; migrationLog?: MigrationLogEntry[] };
  /** Validate import data and return validation result */
  validateImportData: (json: string) => ImportValidationResult;
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
  wastedRenderThreshold: 20,
};

/** Maximum component data entries (absolute limit) */
const MAX_COMPONENT_DATA_ENTRIES = 10000;

/** Maximum RSC payloads to store */
const MAX_RSC_PAYLOADS = 100;

/** Maximum expanded nodes to track */
const MAX_EXPANDED_NODES = 1000;

/**
 * O(1) LRU Cache manager for component data
 * Uses Map's insertion order preservation for O(1) access, update, and eviction
 */
class ComponentDataLRUCache {
  private cache: Map<string, ComponentData>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
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
   * O(1) operation
   */
  get(key: string): ComponentData | undefined {
    const data = this.cache.get(key);
    if (data) {
      // Move to end (most recently used) by re-inserting
      this.cache.delete(key);
      this.cache.set(key, data);
    }
    return data;
  }

  /**
   * Set a component and update access order
   * O(1) operation
   */
  set(key: string, value: ComponentData): void {
    if (this.cache.has(key)) {
      // Update existing entry: delete and re-insert to move to end
      this.cache.delete(key);
    }
    // Add new entry
    this.cache.set(key, value);
    this.enforceLimit();
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a component from cache
   * O(1) operation
   */
  delete(key: string): boolean {
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
  }

  /**
   * Enforce the size limit by evicting least recently used entries
   * O(1) per eviction: Map preserves insertion order, first entries are oldest
   */
  private enforceLimit(): void {
    while (this.cache.size > this.maxSize) {
      const lruKey = this.cache.keys().next().value; // Get oldest (first) key
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }
  }

  /**
   * Get keys in LRU order (oldest first)
   * O(n) - for debugging/admin purposes only
   */
  getKeysByAccessOrder(): string[] {
    return [...this.cache.keys()];
  }

  /**
   * Get eviction candidates (least recently used keys)
   * O(k) where k is count - for debugging/admin purposes only
   * @param count Number of candidates to return
   */
  getEvictionCandidates(count: number): string[] {
    const keys: string[] = [];
    let i = 0;
    for (const key of this.cache.keys()) {
      if (i >= count) break;
      keys.push(key);
      i++;
    }
    return keys;
  }
}

/** Maximum commits limit */
const MAX_COMMITS = 500;

/** Auto-analysis delay after recording stops (ms) */
const AUTO_ANALYSIS_DELAY_MS = 500;

/** Debounce timer for auto-analysis */
let autoAnalysisTimer: ReturnType<typeof setTimeout> | null = null;

/** Circular buffer for O(1) commit storage (module-level for persistence across renders) */
const commitsBuffer = new CircularBuffer<CommitData>(MAX_COMMITS);

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

  timeTravelIndex: null,
  viewMode: 'tree',
  filterText: '',
  expandedNodes: new Set<string>(),
  isAnalyzing: false,
  analysisError: null,
  performanceScore: null,
  componentData: new ComponentDataLRUCache(defaultConfig.maxComponentDataEntries),
  isDetailPanelOpen: true,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,

  detailPanelWidth: DEFAULT_DETAIL_PANEL_WIDTH,
  componentTypeFilter: 'all',
  severityFilter: ['critical', 'warning', 'info'],
  rscPayloads: [],
  rscAnalysis: null,
  rscMetrics: null,
  isAnalyzingRSC: false,
  rscAnalysisError: null,

  // Actions
  startRecording: () => {
    // Clear circular buffer for new recording
    commitsBuffer.clear();
    
    // Cancel any pending auto-analysis
    if (autoAnalysisTimer) {
      clearTimeout(autoAnalysisTimer);
      autoAnalysisTimer = null;
    }
    
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
    const { recordingStartTime, runAnalysis } = get();
    const duration = recordingStartTime ? Date.now() - recordingStartTime : 0;
    set({ isRecording: false, recordingDuration: duration });
    
    // Auto-trigger analysis after delay
    if (autoAnalysisTimer) {
      clearTimeout(autoAnalysisTimer);
    }
    autoAnalysisTimer = setTimeout(() => {
      // Only run if we have commits and not already analyzing
      const { commits, isAnalyzing } = get();
      if (commits.length > 0 && !isAnalyzing) {
        runAnalysis();
      }
    }, AUTO_ANALYSIS_DELAY_MS);
  },

  clearData: () => {
    // Clear circular buffer
    commitsBuffer.clear();
    
    // Clear auto-analysis timer
    if (autoAnalysisTimer) {
      clearTimeout(autoAnalysisTimer);
      autoAnalysisTimer = null;
    }
    
    set({
      commits: [],
      analysisResults: null,
      wastedRenderReports: [],
      memoReports: [],
      selectedCommitId: null,
      selectedComponent: null,

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
    // O(1) append using circular buffer
    commitsBuffer.push(commit);
    
    // Export to array for React state (UI reads from this)
    set({ commits: commitsBuffer.toArray() });
  },

  addCommits: (commitsToAdd: CommitData[]) => {
    // O(n) for n commits, but each is O(1) append
    for (const commit of commitsToAdd) {
      commitsBuffer.push(commit);
    }
    
    // Export to array for React state
    set({ commits: commitsBuffer.toArray() });
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

  importData: (json: string) => {
    try {
      const data = JSON.parse(json);

      // Validate the import data
      const validation = validateImportData(data);

      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error || 'Invalid import data',
        };
      }

      let profile: ExportedProfileV1 | ExportedProfileV2;
      let migrated = false;
      let migrationLog: MigrationLogEntry[] | undefined;

      // Check if migration is needed
      if (validation.migrationAvailable && validation.migrationTarget) {
        try {
          const result = autoMigrateProfileWithLogging(data);
          // Migration always produces V1 or V2 — legacy is upgraded before this point
          profile = result.profile as ExportedProfileV1 | ExportedProfileV2;
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
            migrationLog,
          };
        }
      } else if (isExportedProfileV1(data)) {
        profile = data;
      } else {
        // Try auto-migration for unknown formats
        try {
          const result = autoMigrateProfileWithLogging(data);
          // Migration always produces V1 or V2 — legacy is upgraded before this point
          profile = result.profile as ExportedProfileV1 | ExportedProfileV2;
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
            migrationLog,
          };
        }
      }

      // Populate circular buffer with imported commits
      commitsBuffer.clear();
      for (const commit of profile.data.commits || []) {
        commitsBuffer.push(commit);
      }
      
      // Import the data
      set({
        commits: commitsBuffer.toArray(),
        recordingDuration: profile.recordingDuration || 0,
        rscPayloads: profile.data.rscPayloads || [],
        rscAnalysis: profile.data.rscAnalysis || null,
        analysisResults: profile.data.analysisResults || null,
        wastedRenderReports: profile.data.analysisResults?.wastedRenderReports || [],
        memoReports: profile.data.analysisResults?.memoReports || [],
        selectedCommitId: null,
        selectedComponent: null,

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

      isDetailPanelOpen: componentName !== null,
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
    const { commits } = get();
    const allNodeIds = new Set<string>();

    for (const commit of commits) {
      for (const node of commit.nodes ?? []) {
        if (node.id !== undefined && node.id !== null) {
          allNodeIds.add(`${commit.id}-${node.id}`);
        }
      }
    }

    set({ expandedNodes: allNodeIds });
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

    try {
      const { commits, config } = get();

      // Check if there are commits to analyze
      if (commits.length === 0) {
        set({
          isAnalyzing: false,
          analysisError: 'No commits to analyze',
        });
        return;
      }

      // Use the analysis worker for off-main-thread computation
      const analysisResult = await analysisWorker.analyzeAll(commits);

      // Aggregate component data using LRU cache for the store
      const componentData = new ComponentDataLRUCache(config.maxComponentDataEntries);

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

          // Set/update in LRU cache
          componentData.set(name, data);
        }
      }

      // Calculate averages
      for (const data of componentData.values()) {
        data.averageDuration = data.totalDuration / data.renderCount;
      }

      // Calculate performance score from analysis results
      const totalComponents = componentData.size;
      const totalRenderTime = Array.from(componentData.values()).reduce(
        (sum, c) => sum + c.totalDuration,
        0
      );
      const avgRenderTime = totalComponents > 0 ? totalRenderTime / totalComponents : 0;

      // Calculate wasted render rate from worker reports
      const wastedReports = analysisResult.wastedRenderReports ?? [];
      const totalWastedRenders = wastedReports.reduce((sum: number, r) => sum + r.wastedRenders, 0);
      const totalRenders = wastedReports.reduce((sum: number, r) => sum + r.totalRenders, 0);
      const wastedRenderRate = totalRenders > 0 ? (totalWastedRenders / totalRenders) * 100 : 0;

      // Calculate average memo hit rate
      const memoReports = analysisResult.memoReports ?? [];
      const avgMemoHitRate =
        memoReports.length > 0
          ? (memoReports.reduce((sum: number, r) => sum + r.currentHitRate, 0) /
              memoReports.length) *
            100
          : 0;

      // Calculate performance score based on average render time
      const calculatedScore = MAX_PERFORMANCE_SCORE - avgRenderTime * RENDER_TIME_SCORE.MULTIPLIER;
      const clampedScore = Math.max(
        MIN_PERFORMANCE_SCORE,
        Math.min(MAX_PERFORMANCE_SCORE, calculatedScore)
      );

      const performanceScore: PerformanceMetrics = {
        score: clampedScore,
        averageRenderTime: avgRenderTime,
        wastedRenderRate,
        averageMemoHitRate: avgMemoHitRate,
        totalComponents,
      };

      set({
        isAnalyzing: false,
        performanceScore,
        componentData,
        wastedRenderReports: wastedReports,
        memoReports: memoReports,
        analysisResults: analysisResult,
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
          return payload.chunks
            .map((chunk: RSCPayload['chunks'][0]) => chunk.data ?? '')
            .join('\n');
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
      const chunkSizes = rscPayloads.flatMap((p: RSCPayload) => p.chunks.map((c) => c.size));

      const streamMetrics: RSCMetrics['streamMetrics'] = {
        chunkCount: totalChunks,
        averageChunkSize:
          chunkSizes.length > 0
            ? chunkSizes.reduce((a: number, b: number) => a + b, 0) / chunkSizes.length
            : 0,
        maxChunkSize: chunkSizes.length > 0 ? Math.max(...chunkSizes) : 0,
        minChunkSize: chunkSizes.length > 0 ? Math.min(...chunkSizes) : 0,
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
