/**
 * Performance Budget Types
 * @module shared/performance-budgets/types
 *
 * Type definitions for performance budgets used in CI/CD integration.
 * Performance budgets allow teams to set thresholds and enforce performance
 * standards automatically during the development workflow.
 */

import type { CommitData, WastedRenderReport, MemoReport } from '@/shared/types';
import type { RSCMetrics } from '@/shared/types/rsc';

/**
 * Severity level for budget violations
 */
export type BudgetSeverity = 'error' | 'warning' | 'info';

/**
 * Individual performance budget threshold configuration
 */
export interface PerformanceBudget {
  /** Unique identifier for the budget */
  id: string;
  /** Human-readable name */
  name: string;
  /** Budget description */
  description?: string;
  /** Threshold value */
  threshold: number;
  /** Severity when threshold is exceeded */
  severity: BudgetSeverity;
  /** Whether this budget is enabled */
  enabled: boolean;
  /** Custom error message */
  errorMessage?: string;
}

/**
 * Complete budget configuration for a project
 */
export interface BudgetConfig {
  /** Configuration version */
  version: number;
  /** Project name */
  projectName?: string;
  /** Wasted render rate threshold (0-1, where 0.1 = 10%) */
  wastedRenderThreshold: number;
  /** Memo hit rate threshold (0-1, where 0.8 = 80%) */
  memoHitRateThreshold: number;
  /** Maximum average render time in milliseconds */
  maxRenderTimeMs: number;
  /** Maximum RSC payload size in bytes */
  maxRSCPayloadSize: number;
  /** Minimum overall performance score (0-100) */
  minPerformanceScore: number;
  /** Maximum slow render percentage (0-1) */
  maxSlowRenderPercentage: number;
  /** Individual budget items for specific metrics */
  budgets: PerformanceBudget[];
  /** Global severity override (optional) */
  defaultSeverity?: BudgetSeverity;
  /** Whether to fail CI on warning-level violations */
  failOnWarning: boolean;
  /** Output format for CI */
  outputFormat: 'json' | 'human';
}

/**
 * A detected budget violation
 */
export interface BudgetViolation {
  /** Unique violation ID */
  id: string;
  /** Budget ID that was violated */
  budgetId: string;
  /** Human-readable name of the budget */
  budgetName: string;
  /** Budget description */
  description?: string;
  /** Severity of the violation */
  severity: BudgetSeverity;
  /** Actual measured value */
  actualValue: number;
  /** Threshold that was exceeded */
  threshold: number;
  /** Difference from threshold */
  difference: number;
  /** Percentage over threshold */
  percentageOver: number;
  /** Component name (if applicable) */
  componentName?: string;
  /** Commit ID (if applicable) */
  commitId?: string;
  /** Human-readable message */
  message: string;
  /** Suggested fix or recommendation */
  recommendation?: string;
  /** Timestamp when violation was detected */
  timestamp: number;
}

/**
 * Result of checking a profile against budgets
 */
export interface BudgetCheckResult {
  /** Whether all budgets passed */
  passed: boolean;
  /** Total number of violations */
  totalViolations: number;
  /** Number of error-level violations */
  errorCount: number;
  /** Number of warning-level violations */
  warningCount: number;
  /** Number of info-level violations */
  infoCount: number;
  /** All detected violations */
  violations: BudgetViolation[];
  /** Summary statistics */
  summary: BudgetSummary;
  /** Profile metadata */
  metadata: ProfileMetadata;
  /** Timestamp when check was performed */
  timestamp: number;
}

/**
 * Summary of budget check results
 */
export interface BudgetSummary {
  /** Total components analyzed */
  totalComponents: number;
  /** Total commits analyzed */
  totalCommits: number;
  /** Average wasted render rate */
  averageWastedRenderRate: number;
  /** Average memo hit rate */
  averageMemoHitRate: number;
  /** Average render time in ms */
  averageRenderTime: number;
  /** Overall performance score */
  performanceScore: number;
  /** Total RSC payload size */
  rscPayloadSize: number;
  /** Percentage of budgets passed */
  budgetsPassedPercentage: number;
}

/**
 * Metadata about the profile being checked
 */
export interface ProfileMetadata {
  /** Profile version */
  version: number;
  /** Recording duration in ms */
  recordingDuration: number;
  /** Number of commits */
  commitCount: number;
  /** Number of unique components */
  componentCount: number;
  /** React version (if available) */
  reactVersion?: string;
  /** Framework (next, remix, etc.) */
  framework?: string;
  /** Timestamp when profile was recorded */
  recordedAt?: number;
}

/**
 * Profile data structure (matches exported profile format)
 */
export interface ProfileData {
  /** Profile version */
  version: number;
  /** Recording duration in ms */
  recordingDuration: number;
  /** Commit data */
  commits: CommitData[];
  /** RSC payloads (if any) */
  rscPayloads?: unknown[];
  /** RSC analysis results (if any) */
  rscAnalysis?: {
    metrics?: RSCMetrics;
  };
}

/**
 * CLI options for budget checking
 */
export interface BudgetCheckOptions {
  /** Path to profile JSON file */
  profilePath: string;
  /** Path to budget config file */
  configPath?: string;
  /** Output format */
  format?: 'json' | 'human';
  /** Whether to fail on warnings */
  failOnWarning?: boolean;
  /** Output file path (optional) */
  outputPath?: string;
  /** Quiet mode - only output errors */
  quiet?: boolean;
  /** Verbose mode */
  verbose?: boolean;
}

/**
 * Default budget configuration
 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  version: 1,
  wastedRenderThreshold: 0.1,
  memoHitRateThreshold: 0.8,
  maxRenderTimeMs: 16,
  maxRSCPayloadSize: 100_000, // 100KB
  minPerformanceScore: 70,
  maxSlowRenderPercentage: 0.1,
  budgets: [],
  failOnWarning: false,
  outputFormat: 'human',
};

/**
 * Default individual budget thresholds
 */
export const DEFAULT_BUDGETS: PerformanceBudget[] = [
  {
    id: 'wasted-render-rate',
    name: 'Wasted Render Rate',
    description: 'Maximum percentage of renders that should be wasted',
    threshold: 0.1,
    severity: 'error',
    enabled: true,
    errorMessage: 'Wasted render rate exceeds 10% threshold',
  },
  {
    id: 'memo-hit-rate',
    name: 'Memo Hit Rate',
    description: 'Minimum memoization hit rate for memoized components',
    threshold: 0.8,
    severity: 'warning',
    enabled: true,
    errorMessage: 'Memo hit rate below 80% threshold',
  },
  {
    id: 'max-render-time',
    name: 'Maximum Render Time',
    description: 'Maximum average render time per component',
    threshold: 16,
    severity: 'error',
    enabled: true,
    errorMessage: 'Average render time exceeds 16ms threshold (60fps budget)',
  },
  {
    id: 'rsc-payload-size',
    name: 'RSC Payload Size',
    description: 'Maximum RSC payload size in bytes',
    threshold: 100_000,
    severity: 'warning',
    enabled: true,
    errorMessage: 'RSC payload size exceeds 100KB threshold',
  },
  {
    id: 'performance-score',
    name: 'Overall Performance Score',
    description: 'Minimum overall performance score (0-100)',
    threshold: 70,
    severity: 'error',
    enabled: true,
    errorMessage: 'Overall performance score below 70',
  },
  {
    id: 'slow-render-percentage',
    name: 'Slow Render Percentage',
    description: 'Maximum percentage of slow renders (>16ms)',
    threshold: 0.1,
    severity: 'warning',
    enabled: true,
    errorMessage: 'More than 10% of renders exceed 16ms',
  },
];

/**
 * Type guard for BudgetSeverity
 */
export function isBudgetSeverity(value: unknown): value is BudgetSeverity {
  return value === 'error' || value === 'warning' || value === 'info';
}

/**
 * Type guard for BudgetConfig
 */
export function isBudgetConfig(value: unknown): value is BudgetConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Record<string, unknown>;
  return (
    typeof config.version === 'number' &&
    typeof config.wastedRenderThreshold === 'number' &&
    typeof config.memoHitRateThreshold === 'number' &&
    typeof config.maxRenderTimeMs === 'number' &&
    typeof config.maxRSCPayloadSize === 'number' &&
    typeof config.minPerformanceScore === 'number' &&
    typeof config.maxSlowRenderPercentage === 'number' &&
    Array.isArray(config.budgets)
  );
}

/**
 * Type guard for ProfileData
 */
export function isProfileData(value: unknown): value is ProfileData {
  if (typeof value !== 'object' || value === null) return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.version === 'number' &&
    typeof profile.recordingDuration === 'number' &&
    Array.isArray(profile.commits)
  );
}

/**
 * Load budget configuration from a JSON object
 */
export function loadBudgetConfig(config: Partial<BudgetConfig>): BudgetConfig {
  return {
    ...DEFAULT_BUDGET_CONFIG,
    ...config,
    budgets: config.budgets?.length
      ? config.budgets.map((b, i) => ({
          ...DEFAULT_BUDGETS[i],
          ...b,
        }))
      : DEFAULT_BUDGETS,
  };
}
