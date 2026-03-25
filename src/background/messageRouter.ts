/**
 * Message Router
 * Routes messages between content scripts, DevTools panel, and popup
 * @module background/messageRouter
 */

import { MessageTypeEnum } from '@/shared/constants';
import type { ExtensionMessage, CommitData, ProfilerConfig } from '@/shared/types';
import type { ConnectionManager } from './connectionManager';
import type { SessionManager } from './sessionManager';
import type { PortType } from './types';
import { LogLevel, type LogEntry } from './types';

/**
 * Type guard to check if a message is a valid ExtensionMessage
 */
function isValidExtensionMessage(message: unknown): message is ExtensionMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const msg = message as Partial<ExtensionMessage>;

  // Check for required type field
  if (!msg.type || typeof msg.type !== 'string') {
    return false;
  }

  // Validate it's a known message type
  const validTypes = Object.values(MessageTypeEnum);
  return validTypes.includes(msg.type as MessageTypeEnum);
}

/**
 * Routes messages between different parts of the extension
 * Handles message validation, routing logic, and error handling
 */
export class MessageRouter {
  /** Connection manager instance */
  private connectionManager: ConnectionManager;

  /** Session manager instance */
  private sessionManager: SessionManager;

  /** Logger instance */
  private logger: Console;

  /** Whether debug logging is enabled */
  private enableDebugLog: boolean;

  /**
   * Creates a new MessageRouter instance
   * @param connectionManager - Connection manager instance
   * @param sessionManager - Session manager instance
   * @param logger - Optional custom logger
   * @param enableDebugLog - Whether to enable debug logging
   */
  constructor(
    connectionManager: ConnectionManager,
    sessionManager: SessionManager,
    logger: Console = console,
    enableDebugLog = false
  ) {
    this.connectionManager = connectionManager;
    this.sessionManager = sessionManager;
    this.logger = logger;
    this.enableDebugLog = enableDebugLog;
  }

  /**
   * Handles messages from content scripts
   * @param tabId - Chrome tab ID
   * @param message - The message from content script
   */
  handleContentMessage(tabId: number, message: ExtensionMessage | unknown): void {
    this.log(LogLevel.DEBUG, 'Received content message', { tabId, message });

    if (!isValidExtensionMessage(message)) {
      this.log(LogLevel.WARN, 'Invalid message from content script', {
        tabId,
        message,
      });
      return;
    }

    this.routeMessage('content', tabId, message);
  }

  /**
   * Handles messages from DevTools panel
   * @param tabId - Chrome tab ID
   * @param message - The message from DevTools panel
   */
  handleDevtoolsMessage(tabId: number, message: ExtensionMessage | unknown): void {
    this.log(LogLevel.DEBUG, 'Received devtools message', { tabId, message });

    if (!isValidExtensionMessage(message)) {
      this.log(LogLevel.WARN, 'Invalid message from devtools', {
        tabId,
        message,
      });
      return;
    }

    this.routeMessage('devtools', tabId, message);
  }

  /**
   * Handles messages from popup
   * @param tabId - Chrome tab ID
   * @param message - The message from popup
   */
  handlePopupMessage(tabId: number, message: ExtensionMessage | unknown): void {
    this.log(LogLevel.DEBUG, 'Received popup message', { tabId, message });

    if (!isValidExtensionMessage(message)) {
      this.log(LogLevel.WARN, 'Invalid message from popup', { tabId, message });
      return;
    }

    this.routeMessage('popup', tabId, message);
  }

  /**
   * Routes a message based on its type and source
   * @param source - Source of the message (content, devtools, popup)
   * @param tabId - Chrome tab ID
   * @param message - The parsed message
   */
  routeMessage(source: PortType, tabId: number, message: ExtensionMessage): void {
    this.log(LogLevel.DEBUG, 'Routing message', {
      source,
      tabId,
      type: message.type,
    });

    switch (message.type) {
      // Profiling control messages
      case MessageTypeEnum.START_PROFILING:
        this.handleStartProfiling(source, tabId, message);
        break;

      case MessageTypeEnum.STOP_PROFILING:
        this.handleStopProfiling(source, tabId, message);
        break;

      // Data messages
      case MessageTypeEnum.COMMIT:
        this.handleCommitMessage(source, tabId, message);
        break;

      case MessageTypeEnum.GET_DATA:
        this.handleGetDataMessage(source, tabId, message);
        break;

      case MessageTypeEnum.CLEAR_DATA:
        this.handleClearDataMessage(source, tabId, message);
        break;

      default:
        this.log(LogLevel.WARN, `Unhandled message type: ${message.type}`, {
          source,
          tabId,
          message,
        });
    }
  }

  /**
   * Handles START_PROFILING message
   * @param source - Source of the message
   * @param tabId - Chrome tab ID
   * @param message - The message
   */
  private handleStartProfiling(source: PortType, tabId: number, message: ExtensionMessage): void {
    this.log(LogLevel.INFO, 'Starting profiling session', { tabId, source });

    // Get config from message if provided
    const config = (message.payload as { config?: Partial<ProfilerConfig> } | undefined)?.config;

    // Start the session
    let result: ReturnType<SessionManager['startSession']>;
    try {
      result = this.sessionManager.startSession(tabId);
    } catch (error) {
      this.log(LogLevel.ERROR, 'Failed to start profiling session', {
        tabId,
        error,
      });
      this.sendError(
        source,
        tabId,
        error instanceof Error ? error.message : 'Failed to start session',
        error
      );
      return;
    }

    if (!result.success) {
      this.log(LogLevel.ERROR, 'Failed to start profiling session', {
        tabId,
        error: result.error,
      });
      this.sendError(source, tabId, result.error?.message || 'Failed to start session');
      return;
    }

    // Forward to content script to start React profiling
    this.connectionManager.broadcastToPort(tabId, 'content', {
      type: MessageTypeEnum.START_PROFILING,
      payload: { config },
      timestamp: Date.now(),
    });

    // Notify all other ports that profiling started
    this.connectionManager.broadcastToAllPorts(tabId, {
      type: 'PROFILING_STARTED',
      timestamp: Date.now(),
    });
  }

  /**
   * Handles STOP_PROFILING message
   * @param source - Source of the message
   * @param tabId - Chrome tab ID
   * @param message - The message
   */
  private handleStopProfiling(source: PortType, tabId: number, _message: ExtensionMessage): void {
    this.log(LogLevel.INFO, 'Stopping profiling session', { tabId, source });

    // Stop the session and get the data
    const commits = this.sessionManager.stopSession(tabId);

    // Forward to content script to stop React profiling
    this.connectionManager.broadcastToPort(tabId, 'content', {
      type: MessageTypeEnum.STOP_PROFILING,
      timestamp: Date.now(),
    });

    // Notify all ports that profiling stopped with final data
    this.connectionManager.broadcastToAllPorts(tabId, {
      type: 'PROFILING_STOPPED',
      commits,
      timestamp: Date.now(),
    });
  }

  /**
   * Handles COMMIT message from content script
   * @param source - Source of the message
   * @param tabId - Chrome tab ID
   * @param message - The message containing commit data
   */
  private handleCommitMessage(_source: PortType, tabId: number, message: ExtensionMessage): void {
    const commit = (message.payload as { commit?: CommitData } | undefined)?.commit;

    if (!commit) {
      this.log(LogLevel.WARN, 'Commit message missing commit data', {
        tabId,
        message,
      });
      return;
    }

    // Store the commit
    this.sessionManager.addCommit(tabId, commit);

    // Forward to panel for real-time display
    this.connectionManager.broadcastToPort(tabId, 'panel', {
      type: MessageTypeEnum.COMMIT,
      payload: { commit },
      timestamp: Date.now(),
    });

    // Also forward to DevTools legacy port if connected
    this.connectionManager.broadcastToPort(tabId, 'devtools', {
      type: MessageTypeEnum.COMMIT,
      payload: { commit },
      timestamp: Date.now(),
    });

    // Also forward to popup if connected
    this.connectionManager.broadcastToPort(tabId, 'popup', {
      type: MessageTypeEnum.COMMIT,
      payload: { commit },
      timestamp: Date.now(),
    });
  }

  /**
   * Handles GET_DATA message
   * @param source - Source of the message
   * @param tabId - Chrome tab ID
   * @param message - The message
   */
  private handleGetDataMessage(source: PortType, tabId: number, _message: ExtensionMessage): void {
    const commits = this.sessionManager.getSessionData(tabId);
    const connection = this.connectionManager.getConnection(tabId);

    // Send data back to the requester
    this.connectionManager.broadcastToPort(tabId, source, {
      type: 'DATA_RESPONSE',
      payload: {
        commits,
        metrics: {},
        reports: [],
        sessionStartTime: connection?.sessionStartTime ?? null,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handles CLEAR_DATA message
   * @param source - Source of the message
   * @param tabId - Chrome tab ID
   * @param message - The message
   */
  private handleClearDataMessage(
    source: PortType,
    tabId: number,
    _message: ExtensionMessage
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.log(LogLevel.INFO, 'Clearing session data', { tabId, source });

    this.sessionManager.clearSession(tabId);

    // Notify all ports that data was cleared
    this.connectionManager.broadcastToAllPorts(tabId, {
      type: 'DATA_CLEARED',
      timestamp: Date.now(),
    });
  }

  /**
   * Sends an error message to a specific port
   * @param target - Target port type
   * @param tabId - Chrome tab ID
   * @param errorMessage - Error message
   * @param originalError - Original error object
   */
  private sendError(
    target: PortType,
    tabId: number,
    errorMessage: string,
    originalError?: unknown
  ): void {
    this.connectionManager.broadcastToPort(tabId, target, {
      type: MessageTypeEnum.ERROR,
      payload: {
        code: 'BACKGROUND_ERROR',
        message: errorMessage,
      },
      timestamp: Date.now(),
    });

    this.log(LogLevel.ERROR, errorMessage, {
      tabId,
      originalError,
    });
  }

  /**
   * Logs a message if logging is enabled
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.enableDebugLog && level === LogLevel.DEBUG) return;

    const logData: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      ...data,
    };

    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug('[MessageRouter]', logData);
        break;
      case LogLevel.INFO:
        this.logger.info('[MessageRouter]', logData);
        break;
      case LogLevel.WARN:
        this.logger.warn('[MessageRouter]', logData);
        break;
      case LogLevel.ERROR:
        this.logger.error('[MessageRouter]', logData);
        break;
    }
  }
}
