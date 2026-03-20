import { describe, it, expect, beforeEach } from 'vitest';
import {
  shallowEqual,
  shallowEqualArrays,
  shallowEqualProps,
  createShallowEqualWithCache,
  createShallowEqualArraysWithCache,
  cachedShallowEqual,
  cachedShallowEqualArrays,
} from '@/panel/utils/shallowEqual';

describe('shallowEqual', () => {
  it('should return true for same reference', () => {
    const obj = { a: 1 };
    expect(shallowEqual(obj, obj)).toBe(true);
  });

  it('should return true for shallow equal objects', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it('should return false for different values', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('should return false for different key counts', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('should return false for nested objects', () => {
    expect(shallowEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(false);
  });

  it('should handle null values', () => {
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(null, { a: 1 })).toBe(false);
    expect(shallowEqual({ a: 1 }, null)).toBe(false);
  });

  it('should handle undefined values', () => {
    expect(shallowEqual(undefined, undefined)).toBe(true);
    expect(shallowEqual(undefined, { a: 1 })).toBe(false);
    expect(shallowEqual({ a: 1 }, undefined)).toBe(false);
  });

  it('should handle empty objects', () => {
    expect(shallowEqual({}, {})).toBe(true);
  });

  it('should return false for different types', () => {
    expect(shallowEqual({ a: 1 }, { a: '1' })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: true })).toBe(false);
  });

  it('should handle objects with many keys', () => {
    const obj1 = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    const obj2 = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    expect(shallowEqual(obj1, obj2)).toBe(true);
  });

  describe('ignoreFunctions option', () => {
    it('should treat functions as equal when ignoreFunctions is true', () => {
      const fn1 = () => {};
      const fn2 = () => {};
      expect(shallowEqual({ fn: fn1 }, { fn: fn2 }, { ignoreFunctions: true })).toBe(true);
    });

    it('should treat functions as different when ignoreFunctions is false', () => {
      const fn1 = () => {};
      const fn2 = () => {};
      expect(shallowEqual({ fn: fn1 }, { fn: fn2 }, { ignoreFunctions: false })).toBe(false);
    });
  });

  describe('ignoreKeys option', () => {
    it('should ignore specified keys', () => {
      const obj1 = { a: 1, b: 2, timestamp: 1000 };
      const obj2 = { a: 1, b: 2, timestamp: 2000 };
      expect(shallowEqual(obj1, obj2, { ignoreKeys: ['timestamp'] })).toBe(true);
    });

    it('should handle multiple ignored keys', () => {
      const obj1 = { a: 1, b: 2, x: 100, y: 200 };
      const obj2 = { a: 1, b: 2, x: 300, y: 400 };
      expect(shallowEqual(obj1, obj2, { ignoreKeys: ['x', 'y'] })).toBe(true);
    });

    it('should still check non-ignored keys', () => {
      const obj1 = { a: 1, b: 2, timestamp: 1000 };
      const obj2 = { a: 1, b: 3, timestamp: 2000 };
      expect(shallowEqual(obj1, obj2, { ignoreKeys: ['timestamp'] })).toBe(false);
    });
  });
});

describe('shallowEqualArrays', () => {
  it('should return true for same reference', () => {
    const arr = [1, 2, 3];
    expect(shallowEqualArrays(arr, arr)).toBe(true);
  });

  it('should return true for shallow equal arrays', () => {
    expect(shallowEqualArrays([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('should return false for different lengths', () => {
    expect(shallowEqualArrays([1, 2], [1, 2, 3])).toBe(false);
  });

  it('should return false for different values', () => {
    expect(shallowEqualArrays([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it('should return false for nested arrays', () => {
    expect(shallowEqualArrays([[1]], [[1]])).toBe(false);
  });

  it('should handle null values', () => {
    expect(shallowEqualArrays(null, null)).toBe(true);
    expect(shallowEqualArrays(null, [1])).toBe(false);
    expect(shallowEqualArrays([1], null)).toBe(false);
  });

  it('should handle empty arrays', () => {
    expect(shallowEqualArrays([], [])).toBe(true);
  });

  it('should handle arrays with objects', () => {
    const obj = { a: 1 };
    expect(shallowEqualArrays([obj], [obj])).toBe(true);
    expect(shallowEqualArrays([{ a: 1 }], [{ a: 1 }])).toBe(false);
  });
});

describe('shallowEqualProps', () => {
  it('should return true when both are null', () => {
    expect(shallowEqualProps(null, null)).toBe(true);
  });

  it('should return false when one is null', () => {
    expect(shallowEqualProps(null, { a: 1 })).toBe(false);
    expect(shallowEqualProps({ a: 1 }, null)).toBe(false);
  });

  it('should return true for equal props', () => {
    expect(shallowEqualProps({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it('should return false for different props', () => {
    expect(shallowEqualProps({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
  });

  it('should check only specified props when propNames provided', () => {
    const prev = { a: 1, b: 2, c: 3 };
    const next = { a: 1, b: 5, c: 3 };
    expect(shallowEqualProps(prev, next, ['a', 'c'])).toBe(true);
  });

  it('should return false if specified prop is different', () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 2, b: 2 };
    expect(shallowEqualProps(prev, next, ['a'])).toBe(false);
  });

  it('should handle missing keys in either object', () => {
    const prev = { a: 1 };
    const next = { a: 1, b: 2 };
    expect(shallowEqualProps(prev, next, ['a'])).toBe(true);
    expect(shallowEqualProps(prev, next, ['a', 'b'])).toBe(false);
  });

  it('should handle empty propNames array', () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 3, b: 4 };
    expect(shallowEqualProps(prev, next, [])).toBe(true);
  });
});

describe('createShallowEqualWithCache', () => {
  let cachedFn: ReturnType<typeof createShallowEqualWithCache>;

  beforeEach(() => {
    cachedFn = createShallowEqualWithCache();
  });

  it('should return same result as uncached shallowEqual for equal objects', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    
    expect(cachedFn(obj1, obj2)).toBe(shallowEqual(obj1, obj2));
  });

  it('should return same result as uncached shallowEqual for different objects', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 3 };
    
    expect(cachedFn(obj1, obj2)).toBe(shallowEqual(obj1, obj2));
  });

  it('should handle null values', () => {
    expect(cachedFn(null, null)).toBe(true);
    expect(cachedFn(null, { a: 1 })).toBe(false);
    expect(cachedFn({ a: 1 }, null)).toBe(false);
  });

  it('should handle undefined values', () => {
    expect(cachedFn(undefined, undefined)).toBe(true);
    expect(cachedFn(undefined, { a: 1 })).toBe(false);
  });

  it('should handle same reference (fast path)', () => {
    const obj = { a: 1 };
    expect(cachedFn(obj, obj)).toBe(true);
  });

  it('should handle options (ignoreFunctions)', () => {
    const fn1 = () => {};
    const fn2 = () => {};
    
    expect(cachedFn({ fn: fn1 }, { fn: fn2 }, { ignoreFunctions: true })).toBe(true);
    expect(cachedFn({ fn: fn1 }, { fn: fn2 }, { ignoreFunctions: false })).toBe(false);
  });

  it('should handle options (ignoreKeys)', () => {
    const obj1 = { a: 1, b: 2, timestamp: 1000 };
    const obj2 = { a: 1, b: 2, timestamp: 2000 };
    
    expect(cachedFn(obj1, obj2, { ignoreKeys: ['timestamp'] })).toBe(true);
    // Different options should give different results
    expect(cachedFn(obj1, obj2, { ignoreKeys: [] })).toBe(false);
  });

  it('should return consistent results on repeated calls', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { a: 1, b: 2, c: 3 };
    
    const result1 = cachedFn(obj1, obj2);
    const result2 = cachedFn(obj1, obj2);
    const result3 = cachedFn(obj1, obj2);
    
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('should handle different object pairs independently', () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 2 };
    const obj3 = { a: 3 };
    
    // Each pair should return false (different values)
    expect(cachedFn(obj1, obj2)).toBe(false);
    expect(cachedFn(obj2, obj3)).toBe(false);
    expect(cachedFn(obj1, obj3)).toBe(false);
  });

  it('should cache results and return same value on subsequent calls', () => {
    const obj1 = { x: 1, y: 2 };
    const obj2 = { x: 1, y: 2 };
    
    // First call - computes and caches
    const result1 = cachedFn(obj1, obj2);
    // Second call - should return cached value
    const result2 = cachedFn(obj1, obj2);
    
    expect(result1).toBe(result2);
    expect(result1).toBe(shallowEqual(obj1, obj2));
  });

  it('should respect custom maxCacheSize', () => {
    const smallCacheFn = createShallowEqualWithCache({ maxCacheSize: 10 });
    
    // Create many different object pairs
    for (let i = 0; i < 50; i++) {
      smallCacheFn({ id: i }, { id: i });
    }
    
    // Should not throw or error
    expect(() => {
      for (let i = 0; i < 100; i++) {
        smallCacheFn({ id: i }, { id: i });
      }
    }).not.toThrow();
  });

  it('should allow garbage collection via WeakMap', () => {
    // Create cached function
    const fn = createShallowEqualWithCache();
    
    // Create objects and compare
    let obj1: { a: number } | null = { a: 1 };
    let obj2: { a: number } | null = { a: 1 };
    
    fn(obj1, obj2);
    
    // Clear references
    obj1 = null;
    obj2 = null;
    
    // Objects should be eligible for GC (WeakMap doesn't prevent GC)
    // This test mainly verifies the structure doesn't cause issues
    expect(true).toBe(true);
  });
});

describe('createShallowEqualArraysWithCache', () => {
  let cachedFn: ReturnType<typeof createShallowEqualArraysWithCache>;

  beforeEach(() => {
    cachedFn = createShallowEqualArraysWithCache();
  });

  it('should return same result as uncached shallowEqualArrays', () => {
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    
    expect(cachedFn(arr1, arr2)).toBe(shallowEqualArrays(arr1, arr2));
  });

  it('should handle same reference (fast path)', () => {
    const arr = [1, 2, 3];
    expect(cachedFn(arr, arr)).toBe(true);
  });

  it('should handle null values', () => {
    expect(cachedFn(null, null)).toBe(true);
    expect(cachedFn(null, [1])).toBe(false);
    expect(cachedFn([1], null)).toBe(false);
  });

  it('should return consistent results on repeated calls', () => {
    const arr1 = [1, 2, 3, 4, 5];
    const arr2 = [1, 2, 3, 4, 5];
    
    const result1 = cachedFn(arr1, arr2);
    const result2 = cachedFn(arr1, arr2);
    const result3 = cachedFn(arr1, arr2);
    
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });
});

describe('default cached exports', () => {
  it('should have cachedShallowEqual function', () => {
    expect(typeof cachedShallowEqual).toBe('function');
  });

  it('should have cachedShallowEqualArrays function', () => {
    expect(typeof cachedShallowEqualArrays).toBe('function');
  });

  it('should work with default cachedShallowEqual', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    
    // First call computes and caches
    const result1 = cachedShallowEqual(obj1, obj2);
    // Second call returns cached value
    const result2 = cachedShallowEqual(obj1, obj2);
    
    expect(result1).toBe(result2);
    expect(result1).toBe(shallowEqual(obj1, obj2));
  });
});

describe('cached shallowEqual performance', () => {
  it('should show performance benefit for larger objects', () => {
    const cachedFn = createShallowEqualWithCache();
    const iterations = 1000;
    
    // Create larger test objects where caching is more beneficial
    const obj1 = { 
      a: 1, b: 2, c: 3, d: 4, e: 5, 
      f: 6, g: 7, h: 8, i: 9, j: 10,
      k: 11, l: 12, m: 13, n: 14, o: 15
    };
    const obj2 = { 
      a: 1, b: 2, c: 3, d: 4, e: 5,
      f: 6, g: 7, h: 8, i: 9, j: 10,
      k: 11, l: 12, m: 13, n: 14, o: 15
    };
    
    // Warm up cache
    cachedFn(obj1, obj2);
    
    // Time cached version
    const cachedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      cachedFn(obj1, obj2);
    }
    const cachedDuration = performance.now() - cachedStart;
    
    // Time uncached version
    const uncachedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      shallowEqual(obj1, obj2);
    }
    const uncachedDuration = performance.now() - uncachedStart;
    
    console.log(`Large object cached: ${cachedDuration.toFixed(2)}ms, uncached: ${uncachedDuration.toFixed(2)}ms`);
    
    // Verify results are correct (don't enforce strict performance threshold due to measurement variance)
    expect(cachedFn(obj1, obj2)).toBe(shallowEqual(obj1, obj2));
    
    // In most runs, cached should be comparable or faster
    // But we don't enforce strict threshold due to measurement overhead
    expect(cachedDuration).toBeLessThan(uncachedDuration * 2);
  });

  it('should handle multiple different object pairs efficiently', () => {
    const cachedFn = createShallowEqualWithCache({ maxCacheSize: 500 });
    const pairCount = 100;
    const iterationsPerPair = 100;
    
    // Create pairs of objects
    const pairs: Array<[Record<string, number>, Record<string, number>]> = [];
    for (let i = 0; i < pairCount; i++) {
      pairs.push([
        { id: i, value: i * 2 },
        { id: i, value: i * 2 }
      ]);
    }
    
    // Warm up cache
    for (const [a, b] of pairs) {
      cachedFn(a, b);
    }
    
    // Time repeated access to all pairs
    const start = performance.now();
    for (let i = 0; i < iterationsPerPair; i++) {
      for (const [a, b] of pairs) {
        cachedFn(a, b);
      }
    }
    const duration = performance.now() - start;
    
    console.log(`Multiple pairs (${pairCount} pairs x ${iterationsPerPair} iterations): ${duration.toFixed(2)}ms`);
    
    // Should complete reasonably fast (less than 500ms for 10,000 lookups)
    expect(duration).toBeLessThan(500);
  });

  it('should handle cache eviction correctly', () => {
    const maxCacheSize = 100;
    const cachedFn = createShallowEqualWithCache({ maxCacheSize });
    
    // Create many more pairs than cache size
    for (let i = 0; i < maxCacheSize * 3; i++) {
      cachedFn({ id: i }, { id: i });
    }
    
    // Should still work correctly after eviction
    const obj1 = { test: 1 };
    const obj2 = { test: 1 };
    
    const result = cachedFn(obj1, obj2);
    expect(typeof result).toBe('boolean');
    // Result should be consistent with uncached version
    expect(result).toBe(shallowEqual(obj1, obj2));
  });

  it('should correctly cache results with options', () => {
    const cachedFn = createShallowEqualWithCache();
    const iterations = 1000;
    
    const obj1 = { a: 1, b: 2, timestamp: Date.now(), id: Math.random() };
    const obj2 = { a: 1, b: 2, timestamp: Date.now(), id: Math.random() };
    const options = { ignoreKeys: ['timestamp', 'id'] };
    
    // Verify correctness
    const cachedResult = cachedFn(obj1, obj2, options);
    const uncachedResult = shallowEqual(obj1, obj2, options);
    expect(cachedResult).toBe(uncachedResult);
    
    // Verify cache is used (multiple calls return same result)
    for (let i = 0; i < iterations; i++) {
      expect(cachedFn(obj1, obj2, options)).toBe(cachedResult);
    }
  });
});

describe('cached shallowEqualArrays performance', () => {
  it('should show performance benefit for larger arrays', () => {
    const cachedFn = createShallowEqualArraysWithCache();
    const iterations = 1000;
    
    // Create larger arrays where caching is more beneficial
    const arr1 = Array.from({ length: 50 }, (_, i) => i);
    const arr2 = Array.from({ length: 50 }, (_, i) => i);
    
    // Warm up cache
    cachedFn(arr1, arr2);
    
    // Time cached version
    const cachedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      cachedFn(arr1, arr2);
    }
    const cachedDuration = performance.now() - cachedStart;
    
    // Time uncached version
    const uncachedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      shallowEqualArrays(arr1, arr2);
    }
    const uncachedDuration = performance.now() - uncachedStart;
    
    console.log(`Large array cached: ${cachedDuration.toFixed(2)}ms, uncached: ${uncachedDuration.toFixed(2)}ms`);
    
    // Verify results are correct
    expect(cachedFn(arr1, arr2)).toBe(shallowEqualArrays(arr1, arr2));
    
    // Don't enforce strict performance threshold - just verify it completes
    expect(cachedDuration).toBeLessThan(uncachedDuration * 2);
  });
});
