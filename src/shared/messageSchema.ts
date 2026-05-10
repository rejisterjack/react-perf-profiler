/**
 * Message Schema Validation
 * Runtime type guards for all extension message types — validates payloads
 * before processing to prevent malformed data from crashing the extension.
 *
 * Uses manual type guards instead of Zod (not available in extension context).
 */

// ---------------------------------------------------------------------------
// Bridge → Content Script validation
// ---------------------------------------------------------------------------

const BRIDGE_MESSAGE_TYPES = new Set([
  'COMMIT', 'INIT', 'ERROR', 'START', 'STOP', 'RETRY_SCHEDULED', 'DETECT_RESULT',
]);

/**
 * Validate a bridge message. Returns true if the message has the expected shape.
 */
export function isBridgeMessage(data: unknown): data is {
  source: 'react-perf-profiler-bridge';
  payload: {
    type: string;
    data?: unknown;
    error?: string;
    errorType?: string;
    recoverable?: boolean;
    retryCount?: number;
    maxRetries?: number;
    nextRetryIn?: number;
    reactDetected?: boolean;
    devtoolsDetected?: boolean;
    isInitialized?: boolean;
  };
} {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Record<string, unknown>;
  if (msg['source'] !== 'react-perf-profiler-bridge') return false;
  if (!msg['payload'] || typeof msg['payload'] !== 'object') return false;
  const payload = msg['payload'] as Record<string, unknown>;
  if (typeof payload['type'] !== 'string') return false;
  if (!BRIDGE_MESSAGE_TYPES.has(payload['type'])) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Content → Background validation
// ---------------------------------------------------------------------------

const CONTENT_MESSAGE_TYPES = new Set([
  'PING', 'PONG', 'BRIDGE_INJECTED', 'BRIDGE_INIT', 'BRIDGE_STATUS',
  'COMMIT_DATA', 'PROFILING_STARTED', 'PROFILING_STOPPED',
  'REACT_DETECT_RESULT', 'BRIDGE_RETRY_SCHEDULED', 'ERROR',
]);

/**
 * Validate a content-to-background message.
 */
export function isContentMessage(data: unknown): data is {
  type: string;
  payload?: unknown;
  error?: string;
  tabId?: number;
} {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Record<string, unknown>;
  if (typeof msg['type'] !== 'string') return false;
  if (!CONTENT_MESSAGE_TYPES.has(msg['type'])) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Background → Panel / Content validation
// ---------------------------------------------------------------------------

const BACKGROUND_MESSAGE_TYPES = new Set([
  'START_PROFILING', 'STOP_PROFILING', 'COMMIT_DATA', 'PING', 'PONG',
  'DETECT_REACT', 'FORCE_INIT', 'GET_BRIDGE_STATUS', 'BRIDGE_INIT',
  'BRIDGE_ERROR', 'CONNECTION_STATUS', 'REACT_DETECT_RESULT', 'ERROR',
  'PROFILING_STOPPED',
]);

/**
 * Validate a background message.
 */
export function isBackgroundMessage(data: unknown): data is {
  type: string;
  payload?: unknown;
  error?: string;
  tabId?: number;
} {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Record<string, unknown>;
  if (typeof msg['type'] !== 'string') return false;
  if (!BACKGROUND_MESSAGE_TYPES.has(msg['type'])) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Content Script → Bridge validation
// ---------------------------------------------------------------------------

/**
 * Validate a content-to-bridge message.
 */
export function isContentToBridgeMessage(data: unknown): data is {
  source: 'react-perf-profiler-content';
  payload: {
    type: string;
    [key: string]: unknown;
  };
} {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Record<string, unknown>;
  if (msg['source'] !== 'react-perf-profiler-content') return false;
  if (!msg['payload'] || typeof msg['payload'] !== 'object') return false;
  const payload = msg['payload'] as Record<string, unknown>;
  if (typeof payload['type'] !== 'string') return false;
  return true;
}
