/**
 * Core analysis utilities for React Perf Profiler
 * Re-exports all analysis functions and types
 */

// Shallow equality utilities
export {
  shallowEqual,
  shallowEqualArrays,
  shallowEqualProps,
} from './shallowEqual';
export type { ShallowEqualOptions } from './shallowEqual';

// Wasted render analysis
export {
  analyzeWastedRenders,
  determineWastedRenderReason,
  calculateSeverity,
  generateWastedRenderRecommendations,
} from './wastedRenderAnalysis';
export type {
  RenderSession,
  WastedRenderReason,
  WastedRenderReport,
} from './wastedRenderAnalysis';

// Memoization effectiveness analysis
export {
  analyzePropStability,
  detectMemoization,
  calculateOptimalHitRate,
  analyzeMemoEffectiveness,
  generateMemoRecommendations,
} from './memoAnalysis';
export type {
  PropStability,
  PropValueSnapshot,
  MemoEffectivenessReport,
  MemoIssue,
  MemoIssueType,
} from './memoAnalysis';

// Performance scoring
export {
  calculatePerformanceScore,
  scoreWastedRenders,
  scoreMemoization,
  scoreRenderTime,
  scoreComponentCount,
} from './performanceScore';
export type { PerformanceMetrics, PerformanceIssue } from './performanceScore';

// Timeline generation
export {
  generateTimeline,
  bucketEvents,
  findRenderPeaks,
} from './timelineGenerator';
export type { TimelineEvent, TimelineData } from './timelineGenerator';
