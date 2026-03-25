/**
 * Wasted render detection and analysis
 * Identifies renders where props/state remained identical
 */

import { FRAME_BUDGET } from '@/shared/constants';
import type { CommitData, FiberData } from '@/shared/types';
import { shallowEqual, type FiberNode } from './shallowEqual';

/** Reasons why a wasted render might have occurred */
export type WastedRenderReason =
  | { type: 'parent-render' }
  | { type: 'context-change'; contextName: string }
  | { type: 'force-update' }
  | { type: 'unknown' };

/** Statistics for a single component's render session */
export interface RenderSession {
  /** Component display name */
  componentName: string;
  /** Total number of renders recorded */
  totalRenders: number;
  /** Number of renders that were wasted */
  wastedRenders: number;
  /** Durations of wasted renders for analysis */
  wastedRenderDurations: number[];
  /** All render durations */
  renderDurations: number[];
  /** Reasons identified for wasted renders */
  wastedRenderReasons: WastedRenderReason[];
  /** Props from last render (for comparison) */
  lastProps: Record<string, unknown> | null;
  /** State from last render (for comparison) */
  lastState: unknown;
}

/** Final report for wasted render analysis */
export interface WastedRenderReport {
  /** Component display name */
  componentName: string;
  /** Total renders */
  totalRenders: number;
  /** Wasted render count */
  wastedRenders: number;
  /** Percentage of renders that were wasted */
  wastedRenderRate: number;
  /** Average duration of wasted renders in ms */
  averageWastedDuration: number;
  /** Total time spent on wasted renders in ms */
  totalWastedTime: number;
  /** Severity level based on rate and count */
  severity: 'critical' | 'warning' | 'info';
  /** Identified reasons for wasted renders */
  reasons: WastedRenderReason[];
  /** Optimization recommendations */
  recommendations: string[];
}

/** Configuration for wasted render analysis */
export interface WastedRenderConfig {
  /** Threshold percentage to flag a component (0-1) */
  threshold?: number;
  /** Minimum renders before reporting */
  minRenderCount?: number;
  /** Minimum duration in ms to consider a render significant */
  minDuration?: number;
}

/**
 * Analyzes commit history to detect wasted renders
 * A wasted render occurs when a component re-renders but props and state are unchanged
 *
 * @param commitHistory - Array of commit data from React profiler
 * @param config - Optional analysis configuration
 * @returns Array of reports for components with wasted renders
 *
 * @example
 * ```typescript
 * const reports = analyzeWastedRenders(commits, { threshold: 0.3 });
 * ```
 */
export function analyzeWastedRenders(
  commitHistory: CommitData[],
  config: WastedRenderConfig = {}
): WastedRenderReport[] {
  const { threshold = 0.2, minRenderCount = 2, minDuration = 0 } = config;

  // Early return for empty history
  if (!commitHistory || commitHistory.length === 0) {
    return [];
  }

  // Build session map using Map for O(1) lookups
  const sessionMap = new Map<string, RenderSession>();

  // prevFiberMap is carried forward across iterations so each commit's fibers
  // are indexed exactly once (O(N·M) total instead of O(2·N·M)).
  let prevFiberMap = new Map<string, FiberData>();

  // Process each commit
  for (let i = 0; i < commitHistory.length; i++) {
    const commit = commitHistory[i]!;

    if (!commit.fibers) {
      prevFiberMap = new Map();
      continue;
    }

    // Process each fiber in current commit
    for (let j = 0; j < commit.fibers.length; j++) {
      const fiber = commit.fibers[j]!;
      const displayName = fiber.displayName || 'Unknown';

      // Get or create session
      let session = sessionMap.get(displayName);
      if (!session) {
        session = {
          componentName: displayName,
          totalRenders: 0,
          wastedRenders: 0,
          wastedRenderDurations: [],
          renderDurations: [],
          wastedRenderReasons: [],
          lastProps: null,
          lastState: null,
        };
        sessionMap.set(displayName, session);
      }

      // Get previous fiber data
      const prevFiber = prevFiberMap.get(fiber.id);

      // Create extended fiber node for analysis
      const fiberNode: FiberNode = {
        ...fiber,
        prevProps: prevFiber?.memoizedProps ?? null,
        prevState: prevFiber?.memoizedState ?? null,
        hasContextChanged: detectContextChange(fiber, prevFiber ?? null),
      };

      // Record render
      session.totalRenders++;
      session.renderDurations.push(fiber.actualDuration);

      // Check if this was a wasted render
      const isWasted = isWastedRender(fiberNode);
      if (isWasted && fiber.actualDuration >= minDuration) {
        session.wastedRenders++;
        session.wastedRenderDurations.push(fiber.actualDuration);

        // Determine reason
        const reason = determineWastedRenderReason(
          fiberNode,
          prevFiber ? (prevFiber as FiberNode) : null
        );
        session.wastedRenderReasons.push(reason);
      }

      // Update last known values
      session.lastProps = fiber.memoizedProps ?? null;
      session.lastState = fiber.memoizedState ?? null;
    }

    // Build lookup map for the next iteration from current commit's fibers.
    // Doing this once per commit (not once per iteration pair) halves map-building work.
    prevFiberMap = buildFiberMap(commit.fibers);
  }

  // Generate reports from sessions
  const reports: WastedRenderReport[] = [];
  sessionMap.forEach((session) => {
    // Filter by minimum render count
    if (session.totalRenders < minRenderCount) return;

    const wastedRate = session.totalRenders > 0 ? session.wastedRenders / session.totalRenders : 0;

    // Filter by threshold - include components that meet the threshold
    // Components below threshold are filtered out regardless of wasted render count
    if (wastedRate < threshold) return;

    // Calculate statistics
    const totalWastedTime = session.wastedRenderDurations.reduce((a, b) => a + b, 0);
    const averageWastedDuration =
      session.wastedRenders > 0 ? totalWastedTime / session.wastedRenders : 0;

    // Deduplicate reasons
    const uniqueReasons = deduplicateReasons(session.wastedRenderReasons);

    reports.push({
      componentName: session.componentName,
      totalRenders: session.totalRenders,
      wastedRenders: session.wastedRenders,
      wastedRenderRate: wastedRate,
      averageWastedDuration,
      totalWastedTime,
      severity: calculateSeverity(wastedRate, session.totalRenders),
      reasons: uniqueReasons,
      recommendations: generateWastedRenderRecommendations(session),
    });
  });

  // Sort by severity (descending: critical > warning > info) and wasted time
  return reports.sort((a, b) => {
    const severityOrder = { critical: 3, warning: 2, info: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.totalWastedTime - a.totalWastedTime;
  });
}

/**
 * Builds a lookup map from fiber ID to fiber data
 */
function buildFiberMap(fibers: FiberData[]): Map<string, FiberData> {
  const map = new Map<string, FiberData>();
  for (let i = 0; i < fibers.length; i++) {
    const fiber = fibers[i]!;
    map.set(fiber.id, fiber);
  }
  return map;
}

/**
 * Detects if context has changed for a fiber using React's internal flags bitmask.
 *
 * React marks fibers with a ContextChanged flag when a subscribed context value
 * changes during the render. The flag value differs by version:
 *   React 17  → 0x040 (64)
 *   React 18  → 0x1000 (4096)
 * We check both to support whichever version is installed on the profiled page.
 */
const REACT_CONTEXT_CHANGED_FLAGS = 0x040 | 0x1000;

function detectContextChange(current: FiberData, previous: FiberData | null): boolean {
  if (!previous) return false;
  const flags = current.flags ?? 0;
  return (flags & REACT_CONTEXT_CHANGED_FLAGS) !== 0;
}

/**
 * Determines if a render was wasted
 * A render is wasted if props and state are unchanged
 */
function isWastedRender(fiber: FiberNode): boolean {
  // First render can't be wasted
  if (fiber.prevProps === null && fiber.prevState === null) {
    return false;
  }

  // Check props equality
  const propsEqual = shallowEqual(fiber.prevProps ?? {}, fiber.memoizedProps ?? {});

  // Check state equality
  const stateEqual = shallowEqual({ state: fiber.prevState }, { state: fiber.memoizedState });

  // Render is wasted if both props and state are equal and no context change
  return propsEqual && stateEqual && !fiber.hasContextChanged;
}

/**
 * Determines why a wasted render occurred
 *
 * @param current - Current fiber node
 * @param previous - Previous fiber node
 * @returns Reason for the wasted render
 */
export function determineWastedRenderReason(
  current: FiberNode,
  previous: FiberNode | null
): WastedRenderReason {
  if (!previous) {
    return { type: 'unknown' };
  }

  // Check for context change first
  if (current.hasContextChanged) {
    // Try to identify which context
    return { type: 'context-change', contextName: 'unknown' };
  }

  // Check if state changed by comparing current state with previous state stored in the node
  // If state changed, this isn't really a wasted render caused by parent
  if (current.prevState !== null && current.memoizedState !== current.prevState) {
    return { type: 'unknown' };
  }

  // Most common reason: parent re-rendered
  return { type: 'parent-render' };
}

/**
 * Calculates severity based on wasted render rate and total renders
 *
 * @param wastedRate - Percentage of renders that were wasted (0-1)
 * @param totalRenders - Total number of renders
 * @returns Severity level
 */
export function calculateSeverity(
  wastedRate: number,
  totalRenders: number
): 'critical' | 'warning' | 'info' {
  // Critical: High rate with significant render count
  if (wastedRate >= 0.5 && totalRenders >= 10) return 'critical';
  if (wastedRate >= 0.7) return 'critical';

  // Warning: Moderate rate or high rate with low count
  if (wastedRate >= 0.3 && totalRenders >= 5) return 'warning';
  if (wastedRate >= 0.5) return 'warning';

  return 'info';
}

/**
 * Generates optimization recommendations for wasted renders
 *
 * @param session - Render session data
 * @returns Array of recommendation strings
 */
export function generateWastedRenderRecommendations(session: RenderSession): string[] {
  const recommendations: string[] = [];
  const wastedRate = session.totalRenders > 0 ? session.wastedRenders / session.totalRenders : 0;

  if (wastedRate < 0.1) {
    return ['Component has minimal wasted renders. No action needed.'];
  }

  // Analyze reasons
  const reasonCounts = new Map<string, number>();
  for (const reason of session.wastedRenderReasons) {
    const key = reason.type;
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }

  // Recommend based on primary reason
  const primaryReason = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  switch (primaryReason) {
    case 'parent-render':
      recommendations.push(
        `Wrap ${session.componentName} with React.memo() to prevent re-renders from parent updates`
      );
      recommendations.push(
        'Consider moving the component down the tree to reduce parent update frequency'
      );
      break;

    case 'context-change':
      recommendations.push(
        'Split context into smaller, more focused contexts to reduce unnecessary updates'
      );
      recommendations.push(
        'Consider using a state management library with fine-grained updates (Zustand, Jotai)'
      );
      break;

    case 'force-update':
      recommendations.push('Remove forceUpdate() calls and use state/props instead');
      break;

    default:
      recommendations.push(`Review ${session.componentName} for unnecessary re-renders`);
  }

  // Add performance-specific recommendations
  const avgWastedDuration =
    session.wastedRenderDurations.length > 0
      ? session.wastedRenderDurations.reduce((a, b) => a + b, 0) /
        session.wastedRenderDurations.length
      : 0;

  if (avgWastedDuration > FRAME_BUDGET.MS) {
    recommendations.push(
      `Wasted renders are expensive (${avgWastedDuration.toFixed(1)}ms avg). Prioritize fixing this component.`
    );
  }

  return recommendations;
}

/**
 * Deduplicates wasted render reasons while preserving order
 */
function deduplicateReasons(reasons: WastedRenderReason[]): WastedRenderReason[] {
  const seen = new Set<string>();
  const unique: WastedRenderReason[] = [];

  for (const reason of reasons) {
    const key = reason.type === 'context-change' ? `context-${reason.contextName}` : reason.type;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(reason);
    }
  }

  return unique;
}
