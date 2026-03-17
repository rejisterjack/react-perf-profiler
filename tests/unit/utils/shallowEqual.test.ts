import { describe, it, expect } from 'vitest';
import { shallowEqual, shallowEqualArrays, shallowEqualProps } from '@/panel/utils/shallowEqual';

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
