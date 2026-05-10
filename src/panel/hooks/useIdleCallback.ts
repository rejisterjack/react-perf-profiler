/**
 * requestIdleCallback utility hook
 * Defers non-critical UI updates (tooltips, score recalculation, notifications)
 * to idle periods, keeping the main thread responsive during heavy rendering.
 *
 * Falls back to setTimeout on browsers/environments that don't support rIC.
 */

import { useCallback, useEffect, useRef } from 'react';

// Polyfill for environments without requestIdleCallback
const scheduleIdle =
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 1);

const cancelIdle =
  typeof cancelIdleCallback === 'function'
    ? cancelIdleCallback
    : clearTimeout;

type IdleHandle = ReturnType<typeof requestIdleCallback> | ReturnType<typeof setTimeout>;

/**
 * Schedule a callback during an idle period.
 * Returns a cancel function.
 */
export function scheduleIdleTask(callback: () => void): () => void {
  const handle: IdleHandle = scheduleIdle(callback);
  return () => cancelIdle(handle as never);
}

/**
 * React hook that provides a stable function to schedule idle work.
 * Automatically cancels pending work on unmount.
 *
 * @example
 * const scheduleIdle = useIdleCallback();
 * scheduleIdle(() => updateTooltipPosition());
 */
export function useIdleCallback(): (callback: () => void) => void {
  const pendingRef = useRef<IdleHandle | null>(null);

  useEffect(() => {
    return () => {
      if (pendingRef.current !== null) {
        cancelIdle(pendingRef.current as never);
      }
    };
  }, []);

  return useCallback((callback: () => void) => {
    if (pendingRef.current !== null) {
      cancelIdle(pendingRef.current as never);
    }
    pendingRef.current = scheduleIdle(() => {
      pendingRef.current = null;
      callback();
    });
  }, []);
}

/**
 * Debounce a callback using requestIdleCallback.
 * Useful for non-critical UI updates that shouldn't run on every render.
 *
 * @param callback - The function to debounce
 * @param timeoutMs - Maximum wait time before forcing execution (default 200ms)
 */
export function useIdleDebounce<T extends (...args: never[]) => void>(
  callback: T,
  timeoutMs = 200,
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const handleRef = useRef<IdleHandle | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (handleRef.current !== null) cancelIdle(handleRef.current as never);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (handleRef.current !== null) cancelIdle(handleRef.current as never);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);

      handleRef.current = scheduleIdle(() => {
        handleRef.current = null;
        timeoutRef.current = null;
        callbackRef.current(...args);
      });

      // Force execution after timeout even if not idle
      timeoutRef.current = setTimeout(() => {
        if (handleRef.current !== null) {
          cancelIdle(handleRef.current as never);
          handleRef.current = null;
        }
        timeoutRef.current = null;
        callbackRef.current(...args);
      }, timeoutMs);
    }) as T,
    [],
  );
}
