/**
 * Tests for performance budget checker
 * Validates bundle size checking, test coverage, and performance budget violations
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  checkPerformanceBudget,
  checkBundleSizes,
  checkCoverage,
  generateBudgetReport,
  formatCheckResultHuman,
  formatCheckResultJson,
} from '@/shared/performance-budgets/budgetChecker';
import type {
  BudgetConfig,
  ProfileData,
} from '@/shared/performance-budgets/types';
import { DEFAULT_BUDGET_CONFIG, DEFAULT_BUNDLE_BUDGETS, DEFAULT_COVERAGE_THRESHOLDS } from '@/shared/performance-budgets/types';

describe('Budget Checker', () => {
  describe('golden CI fixture', () => {
    it('passes default budgets with failOnWarning', () => {
      const dir = path.dirname(fileURLToPath(import.meta.url));
      const fixturePath = path.join(dir, '../../fixtures/perf-profile-passing.json');
      const raw = readFileSync(fixturePath, 'utf-8');
      const profile = JSON.parse(raw) as ProfileData;
      const result = checkPerformanceBudget(profile, {
        ...DEFAULT_BUDGET_CONFIG,
        failOnWarning: true,
      });
      expect(result.passed).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });
  });

  describe('checkPerformanceBudget', () => {
    const mockProfile: ProfileData = {
      version: 1,
      recordingDuration: 1000,
      commits: [
        {
          id: 'commit-1',
          timestamp: Date.now(),
          fibers: [
            {
              id: 1,
              displayName: 'App',
              actualDuration: 5,
              baseDuration: 5,
              isMemoized: false,
            },
          ],
          nodes: [],
        },
      ],
    };

    it('should pass when profile is within budget', () => {
      const config: BudgetConfig = {
        ...DEFAULT_BUDGET_CONFIG,
        maxWastedRenderPercentage: 50,
        minMemoizationHitRate: 0,
        maxAverageRenderTimeMs: 100,
      };

      const result = checkPerformanceBudget(mockProfile, config);

      expect(result.passed).toBe(true);
      expect(result.totalViolations).toBe(0);
    });

    it('should use default config when none provided', () => {
      const result = checkPerformanceBudget(mockProfile);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.violations).toBeDefined();
    });

    it('should extract correct metadata from profile', () => {
      const result = checkPerformanceBudget(mockProfile, DEFAULT_BUDGET_CONFIG);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.componentCount).toBeGreaterThanOrEqual(0);
      expect(result.metadata.commitCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty commits array', () => {
      const emptyProfile: ProfileData = {
        version: 1,
        recordingDuration: 0,
        commits: [],
      };

      const result = checkPerformanceBudget(emptyProfile, DEFAULT_BUDGET_CONFIG);

      expect(result.passed).toBe(true);
    });
  });

  describe('checkBundleSizes', () => {
    it('should return failure when bundle directory does not exist', () => {
      const result = checkBundleSizes('/nonexistent/path', 'chrome', DEFAULT_BUNDLE_BUDGETS);

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].budgetId).toBe('bundle-missing');
    });

    it('should check Chrome bundle sizes', () => {
      const result = checkBundleSizes('dist-chrome', 'chrome', DEFAULT_BUNDLE_BUDGETS);

      expect(result.target).toBe('chrome');
      expect(typeof result.totalSize).toBe('number');
      expect(typeof result.totalBudget).toBe('number');
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it('should check Firefox bundle sizes', () => {
      const result = checkBundleSizes('dist-firefox', 'firefox', DEFAULT_BUNDLE_BUDGETS);

      expect(result.target).toBe('firefox');
      expect(typeof result.totalSize).toBe('number');
      expect(typeof result.totalBudget).toBe('number');
    });

    it('should use default budgets when not provided', () => {
      const result = checkBundleSizes('dist-chrome', 'chrome');

      expect(result.totalBudget).toBe(DEFAULT_BUNDLE_BUDGETS.chrome.total);
    });
  });

  describe('checkCoverage', () => {
    it('should check test coverage against thresholds', () => {
      const result = checkCoverage('/nonexistent/coverage', DEFAULT_COVERAGE_THRESHOLDS);

      expect(result).toBeDefined();
      expect(typeof result.lines).toBe('number');
      expect(typeof result.functions).toBe('number');
      expect(typeof result.branches).toBe('number');
      expect(typeof result.statements).toBe('number');
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it('should use default thresholds when not provided', () => {
      const result = checkCoverage('/nonexistent/coverage');

      // When coverage file doesn't exist, values default to 0
      expect(typeof result.lines).toBe('number');
      expect(typeof result.functions).toBe('number');
    });
  });

  describe('generateBudgetReport', () => {
    it('should generate a human-readable report', () => {
      const profile: ProfileData = {
        version: 1,
        recordingDuration: 0,
        commits: [],
      };

      const budgetResult = checkPerformanceBudget(profile, DEFAULT_BUDGET_CONFIG);
      const bundleResults = [
        checkBundleSizes('dist-chrome', 'chrome', DEFAULT_BUNDLE_BUDGETS),
        checkBundleSizes('dist-firefox', 'firefox', DEFAULT_BUNDLE_BUDGETS),
      ];
      const coverageResult = checkCoverage('/nonexistent/coverage', DEFAULT_COVERAGE_THRESHOLDS);

      const report = generateBudgetReport(budgetResult, bundleResults, coverageResult);

      expect(typeof report).toBe('string');
      expect(report).toContain('📊 Performance Report');
    });
  });

  describe('formatCheckResultHuman', () => {
    it('should format check result as human-readable text', () => {
      const profile: ProfileData = {
        version: 1,
        recordingDuration: 0,
        commits: [],
      };

      const result = checkPerformanceBudget(profile, DEFAULT_BUDGET_CONFIG);
      const formatted = formatCheckResultHuman(result);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('Performance Budget Check');
    });
  });

  describe('formatCheckResultJson', () => {
    it('should format check result as JSON', () => {
      const profile: ProfileData = {
        version: 1,
        recordingDuration: 0,
        commits: [],
      };

      const result = checkPerformanceBudget(profile, DEFAULT_BUDGET_CONFIG);
      const formatted = formatCheckResultJson(result);

      expect(typeof formatted).toBe('string');
      
      // Should be valid JSON
      const parsed = JSON.parse(formatted);
      expect(parsed.summary).toBeDefined();
      expect(parsed.violations).toBeDefined();
    });
  });
});
