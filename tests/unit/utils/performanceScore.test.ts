import { describe, it, expect } from 'vitest';
import {
  calculatePerformanceScore,
  scoreWastedRenders,
  scoreMemoization,
  scoreRenderTime,
  scoreComponentCount,
} from '@/panel/utils/performanceScore';
import type { CommitData, FiberData } from '@/content/types';
import type { WastedRenderReport } from '@/panel/utils/wastedRenderAnalysis';
import type { MemoEffectivenessReport } from '@/panel/utils/memoAnalysis';

function createMockCommit(fibers: FiberData[] = [], duration = 10): CommitData {
  return {
    commitId: 'test-commit',
    timestamp: Date.now(),
    priorityLevel: 3,
    duration,
    rootFiber: null,
    fibers,
  };
}

function createMockFiber(displayName: string, actualDuration = 1): FiberData {
  return {
    id: `fiber-${displayName}`,
    displayName,
    key: null,
    child: null,
    sibling: null,
    return: null,
    type: 'div',
    elementType: 'div',
    memoizedProps: {},
    memoizedState: null,
    actualDuration,
    actualStartTime: 0,
    selfBaseDuration: actualDuration,
    treeBaseDuration: actualDuration,
    tag: 5,
    index: 0,
    mode: 0,
  };
}

describe('calculatePerformanceScore', () => {
  it('should return perfect score for empty data', () => {
    const result = calculatePerformanceScore([], [], []);
    
    expect(result.overallScore).toBe(100);
    expect(result.categories.wastedRenders).toBe(100);
    expect(result.categories.memoization).toBe(100);
    expect(result.categories.renderTime).toBe(100);
    expect(result.categories.componentCount).toBe(100);
  });

  it('should calculate weighted overall score', () => {
    const commits = [createMockCommit([createMockFiber('Test', 5)])];
    
    const wastedReports: WastedRenderReport[] = [{
      componentName: 'Test',
      totalRenders: 10,
      wastedRenders: 5,
      wastedRenderRate: 0.5,
      severity: 'warning',
      recommendedAction: 'memo',
      issues: [],
      estimatedSavingsMs: 25,
      wastedRenderDurations: [5, 5, 5, 5, 5],
    }];
    
    const result = calculatePerformanceScore(commits, wastedReports, []);
    
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThan(100);
  });

  it('should normalize weights when they do not sum to 1', () => {
    const commits = [createMockCommit()];
    
    const result = calculatePerformanceScore(commits, [], [], {
      wastedRenderWeight: 1,
      memoizationWeight: 1,
      renderTimeWeight: 1,
      componentCountWeight: 1,
    });
    
    // Should still produce valid score with normalized weights
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('should include issues in result', () => {
    const commits = [createMockCommit([createMockFiber('Slow', 100)])];
    
    const result = calculatePerformanceScore(commits, [], []);
    
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('should sort issues by severity', () => {
    const commits = [
      createMockCommit([createMockFiber('Critical', 200)]),
      createMockCommit([createMockFiber('Warning', 50)]),
    ];
    
    const result = calculatePerformanceScore(commits, [], []);
    
    const severities = result.issues.map(i => i.severity);
    expect(severities.indexOf('critical')).toBeLessThan(severities.indexOf('warning'));
  });
});

describe('scoreWastedRenders', () => {
  it('should return 100 for no reports', () => {
    expect(scoreWastedRenders([])).toBe(100);
    expect(scoreWastedRenders(null as any)).toBe(100);
  });

  it('should deduct points for critical severity', () => {
    const reports: WastedRenderReport[] = [{
      componentName: 'Test',
      totalRenders: 10,
      wastedRenders: 7,
      wastedRenderRate: 0.7,
      severity: 'critical',
      recommendedAction: 'memo',
      issues: [],
      estimatedSavingsMs: 35,
      wastedRenderDurations: [],
    }];
    
    const score = scoreWastedRenders(reports);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('should deduct fewer points for warning severity', () => {
    const reports: WastedRenderReport[] = [{
      componentName: 'Test',
      totalRenders: 10,
      wastedRenders: 3,
      wastedRenderRate: 0.3,
      severity: 'warning',
      recommendedAction: 'memo',
      issues: [],
      estimatedSavingsMs: 15,
      wastedRenderDurations: [],
    }];
    
    const score = scoreWastedRenders(reports);
    expect(score).toBeLessThan(100);
  });

  it('should deduct minimal points for info severity', () => {
    const reports: WastedRenderReport[] = [{
      componentName: 'Test',
      totalRenders: 10,
      wastedRenders: 1,
      wastedRenderRate: 0.1,
      severity: 'info',
      recommendedAction: 'memo',
      issues: [],
      estimatedSavingsMs: 5,
      wastedRenderDurations: [],
    }];
    
    const score = scoreWastedRenders(reports);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(50);
  });

  it('should not return negative scores', () => {
    const reports: WastedRenderReport[] = Array.from({ length: 10 }, () => ({
      componentName: 'Test',
      totalRenders: 10,
      wastedRenders: 10,
      wastedRenderRate: 1,
      severity: 'critical',
      recommendedAction: 'memo',
      issues: [],
      estimatedSavingsMs: 50,
      wastedRenderDurations: [],
    }));
    
    const score = scoreWastedRenders(reports);
    expect(score).toBe(0);
  });
});

describe('scoreMemoization', () => {
  it('should return 100 for no reports', () => {
    expect(scoreMemoization([])).toBe(100);
    expect(scoreMemoization(null as any)).toBe(100);
  });

  it('should deduct points for missing memoization', () => {
    const reports: MemoEffectivenessReport[] = [{
      componentName: 'Test',
      hasMemo: false,
      currentHitRate: 0,
      optimalHitRate: 0.9,
      isEffective: false,
      issues: [{ type: 'missing-memo', propName: 'component', description: 'Missing memo', suggestion: 'Add memo', impact: 0.9 }],
      propStability: [],
      recommendations: [],
    }];
    
    const score = scoreMemoization(reports);
    expect(score).toBeLessThan(100);
  });

  it('should deduct more points for ineffective memoization', () => {
    const reports: MemoEffectivenessReport[] = [{
      componentName: 'Test',
      hasMemo: true,
      currentHitRate: 0.2,
      optimalHitRate: 0.9,
      isEffective: false,
      issues: [
        { type: 'unstable-callback', propName: 'onClick', description: 'Unstable', suggestion: 'Use useCallback', impact: 0.5 },
        { type: 'unstable-object', propName: 'style', description: 'Unstable', suggestion: 'Use useMemo', impact: 0.5 },
      ],
      propStability: [],
      recommendations: [],
    }];
    
    const score = scoreMemoization(reports);
    expect(score).toBeLessThan(100);
  });

  it('should deduct points for low hit rate', () => {
    const reports: MemoEffectivenessReport[] = [{
      componentName: 'Test',
      hasMemo: true,
      currentHitRate: 0.2,
      optimalHitRate: 0.9,
      isEffective: false,
      issues: [],
      propStability: [],
      recommendations: [],
    }];
    
    const score = scoreMemoization(reports);
    expect(score).toBeLessThan(100);
  });

  it('should normalize based on number of problematic components', () => {
    const reports: MemoEffectivenessReport[] = Array.from({ length: 10 }, () => ({
      componentName: 'Test',
      hasMemo: true,
      currentHitRate: 0.5,
      optimalHitRate: 0.9,
      isEffective: false,
      issues: [{ type: 'unstable-callback', propName: 'onClick', description: 'Unstable', suggestion: 'Fix', impact: 0.5 }],
      propStability: [],
      recommendations: [],
    }));
    
    const score = scoreMemoization(reports);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(100);
  });
});

describe('scoreRenderTime', () => {
  it('should return 100 for no commits', () => {
    expect(scoreRenderTime([])).toBe(100);
    expect(scoreRenderTime(null as any)).toBe(100);
  });

  it('should return 100 for fast renders', () => {
    const commits = [createMockCommit([
      createMockFiber('Fast', 1),
      createMockFiber('Fast2', 2),
    ])];
    
    const score = scoreRenderTime(commits);
    expect(score).toBeGreaterThan(90);
  });

  it('should reduce score for slow renders', () => {
    const commits = [createMockCommit([
      createMockFiber('Slow', 50),
    ])];
    
    const score = scoreRenderTime(commits, 16);
    expect(score).toBeLessThan(100);
  });

  it('should use custom threshold', () => {
    const commits = [createMockCommit([
      createMockFiber('Test', 20),
    ])];
    
    const scoreWithLowThreshold = scoreRenderTime(commits, 10);
    const scoreWithHighThreshold = scoreRenderTime(commits, 30);
    
    expect(scoreWithHighThreshold).toBeGreaterThan(scoreWithLowThreshold);
  });

  it('should score based on average duration', () => {
    const commits = [
      createMockCommit([createMockFiber('A', 5)]),
      createMockCommit([createMockFiber('B', 5)]),
      createMockCommit([createMockFiber('C', 100)]),
    ];
    
    const score = scoreRenderTime(commits);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('should handle empty fibers array', () => {
    const commits = [createMockCommit([])];
    
    const score = scoreRenderTime(commits);
    expect(score).toBe(100);
  });
});

describe('scoreComponentCount', () => {
  it('should return 100 for no commits', () => {
    expect(scoreComponentCount([])).toBe(100);
    expect(scoreComponentCount(null as any)).toBe(100);
  });

  it('should return 100 for component count below threshold', () => {
    const commits = [createMockCommit(Array.from({ length: 100 }, (_, i) => createMockFiber(`C${i}`)))];
    
    const score = scoreComponentCount(commits, 500);
    expect(score).toBe(100);
  });

  it('should reduce score for component count above threshold', () => {
    const commits = [createMockCommit(Array.from({ length: 1000 }, (_, i) => createMockFiber(`C${i}`)))];
    
    const score = scoreComponentCount(commits, 500);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(0);
  });

  it('should use custom threshold', () => {
    const commits = [createMockCommit(Array.from({ length: 200 }, (_, i) => createMockFiber(`C${i}`)))];
    
    const scoreWithLowThreshold = scoreComponentCount(commits, 100);
    const scoreWithHighThreshold = scoreComponentCount(commits, 500);
    
    expect(scoreWithHighThreshold).toBeGreaterThan(scoreWithLowThreshold);
  });

  it('should calculate average across commits', () => {
    const commits = [
      createMockCommit(Array.from({ length: 100 }, (_, i) => createMockFiber(`C${i}`))),
      createMockCommit(Array.from({ length: 300 }, (_, i) => createMockFiber(`C${i}`))),
    ];
    
    const score = scoreComponentCount(commits, 500);
    expect(score).toBe(100); // Average is 200, below threshold
  });

  it('should not return negative scores', () => {
    const commits = [createMockCommit(Array.from({ length: 10000 }, (_, i) => createMockFiber(`C${i}`)))];
    
    const score = scoreComponentCount(commits, 100);
    expect(score).toBe(0);
  });
});
