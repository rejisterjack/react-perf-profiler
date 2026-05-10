/**
 * Analysis Pipeline — Composable passes for runAnalysis decomposition
 *
 * Each pass is an independently testable function that takes inputs and returns
 * outputs without side effects. The profilerStore.runAnalysis orchestrates these
 * passes in sequence.
 */

import type { CommitData } from '@/shared/types';
import type { AnalysisResult, MemoReport, WastedRenderReport } from '@/shared/types';
import { MAX_PERFORMANCE_SCORE, MIN_PERFORMANCE_SCORE, RENDER_TIME_SCORE } from '@/shared/constants';
import { ComponentDataLRUCache } from '@/panel/stores/profilerStore';

// ---------------------------------------------------------------------------
// Pass 1: Aggregate component data from commits
// ---------------------------------------------------------------------------

export interface ComponentAggregationResult {
  componentData: ComponentDataLRUCache;
  totalComponents: number;
  totalRenderTime: number;
  avgRenderTime: number;
}

export function aggregateComponentData(
  commits: CommitData[],
  maxEntries: number,
): ComponentAggregationResult {
  const componentData = new ComponentDataLRUCache(maxEntries);

  for (const commit of commits) {
    for (const node of commit.nodes ?? []) {
      const name = node.displayName;
      if (!name) continue;

      let data = componentData.get(name);
      if (!data) {
        data = {
          name,
          renderCount: 0,
          wastedRenders: 0,
          wastedRenderRate: 0,
          averageDuration: 0,
          totalDuration: 0,
          isMemoized: node.isMemoized,
          memoHitRate: 0,
          commitIds: [],
          severity: 'none',
        };
      }

      data.renderCount++;
      data.totalDuration += node.actualDuration;
      data.commitIds.push(commit.id);
      componentData.set(name, data);
    }
  }

  // Calculate averages
  for (const data of componentData.values()) {
    data.averageDuration = data.totalDuration / data.renderCount;
  }

  const totalComponents = componentData.size;
  let totalRenderTime = 0;
  componentData.forEach((c) => { totalRenderTime += c.totalDuration; });
  const avgRenderTime = totalComponents > 0 ? totalRenderTime / totalComponents : 0;

  return { componentData, totalComponents, totalRenderTime, avgRenderTime };
}

// ---------------------------------------------------------------------------
// Pass 2: Calculate wasted render rate
// ---------------------------------------------------------------------------

export interface WastedRenderResult {
  wastedRenderRate: number;
  reports: WastedRenderReport[];
}

export function calculateWastedRenderRate(
  analysisResult: AnalysisResult,
): WastedRenderResult {
  const wastedReports = analysisResult.wastedRenderReports ?? [];
  const totalWastedRenders = wastedReports.reduce((sum: number, r) => sum + r.wastedRenders, 0);
  const totalRenders = wastedReports.reduce((sum: number, r) => sum + r.totalRenders, 0);
  const wastedRenderRate = totalRenders > 0 ? (totalWastedRenders / totalRenders) * 100 : 0;

  return { wastedRenderRate, reports: wastedReports };
}

// ---------------------------------------------------------------------------
// Pass 3: Calculate memo effectiveness
// ---------------------------------------------------------------------------

export interface MemoResult {
  avgMemoHitRate: number;
  reports: MemoReport[];
}

export function calculateMemoEffectiveness(
  analysisResult: AnalysisResult,
): MemoResult {
  const memoReports = analysisResult.memoReports ?? [];
  const avgMemoHitRate =
    memoReports.length > 0
      ? (memoReports.reduce((sum: number, r) => sum + r.currentHitRate, 0) /
          memoReports.length) *
        100
      : 0;

  return { avgMemoHitRate, reports: memoReports };
}

// ---------------------------------------------------------------------------
// Pass 4: Calculate performance score
// ---------------------------------------------------------------------------

export interface ScoreResult {
  score: number;
  performanceScore: {
    score: number;
    averageRenderTime: number;
    wastedRenderRate: number;
    averageMemoHitRate: number;
    totalComponents: number;
  };
}

export function calculatePerformanceScore(
  avgRenderTime: number,
  wastedRenderRate: number,
  avgMemoHitRate: number,
  totalComponents: number,
): ScoreResult {
  const calculatedScore = MAX_PERFORMANCE_SCORE - avgRenderTime * RENDER_TIME_SCORE.MULTIPLIER;
  const clampedScore = Math.max(
    MIN_PERFORMANCE_SCORE,
    Math.min(MAX_PERFORMANCE_SCORE, calculatedScore),
  );

  return {
    score: clampedScore,
    performanceScore: {
      score: clampedScore,
      averageRenderTime: avgRenderTime,
      wastedRenderRate,
      averageMemoHitRate: avgMemoHitRate,
      totalComponents,
    },
  };
}
