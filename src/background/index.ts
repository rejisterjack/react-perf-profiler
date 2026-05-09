/**
 * React Perf Profiler - Background Service Worker
 * Main entry point for the Chrome extension background script
 * @module background
 */

import { MessageTypeEnum, PortNameEnum } from '@/shared/constants';
import { logger } from '@/shared/logger';
import type { PortType } from './types';
import { ConnectionManager } from './connectionManager';
import { MessageRouter } from './messageRouter';
import { SessionManager } from './sessionManager';
import { LogLevel } from './types';

// ============================================================================
// Global State
// ============================================================================

/** Extension version */
const EXTENSION_VERSION = '1.0.0';

/** Enable debug logging based on environment */
const ENABLE_DEBUG_LOG = import.meta.env.DEV;

// ============================================================================
// Manager Instances
// ============================================================================

/**
 * Connection manager instance
 * Manages all port connections between content scripts, DevTools, and popup
 */
let connectionManager: ConnectionManager;

/**
 * Session manager instance
 * Manages profiling sessions and data storage
 */
let sessionManager: SessionManager;

/**
 * Message router instance
 * Routes messages between different parts of the extension
 */
let messageRouter: MessageRouter;

// ============================================================================
// Logging Utilities
// ============================================================================

/**
 * Logs a message with the background script prefix
 * @param level - Log level
 * @param message - Log message
 * @param data - Optional data to log
 */
function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const logData = { source: 'background', timestamp: Date.now(), ...data };

  switch (level) {
    case LogLevel.DEBUG:
      if (ENABLE_DEBUG_LOG) {
        logger.debug(message, logData);
      }
      break;
    case LogLevel.INFO:
      logger.info(message, logData);
      break;
    case LogLevel.WARN:
      logger.warn(message, logData);
      break;
    case LogLevel.ERROR:
      logger.error(message, logData);
      break;
  }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the background service worker
 * Creates manager instances and sets up event listeners
 */
function initialize(): void {
  log(LogLevel.INFO, 'Initializing React Perf Profiler background service worker', {
    version: EXTENSION_VERSION,
    environment: import.meta.env.MODE,
  });

  try {
    // Initialize managers
    connectionManager = new ConnectionManager({ enableLogging: ENABLE_DEBUG_LOG }, console);

    sessionManager = new SessionManager(connectionManager, console, ENABLE_DEBUG_LOG);

    messageRouter = new MessageRouter(connectionManager, sessionManager, console, ENABLE_DEBUG_LOG);

    // Set up event listeners
    setupConnectionListeners();
    setupMessageListeners();
    setupLifecycleListeners();
    setupTabListeners();

    log(LogLevel.INFO, 'Background service worker initialized successfully');
  } catch (error) {
    log(LogLevel.ERROR, 'Failed to initialize background service worker', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Connection Event Listeners
// ============================================================================

/**
 * Sets up Chrome runtime connection listeners
 * Handles new connections from content scripts, DevTools, and popup
 */
function setupConnectionListeners(): void {
  chrome.runtime.onConnect.addListener((port) => {
    const portName = port.name;
    const tabId = getTabIdFromPort(port);

    log(LogLevel.INFO, 'New connection established', {
      portName,
      tabId,
    });

    // Determine port type from name
    const portType = getPortTypeFromName(portName);

    if (!portType) {
      log(LogLevel.WARN, 'Unknown port name, rejecting connection', {
        portName,
      });
      port.disconnect();
      return;
    }

    if (tabId === null) {
      log(LogLevel.ERROR, 'Could not determine tab ID from port', {
        portName,
      });
      port.disconnect();
      return;
    }

    // Connect the port
    const result = connectionManager.connectPort(tabId, portType, port);

    if (!result.success) {
      log(LogLevel.ERROR, 'Failed to connect port', {
        error: result.error,
        portName,
        tabId,
      });
      port.disconnect();
      return;
    }

    // Set up message handler for this port
    port.onMessage.addListener((message) => {
      handlePortMessage(tabId, portType, message);
    });

    // Set up disconnect handler
    port.onDisconnect.addListener(() => {
      handlePortDisconnect(tabId, portType);
    });
  });
}

/**
 * Gets the port type from the port name
 * @param portName - Chrome runtime port name
 * @returns Port type or null if unknown
 */
function getPortTypeFromName(portName: string): PortType | null {
  // Check for exact matches first
  switch (portName) {
    case PortNameEnum.CONTENT_BACKGROUND:
      return 'content';
    case PortNameEnum.DEVTOOLS_BACKGROUND:
      return 'devtools';
    case PortNameEnum.POPUP_BACKGROUND:
      return 'popup';
    case PortNameEnum.PANEL_BACKGROUND:
      return 'panel';
    default:
      // Check if it starts with any known prefix
      if (portName.startsWith(PortNameEnum.CONTENT_BACKGROUND)) return 'content';
      if (portName.startsWith(PortNameEnum.DEVTOOLS_BACKGROUND)) return 'devtools';
      if (portName.startsWith(PortNameEnum.POPUP_BACKGROUND)) return 'popup';
      if (portName.startsWith(PortNameEnum.PANEL_BACKGROUND)) return 'panel';
      return null;
  }
}

/**
 * Gets the tab ID from a port connection
 * @param port - Chrome runtime port
 * @returns Tab ID or null if not available
 */
function getTabIdFromPort(port: chrome.runtime.Port): number | null {
  // Try to get tab ID from port sender
  if (port.sender?.tab?.id !== undefined) {
    return port.sender.tab.id;
  }

  // For DevTools connections, tab ID might be in the port name
  // Format: devtools-background-{tabId}
  const parts = port.name.split('-');
  const lastPart = parts[parts.length - 1]!;
  const parsedTabId = Number.parseInt(lastPart, 10);

  if (!Number.isNaN(parsedTabId)) {
    return parsedTabId;
  }

  return null;
}

/**
 * Handles messages received on a port
 * @param tabId - Chrome tab ID
 * @param portType - Type of port that received the message
 * @param message - The received message
 */
function handlePortMessage(tabId: number, portType: PortType, message: unknown): void {
  log(LogLevel.DEBUG, 'Handling port message', {
    tabId,
    portType,
    message,
  });

  switch (portType) {
    case 'content':
      messageRouter.handleContentMessage(tabId, message);
      break;
    case 'devtools':
      messageRouter.handleDevtoolsMessage(tabId, message);
      break;
    case 'popup':
      messageRouter.handlePopupMessage(tabId, message);
      break;
    case 'panel':
      // Panel messages are routed through devtools handler
      messageRouter.handleDevtoolsMessage(tabId, message);
      break;
    default:
      log(LogLevel.WARN, 'Message from unknown port type', { portType });
  }
}

/**
 * Handles port disconnection
 * @param tabId - Chrome tab ID
 * @param portType - Type of port that disconnected
 */
function handlePortDisconnect(tabId: number, portType: PortType): void {
  log(LogLevel.INFO, 'Port disconnected', { tabId, portType });

  connectionManager.disconnectPort(tabId, portType);
}

// ============================================================================
// Message Listeners (one-time messages)
// ============================================================================

/**
 * Sets up Chrome runtime message listeners
 * Handles one-time messages that don't use ports
 */
function setupMessageListeners(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log(LogLevel.DEBUG, 'Received one-time message', { message, sender });

    // Handle specific message types that don't need persistent connections
    if (typeof message === 'object' && message !== null) {
      const msg = message as { type: string };

      switch (msg.type) {
        case MessageTypeEnum.PING:
          handlePingMessage(sendResponse);
          return true; // Keep channel open for async response

        case 'GET_VERSION':
          handleGetVersion(sendResponse);
          return true;

        case 'GET_ACTIVE_SESSIONS':
          handleGetActiveSessions(sendResponse);
          return true;

        default: {
          // For other messages, try to route them
          const tabId = sender.tab?.id;
          if (tabId !== undefined) {
            messageRouter.handleContentMessage(tabId, message);
            sendResponse({ success: true });
          } else {
            sendResponse({
              success: false,
              error: 'Could not determine tab ID',
            });
          }
          return false;
        }
      }
    }

    return false;
  });
}

/**
 * Handles ping message - used to check if background script is alive
 * @param sendResponse - Response callback
 */
function handlePingMessage(
  sendResponse: (response: { type: string; version: string; timestamp: number }) => void
): void {
  sendResponse({
    type: MessageTypeEnum.PONG,
    version: EXTENSION_VERSION,
    timestamp: Date.now(),
  });
}

/**
 * Handles get version message
 * @param sendResponse - Response callback
 */
function handleGetVersion(
  sendResponse: (response: { version: string; timestamp: number }) => void
): void {
  sendResponse({
    version: EXTENSION_VERSION,
    timestamp: Date.now(),
  });
}

/**
 * Handles get active sessions message
 * @param sendResponse - Response callback
 */
function handleGetActiveSessions(
  sendResponse: (response: {
    sessions: Array<{
      tabId: number;
      isProfiling: boolean;
      sessionStartTime: number | null;
      commitCount: number;
    }>;
  }) => void
): void {
  const connections = connectionManager.getAllConnections();
  const sessions = connections.map((conn) => ({
    tabId: conn.tabId,
    isProfiling: conn.isProfiling,
    sessionStartTime: conn.sessionStartTime,
    commitCount: conn.commitCount,
  }));

  sendResponse({ sessions });
}

// ============================================================================
// Lifecycle Listeners
// ============================================================================

/**
 * Sets up Chrome extension lifecycle listeners
 * Handles install, update, and startup events
 */
function setupLifecycleListeners(): void {
  // Extension installed or updated
  chrome.runtime.onInstalled.addListener((details) => {
    handleInstalled(details);
  });

  // Browser startup
  chrome.runtime.onStartup.addListener(() => {
    log(LogLevel.INFO, 'Browser startup');
  });

  // Message from external sources (optional)
  chrome.runtime.onMessageExternal?.addListener((message, sender, sendResponse) => {
    log(LogLevel.INFO, 'Received external message', { message, sender });
    sendResponse({ success: false, error: 'External messages not supported' });
    return false;
  });
}

/**
 * Handles extension installation or update
 * @param details - Installation details
 */
function handleInstalled(details: chrome.runtime.InstalledDetails): void {
  switch (details.reason) {
    case 'install':
      log(LogLevel.INFO, 'Extension installed', {
        version: EXTENSION_VERSION,
        previousVersion: details.previousVersion,
      });
      // Could open onboarding page here
      break;

    case 'update':
      log(LogLevel.INFO, 'Extension updated', {
        version: EXTENSION_VERSION,
        previousVersion: details.previousVersion,
      });
      // Could show changelog or migration notices here
      break;

    case 'chrome_update':
      log(LogLevel.INFO, 'Chrome updated');
      break;

    default:
      log(LogLevel.INFO, `Extension installed/updated: ${details.reason}`);
  }
}

// ============================================================================
// Tab Event Listeners
// ============================================================================

/**
 * Sets up Chrome tab event listeners
 * Handles tab removal and navigation for cleanup
 */
function setupTabListeners(): void {
  // Tab removed - clean up connection
  chrome.tabs.onRemoved.addListener((tabId) => {
    log(LogLevel.INFO, 'Tab removed, cleaning up connection', { tabId });
    connectionManager.cleanupConnection(tabId);
  });

  // Tab navigation - optional cleanup depending on requirements
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // If URL changed, we might want to clear profiling data
    if (changeInfo.url) {
      log(LogLevel.DEBUG, 'Tab URL changed', { tabId, url: changeInfo.url });

      const connection = connectionManager.getConnection(tabId);
      if (connection?.isProfiling) {
        // Optional: Stop profiling on navigation
        log(LogLevel.INFO, 'Stopping profiling due to navigation', { tabId });
        sessionManager.stopSession(tabId);

        // Notify all ports
        connectionManager.broadcastToAllPorts(tabId, {
          type: 'PROFILING_STOPPED',
          reason: 'navigation',
          timestamp: Date.now(),
        });
      }
    }
  });
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Global error handler for the background script
 */
self.addEventListener('error', (event) => {
  log(LogLevel.ERROR, 'Unhandled error in background script', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.toString(),
  });
});

/**
 * Global unhandled promise rejection handler
 */
self.addEventListener('unhandledrejection', (event) => {
  log(LogLevel.ERROR, 'Unhandled promise rejection in background script', {
    reason: event.reason,
  });
});

// ============================================================================
// Service Worker Keep-Alive (Manifest V3 — chrome.alarms based)
// ============================================================================

/**
 * Alarm name used to keep the service worker alive during profiling.
 * chrome.alarms fire even after the service worker has been terminated and
 * re-started, unlike setInterval which is cleared when the SW is unloaded.
 */
const KEEPALIVE_ALARM = 'perf-profiler-keepalive';

/** Storage key for persisting critical state across SW lifecycle */
const STATE_STORAGE_KEY = 'perf-profiler-sw-state';

/**
 * Minimum alarm period allowed by Chrome (in minutes).
 * Chrome clamps alarms to a minimum of 1 minute; we use the min so the
 * service worker wakes up every 20-30s via the alarm + the onAlarm handler.
 */
const KEEPALIVE_ALARM_PERIOD_MINUTES = 0.4; // ~24 seconds — Chrome clamps to ≥ 0.

// ============================================================================
// State Persistence (survives SW termination)
// ============================================================================

interface PersistedSWState {
  /** Whether any tab is currently profiling */
  activeProfilingTabs: number[];
  /** Extension version when state was saved */
  version: string;
}

/**
 * Persist critical state to chrome.storage.local so it survives
 * service worker termination (Firefox MV2 / Chrome MV3 lifecycle).
 */
function persistState(): void {
  const connections = connectionManager?.getAllConnections() ?? [];
  const activeProfilingTabs = connections
    .filter((conn) => conn.isProfiling)
    .map((conn) => conn.tabId);

  if (activeProfilingTabs.length > 0) {
    const state: PersistedSWState = {
      activeProfilingTabs,
      version: EXTENSION_VERSION,
    };
    chrome.storage.local.set({ [STATE_STORAGE_KEY]: state });
  } else {
    // No active profiling — clear persisted state
    chrome.storage.local.remove(STATE_STORAGE_KEY);
  }
}

/**
 * Restore critical state from chrome.storage.local after SW restart.
 * Called once during initialization.
 */
function restoreState(): void {
  chrome.storage.local.get(STATE_STORAGE_KEY, (result) => {
    const state = result[STATE_STORAGE_KEY] as PersistedSWState | undefined;
    if (!state?.activeProfilingTabs?.length) return;

    // Verify tabs still exist before re-arming keepalive
    chrome.tabs.query({}, (tabs) => {
      const activeTabIds = new Set(tabs.map((t) => t.id));
      const survivingTabs = state.activeProfilingTabs.filter((id) => activeTabIds.has(id));

      if (survivingTabs.length > 0) {
        log(LogLevel.INFO, 'Restored profiling state after SW restart', {
          tabCount: survivingTabs.length,
        });
        armKeepalive();
      }

      // Clean up stale persisted state
      persistState();
    });
  });
}

/**
 * Sets up chrome.alarms-based service worker keepalive for Manifest V3.
 *
 * Problem: MV3 service workers are terminated after ~30 s of inactivity.
 * setInterval() does NOT survive a service worker termination — once Chrome
 * kills the SW, the interval is gone. chrome.alarms wake the SW from a
 * terminated state, guaranteeing continuity during long recording sessions.
 */
function setupKeepAlive(): void {
  if (!chrome.alarms) {
    log(LogLevel.WARN, 'chrome.alarms API not available, skipping keepalive setup');
    return;
  }

  // Register the recurring alarm (no-op if already registered with same period)
  chrome.alarms.create(KEEPALIVE_ALARM, {
    periodInMinutes: KEEPALIVE_ALARM_PERIOD_MINUTES,
    delayInMinutes: KEEPALIVE_ALARM_PERIOD_MINUTES,
  });

  // Listen for the alarm — every firing wakes the SW from a dormant state
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== KEEPALIVE_ALARM) return;

    const connections = connectionManager?.getAllConnections() ?? [];
    const hasActiveProfiling = connections.some((conn) => conn.isProfiling);

    if (hasActiveProfiling) {
      log(LogLevel.DEBUG, 'Keepalive alarm: service worker woken for active profiling session');
      // Perform a lightweight no-op chrome API call to extend the SW lifetime
      chrome.runtime.getPlatformInfo(() => {
        // No-op: the API call itself extends the service worker's active window
      });
      // Persist state so we can recover if SW terminates between alarms
      persistState();
    } else {
      // No active sessions — clear the alarm to avoid unnecessary wake-ups
      chrome.alarms.clear(KEEPALIVE_ALARM);
      log(LogLevel.DEBUG, 'Keepalive alarm cleared — no active profiling sessions');
      persistState();
    }
  });

  log(LogLevel.INFO, 'MV3 chrome.alarms keepalive registered', {
    alarm: KEEPALIVE_ALARM,
    periodMinutes: KEEPALIVE_ALARM_PERIOD_MINUTES,
  });
}

/**
 * Re-arms the keepalive alarm when a profiling session starts.
 * Call this whenever isProfiling transitions false → true.
 */
export function armKeepalive(): void {
  chrome.alarms.get(KEEPALIVE_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(KEEPALIVE_ALARM, {
        periodInMinutes: KEEPALIVE_ALARM_PERIOD_MINUTES,
        delayInMinutes: KEEPALIVE_ALARM_PERIOD_MINUTES,
      });
      log(LogLevel.DEBUG, 'Keepalive alarm re-armed for new profiling session');
    }
  });
}

// ============================================================================
// Main Entry Point
// ============================================================================

// Initialize the background service worker
initialize();

// Restore persisted state from previous SW lifecycle (Firefox MV2 / Chrome MV3)
restoreState();

// Set up keep-alive mechanism for Manifest V3
setupKeepAlive();

// Log initialization complete
log(LogLevel.INFO, 'React Perf Profiler background service worker ready');

// Export for testing purposes
export { connectionManager, sessionManager, messageRouter };
