import { describe, it, expect } from 'vitest';
import {
  analyzePropStability,
  detectMemoization,
  calculateOptimalHitRate,
  analyzeMemoEffectiveness,
  generateMemoRecommendations,
} from '@/panel/utils/memoAnalysis';
import type { CommitData, FiberData } from '@/content/types';
import type { ComponentMetrics, PropStability } from '@/panel/utils/memoAnalysis';

function createMockFiber(overrides: Partial<FiberData> = {}): FiberData {
  return {
    id: 'test-fiber',
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

function createMockCommit(fibers: FiberData[], timestamp = Date.now()): CommitData {
  return {
    commitId: `commit-${timestamp}`,
    timestamp,
    priorityLevel: 3,
    duration: 10,
    rootFiber: null,
    fibers,
  };
}

describe('analyzePropStability', () => {
  it('should return empty array for insufficient commits', () => {
    const result = analyzePropStability('TestComponent', []);
    expect(result).toEqual([]);

    const result2 = analyzePropStability('TestComponent', [createMockCommit([])]);
    expect(result2).toEqual([]);
  });

  it('should analyze prop stability across commits', () => {
    const stableFn = () => {};
    
    const fibers = [
      createMockFiber({ memoizedProps: { onClick: stableFn, text: 'hello' } }),
      createMockFiber({ memoizedProps: { onClick: stableFn, text: 'world' } }),
    ];

    const commits = [
      createMockCommit([fibers[0]], 1000),
      createMockCommit([fibers[1]], 2000),
    ];

    const result = analyzePropStability('TestComponent', commits);

    expect(result.length).toBe(2);
    
    const onClickProp = result.find(p => p.name === 'onClick');
    const textProp = result.find(p => p.name === 'text');

    expect(onClickProp?.isStable).toBe(true);
    expect(onClickProp?.changeFrequency).toBe(0);
    expect(textProp?.isStable).toBe(false);
    expect(textProp?.changeFrequency).toBe(1);
  });

  it('should detect function prop type', () => {
    const fibers = [
      createMockFiber({ memoizedProps: { onClick: () => {} } }),
      createMockFiber({ memoizedProps: { onClick: () => {} } }),
    ];

    const commits = [
      createMockCommit([fibers[0]], 1000),
      createMockCommit([fibers[1]], 2000),
    ];

    const result = analyzePropStability('TestComponent', commits);
    const onClickProp = result.find(p => p.name === 'onClick');

    expect(onClickProp?.type).toBe('function');
  });

  it('should detect array prop type', () => {
    const fibers = [
      createMockFiber({ memoizedProps: { items: [1, 2, 3] } }),
      createMockFiber({ memoizedProps: { items: [1, 2, 3] } }),
    ];

    const commits = [
      createMockCommit([fibers[0]], 1000),
      createMockCommit([fibers[1]], 2000),
    ];

    const result = analyzePropStability('TestComponent', commits);
    const itemsProp = result.find(p => p.name === 'items');

    expect(itemsProp?.type).toBe('array');
  });

  it('should detect object prop type', () => {
    const fibers = [
      createMockFiber({ memoizedProps: { config: { a: 1 } } }),
      createMockFiber({ memoizedProps: { config: { a: 1 } } }),
    ];

    const commits = [
      createMockCommit([fibers[0]], 1000),
      createMockCommit([fibers[1]], 2000),
    ];

    const result = analyzePropStability('TestComponent', commits);
    const configProp = result.find(p => p.name === 'config');

    expect(configProp?.type).toBe('object');
  });

  it('should detect primitive prop type', () => {
    const fibers = [
      createMockFiber({ memoizedProps: { count: 42, name: 'test', active: true } }),
      createMockFiber({ memoizedProps: { count: 42, name: 'test', active: true } }),
    ];

    const commits = [
      createMockCommit([fibers[0]], 1000),
      createMockCommit([fibers[1]], 2000),
    ];

    const result = analyzePropStability('TestComponent', commits);

    expect(result.every(p => p.type === 'primitive')).toBe(true);
  });

  it('should limit history to 100 entries', () => {
    const fibers = Array.from({ length: 150 }, (_, i) =>
      createMockFiber({ memoizedProps: { value: i } })
    );

    const commits = fibers.map((f, i) => createMockCommit([f], i * 1000));

    const result = analyzePropStability('TestComponent', commits);
    const valueProp = result.find(p => p.name === 'value');

    expect(valueProp?.history.length).toBe(100);
  });
});

describe('detectMemoization', () => {
  it('should return false for insufficient history', () => {
    const history = [{ value: 'a', reference: {}, timestamp: 1 }];
    expect(detectMemoization(history)).toBe(false);
  });

  it('should detect memoization from stable references', () => {
    const obj = {};
    const history = [
      { value: 'obj:a', reference: obj, timestamp: 1 },
      { value: 'obj:a', reference: obj, timestamp: 2 },
      { value: 'obj:a', reference: obj, timestamp: 3 },
    ];
    expect(detectMemoization(history)).toBe(true);
  });

  it('should not detect memoization from unstable references', () => {
    const history = [
      { value: 'obj:a', reference: {}, timestamp: 1 },
      { value: 'obj:a', reference: {}, timestamp: 2 },
      { value: 'obj:a', reference: {}, timestamp: 3 },
    ];
    expect(detectMemoization(history)).toBe(false);
  });

  it('should handle mixed stable and unstable references', () => {
    const obj = {};
    const obj2 = {};
    const history = [
      { value: 'obj:a', reference: obj, timestamp: 1 },
      { value: 'obj:a', reference: obj, timestamp: 2 },
      { value: 'obj:b', reference: obj2, timestamp: 3 }, // Value changed, skip
      { value: 'obj:b', reference: obj2, timestamp: 4 },
    ];
    // 2 stable comparisons out of 2 total = 100% memoized
    expect(detectMemoization(history)).toBe(true);
  });

  it('should require at least 80% stable comparisons', () => {
    const obj = {};
    const history = [
      { value: 'obj:a', reference: obj, timestamp: 1 },
      { value: 'obj:a', reference: obj, timestamp: 2 },
      { value: 'obj:a', reference: obj, timestamp: 3 },
      { value: 'obj:a', reference: {}, timestamp: 4 },
      { value: 'obj:a', reference: {}, timestamp: 5 },
    ];
    // 2 stable out of 4 = 50%, not memoized
    expect(detectMemoization(history)).toBe(false);
  });
});

describe('calculateOptimalHitRate', () => {
  it('should return high optimal rate for unmemoized component with issues', () => {
    const metrics: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: false,
      memoHitRate: 0,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [{ type: 'missing-memo', propName: 'component', description: '', suggestion: '', impact: 0.9 }];

    const optimal = calculateOptimalHitRate(metrics, issues);
    expect(optimal).toBeGreaterThan(0);
    expect(optimal).toBeLessThanOrEqual(0.9);
  });

  it('should calculate improvement for memoized component with issues', () => {
    const metrics: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: true,
      memoHitRate: 0.3,
      renderCount: 20,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [
      { type: 'unstable-callback', propName: 'onClick', description: '', suggestion: '', impact: 0.5 },
      { type: 'unstable-object', propName: 'style', description: '', suggestion: '', impact: 0.5 },
    ];

    const optimal = calculateOptimalHitRate(metrics, issues);
    expect(optimal).toBeGreaterThan(metrics.memoHitRate);
    expect(optimal).toBeLessThanOrEqual(0.95);
  });

  it('should cap optimal rate at 0.95', () => {
    const metrics: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: true,
      memoHitRate: 0.9,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [{ type: 'unstable-callback', propName: 'onClick', description: '', suggestion: '', impact: 0.9 }];

    const optimal = calculateOptimalHitRate(metrics, issues);
    expect(optimal).toBeLessThanOrEqual(0.95);
  });

  it('should only count fixable issues', () => {
    const metrics: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: true,
      memoHitRate: 0.5,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [
      { type: 'unstable-callback', propName: 'onClick', description: '', suggestion: '', impact: 0.2 }, // Low impact, not fixable
      { type: 'unstable-callback', propName: 'onSubmit', description: '', suggestion: '', impact: 0.6 }, // High impact, fixable
    ];

    const optimal = calculateOptimalHitRate(metrics, issues);
    expect(optimal).toBeGreaterThan(metrics.memoHitRate);
  });
});

describe('analyzeMemoEffectiveness', () => {
  it('should return empty array for no data', () => {
    expect(analyzeMemoEffectiveness([], [])).toEqual([]);
    expect(analyzeMemoEffectiveness([createMockCommit([])], [])).toEqual([]);
  });

  it('should skip components with too few renders', () => {
    const commits = [
      createMockCommit([createMockFiber()]),
      createMockCommit([createMockFiber()]),
    ];

    const metrics: ComponentMetrics[] = [{
      componentName: 'TestComponent',
      isMemoized: false,
      memoHitRate: 0,
      renderCount: 2,
      propChanges: new Map(),
      averageRenderDuration: 1,
    }];

    const reports = analyzeMemoEffectiveness(commits, metrics, { minRenders: 3 });
    expect(reports).toHaveLength(0);
  });

  it('should generate report for component with issues', () => {
    const stableFn = () => {};
    
    const fibers = [
      createMockFiber({ memoizedProps: { onClick: stableFn, text: 'a' } }),
      createMockFiber({ memoizedProps: { onClick: () => {}, text: 'b' } }),
      createMockFiber({ memoizedProps: { onClick: () => {}, text: 'c' } }),
    ];

    const commits = [
      createMockCommit([fibers[0]], 1000),
      createMockCommit([fibers[1]], 2000),
      createMockCommit([fibers[2]], 3000),
    ];

    const metrics: ComponentMetrics[] = [{
      componentName: 'TestComponent',
      isMemoized: true,
      memoHitRate: 0.3,
      renderCount: 3,
      propChanges: new Map([['onClick', 2]]),
      averageRenderDuration: 1,
    }];

    const reports = analyzeMemoEffectiveness(commits, metrics);

    expect(reports).toHaveLength(1);
    expect(reports[0].componentName).toBe('TestComponent');
    expect(reports[0].hasMemo).toBe(true);
    expect(reports[0].isEffective).toBe(false);
    expect(reports[0].issues.length).toBeGreaterThan(0);
    expect(reports[0].propStability.length).toBeGreaterThan(0);
    expect(reports[0].recommendations.length).toBeGreaterThan(0);
  });

  it('should mark effective memoization as effective', () => {
    const stableFn = () => {};
    
    const fibers = [
      createMockFiber({ memoizedProps: { onClick: stableFn, text: 'a' } }),
      createMockFiber({ memoizedProps: { onClick: stableFn, text: 'b' } }),
      createMockFiber({ memoizedProps: { onClick: stableFn, text: 'c' } }),
    ];

    const commits = [
      createMockCommit([fibers[0]], 1000),
      createMockCommit([fibers[1]], 2000),
      createMockCommit([fibers[2]], 3000),
    ];

    const metrics: ComponentMetrics[] = [{
      componentName: 'TestComponent',
      isMemoized: true,
      memoHitRate: 0.9,
      renderCount: 3,
      propChanges: new Map(),
      averageRenderDuration: 1,
    }];

    const reports = analyzeMemoEffectiveness(commits, metrics);

    expect(reports[0].isEffective).toBe(true);
    expect(reports[0].issues).toHaveLength(0);
  });

  it('should sort by effectiveness gap', () => {
    const commits = [
      createMockCommit([createMockFiber({ displayName: 'CompA' })]),
      createMockCommit([createMockFiber({ displayName: 'CompB' })]),
    ];

    const metrics: ComponentMetrics[] = [
      {
        componentName: 'CompA',
        isMemoized: true,
        memoHitRate: 0.2, // Big gap
        renderCount: 5,
        propChanges: new Map([['p', 4]]),
        averageRenderDuration: 1,
      },
      {
        componentName: 'CompB',
        isMemoized: true,
        memoHitRate: 0.8, // Small gap
        renderCount: 5,
        propChanges: new Map([['p', 1]]),
        averageRenderDuration: 1,
      },
    ];

    const reports = analyzeMemoEffectiveness(commits, metrics);

    expect(reports[0].componentName).toBe('CompA'); // Larger gap first
  });
});

describe('generateMemoRecommendations', () => {
  it('should return no changes needed for no issues', () => {
    const component: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: true,
      memoHitRate: 0.9,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const recommendations = generateMemoRecommendations([], component);
    expect(recommendations[0]).toContain('No changes needed');
  });

  it('should recommend useCallback for unstable callbacks', () => {
    const component: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: true,
      memoHitRate: 0.3,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [
      { type: 'unstable-callback', propName: 'onClick', description: '', suggestion: '', impact: 0.5 },
      { type: 'unstable-callback', propName: 'onSubmit', description: '', suggestion: '', impact: 0.5 },
    ];

    const recommendations = generateMemoRecommendations(issues, component);
    expect(recommendations.some(r => r.includes('useCallback'))).toBe(true);
  });

  it('should recommend useMemo for unstable objects', () => {
    const component: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: true,
      memoHitRate: 0.3,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [
      { type: 'unstable-object', propName: 'style', description: '', suggestion: '', impact: 0.5 },
    ];

    const recommendations = generateMemoRecommendations(issues, component);
    expect(recommendations.some(r => r.includes('useMemo'))).toBe(true);
  });

  it('should recommend useMemo for unstable arrays', () => {
    const component: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: true,
      memoHitRate: 0.3,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [
      { type: 'unstable-array', propName: 'items', description: '', suggestion: '', impact: 0.5 },
    ];

    const recommendations = generateMemoRecommendations(issues, component);
    expect(recommendations.some(r => r.includes('useMemo'))).toBe(true);
  });

  it('should recommend React.memo for missing memo', () => {
    const component: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: false,
      memoHitRate: 0,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [
      { type: 'missing-memo', propName: 'component', description: '', suggestion: '', impact: 0.9 },
    ];

    const recommendations = generateMemoRecommendations(issues, component);
    expect(recommendations.some(r => r.includes('React.memo'))).toBe(true);
  });

  it('should include expected improvement estimate', () => {
    const component: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: true,
      memoHitRate: 0.2,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [
      { type: 'unstable-callback', propName: 'onClick', description: '', suggestion: '', impact: 0.9 },
    ];

    const recommendations = generateMemoRecommendations(issues, component);
    expect(recommendations.some(r => r.includes('Expected improvement'))).toBe(true);
  });

  it('should not include improvement for small gains', () => {
    const component: ComponentMetrics = {
      componentName: 'Test',
      isMemoized: true,
      memoHitRate: 0.8,
      renderCount: 10,
      propChanges: new Map(),
      averageRenderDuration: 1,
    };

    const issues = [
      { type: 'unstable-callback', propName: 'onClick', description: '', suggestion: '', impact: 0.1 },
    ];

    const recommendations = generateMemoRecommendations(issues, component);
    expect(recommendations.some(r => r.includes('Expected improvement'))).toBe(false);
  });
});
