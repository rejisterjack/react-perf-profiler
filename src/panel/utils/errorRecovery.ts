/**
 * Error Recovery Utilities
 * Functions for recovering from errors and managing panel state
 */

import { logger } from '@/shared/logger';
import { TIME_DURATION } from '@/shared/constants';

// =============================================================================
// Types
// =============================================================================

export interface ErrorReport {
  /** The error message */
  message: string;
  /** The error stack trace */
  stack?: string;
  /** The component stack from React */
  componentStack?: string;
  /** Timestamp when the error occurred */
  timestamp: number;
  /** User agent string */
  userAgent: string;
  /** Extension version */
  version: string;
  /** Error ID for tracking */
  errorId?: string;
  /** Context where the error occurred */
  context?: string;
}

export interface BridgeError {
  /** Error type */
  type: 'INIT_FAILED' | 'REACT_NOT_FOUND' | 'DEVTOOLS_NOT_FOUND' | 'TIMEOUT' | 'UNKNOWN';
  /** Error message */
  message: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Suggested action for the user */
  suggestedAction?: string;
  /** URL to help documentation */
  helpUrl?: string;
}

// =============================================================================
// Constants
// =============================================================================

const EXTENSION_VERSION = '1.0.0';
const STORAGE_PREFIX = 'react-perf-profiler:';

// =============================================================================
// Storage Keys to Clear
// =============================================================================

const STORAGE_KEYS = [
  'commits',
  'componentData',
  'wastedRenderReports',
  'performanceScore',
  'settings',
  'uiState',
] as const;

// =============================================================================
// Public Functions
// =============================================================================

/**
 * Clears all stored data from the panel.
 * This removes all profiler data from storage but preserves settings.
 * Use this when the panel is in a corrupted state.
 */
export function clearPanelData(): void {
  try {
    // Clear session storage (current session data)
    for (const key of STORAGE_KEYS) {
      const fullKey = `${STORAGE_PREFIX}${key}`;
      try {
        sessionStorage.removeItem(fullKey);
      } catch {
        // Ignore errors for individual keys
      }
    }

    // Clear any temporary state from stores
    logger.info('Panel data cleared successfully', { source: 'ErrorRecovery' });
  } catch (error) {
    logger.error('Failed to clear panel data', { 
      error: error instanceof Error ? error.message : String(error),
      source: 'ErrorRecovery' 
    });
  }
}

/**
 * Clears all settings from storage.
 * This removes user preferences and UI state.
 */
export function clearSettings(): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}settings`);
    logger.info('Settings cleared successfully', { source: 'ErrorRecovery' });
  } catch (error) {
    logger.error('Failed to clear settings', { 
      error: error instanceof Error ? error.message : String(error),
      source: 'ErrorRecovery' 
    });
  }
}

/**
 * Reloads the DevTools panel.
 * This is the primary recovery method when an error occurs.
 * It reloads the panel window, clearing any corrupted React state.
 */
export function reloadPanel(): void {
  try {
    logger.info('Reloading panel...', { source: 'ErrorRecovery' });
    
    // Attempt to reload the panel window
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  } catch (error) {
    logger.error('Failed to reload panel', { 
      error: error instanceof Error ? error.message : String(error),
      source: 'ErrorRecovery' 
    });
    
    // Fallback: try to inform the user
    alert('Failed to reload the panel. Please close and reopen DevTools.');
  }
}

/**
 * Hard reset of the panel - clears all data and reloads.
 * Use this as a last resort when the panel is completely unresponsive.
 */
export function hardReset(): void {
  try {
    logger.warn('Performing hard reset...', { source: 'ErrorRecovery' });
    
    // Clear all data first
    clearPanelData();
    clearSettings();
    
    // Then reload
    reloadPanel();
  } catch (error) {
    logger.error('Hard reset failed', { 
      error: error instanceof Error ? error.message : String(error),
      source: 'ErrorRecovery' 
    });
  }
}

/**
 * Reset the panel - clears data and reloads.
 * Alias for hardReset for better API naming.
 */
export function resetPanel(): void {
  hardReset();
}

/**
 * Sends error information to analytics.
 * This is a stub implementation - in production, replace with actual analytics.
 * 
 * @param error - The error that was caught
 * @param errorInfo - React error info containing component stack and context
 */
export function reportError(
  error: Error,
  errorInfo?: { 
    componentStack?: string;
    context?: string;
    errorId?: string;
  }
): void {
  try {
    const report: ErrorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      version: EXTENSION_VERSION,
      errorId: errorInfo?.errorId,
      context: errorInfo?.context,
    };

    // Log for debugging
    logger.error('Error Report', {
      ...report,
      errorName: error.name,
      source: 'ErrorRecovery',
    });

    // TODO: Implement actual analytics reporting
    // Examples:
    // - Send to error tracking service (Sentry, LogRocket, etc.)
    // - Send to custom analytics endpoint
    // - Store locally for debugging

    // Store last error in session storage for debugging
    try {
      sessionStorage.setItem(
        `${STORAGE_PREFIX}last-error`,
        JSON.stringify(report)
      );
    } catch {
      // Ignore storage errors
    }

  } catch (reportingError) {
    // Don't let error reporting fail
    logger.error('Failed to report error', { 
      error: reportingError instanceof Error ? reportingError.message : String(reportingError),
      source: 'ErrorRecovery' 
    });
  }
}

/**
 * Retrieves the last error that was reported.
 * Useful for debugging after a panel reload.
 */
export function getLastError(): ErrorReport | null {
  try {
    const stored = sessionStorage.getItem(`${STORAGE_PREFIX}last-error`);
    if (stored) {
      return JSON.parse(stored) as ErrorReport;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

/**
 * Clears the stored last error.
 */
export function clearLastError(): void {
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}last-error`);
  } catch {
    // Ignore errors
  }
}

/**
 * Checks if the panel is in a potentially corrupted state.
 * This can be used to proactively warn users or suggest a reload.
 */
export function checkPanelHealth(): { healthy: boolean; issues: string[] } {
  const issues: string[] = [];

  try {
    // Check if React is available
    if (typeof window === 'undefined' || !window.document) {
      issues.push('Window or document not available');
    }

    // Check for memory issues (simple heuristic)
    if (performance && 'memory' in performance) {
      const memory = (performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (memory && memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
        issues.push('Memory usage is very high');
      }
    }

    // Check if last error was recent (within last 5 minutes)
    const lastError = getLastError();
    if (lastError && Date.now() - lastError.timestamp < TIME_DURATION.FIVE_MINUTES) {
      issues.push('Recent error detected');
    }

  } catch {
    issues.push('Health check failed');
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

/**
 * Creates a bridge error object with helpful context.
 * 
 * @param type - The type of bridge error
 * @param message - The error message
 * @param context - Additional context
 */
export function createBridgeError(
  type: BridgeError['type'],
  message: string,
  context?: { reactDetected?: boolean; devtoolsDetected?: boolean; retryCount?: number }
): BridgeError {
  const error: BridgeError = {
    type,
    message,
    recoverable: type !== 'UNKNOWN',
  };

  // Add suggested actions based on error type
  switch (type) {
    case 'REACT_NOT_FOUND':
      error.suggestedAction = 'Make sure this page is using a React development build';
      error.helpUrl = 'https://react.dev/learn/thinking-in-react';
      break;
    case 'DEVTOOLS_NOT_FOUND':
      error.suggestedAction = 'Install React DevTools extension to use React Perf Profiler';
      error.helpUrl = 'https://react.dev/learn/react-developer-tools';
      break;
    case 'INIT_FAILED':
      error.suggestedAction = context?.retryCount && context.retryCount < 3
        ? 'Retrying connection...'
        : 'Try reloading the page or restarting DevTools';
      break;
    case 'TIMEOUT':
      error.suggestedAction = 'The connection timed out. Check if the page is still loading.';
      break;
  }

  return error;
}

/**
 * Format an error for display to the user.
 * 
 * @param error - The error to format
 */
export function formatErrorForDisplay(error: Error | BridgeError | string): string {
  if (typeof error === 'string') {
    return error;
  }

  if ('type' in error && ['INIT_FAILED', 'REACT_NOT_FOUND', 'DEVTOOLS_NOT_FOUND', 'TIMEOUT', 'UNKNOWN'].includes(error.type)) {
    // It's a BridgeError
    const bridgeError = error as BridgeError;
    let display = bridgeError.message;
    if (bridgeError.suggestedAction) {
      display += `\n\n${bridgeError.suggestedAction}`;
    }
    return display;
  }

  // Regular Error
  return (error as Error).message;
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  clearPanelData,
  clearSettings,
  reloadPanel,
  hardReset,
  resetPanel,
  reportError,
  getLastError,
  clearLastError,
  checkPanelHealth,
  createBridgeError,
  formatErrorForDisplay,
};
