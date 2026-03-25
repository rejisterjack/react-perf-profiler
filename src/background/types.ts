/**
 * Background service worker specific types
 * @module background/types
 */

import type { CommitData, ProfilerConfig } from '@/shared/types';

/**
 * Connection port types for the extension
 */
export type PortType = 'content' | 'devtools' | 'popup' | 'panel';

/**
 * Connection state for a single tab
 * Tracks all connected ports and profiling state
 */
export interface TabConnection {
  /** Chrome tab ID */
  tabId: number;
  /** Content script port connection */
  contentPort: chrome.runtime.Port | null;
  /** DevTools panel port connection */
  devtoolsPort: chrome.runtime.Port | null;
  /** Popup port connection */
  popupPort: chrome.runtime.Port | null;
  /** Panel port connection */
  panelPort: chrome.runtime.Port | null;
  /** Whether profiling is currently active */
  isProfiling: boolean;
  /** Session start timestamp (ms since epoch) */
  sessionStartTime: number | null;
  /** Collected commits for this session */
  commits: CommitData[];
  /** Current session configuration */
  config: ProfilerConfig;
  /** Current session status */
  sessionStatus: SessionStatus;
  /** Number of commits processed */
  commitCount: number;
}

/**
 * Profiling session status
 */
export type SessionStatus = 'idle' | 'profiling' | 'paused' | 'error';

/**
 * Options for creating a new tab connection
 */
export interface TabConnectionOptions {
  tabId: number;
  config?: ProfilerConfig;
}

/**
 * Connection event types
 */
export enum ConnectionEvent {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
}

/**
 * Connection event data
 */
export interface ConnectionEventData {
  event: ConnectionEvent;
  tabId: number;
  portType: PortType;
  timestamp: number;
  error?: string;
}

/**
 * Message handler function type
 */
export type MessageHandler = (tabId: number, message: unknown) => void;

/**
 * Port connection handler type
 */
export type PortConnectionHandler = (
  tabId: number,
  portType: PortType,
  port: chrome.runtime.Port
) => void;

/**
 * Port disconnection handler type
 */
export type PortDisconnectionHandler = (tabId: number, portType: PortType) => void;

/**
 * Connection manager configuration
 */
export interface ConnectionManagerConfig {
  /** Maximum number of tabs to track (default: 100) */
  maxTrackedTabs: number;
  /** Cleanup interval in ms (default: 30000) */
  cleanupIntervalMs: number;
  /** Whether to log connection events (default: true in dev) */
  enableLogging: boolean;
}

/**
 * Default connection manager configuration
 */
export const DEFAULT_CONNECTION_MANAGER_CONFIG: ConnectionManagerConfig = {
  maxTrackedTabs: 100,
  cleanupIntervalMs: 30000,
  enableLogging: process.env['NODE_ENV'] !== 'production',
};

/**
 * Session export data format
 */
export interface SessionExport {
  version: string;
  exportTime: number;
  tabId: number;
  url: string;
  title: string;
  startTime: number;
  endTime: number;
  config: ProfilerConfig;
  commits: CommitData[];
  summary: SessionSummary;
}

/**
 * Session summary statistics
 */
export interface SessionSummary {
  totalCommits: number;
  totalNodes: number;
  averageCommitDuration: number;
  maxCommitDuration: number;
  minCommitDuration: number;
  uniqueComponents: number;
  topRenderCountComponents: Array<{
    name: string;
    renderCount: number;
  }>;
}

/**
 * Log levels for background logging
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  tabId?: number;
  source?: string;
  data?: unknown;
}

/**
 * Error codes for background operations
 */
export enum BackgroundErrorCode {
  CONNECTION_NOT_FOUND = 'CONNECTION_NOT_FOUND',
  PORT_ALREADY_CONNECTED = 'PORT_ALREADY_CONNECTED',
  INVALID_PORT_TYPE = 'INVALID_PORT_TYPE',
  SESSION_NOT_STARTED = 'SESSION_NOT_STARTED',
  SESSION_ALREADY_ACTIVE = 'SESSION_ALREADY_ACTIVE',
  MAX_COMMITS_REACHED = 'MAX_COMMITS_REACHED',
  BROADCAST_FAILED = 'BROADCAST_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED',
  IMPORT_FAILED = 'IMPORT_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Background error structure
 */
export interface BackgroundError {
  code: BackgroundErrorCode;
  message: string;
  tabId?: number;
  originalError?: unknown;
}

/**
 * Result type for background operations
 */
export interface BackgroundResult<T> {
  success: boolean;
  data?: T;
  error?: BackgroundError;
}
