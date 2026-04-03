/**
 * Connection Manager
 * Manages all port connections for the React Perf Profiler extension
 * @module background/connectionManager
 */

import { DEFAULT_PROFILER_CONFIG } from '@/shared/constants';
import type { ProfilerConfig } from '@/shared/types';
import type { TabConnection, PortType } from './types';
import {
  LogLevel,
  BackgroundErrorCode,
  type BackgroundResult,
  type ConnectionManagerConfig,
  DEFAULT_CONNECTION_MANAGER_CONFIG,
} from './types';

/**
 * Manages Chrome extension port connections for all tabs
 * Handles connection lifecycle, message broadcasting, and cleanup
 */
export class ConnectionManager {
  /** Map of tab IDs to their connection state */
  private connections = new Map<number, TabConnection>();

  /** Configuration options */
  private config: ConnectionManagerConfig;

  /** Cleanup interval timer */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** Logger instance */
  private logger: Console;

  /**
   * Creates a new ConnectionManager instance
   * @param config - Optional configuration overrides
   * @param logger - Optional custom logger (defaults to console)
   */
  constructor(config: Partial<ConnectionManagerConfig> = {}, logger: Console = console) {
    this.config = { ...DEFAULT_CONNECTION_MANAGER_CONFIG, ...config };
    this.logger = logger;
    this.startCleanupInterval();
  }

  /**
   * Gets or creates a connection for the specified tab
   * @param tabId - Chrome tab ID
   * @returns The tab connection (existing or newly created)
   */
  getOrCreateConnection(tabId: number): TabConnection {
    let connection = this.connections.get(tabId);

    if (!connection) {
      connection = this.createConnection(tabId);
      this.connections.set(tabId, connection);
      this.log(LogLevel.INFO, `Created new connection for tab ${tabId}`, {
        tabId,
      });
    }

    return connection;
  }

  /**
   * Gets an existing connection without creating one
   * @param tabId - Chrome tab ID
   * @returns The tab connection or undefined if not found
   */
  getConnection(tabId: number): TabConnection | undefined {
    return this.connections.get(tabId);
  }

  /**
   * Connects a port to the specified tab
   * @param tabId - Chrome tab ID
   * @param portType - Type of port (content, devtools, or popup)
   * @param port - The Chrome runtime port
   * @returns Result indicating success or failure
   */
  connectPort(
    tabId: number,
    portType: PortType,
    port: chrome.runtime.Port
  ): BackgroundResult<void> {
    try {
      const connection = this.getOrCreateConnection(tabId);
      const portKey = this.getPortKey(portType);

      // Check if port is already connected
      if (connection[portKey]) {
        this.log(LogLevel.WARN, `Port ${portType} already connected for tab ${tabId}`, {
          tabId,
          portType,
        });
        return {
          success: false,
          error: {
            code: BackgroundErrorCode.PORT_ALREADY_CONNECTED,
            message: `Port ${portType} is already connected for tab ${tabId}`,
            tabId,
          },
        };
      }

      // Store the port
      connection[portKey as 'contentPort' | 'devtoolsPort' | 'popupPort'] = port;

      // Set up disconnect handler
      port.onDisconnect.addListener(() => {
        this.handlePortDisconnect(tabId, portType);
      });

      this.log(LogLevel.INFO, `Connected ${portType} port for tab ${tabId}`, {
        tabId,
        portType,
      });

      // Send initial status to the connected port
      this.sendStatusToPort(port, connection);

      return { success: true };
    } catch (error) {
      this.log(LogLevel.ERROR, `Failed to connect ${portType} port for tab ${tabId}`, {
        tabId,
        portType,
        error,
      });
      return {
        success: false,
        error: {
          code: BackgroundErrorCode.UNKNOWN_ERROR,
          message: `Failed to connect ${portType} port: ${error instanceof Error ? error.message : String(error)}`,
          tabId,
          originalError: error,
        },
      };
    }
  }

  /**
   * Disconnects a specific port type for a tab
   * @param tabId - Chrome tab ID
   * @param portType - Type of port to disconnect
   */
  disconnectPort(tabId: number, portType: PortType): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    const portKey = this.getPortKey(portType);
    const port = connection[portKey] as chrome.runtime.Port | null;

    if (port) {
      try {
        port.disconnect();
      } catch (err) {
        this.log(LogLevel.WARN, `Error disconnecting ${portType} port for tab ${tabId}`, {
          tabId,
          portType,
          error: err,
        });
      }
      connection[portKey as 'contentPort' | 'devtoolsPort' | 'popupPort' | 'panelPort'] = null;
    }

    this.log(LogLevel.INFO, `Disconnected ${portType} port for tab ${tabId}`, {
      tabId,
      portType,
    });

    // Clean up if all ports are disconnected
    this.cleanupIfEmpty(tabId);
  }

  /**
   * Broadcasts a message to a specific port type for a tab
   * @param tabId - Chrome tab ID
   * @param portType - Type of port to send to
   * @param message - Message to send
   * @returns Result indicating success or failure
   */
  broadcastToPort<T>(tabId: number, portType: PortType, message: T): BackgroundResult<void> {
    const connection = this.connections.get(tabId);
    if (!connection) {
      return {
        success: false,
        error: {
          code: BackgroundErrorCode.CONNECTION_NOT_FOUND,
          message: `No connection found for tab ${tabId}`,
          tabId,
        },
      };
    }

    const portKey = this.getPortKey(portType);
    const port = connection[portKey] as chrome.runtime.Port | null;

    if (!port) {
      return {
        success: false,
        error: {
          code: BackgroundErrorCode.CONNECTION_NOT_FOUND,
          message: `No ${portType} port connected for tab ${tabId}`,
          tabId,
        },
      };
    }

    try {
      port.postMessage(message);
      return { success: true };
    } catch (err) {
      this.log(LogLevel.ERROR, `Failed to broadcast to ${portType} for tab ${tabId}`, {
        tabId,
        portType,
        error: err,
      });
      return {
        success: false,
        error: {
          code: BackgroundErrorCode.BROADCAST_FAILED,
          message: `Failed to broadcast to ${portType}: ${err instanceof Error ? err.message : String(err)}`,
          tabId,
        },
      };
    }
  }

  /**
   * Broadcasts a message to all connected ports for a tab
   * @param tabId - Chrome tab ID
   * @param message - Message to send
   */
  broadcastToAllPorts<T>(tabId: number, message: T): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    const ports: PortType[] = ['content', 'devtools', 'popup', 'panel'];
    let sentCount = 0;

    ports.forEach((portType) => {
      const result = this.broadcastToPort(tabId, portType, message);
      if (result.success) {
        sentCount++;
      }
    });

    this.log(LogLevel.DEBUG, `Broadcasted to ${sentCount} ports for tab ${tabId}`, {
      tabId,
      sentCount,
    });
  }

  /**
   * Cleans up a connection for a tab
   * @param tabId - Chrome tab ID
   */
  cleanupConnection(tabId: number): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    this.log(LogLevel.INFO, `Cleaning up connection for tab ${tabId}`, { tabId });

    // Disconnect all ports
    (['content', 'devtools', 'popup', 'panel'] as PortType[]).forEach((portType) => {
      this.disconnectPort(tabId, portType);
    });

    // Remove from connections map
    this.connections.delete(tabId);
  }

  /**
   * Gets all active connections
   * @returns Array of tab connections
   */
  getAllConnections(): TabConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Gets count of active connections
   * @returns Number of tracked connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Disposes the connection manager and cleans up resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clean up all connections
    this.connections.forEach((_, tabId) => {
      this.cleanupConnection(tabId);
    });

    this.log(LogLevel.INFO, 'Connection manager disposed');
  }

  /**
   * Creates a new tab connection with default values
   * @param tabId - Chrome tab ID
   * @param config - Optional profiler configuration
   * @returns New tab connection
   */
  private createConnection(
    tabId: number,
    config: ProfilerConfig = DEFAULT_PROFILER_CONFIG
  ): TabConnection {
    return {
      tabId,
      contentPort: null,
      devtoolsPort: null,
      popupPort: null,
      panelPort: null,
      isProfiling: false,
      sessionStartTime: null,
      commits: [],
      config,
      sessionStatus: 'idle',
      commitCount: 0,
    };
  }

  /**
   * Gets the port key for a port type
   * @param portType - Type of port
   * @returns The key name in TabConnection
   */
  private getPortKey(portType: PortType): keyof TabConnection {
    switch (portType) {
      case 'content':
        return 'contentPort';
      case 'devtools':
        return 'devtoolsPort';
      case 'popup':
        return 'popupPort';
      case 'panel':
        return 'panelPort';
      default:
        throw new Error(`Invalid port type: ${portType}`);
    }
  }

  /**
   * Handles port disconnection
   * @param tabId - Chrome tab ID
   * @param portType - Type of port that disconnected
   */
  private handlePortDisconnect(tabId: number, portType: PortType): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    const portKey = this.getPortKey(portType);
    connection[portKey as 'contentPort' | 'devtoolsPort' | 'popupPort'] = null;

    this.log(LogLevel.INFO, `${portType} port disconnected for tab ${tabId}`, {
      tabId,
      portType,
    });

    this.cleanupIfEmpty(tabId);
  }

  /**
   * Cleans up a connection if all ports are disconnected
   * @param tabId - Chrome tab ID
   */
  private cleanupIfEmpty(tabId: number): void {
    const connection = this.connections.get(tabId);
    if (!connection) return;

    const hasActivePorts =
      connection.contentPort || connection.devtoolsPort || connection.popupPort || connection.panelPort;

    if (!hasActivePorts && !connection.isProfiling) {
      this.connections.delete(tabId);
      this.log(LogLevel.INFO, `Removed empty connection for tab ${tabId}`, {
        tabId,
      });
    }
  }

  /**
   * Starts the cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Performs periodic cleanup of stale connections
   */
  private performCleanup(): void {
    const now = Date.now();
    const maxAge = this.config.cleanupIntervalMs * 2;

    this.connections.forEach((connection, tabId) => {
      // Check if connection is stale (no active ports and old)
      const hasActivePorts =
        connection.contentPort || connection.devtoolsPort || connection.popupPort || connection.panelPort;

      const isStale =
        !hasActivePorts &&
        !connection.isProfiling &&
        connection.sessionStartTime &&
        now - connection.sessionStartTime > maxAge;

      if (isStale) {
        this.log(LogLevel.INFO, `Cleaning up stale connection for tab ${tabId}`, {
          tabId,
        });
        this.cleanupConnection(tabId);
      }
    });

    // Enforce max connections limit
    if (this.connections.size > this.config.maxTrackedTabs) {
      const sortedConnections = Array.from(this.connections.entries()).sort(
        (a, b) => (a[1].sessionStartTime || 0) - (b[1].sessionStartTime || 0)
      );

      const toRemove = sortedConnections.slice(
        0,
        this.connections.size - this.config.maxTrackedTabs
      );

      toRemove.forEach(([tabId]) => {
        this.log(LogLevel.WARN, `Removing oldest connection for tab ${tabId} due to limit`, {
          tabId,
        });
        this.cleanupConnection(tabId);
      });
    }
  }

  /**
   * Sends current status to a connected port
   * @param port - Chrome runtime port
   * @param connection - Tab connection state
   */
  private sendStatusToPort(port: chrome.runtime.Port, connection: TabConnection): void {
    try {
      port.postMessage({
        type: 'STATUS_UPDATE',
        isProfiling: connection.isProfiling,
        sessionStartTime: connection.sessionStartTime,
        commitCount: connection.commitCount,
        sessionStatus: connection.sessionStatus,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.log(LogLevel.WARN, 'Failed to send status to port', { error });
    }
  }

  /**
   * Logs a message if logging is enabled
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.config.enableLogging) return;

    const logData = {
      timestamp: Date.now(),
      ...data,
    };

    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug(`[Background] ${message}`, logData);
        break;
      case LogLevel.INFO:
        this.logger.info(`[Background] ${message}`, logData);
        break;
      case LogLevel.WARN:
        this.logger.warn(`[Background] ${message}`, logData);
        break;
      case LogLevel.ERROR:
        this.logger.error(`[Background] ${message}`, logData);
        break;
    }
  }
}
