/**
 * Shallow equality checking utilities
 * Optimized for comparing props, state, and other React values
 */

import type { FiberData } from '../../content/types';

/** Extended fiber node with previous state for comparison */
export interface FiberNode extends FiberData {
  prevProps: Record<string, unknown> | null;
  prevState: unknown;
  hasContextChanged: boolean;
}

/** Options for shallow equality comparison */
export interface ShallowEqualOptions {
  /** Ignore functions in comparison (treat as equal) */
  ignoreFunctions?: boolean;
  /** Keys to ignore during comparison */
  ignoreKeys?: string[];
}

/** Configuration for the cached shallow equal factory */
export interface CachedShallowEqualConfig {
  /** Maximum number of entries in the LRU cache (default: 1000) */
  maxCacheSize?: number;
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
export function shallowEqual<T extends Record<string, unknown>>(
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

    const valA = a[key];
    const valB = b[key];

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
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
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

/**
 * Counter for generating unique IDs for cache keys
 * Used for objects that don't have stable references for WeakMap
 */
let objectIdCounter = 0;
const objectIdMap = new WeakMap<object, number>();

/**
 * Gets or creates a unique ID for an object
 */
function getObjectId(obj: object): number {
  let id = objectIdMap.get(obj);
  if (id === undefined) {
    id = ++objectIdCounter;
    objectIdMap.set(obj, id);
  }
  return id;
}

/**
 * Hash function for options to create unique cache keys
 */
function hashOptions(options: ShallowEqualOptions): string {
  if (!options.ignoreFunctions && (!options.ignoreKeys || options.ignoreKeys.length === 0)) {
    return '';
  }
  
  const parts: string[] = [];
  if (options.ignoreFunctions) {
    parts.push('fn');
  }
  if (options.ignoreKeys && options.ignoreKeys.length > 0) {
    parts.push(...options.ignoreKeys.slice().sort());
  }
  
  return parts.join(',');
}

/**
 * Creates a cached version of shallowEqual with LRU cache.
 * 
 * Uses WeakMap for object pairs to allow garbage collection,
 * with a Map-based LRU cache as fallback for non-object keys.
 * 
 * The cache stores comparison results keyed by object references,
 * providing O(1) lookups for repeated comparisons.
 * 
 * Note: Caching is most beneficial for:
 * - Repeated comparisons of the same object pairs
 * - Objects with many keys (10+)
 * - Comparisons with expensive options (ignoreKeys, ignoreFunctions)
 * 
 * @param config - Optional configuration for the cache
 * @returns A shallowEqual function with caching enabled
 *
 * @example
 * ```typescript
 * const cachedShallowEqual = createShallowEqualWithCache({ maxCacheSize: 500 });
 * 
 * const obj1 = { a: 1, b: 2 };
 * const obj2 = { a: 1, b: 2 };
 * 
 * // First call: full comparison + cache result
 * cachedShallowEqual(obj1, obj2); // false (different references)
 * 
 * // Second call: cache hit (O(1) lookup)
 * cachedShallowEqual(obj1, obj2); // false (from cache)
 * ```
 */
export function createShallowEqualWithCache(
  config: CachedShallowEqualConfig = {}
): <T extends Record<string, unknown>>(
  a: T | null | undefined,
  b: T | null | undefined,
  options?: ShallowEqualOptions
) => boolean {
  const { maxCacheSize = 1000 } = config;

  // WeakMap for object-object comparisons without options - allows GC
  const weakCache = new WeakMap<object, WeakMap<object, boolean>>();
  
  // LRU cache using Map (preserves insertion order)
  // Key format: "objIdA:objIdB:optionsHash" for consistent ordering
  const lruCache = new Map<string, boolean>();

  /**
   * Generates a cache key for object pairs.
   * Uses unique object IDs to distinguish different object instances.
   */
  function generateCacheKey(
    a: object,
    b: object,
    options: ShallowEqualOptions
  ): string {
    const idA = getObjectId(a);
    const idB = getObjectId(b);
    
    // Ensure consistent ordering (smaller ID first)
    const keyPrefix = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
    const optionsHash = hashOptions(options);
    
    return optionsHash ? `${keyPrefix}:${optionsHash}` : keyPrefix;
  }

  /**
   * Evicts least recently used entries when cache exceeds max size.
   * Removes oldest 20% of entries.
   */
  function evictLruEntries(): void {
    if (lruCache.size <= maxCacheSize) return;

    const entriesToEvict = Math.ceil(maxCacheSize * 0.2);
    const entries = lruCache.keys();
    
    for (let i = 0; i < entriesToEvict; i++) {
      const next = entries.next();
      if (next.done) break;
      lruCache.delete(next.value);
    }
  }

  return function cachedShallowEqual<T extends Record<string, unknown>>(
    a: T | null | undefined,
    b: T | null | undefined,
    options: ShallowEqualOptions = {}
  ): boolean {
    // Fast path: same reference - no caching needed
    if (a === b) return true;

    // Null checks - no caching needed for these simple cases
    if (a == null || b == null) return false;

    // Type check
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    // Generate cache key that includes options
    const cacheKey = generateCacheKey(a, b, options);
    
    // Check LRU cache first (handles options correctly)
    const lruEntry = lruCache.get(cacheKey);
    if (lruEntry !== undefined) {
      // Move to end to mark as recently used
      lruCache.delete(cacheKey);
      lruCache.set(cacheKey, lruEntry);
      return lruEntry;
    }

    // For no-options case, also check WeakMap (allows GC)
    const hasOptions = options.ignoreFunctions || (options.ignoreKeys && options.ignoreKeys.length > 0);
    if (!hasOptions) {
      let innerMap = weakCache.get(a);
      if (innerMap) {
        const cached = innerMap.get(b);
        if (cached !== undefined) {
          // Sync to LRU cache
          lruCache.set(cacheKey, cached);
          return cached;
        }
      } else {
        innerMap = new WeakMap<object, boolean>();
        weakCache.set(a, innerMap);
      }

      // Check reverse direction
      const reverseInnerMap = weakCache.get(b);
      if (reverseInnerMap) {
        const cached = reverseInnerMap.get(a);
        if (cached !== undefined) {
          innerMap.set(b, cached);
          lruCache.set(cacheKey, cached);
          return cached;
        }
      }
    }

    // Cache miss: perform full comparison
    const result = shallowEqual(a, b, options);

    // Store in LRU cache
    evictLruEntries();
    lruCache.set(cacheKey, result);

    // Also store in WeakMap for no-options case (allows GC)
    if (!hasOptions) {
      let innerMap = weakCache.get(a);
      if (!innerMap) {
        innerMap = new WeakMap<object, boolean>();
        weakCache.set(a, innerMap);
      }
      innerMap.set(b, result);
    }

    return result;
  };
}

/**
 * Creates a cached version of shallowEqualArrays with LRU cache.
 * 
 * Uses WeakMap for array pairs and a Map-based LRU cache for fallback.
 *
 * @param config - Optional configuration for the cache
 * @returns A shallowEqualArrays function with caching enabled
 */
export function createShallowEqualArraysWithCache(
  config: CachedShallowEqualConfig = {}
): <T>(a: T[] | null | undefined, b: T[] | null | undefined) => boolean {
  const { maxCacheSize = 1000 } = config;

  // WeakMap for array-array comparisons
  const weakCache = new WeakMap<unknown[], WeakMap<unknown[], boolean>>();
  
  // LRU cache using Map to preserve insertion order
  const lruCache = new Map<string, boolean>();

  function generateCacheKey(a: unknown[], b: unknown[]): string {
    const idA = getObjectId(a);
    const idB = getObjectId(b);
    // Ensure consistent ordering
    return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
  }

  function evictLruEntries(): void {
    if (lruCache.size <= maxCacheSize) return;

    const entriesToEvict = Math.ceil(maxCacheSize * 0.2);
    const entries = lruCache.keys();
    
    for (let i = 0; i < entriesToEvict; i++) {
      const next = entries.next();
      if (next.done) break;
      lruCache.delete(next.value);
    }
  }

  return function cachedShallowEqualArrays<T>(
    a: T[] | null | undefined,
    b: T[] | null | undefined
  ): boolean {
    // Fast path: same reference
    if (a === b) return true;

    // Null checks
    if (a == null || b == null) return false;

    // Type check
    if (!Array.isArray(a) || !Array.isArray(b)) return false;

    // Check LRU cache first
    const cacheKey = generateCacheKey(a, b);
    const lruEntry = lruCache.get(cacheKey);
    if (lruEntry !== undefined) {
      // Move to end to mark as recently used
      lruCache.delete(cacheKey);
      lruCache.set(cacheKey, lruEntry);
      return lruEntry;
    }

    // Check WeakMap cache
    let innerMap = weakCache.get(a);
    if (innerMap) {
      const cached = innerMap.get(b);
      if (cached !== undefined) {
        // Sync to LRU
        lruCache.set(cacheKey, cached);
        return cached;
      }
    } else {
      innerMap = new WeakMap<unknown[], boolean>();
      weakCache.set(a, innerMap);
    }

    // Check reverse direction
    const reverseInnerMap = weakCache.get(b);
    if (reverseInnerMap) {
      const cached = reverseInnerMap.get(a);
      if (cached !== undefined) {
        innerMap.set(b, cached);
        lruCache.set(cacheKey, cached);
        return cached;
      }
    }

    // Cache miss: perform comparison
    const result = shallowEqualArrays(a, b);

    // Store in caches
    innerMap.set(b, result);
    evictLruEntries();
    lruCache.set(cacheKey, result);

    return result;
  };
}

/** Default cached instance for convenience */
export const cachedShallowEqual = createShallowEqualWithCache();

/** Default cached array instance for convenience */
export const cachedShallowEqualArrays = createShallowEqualArraysWithCache();
