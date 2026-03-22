/**
 * Performance Budgets Module
 * @module shared/performance-budgets
 *
 * Provides performance budget checking for CI/CD integration.
 * Use this module to enforce performance standards automatically.
 *
 * @example
 * ```typescript
 * import { checkPerformanceBudget, loadBudgetConfig } from '@/shared/performance-budgets';
 *
 * const config = loadBudgetConfig({
 *   wastedRenderThreshold: 0.1,
 *   maxRenderTimeMs: 16
 * });
 *
 * const result = checkPerformanceBudget(profile, config);
 *
 * if (!result.passed) {
 *   console.error('Budget violations:', result.violations);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Check bundle sizes
 * import { checkBundleSizes, generateBudgetReport } from '@/shared/performance-budgets';
 *
 * const bundleResult = checkBundleSizes('./dist-chrome', 'chrome');
 * const coverageResult = checkCoverage('./coverage');
 *
 * const report = generateBudgetReport(profileResult, [bundleResult], coverageResult);
 * console.log(report);
 * ```
 */

// Re-export all types
export type {
  BudgetCheckOptions,
  BudgetCheckResult,
  BudgetConfig,
  BudgetSeverity,
  BudgetSummary,
  BudgetViolation,
  BundleBudget,
  BundleBudgets,
  BundleCheckResult,
  CoverageCheckResult,
  CoverageThresholds,
  PerformanceBudget,
  ProfileData,
  ProfileMetadata,
} from './types';

// Re-export constants and functions
export {
  DEFAULT_BUDGET_CONFIG,
  DEFAULT_BUDGETS,
  DEFAULT_BUNDLE_BUDGETS,
  DEFAULT_COVERAGE_THRESHOLDS,
  isBudgetConfig,
  isBudgetSeverity,
  isBundleBudget,
  isCoverageThresholds,
  isProfileData,
  loadBudgetConfig,
} from './types';

// Re-export budget checker functions
export {
  checkBundleSizes,
  checkCoverage,
  checkPerformanceBudget,
  formatCheckResultHuman,
  formatCheckResultJson,
  generateBudgetReport,
} from './budgetChecker';
