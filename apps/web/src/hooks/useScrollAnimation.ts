'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

interface ScrollAnimationOptions {
  threshold?: number;
  triggerOnce?: boolean;
}

export function useScrollAnimation<T extends HTMLElement>(
  options: ScrollAnimationOptions = {}
) {
  const ref = useRef<T>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) return;

    const el = ref.current;
    if (!el) return;

    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          if (options.triggerOnce !== false) {
            observer.unobserve(el);
          }
        }
      },
      { threshold: options.threshold || 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [prefersReduced, options.threshold, options.triggerOnce]);

  return ref;
}
