/**
 * RSC (React Server Components) Analysis Web Worker
 * Offloads RSC parsing and analysis from the main thread
 * @module panel/workers/rscAnalysisWorker
 */

import type { FiberData } from '@/shared/types';
import type {
  RSCPayload,
  RSCMetrics,
  RSCBoundary,
  RSCAnalysisResult,
  RSCIssue,
  RSCRecommendation,
  RSCAnalysisConfig,
} from '@/shared/types/rsc';
import { DEFAULT_RSC_ANALYSIS_CONFIG } from '@/shared/types/rsc';

// Import RSC parser functions - these run in the worker context
import {
  parseRSCPayload,
  extractRSCMetrics,
  detectRSCBoundaries,
  analyzeBoundaryCrossings,
} from '@/panel/utils/rscParser';

// ============================================================================
// Worker Message Types
// ============================================================================

/** Request types sent to the RSC worker */
export type RSCWorkerRequestType =
  | 'PARSE_PAYLOAD'
  | 'EXTRACT_METRICS'
  | 'DETECT_BOUNDARIES'
  | 'ANALYZE_BOUNDARY_CROSSINGS'
  | 'ANALYZE_ALL';

/** Response types sent from the RSC worker */
export type RSCWorkerResponseType =
  | 'PAYLOAD_PARSED'
  | 'METRICS_EXTRACTED'
  | 'BOUNDARIES_DETECTED'
  | 'CROSSINGS_ANALYZED'
  | 'ANALYSIS_COMPLETE'
  | 'ERROR';

/** Request message sent to the worker */
export interface RSCWorkerRequest {
  /** Unique identifier for request/response matching */
  id: string;
  /** Type of analysis to perform */
  type: RSCWorkerRequestType;
  /** Request payload */
  payload: unknown;
}

/** Response message sent from the worker */
export interface RSCWorkerResponse {
  /** Request ID for matching */
  id: string;
  /** Type of response */
  type: RSCWorkerResponseType;
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

interface ParsePayloadRequest {
  /** Raw payload data (string or object) */
  data: string | object;
}

interface ExtractMetricsRequest {
  /** Parsed RSC payload */
  payload: RSCPayload;
}

interface DetectBoundariesRequest {
  /** Fiber data to analyze */
  fiberData: FiberData[];
}

interface AnalyzeCrossingsRequest {
  /** Parsed RSC payload */
  payload: RSCPayload;
}

interface AnalyzeAllRequest {
  /** Raw payload data (string or object) or array of payloads */
  payloads: (string | object)[];
  /** Optional fiber data for boundary detection */
  fiberData?: FiberData[];
  /** Analysis configuration */
  config?: Partial<RSCAnalysisConfig>;
}

// ============================================================================
// Main Message Handler
// ============================================================================

/**
 * Main message handler for the RSC worker
 * Routes incoming messages to the appropriate handler
 */
self.onmessage = (event: MessageEvent<RSCWorkerRequest>) => {
  const { id, type, payload } = event.data;
  const startTime = performance.now();

  try {
    switch (type) {
      case 'PARSE_PAYLOAD':
        handleParsePayload(id, payload as ParsePayloadRequest, startTime);
        break;
      case 'EXTRACT_METRICS':
        handleExtractMetrics(id, payload as ExtractMetricsRequest, startTime);
        break;
      case 'DETECT_BOUNDARIES':
        handleDetectBoundaries(id, payload as DetectBoundariesRequest, startTime);
        break;
      case 'ANALYZE_BOUNDARY_CROSSINGS':
        handleAnalyzeCrossings(id, payload as AnalyzeCrossingsRequest, startTime);
        break;
      case 'ANALYZE_ALL':
        handleAnalyzeAll(id, payload as AnalyzeAllRequest, startTime);
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
 * Handles parsing of RSC payload data
 */
function handleParsePayload(
  id: string,
  request: ParsePayloadRequest,
  startTime: number
): void {
  const { data } = request;

  // Validate input
  if (data === null || data === undefined) {
    throw new Error('Invalid data: expected string or object');
  }

  // Parse the payload
  const payload = parseRSCPayload(data);

  sendResponse(id, 'PAYLOAD_PARSED', payload, startTime);
}

/**
 * Handles extraction of metrics from parsed RSC payload
 */
function handleExtractMetrics(
  id: string,
  request: ExtractMetricsRequest,
  startTime: number
): void {
  const { payload } = request;

  // Validate input
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: expected RSCPayload object');
  }

  // Extract metrics
  const metrics = extractRSCMetrics(payload);

  sendResponse(id, 'METRICS_EXTRACTED', metrics, startTime);
}

/**
 * Handles detection of RSC boundaries from fiber data
 */
function handleDetectBoundaries(
  id: string,
  request: DetectBoundariesRequest,
  startTime: number
): void {
  const { fiberData } = request;

  // Validate input
  if (!Array.isArray(fiberData)) {
    throw new Error('Invalid fiberData: expected array');
  }

  // Detect boundaries
  const boundaries = detectRSCBoundaries(fiberData);

  sendResponse(id, 'BOUNDARIES_DETECTED', boundaries, startTime);
}

/**
 * Handles analysis of boundary crossings
 */
function handleAnalyzeCrossings(
  id: string,
  request: AnalyzeCrossingsRequest,
  startTime: number
): void {
  const { payload } = request;

  // Validate input
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: expected RSCPayload object');
  }

  // Analyze boundary crossings
  const crossings = analyzeBoundaryCrossings(payload);

  sendResponse(id, 'CROSSINGS_ANALYZED', crossings, startTime);
}

/**
 * Handles complete RSC analysis
 * Parses payloads, extracts metrics, detects issues, and generates recommendations
 */
function handleAnalyzeAll(
  id: string,
  request: AnalyzeAllRequest,
  startTime: number
): void {
  const { payloads, fiberData, config: userConfig } = request;

  // Validate input
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new Error('Invalid payloads: expected non-empty array');
  }

  // Merge with default config
  const config: RSCAnalysisConfig = {
    ...DEFAULT_RSC_ANALYSIS_CONFIG,
    ...userConfig,
  };

  // Parse all payloads
  const parsedPayloads: RSCPayload[] = [];
  for (const data of payloads) {
    try {
      const payload = parseRSCPayload(data);
      parsedPayloads.push(payload);
    } catch (error) {
      // Continue with other payloads if one fails
      console.warn('Failed to parse RSC payload:', error);
    }
  }

  if (parsedPayloads.length === 0) {
    throw new Error('No valid payloads to analyze');
  }

  // Aggregate metrics from all payloads
  const aggregatedMetrics = aggregateMetrics(parsedPayloads);

  // Note: Boundary crossings analysis available via individual payloads if needed

  // Detect boundaries from fiber data if provided
  let boundaries: RSCBoundary[] = [];
  if (fiberData && Array.isArray(fiberData)) {
    boundaries = detectRSCBoundaries(fiberData);
  } else {
    // Collect boundaries from all payloads
    for (const payload of parsedPayloads) {
      boundaries.push(...payload.boundaries);
    }
  }

  // Detect issues
  const issues = detectIssues(parsedPayloads, aggregatedMetrics, boundaries, config);

  // Generate recommendations
  const recommendations = generateRecommendations(issues, parsedPayloads, config);

  // Calculate performance score
  const performanceScore = calculatePerformanceScore(aggregatedMetrics, issues);

  // Build analysis result
  const firstPayload = parsedPayloads[0];
  const result: RSCAnalysisResult = {
    id: generateId(),
    timestamp: Date.now(),
    payloadId: firstPayload ? firstPayload.id : 'unknown',
    metrics: aggregatedMetrics,
    issues,
    recommendations,
    performanceScore,
    summary: {
      totalIssues: issues.length,
      criticalIssues: issues.filter((i) => i.severity === 'critical').length,
      highIssues: issues.filter((i) => i.severity === 'high').length,
      mediumIssues: issues.filter((i) => i.severity === 'medium').length,
      lowIssues: issues.filter((i) => i.severity === 'low').length,
      topOpportunity: recommendations.length > 0 ? recommendations[0]?.description : undefined,
      estimatedTotalSavings: recommendations.reduce(
        (sum, r) => sum + r.expectedImpact.timeSavings,
        0
      ),
    },
  };

  sendResponse(id, 'ANALYSIS_COMPLETE', result, startTime);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Aggregates metrics from multiple payloads
 */
function aggregateMetrics(payloads: RSCPayload[]): RSCMetrics {
  let totalPayloadSize = 0;
  let totalTransferTime = 0;
  let totalSerializationCost = 0;
  let totalDeserializationCost = 0;
  let totalServerComponents = 0;
  let totalClientComponents = 0;
  let totalBoundaries = 0;
  let totalCacheHits = 0;
  let totalCacheMisses = 0;

  const allBoundaryMetrics: NonNullable<RSCMetrics['boundaryMetrics']> = [];
  const allChunkSizes: number[] = [];
  let totalChunks = 0;
  let boundaryChunks = 0;

  for (const payload of payloads) {
    const metrics = extractRSCMetrics(payload);

    totalPayloadSize += metrics.payloadSize;
    totalTransferTime += metrics.transferTime;
    totalSerializationCost += metrics.serializationCost;
    totalDeserializationCost += metrics.deserializationCost;
    totalServerComponents += metrics.serverComponentCount;
    totalClientComponents += metrics.clientComponentCount;
    totalBoundaries += metrics.boundaryCount;

    if (metrics.boundaryMetrics) {
      allBoundaryMetrics.push(...metrics.boundaryMetrics);
    }

    if (metrics.streamMetrics) {
      totalChunks += metrics.streamMetrics.chunkCount;
      boundaryChunks += metrics.streamMetrics.boundaryChunks;
      allChunkSizes.push(
        metrics.streamMetrics.averageChunkSize * metrics.streamMetrics.chunkCount
      );
    }

    // Count cache hits/misses
    for (const boundary of payload.boundaries) {
      if (boundary.cacheStatus === 'hit') {
        totalCacheHits++;
      } else if (boundary.cacheStatus === 'miss') {
        totalCacheMisses++;
      }
    }
  }

  const cacheHitRatio =
    totalCacheHits + totalCacheMisses > 0
      ? totalCacheHits / (totalCacheHits + totalCacheMisses)
      : 0;

  // Calculate aggregated stream metrics
  const avgChunkSize =
    allChunkSizes.length > 0
      ? allChunkSizes.reduce((a, b) => a + b, 0) / totalChunks
      : 0;

  const streamMetrics: RSCMetrics['streamMetrics'] = {
    chunkCount: totalChunks,
    averageChunkSize: avgChunkSize,
    maxChunkSize: allChunkSizes.length > 0 ? Math.max(...allChunkSizes) : 0,
    minChunkSize: allChunkSizes.length > 0 ? Math.min(...allChunkSizes) : 0,
    boundaryChunks,
    interleavedChunks: 0,
    timeToFirstChunk: 0,
    streamDuration: 0,
    suspenseResolutions: 0,
    hadOutOfOrderChunks: false,
  };

  return {
    payloadSize: totalPayloadSize,
    transferTime: totalTransferTime,
    serializationCost: totalSerializationCost,
    deserializationCost: totalDeserializationCost,
    serverComponentCount: totalServerComponents,
    clientComponentCount: totalClientComponents,
    boundaryCount: totalBoundaries,
    boundaryMetrics: allBoundaryMetrics,
    streamMetrics,
    cacheHitRatio,
  };
}

/**
 * Detects issues in RSC payloads
 */
function detectIssues(
  _payloads: RSCPayload[],
  metrics: RSCMetrics,
  boundaries: RSCBoundary[],
  config: RSCAnalysisConfig
): RSCIssue[] {
  const issues: RSCIssue[] = [];

  // Check for oversized payload
  if (metrics.payloadSize > config.maxPayloadSize) {
    issues.push({
      id: generateId(),
      type: 'large-payload',
      description: `Payload size (${formatBytes(metrics.payloadSize)}) exceeds threshold (${formatBytes(config.maxPayloadSize)})`,
      severity: metrics.payloadSize > config.maxPayloadSize * 2 ? 'critical' : 'high',
      metricValue: metrics.payloadSize,
      threshold: config.maxPayloadSize,
      suggestion: 'Consider splitting the payload into smaller chunks or using streaming.',
    });
  }

  // Check for low cache hit ratio
  if (metrics.cacheHitRatio < config.minCacheHitRatio) {
    issues.push({
      id: generateId(),
      type: 'cache-miss',
      description: `Cache hit ratio (${(metrics.cacheHitRatio * 100).toFixed(1)}%) is below threshold (${(config.minCacheHitRatio * 100).toFixed(0)}%)`,
      severity: metrics.cacheHitRatio < 0.5 ? 'critical' : 'high',
      metricValue: metrics.cacheHitRatio,
      threshold: config.minCacheHitRatio,
      suggestion: 'Consider adding caching to boundaries or optimizing cache keys.',
    });
  }

  // Check boundaries for issues
  for (const boundary of boundaries) {
    // Check for oversized props
    if (boundary.propsSize > config.maxPropsSize) {
      issues.push({
        id: generateId(),
        type: 'oversized-props',
        description: `Boundary "${boundary.componentName}" has oversized props (${formatBytes(boundary.propsSize)})`,
        severity: boundary.propsSize > config.maxPropsSize * 2 ? 'critical' : 'high',
        componentName: boundary.componentName,
        boundaryId: boundary.id,
        metricValue: boundary.propsSize,
        threshold: config.maxPropsSize,
        suggestion: 'Reduce props size by removing unnecessary data or using references.',
      });
    }

    // Check for missing cache config
    if (!boundary.cacheStatus || boundary.cacheStatus === 'none') {
      // Only flag server components without cache
      if (boundary.type === 'server') {
        issues.push({
          id: generateId(),
          type: 'missing-cache-config',
          description: `Server boundary "${boundary.componentName}" has no cache configuration`,
          severity: 'medium',
          componentName: boundary.componentName,
          boundaryId: boundary.id,
          suggestion: 'Consider adding caching to improve performance.',
        });
      }
    }
  }

  // Check for unnecessary client boundaries
  const clientBoundaryCount = boundaries.filter((b) => b.type === 'client').length;
  const serverBoundaryCount = boundaries.filter((b) => b.type === 'server').length;
  if (clientBoundaryCount > serverBoundaryCount && clientBoundaryCount > 5) {
    issues.push({
      id: generateId(),
      type: 'unnecessary-boundary',
      description: `High number of client boundaries (${clientBoundaryCount}) detected`,
      severity: 'medium',
      metricValue: clientBoundaryCount,
      suggestion: 'Consider moving some client components to server components where possible.',
    });
  }

  // Check serialization cost
  if (metrics.serializationCost > 10) {
    // 10ms threshold
    issues.push({
      id: generateId(),
      type: 'serialization-cost',
      description: `High serialization cost detected (${metrics.serializationCost.toFixed(2)}ms)`,
      severity: metrics.serializationCost > 50 ? 'high' : 'medium',
      metricValue: metrics.serializationCost,
      threshold: 10,
      suggestion: 'Optimize data structures to reduce serialization overhead.',
    });
  }

  return issues;
}

/**
 * Generates recommendations based on detected issues
 */
function generateRecommendations(
  issues: RSCIssue[],
  payloads: RSCPayload[],
  _config: RSCAnalysisConfig
): RSCRecommendation[] {
  const recommendations: RSCRecommendation[] = [];
  const seenTypes = new Set<string>();

  for (const issue of issues) {
    // Avoid duplicate recommendation types
    if (seenTypes.has(issue.type)) continue;
    seenTypes.add(issue.type);

    switch (issue.type) {
      case 'large-payload':
        recommendations.push({
          id: generateId(),
          type: 'streaming-optimization',
          priority: issue.severity === 'critical' ? 'critical' : 'high',
          description: 'Enable or optimize streaming for large payloads',
          affectedComponents: ['Root'],
          expectedImpact: {
            timeSavings: metricsEstimate(payloads, 'transferTime') * 0.3,
            sizeReduction: 0,
            cacheHitImprovement: 0,
          },
          codeExample: `// Use streaming for large data
const stream = renderToReadableStream(<App />, {
  onError: (error) => console.error(error),
});`,
        });
        break;

      case 'cache-miss':
        recommendations.push({
          id: generateId(),
          type: 'add-cache',
          priority: 'high',
          description: 'Add caching to improve boundary cache hit ratio',
          affectedComponents: issues
            .filter((i) => i.type === 'cache-miss' && i.componentName)
            .map((i) => i.componentName!),
          expectedImpact: {
            timeSavings: metricsEstimate(payloads, 'serializationCost') * 0.5,
            sizeReduction: 0,
            cacheHitImprovement: 0.3,
          },
          codeExample: `// Add cache configuration
export const revalidate = 3600; // Revalidate every hour

// Or use unstable_cache for specific functions
import { unstable_cache } from 'next/cache';

const getData = unstable_cache(async () => {
  return fetchData();
}, ['data-key'], { revalidate: 3600 });`,
        });
        break;

      case 'oversized-props':
        recommendations.push({
          id: generateId(),
          type: 'optimize-props',
          priority: issue.severity === 'critical' ? 'critical' : 'high',
          description: 'Optimize props passing across boundaries',
          affectedComponents: issues
            .filter((i) => i.type === 'oversized-props' && i.componentName)
            .map((i) => i.componentName!),
          expectedImpact: {
            timeSavings: metricsEstimate(payloads, 'serializationCost') * 0.4,
            sizeReduction: metricsEstimate(payloads, 'payloadSize') * 0.2,
            cacheHitImprovement: 0,
          },
          codeExample: `// Instead of passing large objects:
// ❌ <ClientComponent userData={fullUserData} />

// Pass only needed data:
// ✅ <ClientComponent userId={user.id} />

// Or use data references
// ✅ <ClientComponent userRef={userRef} />`,
        });
        break;

      case 'unnecessary-boundary':
        recommendations.push({
          id: generateId(),
          type: 'move-to-server',
          priority: 'medium',
          description: 'Move components from client to server where possible',
          affectedComponents: [],
          expectedImpact: {
            timeSavings: metricsEstimate(payloads, 'transferTime') * 0.2,
            sizeReduction: metricsEstimate(payloads, 'payloadSize') * 0.15,
            cacheHitImprovement: 0.1,
          },
          codeExample: `// Remove 'use client' if component doesn't need client features
// ❌ 'use client'
// export function ServerComponent() { ... }

// ✅ No directive needed for server components
export function ServerComponent() { ... }`,
        });
        break;

      case 'missing-cache-config':
        recommendations.push({
          id: generateId(),
          type: 'add-cache',
          priority: 'medium',
          description: 'Add cache configuration to server boundaries',
          affectedComponents: issues
            .filter((i) => i.type === 'missing-cache-config' && i.componentName)
            .map((i) => i.componentName!),
          expectedImpact: {
            timeSavings: 50,
            sizeReduction: 0,
            cacheHitImprovement: 0.2,
          },
        });
        break;

      case 'serialization-cost':
        recommendations.push({
          id: generateId(),
          type: 'optimize-props',
          priority: 'medium',
          description: 'Reduce serialization overhead by simplifying data structures',
          affectedComponents: [],
          expectedImpact: {
            timeSavings: metricsEstimate(payloads, 'serializationCost') * 0.5,
            sizeReduction: 0,
            cacheHitImprovement: 0,
          },
        });
        break;
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * Calculates overall performance score
 */
function calculatePerformanceScore(metrics: RSCMetrics, issues: RSCIssue[]): number {
  let score = 100;

  // Deduct for large payload
  const payloadSizeMB = metrics.payloadSize / (1024 * 1024);
  if (payloadSizeMB > 1) {
    score -= Math.min(30, Math.round(payloadSizeMB * 10));
  }

  // Deduct for low cache hit ratio
  score -= Math.round((1 - metrics.cacheHitRatio) * 20);

  // Deduct for issues
  score -= issues.filter((i) => i.severity === 'critical').length * 15;
  score -= issues.filter((i) => i.severity === 'high').length * 10;
  score -= issues.filter((i) => i.severity === 'medium').length * 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Estimates a metric value from payloads
 */
function metricsEstimate(
  payloads: RSCPayload[],
  metric: 'transferTime' | 'serializationCost' | 'payloadSize'
): number {
  const values = payloads.map((p) => {
    const m = extractRSCMetrics(p);
    return m[metric] || 0;
  });
  return values.reduce((a, b) => a + b, 0);
}



/**
 * Formats bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Generates a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Sends a successful response back to the main thread
 */
function sendResponse(
  id: string,
  type: RSCWorkerResponseType,
  result: unknown,
  startTime: number
): void {
  const duration = performance.now() - startTime;
  const response: RSCWorkerResponse = {
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

  const response: RSCWorkerResponse = {
    id,
    type: 'ERROR',
    error: errorMessage,
    duration,
  };
  self.postMessage(response);
}

// Export functions for testing
export {
  aggregateMetrics,
  detectIssues,
  generateRecommendations,
  calculatePerformanceScore,
  formatBytes,
};
