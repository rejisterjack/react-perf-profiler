/**
 * Error message utilities
 * Maps structured bridge/worker error types to human-readable, actionable messages
 * shown in the panel UI (WelcomeScreen, error banners, etc.).
 */

export interface ErrorDisplay {
  /** Short headline shown prominently */
  title: string;
  /** Longer explanation with actionable guidance */
  detail: string;
  /** Whether the user can attempt a recovery action */
  recoverable: boolean;
}

/**
 * Known bridge / worker error type identifiers.
 * These are produced by the content script bridge and background service worker.
 */
export const BRIDGE_ERROR_TYPES = {
  CSP_BLOCKED: 'CSP_BLOCKED',
  INJECTION_FAILED: 'INJECTION_FAILED',
  BRIDGE_INIT_FAILED: 'BRIDGE_INIT_FAILED',
  WORKER_CRASH: 'WORKER_CRASH',
  REACT_NOT_FOUND: 'REACT_NOT_FOUND',
  DEVTOOLS_NOT_FOUND: 'DEVTOOLS_NOT_FOUND',
  CONNECTION_LOST: 'CONNECTION_LOST',
  UNKNOWN: 'UNKNOWN',
} as const;

export type BridgeErrorType = (typeof BRIDGE_ERROR_TYPES)[keyof typeof BRIDGE_ERROR_TYPES];

const ERROR_DISPLAY_MAP: Record<BridgeErrorType, ErrorDisplay> = {
  CSP_BLOCKED: {
    title: 'Content Security Policy blocked the profiler',
    detail:
      "This page's CSP prevents the profiler script from being injected. " +
      'Try relaxing the CSP in development mode, or use a page without strict CSP restrictions.',
    recoverable: false,
  },
  INJECTION_FAILED: {
    title: 'Script injection failed',
    detail:
      'The profiler could not inject its bridge script into the page. ' +
      'Refresh the tab after installing or updating the extension, then try again.',
    recoverable: true,
  },
  BRIDGE_INIT_FAILED: {
    title: 'Bridge initialization failed',
    detail:
      'The connection between the DevTools panel and the page could not be established. ' +
      'Refresh the inspected page and re-open DevTools.',
    recoverable: true,
  },
  WORKER_CRASH: {
    title: 'Analysis worker crashed',
    detail:
      'The background analysis worker stopped unexpectedly. ' +
      'This may be caused by an out-of-memory condition or a bug in the profiler. ' +
      'Try clearing the profiling data and restarting the recording.',
    recoverable: true,
  },
  REACT_NOT_FOUND: {
    title: 'React not detected',
    detail:
      'No React instance was found on this page. ' +
      'Make sure you are inspecting a page that uses React, and that React is loaded before you open DevTools.',
    recoverable: true,
  },
  DEVTOOLS_NOT_FOUND: {
    title: 'React DevTools hook not found',
    detail:
      'The React DevTools global hook (__REACT_DEVTOOLS_GLOBAL_HOOK__) is missing. ' +
      'Ensure you are running a development build of React, not the minified production bundle.',
    recoverable: true,
  },
  CONNECTION_LOST: {
    title: 'Connection to the page was lost',
    detail:
      'The DevTools panel lost its connection to the inspected page. ' +
      'The page may have navigated or been closed. Reopen DevTools to reconnect.',
    recoverable: true,
  },
  UNKNOWN: {
    title: 'An unexpected error occurred',
    detail:
      'The profiler encountered an unknown error. ' +
      'Try refreshing the inspected page and reopening the DevTools panel.',
    recoverable: true,
  },
};

/**
 * Return a structured, actionable display message for a given bridge error type.
 * Falls back to UNKNOWN if the error type is not recognised.
 *
 * @param errorType - The error type string from the bridge / worker
 * @param fallbackMessage - Optional raw message from the bridge (used when type is missing)
 */
export function getErrorDisplay(
  errorType: string | null | undefined,
  fallbackMessage?: string
): ErrorDisplay {
  const key = (errorType ?? 'UNKNOWN') as BridgeErrorType;
  const display = ERROR_DISPLAY_MAP[key] ?? ERROR_DISPLAY_MAP.UNKNOWN;

  // If we have a specific raw message but no type match, fold it into the detail
  if (!ERROR_DISPLAY_MAP[key] && fallbackMessage) {
    return {
      ...ERROR_DISPLAY_MAP.UNKNOWN,
      detail: fallbackMessage,
    };
  }

  return display;
}
