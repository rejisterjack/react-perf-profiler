/**
 * Injected Bridge Script
 * This script is injected into the page context to access __REACT_DEVTOOLS_GLOBAL_HOOK__
 * It intercepts React commits and sends data to the content script via postMessage
 */

import { getReactVersion, parseFiberRoot } from './fiberParser';
import type { FiberRoot } from './ReactInternals';
import type { BridgeMessage } from './types';

// Store original hook methods
let originalOnCommitFiberRoot:
  | ((rendererID: number, root: FiberRoot, priorityLevel: number) => void)
  | null = null;
let isProfiling = false;
let reactVersion: string | undefined;

// Rate limiting for commit messages — prevents flooding on animation-heavy pages
/** Max one commit message per window; excess commits are coalesced into the next flush */
const COMMIT_THROTTLE_MS = 50;
let lastCommitTime = 0;
let pendingCommitData: ReturnType<typeof parseFiberRoot> | null = null;
let commitThrottleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Send a commit, throttling to at most one per COMMIT_THROTTLE_MS.
 * If a commit arrives during the cooldown the most recent one is buffered
 * and flushed when the timer fires — so no commit is silently dropped.
 */
function sendThrottledCommit(commitData: ReturnType<typeof parseFiberRoot>): void {
  const now = Date.now();
  const elapsed = now - lastCommitTime;

  if (elapsed >= COMMIT_THROTTLE_MS) {
    // Outside throttle window — send immediately
    lastCommitTime = now;
    pendingCommitData = null;
    if (commitThrottleTimer !== null) {
      clearTimeout(commitThrottleTimer);
      commitThrottleTimer = null;
    }
    sendMessage({ type: 'COMMIT', data: commitData });
  } else {
    // Within throttle window — buffer and schedule a flush
    pendingCommitData = commitData;
    if (commitThrottleTimer === null) {
      commitThrottleTimer = setTimeout(() => {
        commitThrottleTimer = null;
        if (pendingCommitData !== null) {
          lastCommitTime = Date.now();
          const toSend = pendingCommitData;
          pendingCommitData = null;
          sendMessage({ type: 'COMMIT', data: toSend });
        }
      }, COMMIT_THROTTLE_MS - elapsed);
    }
  }
}

// Retry state
let initRetryCount = 0;
let initRetryTimeout: ReturnType<typeof setTimeout> | null = null;
let initCheckInterval: ReturnType<typeof setInterval> | null = null;
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 500;

// Constants for exponential backoff retry logic
/** Maximum delay between retries (30 seconds) */
const MAX_RETRY_DELAY_MS = 30000;
/** Base for exponential backoff calculation (2^n) */
const BACKOFF_EXPONENT_BASE = 2;

// Bridge state
let isInitialized = false;
let lastError: { type: string; message: string; timestamp: number } | null = null;

// Message source identifier
const BRIDGE_SOURCE = 'react-perf-profiler-bridge';

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the bridge
 * Injects into React DevTools hook and sets up profiling
 */
function initBridge(): void {
  // Prevent double initialization
  if (isInitialized) {
    return;
  }

  // Check for React DevTools hook
  const hook = getReactDevToolsHook();

  if (!hook) {
    handleInitFailure('DEVTOOLS_NOT_FOUND');
    return;
  }

  try {
    setupHookInterception(hook);
    isInitialized = true;
    initRetryCount = 0;
    lastError = null;

    // Send initialization success message
    sendMessage({
      type: 'INIT',
      data: {
        reactVersion,
        supportsFiber: hook.supportsFiber,
        rendererCount: hook.renderers?.size ?? 0,
        success: true,
      },
    });
  } catch (error) {
    handleInitFailure('INIT_FAILED', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Handle initialization failure with retry logic
 */
function handleInitFailure(reason: 'DEVTOOLS_NOT_FOUND' | 'INIT_FAILED', details?: string): void {
  const timestamp = Date.now();

  // Store error info
  lastError = {
    type: reason,
    message: details || getErrorMessageForReason(reason),
    timestamp,
  };

  // Send error to content script
  sendMessage({
    type: 'ERROR',
    error: lastError.message,
    errorType: reason,
    recoverable: initRetryCount < MAX_RETRY_ATTEMPTS,
    retryCount: initRetryCount,
  });

  // Try to detect React for better error messages
  const reactDetected = detectReact();
  const devtoolsDetected = !!getReactDevToolsHook();

  // If React is detected but DevTools hook is not, it might be coming soon
  if (reactDetected && !devtoolsDetected && initRetryCount < MAX_RETRY_ATTEMPTS) {
    scheduleRetry();
  } else if (!reactDetected) {
    // No React detected - don't retry
    sendMessage({
      type: 'ERROR',
      error: 'React not detected on this page. Make sure you are using a React development build.',
      errorType: 'REACT_NOT_FOUND',
      recoverable: false,
    });
  }
}

/**
 * Get user-friendly error message for failure reason
 */
function getErrorMessageForReason(reason: 'DEVTOOLS_NOT_FOUND' | 'INIT_FAILED'): string {
  switch (reason) {
    case 'DEVTOOLS_NOT_FOUND':
      return 'React DevTools hook not found. Is React loaded?';
    case 'INIT_FAILED':
      return 'Failed to initialize React Perf Profiler bridge';
    default:
      return 'Unknown initialization error';
  }
}

/**
 * Schedule a retry with exponential backoff
 */
function scheduleRetry(): void {
  // Clear any existing retry timeout
  if (initRetryTimeout) {
    clearTimeout(initRetryTimeout);
  }

  initRetryCount++;

  // Calculate delay with exponential backoff: min(MAX_RETRY_DELAY, BASE^retryCount * INITIAL_DELAY)
  const exponentialDelay = BACKOFF_EXPONENT_BASE ** initRetryCount * INITIAL_RETRY_DELAY;
  const delay = Math.min(MAX_RETRY_DELAY_MS, exponentialDelay);

  sendMessage({
    type: 'RETRY_SCHEDULED',
    retryCount: initRetryCount,
    maxRetries: MAX_RETRY_ATTEMPTS,
    nextRetryIn: delay,
  });

  initRetryTimeout = setTimeout(() => {
    initBridge();
  }, delay);
}

/**
 * Cancel any pending retry
 */
function cancelRetry(): void {
  if (initRetryTimeout) {
    clearTimeout(initRetryTimeout);
    initRetryTimeout = null;
  }
  if (initCheckInterval) {
    clearInterval(initCheckInterval);
    initCheckInterval = null;
  }
}

// =============================================================================
// Hook Management
// =============================================================================

/**
 * Get the React DevTools global hook
 */
function getReactDevToolsHook() {
  if (typeof window === 'undefined') return null;
  return window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || null;
}

/**
 * Set up interception of the React DevTools hook
 */
function setupHookInterception(hook: NonNullable<ReturnType<typeof getReactDevToolsHook>>): void {
  reactVersion = getReactVersion();

  // Store original method
  if (hook.onCommitFiberRoot) {
    originalOnCommitFiberRoot = hook.onCommitFiberRoot.bind(hook);
  }

  // Wrap the onCommitFiberRoot method
  hook.onCommitFiberRoot = (rendererID: number, root: FiberRoot, priorityLevel: number): void => {
    // Call original first
    if (originalOnCommitFiberRoot) {
      try {
        originalOnCommitFiberRoot(rendererID, root, priorityLevel);
      } catch (_e) {
        // Ignore errors from original handler
      }
    }

    // Only process if profiling is active
    if (!isProfiling) return;

    try {
      // Extract fiber data from the root
      const current = root?.current;
      if (!current) {
        return;
      }

      // Parse the fiber tree
      const commitData = parseFiberRoot(current, priorityLevel);
      commitData.reactVersion = reactVersion;

      // Send to content script (throttled to prevent flooding)
      sendThrottledCommit(commitData);
    } catch (error) {
      sendMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : String(error),
        errorType: 'PARSE_ERROR',
        recoverable: true,
      });
    }
  };

  // Send initialization message
  sendMessage({
    type: 'INIT',
    data: {
      reactVersion,
      supportsFiber: hook.supportsFiber,
      rendererCount: hook.renderers?.size ?? 0,
    },
  });
}

// =============================================================================
// Message Handling
// =============================================================================

/**
 * Send a message to the content script
 */
function sendMessage(payload: BridgeMessage['payload']): void {
  if (typeof window === 'undefined') return;

  const message: BridgeMessage = {
    source: BRIDGE_SOURCE,
    payload,
  };

  // Use the page's own origin to prevent cross-origin eavesdropping.
  // Falls back to '*' only for file:// pages where origin is 'null'.
  const targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;
  window.postMessage(message, targetOrigin);
}

/**
 * Handle messages from the content script
 */
function handleBridgeMessage(event: MessageEvent): void {
  // Only accept messages from our content script
  if (event.source !== window) return;

  const data = event.data;

  // Check if it's a message for us
  if (!data || typeof data !== 'object') return;
  if (data.source !== 'react-perf-profiler-content') return;
  if (!data.payload) return;

  const { type } = data.payload;

  switch (type) {
    case 'START':
      startProfiling();
      break;

    case 'STOP':
      stopProfiling();
      break;

    case 'PING':
      // Respond to ping to confirm bridge is alive
      sendMessage({
        type: 'INIT',
        data: {
          isProfiling,
          reactVersion,
          isInitialized,
          lastError: lastError?.message,
        },
      });
      break;

    case 'DETECT_REACT':
      // Manual detection request
      sendMessage({
        type: 'DETECT_RESULT',
        reactDetected: detectReact(),
        devtoolsDetected: !!getReactDevToolsHook(),
        isInitialized,
      });
      break;

    case 'FORCE_INIT':
      // Force re-initialization
      cancelRetry();
      initRetryCount = 0;
      initBridge();
      break;

    default:
    // Ignore unknown message types
  }
}

// =============================================================================
// Profiling Control
// =============================================================================

/**
 * Start profiling
 */
function startProfiling(): void {
  if (isProfiling) {
    return;
  }

  isProfiling = true;
  window.__REACT_PERF_PROFILER_ACTIVE__ = true;

  sendMessage({
    type: 'START',
    data: { timestamp: Date.now() },
  });
}

/**
 * Stop profiling
 */
function stopProfiling(): void {
  if (!isProfiling) {
    return;
  }

  isProfiling = false;
  window.__REACT_PERF_PROFILER_ACTIVE__ = false;

  sendMessage({
    type: 'STOP',
    data: { timestamp: Date.now() },
  });
}

// =============================================================================
// React Detection
// =============================================================================

/**
 * Check if React is present on the page
 * Optimized to avoid O(n) DOM queries on large pages
 */
function detectReact(): boolean {
  // Check for React DevTools hook (preferred method - fastest)
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    return true;
  }

  // Check for React global (second fastest)
  if (window.React || window.__REACT__) {
    return true;
  }

  // Check for React root markers (single query)
  if (document.querySelector('[data-reactroot], [data-reactid]')) {
    return true;
  }

  // Check for react root containers (limited query)
  const rootElements = document.querySelectorAll(
    '[id="root"], [id="app"], [id="__next"], [id="__nuxt"]'
  );
  for (let i = 0; i < Math.min(rootElements.length, 5); i++) {
    const el = rootElements[i] as {
      _reactRootContainer?: unknown;
      __reactContainer$?: unknown;
    };
    if (el._reactRootContainer || el.__reactContainer$) {
      return true;
    }
  }

  // Check for React-specific properties on a limited set of elements
  // Limit to first 100 elements to avoid O(n) performance issue
  const candidateSelectors = [
    '#root > *',
    '#app > *',
    'body > div',
    '[data-reactroot]',
    '[data-reactid]',
  ];
  
  for (const selector of candidateSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < Math.min(elements.length, 20); i++) {
        const el = elements[i];
        if (!el) continue;
        const keys = Object.keys(el);
        if (keys.some((k) => k.startsWith('__react') || k.startsWith('_react'))) {
          return true;
        }
      }
    } catch {
      // Ignore invalid selectors
    }
  }

  return false;
}

/**
 * Get detailed React detection info
 */
function getReactDetectionInfo(): {
  detected: boolean;
  devtoolsHook: boolean;
  reactGlobal: boolean;
  reactRoot: boolean;
  reactId: boolean;
  rootContainer: boolean;
} {
  return {
    detected: detectReact(),
    devtoolsHook: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
    reactGlobal: !!window.React,
    reactRoot: !!document.querySelector('[data-reactroot]'),
    reactId: !!document.querySelector('[data-reactid]'),
    rootContainer: (() => {
      const rootElements = document.querySelectorAll(
        '[id^="root"], [id^="app"], [id^="__next"], [id^="__nuxt"]'
      );
      for (const el of rootElements) {
        const elWithReact = el as {
          _reactRootContainer?: unknown;
          __reactContainer$?: unknown;
        };
        if (elWithReact._reactRootContainer || elWithReact.__reactContainer$) {
          return true;
        }
      }
      return false;
    })(),
  };
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clean up event listeners and restore original hooks
 */
function cleanup(): void {
  // Cancel any pending retries
  cancelRetry();

  // Stop the React-watcher observer if still running
  stopReactWatcher();

  // Restore original hook
  const hook = getReactDevToolsHook();
  if (hook && originalOnCommitFiberRoot) {
    hook.onCommitFiberRoot = originalOnCommitFiberRoot;
  }

  // Remove message listener
  window.removeEventListener('message', handleBridgeMessage);

  // Reset state
  isProfiling = false;
  isInitialized = false;
  window.__REACT_PERF_PROFILER_ACTIVE__ = false;
}

// =============================================================================
// Setup
// =============================================================================

// Set up message listener for commands from content script
window.addEventListener('message', handleBridgeMessage);

// Initialize the bridge
function tryInit(): void {
  try {
    initBridge();
  } catch (error) {
    handleInitFailure('INIT_FAILED', error instanceof Error ? error.message : String(error));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryInit);
} else {
  tryInit();
}

// Detect if React is present but not yet initialized
let _reactWatchObserver: MutationObserver | null = null;
let _reactWatchTimer: ReturnType<typeof setTimeout> | null = null;

function stopReactWatcher(): void {
  if (_reactWatchTimer !== null) {
    clearTimeout(_reactWatchTimer);
    _reactWatchTimer = null;
  }
  if (_reactWatchObserver !== null) {
    _reactWatchObserver.disconnect();
    _reactWatchObserver = null;
  }
}

if (!isInitialized) {
  _reactWatchObserver = new MutationObserver(() => {
    if (!isInitialized && detectReact() && getReactDevToolsHook()) {
      stopReactWatcher();
      tryInit();
    }
  });

  _reactWatchObserver.observe(document, { childList: true, subtree: true });

  // Hard stop after 10 seconds regardless
  _reactWatchTimer = setTimeout(stopReactWatcher, 10000);
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);

// Expose cleanup for testing
window.__REACT_PERF_PROFILER_CLEANUP__ = cleanup;
window.__REACT_PERF_PROFILER_DETECT_REACT__ = detectReact;

// Export for module usage (if needed)
export {
  cancelRetry,
  cleanup,
  detectReact,
  getReactDetectionInfo,
  handleBridgeMessage,
  initBridge,
  scheduleRetry,
  sendMessage,
  startProfiling,
  stopProfiling,
};
