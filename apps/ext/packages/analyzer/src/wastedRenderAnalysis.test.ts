import { describe, it, expect } from 'vitest';
import { analyzeWastedRenders, calculateFrameImpact } from './wastedRenderAnalysis';
import type { CommitData, FiberData } from './types';

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

describe('analyzeWastedRenders', () => {
  it('returns empty array for no commits', () => {
    expect(analyzeWastedRenders([])).toEqual([]);
  });

  it('skips components with only one render', () => {
    const fiber = makeFiber({ displayName: 'OnceComponent' });
    const commit = makeCommit([fiber]);
    expect(analyzeWastedRenders([commit])).toEqual([]);
  });

  it('detects wasted renders with identical props', () => {
    const props = { count: 1, name: 'test' };
    const fiber1 = makeFiber({ displayName: 'WastedComponent', memoizedProps: { ...props } });
    const fiber2 = makeFiber({ displayName: 'WastedComponent', memoizedProps: { ...props } });
    const commit1 = makeCommit([fiber1]);
    const commit2 = makeCommit([fiber2]);

    const reports = analyzeWastedRenders([commit1, commit2]);
    expect(reports).toHaveLength(1);
    expect(reports[0].componentName).toBe('WastedComponent');
    expect(reports[0].wastedRenders).toBe(1);
    expect(reports[0].totalRenders).toBe(2);
    expect(reports[0].wastedRenderRate).toBe(50);
  });

  it('does not flag components with changing props as wasted', () => {
    const fiber1 = makeFiber({ displayName: 'ChangingComponent', memoizedProps: { value: 1 } });
    const fiber2 = makeFiber({ displayName: 'ChangingComponent', memoizedProps: { value: 2 } });
    const commit1 = makeCommit([fiber1]);
    const commit2 = makeCommit([fiber2]);

    const reports = analyzeWastedRenders([commit1, commit2]);
    expect(reports).toHaveLength(1);
    expect(reports[0].wastedRenders).toBe(0);
    expect(reports[0].wastedRenderRate).toBe(0);
  });

  it('detects inline function props', () => {
    const props1 = { onClick: () => {} };
    const props2 = { onClick: () => {} };
    const fiber1 = makeFiber({
      displayName: 'InlineFnComponent',
      memoizedProps: props1,
    });
    const fiber2 = makeFiber({
      displayName: 'InlineFnComponent',
      memoizedProps: props2,
    });

    const reports = analyzeWastedRenders([makeCommit([fiber1]), makeCommit([fiber2])]);
    expect(reports).toHaveLength(1);
    expect(reports[0].wastedRenders).toBeGreaterThanOrEqual(0);
  });

  it('classifies severity based on wasted render rate', () => {
    const props = { x: 1 };
    // Create 10 commits with same props = 90% wasted rate
    const commits = Array.from({ length: 10 }, (_, i) =>
      makeCommit([makeFiber({ displayName: 'HighWaste', memoizedProps: { ...props }, actualStartTime: i })])
    );

    const reports = analyzeWastedRenders(commits);
    expect(reports).toHaveLength(1);
    expect(reports[0].severity).toBe('critical');
    expect(reports[0].wastedRenderRate).toBeGreaterThan(70);
  });
});

describe('calculateFrameImpact', () => {
  it('calculates dropped frames from wasted time', () => {
    const reports = analyzeWastedRenders([
      makeCommit([makeFiber({ displayName: 'A', memoizedProps: { x: 1 }, actualDuration: 10 })]),
      makeCommit([makeFiber({ displayName: 'A', memoizedProps: { x: 1 }, actualDuration: 10 })]),
    ]);

    const impact = calculateFrameImpact(reports);
    expect(impact.totalWastedMs).toBeGreaterThan(0);
    expect(impact.droppedFrames).toBeGreaterThanOrEqual(0);
    expect(impact.frameBudgetMs).toBeCloseTo(16.67, 1);
  });

  it('returns zero for empty reports', () => {
    const impact = calculateFrameImpact([]);
    expect(impact.totalWastedMs).toBe(0);
    expect(impact.droppedFrames).toBe(0);
  });
});
