import { describe, it, expect } from 'vitest';
import { calculatePerformanceScore } from './performanceScore';
import type { CommitData, FiberData, WastedRenderReport, MemoReport } from './types';

function makeFiber(overrides: Partial<FiberData> = {}): FiberData {
  return {
    id: `fiber-${Math.random().toString(36).slice(2, 8)}`,
    displayName: 'TestComponent',
    key: null,
    child: null,
    sibling: null,
    return: null,
    type: null,
    elementType: null,
    memoizedProps: {},
    memoizedState: null,
    actualDuration: 5,
    actualStartTime: 0,
    selfBaseDuration: 5,
    treeBaseDuration: 5,
    tag: 0,
    index: 0,
    flags: 0,
    mode: 0,
    ...overrides,
  };
}

function makeCommit(fibers: FiberData[], overrides: Partial<CommitData> = {}): CommitData {
  return {
    id: `commit-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    priorityLevel: 'Normal',
    duration: fibers.reduce((s, f) => s + f.actualDuration, 0),
    fibers,
    ...overrides,
  };
}

describe('calculatePerformanceScore', () => {
  it('returns 100 for no data', () => {
    expect(calculatePerformanceScore([], [], [])).toBe(100);
  });

  it('penalizes wasted renders', () => {
    const goodScore = calculatePerformanceScore([], [], [
      makeCommit([makeFiber({ displayName: 'A' })]),
    ]);

    const wastedReport: WastedRenderReport = {
      componentName: 'A',
      renderCount: 10,
      totalRenders: 10,
      wastedRenders: 8,
      wastedRenderRate: 80,
      recommendedAction: 'memo',
      estimatedSavingsMs: 40,
      severity: 'critical',
      issues: [],
    };

    const badScore = calculatePerformanceScore([wastedReport], [], [
      makeCommit([makeFiber({ displayName: 'A' })]),
    ]);

    expect(goodScore).toBeGreaterThan(badScore);
  });

  it('penalizes slow render times', () => {
    const fastScore = calculatePerformanceScore([], [], [
      makeCommit([makeFiber({ actualDuration: 5 })]),
    ]);

    const slowScore = calculatePerformanceScore([], [], [
      makeCommit([makeFiber({ actualDuration: 50 })]),
    ]);

    expect(fastScore).toBeGreaterThanOrEqual(slowScore);
  });

  it('stays within 0-100 range', () => {
    const wastedReports: WastedRenderReport[] = Array.from({ length: 20 }, (_, i) => ({
      componentName: `Comp${i}`,
      renderCount: 100,
      totalRenders: 100,
      wastedRenders: 95,
      wastedRenderRate: 95,
      recommendedAction: 'memo' as const,
      estimatedSavingsMs: 500,
      severity: 'critical' as const,
      issues: [],
    }));

    const score = calculatePerformanceScore(wastedReports, [], [
      makeCommit([makeFiber({ actualDuration: 100 })]),
    ]);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('factors in memoization effectiveness', () => {
    const effectiveReport: MemoReport = {
      componentName: 'A',
      hasMemo: true,
      currentHitRate: 95,
      optimalHitRate: 100,
      isEffective: true,
      issues: [],
      recommendations: [],
    };

    const ineffectiveReport: MemoReport = {
      componentName: 'B',
      hasMemo: true,
      currentHitRate: 10,
      optimalHitRate: 100,
      isEffective: false,
      issues: [],
      recommendations: [],
    };

    const goodScore = calculatePerformanceScore([], [effectiveReport], []);
    const badScore = calculatePerformanceScore([], [ineffectiveReport], []);
    expect(goodScore).toBeGreaterThan(badScore);
  });
});
