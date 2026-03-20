/**
 * React Server Components (RSC) Analysis Types
 * @module shared/types/rsc
 *
 * Type definitions for analyzing React Server Components performance,
 * including payload structures, metrics, and optimization recommendations.
 */

/**
 * Component type classification for RSC architecture
 * - 'server': Server Components that render only on the server
 * - 'client': Client Components that hydrate and run in the browser
 * - 'shared': Components that can work in both environments
 */
export type ComponentType = 'server' | 'client' | 'shared';

/**
 * Reference markers used in RSC payloads for serialization
 * These prefixes indicate how to interpret the serialized data
 */
export enum RSCReferenceMarker {
  /** Reference to a React element */
  Element = '$',
  /** Reference to a client component module */
  ClientReference = '@',
  /** Reference to a server action */
  ServerAction = '#',
  /** Symbol reference */
  Symbol = '$S',
  /** Form state reference */
  FormState = '$F',
  /** Promise/stream reference */
  Promise = '$L',
}

/**
 * Represents a serialized React element from the server
 * Uses special markers (e.g., '$' for refs) for RSC streaming protocol
 */
export interface RSCElement {
  /** Unique identifier for the element */
  id: string;
  /** Component type identifier with reference marker */
  type: string | RSCReferenceMarker;
  /** Element props (may contain nested RSCElements or refs) */
  props: Record<string, unknown>;
  /** React key if provided */
  key: string | null;
  /** Whether this element represents a client component boundary */
  isClientBoundary: boolean;
  /** Original display name of the component */
  displayName: string;
  /** Size of the serialized element in bytes */
  serializedSize: number;
}

/**
 * Server/Client boundary information
 * Tracks where server rendering hands off to client hydration
 */
export interface RSCBoundary {
  /** Unique identifier for the boundary */
  id: string;
  /** Component name of the boundary */
  componentName: string;
  /** Path to the component module */
  modulePath?: string;
  /** Type of boundary */
  type: ComponentType;
  /** Parent boundary ID (null for root) */
  parentId: string | null;
  /** Child boundary IDs */
  children: string[];
  /** Props passed across the boundary (may be serialized) */
  props: Record<string, unknown>;
  /** Props size in bytes */
  propsSize: number;
  /** Whether the boundary uses client directives */
  hasClientDirective: boolean;
  /** Cache key if this boundary is cached */
  cacheKey?: string;
  /** Cache status */
  cacheStatus?: 'hit' | 'miss' | 'stale' | 'none';
}

/**
 * Individual chunk of RSC stream data
 * RSC streams data in chunks for progressive rendering
 */
export interface RSCChunk {
  /** Unique chunk identifier */
  id: string;
  /** Chunk sequence number for ordering */
  sequence: number;
  /** Raw chunk data (JSON string or binary) */
  data: string | Uint8Array;
  /** Parsed chunk content */
  parsedData: unknown;
  /** Size of the chunk in bytes */
  size: number;
  /** Timestamp when chunk was received/generated */
  timestamp: number;
  /** Whether this chunk contains a boundary marker */
  containsBoundary: boolean;
  /** IDs of boundaries referenced in this chunk */
  boundaryIds: string[];
  /** Element references within this chunk */
  elements: RSCElement[];
}

/**
 * Metadata about the RSC payload
 */
export interface RSCPayloadMetadata {
  /** React version used on the server */
  reactVersion: string;
  /** Framework identifier (e.g., 'next', 'remix') */
  framework?: string;
  /** Framework version */
  frameworkVersion?: string;
  /** Whether streaming is enabled */
  streamingEnabled: boolean;
  /** Timestamp when the payload was generated */
  generatedAt: number;
  /** Server environment identifier */
  environment?: string;
}

/**
 * Root payload structure containing chunks, boundaries, and metadata
 * Represents a complete RSC response
 */
export interface RSCPayload {
  /** Unique payload identifier */
  id: string;
  /** All chunks in the stream */
  chunks: RSCChunk[];
  /** All boundaries in the payload */
  boundaries: RSCBoundary[];
  /** Root elements after parsing */
  rootElements: RSCElement[];
  /** Payload metadata */
  metadata: RSCPayloadMetadata;
  /** Total payload size in bytes */
  totalSize: number;
  /** Number of server components */
  serverComponentCount: number;
  /** Number of client components */
  clientComponentCount: number;
  /** Time taken to generate the payload on the server */
  generationTime?: number;
}

/**
 * Per-boundary metrics for performance analysis
 */
export interface RSCBoundaryMetrics {
  /** Boundary identifier */
  boundaryId: string;
  /** Component name */
  componentName: string;
  /** Time spent rendering this boundary on the server (ms) */
  renderTime: number;
  /** Payload size attributed to this boundary in bytes */
  payloadSize: number;
  /** Size of props passed to this boundary in bytes */
  propsSize: number;
  /** Cache status for this boundary */
  cacheStatus: 'hit' | 'miss' | 'stale' | 'none';
  /** Cache TTL in seconds (if applicable) */
  cacheTtl?: number;
  /** Number of times this boundary was rendered */
  renderCount: number;
  /** Whether this boundary caused a cache miss */
  causedCacheMiss: boolean;
  /** Time to serialize this boundary (ms) */
  serializationTime?: number;
}

/**
 * Streaming performance metrics
 * Tracks how chunks are delivered and interleaved
 */
export interface RSCStreamMetrics {
  /** Total number of chunks in the stream */
  chunkCount: number;
  /** Average chunk size in bytes */
  averageChunkSize: number;
  /** Maximum chunk size in bytes */
  maxChunkSize: number;
  /** Minimum chunk size in bytes */
  minChunkSize: number;
  /** Number of chunks that contain boundary data */
  boundaryChunks: number;
  /** Number of chunks that contain interleaved data */
  interleavedChunks: number;
  /** Time to first chunk (TTFB for RSC) in ms */
  timeToFirstChunk: number;
  /** Total stream duration in ms */
  streamDuration: number;
  /** Number of suspense boundaries resolved */
  suspenseResolutions: number;
  /** Whether chunks arrived out of order */
  hadOutOfOrderChunks: boolean;
}

/**
 * Overall RSC payload metrics
 * Tracks size, transfer time, and serialization costs
 */
export interface RSCMetrics {
  /** Total payload size in bytes */
  payloadSize: number;
  /** Size of compressed payload in bytes (if compression was used) */
  compressedSize?: number;
  /** Time to transfer the payload from server to client (ms) */
  transferTime: number;
  /** Time spent serializing data on the server (ms) */
  serializationCost: number;
  /** Time spent parsing/deserializing on the client (ms) */
  deserializationCost: number;
  /** Number of server components rendered */
  serverComponentCount: number;
  /** Number of client components referenced */
  clientComponentCount: number;
  /** Number of boundaries crossed */
  boundaryCount: number;
  /** Per-boundary metrics */
  boundaryMetrics: RSCBoundaryMetrics[];
  /** Streaming metrics */
  streamMetrics: RSCStreamMetrics;
  /** Ratio of cached vs uncached data (0-1) */
  cacheHitRatio: number;
}

/**
 * Severity levels for RSC issues
 */
export type RSCIssueSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Types of issues that can be detected in RSC analysis
 */
export type RSCIssueType =
  | 'oversized-props'
  | 'unnecessary-boundary'
  | 'cache-miss'
  | 'serialization-cost'
  | 'large-payload'
  | 'slow-boundary'
  | 'client-component-prop-drilling'
  | 'missing-cache-config'
  | 'streaming-inefficiency'
  | 'suspense-misconfiguration';

/**
 * Detected issue in RSC analysis
 */
export interface RSCIssue {
  /** Unique issue identifier */
  id: string;
  /** Type of issue detected */
  type: RSCIssueType;
  /** Human-readable issue description */
  description: string;
  /** Severity level */
  severity: RSCIssueSeverity;
  /** Component or boundary affected (if applicable) */
  componentName?: string;
  /** Boundary ID (if applicable) */
  boundaryId?: string;
  /** File path (if available) */
  filePath?: string;
  /** Specific metric value that triggered the issue */
  metricValue?: number;
  /** Threshold that was exceeded */
  threshold?: number;
  /** Suggested fix or recommendation */
  suggestion: string;
}

/**
 * Types of optimization recommendations
 */
export type RSCRecommendationType =
  | 'add-memoization'
  | 'split-boundary'
  | 'add-cache'
  | 'optimize-props'
  | 'move-to-client'
  | 'move-to-server'
  | 'streaming-optimization'
  | 'suspense-boundary'
  | 'deduplicate-requests';

/**
 * Priority levels for recommendations
 */
export type RSCRecommendationPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Optimization suggestion for RSC
 */
export interface RSCRecommendation {
  /** Unique recommendation identifier */
  id: string;
  /** Type of recommendation */
  type: RSCRecommendationType;
  /** Priority level */
  priority: RSCRecommendationPriority;
  /** Human-readable description */
  description: string;
  /** Component(s) affected */
  affectedComponents: string[];
  /** Expected impact on performance */
  expectedImpact: {
    /** Estimated time savings in ms */
    timeSavings: number;
    /** Estimated payload size reduction in bytes */
    sizeReduction: number;
    /** Estimated improvement in cache hit rate */
    cacheHitImprovement: number;
  };
  /** Code example or suggested fix */
  codeExample?: string;
  /** Link to documentation */
  documentationLink?: string;
}

/**
 * Complete RSC analysis result with recommendations
 */
export interface RSCAnalysisResult {
  /** Unique analysis identifier */
  id: string;
  /** Timestamp when analysis was completed */
  timestamp: number;
  /** Analyzed payload reference */
  payloadId: string;
  /** Complete metrics for the analyzed payload */
  metrics: RSCMetrics;
  /** All detected issues */
  issues: RSCIssue[];
  /** Optimization recommendations */
  recommendations: RSCRecommendation[];
  /** Overall performance score (0-100) */
  performanceScore: number;
  /** Analysis summary */
  summary: {
    /** Total issues found */
    totalIssues: number;
    /** Critical issues count */
    criticalIssues: number;
    /** High priority issues count */
    highIssues: number;
    /** Medium priority issues count */
    mediumIssues: number;
    /** Low priority issues count */
    lowIssues: number;
    /** Top optimization opportunity */
    topOpportunity?: string;
    /** Estimated total savings if all recommendations applied */
    estimatedTotalSavings: number;
  };
}

/**
 * Component metadata including RSC type classification
 */
export interface RSCComponentInfo {
  /** Component display name */
  displayName: string;
  /** Component type (server, client, or shared) */
  type: ComponentType;
  /** File path to the component */
  filePath?: string;
  /** Whether the component has 'use client' directive */
  hasUseClientDirective: boolean;
  /** Whether the component has 'use server' directive */
  hasUseServerDirective: boolean;
  /** Props that cross the server/client boundary */
  boundaryProps?: string[];
  /** Child components (for tree analysis) */
  children?: RSCComponentInfo[];
  /** Parent component name */
  parentName?: string;
  /** Whether this component is a leaf in the RSC tree */
  isLeaf: boolean;
  /** Estimated render cost (relative metric) */
  estimatedRenderCost?: number;
}

/**
 * Configuration options for RSC analysis
 */
export interface RSCAnalysisConfig {
  /** Maximum payload size threshold in bytes */
  maxPayloadSize: number;
  /** Maximum props size threshold in bytes */
  maxPropsSize: number;
  /** Maximum boundary render time threshold in ms */
  maxBoundaryRenderTime: number;
  /** Minimum cache hit ratio threshold (0-1) */
  minCacheHitRatio: number;
  /** Enable streaming analysis */
  enableStreamingAnalysis: boolean;
  /** Enable boundary crossing analysis */
  enableBoundaryAnalysis: boolean;
  /** Framework-specific settings */
  frameworkConfig?: {
    /** Framework name */
    name: 'next' | 'remix' | 'custom';
    /** Framework-specific optimization hints */
    hints?: Record<string, unknown>;
  };
}

/**
 * Default RSC analysis configuration
 */
export const DEFAULT_RSC_ANALYSIS_CONFIG: RSCAnalysisConfig = {
  maxPayloadSize: 1024 * 1024, // 1MB
  maxPropsSize: 50 * 1024, // 50KB
  maxBoundaryRenderTime: 100, // 100ms
  minCacheHitRatio: 0.8, // 80%
  enableStreamingAnalysis: true,
  enableBoundaryAnalysis: true,
};

/**
 * Type guard for ComponentType
 */
export function isComponentType(value: unknown): value is ComponentType {
  return value === 'server' || value === 'client' || value === 'shared';
}

/**
 * Type guard for RSCIssueType
 */
export function isRSCIssueType(value: unknown): value is RSCIssueType {
  const validTypes: RSCIssueType[] = [
    'oversized-props',
    'unnecessary-boundary',
    'cache-miss',
    'serialization-cost',
    'large-payload',
    'slow-boundary',
    'client-component-prop-drilling',
    'missing-cache-config',
    'streaming-inefficiency',
    'suspense-misconfiguration',
  ];
  return typeof value === 'string' && validTypes.includes(value as RSCIssueType);
}

/**
 * Type guard for RSCIssueSeverity
 */
export function isRSCIssueSeverity(value: unknown): value is RSCIssueSeverity {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical';
}

/**
 * Type guard for cache status
 */
export function isCacheStatus(value: unknown): value is 'hit' | 'miss' | 'stale' | 'none' {
  return value === 'hit' || value === 'miss' || value === 'stale' || value === 'none';
}
