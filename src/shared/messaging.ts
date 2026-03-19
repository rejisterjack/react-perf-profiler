/**
 * Message protocol definitions for React Perf Profiler
 * Contains message handlers, port names, and validation utilities
 */

import type {
  ExtensionMessage,
  MessageType,
  CommitData,
  ComponentMetrics,
  WastedRenderReport,
  AnalysisSummary,
  ProfilerConfig,
  DataFilters,
} from './types';
import { MessageTypeEnum, PortNameEnum } from './constants';

// ============================================================================
// Port Names
// ============================================================================

/**
 * Port names for long-lived connections between extension components
 * Used with chrome.runtime.connect()
 */
export const PORT_NAMES = {
  /** Connection from content script to background service worker */
  CONTENT_BACKGROUND: PortNameEnum.CONTENT_BACKGROUND,
  /** Connection from DevTools panel to background service worker */
  DEVTOOLS_BACKGROUND: PortNameEnum.DEVTOOLS_BACKGROUND,
  /** Connection from popup to background service worker */
  POPUP_BACKGROUND: PortNameEnum.POPUP_BACKGROUND,
  /** Connection from background to native messaging host */
  BACKGROUND_NATIVE: PortNameEnum.BACKGROUND_NATIVE,
} as const;

/** Type for valid port names */
export type PortName = (typeof PORT_NAMES)[keyof typeof PORT_NAMES];

/**
 * Check if a string is a valid port name
 */
export function isValidPortName(name: string): name is PortName {
  return Object.values(PORT_NAMES).includes(name as PortName);
}

// ============================================================================
// Message Handler Interfaces
// ============================================================================

/**
 * Generic message handler function type
 */
export type MessageHandler<T = unknown, R = unknown> = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  payload: T
) => R | Promise<R>;

/**
 * Interface for message handler registration
 */
export interface MessageHandlerRegistration<T = unknown, R = unknown> {
  /** Message type this handler responds to */
  type: MessageType;
  /** The handler function */
  handler: MessageHandler<T, R>;
  /** Whether this is a one-time handler (auto-removes after first call) */
  once?: boolean;
  /** Priority for handler execution (higher = earlier) */
  priority?: number;
}

/**
 * Message handler map for organizing handlers by type
 */
export type MessageHandlerMap = Map<MessageType, MessageHandlerRegistration[]>;

/**
 * Interface for message router/dispatcher
 */
export interface MessageRouter {
  /** Register a handler for a message type */
  register: <T, R>(registration: MessageHandlerRegistration<T, R>) => () => void;
  /** Unregister a handler */
  unregister: (type: MessageType, handler: MessageHandler) => void;
  /** Dispatch a message to registered handlers */
  dispatch: <R>(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ) => Promise<R | undefined>;
  /** Check if handlers exist for a message type */
  hasHandlers: (type: MessageType) => boolean;
  /** Get all registered handlers for a type */
  getHandlers: (type: MessageType) => MessageHandlerRegistration[];
}

/**
 * Interface for port connection manager
 */
export interface PortConnectionManager {
  /** Connect to a port */
  connect: (portName: PortName, tabId?: number) => chrome.runtime.Port;
  /** Disconnect from a port */
  disconnect: (portName: PortName, tabId?: number) => void;
  /** Check if connected to a port */
  isConnected: (portName: PortName, tabId?: number) => boolean;
  /** Send a message through a port */
  postMessage: (portName: PortName, message: ExtensionMessage, tabId?: number) => void;
  /** Register a listener for port messages */
  onMessage: (
    portName: PortName,
    listener: (message: ExtensionMessage, port: chrome.runtime.Port) => void
  ) => () => void;
  /** Register a listener for port disconnections */
  onDisconnect: (portName: PortName, listener: (port: chrome.runtime.Port) => void) => () => void;
}

// ============================================================================
// Typed Message Payload Interfaces
// ============================================================================

/**
 * Payload for COMMIT messages
 */
export interface CommitPayload {
  commit: CommitData;
}

/**
 * Payload for START_PROFILING messages
 */
export interface StartProfilingPayload {
  config?: Partial<ProfilerConfig>;
  timestamp: number;
}

/**
 * Payload for STOP_PROFILING messages
 */
export interface StopProfilingPayload {
  finalCommit?: CommitData;
  totalCommits: number;
  totalDuration: number;
  timestamp: number;
}

/**
 * Payload for CLEAR_DATA messages
 */
export interface ClearDataPayload {
  preserveConfig?: boolean;
}

/**
 * Payload for GET_DATA messages
 */
export interface GetDataPayload {
  filters?: DataFilters;
}

/**
 * Response payload for GET_DATA messages
 */
export interface GetDataResponse {
  commits: CommitData[];
  metrics: Record<string, ComponentMetrics>;
  reports: WastedRenderReport[];
}

/**
 * Payload for COMPONENT_SELECTED messages
 */
export interface ComponentSelectedPayload {
  componentName: string;
  fiberId: string;
  metrics: ComponentMetrics;
  commitId: string;
}

/**
 * Payload for ANALYSIS_COMPLETE messages
 */
export interface AnalysisCompletePayload {
  reports: WastedRenderReport[];
  summary: AnalysisSummary;
  timestamp: number;
}

/**
 * Payload for ERROR messages
 */
export interface ErrorPayload {
  code: string;
  message: string;
  stack?: string;
  source?: string;
  timestamp: number;
}

/**
 * Payload for INIT messages
 */
export interface InitPayload {
  tabId: number;
  url: string;
  reactDetected: boolean;
  version?: string;
}

/**
 * Payload for PING/PONG messages
 */
export interface PingPongPayload {
  timestamp: number;
}

// ============================================================================
// Message Factory Functions
// ============================================================================

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a base message with common fields
 */
function createBaseMessage(type: MessageType): ExtensionMessage {
  return {
    type,
    messageId: generateMessageId(),
    timestamp: Date.now(),
  };
}

/**
 * Create a COMMIT message
 */
export function createCommitMessage(commit: CommitData, tabId?: number): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.COMMIT),
    payload: { commit } satisfies CommitPayload,
    tabId,
  };
}

/**
 * Create a START_PROFILING message
 */
export function createStartProfilingMessage(
  config?: Partial<ProfilerConfig>,
  tabId?: number
): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.START_PROFILING),
    payload: { config, timestamp: Date.now() } satisfies StartProfilingPayload,
    tabId,
  };
}

/**
 * Create a STOP_PROFILING message
 */
export function createStopProfilingMessage(
  payload: Omit<StopProfilingPayload, 'timestamp'>,
  tabId?: number
): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.STOP_PROFILING),
    payload: { ...payload, timestamp: Date.now() } satisfies StopProfilingPayload,
    tabId,
  };
}

/**
 * Create a CLEAR_DATA message
 */
export function createClearDataMessage(preserveConfig = true, tabId?: number): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.CLEAR_DATA),
    payload: { preserveConfig } satisfies ClearDataPayload,
    tabId,
  };
}

/**
 * Create a GET_DATA message
 */
export function createGetDataMessage(filters?: DataFilters, tabId?: number): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.GET_DATA),
    payload: { filters } satisfies GetDataPayload,
    tabId,
  };
}

/**
 * Create a COMPONENT_SELECTED message
 */
export function createComponentSelectedMessage(
  payload: ComponentSelectedPayload,
  tabId?: number
): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.COMPONENT_SELECTED),
    payload,
    tabId,
  };
}

/**
 * Create an ANALYSIS_COMPLETE message
 */
export function createAnalysisCompleteMessage(
  reports: WastedRenderReport[],
  summary: AnalysisSummary,
  tabId?: number
): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.ANALYSIS_COMPLETE),
    payload: { reports, summary, timestamp: Date.now() } satisfies AnalysisCompletePayload,
    tabId,
  };
}

/**
 * Create an ERROR message
 */
export function createErrorMessage(
  code: string,
  message: string,
  source?: string,
  stack?: string,
  tabId?: number
): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.ERROR),
    payload: { code, message, stack, source, timestamp: Date.now() } satisfies ErrorPayload,
    tabId,
  };
}

/**
 * Create an INIT message
 */
export function createInitMessage(payload: InitPayload, tabId?: number): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.INIT),
    payload,
    tabId,
  };
}

/**
 * Create a PING message
 */
export function createPingMessage(tabId?: number): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.PING),
    payload: { timestamp: Date.now() } satisfies PingPongPayload,
    tabId,
  };
}

/**
 * Create a PONG message
 */
export function createPongMessage(tabId?: number): ExtensionMessage {
  return {
    ...createBaseMessage(MessageTypeEnum.PONG),
    payload: { timestamp: Date.now() } satisfies PingPongPayload,
    tabId,
  };
}

// ============================================================================
// Message Validation Utilities
// ============================================================================

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valid validation result
 */
export const VALID_RESULT: ValidationResult = { valid: true, errors: [] };

/**
 * Create an invalid validation result
 */
export function invalidResult(error: string): ValidationResult {
  return { valid: false, errors: [error] };
}

/**
 * Create a combined validation result
 */
export function combineResults(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((r) => r.errors);
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a value is a non-empty string
 */
export function validateNonEmptyString(value: unknown, fieldName: string): ValidationResult {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return invalidResult(`${fieldName} must be a non-empty string`);
  }
  return VALID_RESULT;
}

/**
 * Validate that a value is a number within a range
 */
export function validateNumberInRange(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): ValidationResult {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return invalidResult(`${fieldName} must be a number`);
  }
  if (value < min || value > max) {
    return invalidResult(`${fieldName} must be between ${min} and ${max}`);
  }
  return VALID_RESULT;
}

/**
 * Validate that a value is a valid timestamp
 */
export function validateTimestamp(value: unknown, fieldName: string): ValidationResult {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return invalidResult(`${fieldName} must be a number`);
  }
  // Reasonable timestamp range: 2020-01-01 to 2030-12-31
  const minTimestamp = 1577836800000;
  const maxTimestamp = 1924991999999;
  if (value < minTimestamp || value > maxTimestamp) {
    return invalidResult(`${fieldName} is outside valid timestamp range`);
  }
  return VALID_RESULT;
}

/**
 * Validate base message structure
 */
export function validateBaseMessage(message: unknown): ValidationResult {
  if (typeof message !== 'object' || message === null) {
    return invalidResult('Message must be an object');
  }

  const msg = message as Record<string, unknown>;

  if (!('type' in msg)) {
    return invalidResult('Message must have a type property');
  }

  const validTypes = Object.values(MessageTypeEnum);
  if (!validTypes.includes(msg["type"] as MessageTypeEnum)) {
    return invalidResult(`Invalid message type: ${msg["type"]}`);
  }

  return VALID_RESULT;
}

/**
 * Validate COMMIT message payload
 */
export function validateCommitPayload(payload: unknown): ValidationResult {
  if (typeof payload !== 'object' || payload === null) {
    return invalidResult('Commit payload must be an object');
  }

  const p = payload as Record<string, unknown>;

  if (!('commit' in p)) {
    return invalidResult('Commit payload must have a commit property');
  }

  const commit = p["commit"] as Record<string, unknown>;
  const validations = [
    validateNonEmptyString(commit["id"], 'commit["id"]'),
    validateTimestamp(commit["timestamp"], 'commit["timestamp"]'),
    validateNumberInRange(commit["duration"], 'commit["duration"]', 0, 60000),
  ];

  return combineResults(...validations);
}

/**
 * Validate START_PROFILING message payload
 */
export function validateStartProfilingPayload(payload: unknown): ValidationResult {
  if (typeof payload !== 'object' || payload === null) {
    return invalidResult('Start profiling payload must be an object');
  }

  const p = payload as Record<string, unknown>;
  const validations: ValidationResult[] = [];

  if (p["timestamp"] !== undefined) {
    validations.push(validateTimestamp(p["timestamp"], 'timestamp'));
  }

  if (p["config"] !== undefined) {
    if (typeof p["config"] !== 'object' || p["config"] === null) {
      validations.push(invalidResult('config must be an object'));
    }
  }

  return combineResults(...validations);
}

/**
 * Validate STOP_PROFILING message payload
 */
export function validateStopProfilingPayload(payload: unknown): ValidationResult {
  if (typeof payload !== 'object' || payload === null) {
    return invalidResult('Stop profiling payload must be an object');
  }

  const p = payload as Record<string, unknown>;
  const validations: ValidationResult[] = [];

  if (p["totalCommits"] !== undefined) {
    validations.push(validateNumberInRange(p["totalCommits"], 'totalCommits', 0, Infinity));
  }

  if (p["totalDuration"] !== undefined) {
    validations.push(validateNumberInRange(p["totalDuration"], 'totalDuration', 0, Infinity));
  }

  if (p["timestamp"] !== undefined) {
    validations.push(validateTimestamp(p["timestamp"], 'timestamp'));
  }

  return combineResults(...validations);
}

/**
 * Validate ANALYSIS_COMPLETE message payload
 */
export function validateAnalysisCompletePayload(payload: unknown): ValidationResult {
  if (typeof payload !== 'object' || payload === null) {
    return invalidResult('Analysis complete payload must be an object');
  }

  const p = payload as Record<string, unknown>;
  const validations: ValidationResult[] = [];

  if (!Array.isArray(p["reports"])) {
    validations.push(invalidResult('reports must be an array'));
  }

  if (typeof p["summary"] !== 'object' || p["summary"] === null) {
    validations.push(invalidResult('summary must be an object'));
  }

  if (p["timestamp"] !== undefined) {
    validations.push(validateTimestamp(p["timestamp"], 'timestamp'));
  }

  return combineResults(...validations);
}

/**
 * Validate ERROR message payload
 */
export function validateErrorPayload(payload: unknown): ValidationResult {
  if (typeof payload !== 'object' || payload === null) {
    return invalidResult('Error payload must be an object');
  }

  const p = payload as Record<string, unknown>;
  const validations: ValidationResult[] = [];

  validations.push(validateNonEmptyString(p["code"], 'code'));
  validations.push(validateNonEmptyString(p["message"], 'message'));

  if (p["stack"] !== undefined && typeof p["stack"] !== 'string') {
    validations.push(invalidResult('stack must be a string'));
  }

  if (p["source"] !== undefined && typeof p["source"] !== 'string') {
    validations.push(invalidResult('source must be a string'));
  }

  if (p["timestamp"] !== undefined) {
    validations.push(validateTimestamp(p["timestamp"], 'timestamp'));
  }

  return combineResults(...validations);
}

/**
 * Main message validation function
 * Validates the complete message structure based on type
 */
export function validateMessage(message: unknown): ValidationResult {
  // Validate base structure
  const baseValidation = validateBaseMessage(message);
  if (!baseValidation.valid) {
    return baseValidation;
  }

  const msg = message as ExtensionMessage;

  // Type-specific payload validation
  switch (msg["type"]) {
    case MessageTypeEnum.COMMIT:
      if (msg.payload === undefined) {
        return invalidResult('COMMIT message must have a payload');
      }
      return validateCommitPayload(msg.payload);

    case MessageTypeEnum.START_PROFILING:
      if (msg.payload !== undefined) {
        return validateStartProfilingPayload(msg.payload);
      }
      return VALID_RESULT;

    case MessageTypeEnum.STOP_PROFILING:
      if (msg.payload !== undefined) {
        return validateStopProfilingPayload(msg.payload);
      }
      return VALID_RESULT;

    case MessageTypeEnum.ANALYSIS_COMPLETE:
      if (msg.payload === undefined) {
        return invalidResult('ANALYSIS_COMPLETE message must have a payload');
      }
      return validateAnalysisCompletePayload(msg.payload);

    case MessageTypeEnum.ERROR:
      if (msg.payload === undefined) {
        return invalidResult('ERROR message must have a payload');
      }
      return validateErrorPayload(msg.payload);

    default:
      // Other message types don't require specific payload validation
      return VALID_RESULT;
  }
}

// ============================================================================
// Message Sending Utilities
// ============================================================================

/**
 * Send a message to the background script
 */
export function sendToBackground<T = unknown>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response as T);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send a message to a content script in a specific tab
 */
export function sendToContent<T = unknown>(tabId: number, message: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response as T);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send a message to all tabs
 */
export async function broadcastToAllTabs(
  message: ExtensionMessage,
  filter?: { url?: string; active?: boolean }
): Promise<void> {
  const tabs = await chrome.tabs.query({
    ...(filter?.url && { url: filter.url }),
    ...(filter?.active !== undefined && { active: filter.active }),
  });

  await Promise.all(
    tabs.map((tab) => {
      if (tab.id !== undefined) {
        return sendToContent(tab.id, message).catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
      }
      return Promise.resolve();
    })
  );
}

// ============================================================================
// Connection Status Utilities
// ============================================================================

/**
 * Check if the extension runtime is available
 */
export function isExtensionAvailable(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
}

/**
 * Ping the background script to check connectivity
 */
export async function pingBackground(timeoutMs = 5000): Promise<boolean> {
  if (!isExtensionAvailable()) {
    return false;
  }

  const pingMessage = createPingMessage();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);

    chrome.runtime.sendMessage(pingMessage, () => {
      clearTimeout(timeout);
      resolve(!chrome.runtime.lastError);
    });
  });
}

/**
 * Wait for extension to become available
 */
export function waitForExtension(maxAttempts = 10, intervalMs = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      if (isExtensionAvailable()) {
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error('Extension not available after maximum attempts'));
      } else {
        setTimeout(check, intervalMs);
      }
    };

    check();
  });
}
