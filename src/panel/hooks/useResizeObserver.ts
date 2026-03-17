/**
 * Hook for observing element size changes using ResizeObserver
 * @module panel/hooks/useResizeObserver
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Size information returned by the hook
 */
export interface ElementSize {
  /** Width of the element in pixels */
  width: number;
  /** Height of the element in pixels */
  height: number;
}

/**
 * Options for the useResizeObserver hook
 */
export interface UseResizeObserverOptions {
  /** Initial width before first measurement */
  initialWidth?: number;
  /** Initial height before first measurement */
  initialHeight?: number;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
}

/**
 * Return type for the useResizeObserver hook
 */
export interface UseResizeObserverReturn {
  /** Current size of the observed element */
  size: ElementSize;
  /** Ref to attach to the target element */
  ref: React.RefObject<HTMLElement | null>;
  /** Manually recalculate size */
  recalculate: () => void;
}

/**
 * Hook for observing element resizes using the ResizeObserver API
 * 
 * Provides reactive size information for an element, useful for
 * responsive layouts and canvas sizing.
 * 
 * @example
 * ```tsx
 * function ResizableChart() {
 *   const { size, ref } = useResizeObserver({ initialWidth: 300, initialHeight: 200 });
 *   
 *   return (
 *     <div ref={ref} style={{ width: '100%', height: '100%' }}>
 *       <svg width={size.width} height={size.height}>
 *         {/* Chart content based on actual size *\/}
 *       </svg>
 *     </div>
 *   );
 * }
 * ```
 * 
 * @param options - Configuration options
 * @returns Object containing size information and ref
 */
export function useResizeObserver(options: UseResizeObserverOptions = {}): UseResizeObserverReturn {
  const { 
    initialWidth = 0, 
    initialHeight = 0, 
    debounceMs = 0 
  } = options;
  
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState<ElementSize>({
    width: initialWidth,
    height: initialHeight,
  });
  
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  /**
   * Update size state from an element
   */
  const updateSize = useCallback((element: Element): void => {
    const rect = element.getBoundingClientRect();
    const newSize = {
      width: rect.width,
      height: rect.height,
    };
    
    setSize((prevSize) => {
      // Only update if size actually changed
      if (prevSize.width !== newSize.width || prevSize.height !== newSize.height) {
        return newSize;
      }
      return prevSize;
    });
  }, []);

  /**
   * Handle resize with optional debouncing
   */
  const handleResize = useCallback((entries: ResizeObserverEntry[]): void => {
    if (!entries.length) return;
    
    const entry = entries[0];
    
    if (debounceMs > 0) {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        updateSize(entry.target);
      }, debounceMs);
    } else {
      updateSize(entry.target);
    }
  }, [debounceMs, updateSize]);

  /**
   * Manually recalculate size
   */
  const recalculate = useCallback((): void => {
    const element = ref.current;
    if (element) {
      updateSize(element);
    }
  }, [updateSize]);

  /**
   * Set up ResizeObserver
   */
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check for ResizeObserver support
    if (typeof ResizeObserver === 'undefined') {
      console.warn('ResizeObserver is not supported in this browser');
      // Fallback to initial size
      return;
    }

    // Create observer
    observerRef.current = new ResizeObserver(handleResize);
    observerRef.current.observe(element);
    
    // Initial measurement
    updateSize(element);

    return () => {
      // Cleanup
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleResize, updateSize]);

  return {
    size,
    ref,
    recalculate,
  };
}
