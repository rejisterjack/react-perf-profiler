/**
 * Web Workers module exports
 * Provides worker-related types and the worker client for analysis operations
 */

// ============================================================================
// Worker Client
// ============================================================================

export {
  AnalysisWorkerClient,
  analysisWorker,
} from './workerClient';

export type {
  WorkerClientOptions,
  AnalysisResult,
} from './workerClient';

// ============================================================================
// Worker Types
// ============================================================================

export type {
  WorkerRequest,
  WorkerRequestType,
  WorkerResponse,
  WorkerResponseType,
} from './analysis.worker';

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
