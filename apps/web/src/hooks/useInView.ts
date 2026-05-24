'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

export function useInView<T extends HTMLElement>(
  options?: IntersectionObserverInit
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  return [ref, isInView];
}
