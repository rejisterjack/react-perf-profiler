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
const pendingMessages: any[] = [];

// Message source identifiers
const BRIDGE_SOURCE = 'react-perf-profiler-bridge';
const CONTENT_SOURCE = 'react-perf-profiler-content';

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

      // Send any pending messages
      while (pendingMessages.length > 0) {
        const msg = pendingMessages.shift();
        sendToBridge(msg);
      }
    };

    script.onerror = (_error) => {
      reportError('Failed to load bridge script');
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
  } catch (_error) {
    reportError('Failed to inject bridge script');
  }
}

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

  const { type, data, error } = message.payload;

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
        type: 'INIT',
        payload: data,
      });
      break;

    case 'ERROR':
      reportError(error || 'Unknown bridge error');
      break;

    case 'START':
      break;

    case 'STOP':
      break;

    default:
  }
}

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
      port = null;

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
        type: 'PING',
        payload: { active: true },
      });
      break;

    default:
  }
}

/**
 * Send message to the injected bridge
 * Content Script -> Bridge via window.postMessage
 */
function sendToBridge(payload: any): void {
  const message = {
    source: CONTENT_SOURCE,
    payload,
  };

  if (!isBridgeInjected) {
    // Queue message until bridge is ready
    pendingMessages.push(payload);
    return;
  }

  window.postMessage(message, '*');
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
  }
}

/**
 * Report an error to the background script
 */
function reportError(error: string): void {
  sendToBackground({
    type: 'ERROR',
    error,
    payload: { url: window.location.href },
  });
}

/**
 * Handle visibility change events
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
  } else {

    // Ensure connection is alive
    if (!port) {
      connectToBackground();
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

/**
 * Check if React is available on the page
 */
function checkReactAvailability(): boolean {
  return !!(
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
    (window as any).React ||
    document.querySelector('[data-reactroot]') ||
    document.querySelector('[data-reactid]')
  );
}

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
};
