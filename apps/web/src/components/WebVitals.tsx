'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[WebVitals]', metric.name, metric.value.toFixed(2));
    }

    if (typeof window !== 'undefined' && window.plausible) {
      window.plausible('Web Vitals', {
        props: {
          name: metric.name,
          value: Math.round(metric.value),
          path: window.location.pathname,
        },
      });
    }
  });

  return null;
}
