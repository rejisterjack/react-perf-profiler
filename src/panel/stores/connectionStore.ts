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

        // Get tab ID — prefer chrome.devtools API (available in DevTools panels),
        // fall back to chrome.tabs.query for other contexts
        const getTabId = (): number | null => {
          if (typeof chrome !== 'undefined' && chrome.devtools?.inspectedWindow?.tabId) {
            return chrome.devtools.inspectedWindow.tabId;
          }
          return null;
        };

        const currentTabId = getTabId();
        if (!currentTabId) {
          set({
            error: 'Could not determine current tab',
            lastError: 'Could not determine current tab',
            isConnecting: false,
          });
          return;
        }
        set({ tabId: currentTabId });

        try {
          // Create new connection to background script
          // Include the inspected tab ID in the port name so the background
          // script can associate this connection with the correct tab.
          const portName = `react-perf-profiler-panel-${currentTabId}`;
          const newPort = chrome.runtime.connect({
            name: portName,
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
                    const hasReact = message.payload.reactDetected ?? false;
                    const hasDevtools = message.payload.devtoolsDetected ?? false;
                    const isInit = message.payload.isInitialized ?? false;

                    let newBridgeState: BridgeState;
                    if (hasReact && hasDevtools && isInit) {
                      newBridgeState = 'success';
                    } else if (hasReact && hasDevtools) {
                      // DevTools hook exists but no renderers yet — still pending
                      newBridgeState = 'success';
                    } else if (hasReact && !hasDevtools) {
                      // React detected (production build) but no DevTools hook
                      // This is a valid "connected" state for detection purposes
                      newBridgeState = 'success';
                    } else {
                      newBridgeState = 'failed';
                    }

                    set({
                      reactDetected: hasReact,
                      devtoolsDetected: hasDevtools,
                      bridgeState: newBridgeState,
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

            // Detect React directly via inspectedWindow
            try {
              const detectCode = [
                '(function(){',
                'var h=window.__REACT_DEVTOOLS_GLOBAL_HOOK__;',
                'if(h)return{detected:true,hasHook:true,hasRenderers:!!(h.renderers&&h.renderers.size>0)};',
                'if(window.React||window.__REACT__)return{detected:true,hasHook:false};',
                'function chk(el){if(!el)return false;try{var n=Object.getOwnPropertyNames(el);',
                'for(var i=0;i<n.length;i++){if(n[i].indexOf("__reactContainer$")===0||n[i].indexOf("_reactRootContainer")===0||',
                'n[i].indexOf("__reactFiber$")===0||n[i].indexOf("__reactProps$")===0)return true;}}catch(e){}return false;}',
                'var sels=["#root","#app","#__next","#__nuxt","#__gatsby","[data-reactroot]","#react-root","#main"];',
                'var roots=document.querySelectorAll(sels.join(","));',
                'for(var i=0;i<roots.length;i++){if(chk(roots[i]))return{detected:true,hasHook:false};}',
                'var bc=document.querySelectorAll("body > div, body > main, body > section");',
                'for(var b=0;b<Math.min(bc.length,15);b++){if(chk(bc[b]))return{detected:true,hasHook:false};}',
                'var ds=["#root > *","#__next > *","body > div > *","main > *"];',
                'for(var si=0;si<ds.length;si++){try{var e=document.querySelectorAll(ds[si]);',
                'for(var ei=0;ei<Math.min(e.length,10);ei++){if(chk(e[ei]))return{detected:true,hasHook:false};}',
                '}catch(_){}}return{detected:false,hasHook:false};',
                '})()'
              ].join('');
              chrome.devtools.inspectedWindow['eval'](detectCode, (result: unknown, exceptionInfo: { isError: boolean; code: string; description: string; details: unknown[] } | undefined) => {
                if (exceptionInfo?.isError) {
                  // Don't overwrite successful state from bridge messages
                  const current = get();
                  if (current.bridgeState !== 'success') {
                    set({ bridgeState: 'failed', reactDetected: false });
                  }
                  return;
                }
                const r = result as { detected: boolean; hasHook: boolean; hasRenderers?: boolean } | undefined;
                if (r?.detected) {
                  set({
                    bridgeState: 'success',
                    reactDetected: true,
                    devtoolsDetected: r.hasHook,
                  });
                } else {
                  // Don't overwrite successful state from bridge messages
                  const current = get();
                  if (current.bridgeState !== 'success') {
                    set({ bridgeState: 'failed', reactDetected: false });
                  }
                }
              });
            } catch {
              // inspectedWindow API not available
            }

            // Also request bridge status via background
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
