/**
 * Hook for fetching and analyzing component-specific data
 * @module panel/hooks/useComponentData
 */

import { useMemo } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import type { ComponentMetrics, CommitData, FiberNode } from '@/shared/types';

/**
 * Return type for the useComponentData hook
 */
export interface UseComponentDataReturn {
  /** Calculated metrics for the component */
  metrics: ComponentMetrics | null;
  /** Commits that include this component */
  commits: CommitData[];
  /** Wasted render report for this component */
  wastedRenderReport:
    | ReturnType<typeof useProfilerStore.getState>['wastedRenderReports'][number]
    | null;
  /** Memo effectiveness report for this component */
  memoReport: ReturnType<typeof useProfilerStore.getState>['memoReports'][number] | null;
}

/**
 * Check if a render was wasted (props and state unchanged)
 */
function isWastedRender(node: FiberNode): boolean {
  // If context changed, render was necessary
  if (node.hasContextChanged) return false;

  // Check if props changed using shallow equality
  const propsChanged = !shallowEqual(node.prevProps, node.props);
  if (propsChanged) return false;

  // Check if state changed using shallow equality
  const stateChanged = !shallowEqual(node.prevState, node.state);
  if (stateChanged) return false;

  // Props and state are equal - this was a wasted render
  return true;
}

/**
 * Shallow equality check for objects
 */
function shallowEqual(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

/**
 * Hook for accessing component-specific profiling data
 *
 * Calculates metrics for a specific component across all commits,
 * including render count, wasted renders, and timing statistics.
 *
 * @example
 * ```tsx
 * function ComponentDetails({ componentName }: { componentName: string }) {
 *   const { metrics, commits, wastedRenderReport } = useComponentData(componentName);
 *
 *   if (!metrics) return <div>No data available</div>;
 *
 *   return (
 *     <div>
 *       <h2>{componentName}</h2>
 *       <p>Renders: {metrics.renderCount}</p>
 *       <p>Wasted: {metrics.wastedRenderCount} ({metrics.wastedRenderRate.toFixed(1)}%)</p>
 *       <p>Avg time: {metrics.averageRenderTime.toFixed(2)}ms</p>
 *       {wastedRenderReport && (
 *         <div className="warning">
 *           Recommended: {wastedRenderReport.recommendedAction}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @param componentName - Name of the component to analyze
 * @returns Object containing component metrics, commits, and reports
 */
export function useComponentData(componentName: string): UseComponentDataReturn {
  const { commits, wastedRenderReports, memoReports } = useProfilerStore();

  /**
   * Filter commits that include this component
   */
  const componentCommits = useMemo((): CommitData[] => {
    if (!componentName) return [];

    return commits.filter((commit) =>
      commit.nodes?.some((node) => node.displayName === componentName)
    );
  }, [commits, componentName]);

  /**
   * Calculate metrics for this component
   */
  const metrics = useMemo((): ComponentMetrics | null => {
    if (componentCommits.length === 0) return null;

    let renderCount = 0;
    let wastedRenderCount = 0;
    let totalRenderTime = 0;
    let maxRenderTime = 0;
    let minRenderTime = Number.POSITIVE_INFINITY;
    let isMemoized = false;
    let firstSeen = Number.POSITIVE_INFINITY;
    let lastSeen = 0;

    componentCommits.forEach((commit) => {
      const node = commit.nodes?.find((n) => n.displayName === componentName);
      if (!node) return;

      renderCount++;
      totalRenderTime += node.actualDuration;
      maxRenderTime = Math.max(maxRenderTime, node.actualDuration);
      minRenderTime = Math.min(minRenderTime, node.actualDuration);
      isMemoized = isMemoized || node.isMemoized;
      firstSeen = Math.min(firstSeen, commit.timestamp);
      lastSeen = Math.max(lastSeen, commit.timestamp);

      if (isWastedRender(node)) {
        wastedRenderCount++;
      }
    });

    const wastedRenderRate = renderCount > 0 ? (wastedRenderCount / renderCount) * 100 : 0;

    return {
      componentName,
      renderCount,
      wastedRenderCount,
      wastedRenderRate,
      totalRenderTime,
      averageRenderTime: renderCount > 0 ? totalRenderTime / renderCount : 0,
      maxRenderTime: maxRenderTime === 0 ? 0 : maxRenderTime,
      minRenderTime: minRenderTime === Number.POSITIVE_INFINITY ? 0 : minRenderTime,
      isMemoized,
      firstSeen,
      lastSeen,
    };
  }, [componentCommits, componentName]);

  /**
   * Get wasted render report for this component
   */
  const wastedRenderReport = useMemo(() => {
    if (!componentName) return null;
    return wastedRenderReports.find((r) => r.componentName === componentName) || null;
  }, [wastedRenderReports, componentName]);

  /**
   * Get memo report for this component
   */
  const memoReport = useMemo(() => {
    if (!componentName) return null;
    return memoReports.find((r) => r.componentName === componentName) || null;
  }, [memoReports, componentName]);

  return {
    metrics,
    commits: componentCommits,
    wastedRenderReport,
    memoReport,
  };
}
