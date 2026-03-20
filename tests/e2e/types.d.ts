/**
 * Type declarations for E2E tests
 */

// Extend Window interface for React DevTools hook and test globals
declare global {
  interface Window {
    /** React DevTools global hook */
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      renderers: Map<number, unknown>;
      onCommitFiberRoot: (rendererID: number, root: unknown, priorityLevel: number) => void;
      onCommitFiberUnmount: (rendererID: number, fiber: unknown) => void;
      supportsFiber: boolean;
      inject: (renderer: unknown) => number;
    };
    /** React Perf Profiler active flag */
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

export {};
