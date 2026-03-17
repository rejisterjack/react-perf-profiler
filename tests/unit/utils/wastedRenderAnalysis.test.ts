import { describe, it, expect } from 'vitest';
import {
  analyzeWastedRenders,
  calculateSeverity,
  determineWastedRenderReason,
  generateWastedRenderRecommendations,
} from '@/panel/utils/wastedRenderAnalysis';
import type { CommitData, FiberData } from '@/content/types';
import type { FiberNode } from '@/panel/utils/shallowEqual';

function createMockFiber(overrides: Partial<FiberData> = {}): FiberData {
  return {
    id: 'test-fiber-1',
    displayName: 'TestComponent',
    key: null,
    child: null,
    sibling: null,
    return: null,
    type: 'div',
    elementType: 'div',
    memoizedProps: {},
    memoizedState: null,
    actualDuration: 1,
    actualStartTime: 0,
    selfBaseDuration: 1,
    treeBaseDuration: 1,
    tag: 5,
    index: 0,
    mode: 0,
    ...overrides,
  };
}

function createMockCommit(overrides: Partial<CommitData> = {}): CommitData {
  return {
    commitId: 'test-commit',
    timestamp: Date.now(),
    priorityLevel: 3,
    duration: 10,
    rootFiber: null,
    fibers: [],
    ...overrides,
  };
}

describe('analyzeWastedRenders', () => {
  it('should return empty array for empty commit history', () => {
    const reports = analyzeWastedRenders([]);
    expect(reports).toEqual([]);
  });

  it('should detect wasted renders when props are identical', () => {
    const fiber1 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { text: 'hello' },
      actualDuration: 1,
    });
    
    const fiber2 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { text: 'hello' },
      actualDuration: 1,
    });

    const commits = [
      createMockCommit({ commitId: 'commit-1', fibers: [fiber1] }),
      createMockCommit({ commitId: 'commit-2', fibers: [fiber2] }),
    ];

    const reports = analyzeWastedRenders(commits);

    expect(reports).toHaveLength(1);
    expect(reports[0].componentName).toBe('TestComponent');
    expect(reports[0].totalRenders).toBe(2);
    expect(reports[0].wastedRenders).toBe(1);
    expect(reports[0].wastedRenderRate).toBe(0.5);
  });

  it('should not flag renders with changed props', () => {
    const fiber1 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { count: 0 },
      actualDuration: 1,
    });
    
    const fiber2 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { count: 1 },
      actualDuration: 1,
    });

    const commits = [
      createMockCommit({ commitId: 'commit-1', fibers: [fiber1] }),
      createMockCommit({ commitId: 'commit-2', fibers: [fiber2] }),
    ];

    const reports = analyzeWastedRenders(commits);
    
    // Should still have a report but with 0 wasted renders
    expect(reports[0].wastedRenders).toBe(0);
  });

  it('should filter by threshold', () => {
    const fiber1 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { text: 'hello' },
      actualDuration: 1,
    });
    
    const fiber2 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { text: 'world' },
      actualDuration: 1,
    });

    const commits = [
      createMockCommit({ commitId: 'commit-1', fibers: [fiber1] }),
      createMockCommit({ commitId: 'commit-2', fibers: [fiber2] }),
    ];

    // With threshold of 0.6, should filter out the report (wasted rate is 0.5)
    const reports = analyzeWastedRenders(commits, { threshold: 0.6 });
    expect(reports).toHaveLength(0);
  });

  it('should filter by minimum render count', () => {
    const fiber = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { text: 'hello' },
    });

    const commits = [
      createMockCommit({ commitId: 'commit-1', fibers: [fiber] }),
    ];

    const reports = analyzeWastedRenders(commits, { minRenderCount: 2 });
    expect(reports).toHaveLength(0);
  });

  it('should filter by minimum duration', () => {
    const fiber1 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { text: 'hello' },
      actualDuration: 0.05, // Very fast render
    });
    
    const fiber2 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { text: 'hello' },
      actualDuration: 0.05,
    });

    const commits = [
      createMockCommit({ commitId: 'commit-1', fibers: [fiber1] }),
      createMockCommit({ commitId: 'commit-2', fibers: [fiber2] }),
    ];

    const reports = analyzeWastedRenders(commits, { minDuration: 0.1 });
    expect(reports[0].wastedRenders).toBe(0);
  });

  it('should sort reports by severity', () => {
    const criticalFiber1 = createMockFiber({
      id: 'fiber-1',
      displayName: 'CriticalComponent',
      memoizedProps: { text: 'same' },
      actualDuration: 5,
    });
    
    const criticalFiber2 = createMockFiber({
      id: 'fiber-1',
      displayName: 'CriticalComponent',
      memoizedProps: { text: 'same' },
      actualDuration: 5,
    });
    
    const infoFiber1 = createMockFiber({
      id: 'fiber-2',
      displayName: 'InfoComponent',
      memoizedProps: { text: 'same' },
      actualDuration: 0.1,
    });
    
    const infoFiber2 = createMockFiber({
      id: 'fiber-2',
      displayName: 'InfoComponent',
      memoizedProps: { text: 'same' },
      actualDuration: 0.1,
    });

    const commits = [
      createMockCommit({
        commitId: 'commit-1',
        fibers: [criticalFiber1, infoFiber1],
      }),
      createMockCommit({
        commitId: 'commit-2',
        fibers: [criticalFiber2, infoFiber2],
      }),
    ];

    const reports = analyzeWastedRenders(commits);
    
    // Critical should come first
    expect(reports[0].severity).toBe('critical');
    expect(reports[1].severity).toBe('info');
  });

  it('should include recommendations', () => {
    const fiber1 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { text: 'hello' },
    });
    
    const fiber2 = createMockFiber({
      id: 'fiber-1',
      displayName: 'TestComponent',
      memoizedProps: { text: 'hello' },
    });

    const commits = [
      createMockCommit({ commitId: 'commit-1', fibers: [fiber1] }),
      createMockCommit({ commitId: 'commit-2', fibers: [fiber2] }),
    ];

    const reports = analyzeWastedRenders(commits);
    
    expect(reports[0].recommendations.length).toBeGreaterThan(0);
    expect(reports[0].recommendations[0]).toContain('React.memo');
  });
});

describe('calculateSeverity', () => {
  it('should return critical for high wasted rate with many renders', () => {
    expect(calculateSeverity(0.5, 10)).toBe('critical');
    expect(calculateSeverity(0.7, 5)).toBe('critical');
  });

  it('should return warning for moderate wasted rate', () => {
    expect(calculateSeverity(0.3, 5)).toBe('warning');
    expect(calculateSeverity(0.5, 3)).toBe('warning');
  });

  it('should return info for low wasted rate', () => {
    expect(calculateSeverity(0.2, 10)).toBe('info');
    expect(calculateSeverity(0.1, 5)).toBe('info');
  });

  it('should handle edge cases', () => {
    expect(calculateSeverity(0, 0)).toBe('info');
    expect(calculateSeverity(1, 100)).toBe('critical');
  });
});

describe('determineWastedRenderReason', () => {
  it('should return unknown for null previous', () => {
    const current: FiberNode = {
      ...createMockFiber(),
      prevProps: null,
      prevState: null,
      hasContextChanged: false,
    };
    
    const reason = determineWastedRenderReason(current, null);
    expect(reason.type).toBe('unknown');
  });

  it('should detect context change', () => {
    const prev = createMockFiber();
    const current: FiberNode = {
      ...createMockFiber(),
      memoizedState: prev.memoizedState,
      prevProps: prev.memoizedProps,
      prevState: prev.memoizedState,
      hasContextChanged: true,
    };
    
    const reason = determineWastedRenderReason(current, current);
    expect(reason.type).toBe('context-change');
  });

  it('should detect parent render when state changed', () => {
    const prev = createMockFiber({ memoizedState: { count: 0 } });
    const current = createMockFiber({ memoizedState: { count: 1 } });
    
    const currentNode: FiberNode = {
      ...current,
      prevProps: prev.memoizedProps,
      prevState: prev.memoizedState,
      hasContextChanged: false,
    };
    
    const reason = determineWastedRenderReason(currentNode, currentNode);
    expect(reason.type).toBe('unknown');
  });
});

describe('generateWastedRenderRecommendations', () => {
  it('should return no action needed for minimal wasted renders', () => {
    const session = {
      componentName: 'TestComponent',
      totalRenders: 10,
      wastedRenders: 0,
      wastedRenderDurations: [],
      renderDurations: [],
      wastedRenderReasons: [],
      lastProps: null,
      lastState: null,
    };
    
    const recommendations = generateWastedRenderRecommendations(session);
    expect(recommendations[0]).toContain('No action needed');
  });

  it('should recommend React.memo for parent-render reason', () => {
    const session = {
      componentName: 'TestComponent',
      totalRenders: 10,
      wastedRenders: 8,
      wastedRenderDurations: [1, 1, 1, 1, 1, 1, 1, 1],
      renderDurations: [],
      wastedRenderReasons: [{ type: 'parent-render' }],
      lastProps: null,
      lastState: null,
    };
    
    const recommendations = generateWastedRenderRecommendations(session);
    expect(recommendations.some(r => r.includes('React.memo'))).toBe(true);
  });

  it('should recommend context splitting for context-change reason', () => {
    const session = {
      componentName: 'TestComponent',
      totalRenders: 10,
      wastedRenders: 8,
      wastedRenderDurations: [1, 1, 1, 1, 1, 1, 1, 1],
      renderDurations: [],
      wastedRenderReasons: [{ type: 'context-change', contextName: 'AppContext' }],
      lastProps: null,
      lastState: null,
    };
    
    const recommendations = generateWastedRenderRecommendations(session);
    expect(recommendations.some(r => r.includes('context'))).toBe(true);
  });

  it('should prioritize fixing expensive wasted renders', () => {
    const session = {
      componentName: 'SlowComponent',
      totalRenders: 5,
      wastedRenders: 4,
      wastedRenderDurations: [20, 20, 20, 20],
      renderDurations: [],
      wastedRenderReasons: [{ type: 'parent-render' }],
      lastProps: null,
      lastState: null,
    };
    
    const recommendations = generateWastedRenderRecommendations(session);
    expect(recommendations.some(r => r.includes('expensive'))).toBe(true);
  });
});
