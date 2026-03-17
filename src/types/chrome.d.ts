// Type declarations for Chrome extension APIs
/// <reference types="chrome"/>

// Extend Window interface for React DevTools hook
declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      renderers: Map<number, any>;
      onCommitFiberRoot: (rendererID: number, root: any, priorityLevel: number) => void;
      onCommitFiberUnmount: (rendererID: number, fiber: any) => void;
      supportsFiber: boolean;
      inject: (renderer: any) => number;
    };
    __REACT_PERF_PROFILER_ACTIVE__?: boolean;
  }
}

export {};
