/**
 * useBudgetAlerts
 * Checks live profiling data against performance budgets and surfaces violations
 * as dismissible in-panel alerts — no Node.js required.
 *
 * Thresholds mirror perf-budget.json defaults but can be overridden.
 */

import { useMemo, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';

// ============================================================================
// Types
// ============================================================================

export type AlertSeverity = 'error' | 'warning';

export interface BudgetAlert {
  id: string;
  severity: AlertSeverity;
  metric: string;
  message: string;
  /** Current observed value */
  actual: number;
  /** Budget threshold */
  threshold: number;
  unit: string;
}

export interface BudgetThresholds {
  /** Max wasted render rate 0–1 (default 0.10 = 10%) */
  maxWastedRenderRate: number;
  /** Min memo hit rate 0–1 (default 0.80 = 80%) */
  minMemoHitRate: number;
  /** Max average render time in ms (default 16ms) */
  maxRenderTimeMs: number;
  /** Min overall performance score 0–100 (default 70) */
  minPerformanceScore: number;
}

const DEFAULT_THRESHOLDS: BudgetThresholds = {
  maxWastedRenderRate: 0.1,
  minMemoHitRate: 0.8,
  maxRenderTimeMs: 16,
  minPerformanceScore: 70,
};

// ============================================================================
// Hook
// ============================================================================

export function useBudgetAlerts(thresholds: Partial<BudgetThresholds> = {}): {
  alerts: BudgetAlert[];
  dismissedIds: Set<string>;
  dismiss: (id: string) => void;
  dismissAll: () => void;
} {
  const t = useMemo(() => ({ ...DEFAULT_THRESHOLDS, ...thresholds }), [thresholds]);

  const wastedRenderReports = useProfilerStore((s) => s.wastedRenderReports);
  const memoReports = useProfilerStore((s) => s.memoReports);
  const performanceScore = useProfilerStore((s) => s.performanceScore);
  const commits = useProfilerStore((s) => s.commits);

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const alerts = useMemo<BudgetAlert[]>(() => {
    if (commits.length === 0) return [];

    const found: BudgetAlert[] = [];

    // ── Wasted render rate ──────────────────────────────────────────────────
    if (wastedRenderReports.length > 0) {
      const avgWasted =
        wastedRenderReports.reduce((s, r) => s + (r.wastedRenderRate ?? 0), 0) /
        wastedRenderReports.length /
        100; // convert % to 0-1

      if (avgWasted > t.maxWastedRenderRate) {
        found.push({
          id: 'wasted-render-rate',
          severity: 'error',
          metric: 'Wasted Render Rate',
          message: `Average wasted render rate ${(avgWasted * 100).toFixed(1)}% exceeds budget of ${(t.maxWastedRenderRate * 100).toFixed(0)}%`,
          actual: avgWasted * 100,
          threshold: t.maxWastedRenderRate * 100,
          unit: '%',
        });
      }
    }

    // ── Memo hit rate ───────────────────────────────────────────────────────
    if (memoReports.length > 0) {
      const memoized = memoReports.filter((r) => r.hasMemo);
      if (memoized.length > 0) {
        const avgHitRate =
          memoized.reduce((s, r) => s + (r.currentHitRate ?? 0), 0) / memoized.length;

        if (avgHitRate < t.minMemoHitRate) {
          found.push({
            id: 'memo-hit-rate',
            severity: 'warning',
            metric: 'Memo Hit Rate',
            message: `Average memo hit rate ${(avgHitRate * 100).toFixed(1)}% is below budget of ${(t.minMemoHitRate * 100).toFixed(0)}%`,
            actual: avgHitRate * 100,
            threshold: t.minMemoHitRate * 100,
            unit: '%',
          });
        }
      }
    }

    // ── Average render time ─────────────────────────────────────────────────
    if (commits.length > 0) {
      const avgDuration = commits.reduce((s, c) => s + (c.duration ?? 0), 0) / commits.length;

      if (avgDuration > t.maxRenderTimeMs) {
        found.push({
          id: 'avg-render-time',
          severity: 'error',
          metric: 'Avg Render Time',
          message: `Average render time ${avgDuration.toFixed(1)}ms exceeds ${t.maxRenderTimeMs}ms frame budget`,
          actual: avgDuration,
          threshold: t.maxRenderTimeMs,
          unit: 'ms',
        });
      }
    }

    // ── Overall score ───────────────────────────────────────────────────────
    if (performanceScore !== null) {
      if (performanceScore.score < t.minPerformanceScore) {
        found.push({
          id: 'performance-score',
          severity: 'error',
          metric: 'Performance Score',
          message: `Score ${performanceScore.score.toFixed(0)} is below minimum budget of ${t.minPerformanceScore}`,
          actual: performanceScore.score,
          threshold: t.minPerformanceScore,
          unit: 'pts',
        });
      }
    }

    return found;
  }, [wastedRenderReports, memoReports, performanceScore, commits, t]);

  const dismiss = (id: string) => setDismissedIds((prev) => new Set([...prev, id]));

  const dismissAll = () => setDismissedIds(new Set(alerts.map((a) => a.id)));

  return { alerts, dismissedIds, dismiss, dismissAll };
}
