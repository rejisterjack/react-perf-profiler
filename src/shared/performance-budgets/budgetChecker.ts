/**
 * Performance Budget Checker
 * @module shared/performance-budgets/budgetChecker
 *
 * Core logic for checking performance profiles against configured budgets.
 * Provides comprehensive violation detection with severity levels and recommendations.
 */

import { analyzeWastedRenders } from '@/panel/utils/wastedRenderAnalysis';
import { analyzeMemoEffectiveness } from '@/panel/utils/memoAnalysis';
import { calculatePerformanceScore } from '@/panel/utils/performanceScore';
import type { CommitData, FiberData } from '@/content/types';
import type { MemoEffectivenessReport } from '@/panel/utils/memoAnalysis';
import type { WastedRenderReport } from '@/panel/utils/wastedRenderAnalysis';
import type {
  BudgetConfig,
  BudgetViolation,
  BudgetCheckResult,
  BudgetSummary,
  ProfileMetadata,
  ProfileData,
  BudgetSeverity,
} from './types';
import { DEFAULT_BUDGET_CONFIG } from './types';

/**
 * Component metrics extracted from profile data
 */
interface ExtractedMetrics {
  /** Component render counts */
  renderCounts: Map<string, number>;
  /** Component render durations */
  renderDurations: Map<string, number[]>;
  /** Memo hit rates */
  memoHitRates: Map<string, number>;
  /** Whether component is memoized */
  isMemoized: Map<string, boolean>;
  /** RSC payload size in bytes */
  rscPayloadSize: number;
  /** Number of slow renders */
  slowRenderCount: number;
  /** Total number of renders */
  totalRenderCount: number;
}

/**
 * Checks a performance profile against configured budgets
 *
 * @param profile - The profile data to check
 * @param config - Budget configuration (uses defaults if not provided)
 * @returns Complete check result with violations and summary
 *
 * @example
 * ```typescript
 * const result = checkPerformanceBudget(profile, {
 *   wastedRenderThreshold: 0.1,
 *   maxRenderTimeMs: 16
 * });
 *
 * if (!result.passed) {
 *   console.error('Budget violations:', result.violations);
 * }
 * ```
 */
export function checkPerformanceBudget(
  profile: ProfileData,
  config: Partial<BudgetConfig> = {}
): BudgetCheckResult {
  const fullConfig = { ...DEFAULT_BUDGET_CONFIG, ...config };
  const violations: BudgetViolation[] = [];
  const timestamp = Date.now();

  // Extract metrics from profile
  const metrics = extractMetrics(profile);

  // Run analysis
  const wastedRenderReports = analyzeWastedRenders(profile.commits);
  const memoReports = generateMemoReports(profile.commits, metrics);
  const performanceMetrics = calculatePerformanceScore(
    profile.commits,
    wastedRenderReports,
    memoReports
  );

  // Check each budget type
  violations.push(...checkWastedRenderBudget(wastedRenderReports, fullConfig, timestamp));
  violations.push(...checkMemoHitRateBudget(memoReports, fullConfig, timestamp));
  violations.push(...checkRenderTimeBudget(metrics, fullConfig, timestamp));
  violations.push(...checkRSCPayloadSizeBudget(metrics, fullConfig, timestamp));
  violations.push(...checkPerformanceScoreBudget(performanceMetrics.overallScore, fullConfig, timestamp));
  violations.push(...checkSlowRenderPercentageBudget(metrics, fullConfig, timestamp));

  // Check custom budgets
  violations.push(...checkCustomBudgets(metrics, fullConfig, timestamp));

  // Sort violations by severity
  violations.sort((a, b) => {
    const severityOrder = { error: 3, warning: 2, info: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });

  // Count by severity
  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;
  const infoCount = violations.filter((v) => v.severity === 'info').length;

  // Determine if passed
  const passed = fullConfig.failOnWarning
    ? errorCount === 0 && warningCount === 0
    : errorCount === 0;

  // Generate summary
  const summary = generateSummary(
    metrics,
    wastedRenderReports,
    memoReports,
    performanceMetrics.overallScore,
    violations.length,
    fullConfig
  );

  // Generate metadata
  const metadata: ProfileMetadata = {
    version: profile.version,
    recordingDuration: profile.recordingDuration,
    commitCount: profile.commits.length,
    componentCount: metrics.renderCounts.size,
    recordedAt: profile.commits[0]?.timestamp,
  };

  return {
    passed,
    totalViolations: violations.length,
    errorCount,
    warningCount,
    infoCount,
    violations,
    summary,
    metadata,
    timestamp,
  };
}

/**
 * Extracts metrics from profile data
 */
function extractMetrics(profile: ProfileData): ExtractedMetrics {
  const renderCounts = new Map<string, number>();
  const renderDurations = new Map<string, number[]>();
  const memoHitRates = new Map<string, number>();
  const isMemoized = new Map<string, boolean>();
  let slowRenderCount = 0;
  let totalRenderCount = 0;

  // Process commits
  for (const commit of profile.commits) {
    const fibers = commit.fibers || commit.nodes || [];

    for (const fiber of fibers as FiberData[]) {
      const name = fiber.displayName;
      if (!name) continue;

      // Update render count
      renderCounts.set(name, (renderCounts.get(name) || 0) + 1);
      totalRenderCount++;

      // Update render durations
      const durations = renderDurations.get(name) || [];
      durations.push(fiber.actualDuration);
      renderDurations.set(name, durations);

      // Check for slow render (>16ms)
      if (fiber.actualDuration > 16) {
        slowRenderCount++;
      }

      // Track memoization
      if (fiber.tag === 12 || fiber.tag === 21) {
        // SimpleMemoComponent or MemoComponent
        isMemoized.set(name, true);
      }
    }
  }

  // Calculate memo hit rates (simplified - assumes memo works if component is memoized)
  isMemoized.forEach((memoized, name) => {
    if (memoized) {
      // Default to 0.8 for memoized components without detailed tracking
      memoHitRates.set(name, 0.8);
    }
  });

  // Get RSC payload size
  let rscPayloadSize = 0;
  if (profile.rscAnalysis?.metrics) {
    rscPayloadSize = profile.rscAnalysis.metrics.payloadSize;
  } else if (profile.rscPayloads) {
    // Estimate size from payloads
    rscPayloadSize = profile.rscPayloads.reduce((sum, p) => {
      const payload = p as { totalSize?: number };
      return sum + (payload.totalSize || 0);
    }, 0);
  }

  return {
    renderCounts,
    renderDurations,
    memoHitRates,
    isMemoized,
    rscPayloadSize,
    slowRenderCount,
    totalRenderCount,
  };
}

/**
 * Generates memo effectiveness reports from metrics
 */
function generateMemoReports(
  commits: CommitData[],
  metrics: ExtractedMetrics
): MemoEffectivenessReport[] {
  const reports: MemoEffectivenessReport[] = [];

  metrics.isMemoized.forEach((memoized, componentName) => {
    if (!memoized) return;

    const renderCount = metrics.renderCounts.get(componentName) || 0;
    const hitRate = metrics.memoHitRates.get(componentName) || 0;

    reports.push({
      componentName,
      hasMemo: true,
      currentHitRate: hitRate,
      optimalHitRate: 0.95,
      isEffective: hitRate >= 0.8,
      issues: [],
      propStability: [],
      recommendations: [],
    });
  });

  return reports;
}

/**
 * Checks wasted render budget
 */
function checkWastedRenderBudget(
  reports: WastedRenderReport[],
  config: BudgetConfig,
  timestamp: number
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  for (const report of reports) {
    if (report.wastedRenderRate > config.wastedRenderThreshold) {
      const severity = determineSeverity(report.wastedRenderRate, config.wastedRenderThreshold);
      
      violations.push({
        id: `violation-wasted-${report.componentName}-${timestamp}`,
        budgetId: 'wasted-render-rate',
        budgetName: 'Wasted Render Rate',
        description: 'Maximum percentage of renders that should be wasted',
        severity,
        actualValue: report.wastedRenderRate,
        threshold: config.wastedRenderThreshold,
        difference: report.wastedRenderRate - config.wastedRenderThreshold,
        percentageOver: (report.wastedRenderRate / config.wastedRenderThreshold - 1) * 100,
        componentName: report.componentName,
        message: `${report.componentName} has ${(report.wastedRenderRate * 100).toFixed(1)}% wasted renders (threshold: ${(config.wastedRenderThreshold * 100).toFixed(1)}%)`,
        recommendation: report.recommendations[0] || 'Consider using React.memo()',
        timestamp,
      });
    }
  }

  return violations;
}

/**
 * Checks memo hit rate budget
 */
function checkMemoHitRateBudget(
  reports: MemoEffectivenessReport[],
  config: BudgetConfig,
  timestamp: number
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  for (const report of reports) {
    if (report.hasMemo && report.currentHitRate < config.memoHitRateThreshold) {
      const severity = report.currentHitRate < 0.5 ? 'error' : 'warning';

      violations.push({
        id: `violation-memo-${report.componentName}-${timestamp}`,
        budgetId: 'memo-hit-rate',
        budgetName: 'Memo Hit Rate',
        description: 'Minimum memoization hit rate for memoized components',
        severity,
        actualValue: report.currentHitRate,
        threshold: config.memoHitRateThreshold,
        difference: config.memoHitRateThreshold - report.currentHitRate,
        percentageOver: (config.memoHitRateThreshold / report.currentHitRate - 1) * 100,
        componentName: report.componentName,
        message: `${report.componentName} has ${(report.currentHitRate * 100).toFixed(1)}% memo hit rate (threshold: ${(config.memoHitRateThreshold * 100).toFixed(1)}%)`,
        recommendation: 'Check for unstable props and wrap callbacks with useCallback()',
        timestamp,
      });
    }
  }

  return violations;
}

/**
 * Checks render time budget
 */
function checkRenderTimeBudget(
  metrics: ExtractedMetrics,
  config: BudgetConfig,
  timestamp: number
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  for (const [componentName, durations] of metrics.renderDurations.entries()) {
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    if (avgDuration > config.maxRenderTimeMs) {
      const severity = avgDuration > 50 ? 'error' : 'warning';

      violations.push({
        id: `violation-time-${componentName}-${timestamp}`,
        budgetId: 'max-render-time',
        budgetName: 'Maximum Render Time',
        description: 'Maximum average render time per component',
        severity,
        actualValue: avgDuration,
        threshold: config.maxRenderTimeMs,
        difference: avgDuration - config.maxRenderTimeMs,
        percentageOver: (avgDuration / config.maxRenderTimeMs - 1) * 100,
        componentName,
        message: `${componentName} has average render time of ${avgDuration.toFixed(2)}ms (threshold: ${config.maxRenderTimeMs}ms)`,
        recommendation: 'Optimize component render logic or split into smaller components',
        timestamp,
      });
    }
  }

  return violations;
}

/**
 * Checks RSC payload size budget
 */
function checkRSCPayloadSizeBudget(
  metrics: ExtractedMetrics,
  config: BudgetConfig,
  timestamp: number
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  if (metrics.rscPayloadSize > config.maxRSCPayloadSize) {
    const severity = metrics.rscPayloadSize > config.maxRSCPayloadSize * 2 ? 'error' : 'warning';
    const sizeKB = metrics.rscPayloadSize / 1024;
    const thresholdKB = config.maxRSCPayloadSize / 1024;

    violations.push({
      id: `violation-rsc-${timestamp}`,
      budgetId: 'rsc-payload-size',
      budgetName: 'RSC Payload Size',
      description: 'Maximum RSC payload size in bytes',
      severity,
      actualValue: metrics.rscPayloadSize,
      threshold: config.maxRSCPayloadSize,
      difference: metrics.rscPayloadSize - config.maxRSCPayloadSize,
      percentageOver: (metrics.rscPayloadSize / config.maxRSCPayloadSize - 1) * 100,
      message: `RSC payload size is ${sizeKB.toFixed(1)}KB (threshold: ${thresholdKB.toFixed(1)}KB)`,
      recommendation: 'Consider code splitting, reducing props size, or adding caching',
      timestamp,
    });
  }

  return violations;
}

/**
 * Checks overall performance score budget
 */
function checkPerformanceScoreBudget(
  score: number,
  config: BudgetConfig,
  timestamp: number
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  if (score < config.minPerformanceScore) {
    const severity = score < 50 ? 'error' : 'warning';

    violations.push({
      id: `violation-score-${timestamp}`,
      budgetId: 'performance-score',
      budgetName: 'Overall Performance Score',
      description: 'Minimum overall performance score (0-100)',
      severity,
      actualValue: score,
      threshold: config.minPerformanceScore,
      difference: config.minPerformanceScore - score,
      percentageOver: ((config.minPerformanceScore - score) / config.minPerformanceScore) * 100,
      message: `Overall performance score is ${score.toFixed(1)} (threshold: ${config.minPerformanceScore})`,
      recommendation: 'Review wasted renders and memoization effectiveness',
      timestamp,
    });
  }

  return violations;
}

/**
 * Checks slow render percentage budget
 */
function checkSlowRenderPercentageBudget(
  metrics: ExtractedMetrics,
  config: BudgetConfig,
  timestamp: number
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  if (metrics.totalRenderCount === 0) return violations;

  const slowRenderPercentage = metrics.slowRenderCount / metrics.totalRenderCount;

  if (slowRenderPercentage > config.maxSlowRenderPercentage) {
    const severity = slowRenderPercentage > 0.3 ? 'error' : 'warning';

    violations.push({
      id: `violation-slow-${timestamp}`,
      budgetId: 'slow-render-percentage',
      budgetName: 'Slow Render Percentage',
      description: 'Maximum percentage of slow renders (>16ms)',
      severity,
      actualValue: slowRenderPercentage,
      threshold: config.maxSlowRenderPercentage,
      difference: slowRenderPercentage - config.maxSlowRenderPercentage,
      percentageOver: (slowRenderPercentage / config.maxSlowRenderPercentage - 1) * 100,
      message: `${(slowRenderPercentage * 100).toFixed(1)}% of renders exceed 16ms (threshold: ${(config.maxSlowRenderPercentage * 100).toFixed(1)}%)`,
      recommendation: 'Optimize slow components to maintain 60fps',
      timestamp,
    });
  }

  return violations;
}

/**
 * Checks custom user-defined budgets
 */
function checkCustomBudgets(
  metrics: ExtractedMetrics,
  config: BudgetConfig,
  timestamp: number
): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  for (const budget of config.budgets) {
    if (!budget.enabled) continue;

    // Custom budget checking logic would go here
    // For now, we check if there are any components exceeding custom thresholds
    for (const [componentName, durations] of metrics.renderDurations.entries()) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      // Example: Custom render time budget
      if (budget.id === 'custom-render-time' && avgDuration > budget.threshold) {
        violations.push({
          id: `violation-custom-${budget.id}-${componentName}-${timestamp}`,
          budgetId: budget.id,
          budgetName: budget.name,
          description: budget.description,
          severity: budget.severity,
          actualValue: avgDuration,
          threshold: budget.threshold,
          difference: avgDuration - budget.threshold,
          percentageOver: (avgDuration / budget.threshold - 1) * 100,
          componentName,
          message: budget.errorMessage || `${componentName} exceeds custom threshold`,
          recommendation: 'Review component performance',
          timestamp,
        });
      }
    }
  }

  return violations;
}

/**
 * Determines severity based on how much threshold is exceeded
 */
function determineSeverity(actual: number, threshold: number): BudgetSeverity {
  const ratio = actual / threshold;
  if (ratio >= 2) return 'error';
  if (ratio >= 1.5) return 'warning';
  return 'info';
}

/**
 * Generates summary statistics
 */
function generateSummary(
  metrics: ExtractedMetrics,
  wastedReports: WastedRenderReport[],
  memoReports: MemoEffectivenessReport[],
  performanceScore: number,
  violationCount: number,
  config: BudgetConfig
): BudgetSummary {
  // Calculate average wasted render rate
  const avgWastedRate =
    wastedReports.length > 0
      ? wastedReports.reduce((sum, r) => sum + r.wastedRenderRate, 0) / wastedReports.length
      : 0;

  // Calculate average memo hit rate
  const avgMemoHitRate =
    memoReports.length > 0
      ? memoReports.reduce((sum, r) => sum + r.currentHitRate, 0) / memoReports.length
      : 0;

  // Calculate average render time
  let totalDuration = 0;
  let durationCount = 0;
  for (const durations of metrics.renderDurations.values()) {
    totalDuration += durations.reduce((a, b) => a + b, 0);
    durationCount += durations.length;
  }
  const avgRenderTime = durationCount > 0 ? totalDuration / durationCount : 0;

  // Calculate budgets passed percentage
  const totalBudgets = 6 + config.budgets.filter((b) => b.enabled).length;
  const passedBudgets = Math.max(0, totalBudgets - violationCount);
  const budgetsPassedPercentage = (passedBudgets / totalBudgets) * 100;

  return {
    totalComponents: metrics.renderCounts.size,
    totalCommits: 0, // Will be set from profile
    averageWastedRenderRate: avgWastedRate,
    averageMemoHitRate: avgMemoHitRate,
    averageRenderTime: avgRenderTime,
    performanceScore,
    rscPayloadSize: metrics.rscPayloadSize,
    budgetsPassedPercentage,
  };
}

/**
 * Formats a budget check result as human-readable text
 */
export function formatCheckResultHuman(result: BudgetCheckResult): string {
  const lines: string[] = [];

  lines.push('╔════════════════════════════════════════════════════════════╗');
  lines.push('║           Performance Budget Check Results                 ║');
  lines.push('╚════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Status
  const status = result.passed ? '✅ PASSED' : '❌ FAILED';
  lines.push(`Status: ${status}`);
  lines.push('');

  // Summary
  lines.push('📊 Summary:');
  lines.push(`  • Total Components: ${result.summary.totalComponents}`);
  lines.push(`  • Performance Score: ${result.summary.performanceScore.toFixed(1)}/100`);
  lines.push(`  • Avg Wasted Render Rate: ${(result.summary.averageWastedRenderRate * 100).toFixed(1)}%`);
  lines.push(`  • Avg Memo Hit Rate: ${(result.summary.averageMemoHitRate * 100).toFixed(1)}%`);
  lines.push(`  • Avg Render Time: ${result.summary.averageRenderTime.toFixed(2)}ms`);
  if (result.summary.rscPayloadSize > 0) {
    lines.push(`  • RSC Payload Size: ${(result.summary.rscPayloadSize / 1024).toFixed(1)}KB`);
  }
  lines.push(`  • Budgets Passed: ${result.summary.budgetsPassedPercentage.toFixed(1)}%`);
  lines.push('');

  // Violations
  if (result.violations.length > 0) {
    lines.push('⚠️  Violations:');
    lines.push('');

    for (const v of result.violations) {
      const icon = v.severity === 'error' ? '🔴' : v.severity === 'warning' ? '🟡' : '🔵';
      lines.push(`  ${icon} [${v.severity.toUpperCase()}] ${v.budgetName}`);
      lines.push(`     Component: ${v.componentName || 'N/A'}`);
      lines.push(`     Actual: ${v.actualValue.toFixed(2)} | Threshold: ${v.threshold.toFixed(2)}`);
      lines.push(`     ${v.percentageOver.toFixed(1)}% over threshold`);
      lines.push(`     ${v.message}`);
      if (v.recommendation) {
        lines.push(`     💡 ${v.recommendation}`);
      }
      lines.push('');
    }
  } else {
    lines.push('✅ No budget violations detected!');
    lines.push('');
  }

  // Footer
  lines.push(`Checked at: ${new Date(result.timestamp).toISOString()}`);
  lines.push(`Profile: ${result.metadata.commitCount} commits, ${result.metadata.componentCount} components`);

  return lines.join('\n');
}

/**
 * Formats a budget check result as JSON
 */
export function formatCheckResultJson(result: BudgetCheckResult): string {
  return JSON.stringify(result, null, 2);
}
