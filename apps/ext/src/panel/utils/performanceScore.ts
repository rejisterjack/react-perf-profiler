/**
 * Performance scoring — calculates an overall 0-100 score
 * based on wasted renders, memoization effectiveness, render times,
 * and component count.
 */

import type {
  CommitData,
  FiberData,
  MemoReport,
  WastedRenderReport,
} from '@/src/shared/types';
import { PERFORMANCE_SCORE_WEIGHTS } from '@/src/shared/constants';

function collectFibers(fiber: FiberData | null | undefined, out: FiberData[]): void {
  if (!fiber) return;
  out.push(fiber);
  if (fiber.child) collectFibers(fiber.child, out);
  if (fiber.sibling) collectFibers(fiber.sibling, out);
}

function scoreWastedRenders(reports: WastedRenderReport[]): number {
  if (reports.length === 0) return 100;

  let totalPenalty = 0;

  for (const report of reports) {
    // Penalty based on wasted render rate and severity
    const severityMultiplier: Record<string, number> = {
      critical: 1.0,
      high: 0.7,
      medium: 0.4,
      low: 0.2,
    };
    const multiplier = severityMultiplier[report.severity] ?? 0.2;
    // Each report contributes a penalty proportional to its wasted rate
    totalPenalty += (report.wastedRenderRate / 100) * multiplier * 10;
  }

  // Normalize: cap penalty at 100
  const penalty = Math.min(100, totalPenalty);
  return Math.max(0, 100 - penalty);
}

function scoreMemoization(reports: MemoReport[]): number {
  if (reports.length === 0) return 100;

  let totalEffectiveness = 0;
  for (const report of reports) {
    totalEffectiveness += report.isEffective ? report.currentHitRate : report.currentHitRate * 0.5;
  }

  const averageEffectiveness = totalEffectiveness / reports.length;
  return Math.max(0, Math.min(100, averageEffectiveness));
}

function scoreRenderTime(commits: CommitData[]): number {
  if (commits.length === 0) return 100;

  // 16ms frame budget
  const FRAME_BUDGET_MS = 16;
  let totalOverBudget = 0;
  let totalDuration = 0;

  for (const commit of commits) {
    const fibers: FiberData[] = [];
    if (commit.fibers) fibers.push(...commit.fibers);
    if (commit.rootFiber) collectFibers(commit.rootFiber, fibers);

    let commitDuration = commit.duration ?? 0;
    if (commitDuration === 0 && fibers.length > 0) {
      commitDuration = fibers.reduce((sum, f) => sum + (f.actualDuration ?? 0), 0);
    }

    totalDuration += commitDuration;
    if (commitDuration > FRAME_BUDGET_MS) {
      totalOverBudget += commitDuration - FRAME_BUDGET_MS;
    }
  }

  if (totalDuration === 0) return 100;

  // More time over budget = lower score
  const overBudgetRatio = totalOverBudget / totalDuration;
  const penalty = Math.min(100, overBudgetRatio * 200);
  return Math.max(0, 100 - penalty);
}

function scoreComponentCount(commits: CommitData[]): number {
  if (commits.length === 0) return 100;

  // Get unique component count across all commits
  const componentNames = new Set<string>();

  for (const commit of commits) {
    const fibers: FiberData[] = [];
    if (commit.fibers) fibers.push(...commit.fibers);
    if (commit.rootFiber) collectFibers(commit.rootFiber, fibers);

    for (const fiber of fibers) {
      if (fiber.displayName) {
        componentNames.add(fiber.displayName);
      }
    }
  }

  const count = componentNames.size;

  // Score based on component count:
  // < 50 = excellent (100), < 100 = good (80), < 200 = okay (60), < 500 = fair (40), > 500 = poor (20)
  if (count <= 50) return 100;
  if (count <= 100) return 80;
  if (count <= 200) return 60;
  if (count <= 500) return 40;
  return 20;
}

export function calculatePerformanceScore(
  reports: WastedRenderReport[],
  memoReports: MemoReport[],
  commits: CommitData[],
): number {
  const wastedScore = scoreWastedRenders(reports);
  const memoScore = scoreMemoization(memoReports);
  const renderScore = scoreRenderTime(commits);
  const countScore = scoreComponentCount(commits);

  const { WASTED_RENDER, MEMOIZATION, RENDER_TIME, COMPONENT_COUNT } =
    PERFORMANCE_SCORE_WEIGHTS;

  const weighted =
    wastedScore * WASTED_RENDER +
    memoScore * MEMOIZATION +
    renderScore * RENDER_TIME +
    countScore * COMPONENT_COUNT;

  return Math.round(Math.max(0, Math.min(100, weighted)));
}
