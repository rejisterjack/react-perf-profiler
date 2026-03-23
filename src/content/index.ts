/**
 * Content Script - Main entry point
 * Injects the bridge script, listens for messages, and communicates with background script
 */

import type { BridgeMessage, BackgroundMessage } from './types';

// Bridge script URL (must match web_accessible_resources in manifest)
const BRIDGE_SCRIPT_URL = chrome.runtime.getURL('bridge.js');

// State
let port: chrome.runtime.Port | null = null;
let isBridgeInjected = false;
let bridgeInitState: 'pending' | 'success' | 'failed' = 'pending';
let bridgeError: { type: string; message: string; recoverable: boolean } | null = null;
let bridgeRetryCount = 0;
const pendingMessages: unknown[] = [];

// Message source identifiers
const BRIDGE_SOURCE = 'react-perf-profiler-bridge';
const CONTENT_SOURCE = 'react-perf-profiler-content';

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the content script
 */
function init(): void {
  // Inject the bridge script into the page context
  injectBridgeScript();

  // Set up listener for messages from the injected bridge
  setupBridgeListener();

  // Connect to background service worker
  connectToBackground();

  // Handle cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

  // Handle visibility change (pause/resume)
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// =============================================================================
// Bridge Script Injection
// =============================================================================

/**
 * Inject the bridge script into the page context
 * This allows the bridge to access __REACT_DEVTOOLS_GLOBAL_HOOK__
 */
function injectBridgeScript(): void {
  if (isBridgeInjected) {
    return;
  }

  try {
    const script = document.createElement('script');
    script.src = BRIDGE_SCRIPT_URL;
    script.type = 'text/javascript';
    script.async = true;

    script.onload = () => {
      isBridgeInjected = true;
      bridgeInitState = 'pending';

      // Send any pending messages
      while (pendingMessages.length > 0) {
        const msg = pendingMessages.shift();
        sendToBridge(msg);
      }

      // Notify background that bridge was injected
      sendToBackground({
        type: 'BRIDGE_INJECTED',
        payload: { url: window.location.href },
      });
    };

    script.onerror = (error) => {
      bridgeInitState = 'failed';
      reportError('Failed to load bridge script', {
        type: 'SCRIPT_LOAD_ERROR',
        details: error instanceof ErrorEvent ? error.message : 'Unknown error',
      });
    };

    // Inject at document start for earliest access to React
    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(script);

      // Remove the script element after injection (the code will remain)
      // Use setTimeout to ensure script has loaded
      setTimeout(() => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }, 1000);
    } else {
      // Fallback: wait for document to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          const t = document.head || document.documentElement;
          if (t) t.appendChild(script);
        });
      }
    }
  } catch (error) {
    bridgeInitState = 'failed';
    reportError(
      'Failed to inject bridge script',
      {
        type: 'INJECTION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      }
    );
  }
}

// =============================================================================
// Bridge Communication
// =============================================================================

/**
 * Set up listener for messages from the injected bridge
 * Bridge -> Content Script communication via window.postMessage
 */
function setupBridgeListener(): void {
  window.addEventListener('message', handleBridgeMessage);
}

/**
 * Handle messages from the injected bridge
 */
function handleBridgeMessage(event: MessageEvent): void {
  // Security: Only accept messages from the same window
  if (event.source !== window) return;

  const message = event.data as BridgeMessage;

  // Check if it's a message from our bridge
  if (!message || typeof message !== 'object') return;
  if (message.source !== BRIDGE_SOURCE) return;
  if (!message.payload) return;

  const { type, data, error, errorType, recoverable, retryCount } = message.payload;

  // Handle bridge initialization states
  if (type === 'INIT' && data && typeof data === 'object' && 'success' in data) {
    bridgeInitState = 'success';
    bridgeError = null;
    bridgeRetryCount = 0;
  }

  // Handle bridge errors
  if (type === 'ERROR') {
    bridgeError = {
      type: errorType || 'UNKNOWN',
      message: error || 'Unknown error',
      recoverable: recoverable !== false,
    };

    if (bridgeInitState === 'pending') {
      bridgeInitState = 'failed';
    }

    // Forward error to background
    reportError(error || 'Bridge error', {
      type: errorType,
      recoverable,
      retryCount,
    });
  }

  // Handle retry scheduling
  if (type === 'RETRY_SCHEDULED') {
    bridgeRetryCount = retryCount || 0;
    sendToBackground({
      type: 'BRIDGE_RETRY_SCHEDULED',
      payload: {
        retryCount: message.payload.retryCount,
        maxRetries: message.payload.maxRetries,
        nextRetryIn: message.payload.nextRetryIn,
      },
    });
  }

  // Route message to background script
  switch (type) {
    case 'COMMIT':
      // Forward commit data to background
      sendToBackground({
        type: 'COMMIT_DATA',
        payload: data,
      });
      break;

    case 'INIT':
      // Forward to background
      sendToBackground({
        type: 'BRIDGE_INIT',
        payload: {
          ...(typeof data === 'object' && data !== null ? data : {}),
          url: window.location.href,
          state: bridgeInitState,
        },
      });
      break;

    case 'START':
      sendToBackground({
        type: 'PROFILING_STARTED',
        payload: data,
      });
      break;

    case 'STOP':
      sendToBackground({
        type: 'PROFILING_STOPPED',
        payload: data,
      });
      break;

    case 'DETECT_RESULT':
      sendToBackground({
        type: 'REACT_DETECT_RESULT',
        payload: data,
      });
      break;

    case 'ERROR':
      // Already handled above
      break;
  }
}

/**
 * Send message to the injected bridge
 * Content Script -> Bridge via window.postMessage
 */
function sendToBridge(payload: unknown): void {
  const message = {
    source: CONTENT_SOURCE,
    payload,
  };

  if (!isBridgeInjected) {
    // Queue message until bridge is ready
    pendingMessages.push(payload);
    return;
  }

  // Use window.location.origin for security, fallback to '*' only for file:// pages
  const targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;
  window.postMessage(message, targetOrigin);
}

// =============================================================================
// Background Communication
// =============================================================================

/**
 * Connect to background service worker
 * Content Script <-> Background communication
 */
function connectToBackground(): void {
  try {
    port = chrome.runtime.connect({ name: 'react-perf-profiler' });

    port.onMessage.addListener((message: BackgroundMessage) => {
      handleBackgroundMessage(message);
    });

    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      port = null;

      // Notify that connection was lost
      sendToBridge({
        type: 'BACKGROUND_DISCONNECTED',
        error: error?.message,
      });

      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (!port) {
          connectToBackground();
        }
      }, 1000);
    });

    // Send initial ping
    sendToBackground({
      type: 'PING',
      payload: { url: window.location.href },
    });
  } catch (_error) {
    // Ignore connection errors
  }
}

/**
 * Handle messages from background script
 */
function handleBackgroundMessage(message: BackgroundMessage): void {
  if (!message || !message.type) return;

  switch (message.type) {
    case 'START_PROFILING':
      sendToBridge({ type: 'START' });
      break;

    case 'STOP_PROFILING':
      sendToBridge({ type: 'STOP' });
      break;

    case 'PING':
      // Respond to keep connection alive
      sendToBackground({
        type: 'PONG',
        payload: { 
          active: true, 
          bridgeState: bridgeInitState,
          bridgeError,
        },
      });
      break;

    case 'DETECT_REACT':
      // Forward to bridge
      sendToBridge({ type: 'DETECT_REACT' });
      break;

    case 'FORCE_INIT':
      // Force re-initialization
      bridgeInitState = 'pending';
      bridgeError = null;
      sendToBridge({ type: 'FORCE_INIT' });
      break;

    case 'GET_BRIDGE_STATUS':
      sendToBackground({
        type: 'BRIDGE_STATUS',
        payload: {
          state: bridgeInitState,
          error: bridgeError,
          retryCount: bridgeRetryCount,
          isInjected: isBridgeInjected,
          reactDetected: checkReactAvailability(),
        },
      });
      break;

    default:
  }
}

/**
 * Send message to background script
 */
function sendToBackground(message: Omit<BackgroundMessage, 'tabId'>): void {
  if (!port) {
    return;
  }

  try {
    port.postMessage(message);
  } catch (_error) {
    // Ignore post message errors
  }
}

/**
 * Report an error to the background script
 */
function reportError(
  error: string,
  context?: { type?: string; details?: string; recoverable?: boolean; retryCount?: number }
): void {
  sendToBackground({
    type: 'ERROR',
    error,
    payload: { 
      url: window.location.href,
      errorType: context?.type,
      errorDetails: context?.details,
      recoverable: context?.recoverable,
      retryCount: context?.retryCount,
    },
  });
}

// =============================================================================
// Event Handlers
// =============================================================================

/**
 * Handle visibility change events
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    // Page is hidden, could pause profiling here
  } else {
    // Page is visible again

    // Ensure connection is alive
    if (!port) {
      connectToBackground();
    }

    // Check bridge status and re-init if needed
    if (bridgeInitState === 'failed' && bridgeError?.recoverable) {
      sendToBridge({ type: 'FORCE_INIT' });
    }
  }
}

/**
 * Clean up resources on disconnect/unload
 */
function cleanup(): void {
  // Remove event listeners
  window.removeEventListener('message', handleBridgeMessage);
  window.removeEventListener('beforeunload', cleanup);
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  // Disconnect from background
  if (port) {
    try {
      port.disconnect();
    } catch (_e) {
      // Ignore disconnect errors
    }
    port = null;
  }

  // Send cleanup message to bridge
  sendToBridge({ type: 'STOP' });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if React is available on the page
 */
function checkReactAvailability(): boolean {
  return !!(
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
    window.React ||
    document.querySelector('[data-reactroot]') ||
    document.querySelector('[data-reactid]')
  );
}

/**
 * Get detailed React detection information
 */
function getReactDetectionDetails(): {
  available: boolean;
  devtoolsHook: boolean;
  reactGlobal: boolean;
  reactRoot: boolean;
  bridgeState: string;
  error: typeof bridgeError;
} {
  return {
    available: checkReactAvailability(),
    devtoolsHook: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
    reactGlobal: !!window.React,
    reactRoot: !!document.querySelector('[data-reactroot]'),
    bridgeState: bridgeInitState,
    error: bridgeError,
  };
}

// =============================================================================
// Setup
// =============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Also try to initialize immediately (for document_start)
try {
  init();
} catch (_e) {
  // Ignore errors, will retry on DOMContentLoaded
}

// Export for testing
export {
  init,
  injectBridgeScript,
  setupBridgeListener,
  connectToBackground,
  sendToBridge,
  sendToBackground,
  cleanup,
  checkReactAvailability,
  getReactDetectionDetails,
};
