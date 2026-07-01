/**
 * Shared TypeScript types for React Perf Profiler.
 *
 * This file is the superset of types used throughout the extension. It re-exports
 * the canonical profile data contract from @repo/profile-contract (the single
 * source of truth shared with the web API) and adds extension-only types:
 * FiberTag/PriorityLevel enums, FiberNode/WebVitalMetric UI shapes, messaging
 * types, and UI store types.
 *
 * Importing from `@/src/shared/types` continues to work for every existing
 * consumer in the extension.
 */

// Re-export the canonical data contract — single source of truth.
// (Type-only re-exports. The web API additionally imports the Zod schemas
// from `@repo/profile-contract/schema` for runtime validation.)
export type {
  Severity,
  SourceLocation,
  FiberData,
  FiberNode,
  RenderCauseType,
  RenderCauseEntry,
  RenderCause,
  PriorityLevelString,
  InteractionData,
  CommitData,
  ComponentMetrics,
  WastedRenderIssueType,
  WastedRenderIssue,
  WastedRenderAction,
  WastedRenderReport,
  MemoIssueType,
  MemoIssue,
  MemoRecommendationType,
  MemoRecommendation,
  MemoReport,
  MemoEffectivenessReport,
  OptimizationType,
  Impact,
  OptimizationOpportunity,
  AnomalyReportEntry,
  AnomalyReportGroup,
  TrendDirection,
  TrendReportEntry,
  RenderPattern,
  PatternReportEntry,
  AnalysisResult,
} from '@repo/profile-contract';

// ---------------------------------------------------------------------------
// Extension-only enums (not part of the on-the-wire contract)
// ---------------------------------------------------------------------------

export enum FiberTag {
  FunctionComponent = 0,
  ClassComponent = 1,
  IndeterminateComponent = 2,
  HostRoot = 3,
  HostPortal = 4,
  HostComponent = 5,
  HostText = 6,
  Fragment = 7,
  Mode = 8,
  ContextConsumer = 9,
  ContextProvider = 10,
  ForwardRef = 11,
  Profiler = 12,
  SuspenseComponent = 13,
  MemoComponent = 14,
  SimpleMemoComponent = 15,
  LazyComponent = 16,
  IncompleteClassComponent = 17,
  DehydratedFragment = 18,
  SuspenseListComponent = 19,
  ScopeComponent = 21,
  OffscreenComponent = 22,
  LegacyHiddenComponent = 23,
  CacheComponent = 24,
  TracingMarkerComponent = 25,
}

export enum PriorityLevel {
  NoPriority = 0,
  ImmediatePriority = 1,
  UserBlockingPriority = 2,
  NormalPriority = 3,
  LowPriority = 4,
  IdlePriority = 5,
}

// ---------------------------------------------------------------------------
// Extension-only UI types
// ---------------------------------------------------------------------------

export interface WebVitalMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  element?: string | null;
  url?: string | null;
  delta?: number;
}

export interface ProfilerConfig {
  maxCommits: number;
  maxNodesPerCommit: number;
  analysisWorkerCount: number;
  enableTimeTravel: boolean;
  maxComponentDataEntries: number;
  wastedRenderThreshold: number;
}

export type Theme = 'light' | 'dark' | 'system';

export interface AnalysisSummary {
  totalCommits: number;
  totalComponents: number;
  wastedRenderCount: number;
  memoIssueCount: number;
  performanceScore: number;
  timestamp: number;
}

export interface DataFilters {
  componentName?: string;
  severity?: Severity;
  minRenderCount?: number;
  minWastedRate?: number;
  memoizedOnly?: boolean;
  issuesOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Extension messaging types (intra-extension; not part of the API contract)
// ---------------------------------------------------------------------------

// Locally import the contract types we reference in this section.
import type { Severity, CommitData, AnalysisResult } from '@repo/profile-contract';

export type MessageType =
  | 'START_PROFILING'
  | 'STOP_PROFILING'
  | 'CLEAR_DATA'
  | 'INIT'
  | 'PING'
  | 'PONG'
  | 'GET_DATA'
  | 'COMMIT'
  | 'COMMIT_DATA'
  | 'COMPONENT_SELECTED'
  | 'ANALYSIS_COMPLETE'
  | 'ERROR'
  | string;

export interface BaseExtensionMessage {
  type: MessageType;
  messageId?: string;
  timestamp?: number;
  tabId?: number;
  payload?: unknown;
}

export type ExtensionMessage =
  | {
      type:
        | 'START_PROFILING'
        | 'STOP_PROFILING'
        | 'CLEAR_DATA'
        | 'INIT'
        | 'PING'
        | 'PONG'
        | 'GET_DATA';
      tabId?: number;
      payload?: unknown;
      messageId?: string;
      timestamp?: number;
    }
  | {
      type: 'COMMIT_DATA' | 'COMMIT';
      payload: CommitData;
      tabId?: number;
      messageId?: string;
      timestamp?: number;
    }
  | {
      type: 'COMPONENT_SELECTED';
      payload: { componentName: string };
      tabId?: number;
      messageId?: string;
      timestamp?: number;
    }
  | {
      type: 'ANALYSIS_COMPLETE';
      payload: AnalysisResult;
      tabId?: number;
      messageId?: string;
      timestamp?: number;
    }
  | {
      type: 'ERROR';
      payload: { message: string; error?: unknown };
      tabId?: number;
      messageId?: string;
      timestamp?: number;
    }
  | { type: string; payload?: unknown; tabId?: number; messageId?: string; timestamp?: number }
  | BaseExtensionMessage;

// Bridge message types
export interface BridgeMessage {
  source: 'react-perf-profiler-bridge';
  token?: string;
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
}

// Background message types
export interface BackgroundMessage {
  type: string;
  payload?: unknown;
  error?: string;
  tabId?: number;
}

export interface ConnectionState {
  isConnected: boolean;
  port: RuntimePort | null;
  lastPing: number;
}

// WXT uses `browser` from `wxt/browser` which has the same shape as chrome.runtime.Port
export type RuntimePort = {
  postMessage: (msg: unknown) => void;
  disconnect: () => void;
  onMessage: { addListener: (fn: (msg: unknown) => void) => void };
  onDisconnect: { addListener: (fn: () => void) => void };
};
