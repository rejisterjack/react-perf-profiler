/**
 * Hook for virtualizing large lists
 * @module panel/hooks/useVirtualList
 */

import { useCallback, useRef, useState, useEffect, useMemo } from 'react';

/**
 * Options for the useVirtualList hook
 */
export interface UseVirtualListOptions<T> {
  /** Array of items to virtualize */
  items: T[];
  /** Height of each item in pixels */
  itemHeight: number;
  /** Number of items to render outside viewport (for smooth scrolling) */
  overscan?: number;
  /** Height of the container in pixels */
  containerHeight: number;
}

/**
 * Virtual item with position information
 */
export interface VirtualItem<T> {
  /** The actual item data */
  item: T;
  /** Index in the original items array */
  index: number;
  /** CSS styles for positioning */
  style: React.CSSProperties;
}

/**
 * Return type for the useVirtualList hook
 */
export interface UseVirtualListReturn<T> {
  /** Array of virtual items to render */
  virtualItems: VirtualItem<T>[];
  /** Total height of the scrollable content */
  totalHeight: number;
  /** Scroll to a specific item index */
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  /** Ref to attach to the scroll container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Current scroll top position */
  scrollTop: number;
  /** Start index of visible range */
  startIndex: number;
  /** End index of visible range */
  endIndex: number;
}

/**
 * Hook for efficiently rendering large lists by only mounting visible items
 *
 * Uses a virtual scrolling technique where only items in (or near) the viewport
 * are rendered, dramatically improving performance for lists with thousands of items.
 *
 * @example
 * ```tsx
 * function LargeList({ items }: { items: string[] }) {
 *   const { virtualItems, totalHeight, containerRef } = useVirtualList({
 *     items,
 *     itemHeight: 40,
 *     containerHeight: 400,
 *     overscan: 5,
 *   });
 *
 *   return (
 *     <div ref={containerRef} style={{ height: 400, overflow: 'auto' }}>
 *       <div style={{ height: totalHeight, position: 'relative' }}>
 *         {virtualItems.map(({ item, index, style }) => (
 *           <div key={index} style={style}>
 *             {item}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param options - Configuration options for virtualization
 * @returns Object containing virtual items, total height, and control functions
 */
export function useVirtualList<T>({
  items,
  itemHeight,
  overscan = 5,
  containerHeight,
}: UseVirtualListOptions<T>): UseVirtualListReturn<T> {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const rafRef = useRef<number | null>(null);

  /**
   * Set up scroll event listener with RAF throttling
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = (): void => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(container.scrollTop);
        rafRef.current = null;
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  /**
   * Calculate visible range and virtual items
   */
  const { virtualItems, totalHeight, startIndex, endIndex } = useMemo(() => {
    const totalHeight = items.length * itemHeight;

    // Calculate visible range with overscan
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);

    // Build virtual items array
    const virtualItems: VirtualItem<T>[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];
      if (item !== undefined) {
        virtualItems.push({
          item,
          index: i,
          style: {
            position: 'absolute',
            top: i * itemHeight,
            height: itemHeight,
            left: 0,
            right: 0,
          },
        });
      }
    }

    return { virtualItems, totalHeight, startIndex, endIndex };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  /**
   * Scroll to a specific item index
   */
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth'): void => {
      const container = containerRef.current;
      if (!container) return;

      // Clamp index to valid range
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
      const targetScrollTop = clampedIndex * itemHeight;

      // Center the item in the viewport if possible
      const maxScrollTop = totalHeight - containerHeight;
      const centeredScrollTop = targetScrollTop - containerHeight / 2 + itemHeight / 2;
      const finalScrollTop = Math.max(0, Math.min(centeredScrollTop, maxScrollTop));

      container.scrollTo({
        top: finalScrollTop,
        behavior,
      });
    },
    [itemHeight, containerHeight, totalHeight, items.length]
  );

  return {
    virtualItems,
    totalHeight,
    scrollToIndex,
    containerRef,
    scrollTop,
    startIndex,
    endIndex,
  };
}
