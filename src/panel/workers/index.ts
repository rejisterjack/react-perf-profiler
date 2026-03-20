/**
 * Web Workers module exports
 * Provides worker-related types and the worker client for analysis operations
 */

// ============================================================================
// Worker Clients
// ============================================================================

export { analysisWorker, rscWorker } from './workerClient';

// ============================================================================
// Worker Types
// ============================================================================

export type {
  RSCWorkerRequest,
  RSCWorkerResponse,
  RSCWorkerRequestType,
  RSCWorkerResponseType,
} from './rscAnalysis.worker';

// ============================================================================
// Shared Types
// ============================================================================

export type { AnalysisResult } from '@/shared/types';

// ============================================================================
// Flamegraph Types
// ============================================================================

export type {
  FlamegraphNode,
  FlamegraphData,
  FlamegraphConfig,
} from './flamegraphGenerator';

export {
  generateFlamegraphData,
  convertFiberToHierarchy,
  calculateNodeColor,
  filterSmallNodes,
  findNodesByName,
  aggregateByComponent,
} from './flamegraphGenerator';
