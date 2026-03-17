/**
 * Zustand store for managing connection to the content script
 * @module panel/stores/connectionStore
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { PanelMessage } from '@/shared/types';

/**
 * State interface for the connection store
 */
interface ConnectionState {
  /** Whether connected to the content script */
  isConnected: boolean;
  /** Chrome runtime port for communication */
  port: chrome.runtime.Port | null;
  /** Connection error message if any */
  error: string | null;
  /** Last successful ping timestamp */
  lastPing: number;
  /** Pending messages waiting for connection */
  pendingMessages: PanelMessage[];
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
  /** Set connection status */
  setConnected: (connected: boolean) => void;
  /** Set connection error */
  setError: (error: string | null) => void;
  /** Process any pending messages */
  flushPendingMessages: () => void;
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
      lastPing: 0,
      pendingMessages: [],

      // Actions
      connect: () => {
        const { port } = get();
        
        // Disconnect existing port if any
        if (port) {
          port.disconnect();
        }

        try {
          // Create new connection to background script
          const newPort = chrome.runtime.connect({
            name: 'react-perf-profiler-panel',
          });

          // Handle connection establishment
          newPort.onMessage.addListener((message: PanelMessage) => {
            switch (message.type) {
              case 'CONNECTION_STATUS':
                set({
                  isConnected: message.payload.connected,
                  lastPing: Date.now(),
                  error: null,
                });
                
                // Flush pending messages once connected
                if (message.payload.connected) {
                  get().flushPendingMessages();
                }
                break;
                
              case 'COMMIT_DATA':
                // Commit data is handled by the profiler store
                // This is just to acknowledge receipt
                break;
                
              case 'ERROR':
                set({ error: message.payload.message });
                break;
            }
          });

          // Handle disconnection
          newPort.onDisconnect.addListener(() => {
            const error = chrome.runtime.lastError;
            set({
              isConnected: false,
              port: null,
              error: error?.message || 'Connection lost',
            });
          });

          set({ port: newPort, error: null });
        } catch (error) {
          set({
            isConnected: false,
            port: null,
            error: error instanceof Error ? error.message : 'Failed to connect',
          });
        }
      },

      disconnect: () => {
        const { port } = get();
        
        if (port) {
          port.disconnect();
        }
        
        set({
          isConnected: false,
          port: null,
          error: null,
          pendingMessages: [],
        });
      },

      sendMessage: (message) => {
        const { port, isConnected, pendingMessages } = get();
        
        if (port && isConnected) {
          try {
            port.postMessage(message);
          } catch (error) {
            // Message failed, add to pending
            set({
              pendingMessages: [...pendingMessages, message],
              isConnected: false,
              error: error instanceof Error ? error.message : 'Failed to send message',
            });
          }
        } else {
          // Not connected, queue message
          set({
            pendingMessages: [...pendingMessages, message],
          });
        }
      },

      setConnected: (connected) => {
        set({ isConnected: connected });
      },

      setError: (error) => {
        set({ error });
      },

      flushPendingMessages: () => {
        const { port, pendingMessages } = get();
        
        if (!port || pendingMessages.length === 0) return;
        
        const failedMessages: PanelMessage[] = [];
        
        pendingMessages.forEach((message) => {
          try {
            port.postMessage(message);
          } catch {
            failedMessages.push(message);
          }
        });
        
        set({ pendingMessages: failedMessages });
      },
    }),
    { name: 'ConnectionStore' }
  )
);
