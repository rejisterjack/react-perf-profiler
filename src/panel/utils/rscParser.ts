/**
 * React Server Components (RSC) Payload Parser
 * @module panel/utils/rscParser
 *
 * Parses React Server Components stream payloads and extracts metrics.
 * Handles NDJSON streaming format, RSC reference markers, and boundary detection.
 */

import type { FiberData } from '@/shared/types';
import type {
  RSCBoundary,
  RSCBoundaryMetrics,
  RSCChunk,
  RSCElement,
  RSCMetrics,
  RSCPayload,
  RSCPayloadMetadata,
  RSCReferenceMarker,
  RSCStreamMetrics,
} from '@/shared/types/rsc';
import { RSCReferenceMarker as Marker } from '@/shared/types/rsc';

/**
 * Large props threshold in bytes (50KB)
 */
const LARGE_PROPS_THRESHOLD = 50 * 1024;

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Parse a streaming RSC response
 * @param stream - ReadableStream containing RSC data
 * @returns Promise resolving to parsed RSCPayload
 */
export async function parseRSCStream(stream: ReadableStream): Promise<RSCPayload> {
  const reader = stream.getReader();
  const chunks: RSCChunk[] = [];
  const decoder = new TextDecoder();
  let sequence = 0;
  let buffer = '';
  const startTime = performance.now();
  let firstChunkTime = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      const timestamp = performance.now();
      if (firstChunkTime === 0) {
        firstChunkTime = timestamp - startTime;
      }

      // Decode chunk and append to buffer
      buffer += decoder.decode(value, { stream: true });

      // Parse NDJSON (newline-delimited JSON)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          const chunk = parseRSCChunk(line, sequence++, timestamp);
          chunks.push(chunk);
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      const chunk = parseRSCChunk(buffer, sequence++, performance.now());
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  return assemblePayload(chunks);
}

/**
 * Parse a single RSC chunk
 */
function parseRSCChunk(
  data: string,
  sequence: number,
  timestamp: number
): RSCChunk {
  const size = new TextEncoder().encode(data).length;
  let parsedData: unknown;
  let elements: RSCElement[] = [];
  let boundaryIds: string[] = [];
  let containsBoundary = false;

  try {
    parsedData = JSON.parse(data);
    elements = extractElementsFromChunk(parsedData);
    boundaryIds = extractBoundaryIds(parsedData);
    containsBoundary = boundaryIds.length > 0;
  } catch {
    // If not valid JSON, treat as raw data
    parsedData = data;
  }

  return {
    id: generateId(),
    sequence,
    data,
    parsedData,
    size,
    timestamp,
    containsBoundary,
    boundaryIds,
    elements,
  };
}

/**
 * Extract RSC elements from parsed chunk data
 */
function extractElementsFromChunk(data: unknown): RSCElement[] {
  const elements: RSCElement[] = [];

  if (typeof data === 'object' && data !== null) {
    traverseForElements(data, elements);
  }

  return elements;
}

/**
 * Recursively traverse data to find RSC elements
 */
function traverseForElements(obj: unknown, elements: RSCElement[]): void {
  if (typeof obj !== 'object' || obj === null) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      traverseForElements(item, elements);
    }
  } else {
    const record = obj as Record<string, unknown>;

    // Check if this looks like an RSC element
    if (isRSCElementLike(record)) {
      const element = parseRSCElement(record);
      if (element) {
        elements.push(element);
      }
    }

    // Continue traversing
    for (const value of Object.values(record)) {
      traverseForElements(value, elements);
    }
  }
}

/**
 * Check if an object looks like an RSC element
 */
function isRSCElementLike(obj: Record<string, unknown>): boolean {
  return (
    typeof obj['type'] === 'string' ||
    (typeof obj['type'] === 'object' && obj['type'] !== null) ||
    typeof obj['props'] === 'object'
  );
}

/**
 * Extract boundary IDs from chunk data
 */
function extractBoundaryIds(data: unknown): string[] {
  const ids: string[] = [];

  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;

    // Check for explicit boundary markers
    if (typeof record['$boundary'] === 'string') {
      ids.push(record['$boundary']);
    }

    // Check for boundary references in the data
    const jsonStr = JSON.stringify(data);
    const boundaryMatches = jsonStr.match(/\$boundary["']?\s*:\s*["']([^"']+)/g);
    if (boundaryMatches) {
      for (const match of boundaryMatches) {
        const id = match.match(/["']([^"']+)["']/)?.[1];
        if (id && !ids.includes(id)) {
          ids.push(id);
        }
      }
    }
  }

  return ids;
}

/**
 * Assemble chunks into a complete RSC payload
 */
function assemblePayload(chunks: RSCChunk[]): RSCPayload {
  const boundaries = extractBoundariesFromChunks(chunks);
  const rootElements = extractRootElements(chunks);
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  const serverComponentCount = countServerComponents(chunks);
  const clientComponentCount = countClientComponents(chunks);

  // Extract metadata from first chunk if available
  const metadata = extractMetadata(chunks[0]?.parsedData);

  return {
    id: generateId(),
    chunks,
    boundaries,
    rootElements,
    metadata,
    totalSize,
    serverComponentCount,
    clientComponentCount,
  };
}

/**
 * Extract metadata from payload data
 */
function extractMetadata(data: unknown): RSCPayloadMetadata {
  const defaultMetadata: RSCPayloadMetadata = {
    reactVersion: 'unknown',
    streamingEnabled: true,
    generatedAt: Date.now(),
  };

  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    return {
      ...defaultMetadata,
      reactVersion: (record['reactVersion'] as string) || defaultMetadata.reactVersion,
      framework: record['framework'] as string | undefined,
      frameworkVersion: record['frameworkVersion'] as string | undefined,
      environment: record['environment'] as string | undefined,
    };
  }

  return defaultMetadata;
}

/**
 * Extract boundaries from all chunks
 */
function extractBoundariesFromChunks(chunks: RSCChunk[]): RSCBoundary[] {
  const boundaries = new Map<string, RSCBoundary>();

  for (const chunk of chunks) {
    for (const boundaryId of chunk.boundaryIds) {
      if (!boundaries.has(boundaryId)) {
        boundaries.set(boundaryId, {
          id: boundaryId,
          componentName: `Boundary-${boundaryId.slice(0, 8)}`,
          type: 'server',
          parentId: null,
          children: [],
          props: {},
          propsSize: 0,
          hasClientDirective: false,
        });
      }
    }
  }

  return Array.from(boundaries.values());
}

/**
 * Extract root elements from chunks
 */
function extractRootElements(chunks: RSCChunk[]): RSCElement[] {
  const elements: RSCElement[] = [];

  for (const chunk of chunks) {
    elements.push(...chunk.elements);
  }

  return elements;
}

/**
 * Count server components in chunks
 */
function countServerComponents(chunks: RSCChunk[]): number {
  let count = 0;
  for (const chunk of chunks) {
    for (const element of chunk.elements) {
      if (!element.isClientBoundary) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Count client components in chunks
 */
function countClientComponents(chunks: RSCChunk[]): number {
  let count = 0;
  for (const chunk of chunks) {
    for (const element of chunk.elements) {
      if (element.isClientBoundary) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Parse raw RSC payload data (non-streaming)
 * @param rawData - Raw payload data (string or object)
 * @returns Parsed RSCPayload
 */
export function parseRSCPayload(rawData: string | object): RSCPayload {
  let parsedData: unknown;

  if (typeof rawData === 'string') {
    try {
      parsedData = JSON.parse(rawData);
    } catch {
      // If not valid JSON, treat as raw string data
      parsedData = { raw: rawData };
    }
  } else {
    parsedData = rawData;
  }

  const chunks: RSCChunk[] = [];
  const chunkData = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
  const size = new TextEncoder().encode(chunkData).length;

  // Create a single chunk for non-streaming payload
  const chunk: RSCChunk = {
    id: generateId(),
    sequence: 0,
    data: chunkData,
    parsedData,
    size,
    timestamp: Date.now(),
    containsBoundary: false,
    boundaryIds: extractBoundaryIds(parsedData),
    elements: extractElementsFromChunk(parsedData),
  };

  chunk.containsBoundary = chunk.boundaryIds.length > 0;
  chunks.push(chunk);

  return assemblePayload(chunks);
}

/**
 * Parse a serialized RSC element
 * @param elementData - Raw element data
 * @returns Parsed RSCElement or null if invalid
 */
export function parseRSCElement(elementData: unknown): RSCElement | null {
  if (typeof elementData !== 'object' || elementData === null) {
    return null;
  }

  const data = elementData as Record<string, unknown>;

  // Extract type information
  const type = parseElementType(data['type']);

  // Check if it's a client boundary
  const isClientBoundary = checkIsClientBoundary(data);

  // Extract and parse props
  const props = (data['props'] as Record<string, unknown>) || {};

  // Calculate serialized size
  const serializedSize = calculatePayloadSize(elementData);

  // Extract display name
  const displayName = extractDisplayName(data, type);

  // Extract key
  const key = typeof data['key'] === 'string' ? data['key'] : null;

  return {
    id: generateId(),
    type,
    props,
    key,
    isClientBoundary,
    displayName,
    serializedSize,
  };
}

/**
 * Parse element type from various formats
 */
function parseElementType(type: unknown): string | RSCReferenceMarker {
  if (typeof type === 'string') {
    // Check for RSC reference markers
    if (type.startsWith(Marker.Element)) {
      return Marker.Element;
    }
    if (type.startsWith(Marker.ClientReference)) {
      return Marker.ClientReference;
    }
    if (type.startsWith(Marker.ServerAction)) {
      return Marker.ServerAction;
    }
    return type;
  }

  if (typeof type === 'object' && type !== null) {
    const typeObj = type as Record<string, unknown>;

    // Check for reference markers in object form
    if (typeObj['$$typeof']) {
      const symbol = String(typeObj['$$typeof']);
      if (symbol.includes('react.element')) {
        return Marker.Element;
      }
      if (symbol.includes('react.client_reference')) {
        return Marker.ClientReference;
      }
    }

    // Check for explicit RSC type markers
    if (typeof typeObj['name'] === 'string') {
      return typeObj['name'];
    }
  }

  return typeof type === 'function' ? type.name || 'Function' : String(type);
}

/**
 * Check if element represents a client boundary
 */
function checkIsClientBoundary(data: Record<string, unknown>): boolean {
  // Check explicit marker
  if (data['isClientBoundary'] === true) return true;

  // Check type for client reference
  const type = data['type'];
  if (typeof type === 'string') {
    if (type.startsWith(Marker.ClientReference) || type.startsWith('@')) {
      return true;
    }
  }

  if (typeof type === 'object' && type !== null) {
    const typeObj = type as Record<string, unknown>;
    if (typeObj['$$typeof'] === 'react.client_reference' || typeObj['__type'] === 'client') {
      return true;
    }
  }

  // Check for 'use client' directive indicator
  const props = data['props'] as Record<string, unknown> | undefined;
  if (props?.['__clientDirective'] === true) {
    return true;
  }

  return false;
}

/**
 * Extract display name from element data
 */
function extractDisplayName(data: Record<string, unknown>, type: string | RSCReferenceMarker): string {
  // Check explicit display name
  if (typeof data['displayName'] === 'string') return data['displayName'];

  // Check in props
  const props = data['props'] as Record<string, unknown> | undefined;
  if (typeof props?.['displayName'] === 'string') return props['displayName'];

  // Extract from type
  if (typeof type === 'string') {
    // Remove reference markers
    return type.replace(/^[$@#]/, '').split('/').pop() || 'Unknown';
  }

  // Try to get from type object
  const typeObj = data['type'] as Record<string, unknown> | undefined;
  if (typeObj) {
    if (typeof typeObj['displayName'] === 'string') return typeObj['displayName'];
    if (typeof typeObj['name'] === 'string') return typeObj['name'];
  }

  return 'Unknown';
}

/**
 * Detect server/client boundaries in fiber tree
 * @param fiberData - Array of fiber nodes
 * @returns Array of detected boundaries
 */
export function detectRSCBoundaries(fiberData: FiberData[]): RSCBoundary[] {
  const boundaries: RSCBoundary[] = [];
  const visited = new Set<string>();

  for (const fiber of fiberData) {
    traverseFiberForBoundaries(fiber, boundaries, visited, null);
  }

  // Link parent-child relationships
  linkBoundaryRelationships(boundaries);

  return boundaries;
}

/**
 * Traverse fiber tree to find boundaries
 */
function traverseFiberForBoundaries(
  fiber: FiberData | null,
  boundaries: RSCBoundary[],
  visited: Set<string>,
  parentId: string | null
): void {
  if (!fiber || visited.has(fiber.id)) return;
  visited.add(fiber.id);

  // Check if this fiber represents a boundary
  if (isBoundaryFiber(fiber)) {
    const boundary = createBoundaryFromFiber(fiber, parentId);
    boundaries.push(boundary);
    parentId = boundary.id; // This boundary becomes parent for children
  }

  // Traverse children
  traverseFiberForBoundaries(fiber.child, boundaries, visited, parentId);

  // Traverse siblings
  traverseFiberForBoundaries(fiber.sibling, boundaries, visited, parentId);
}

/**
 * Check if a fiber represents a boundary
 */
function isBoundaryFiber(fiber: FiberData): boolean {
  // Check for client boundary markers
  if (isClientBoundary(fiber)) return true;

  // Check for server component markers
  if (isServerComponent(fiber)) return true;

  // Check memoized props for boundary indicators
  const props = fiber.memoizedProps;
  if (props?.['__rscBoundary'] === true) return true;
  if (props?.['__clientDirective'] === true) return true;

  // Check display name for boundary patterns
  const name = fiber.displayName.toLowerCase();
  if (name.includes('boundary') || name.includes('suspense')) {
    return true;
  }

  return false;
}

/**
 * Create a boundary object from fiber data
 */
function createBoundaryFromFiber(fiber: FiberData, parentId: string | null): RSCBoundary {
  const isClient = isClientBoundary(fiber);
  const props = fiber.memoizedProps || {};
  const propsSize = calculatePayloadSize(props);

  return {
    id: fiber.id,
    componentName: fiber.displayName,
    type: isClient ? 'client' : 'server',
    parentId,
    children: [],
    props,
    propsSize,
    hasClientDirective: isClient,
  };
}

/**
 * Link parent-child relationships between boundaries
 */
function linkBoundaryRelationships(boundaries: RSCBoundary[]): void {
  const boundaryMap = new Map(boundaries.map(b => [b.id, b]));

  for (const boundary of boundaries) {
    if (boundary.parentId) {
      const parent = boundaryMap.get(boundary.parentId);
      if (parent && !parent.children.includes(boundary.id)) {
        parent.children.push(boundary.id);
      }
    }
  }
}

/**
 * Check if a fiber is a server component
 * @param fiber - Fiber node to check
 * @returns True if fiber is a server component
 */
export function isServerComponent(fiber: FiberData): boolean {
  // Check for explicit server marker
  const props = fiber.memoizedProps;
  if (props?.['__serverComponent'] === true) return true;
  if (props?.['__type'] === 'server') return true;

  // Check display name patterns
  const name = fiber.displayName.toLowerCase();
  if (name.includes('server:') || name.startsWith('rsc:')) return true;

  // Check type for server indicators
  const type = fiber.type;
  if (typeof type === 'object' && type !== null) {
    const typeObj = type as Record<string, unknown>;
    if (typeObj['__type'] === 'server' || typeObj['$$typeof'] === 'react.server_component') {
      return true;
    }
  }

  // Check if NOT client component (server is default in RSC)
  return !isClientBoundary(fiber);
}

/**
 * Check if a fiber represents a client boundary
 * @param fiber - Fiber node to check
 * @returns True if fiber is a client boundary
 */
export function isClientBoundary(fiber: FiberData): boolean {
  // Check for 'use client' directive indicator
  const props = fiber.memoizedProps;
  if (props?.['__clientDirective'] === true) return true;
  if (props?.['__type'] === 'client') return true;

  // Check type for client reference markers
  const type = fiber.type;
  if (typeof type === 'string') {
    if (type.startsWith('@') || type.startsWith(Marker.ClientReference)) {
      return true;
    }
  }

  if (typeof type === 'object' && type !== null) {
    const typeObj = type as Record<string, unknown>;
    if (
      typeObj['$$typeof'] === 'react.client_reference' ||
      typeObj['__type'] === 'client' ||
      typeObj['__client'] === true
    ) {
      return true;
    }
  }

  // Check display name patterns
  const name = fiber.displayName.toLowerCase();
  if (name.includes('client:') || name.includes('(client)')) return true;

  return false;
}

/**
 * Extract comprehensive metrics from RSC payload
 * @param payload - RSC payload to analyze
 * @returns Calculated RSC metrics
 */
export function extractRSCMetrics(payload: RSCPayload): RSCMetrics {
  const boundaryMetrics = calculateBoundaryMetrics(payload);
  const streamMetrics = calculateStreamMetrics(payload);

  // Calculate serialization/deserialization costs (estimates)
  const serializationCost = estimateSerializationCost(payload);
  const deserializationCost = estimateDeserializationCost(payload);

  // Calculate transfer time estimate (assume ~10ms per KB on fast connection)
  const transferTime = (payload.totalSize / 1024) * 10;

  // Calculate cache hit ratio
  const cacheHitRatio = calculateCacheHitRatio(payload);

  return {
    payloadSize: payload.totalSize,
    transferTime,
    serializationCost,
    deserializationCost,
    serverComponentCount: payload.serverComponentCount,
    clientComponentCount: payload.clientComponentCount,
    boundaryCount: payload.boundaries.length,
    boundaryMetrics,
    streamMetrics,
    cacheHitRatio,
  };
}

/**
 * Calculate per-boundary metrics
 */
function calculateBoundaryMetrics(payload: RSCPayload): RSCBoundaryMetrics[] {
  return payload.boundaries.map(boundary => {
    const chunks = payload.chunks.filter(chunk =>
      chunk.boundaryIds.includes(boundary.id)
    );

    const payloadSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

    return {
      boundaryId: boundary.id,
      componentName: boundary.componentName,
      renderTime: 0, // Would need server timing data
      payloadSize,
      propsSize: boundary.propsSize,
      cacheStatus: boundary.cacheStatus || 'none',
      renderCount: 1,
      causedCacheMiss: boundary.cacheStatus === 'miss',
    };
  });
}

/**
 * Calculate streaming metrics
 */
function calculateStreamMetrics(payload: RSCPayload): RSCStreamMetrics {
  const chunks = payload.chunks;
  
  if (chunks.length === 0) {
    return {
      chunkCount: 0,
      averageChunkSize: 0,
      maxChunkSize: 0,
      minChunkSize: 0,
      boundaryChunks: 0,
      interleavedChunks: 0,
      timeToFirstChunk: 0,
      streamDuration: 0,
      suspenseResolutions: 0,
      hadOutOfOrderChunks: false,
    };
  }

  const sizes = chunks.map(c => c.size);
  const timestamps = chunks.map(c => c.timestamp);

  const boundaryChunks = chunks.filter(c => c.containsBoundary).length;

  // Check for out-of-order chunks
  let hadOutOfOrderChunks = false;
  for (let i = 1; i < chunks.length; i++) {
    const current = chunks[i];
    const previous = chunks[i - 1];
    if (current && previous && current.sequence < previous.sequence) {
      hadOutOfOrderChunks = true;
      break;
    }
  }

  return {
    chunkCount: chunks.length,
    averageChunkSize: sizes.reduce((a, b) => a + b, 0) / chunks.length,
    maxChunkSize: Math.max(...sizes),
    minChunkSize: Math.min(...sizes),
    boundaryChunks,
    interleavedChunks: chunks.filter(c => c.elements.length > 1).length,
    timeToFirstChunk: chunks[0]?.timestamp || 0,
    streamDuration: Math.max(...timestamps) - Math.min(...timestamps),
    suspenseResolutions: countSuspenseResolutions(payload),
    hadOutOfOrderChunks,
  };
}

/**
 * Count suspense boundary resolutions
 */
function countSuspenseResolutions(payload: RSCPayload): number {
  let count = 0;
  for (const chunk of payload.chunks) {
    const data = chunk.parsedData;
    if (typeof data === 'object' && data !== null) {
      const record = data as Record<string, unknown>;
      if (record['$suspense'] === 'resolved' || record['__suspenseResolved'] === true) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Estimate serialization cost on server
 */
function estimateSerializationCost(payload: RSCPayload): number {
  // Rough estimate: ~0.1ms per KB
  return (payload.totalSize / 1024) * 0.1;
}

/**
 * Estimate deserialization cost on client
 */
function estimateDeserializationCost(payload: RSCPayload): number {
  // Rough estimate: ~0.2ms per KB (parsing JSON)
  return (payload.totalSize / 1024) * 0.2;
}

/**
 * Calculate cache hit ratio
 */
function calculateCacheHitRatio(payload: RSCPayload): number {
  const boundaries = payload.boundaries;
  if (boundaries.length === 0) return 1;

  const hits = boundaries.filter(b => b.cacheStatus === 'hit').length;
  return hits / boundaries.length;
}

/**
 * Calculate serialized size of data
 * @param data - Data to measure
 * @returns Size in bytes
 */
export function calculatePayloadSize(data: unknown): number {
  if (data === null || data === undefined) return 0;

  try {
    const json = JSON.stringify(data);
    return new TextEncoder().encode(json).length;
  } catch {
    // If circular or can't stringify, estimate
    return estimateObjectSize(data);
  }
}

/**
 * Estimate object size when JSON.stringify fails
 */
function estimateObjectSize(obj: unknown): number {
  if (obj === null || obj === undefined) return 0;

  switch (typeof obj) {
    case 'boolean':
      return 4;
    case 'number':
      return 8;
    case 'string':
      return (obj as string).length * 2;
    case 'object':
      if (Array.isArray(obj)) {
        return obj.reduce((sum, item) => sum + estimateObjectSize(item), 2);
      }
      return Object.entries(obj as Record<string, unknown>).reduce(
        (sum, [key, value]) => sum + key.length * 2 + estimateObjectSize(value),
        2
      );
    default:
      return 0;
  }
}

/**
 * Analyze boundary crossings in payload
 * @param payload - RSC payload to analyze
 * @returns Boundary crossing analysis
 */
export function analyzeBoundaryCrossings(payload: RSCPayload): {
  totalCrossings: number;
  serverToClient: number;
  clientToServer: number;
  largePropTransfers: Array<{
    boundaryId: string;
    componentName: string;
    propsSize: number;
    warning: boolean;
  }>;
} {
  let serverToClient = 0;
  let clientToServer = 0;
  const largePropTransfers: Array<{
    boundaryId: string;
    componentName: string;
    propsSize: number;
    warning: boolean;
  }> = [];

  for (const boundary of payload.boundaries) {
    // Count crossings based on boundary type transitions
    if (boundary.type === 'client' && boundary.parentId) {
      const parent = payload.boundaries.find(b => b.id === boundary.parentId);
      if (parent?.type === 'server') {
        serverToClient++;
      }
    }

    if (boundary.type === 'server' && boundary.parentId) {
      const parent = payload.boundaries.find(b => b.id === boundary.parentId);
      if (parent?.type === 'client') {
        clientToServer++;
      }
    }

    // Check for large prop transfers
    if (boundary.propsSize > 0) {
      largePropTransfers.push({
        boundaryId: boundary.id,
        componentName: boundary.componentName,
        propsSize: boundary.propsSize,
        warning: boundary.propsSize > LARGE_PROPS_THRESHOLD,
      });
    }
  }

  return {
    totalCrossings: serverToClient + clientToServer,
    serverToClient,
    clientToServer,
    largePropTransfers: largePropTransfers.sort((a, b) => b.propsSize - a.propsSize),
  };
}

/**
 * Parse RSC reference marker
 * @param ref - Reference string to parse
 * @returns Parsed reference information
 */
export function parseRSCReference(ref: string): {
  marker: RSCReferenceMarker | null;
  id: string;
  type: 'element' | 'promise' | 'action' | 'symbol' | 'formstate' | 'unknown';
  raw: string;
} {
  if (!ref || typeof ref !== 'string') {
    return { marker: null, id: '', type: 'unknown', raw: String(ref) };
  }

  // Check for symbol references ($S)
  if (ref.startsWith(Marker.Symbol)) {
    return {
      marker: Marker.Symbol,
      id: ref.slice(2),
      type: 'symbol',
      raw: ref,
    };
  }

  // Check for form state references ($F)
  if (ref.startsWith(Marker.FormState)) {
    return {
      marker: Marker.FormState,
      id: ref.slice(2),
      type: 'formstate',
      raw: ref,
    };
  }

  // Check for promise/stream references ($L)
  if (ref.startsWith(Marker.Promise)) {
    return {
      marker: Marker.Promise,
      id: ref.slice(2),
      type: 'promise',
      raw: ref,
    };
  }

  // Check for single character markers
  if (ref.startsWith(Marker.Element)) {
    return {
      marker: Marker.Element,
      id: ref.slice(1),
      type: 'element',
      raw: ref,
    };
  }

  if (ref.startsWith(Marker.ClientReference)) {
    return {
      marker: Marker.ClientReference,
      id: ref.slice(1),
      type: 'element',
      raw: ref,
    };
  }

  if (ref.startsWith(Marker.ServerAction)) {
    return {
      marker: Marker.ServerAction,
      id: ref.slice(1),
      type: 'action',
      raw: ref,
    };
  }

  // No marker found, treat as plain ID
  return { marker: null, id: ref, type: 'unknown', raw: ref };
}

/**
 * Resolve element from RSC reference
 * @param ref - Reference string
 * @param payload - RSC payload containing elements
 * @returns Resolved RSCElement or null
 */
export function resolveRSCElement(ref: string, payload: RSCPayload): RSCElement | null {
  const parsed = parseRSCReference(ref);

  // Search for element matching the ID
  for (const chunk of payload.chunks) {
    for (const element of chunk.elements) {
      // Check by element ID
      if (element.id === parsed.id) {
        return element;
      }

      // Check by type match for reference markers
      if (parsed.marker && element.type === parsed.marker) {
        // Additional matching logic could go here
        return element;
      }
    }
  }

  // Search in root elements
  for (const element of payload.rootElements) {
    if (element.id === parsed.id) {
      return element;
    }
  }

  return null;
}

/**
 * Extract and flatten props from RSC element
 * @param element - RSC element
 * @returns Flattened props with resolved references
 */
export function extractPropsFromRSC(
  element: RSCElement
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(element.props)) {
    // Skip internal React props
    if (key.startsWith('__') || key === 'children') continue;

    // Resolve reference markers in prop values
    if (typeof value === 'string' && /^[$@#]/.test(value)) {
      props[key] = {
        __ref: value,
        __resolved: false, // Would need payload to resolve
      };
    } else if (typeof value === 'object' && value !== null) {
      // Recursively extract nested props
      props[key] = extractNestedProps(value);
    } else {
      props[key] = value;
    }
  }

  return props;
}

/**
 * Recursively extract nested props
 */
function extractNestedProps(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(extractNestedProps);
  }

  const record = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('__')) continue;

    if (typeof value === 'string' && /^[$@#]/.test(value)) {
      result[key] = { __ref: value };
    } else if (typeof value === 'object' && value !== null) {
      result[key] = extractNestedProps(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
