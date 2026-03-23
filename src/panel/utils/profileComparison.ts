/**
 * Profile Comparison Utilities
 * Computes per-component deltas between a baseline snapshot and the current session.
 */

import type { CommitData } from '@/content/types';

// ============================================================================
// Types
// ============================================================================

export interface ComponentSnapshot {
  name: string;
  renderCount: number;
  totalDuration: number;
  averageDuration: number;
  wastedRenders: number;
}

export interface ComponentDelta {
  name: string;
  /** Render count change (positive = more renders) */
  renderCountDelta: number;
  renderCountDeltaPct: number | null;
  /** Average duration change in ms (positive = slower) */
  avgDurationDelta: number;
  avgDurationDeltaPct: number | null;
  /** Wasted render count change */
  wastedRendersDelta: number;
  /** Whether this component is new (absent in baseline) */
  isNew: boolean;
  /** Whether this component was removed (absent in current) */
  isRemoved: boolean;
  baseline: ComponentSnapshot | null;
  current: ComponentSnapshot | null;
}

export interface ProfileComparisonResult {
  baselineLabel: string;
  currentLabel: string;
  baselineCommitCount: number;
  currentCommitCount: number;
  /** Overall render count change across all components */
  totalRenderCountDelta: number;
  /** Overall wasted renders change */
  totalWastedRendersDelta: number;
  /** Per-component deltas, sorted by absolute avgDurationDelta descending */
  components: ComponentDelta[];
  /** Timestamp when comparison was computed */
  computedAt: number;
}

// ============================================================================
// Aggregation helpers
// ============================================================================

function aggregateCommits(commits: CommitData[]): Map<string, ComponentSnapshot> {
  const map = new Map<string, ComponentSnapshot>();

  for (const commit of commits) {
    for (const node of commit.nodes ?? []) {
      const name = node.displayName ?? 'Unknown';
      const existing = map.get(name);
      const duration = node.actualDuration ?? 0;

      if (existing) {
        existing.renderCount += 1;
        existing.totalDuration += duration;
        existing.averageDuration = existing.totalDuration / existing.renderCount;
        // A wasted render: component re-rendered but props and state were unchanged
        const didRender = (node.actualDuration ?? 0) > 0;
        const propsChanged = node.prevProps !== undefined;
        const stateChanged = node.prevState !== undefined;
        if (didRender && !propsChanged && !stateChanged) {
          existing.wastedRenders += 1;
        }
      } else {
        const didRender = (node.actualDuration ?? 0) > 0;
        const propsChanged = node.prevProps !== undefined;
        const stateChanged = node.prevState !== undefined;
        map.set(name, {
          name,
          renderCount: 1,
          totalDuration: duration,
          averageDuration: duration,
          wastedRenders: didRender && !propsChanged && !stateChanged ? 1 : 0,
        });
      }
    }
  }

  return map;
}

function pctChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compare two sets of commits and return per-component deltas.
 *
 * @param baselineCommits  - Commits from the saved baseline recording
 * @param currentCommits   - Commits from the current recording
 * @param baselineLabel    - Human-readable label for the baseline
 * @param currentLabel     - Human-readable label for the current session
 */
export function compareProfiles(
  baselineCommits: CommitData[],
  currentCommits: CommitData[],
  baselineLabel = 'Baseline',
  currentLabel = 'Current'
): ProfileComparisonResult {
  const baselineMap = aggregateCommits(baselineCommits);
  const currentMap = aggregateCommits(currentCommits);

  const allNames = new Set([...baselineMap.keys(), ...currentMap.keys()]);
  const deltas: ComponentDelta[] = [];

  for (const name of allNames) {
    const baseline = baselineMap.get(name) ?? null;
    const current = currentMap.get(name) ?? null;

    deltas.push({
      name,
      renderCountDelta: (current?.renderCount ?? 0) - (baseline?.renderCount ?? 0),
      renderCountDeltaPct: pctChange(baseline?.renderCount ?? 0, current?.renderCount ?? 0),
      avgDurationDelta: (current?.averageDuration ?? 0) - (baseline?.averageDuration ?? 0),
      avgDurationDeltaPct: pctChange(
        baseline?.averageDuration ?? 0,
        current?.averageDuration ?? 0
      ),
      wastedRendersDelta: (current?.wastedRenders ?? 0) - (baseline?.wastedRenders ?? 0),
      isNew: baseline === null,
      isRemoved: current === null,
      baseline,
      current,
    });
  }

  // Sort: regressions (positive avgDurationDelta) first, then improvements
  deltas.sort((a, b) => Math.abs(b.avgDurationDelta) - Math.abs(a.avgDurationDelta));

  return {
    baselineLabel,
    currentLabel,
    baselineCommitCount: baselineCommits.length,
    currentCommitCount: currentCommits.length,
    totalRenderCountDelta: deltas.reduce((s, d) => s + d.renderCountDelta, 0),
    totalWastedRendersDelta: deltas.reduce((s, d) => s + d.wastedRendersDelta, 0),
    components: deltas,
    computedAt: Date.now(),
  };
}
