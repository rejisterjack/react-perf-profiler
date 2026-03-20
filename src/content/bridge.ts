/**
 * Injected Bridge Script
 * This script is injected into the page context to access __REACT_DEVTOOLS_GLOBAL_HOOK__
 * It intercepts React commits and sends data to the content script via postMessage
 */

import type { BridgeMessage } from './types';
import type { FiberRoot } from './ReactInternals';
import { parseFiberRoot, getReactVersion } from './fiberParser';

// Store original hook methods
let originalOnCommitFiberRoot:
  | ((rendererID: number, root: FiberRoot, priorityLevel: number) => void)
  | null = null;
let isProfiling = false;
let reactVersion: string | undefined;

// Message source identifier
const BRIDGE_SOURCE = 'react-perf-profiler-bridge';

/**
 * Initialize the bridge
 * Injects into React DevTools hook and sets up profiling
 */
function initBridge(): void {
  // Check for React DevTools hook
  const hook = getReactDevToolsHook();

  if (!hook) {
    // Set up a listener to detect when React is loaded
    const checkInterval = setInterval(() => {
      const h = getReactDevToolsHook();
      if (h) {
        clearInterval(checkInterval);
        setupHookInterception(h);
      }
    }, 500);

    // Stop checking after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!hook) {
        sendMessage({
          type: 'ERROR',
          error: 'React DevTools hook not found within timeout. Is React loaded?',
        });
      }
    }, 30000);

    return;
  }

  setupHookInterception(hook);
}

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
  hook.onCommitFiberRoot = (
    rendererID: number,
    root: FiberRoot,
    priorityLevel: number
  ): void => {
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

      // Send to content script
      sendMessage({
        type: 'COMMIT',
        data: commitData,
      });
    } catch (error) {
      sendMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : String(error),
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

/**
 * Send a message to the content script
 */
function sendMessage(payload: BridgeMessage['payload']): void {
  if (typeof window === 'undefined') return;

  const message: BridgeMessage = {
    source: BRIDGE_SOURCE,
    payload,
  };

  window.postMessage(message, '*');
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
        },
      });
      break;

    default:
    // Ignore unknown message types
  }
}

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

/**
 * Check if React is present on the page
 */
function detectReact(): boolean {
  // Check for React DevTools hook
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    return true;
  }

  // Check for React in various ways
  const indicators = [
    () => window.React,
    () => window.__REACT__,
    () => document.querySelector('[data-reactroot]'),
    () => document.querySelector('[data-reactid]'),
    () => {
      // Check for react root containers
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
    },
  ];

  for (const check of indicators) {
    try {
      if (check()) return true;
    } catch (_e) {
      // Ignore errors
    }
  }

  return false;
}

/**
 * Clean up event listeners and restore original hooks
 */
function cleanup(): void {
  // Restore original hook
  const hook = getReactDevToolsHook();
  if (hook && originalOnCommitFiberRoot) {
    hook.onCommitFiberRoot = originalOnCommitFiberRoot;
  }

  // Remove message listener
  window.removeEventListener('message', handleBridgeMessage);

  // Reset state
  isProfiling = false;
  window.__REACT_PERF_PROFILER_ACTIVE__ = false;
}

// Set up message listener for commands from content script
window.addEventListener('message', handleBridgeMessage);

// Initialize the bridge
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBridge);
} else {
  initBridge();
}

// Detect if React is present
if (!detectReact()) {
  // Set up a listener to detect React when it's loaded
  const observer = new MutationObserver(() => {
    if (detectReact()) {
      observer.disconnect();
      initBridge();
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });

  // Stop observing after 10 seconds
  setTimeout(() => observer.disconnect(), 10000);
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);

// Expose cleanup for testing
window.__REACT_PERF_PROFILER_CLEANUP__ = cleanup;

// Export for module usage (if needed)
export {
  initBridge,
  startProfiling,
  stopProfiling,
  cleanup,
  detectReact,
  sendMessage,
  handleBridgeMessage,
};
