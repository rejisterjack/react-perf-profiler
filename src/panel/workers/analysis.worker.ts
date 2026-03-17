/**
 * Main analysis Web Worker
 * Offloads heavy analysis operations from the main thread
 */

import type { CommitData } from '@/shared/types';
import type {
  WastedRenderReport,
  WastedRenderConfig,
} from '@/panel/utils/wastedRenderAnalysis';
import type {
  MemoEffectivenessReport,
  MemoAnalysisConfig,
  ComponentMetrics,
} from '@/panel/utils/memoAnalysis';
import type {
  PerformanceMetrics,
  PerformanceScoreConfig,
} from '@/panel/utils/performanceScore';
import type { TimelineData, TimelineConfig } from '@/panel/utils/timelineGenerator';
import type { FlamegraphData } from './flamegraphGenerator';

// Import analysis functions - these run in the worker context
import { analyzeWastedRenders } from '@/panel/utils/wastedRenderAnalysis';
import { analyzeMemoEffectiveness } from '@/panel/utils/memoAnalysis';
import { calculatePerformanceScore } from '@/panel/utils/performanceScore';
import { generateTimeline } from '@/panel/utils/timelineGenerator';
import { generateFlamegraphData, filterSmallNodes } from './flamegraphGenerator';

// ============================================================================
// Worker Message Types
// ============================================================================

/** Request types sent to the worker */
export type WorkerRequestType =
  | 'ANALYZE_COMMITS'
  | 'GENERATE_FLAMEGRAPH'
  | 'GENERATE_TIMELINE'
  | 'CALCULATE_SCORE';

/** Response types sent from the worker */
export type WorkerResponseType =
  | 'ANALYSIS_COMPLETE'
  | 'FLAMEGRAPH_READY'
  | 'TIMELINE_READY'
  | 'SCORE_READY'
  | 'ERROR';

/** Request message sent to the worker */
export interface WorkerRequest {
  /** Unique identifier for request/response matching */
  id: string;
  /** Type of analysis to perform */
  type: WorkerRequestType;
  /** Request payload */
  payload: unknown;
}

/** Response message sent from the worker */
export interface WorkerResponse {
  /** Request ID for matching */
  id: string;
  /** Type of response */
  type: WorkerResponseType;
  /** Response data (on success) */
  result?: unknown;
  /** Error message (on failure) */
  error?: string;
  /** Processing duration in milliseconds */
  duration: number;
}

// ============================================================================
// Request Payload Types
// ============================================================================

interface AnalyzeCommitsPayload {
  commits: CommitData[];
  config?: WastedRenderConfig;
}

interface GenerateFlamegraphPayload {
  commit: CommitData;
  threshold?: number;
}

interface GenerateTimelinePayload {
  commits: CommitData[];
  config?: TimelineConfig;
}

interface CalculateScorePayload {
  commits: CommitData[];
  wastedRenderReports: WastedRenderReport[];
  memoReports: MemoEffectivenessReport[];
  config?: PerformanceScoreConfig;
}

// ============================================================================
// Main Message Handler
// ============================================================================

/**
 * Main message handler for the worker
 * Routes incoming messages to the appropriate handler
 */
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;
  const startTime = performance.now();

  try {
    switch (type) {
      case 'ANALYZE_COMMITS':
        handleAnalyzeCommits(id, payload as AnalyzeCommitsPayload, startTime);
        break;
      case 'GENERATE_FLAMEGRAPH':
        handleGenerateFlamegraph(id, payload as GenerateFlamegraphPayload, startTime);
        break;
      case 'GENERATE_TIMELINE':
        handleGenerateTimeline(id, payload as GenerateTimelinePayload, startTime);
        break;
      case 'CALCULATE_SCORE':
        handleCalculateScore(id, payload as CalculateScorePayload, startTime);
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    sendError(id, error, startTime);
  }
};

// ============================================================================
// Handler Implementations
// ============================================================================

/**
 * Handles wasted render analysis for multiple commits
 * Processes commit history and identifies wasted renders
 */
function handleAnalyzeCommits(
  id: string,
  payload: AnalyzeCommitsPayload,
  startTime: number
): void {
  const { commits, config } = payload;

  // Validate input
  if (!Array.isArray(commits)) {
    throw new Error('Invalid commits: expected array');
  }

  // Perform analysis
  const reports = analyzeWastedRenders(commits, config);

  sendResponse(id, 'ANALYSIS_COMPLETE', reports, startTime);
}

/**
 * Handles flamegraph data generation
 * Converts commit data to hierarchical format for D3 visualization
 */
function handleGenerateFlamegraph(
  id: string,
  payload: GenerateFlamegraphPayload,
  startTime: number
): void {
  const { commit, threshold } = payload;

  // Validate input
  if (!commit || typeof commit !== 'object') {
    throw new Error('Invalid commit: expected object');
  }

  // Generate flamegraph data
  let flamegraphData = generateFlamegraphData(commit);

  // Apply threshold filter if specified
  if (threshold !== undefined && threshold > 0) {
    const filteredRoot = filterSmallNodes(flamegraphData.root, threshold);
    flamegraphData = {
      ...flamegraphData,
      root: filteredRoot,
      nodeCount: countNodes(filteredRoot),
    };
  }

  sendResponse(id, 'FLAMEGRAPH_READY', flamegraphData, startTime);
}

/**
 * Handles timeline generation
 * Creates chronological event list from commit data
 */
function handleGenerateTimeline(
  id: string,
  payload: GenerateTimelinePayload,
  startTime: number
): void {
  const { commits, config } = payload;

  // Validate input
  if (!Array.isArray(commits)) {
    throw new Error('Invalid commits: expected array');
  }

  // Generate timeline
  const timeline = generateTimeline(commits, config);

  sendResponse(id, 'TIMELINE_READY', timeline, startTime);
}

/**
 * Handles performance score calculation
 * Calculates overall performance metrics from analysis results
 */
function handleCalculateScore(
  id: string,
  payload: CalculateScorePayload,
  startTime: number
): void {
  const { commits, wastedRenderReports, memoReports, config } = payload;

  // Validate input
  if (!Array.isArray(commits)) {
    throw new Error('Invalid commits: expected array');
  }
  if (!Array.isArray(wastedRenderReports)) {
    throw new Error('Invalid wastedRenderReports: expected array');
  }
  if (!Array.isArray(memoReports)) {
    throw new Error('Invalid memoReports: expected array');
  }

  // Calculate performance metrics
  const metrics = calculatePerformanceScore(
    commits,
    wastedRenderReports,
    memoReports,
    config
  );

  sendResponse(id, 'SCORE_READY', metrics, startTime);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sends a successful response back to the main thread
 */
function sendResponse(
  id: string,
  type: WorkerResponseType,
  result: unknown,
  startTime: number
): void {
  const duration = performance.now() - startTime;
  const response: WorkerResponse = {
    id,
    type,
    result,
    duration,
  };
  self.postMessage(response);
}

/**
 * Sends an error response back to the main thread
 */
function sendError(id: string, error: unknown, startTime: number): void {
  const duration = performance.now() - startTime;
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const response: WorkerResponse = {
    id,
    type: 'ERROR',
    error: errorMessage,
    duration,
  };
  self.postMessage(response);
}

/**
 * Counts total nodes in a flamegraph tree
 */
function countNodes(node: { children: { children: unknown[] }[] }): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child as { children: { children: unknown[] }[] });
  }
  return count;
}

// Export for TypeScript module resolution
export {};
