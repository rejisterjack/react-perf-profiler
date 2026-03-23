import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import type { CommitData, AnalysisResult } from '@/shared/types';

// Mock the zustand devtools middleware
vi.mock('zustand/middleware', () => ({
  devtools: (fn: any) => fn,
  persist: (fn: any) => fn,
}));

// Mock the analysis worker
vi.mock('@/panel/workers/workerClient', () => ({
  analysisWorker: {
    analyzeAll: vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      totalCommits: 1,
      wastedRenderReports: [{
        componentName: 'TestComponent',
        renderCount: 1,
        totalRenders: 1,
        wastedRenders: 0,
        wastedRenderRate: 0,
        recommendedAction: 'none',
        estimatedSavingsMs: 0,
        severity: 'low',
        issues: [],
      }],
      memoReports: [],
      performanceScore: 100,
      topOpportunities: [],
    }),
    terminate: vi.fn(),
  },
  rscWorker: {
    analyzeRSC: vi.fn().mockResolvedValue({
      boundaries: [],
      boundaryCrossings: [],
      metrics: null,
      recommendations: [],
      issues: [],
    }),
    terminate: vi.fn(),
  },
}));

// Get the store's initial state for reset
const getInitialState = () => {
  const store = useProfilerStore.getState();
  return {
    isRecording: false,
    recordingStartTime: null,
    recordingDuration: 0,
    commits: [],
    selectedCommitId: null,
    selectedComponent: null,
    componentData: new Map(),
    wastedRenderReports: [],
    memoReports: [],
    performanceScore: null,
    isAnalyzing: false,
    analysisError: null,
    filterText: '',
    severityFilter: ['critical', 'warning', 'info'] as const,
    componentTypeFilter: 'all' as const,
    viewMode: 'tree' as const,
    sidebarWidth: 280,
    detailPanelWidth: 320,
    isDetailPanelOpen: true,
    expandedNodes: new Set<string>(),
  };
};

describe('profilerStore', () => {
  beforeEach(() => {
    // Reset store to initial state while preserving methods
    const currentState = useProfilerStore.getState();
    const initialData = getInitialState();
    useProfilerStore.setState({
      ...currentState,
      ...initialData,
      expandedNodes: new Set<string>(),
    });
  });

  describe('recording state', () => {
    it('should start recording', () => {
      const store = useProfilerStore.getState();
      
      store.startRecording();
      
      const newState = useProfilerStore.getState();
      expect(newState.isRecording).toBe(true);
      expect(newState.recordingStartTime).toBeGreaterThan(0);
      expect(newState.commits).toEqual([]);
    });

    it('should stop recording', () => {
      const store = useProfilerStore.getState();
      
      store.startRecording();
      // Wait a bit
      const startTime = Date.now();
      useProfilerStore.setState({ recordingStartTime: startTime - 100 });
      
      store.stopRecording();
      
      const newState = useProfilerStore.getState();
      expect(newState.isRecording).toBe(false);
      expect(newState.recordingDuration).toBeGreaterThanOrEqual(100);
    });

    it('should clear data when starting new recording', () => {
      const store = useProfilerStore.getState();
      
      // Add some data first
      useProfilerStore.setState({
        commits: [{ id: 'test' } as CommitData],
        wastedRenderReports: [{ componentName: 'Test' } as any],
      });
      
      store.startRecording();
      
      const newState = useProfilerStore.getState();
      expect(newState.commits).toEqual([]);
      expect(newState.wastedRenderReports).toEqual([]);
    });
  });

  describe('commit management', () => {
    it('should add a single commit', () => {
      const store = useProfilerStore.getState();
      const commit: CommitData = {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 10,
        rootFiber: {} as any,
        nodes: [],
        priorityLevel: 3,
        interactions: new Set(),
      };
      
      store.addCommit(commit);
      
      const newState = useProfilerStore.getState();
      expect(newState.commits).toHaveLength(1);
      expect(newState.commits[0].id).toBe('commit-1');
    });

    it('should add multiple commits', () => {
      const store = useProfilerStore.getState();
      const commits: CommitData[] = [
        { id: 'commit-1', timestamp: Date.now(), duration: 10, rootFiber: {} as any, nodes: [], priorityLevel: 3, interactions: new Set() },
        { id: 'commit-2', timestamp: Date.now(), duration: 15, rootFiber: {} as any, nodes: [], priorityLevel: 3, interactions: new Set() },
      ];
      
      store.addCommits(commits);
      
      const newState = useProfilerStore.getState();
      expect(newState.commits).toHaveLength(2);
    });

    it('should limit commits to 500', () => {
      const store = useProfilerStore.getState();
      const manyCommits = Array.from({ length: 550 }, (_, i) => ({
        id: `commit-${i}`,
        timestamp: Date.now(),
        duration: 10,
        rootFiber: {} as any,
        nodes: [],
        priorityLevel: 3,
        interactions: new Set(),
      }));
      
      store.addCommits(manyCommits);
      
      const newState = useProfilerStore.getState();
      expect(newState.commits).toHaveLength(500);
      // Should keep the most recent commits
      expect(newState.commits[newState.commits.length - 1].id).toBe('commit-549');
    });

    it('should clear all data', () => {
      const store = useProfilerStore.getState();
      
      useProfilerStore.setState({
        commits: [{ id: 'test' } as CommitData],
        selectedCommitId: 'test',
        wastedRenderReports: [{ componentName: 'Test' } as any],
        recordingDuration: 1000,
      });
      
      store.clearData();
      
      const newState = useProfilerStore.getState();
      expect(newState.commits).toEqual([]);
      expect(newState.selectedCommitId).toBeNull();
      expect(newState.wastedRenderReports).toEqual([]);
      expect(newState.recordingDuration).toBe(0);
    });
  });

  describe('selection', () => {
    it('should select a commit', () => {
      const store = useProfilerStore.getState();
      
      store.selectCommit('commit-1');
      
      const newState = useProfilerStore.getState();
      expect(newState.selectedCommitId).toBe('commit-1');
    });

    it('should deselect commit when null passed', () => {
      const store = useProfilerStore.getState();
      
      store.selectCommit('commit-1');
      store.selectCommit(null);
      
      const newState = useProfilerStore.getState();
      expect(newState.selectedCommitId).toBeNull();
    });

    it('should select a component and open detail panel', () => {
      const store = useProfilerStore.getState();
      
      store.selectComponent('MyComponent');
      
      const newState = useProfilerStore.getState();
      expect(newState.selectedComponent).toBe('MyComponent');
      expect(newState.isDetailPanelOpen).toBe(true);
    });

    it('should close detail panel when deselecting component', () => {
      const store = useProfilerStore.getState();
      
      store.selectComponent('MyComponent');
      store.selectComponent(null);
      
      const newState = useProfilerStore.getState();
      expect(newState.selectedComponent).toBeNull();
      expect(newState.isDetailPanelOpen).toBe(false);
    });
  });

  describe('filters', () => {
    it('should set filter text', () => {
      const store = useProfilerStore.getState();
      
      store.setFilterText('search term');
      
      const newState = useProfilerStore.getState();
      expect(newState.filterText).toBe('search term');
    });

    it('should set severity filter', () => {
      const store = useProfilerStore.getState();
      
      store.setSeverityFilter(['critical', 'warning']);
      
      const newState = useProfilerStore.getState();
      expect(newState.severityFilter).toEqual(['critical', 'warning']);
    });

    it('should set component type filter', () => {
      const store = useProfilerStore.getState();
      
      store.setComponentTypeFilter('memoized');
      
      const newState = useProfilerStore.getState();
      expect(newState.componentTypeFilter).toBe('memoized');
    });
  });

  describe('view mode', () => {
    it('should set view mode', () => {
      const store = useProfilerStore.getState();
      
      store.setViewMode('flamegraph');
      
      const newState = useProfilerStore.getState();
      expect(newState.viewMode).toBe('flamegraph');
    });

    it('should toggle detail panel', () => {
      const store = useProfilerStore.getState();
      
      expect(store.isDetailPanelOpen).toBe(true);
      
      store.toggleDetailPanel();
      
      let newState = useProfilerStore.getState();
      expect(newState.isDetailPanelOpen).toBe(false);
      
      store.toggleDetailPanel();
      
      newState = useProfilerStore.getState();
      expect(newState.isDetailPanelOpen).toBe(true);
    });

    it('should set sidebar width with constraints', () => {
      const store = useProfilerStore.getState();
      
      store.setSidebarWidth(100);
      expect(useProfilerStore.getState().sidebarWidth).toBe(180); // Min
      
      store.setSidebarWidth(700);
      expect(useProfilerStore.getState().sidebarWidth).toBe(600); // Max
      
      store.setSidebarWidth(300);
      expect(useProfilerStore.getState().sidebarWidth).toBe(300); // Normal
    });
  });

  describe('node expansion', () => {
    it('should toggle node expansion', () => {
      const store = useProfilerStore.getState();
      
      store.toggleNodeExpanded('node-1');
      
      let newState = useProfilerStore.getState();
      expect(newState.expandedNodes.has('node-1')).toBe(true);
      
      store.toggleNodeExpanded('node-1');
      
      newState = useProfilerStore.getState();
      expect(newState.expandedNodes.has('node-1')).toBe(false);
    });

    it('should expand all nodes', () => {
      const store = useProfilerStore.getState();
      
      useProfilerStore.setState({
        commits: [{
          id: 'commit-1',
          nodes: [
            { id: 'node-1', displayName: 'Component1' },
            { id: 'node-2', displayName: 'Component2' },
          ],
        } as CommitData],
      });
      
      store.expandAllNodes();
      
      const newState = useProfilerStore.getState();
      // Composite key format: ${commit.id}-${node.id}
      expect(newState.expandedNodes.has('commit-1-node-1')).toBe(true);
      expect(newState.expandedNodes.has('commit-1-node-2')).toBe(true);
    });

    it('should collapse all nodes', () => {
      const store = useProfilerStore.getState();
      
      useProfilerStore.setState({
        expandedNodes: new Set(['node-1', 'node-2', 'node-3']),
      });
      
      store.collapseAllNodes();
      
      const newState = useProfilerStore.getState();
      expect(newState.expandedNodes.size).toBe(0);
    });
  });

  describe('data export/import', () => {
    it('should export data as JSON in v1.0 format', () => {
      const store = useProfilerStore.getState();
      const commit: CommitData = {
        id: 'commit-1',
        timestamp: 1000,
        duration: 10,
        rootFiber: {} as any,
        nodes: [],
        priorityLevel: 3,
        interactions: new Set(),
      };
      
      useProfilerStore.setState({
        commits: [commit],
        recordingDuration: 5000,
      });
      
      const exported = store.exportData();
      const parsed = JSON.parse(exported);
      
      // Check new v1.0 format
      expect(parsed.version).toBe('1.0');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.profilerVersion).toBe('1.0.0');
      expect(parsed.metadata.exportedAt).toBeDefined();
      expect(parsed.metadata.format).toBe('react-perf-profiler-v1');
      expect(parsed.data).toBeDefined();
      expect(parsed.data.commits).toHaveLength(1);
      expect(parsed.recordingDuration).toBe(5000);
    });

    it('should import data from v1.0 format', () => {
      const store = useProfilerStore.getState();
      const data = {
        version: '1.0',
        metadata: {
          profilerVersion: '1.0.0',
          reactVersion: '18.2.0',
          exportedAt: new Date().toISOString(),
          format: 'react-perf-profiler-v1',
        },
        data: {
          commits: [{
            id: 'imported-commit',
            timestamp: Date.now(),
            duration: 20,
            nodes: [],
          }],
        },
        recordingDuration: 10000,
      };
      
      store.importData(JSON.stringify(data));
      
      const newState = useProfilerStore.getState();
      expect(newState.commits).toHaveLength(1);
      expect(newState.commits[0].id).toBe('imported-commit');
      expect(newState.recordingDuration).toBe(10000);
    });

    it('should import and migrate legacy format', () => {
      const store = useProfilerStore.getState();
      // Legacy format (version as number)
      const legacyData = {
        version: 1,
        commits: [{
          id: 'legacy-commit',
          timestamp: Date.now(),
          duration: 15,
          nodes: [],
        }],
        recordingDuration: 5000,
      };
      
      store.importData(JSON.stringify(legacyData));
      
      const newState = useProfilerStore.getState();
      expect(newState.commits).toHaveLength(1);
      expect(newState.commits[0].id).toBe('legacy-commit');
      expect(newState.recordingDuration).toBe(5000);
    });

    it('should validate import data before importing', () => {
      const store = useProfilerStore.getState();
      
      const validation = store.validateImportData('{"version": "1.0", "data": {"commits": []}, "metadata": {"profilerVersion": "1.0.0", "exportedAt": "2024-01-01", "format": "react-perf-profiler-v1"}, "recordingDuration": 0}');
      
      expect(validation.isValid).toBe(true);
      expect(validation.version).toBe('1.0');
    });

    it('should return validation error for invalid JSON', () => {
      const store = useProfilerStore.getState();
      
      const validation = store.validateImportData('invalid json');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Invalid JSON file');
    });

    it('should handle import with migration', () => {
      const store = useProfilerStore.getState();
      const legacyData = {
        version: 1,
        commits: [{
          id: 'migrated-commit',
          timestamp: Date.now(),
          duration: 20,
          nodes: [],
        }],
        recordingDuration: 8000,
      };
      
      const result = store.importDataWithMigration(JSON.stringify(legacyData));
      
      expect(result.success).toBe(true);
      expect(result.migrated).toBe(true);
      
      const newState = useProfilerStore.getState();
      expect(newState.commits).toHaveLength(1);
      expect(newState.commits[0].id).toBe('migrated-commit');
    });

    it('should handle invalid import data', () => {
      const store = useProfilerStore.getState();
      
      store.importData('invalid json');
      
      const newState = useProfilerStore.getState();
      expect(newState.analysisError).toBeTruthy();
    });

    it('should include analysis results in export when available', () => {
      const store = useProfilerStore.getState();
      const analysisResults: AnalysisResult = {
        timestamp: Date.now(),
        totalCommits: 1,
        wastedRenderReports: [],
        memoReports: [],
        performanceScore: 85,
        topOpportunities: [],
      };
      
      useProfilerStore.setState({
        commits: [{
          id: 'commit-1',
          timestamp: Date.now(),
          duration: 10,
          nodes: [],
          priorityLevel: 3,
        } as CommitData],
        analysisResults,
        recordingDuration: 5000,
      });
      
      const exported = store.exportData();
      const parsed = JSON.parse(exported);
      
      expect(parsed.data.analysisResults).toBeDefined();
      expect(parsed.data.analysisResults.performanceScore).toBe(85);
    });
  });

  describe('analysis', () => {
    it('should set error when no commits to analyze', async () => {
      const store = useProfilerStore.getState();
      
      await store.runAnalysis();
      
      const newState = useProfilerStore.getState();
      expect(newState.analysisError).toBe('No commits to analyze');
    });

    it('should set isAnalyzing during analysis', async () => {
      const store = useProfilerStore.getState();
      
      useProfilerStore.setState({
        commits: [{
          id: 'commit-1',
          timestamp: Date.now(),
          duration: 10,
          nodes: [{
            id: 'node-1',
            displayName: 'TestComponent',
            actualDuration: 1,
            tag: 0,
          }],
        } as CommitData],
      });
      
      // Start analysis
      const promise = store.runAnalysis();
      
      // Check isAnalyzing is set immediately
      expect(useProfilerStore.getState().isAnalyzing).toBe(true);
      
      await promise;
      
      expect(useProfilerStore.getState().isAnalyzing).toBe(false);
    });
  });
});
