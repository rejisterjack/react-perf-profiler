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
 */

// Re-export all types
export type {
  BudgetCheckOptions,
  BudgetCheckResult,
  BudgetConfig,
  BudgetSeverity,
  BudgetSummary,
  BudgetViolation,
  PerformanceBudget,
  ProfileData,
  ProfileMetadata,
} from './types';

// Re-export constants and functions
export {
  DEFAULT_BUDGET_CONFIG,
  DEFAULT_BUDGETS,
  isBudgetConfig,
  isBudgetSeverity,
  isProfileData,
  loadBudgetConfig,
} from './types';

// Re-export budget checker functions
export {
  checkPerformanceBudget,
  formatCheckResultHuman,
  formatCheckResultJson,
} from './budgetChecker';
