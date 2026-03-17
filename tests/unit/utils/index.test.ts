import { describe, it, expect } from 'vitest';

// Test utility exports from @/panel/utils/index.ts
// This tests that all utility functions are properly exported

describe('utils/index exports', () => {
  it('should export shallowEqual utilities', async () => {
    const utils = await import('@/panel/utils');
    
    expect(utils.shallowEqual).toBeDefined();
    expect(typeof utils.shallowEqual).toBe('function');
    
    expect(utils.shallowEqualArrays).toBeDefined();
    expect(typeof utils.shallowEqualArrays).toBe('function');
    
    expect(utils.shallowEqualProps).toBeDefined();
    expect(typeof utils.shallowEqualProps).toBe('function');
  });

  it('should export wasted render analysis', async () => {
    const utils = await import('@/panel/utils');
    
    expect(utils.analyzeWastedRenders).toBeDefined();
    expect(typeof utils.analyzeWastedRenders).toBe('function');
  });

  it('should export memo analysis', async () => {
    const utils = await import('@/panel/utils');
    
    expect(utils.analyzeMemoEffectiveness).toBeDefined();
    expect(typeof utils.analyzeMemoEffectiveness).toBe('function');
  });

  it('should export performance score utilities', async () => {
    const utils = await import('@/panel/utils');
    
    expect(utils.calculatePerformanceScore).toBeDefined();
    expect(typeof utils.calculatePerformanceScore).toBe('function');
  });
});

describe('utils/index integration', () => {
  it('shallowEqual should work when imported from index', async () => {
    const { shallowEqual } = await import('@/panel/utils');
    
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('shallowEqualArrays should work when imported from index', async () => {
    const { shallowEqualArrays } = await import('@/panel/utils');
    
    expect(shallowEqualArrays([1, 2], [1, 2])).toBe(true);
    expect(shallowEqualArrays([1, 2], [1, 3])).toBe(false);
  });
});
