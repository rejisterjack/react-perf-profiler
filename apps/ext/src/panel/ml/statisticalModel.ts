/**
 * Statistical anomaly detection replacing TensorFlow.js.
 * Pure functions — no external dependencies, no browser APIs.
 */

import type { CommitData } from '@/src/shared/types';

export interface AnomalyReport {
  componentName: string;
  commitIndex: number;
  duration: number;
  expectedRange: { low: number; high: number };
  zScore: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TrendReport {
  componentName: string;
  slope: number;
  rSquared: number;
  direction: 'improving' | 'stable' | 'degrading';
  sampleSize: number;
}

export interface PatternReport {
  pattern: 'burst' | 'periodic' | 'cascade' | 'escalating';
  components: string[];
  description: string;
  confidence: number;
}

/**
 * Z-score based anomaly detection per component.
 * Flags commits where duration > mean + 3*stdDev.
 */
export function detectAnomalies(commits: CommitData[]): Map<string, AnomalyReport[]> {
  // 1. Build per-component duration arrays
  const componentDurations = new Map<string, number[]>();
  for (let i = 0; i < commits.length; i++) {
    const fibers = commits[i].fibers ?? [];
    for (const fiber of fibers) {
      if (!fiber.displayName) continue;
      const arr = componentDurations.get(fiber.displayName) ?? [];
      arr.push(fiber.actualDuration ?? 0);
      componentDurations.set(fiber.displayName, arr);
    }
  }

  // 2. Compute mean/stddev per component, flag anomalies
  const result = new Map<string, AnomalyReport[]>();
  for (const [name, durations] of componentDurations) {
    if (durations.length < 3) continue;
    const n = durations.length;
    const mean = durations.reduce((a, b) => a + b, 0) / n;
    const variance = durations.reduce((sum, d) => sum + (d - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    if (stdDev < 0.001) continue; // no variation

    const anomalies: AnomalyReport[] = [];
    for (let i = 0; i < durations.length; i++) {
      const zScore = (durations[i] - mean) / stdDev;
      if (zScore > 3) {
        const severity = zScore > 6 ? 'critical' : zScore > 4.5 ? 'high' : zScore > 3.5 ? 'medium' : 'low';
        anomalies.push({
          componentName: name,
          commitIndex: i,
          duration: durations[i],
          expectedRange: { low: Math.max(0, mean - 2 * stdDev), high: mean + 3 * stdDev },
          zScore: Math.round(zScore * 100) / 100,
          severity,
        });
      }
    }
    if (anomalies.length > 0) result.set(name, anomalies);
  }
  return result;
}

/**
 * Linear regression on component render duration vs commit index.
 * If slope > 0 and R² > 0.5, the component is trending slower.
 */
export function detectTrends(commits: CommitData[]): Map<string, TrendReport> {
  // Build per-component (index, duration) pairs
  const componentPoints = new Map<string, Array<{ x: number; y: number }>>();
  for (let i = 0; i < commits.length; i++) {
    const fibers = commits[i].fibers ?? [];
    for (const fiber of fibers) {
      if (!fiber.displayName) continue;
      const arr = componentPoints.get(fiber.displayName) ?? [];
      arr.push({ x: i, y: fiber.actualDuration ?? 0 });
      componentPoints.set(fiber.displayName, arr);
    }
  }

  const result = new Map<string, TrendReport>();
  for (const [name, points] of componentPoints) {
    if (points.length < 5) continue; // need enough data for trend

    const n = points.length;
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const meanY = sumY / n;
    const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const ssRes = points.reduce((s, p) => {
      const predicted = slope * p.x + (sumY - slope * sumX) / n;
      return s + (p.y - predicted) ** 2;
    }, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Only report meaningful trends
    if (Math.abs(slope) < 0.001 || rSquared < 0.3) continue;

    result.set(name, {
      componentName: name,
      slope: Math.round(slope * 10000) / 10000,
      rSquared: Math.round(rSquared * 1000) / 1000,
      direction: slope > 0.01 ? 'degrading' : slope < -0.01 ? 'improving' : 'stable',
      sampleSize: n,
    });
  }
  return result;
}

/**
 * Correlate component re-renders to detect patterns:
 * - burst: many components rendering in same commit
 * - periodic: component rendering at regular intervals
 * - cascade: component A always triggers B and C
 * - escalating: increasing number of components per commit
 */
export function detectPatterns(commits: CommitData[]): PatternReport[] {
  const patterns: PatternReport[] = [];
  if (commits.length < 3) return patterns;

  // Detect burst commits (5+ components in a single commit)
  for (let i = 0; i < commits.length; i++) {
    const fibers = commits[i].fibers ?? [];
    const named = fibers.filter(f => f.displayName).map(f => f.displayName);
    if (named.length >= 5) {
      patterns.push({
        pattern: 'burst',
        components: [...new Set(named)],
        description: `Commit #${i} triggered ${named.length} components simultaneously`,
        confidence: Math.min(1, named.length / 10),
      });
    }
  }

  // Detect cascade: if component A renders, B and C always follow
  const componentCommits = new Map<string, Set<number>>();
  for (let i = 0; i < commits.length; i++) {
    const fibers = commits[i].fibers ?? [];
    for (const fiber of fibers) {
      if (!fiber.displayName) continue;
      const set = componentCommits.get(fiber.displayName) ?? new Set();
      set.add(i);
      componentCommits.set(fiber.displayName, set);
    }
  }

  const componentNames = [...componentCommits.keys()];
  for (let a = 0; a < componentNames.length; a++) {
    const aCommits = componentCommits.get(componentNames[a]!)!;
    if (aCommits.size < 3) continue;
    const cascadeTargets: string[] = [];
    for (let b = a + 1; b < componentNames.length; b++) {
      const bCommits = componentCommits.get(componentNames[b]!)!;
      if (bCommits.size < 3) continue;
      // Check if B appears in >=80% of commits where A appears
      let coOccurrence = 0;
      for (const ci of aCommits) {
        if (bCommits.has(ci)) coOccurrence++;
      }
      if (coOccurrence / aCommits.size >= 0.8) {
        cascadeTargets.push(componentNames[b]!);
      }
    }
    if (cascadeTargets.length >= 2) {
      patterns.push({
        pattern: 'cascade',
        components: [componentNames[a]!, ...cascadeTargets],
        description: `${componentNames[a]} consistently triggers ${cascadeTargets.join(', ')} to re-render`,
        confidence: 0.8,
      });
    }
  }

  // Detect escalating: increasing number of unique components per commit
  const countsPerCommit = commits.map(c => (c.fibers ?? []).filter(f => f.displayName).length);
  if (countsPerCommit.length >= 5) {
    const firstHalf = countsPerCommit.slice(0, Math.floor(countsPerCommit.length / 2));
    const secondHalf = countsPerCommit.slice(Math.floor(countsPerCommit.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    if (avgSecond > avgFirst * 1.5 && avgSecond > 3) {
      patterns.push({
        pattern: 'escalating',
        components: [],
        description: `Component count per commit is growing (${avgFirst.toFixed(1)} → ${avgSecond.toFixed(1)})`,
        confidence: 0.7,
      });
    }
  }

  return patterns;
}
