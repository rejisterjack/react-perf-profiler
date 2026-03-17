/**
 * Overall performance scoring system
 * Calculates a comprehensive performance score based on multiple metrics
 */

import type { CommitData } from '../../content/types';
import type { WastedRenderReport } from './wastedRenderAnalysis';
import type { MemoEffectivenessReport } from './memoAnalysis';

/** Performance metrics with overall score and category breakdowns */
export interface PerformanceMetrics {
  /** Overall score from 0-100 */
  overallScore: number;
  /** Individual category scores (0-100) */
  categories: {
    /** Score based on wasted render rate */
    wastedRenders: number;
    /** Score based on memoization effectiveness */
    memoization: number;
    /** Score based on render time performance */
    renderTime: number;
    /** Score based on component count complexity */
    componentCount: number;
  };
  /** List of identified performance issues */
  issues: PerformanceIssue[];
}

/** Individual performance issue */
export interface PerformanceIssue {
  /** Type of issue */
  type: 'wasted-render' | 'ineffective-memo' | 'slow-render' | 'too-many-components';
  /** Severity level */
  severity: 'critical' | 'warning' | 'info';
  /** Component name (if applicable) */
  componentName?: string;
  /** Human-readable description */
  message: string;
  /** Suggested fix */
  suggestion: string;
}

/** Configuration for performance scoring */
export interface PerformanceScoreConfig {
  /** Weight for wasted renders (0-1) */
  wastedRenderWeight?: number;
  /** Weight for memoization (0-1) */
  memoizationWeight?: number;
  /** Weight for render time (0-1) */
  renderTimeWeight?: number;
  /** Weight for component count (0-1) */
  componentCountWeight?: number;
  /** Threshold for slow render in ms */
  slowRenderThreshold?: number;
  /** Threshold for too many components */
  maxComponentsThreshold?: number;
}

// Default weights (must sum to 1)
const DEFAULT_WEIGHTS = {
  wastedRenderWeight: 0.35,
  memoizationWeight: 0.25,
  renderTimeWeight: 0.25,
  componentCountWeight: 0.15,
};

/**
 * Calculates overall performance score based on all available metrics
 * Combines wasted render analysis, memo effectiveness, and render timing
 * 
 * @param commits - Array of commit data
 * @param wastedRenderReports - Reports from wasted render analysis
 * @param memoReports - Reports from memo effectiveness analysis
 * @param config - Optional scoring configuration
 * @returns Complete performance metrics with scores and issues
 * 
 * @example
 * ```typescript
 * const metrics = calculatePerformanceScore(
 *   commits,
 *   wastedRenderReports,
 *   memoReports,
 *   { slowRenderThreshold: 16 }
 * );
 * console.log(metrics.overallScore); // 0-100
 * ```
 */
export function calculatePerformanceScore(
  commits: CommitData[],
  wastedRenderReports: WastedRenderReport[],
  memoReports: MemoEffectivenessReport[],
  config: PerformanceScoreConfig = {}
): PerformanceMetrics {
  // Merge config with defaults
  const weights = {
    wastedRenderWeight: config.wastedRenderWeight ?? DEFAULT_WEIGHTS.wastedRenderWeight,
    memoizationWeight: config.memoizationWeight ?? DEFAULT_WEIGHTS.memoizationWeight,
    renderTimeWeight: config.renderTimeWeight ?? DEFAULT_WEIGHTS.renderTimeWeight,
    componentCountWeight: config.componentCountWeight ?? DEFAULT_WEIGHTS.componentCountWeight,
  };

  // Normalize weights to ensure they sum to 1
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalizedWeights = {
    wastedRenderWeight: weights.wastedRenderWeight / totalWeight,
    memoizationWeight: weights.memoizationWeight / totalWeight,
    renderTimeWeight: weights.renderTimeWeight / totalWeight,
    componentCountWeight: weights.componentCountWeight / totalWeight,
  };

  // Calculate category scores
  const wastedRenderScore = scoreWastedRenders(wastedRenderReports);
  const memoizationScore = scoreMemoization(memoReports);
  const renderTimeScore = scoreRenderTime(commits, config.slowRenderThreshold);
  const componentCountScore = scoreComponentCount(commits, config.maxComponentsThreshold);

  // Calculate weighted overall score
  const overallScore = Math.round(
    wastedRenderScore * normalizedWeights.wastedRenderWeight +
    memoizationScore * normalizedWeights.memoizationWeight +
    renderTimeScore * normalizedWeights.renderTimeWeight +
    componentCountScore * normalizedWeights.componentCountWeight
  );

  // Collect all issues
  const issues: PerformanceIssue[] = [];
  issues.push(...extractWastedRenderIssues(wastedRenderReports));
  issues.push(...extractMemoIssues(memoReports));
  issues.push(...extractRenderTimeIssues(commits, config.slowRenderThreshold));
  issues.push(...extractComponentCountIssues(commits, config.maxComponentsThreshold));

  // Sort issues by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    categories: {
      wastedRenders: wastedRenderScore,
      memoization: memoizationScore,
      renderTime: renderTimeScore,
      componentCount: componentCountScore,
    },
    issues,
  };
}

/**
 * Scores wasted render performance (0-100)
 * Higher score = fewer wasted renders
 * 
 * @param reports - Wasted render reports
 * @returns Score from 0-100
 */
export function scoreWastedRenders(reports: WastedRenderReport[]): number {
  if (!reports || reports.length === 0) {
    return 100; // No reports = perfect score
  }

  let totalScore = 100;

  for (const report of reports) {
    // Deduct based on severity
    switch (report.severity) {
      case 'critical':
        totalScore -= 15 * report.wastedRenderRate;
        break;
      case 'warning':
        totalScore -= 8 * report.wastedRenderRate;
        break;
      case 'info':
        totalScore -= 3 * report.wastedRenderRate;
        break;
    }
  }

  return Math.max(0, Math.round(totalScore));
}

/**
 * Scores memoization effectiveness (0-100)
 * Higher score = better memoization usage
 * 
 * @param reports - Memo effectiveness reports
 * @returns Score from 0-100
 */
export function scoreMemoization(reports: MemoEffectivenessReport[]): number {
  if (!reports || reports.length === 0) {
    return 100;
  }

  let totalScore = 100;
  let componentWeight = 0;

  for (const report of reports) {
    // Weight by number of issues
    const weight = Math.min(1, report.issues.length / 3);
    componentWeight += weight;

    if (!report.hasMemo && report.issues.length > 0) {
      // Missing memo where needed
      totalScore -= 10 * weight;
    } else if (report.hasMemo && !report.isEffective) {
      // Ineffective memo usage
      totalScore -= 15 * weight;
    }

    // Deduct for low hit rate
    if (report.currentHitRate < 0.5) {
      totalScore -= 10 * (1 - report.currentHitRate);
    }
  }

  // Normalize based on number of problematic components
  const adjustment = Math.min(1, componentWeight / 5);
  return Math.max(0, Math.round(totalScore * (0.7 + 0.3 * (1 - adjustment))));
}

/**
 * Scores render time performance (0-100)
 * Higher score = faster renders
 * 
 * @param commits - Array of commit data
 * @param threshold - Threshold for slow render in ms (default: 16ms for 60fps)
 * @returns Score from 0-100
 */
export function scoreRenderTime(
  commits: CommitData[],
  threshold: number = 16
): number {
  if (!commits || commits.length === 0) {
    return 100;
  }

  let totalDuration = 0;
  let slowRenderCount = 0;
  let totalRenders = 0;

  for (const commit of commits) {
    if (!commit.fibers) continue;

    for (const fiber of commit.fibers) {
      totalDuration += fiber.actualDuration;
      totalRenders++;

      if (fiber.actualDuration > threshold) {
        slowRenderCount++;
      }
    }
  }

  if (totalRenders === 0) return 100;

  // Calculate metrics
  const averageDuration = totalDuration / totalRenders;
  const slowRenderRate = slowRenderCount / totalRenders;

  // Score based on average duration (ideal: < 8ms, bad: > 50ms)
  const durationScore = Math.max(0, 100 - (averageDuration / 8) * 20);

  // Score based on slow render rate
  const slowRenderScore = Math.max(0, 100 - slowRenderRate * 100);

  return Math.round((durationScore + slowRenderScore) / 2);
}

/**
 * Scores component count complexity (0-100)
 * Higher score = more manageable component tree
 * 
 * @param commits - Array of commit data
 * @param threshold - Threshold for too many components (default: 500)
 * @returns Score from 0-100
 */
export function scoreComponentCount(
  commits: CommitData[],
  threshold: number = 500
): number {
  if (!commits || commits.length === 0) {
    return 100;
  }

  // Calculate average component count per commit
  let totalComponents = 0;
  for (const commit of commits) {
    totalComponents += commit.fibers?.length ?? 0;
  }
  const averageCount = totalComponents / commits.length;

  // Score based on threshold
  // 100 = below threshold, decreases as count exceeds threshold
  if (averageCount <= threshold) {
    return 100;
  }

  const excessRatio = (averageCount - threshold) / threshold;
  return Math.max(0, Math.round(100 - excessRatio * 50));
}

/**
 * Extracts issues from wasted render reports
 */
function extractWastedRenderIssues(
  reports: WastedRenderReport[]
): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  for (const report of reports) {
    if (report.wastedRenders === 0) continue;

    issues.push({
      type: 'wasted-render',
      severity: report.severity,
      componentName: report.componentName,
      message: `${report.componentName} has ${report.wastedRenders} wasted renders (${Math.round(report.wastedRenderRate * 100)}% rate)`,
      suggestion: report.recommendations[0] || 'Consider using React.memo()',
    });
  }

  return issues;
}

/**
 * Extracts issues from memo effectiveness reports
 */
function extractMemoIssues(
  reports: MemoEffectivenessReport[]
): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  for (const report of reports) {
    if (report.issues.length === 0 && report.isEffective) continue;

    const criticalIssues = report.issues.filter(i => i.impact > 0.7);
    const severity = criticalIssues.length > 0 ? 'critical' :
                     report.issues.length > 2 ? 'warning' : 'info';

    issues.push({
      type: 'ineffective-memo',
      severity,
      componentName: report.componentName,
      message: `${report.componentName} has ${report.issues.length} memoization issues (hit rate: ${Math.round(report.currentHitRate * 100)}%)`,
      suggestion: report.recommendations[0] || 'Review prop stability',
    });
  }

  return issues;
}

/**
 * Extracts issues from render time data
 */
function extractRenderTimeIssues(
  commits: CommitData[],
  threshold: number = 16
): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const slowComponents = new Map<string, { count: number; maxDuration: number }>();

  for (const commit of commits) {
    if (!commit.fibers) continue;

    for (const fiber of commit.fibers) {
      if (fiber.actualDuration > threshold) {
        const existing = slowComponents.get(fiber.displayName);
        if (existing) {
          existing.count++;
          existing.maxDuration = Math.max(existing.maxDuration, fiber.actualDuration);
        } else {
          slowComponents.set(fiber.displayName, {
            count: 1,
            maxDuration: fiber.actualDuration,
          });
        }
      }
    }
  }

  // Convert to issues
  slowComponents.forEach((data, name) => {
    const severity = data.maxDuration > 100 ? 'critical' :
                     data.maxDuration > 50 ? 'warning' : 'info';

    issues.push({
      type: 'slow-render',
      severity,
      componentName: name,
      message: `${name} has slow renders (${data.maxDuration.toFixed(1)}ms max, ${data.count} occurrences)`,
      suggestion: 'Optimize render method or split into smaller components',
    });
  });

  return issues;
}

/**
 * Extracts issues from component count data
 */
function extractComponentCountIssues(
  commits: CommitData[],
  threshold: number = 500
): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  if (!commits || commits.length === 0) return issues;

  let maxCount = 0;
  for (const commit of commits) {
    maxCount = Math.max(maxCount, commit.fibers?.length ?? 0);
  }

  if (maxCount > threshold) {
    issues.push({
      type: 'too-many-components',
      severity: maxCount > threshold * 2 ? 'critical' : 'warning',
      message: `High component count detected (${maxCount} components in one commit)`,
      suggestion: 'Consider virtualizing lists or code-splitting large component trees',
    });
  }

  return issues;
}
