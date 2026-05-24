import { useCallback, useRef, useEffect } from 'react';

type IdleCallback = () => void;

/**
 * Wraps requestIdleCallback (with setTimeout fallback for environments
 * that don't support it). Returns a scheduler function that queues the
 * provided callback during an idle period.
 */
export function useIdleCallback(): (callback: IdleCallback) => void {
  const pendingCallbackRef = useRef<IdleCallback | null>(null);
  const handleRef = useRef<number>(0);

  const cancelPending = useCallback(() => {
    if (handleRef.current !== 0) {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(handleRef.current);
      } else {
        clearTimeout(handleRef.current);
      }
      handleRef.current = 0;
    }
    pendingCallbackRef.current = null;
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelPending();
    };
  }, [cancelPending]);

  const schedule = useCallback(
    (callback: IdleCallback) => {
      cancelPending();
      pendingCallbackRef.current = callback;

      if (typeof requestIdleCallback === 'function') {
        handleRef.current = requestIdleCallback(() => {
          const cb = pendingCallbackRef.current;
          pendingCallbackRef.current = null;
          handleRef.current = 0;
          cb?.();
        });
      } else {
        handleRef.current = (setTimeout(() => {
          const cb = pendingCallbackRef.current;
          pendingCallbackRef.current = null;
          handleRef.current = 0;
          cb?.();
        }, 1) as unknown) as number;
      }
    },
    [cancelPending],
  );

  return schedule;
}
