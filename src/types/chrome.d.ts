// Type declarations for Chrome extension APIs
/// <reference types="chrome"/>

import type { ReactRenderer, FiberRoot, ReactFiber } from '../content/ReactInternals';

// Extend Window interface for React DevTools hook
declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      renderers: Map<number, ReactRenderer>;
      onCommitFiberRoot: (rendererID: number, root: FiberRoot, priorityLevel: number) => void;
      onCommitFiberUnmount: (rendererID: number, fiber: ReactFiber) => void;
      supportsFiber: boolean;
      inject: (renderer: ReactRenderer) => number;
    };
    __REACT_PERF_PROFILER_ACTIVE__?: boolean;
    /** Global React object (if available) */
    React?: { version?: string };
    /** Global ReactDOM object (if available) */
    ReactDOM?: { 
      version?: string;
      createRoot?: (container: Element) => { render: (element: unknown) => void };
    };
  }
}
