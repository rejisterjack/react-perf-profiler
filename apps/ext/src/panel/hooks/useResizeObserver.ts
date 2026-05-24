import { useState, useEffect, type RefObject } from 'react';

interface Size {
  width: number;
  height: number;
}

/**
 * Observes the size of a DOM element referenced by the supplied ref.
 * Returns the current { width, height } and updates on every resize.
 */
export function useResizeObserver(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { inlineSize: width, blockSize: height } = entry.borderBoxSize[0] ?? {
          inlineSize: element.offsetWidth,
          blockSize: element.offsetHeight,
        };
        setSize({ width, height });
      }
    });

    observer.observe(element);
    // Set initial size synchronously
    setSize({ width: element.offsetWidth, height: element.offsetHeight });

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
