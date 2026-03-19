/**
 * Shallow equality checking utilities
 * Optimized for comparing props, state, and other React values
 */

import type { FiberData } from '../../content/types';

/** Extended fiber node with previous state for comparison */
export interface FiberNode extends FiberData {
  prevProps: Record<string, any> | null;
  prevState: any;
  hasContextChanged: boolean;
}

/** Options for shallow equality comparison */
export interface ShallowEqualOptions {
  /** Ignore functions in comparison (treat as equal) */
  ignoreFunctions?: boolean;
  /** Keys to ignore during comparison */
  ignoreKeys?: string[];
}

/**
 * Deeply optimized shallow equality check for objects
 * Uses early returns and avoids creating intermediate arrays for speed
 *
 * @param a - First object to compare
 * @param b - Second object to compare
 * @param options - Optional configuration for comparison
 * @returns True if objects are shallowly equal
 *
 * @example
 * ```typescript
 * shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 }) // true
 * shallowEqual({ a: {} }, { a: {} }) // false (different references)
 * ```
 */
export function shallowEqual<T extends Record<string, any>>(
  a: T | null | undefined,
  b: T | null | undefined,
  options: ShallowEqualOptions = {}
): boolean {
  // Fast path: same reference
  if (a === b) return true;

  // Null/undefined check
  if (a == null || b == null) return false;

  // Type check
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const { ignoreFunctions = false, ignoreKeys = [] } = options;

  // Build ignore set for O(1) lookups
  const ignoreSet = ignoreKeys.length > 0 ? new Set(ignoreKeys) : null;

  // Get all keys from both objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  // Check key count (accounting for ignored keys)
  if (ignoreSet) {
    let countA = 0;
    let countB = 0;
    for (const key of keysA) if (!ignoreSet.has(key)) countA++;
    for (const key of keysB) if (!ignoreSet.has(key)) countB++;
    if (countA !== countB) return false;
  } else if (keysA.length !== keysB.length) {
    return false;
  }

  // Check each key in a exists in b with same value
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i]!;

    // Skip ignored keys
    if (ignoreSet?.has(key)) continue;

    // Check key exists in b
    if (!Object.hasOwn(b, key)) return false;

    const valA = a[key]!;
    const valB = b[key]!;

    // Skip function comparison if configured
    if (ignoreFunctions && typeof valA === 'function' && typeof valB === 'function') {
      continue;
    }

    // Compare values
    if (valA !== valB) return false;
  }

  return true;
}

/**
 * Shallow equality check for arrays
 * Compares length and each element by reference
 *
 * @param a - First array to compare
 * @param b - Second array to compare
 * @returns True if arrays are shallowly equal
 *
 * @example
 * ```typescript
 * shallowEqualArrays([1, 2, 3], [1, 2, 3]) // true
 * shallowEqualArrays([{}], [{}]) // false
 * ```
 */
export function shallowEqualArrays<T>(
  a: T[] | null | undefined,
  b: T[] | null | undefined
): boolean {
  // Fast path: same reference
  if (a === b) return true;

  // Null/undefined checks
  if (a == null || b == null) return false;

  // Length check
  if (a.length !== b.length) return false;

  // Element comparison
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

/**
 * Compare specific props between two objects
 * Useful for checking only the props that affect a component's output
 *
 * @param prev - Previous props object
 * @param next - Next props object
 * @param propNames - Array of prop names to compare (compares all if not provided)
 * @returns True if specified props are equal
 *
 * @example
 * ```typescript
 * shallowEqualProps(
 *   { a: 1, b: 2, c: 3 },
 *   { a: 1, b: 3, c: 3 },
 *   ['a', 'c']
 * ) // true (only checks a and c)
 * ```
 */
export function shallowEqualProps(
  prev: Record<string, any> | null | undefined,
  next: Record<string, any> | null | undefined,
  propNames?: string[]
): boolean {
  // Fast path: both null/undefined
  if (prev == null && next == null) return true;

  // One is null
  if (prev == null || next == null) return false;

  // Determine which keys to check
  const keysToCheck = propNames ?? Object.keys(prev);

  // Compare each specified prop
  for (let i = 0; i < keysToCheck.length; i++) {
    const key = keysToCheck[i]!;

    // Check if key exists in both
    const hasPrev = Object.hasOwn(prev, key);
    const hasNext = Object.hasOwn(next, key);

    if (hasPrev !== hasNext) return false;
    if (hasPrev && prev[key] !== next[key]) return false;
  }

  return true;
}
