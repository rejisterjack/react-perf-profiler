/**
 * Zustand store for managing connection to the content script
 * @module panel/stores/connectionStore
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { RETRY_CONSTANTS, TIME_DURATION } from '@/shared/constants';
import type { PanelMessage } from '@/shared/types';

/**
 * Bridge initialization state
 */
export type BridgeState = 'pending' | 'success' | 'failed' | 'not-detected';

/**
 * State interface for the connection store
 */
export interface ConnectionState {
  /** Whether connected to the content script */
  isConnected: boolean;
  /** Chrome runtime port for communication */
  port: chrome.runtime.Port | null;
  /** Connection error message if any */
  error: string | null;
  /** Last error message (alias for error) */
  lastError: string | null;
  /** Last successful ping timestamp */
  lastPing: number;
  /** Pending messages waiting for connection */
  pendingMessages: PanelMessage[];
  /** Set of message handlers */
  messageHandlers: Set<(message: PanelMessage) => void>;
  /** Number of reconnection attempts */
  retryCount: number;
  /** Whether currently attempting to reconnect */
  isReconnecting: boolean;
  /** Whether connection is in progress (prevents race conditions) */
  isConnecting: boolean;
  /** Current tab ID */
  tabId: number | null;
  /** Bridge initialization state */
  bridgeState: BridgeState;
  /** Bridge error details */
  bridgeError: { type: string; message: string; recoverable: boolean } | null;
  /** Whether React was detected on the page */
  reactDetected: boolean | null;
  /** Whether React DevTools was detected */
  devtoolsDetected: boolean | null;
}

/**
 * Actions interface for the connection store
 */
interface ConnectionActions {
  /** Connect to the content script */
  connect: () => void;
  /** Disconnect from the content script */
  disconnect: () => void;
  /** Send a message to the content script */
  sendMessage: (message: PanelMessage) => void;
  /** Handle incoming message from content script */
  handleMessage: (message: PanelMessage) => void;
  /** Send a ping to check connection */
  ping: () => void;
  /** Attempt to reconnect with exponential backoff */
  reconnect: () => Promise<void>;
  /** Set connection status */
  setConnected: (connected: boolean) => void;
  /** Set connection error */
  setError: (error: string | null) => void;
  /** Process any pending messages */
  flushPendingMessages: () => void;
  /** Add a message handler and return unsubscribe function */
  addMessageHandler: (handler: (message: PanelMessage) => void) => () => void;
  /** Clear the last error */
  clearError: () => void;
  /** Set bridge state */
  setBridgeState: (state: BridgeState) => void;
  /** Set bridge error */
  setBridgeError: (error: { type: string; message: string; recoverable: boolean } | null) => void;
  /** Set React detection state */
  setReactDetected: (detected: boolean) => void;
  /** Set DevTools detection state */
  setDevtoolsDetected: (detected: boolean) => void;
}

/**
 * Combined store type
 */
type ConnectionStore = ConnectionState & ConnectionActions;

/**
 * Zustand store for managing connection to the content script
 * @example
 * const { isConnected, sendMessage } = useConnectionStore();
 */
export const useConnectionStore = create<ConnectionStore>()(
  devtools(
    (set, get) => ({
      // State
      isConnected: false,
      port: null,
      error: null,
      lastError: null,
      lastPing: 0,
      pendingMessages: [],
      messageHandlers: new Set(),
      retryCount: 0,
      isReconnecting: false,
      isConnecting: false,
      tabId: null,
      bridgeState: 'pending',
      bridgeError: null,
      reactDetected: null,
      devtoolsDetected: null,

      // Actions
      connect: () => {
        const { port, isConnected, isConnecting } = get();

        // Don't connect if already connected or connection in progress
        if ((isConnected && port) || isConnecting) {
          return;
        }

        // Mark connection as in progress to prevent race conditions
        set({ isConnecting: true });

        // Disconnect existing port if any
        if (port) {
          try {
            port.disconnect();
          } catch {
            // Ignore disconnect errors
          }
        }

        // Get current tab ID first
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            set({
              error: chrome.runtime.lastError.message,
              lastError: chrome.runtime.lastError.message,
              isConnecting: false,
            });
            return;
          }

          if (!tabs || tabs.length === 0 || !tabs[0]?.id) {
            set({
              error: 'Could not determine current tab',
              lastError: 'Could not determine current tab',
              isConnecting: false,
            });
            return;
          }

          const currentTabId = tabs[0]?.id;
          set({ tabId: currentTabId });

          try {
            // Create new connection to background script
            const newPort = chrome.runtime.connect({
              name: 'react-perf-profiler-panel',
            });

            // Handle connection establishment
            newPort.onMessage.addListener((message: PanelMessage) => {
              // First, propagate message to all registered handlers
              get().handleMessage(message);

              switch (message.type) {
                case 'CONNECTION_STATUS':
                  if (message.payload) {
                    set({
                      isConnected: message.payload.connected,
                      lastPing: Date.now(),
                      error: null,
                    });
                    if (message.payload.connected) {
                      get().flushPendingMessages();
                    }
                  }
                  break;

                case 'COMMIT_DATA':
                  // Commit data is handled by registered message handlers (e.g., in App.tsx)
                  // Acknowledge receipt by updating connection state
                  set({ lastPing: Date.now() });
                  break;

                case 'BRIDGE_INIT':
                  // Bridge initialization status
                  if (message.payload?.success) {
                    set({
                      bridgeState: 'success',
                      bridgeError: null,
                      reactDetected: true,
                      devtoolsDetected: true,
                    });
                  }
                  break;

                case 'BRIDGE_ERROR':
                  // Bridge error
                  set({
                    bridgeState: 'failed',
                    bridgeError: {
                      type: message.payload?.errorType || 'UNKNOWN',
                      message: message.payload?.message || 'Bridge error',
                      recoverable: message.payload?.recoverable !== false,
                    },
                  });
                  break;

                case 'REACT_DETECT_RESULT':
                  // React detection result
                  if (message.payload) {
                    set({
                      reactDetected: message.payload.reactDetected ?? null,
                      devtoolsDetected: message.payload.devtoolsDetected ?? null,
                      bridgeState:
                        message.payload.reactDetected && message.payload.devtoolsDetected
                          ? 'success'
                          : message.payload.reactDetected
                            ? 'not-detected'
                            : 'failed',
                    });
                  }
                  break;

                case 'ERROR':
                  if (message.payload) {
                    const errMsg = message.payload.message ?? 'Unknown error';
                    set({
                      error: errMsg,
                      lastError: errMsg,
                      bridgeError: message.payload.errorType
                        ? {
                            type: message.payload.errorType,
                            message: errMsg,
                            recoverable: message.payload.recoverable !== false,
                          }
                        : null,
                    });
                  }
                  break;
              }
            });

            // Handle disconnection
            newPort.onDisconnect.addListener(() => {
              const error = chrome.runtime.lastError;
              const errorMsg = error?.message || 'Connection lost';
              set({
                isConnected: false,
                port: null,
                error: errorMsg,
                lastError: errorMsg,
                bridgeState: 'pending',
              });
            });

            set({ port: newPort, error: null, isConnected: true, isConnecting: false });

            // Flush pending messages immediately after connection
            get().flushPendingMessages();

            // Request bridge status
            newPort.postMessage({ type: 'GET_BRIDGE_STATUS' });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Failed to connect';
            set({
              isConnected: false,
              port: null,
              error: errorMsg,
              lastError: errorMsg,
              isConnecting: false,
            });
          }
        });
      },

      disconnect: () => {
        const { port } = get();

        if (port) {
          try {
            port.disconnect();
          } catch {
            // Ignore disconnect errors
          }
        }

        set({
          isConnected: false,
          port: null,
          error: null,
          lastError: null,
          pendingMessages: [],
          retryCount: 0,
          isReconnecting: false,
          isConnecting: false,
          tabId: null,
          bridgeState: 'pending',
          bridgeError: null,
          reactDetected: null,
          devtoolsDetected: null,
        });
      },

      sendMessage: (message) => {
        const { port, isConnected, pendingMessages } = get();

        // Add timestamp and messageId to the message
        const enrichedMessage = {
          ...message,
          timestamp: Date.now(),
          messageId: Math.random().toString(36).substring(2, 15),
        };

        if (port && isConnected) {
          try {
            port.postMessage(enrichedMessage);
          } catch (error) {
            // Message failed, add to pending
            const newQueue = [...pendingMessages, message];
            set({
              pendingMessages: newQueue,
              isConnected: false,
              error: error instanceof Error ? error.message : 'Failed to send message',
              lastError: error instanceof Error ? error.message : 'Failed to send message',
            });
          }
        } else {
          // Not connected, queue message
          const newQueue = [...pendingMessages, message];
          set({
            pendingMessages: newQueue,
          });
        }
      },

      handleMessage: (message) => {
        const { messageHandlers } = get();

        // Notify all registered handlers
        messageHandlers.forEach((handler) => {
          try {
            handler(message);
          } catch {
            // Ignore handler errors
          }
        });

        // Handle specific message types
        switch (message.type) {
          case 'CONNECTION_STATUS':
            set({ lastPing: Date.now() });
            break;
          case 'PONG':
            set({ isConnected: true, retryCount: 0, lastPing: Date.now() });
            break;
          case 'ERROR':
            if ('payload' in message && message.payload && typeof message.payload === 'object') {
              const errorMsg = (message.payload as { message?: string }).message || 'Unknown error';
              set({ error: errorMsg, lastError: errorMsg });
            }
            break;
        }
      },

      ping: () => {
        const { port, isConnected } = get();

        if (port && isConnected) {
          try {
            port.postMessage({
              type: 'PING',
              timestamp: Date.now(),
              messageId: Math.random().toString(36).substring(2, 15),
            });
          } catch (error) {
            // Ping failed
            const errorMsg = error instanceof Error ? error.message : 'Ping failed';
            set({
              isConnected: false,
              error: `${errorMsg} - connection lost`,
              lastError: `${errorMsg} - connection lost`,
            });
          }
        }
      },

      reconnect: async () => {
        const { isConnected, isReconnecting, retryCount } = get();

        if (isConnected || isReconnecting) {
          return;
        }

        // Max retries check
        const MAX_RETRY_ATTEMPTS = 5;
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          return;
        }

        set({ isReconnecting: true });

        try {
          // Exponential backoff delay: min(MAX_DELAY, BASE^retryCount * MS_PER_SECOND)
          const exponentialDelay =
            RETRY_CONSTANTS.BACKOFF_BASE ** retryCount * TIME_DURATION.SECOND;
          const delay = Math.min(TIME_DURATION.MAX_BACKOFF_DELAY_MS, exponentialDelay);
          await new Promise((resolve) => setTimeout(resolve, delay));

          get().connect();

          // Brief delay to allow connection to establish
          const CONNECTION_WAIT_MS = 100;
          await new Promise((resolve) => setTimeout(resolve, CONNECTION_WAIT_MS));

          if (!get().isConnected) {
            throw new Error('Reconnection failed');
          }

          // Reset retry count on success
          set({ retryCount: 0 });
        } catch {
          // Increment retry count on failure
          set({ retryCount: retryCount + 1 });
        } finally {
          set({ isReconnecting: false });
        }
      },

      setConnected: (connected) => {
        set({ isConnected: connected });
      },

      setError: (error) => {
        set({ error, lastError: error });
      },

      flushPendingMessages: () => {
        const { port, pendingMessages } = get();

        if (!port) return;

        if (pendingMessages.length === 0) return;

        const failedMessages: PanelMessage[] = [];

        pendingMessages.forEach((message: PanelMessage) => {
          try {
            port.postMessage(message);
          } catch {
            failedMessages.push(message);
          }
        });

        set({ pendingMessages: failedMessages });
      },

      addMessageHandler: (handler) => {
        const { messageHandlers } = get();
        const newHandlers = new Set(messageHandlers);
        newHandlers.add(handler);
        set({ messageHandlers: newHandlers });

        // Return unsubscribe function
        return () => {
          const { messageHandlers: currentHandlers } = get();
          const updatedHandlers = new Set(currentHandlers);
          updatedHandlers.delete(handler);
          set({ messageHandlers: updatedHandlers });
        };
      },

      clearError: () => {
        set({ error: null, lastError: null, bridgeError: null });
      },

      setBridgeState: (bridgeState) => {
        set({ bridgeState });
      },

      setBridgeError: (bridgeError) => {
        set({ bridgeError });
      },

      setReactDetected: (reactDetected) => {
        set({ reactDetected });
      },

      setDevtoolsDetected: (devtoolsDetected) => {
        set({ devtoolsDetected });
      },
    }),
    { name: 'ConnectionStore' }
  )
);
