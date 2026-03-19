/**
 * Web Workers module exports
 * Provides worker-related types and the worker client for analysis operations
 */

// ============================================================================
// Worker Client
// ============================================================================

export { analysisWorker } from './workerClient';

export type { AnalysisResult } from '@/shared/types';

// ============================================================================
// Worker Types
// ============================================================================

// Worker types are defined in workerClient.ts

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
