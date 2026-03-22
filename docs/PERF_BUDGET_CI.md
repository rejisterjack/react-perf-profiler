# CI Performance Budget Implementation

This document describes the CI performance budget system implemented for React Perf Profiler.

## Overview

The CI performance budget system provides automated performance checks that run on every PR and push to main. It ensures that:

1. Bundle sizes stay within budget
2. Test coverage meets thresholds
3. Performance budgets are not exceeded
4. Results are posted as PR comments

## Files Created/Modified

### Configuration

- **`perf-budget.json`** - Enhanced with bundle budgets and coverage thresholds
- **`src/shared/performance-budgets/schema.json`** - JSON Schema for configuration validation

### Core Implementation

- **`src/shared/performance-budgets/types.ts`** - Type definitions for:
  - `BundleBudget` and `BundleBudgets` - Bundle size budgets per browser
  - `CoverageThresholds` - Test coverage thresholds
  - `BundleCheckResult` - Bundle check results
  - `CoverageCheckResult` - Coverage check results
  - Type guards for validation

- **`src/shared/performance-budgets/budgetChecker.ts`** - Enhanced with:
  - `checkBundleSizes()` - Check bundle sizes against budgets
  - `checkCoverage()` - Check test coverage against thresholds
  - `generateBudgetReport()` - Generate PR comment format report
  - Support for Chrome and Firefox bundle checks

- **`src/shared/performance-budgets/index.ts`** - Updated exports

### CLI Tool

- **`src/cli/perf-check.ts`** - Enhanced CLI with:
  - `--check-bundles` - Check bundle sizes
  - `--bundle-target` - Target browser (chrome/firefox/both)
  - `--check-coverage` - Check test coverage
  - `--pr-comment` - Generate PR comment format
  - Exit codes: 0 (success), 1 (violations), 2 (error)

### GitHub Actions

- **`.github/workflows/perf-check.yml`** - Complete CI workflow:
  - Builds Chrome and Firefox extensions
  - Analyzes bundle sizes
  - Runs tests with coverage
  - Checks performance budgets
  - Posts PR comments
  - Fails CI if budgets exceeded

### Package Scripts

Added to `package.json`:
- `perf:check` - Run CLI
- `perf:check:bundles` - Check bundle sizes
- `perf:check:coverage` - Check coverage
- `perf:check:all` - Check everything

### Documentation

- **`README.md`** - Added CI Performance Budgets section
- **`docs/PERF_BUDGET_CI.md`** - This file

## PR Comment Format

```markdown
## 📊 Performance Report: ✅ PASSED

### Bundle Sizes
| Chunk | Size | Budget | Status |
|-------|------|--------|--------|
| Panel | 245KB | 500KB | ✅ Pass |
| Background | 45KB | 100KB | ✅ Pass |
| **Total** | **890KB** | **1000KB** | ✅ Pass |

### Test Coverage
| Metric | Actual | Threshold | Status |
|--------|--------|-----------|--------|
| Lines | 75% | 70% | ✅ Pass |
| Functions | 72% | 70% | ✅ Pass |
| Branches | 65% | 60% | ✅ Pass |
| Statements | 73% | 70% | ✅ Pass |

### Performance Budgets
| Check | Result |
|-------|--------|
| Overall Status | ✅ Passed |
| Performance Score | 85/100 |
| Violations | 0 |
| Errors | 0 |
| Warnings | 0 |
```

## Usage

### Local Development

```bash
# Check everything
pnpm perf:check:all

# Check specific areas
pnpm perf:check:bundles
pnpm perf:check:coverage

# Direct CLI usage
pnpm exec tsx src/cli/perf-check.ts --check-bundles --check-coverage profile.json
```

### Programmatic API

```typescript
import {
  checkPerformanceBudget,
  checkBundleSizes,
  checkCoverage,
  generateBudgetReport,
} from '@/shared/performance-budgets';

// Check performance profile
const profileResult = checkPerformanceBudget(profileData, config);

// Check bundle sizes
const bundleResult = checkBundleSizes('./dist-chrome', 'chrome');

// Check test coverage
const coverageResult = checkCoverage('./coverage');

// Generate report
const report = generateBudgetReport(profileResult, [bundleResult], coverageResult);
```

## Bundle Budgets

Default budgets (in bytes):

| Chunk | Chrome | Firefox |
|-------|--------|---------|
| Total | 1MB | 1MB |
| Panel | 500KB | 500KB |
| Background | 100KB | 100KB |
| Content | 150KB | 150KB |
| Devtools | 50KB | 50KB |
| Popup | 100KB | 100KB |
| Vendor | 300KB | 300KB |

## Coverage Thresholds

Default thresholds:

| Metric | Threshold |
|--------|-----------|
| Lines | 70% |
| Functions | 70% |
| Branches | 60% |
| Statements | 70% |

## Performance Budgets

Default thresholds:

| Budget | Threshold | Severity |
|--------|-----------|----------|
| Wasted Render Rate | 10% | Error |
| Memo Hit Rate | 80% | Warning |
| Max Render Time | 16ms | Error |
| RSC Payload Size | 100KB | Warning |
| Performance Score | 70/100 | Error |
| Slow Render % | 10% | Warning |

## CI Integration

The workflow runs on:
- Pull requests to `main` and `develop`
- Pushes to `main`
- Manual dispatch via GitHub UI

Required permissions:
- `pull-requests: write` - To post PR comments
- `contents: read` - To checkout code
- `checks: write` - To update check status
