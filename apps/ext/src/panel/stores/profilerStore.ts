/**
 * Main profiler store — commits, analysis, view state, selection, web vitals,
 * render causes, source locations, score history, performance budgets, and time travel.
 */

import { create } from 'zustand';
import { CircularBuffer } from '../utils/circularBuffer';
import { DEFAULT_PROFILER_CONFIG } from '@/src/shared/constants';
import type {
  CommitData, ComponentMetrics, AnalysisResult, WebVitalMetric,
  WastedRenderReport, MemoReport, RenderCause, SourceLocation,
} from '@/src/shared/types';

export type ViewMode = 'tree' | 'flamegraph' | 'timeline' | 'analysis' | 'vitals' | 'compare' | 'dependencies';

// Performance Budget Types
export interface PerformanceBudget {
  id: string;
  name: string;
  rules: BudgetRule[];
  createdAt: number;
}

export interface BudgetRule {
  /** Component name pattern (supports wildcards) */
  componentPattern: string;
  /** Maximum allowed render count per session */
  maxRenderCount?: number;
  /** Maximum wasted render rate (0-100) */
  maxWastedRenderRate?: number;
  /** Maximum average render duration in ms */
  maxAvgRenderDuration?: number;
  /** Minimum memoization hit rate (0-100) */
  minMemoHitRate?: number;
}

export interface BudgetViolation {
  rule: BudgetRule;
  componentName: string;
  actualValue: number;
  threshold: number;
  metric: string;
}

// Score History Types
export interface ScoreHistoryEntry {
  timestamp: number;
  score: number;
  commitCount: number;
  url: string;
  topIssue?: string;
}

// Time Travel Types
export interface TimeTravelState {
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  playbackSpeed: number; // commits per second
  playingCommitId: string | null;
}

export interface ProfilerState {
  // Recording
  isRecording: boolean;
  recordingStartTime: number | null;

  // Commits (backed by CircularBuffer)
  commits: CircularBuffer<CommitData>;
  _commitVersion: number;
  selectedCommitId: string | null;

  // Analysis
  analysisResults: AnalysisResult | null;
  analysisProgress: number;
  isAnalyzing: boolean;
  componentMetrics: Map<string, ComponentMetrics>;
  wastedRenderReports: WastedRenderReport[];
  memoReports: MemoReport[];
  performanceScore: number | null;

  // View
  viewMode: ViewMode;
  sidebarWidth: number;
  detailPanelWidth: number;
  isDetailPanelOpen: boolean;

  // Selection
  selectedComponent: string | null;
  expandedNodes: Set<string>;
  filterText: string;
  severityFilter: string | null;

  // Web Vitals
  webVitals: WebVitalMetric[];

  // Render Causes
  renderCauses: Map<string, RenderCause[]>;

  // Source Locations
  sourceLocations: Map<string, SourceLocation>;

  // Fiber map for delta reconstruction
  fiberMap: Map<string, import('@/src/shared/types').FiberData>;

  // Score History
  scoreHistory: ScoreHistoryEntry[];

  // Performance Budgets
  budgets: PerformanceBudget[];
  budgetViolations: BudgetViolation[];

  // Time Travel
  timeTravel: TimeTravelState;

  // Actions
  addCommit: (commit: CommitData) => void;
  addCommitBatch: (commits: CommitData[]) => void;
  clearCommits: () => void;
  setSelectedCommit: (id: string | null) => void;

  startRecording: () => void;
  stopRecording: () => void;

  setAnalysisResults: (results: AnalysisResult) => void;
  setAnalysisProgress: (progress: number) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setComponentMetrics: (metrics: Map<string, ComponentMetrics>) => void;
  setWastedRenderReports: (reports: WastedRenderReport[]) => void;
  setMemoReports: (reports: MemoReport[]) => void;
  setPerformanceScore: (score: number | null) => void;

  setViewMode: (mode: ViewMode) => void;
  toggleNode: (id: string) => void;
  selectComponent: (name: string | null) => void;
  setFilterText: (text: string) => void;
  setSeverityFilter: (filter: string | null) => void;
  toggleDetailPanel: () => void;

  addWebVitals: (metrics: WebVitalMetric[]) => void;

  // Render Causes
  setRenderCauses: (causes: Map<string, RenderCause[]>) => void;

  // Source Locations
  setSourceLocations: (locations: Map<string, SourceLocation>) => void;

  // Fiber map
  setFiberMap: (map: Map<string, import('@/src/shared/types').FiberData>) => void;

  // Score History
  addScoreHistoryEntry: (entry: ScoreHistoryEntry) => void;

  // Performance Budgets
  addBudget: (budget: PerformanceBudget) => void;
  removeBudget: (id: string) => void;
  setBudgetViolations: (violations: BudgetViolation[]) => void;
  checkBudgets: () => BudgetViolation[];

  // Time Travel
  setTimeTravelPlaying: (playing: boolean) => void;
  setTimeTravelStep: (step: number) => void;
  setTimeTravelSpeed: (speed: number) => void;
  nextTimeTravelStep: () => void;
  prevTimeTravelStep: () => void;

  // Bulk
  reset: () => void;
}

const createInitialCommits = () => new CircularBuffer<CommitData>(DEFAULT_PROFILER_CONFIG.maxCommits);

export const useProfilerStore = create<ProfilerState>((set, get) => ({
  // Recording
  isRecording: false,
  recordingStartTime: null,

  // Commits
  commits: createInitialCommits(),
  _commitVersion: 0,
  selectedCommitId: null,

  // Analysis
  analysisResults: null,
  analysisProgress: 0,
  isAnalyzing: false,
  componentMetrics: new Map(),
  wastedRenderReports: [],
  memoReports: [],
  performanceScore: null,

  // View
  viewMode: 'tree',
  sidebarWidth: 280,
  detailPanelWidth: 400,
  isDetailPanelOpen: false,

  // Selection
  selectedComponent: null,
  expandedNodes: new Set(),
  filterText: '',
  severityFilter: null,

  // Web Vitals
  webVitals: [],

  // Render Causes
  renderCauses: new Map(),

  // Source Locations
  sourceLocations: new Map(),

  // Fiber map for delta reconstruction
  fiberMap: new Map(),

  // Score History
  scoreHistory: [],

  // Performance Budgets
  budgets: [],
  budgetViolations: [],

  // Time Travel
  timeTravel: {
    isPlaying: false,
    currentStep: 0,
    totalSteps: 0,
    playbackSpeed: 2,
    playingCommitId: null,
  },

  // Actions
  addCommit: (commit) => {
    const { commits, renderCauses, sourceLocations, fiberMap } = get();

    // Handle delta commits — merge changed fibers into fiber map
    if (commit.isDelta && commit.deltaChangedFibers) {
      const newMap = new Map(fiberMap);
      // Merge changed fibers
      for (const fiber of commit.deltaChangedFibers) {
        newMap.set(fiber.id, fiber);
      }
      // Remove deleted fibers
      if (commit.deltaRemovedFiberIds) {
        for (const id of commit.deltaRemovedFiberIds) {
          newMap.delete(id);
        }
      }
      // Reconstruct full fibers array from map
      commit.fibers = Array.from(newMap.values());
      set({ fiberMap: newMap });
    } else if (commit.fibers) {
      // Full commit — rebuild fiber map
      const newMap = new Map<string, import('@/src/shared/types').FiberData>();
      for (const fiber of commit.fibers) {
        newMap.set(fiber.id, fiber);
      }
      set({ fiberMap: newMap });
    }

    commits.push(commit);

    // Extract render causes from commit
    const newCauses = new Map(renderCauses);
    if (commit.renderCauses) {
      for (const cause of commit.renderCauses) {
        const existing = newCauses.get(cause.componentName) ?? [];
        newCauses.set(cause.componentName, [...existing.slice(-9), cause]);
      }
    }

    // Extract source locations from fibers
    const newLocations = new Map(sourceLocations);
    if (commit.fibers) {
      for (const fiber of commit.fibers) {
        if (fiber.sourceLocation && fiber.displayName) {
          newLocations.set(fiber.displayName, fiber.sourceLocation);
        }
      }
    }

    set({
      commits,
      _commitVersion: get()._commitVersion + 1,
      renderCauses: newCauses,
      sourceLocations: newLocations,
      timeTravel: { ...get().timeTravel, totalSteps: commits.size },
    });
  },

  addCommitBatch: (batchCommits) => {
    const { commits, renderCauses, sourceLocations } = get();
    const newCauses = new Map(renderCauses);
    const newLocations = new Map(sourceLocations);

    for (const commit of batchCommits) {
      commits.push(commit);

      if (commit.renderCauses) {
        for (const cause of commit.renderCauses) {
          const existing = newCauses.get(cause.componentName) ?? [];
          newCauses.set(cause.componentName, [...existing.slice(-9), cause]);
        }
      }

      if (commit.fibers) {
        for (const fiber of commit.fibers) {
          if (fiber.sourceLocation && fiber.displayName) {
            newLocations.set(fiber.displayName, fiber.sourceLocation);
          }
        }
      }
    }

    set({
      commits,
      _commitVersion: get()._commitVersion + 1,
      renderCauses: newCauses,
      sourceLocations: newLocations,
      timeTravel: { ...get().timeTravel, totalSteps: commits.size },
    });
  },

  clearCommits: () => set({
    commits: createInitialCommits(),
    _commitVersion: 0,
    selectedCommitId: null,
    analysisResults: null,
    analysisProgress: 0,
    isAnalyzing: false,
    componentMetrics: new Map(),
    wastedRenderReports: [],
    memoReports: [],
    performanceScore: null,
    renderCauses: new Map(),
    sourceLocations: new Map(),
    fiberMap: new Map(),
    budgetViolations: [],
    timeTravel: { isPlaying: false, currentStep: 0, totalSteps: 0, playbackSpeed: 2, playingCommitId: null },
  }),

  setSelectedCommit: (id) => set({ selectedCommitId: id }),

  startRecording: () => set({ isRecording: true, recordingStartTime: Date.now() }),
  stopRecording: () => set({ isRecording: false }),

  setAnalysisResults: (results) => set({ analysisResults: results }),
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setComponentMetrics: (metrics) => set({ componentMetrics: metrics }),
  setWastedRenderReports: (reports) => set({ wastedRenderReports: reports }),
  setMemoReports: (reports) => set({ memoReports: reports }),
  setPerformanceScore: (score) => set({ performanceScore: score }),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleNode: (id) => set((state) => {
    const expanded = new Set(state.expandedNodes);
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    return { expandedNodes: expanded };
  }),

  selectComponent: (name) => set({ selectedComponent: name, isDetailPanelOpen: name !== null }),
  setFilterText: (text) => set({ filterText: text }),
  setSeverityFilter: (filter) => set({ severityFilter: filter }),
  toggleDetailPanel: () => set((state) => ({ isDetailPanelOpen: !state.isDetailPanelOpen })),

  addWebVitals: (metrics) => set((state) => ({ webVitals: [...state.webVitals, ...metrics] })),

  // Render Causes
  setRenderCauses: (causes) => set({ renderCauses: causes }),

  // Source Locations
  setSourceLocations: (locations) => set({ sourceLocations: locations }),

  // Fiber map
  setFiberMap: (map) => set({ fiberMap: map }),

  // Score History
  addScoreHistoryEntry: (entry) => set((state) => ({
    scoreHistory: [...state.scoreHistory, entry].slice(-100), // Keep last 100 entries
  })),

  // Performance Budgets
  addBudget: (budget) => set((state) => ({
    budgets: [...state.budgets, budget],
  })),
  removeBudget: (id) => set((state) => ({
    budgets: state.budgets.filter((b) => b.id !== id),
  })),
  setBudgetViolations: (violations) => set({ budgetViolations: violations }),

  checkBudgets: () => {
    const { budgets, wastedRenderReports, memoReports, componentMetrics } = get();
    const violations: BudgetViolation[] = [];

    for (const budget of budgets) {
      for (const rule of budget.rules) {
        const pattern = rule.componentPattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);

        for (const report of wastedRenderReports) {
          if (!regex.test(report.componentName)) continue;

          if (rule.maxRenderCount !== undefined && report.totalRenders > rule.maxRenderCount) {
            violations.push({
              rule,
              componentName: report.componentName,
              actualValue: report.totalRenders,
              threshold: rule.maxRenderCount,
              metric: 'maxRenderCount',
            });
          }

          if (rule.maxWastedRenderRate !== undefined && report.wastedRenderRate > rule.maxWastedRenderRate) {
            violations.push({
              rule,
              componentName: report.componentName,
              actualValue: report.wastedRenderRate,
              threshold: rule.maxWastedRenderRate,
              metric: 'maxWastedRenderRate',
            });
          }
        }

        for (const report of memoReports) {
          if (!regex.test(report.componentName)) continue;

          if (rule.minMemoHitRate !== undefined && report.currentHitRate < rule.minMemoHitRate) {
            violations.push({
              rule,
              componentName: report.componentName,
              actualValue: report.currentHitRate,
              threshold: rule.minMemoHitRate,
              metric: 'minMemoHitRate',
            });
          }
        }

        for (const [name, metrics] of componentMetrics) {
          if (!regex.test(name)) continue;

          if (rule.maxAvgRenderDuration !== undefined && metrics.averageRenderTime > rule.maxAvgRenderDuration) {
            violations.push({
              rule,
              componentName: name,
              actualValue: metrics.averageRenderTime,
              threshold: rule.maxAvgRenderDuration,
              metric: 'maxAvgRenderDuration',
            });
          }
        }
      }
    }

    set({ budgetViolations: violations });
    return violations;
  },

  // Time Travel
  setTimeTravelPlaying: (playing) => set((state) => ({
    timeTravel: { ...state.timeTravel, isPlaying: playing },
  })),
  setTimeTravelStep: (step) => {
    const { commits, timeTravel } = get();
    const clamped = Math.max(0, Math.min(step, commits.size - 1));
    const commitArray = Array.from(commits);
    const commit = commitArray[clamped];
    set({
      timeTravel: { ...timeTravel, currentStep: clamped, playingCommitId: commit?.id ?? null },
      selectedCommitId: commit?.id ?? null,
    });
  },
  setTimeTravelSpeed: (speed) => set((state) => ({
    timeTravel: { ...state.timeTravel, playbackSpeed: speed },
  })),
  nextTimeTravelStep: () => {
    const { timeTravel } = get();
    get().setTimeTravelStep(timeTravel.currentStep + 1);
  },
  prevTimeTravelStep: () => {
    const { timeTravel } = get();
    get().setTimeTravelStep(timeTravel.currentStep - 1);
  },

  // Bulk
  reset: () => set({
    isRecording: false,
    recordingStartTime: null,
    commits: createInitialCommits(),
    _commitVersion: 0,
    selectedCommitId: null,
    analysisResults: null,
    analysisProgress: 0,
    isAnalyzing: false,
    componentMetrics: new Map(),
    wastedRenderReports: [],
    memoReports: [],
    performanceScore: null,
    selectedComponent: null,
    expandedNodes: new Set(),
    filterText: '',
    webVitals: [],
    renderCauses: new Map(),
    sourceLocations: new Map(),
    fiberMap: new Map(),
    budgetViolations: [],
    timeTravel: { isPlaying: false, currentStep: 0, totalSteps: 0, playbackSpeed: 2, playingCommitId: null },
  }),
}));
