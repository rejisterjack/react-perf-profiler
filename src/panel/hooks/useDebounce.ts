/**
 * Hook for debouncing values and callbacks
 * @module panel/hooks/useDebounce
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Options for debounce behavior
 */
export interface DebounceOptions {
  /** Delay in milliseconds */
  delay: number;
  /** Whether to invoke on the leading edge */
  leading?: boolean;
  /** Whether to invoke on the trailing edge */
  trailing?: boolean;
}

/**
 * Hook for debouncing a value
 *
 * Returns a debounced version of the input value that only updates
 * after the specified delay has passed without the value changing.
 *
 * @example
 * ```tsx
 * function SearchInput() {
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const debouncedSearchTerm = useDebounce(searchTerm, 300);
 *
 *   // Only search after user stops typing for 300ms
 *   useEffect(() => {
 *     performSearch(debouncedSearchTerm);
 *   }, [debouncedSearchTerm]);
 *
 *   return (
 *     <input
 *       value={searchTerm}
 *       onChange={(e) => setSearchTerm(e.target.value)}
 *     />
 *   );
 * }
 * ```
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup on unmount or value change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for creating a debounced callback function
 *
 * Returns a memoized callback that will only execute after the specified
 * delay has passed since the last invocation.
 *
 * @example
 * ```tsx
 * function SearchResults() {
 *   const [results, setResults] = useState([]);
 *
 *   const debouncedSearch = useDebouncedCallback(
 *     async (query: string) => {
 *       const data = await fetchResults(query);
 *       setResults(data);
 *     },
 *     500
 *   );
 *
 *   return (
 *     <input
 *       onChange={(e) => debouncedSearch(e.target.value)}
 *     />
 *   );
 * }
 * ```
 *
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds
 * @param options - Additional debounce options
 * @returns Debounced callback function
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number,
  options: Omit<DebounceOptions, 'delay'> = {}
): (...args: Parameters<T>) => void {
  const { leading = false, trailing = true } = options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const lastCallTimeRef = useRef<number>(0);

  // Keep callback reference up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>): void => {
      const now = Date.now();
      const isLeading = leading && now - lastCallTimeRef.current > delay;

      lastCallTimeRef.current = now;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Execute on leading edge if appropriate
      if (isLeading) {
        callbackRef.current(...args);
      }

      // Set up trailing edge execution
      if (trailing) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          if (!leading) {
            callbackRef.current(...args);
          }
        }, delay);
      }
    },
    [delay, leading, trailing]
  );
}

/**
 * Hook for debouncing state updates with control functions
 *
 * Provides debounced state similar to useState, but with a delay
 * and additional controls for immediate updates and cancellation.
 *
 * @example
 * ```tsx
 * function FilterPanel() {
 *   const [filter, setFilter, immediateSetFilter, cancelSetFilter] = useDebounceState('', 200);
 *
 *   return (
 *     <div>
 *       <input
 *         value={filter}
 *         onChange={(e) => setFilter(e.target.value)}
 *       />
 *       <button onClick={cancelSetFilter}>Cancel</button>
 *       <button onClick={() => immediateSetFilter('')}>Clear Now</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param initialValue - Initial state value
 * @param delay - Delay in milliseconds
 * @returns Tuple of [debouncedValue, setValue, immediateSetValue, cancelPending]
 */
export function useDebounceState<T>(
  initialValue: T,
  delay: number
): [T, (value: T | ((prev: T) => T)) => void, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(initialValue);
  const [pendingValue, setPendingValue] = useState<T>(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced setter
  const setDebouncedValue = useCallback(
    (newValue: T | ((prev: T) => T)): void => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Handle function updater
      const resolvedValue =
        typeof newValue === 'function' ? (newValue as (prev: T) => T)(pendingValue) : newValue;

      setPendingValue(resolvedValue);

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        setValue(resolvedValue);
        timeoutRef.current = null;
      }, delay);
    },
    [delay, pendingValue]
  );

  // Immediate setter
  const setImmediateValue = useCallback((newValue: T): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingValue(newValue);
    setValue(newValue);
  }, []);

  // Cancel pending update
  const cancelPending = useCallback((): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingValue(value);
  }, [value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, setDebouncedValue, setImmediateValue, cancelPending];
}
