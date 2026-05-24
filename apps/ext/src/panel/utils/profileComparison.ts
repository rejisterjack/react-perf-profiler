/**
 * Profile comparison — diff two profiling sessions to detect regressions.
 * Compares component metrics between a baseline and current profile.
 */

import type { CommitData, ComponentMetrics, WastedRenderReport, MemoReport } from '@/src/shared/types';

export interface ProfileDiff {
  /** Components that regressed (got worse) */
  regressions: ComponentDiff[];
  /** Components that improved */
  improvements: ComponentDiff[];
  /** Components that are new (not in baseline) */
  newComponents: string[];
  /** Components that were removed (in baseline, not current) */
  removedComponents: string[];
  /** Overall score delta */
  scoreDelta: number | null;
  /** Total commit count delta */
  commitCountDelta: number;
}

export interface ComponentDiff {
  componentName: string;
  metric: string;
  baselineValue: number;
  currentValue: number;
  delta: number;
  deltaPercent: number;
  severity: 'critical' | 'warning' | 'info';
}

/** Build component metrics from commits (same logic as profilerStore) */
export function buildComponentMetrics(commits: CommitData[]): Map<string, ComponentMetrics> {
  const metrics = new Map<string, ComponentMetrics>();

  for (const commit of commits) {
    const fibers = commit.fibers ?? [];
    for (const fiber of fibers) {
      if (!fiber.displayName) continue;
      const name = fiber.displayName;

      let m = metrics.get(name);
      if (!m) {
        m = {
          componentName: name,
          renderCount: 0,
          wastedRenderCount: 0,
          wastedRenderRate: 0,
          totalRenderTime: 0,
          averageRenderTime: 0,
          maxRenderTime: 0,
          minRenderTime: Infinity,
          isMemoized: fiber.tag === 14 || fiber.tag === 15,
          firstSeen: commit.timestamp,
          lastSeen: commit.timestamp,
        };
        metrics.set(name, m);
      }

      m.renderCount++;
      m.totalRenderTime += fiber.actualDuration ?? 0;
      m.maxRenderTime = Math.max(m.maxRenderTime, fiber.actualDuration ?? 0);
      m.minRenderTime = Math.min(m.minRenderTime, fiber.actualDuration ?? 0);
      m.lastSeen = commit.timestamp;
      if (fiber.tag === 14 || fiber.tag === 15) m.isMemoized = true;
    }
  }

  for (const m of metrics.values()) {
    m.averageRenderTime = m.renderCount > 0 ? m.totalRenderTime / m.renderCount : 0;
    m.minRenderTime = m.minRenderTime === Infinity ? 0 : m.minRenderTime;
  }

  return metrics;
}

/** Compare two sets of component metrics and produce a diff */
export function compareProfiles(
  baselineCommits: CommitData[],
  currentCommits: CommitData[],
  baselineScore?: number,
  currentScore?: number,
): ProfileDiff {
  const baselineMetrics = buildComponentMetrics(baselineCommits);
  const currentMetrics = buildComponentMetrics(currentCommits);

  const regressions: ComponentDiff[] = [];
  const improvements: ComponentDiff[] = [];
  const newComponents: string[] = [];
  const removedComponents: string[] = [];

  // Find new and changed components
  for (const [name, current] of currentMetrics) {
    const baseline = baselineMetrics.get(name);

    if (!baseline) {
      newComponents.push(name);
      continue;
    }

    // Compare render count
    const renderDelta = current.renderCount - baseline.renderCount;
    if (Math.abs(renderDelta) > 0) {
      const diff: ComponentDiff = {
        componentName: name,
        metric: 'renderCount',
        baselineValue: baseline.renderCount,
        currentValue: current.renderCount,
        delta: renderDelta,
        deltaPercent: baseline.renderCount > 0 ? (renderDelta / baseline.renderCount) * 100 : 0,
        severity: renderDelta > baseline.renderCount * 0.5 ? 'critical' : renderDelta > baseline.renderCount * 0.2 ? 'warning' : 'info',
      };
      if (renderDelta > 0) regressions.push(diff);
      else improvements.push(diff);
    }

    // Compare average render time
    const avgDelta = current.averageRenderTime - baseline.averageRenderTime;
    if (Math.abs(avgDelta) > 0.5) {
      const diff: ComponentDiff = {
        componentName: name,
        metric: 'avgRenderTime',
        baselineValue: Math.round(baseline.averageRenderTime * 100) / 100,
        currentValue: Math.round(current.averageRenderTime * 100) / 100,
        delta: Math.round(avgDelta * 100) / 100,
        deltaPercent: baseline.averageRenderTime > 0 ? (avgDelta / baseline.averageRenderTime) * 100 : 0,
        severity: avgDelta > 5 ? 'critical' : avgDelta > 2 ? 'warning' : 'info',
      };
      if (avgDelta > 0) regressions.push(diff);
      else improvements.push(diff);
    }

    // Compare max render time
    const maxDelta = current.maxRenderTime - baseline.maxRenderTime;
    if (maxDelta > 5) {
      regressions.push({
        componentName: name,
        metric: 'maxRenderTime',
        baselineValue: Math.round(baseline.maxRenderTime * 100) / 100,
        currentValue: Math.round(current.maxRenderTime * 100) / 100,
        delta: Math.round(maxDelta * 100) / 100,
        deltaPercent: baseline.maxRenderTime > 0 ? (maxDelta / baseline.maxRenderTime) * 100 : 0,
        severity: maxDelta > 16 ? 'critical' : maxDelta > 8 ? 'warning' : 'info',
      });
    }

    // Compare total render time
    const totalDelta = current.totalRenderTime - baseline.totalRenderTime;
    if (Math.abs(totalDelta) > 5) {
      const diff: ComponentDiff = {
        componentName: name,
        metric: 'totalRenderTime',
        baselineValue: Math.round(baseline.totalRenderTime * 100) / 100,
        currentValue: Math.round(current.totalRenderTime * 100) / 100,
        delta: Math.round(totalDelta * 100) / 100,
        deltaPercent: baseline.totalRenderTime > 0 ? (totalDelta / baseline.totalRenderTime) * 100 : 0,
        severity: totalDelta > 50 ? 'critical' : totalDelta > 20 ? 'warning' : 'info',
      };
      if (totalDelta > 0) regressions.push(diff);
      else improvements.push(diff);
    }
  }

  // Find removed components
  for (const name of baselineMetrics.keys()) {
    if (!currentMetrics.has(name)) {
      removedComponents.push(name);
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  regressions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  improvements.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    regressions,
    improvements,
    newComponents,
    removedComponents,
    scoreDelta: baselineScore != null && currentScore != null ? currentScore - baselineScore : null,
    commitCountDelta: currentCommits.length - baselineCommits.length,
  };
}
