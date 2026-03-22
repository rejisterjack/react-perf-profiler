# Performance Budgets Guide

A complete guide to configuring and using performance budgets with React Perf Profiler.

## Table of Contents

- [What Are Performance Budgets?](#what-are-performance-budgets)
- [Getting Started](#getting-started)
- [Configuring perf-budget.json](#configuring-perf-budgetjson)
- [CI Integration](#ci-integration)
- [Interpreting Results](#interpreting-results)
- [Troubleshooting Budget Violations](#troubleshooting-budget-violations)
- [Best Practices](#best-practices)

---

## What Are Performance Budgets?

Performance budgets are thresholds that enforce performance standards. They help teams:

- **Prevent regressions** - Catch performance issues before they reach production
- **Set targets** - Define clear performance goals for the team
- **Automate enforcement** - Check budgets automatically in CI/CD
- **Track trends** - Monitor performance over time

### Budget Types

React Perf Profiler supports four categories of budgets:

| Category | Description | Use Case |
|----------|-------------|----------|
| **Render Performance** | Wasted renders, render times, memo hit rates | Component-level optimization |
| **RSC Metrics** | Payload sizes, cache hit rates | Server Components optimization |
| **Bundle Size** | JavaScript chunk sizes | Delivery performance |
| **Test Coverage** | Lines, functions, branches | Code quality |

### Severity Levels

Each budget can have one of three severity levels:

- **Error** - Fails the CI build
- **Warning** - Reports but doesn't fail (unless `failOnWarning: true`)
- **Info** - For informational purposes only

---

## Getting Started

### 1. Create a Budget Configuration

Create a `perf-budget.json` file in your project root:

```bash
# Copy the example configuration
cp node_modules/react-perf-profiler/perf-budget.json.example ./perf-budget.json

# Or create from scratch
echo '{}' > perf-budget.json
```

### 2. Install CLI Tool (Optional)

```bash
# Install globally
npm install -g react-perf-profiler

# Or use with npx
npx react-perf-profiler perf:check profile.json
```

### 3. Run Your First Check

```bash
# Check a recorded profile
npx react-perf-profiler perf:check ./my-profile.json

# Check with specific config
npx react-perf-profiler perf:check --config ./my-budget.json ./my-profile.json
```

---

## Configuring perf-budget.json

### Complete Configuration Example

```json
{
  "$schema": "./node_modules/react-perf-profiler/src/shared/performance-budgets/schema.json",
  "version": 1,
  "projectName": "My React App",
  
  "wastedRenderThreshold": 0.1,
  "memoHitRateThreshold": 0.8,
  "maxRenderTimeMs": 16,
  "maxRSCPayloadSize": 100000,
  "minPerformanceScore": 70,
  "maxSlowRenderPercentage": 0.1,
  
  "failOnWarning": false,
  "outputFormat": "human",
  
  "bundleBudgets": {
    "chrome": {
      "total": 1000000,
      "chunks": {
        "panel": 512000,
        "background": 102400,
        "content": 153600,
        "devtools": 51200,
        "popup": 102400,
        "vendor": 307200
      }
    },
    "firefox": {
      "total": 1000000,
      "chunks": {
        "panel": 512000,
        "background": 102400,
        "content": 153600,
        "devtools": 51200,
        "popup": 102400,
        "vendor": 307200
      }
    }
  },
  
  "coverageThresholds": {
    "lines": 70,
    "functions": 70,
    "branches": 60,
    "statements": 70
  },
  
  "budgets": [
    {
      "id": "custom-render-budget",
      "name": "Custom Render Budget",
      "description": "Maximum renders for specific component",
      "threshold": 50,
      "severity": "warning",
      "enabled": true
    }
  ]
}
```

### Configuration Reference

#### Core Performance Thresholds

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wastedRenderThreshold` | number | 0.1 | Max % of renders that should be wasted (0-1) |
| `memoHitRateThreshold` | number | 0.8 | Min memoization hit rate (0-1) |
| `maxRenderTimeMs` | number | 16 | Max average render time in ms (16ms = 60fps) |
| `maxRSCPayloadSize` | number | 100000 | Max RSC payload size in bytes |
| `minPerformanceScore` | number | 70 | Min overall performance score (0-100) |
| `maxSlowRenderPercentage` | number | 0.1 | Max % of renders exceeding 16ms |

#### Output Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `failOnWarning` | boolean | false | Treat warnings as errors |
| `outputFormat` | string | "human" | Output format: "human", "json", "markdown" |

#### Bundle Budgets

```json
{
  "bundleBudgets": {
    "chrome": {
      "total": 1000000,
      "chunks": {
        "panel": 512000,
        "background": 102400,
        "content": 153600,
        "devtools": 51200,
        "popup": 102400,
        "vendor": 307200
      }
    }
  }
}
```

**Chunk Names:**
- `panel` - Main DevTools panel code
- `background` - Service worker
- `content` - Content script
- `devtools` - DevTools page
- `popup` - Extension popup
- `vendor` - Shared dependencies

#### Coverage Thresholds

```json
{
  "coverageThresholds": {
    "lines": 70,
    "functions": 70,
    "branches": 60,
    "statements": 70
  }
}
```

#### Custom Budgets

Define additional budgets for specific metrics:

```json
{
  "budgets": [
    {
      "id": "custom-metric-id",
      "name": "Budget Name",
      "description": "What this budget measures",
      "threshold": 100,
      "severity": "error",
      "enabled": true,
      "errorMessage": "Custom error message"
    }
  ]
}
```

### Configuration per Environment

Use different configs for different environments:

```json
// perf-budget.development.json
{
  "wastedRenderThreshold": 0.2,
  "failOnWarning": false
}
```

```json
// perf-budget.production.json
{
  "wastedRenderThreshold": 0.05,
  "failOnWarning": true,
  "minPerformanceScore": 85
}
```

Select config via CLI:

```bash
npx react-perf-profiler perf:check \
  --config ./perf-budget.production.json \
  ./profile.json
```

---

## CI Integration

### GitHub Actions

React Perf Profiler includes a ready-to-use workflow. Add to `.github/workflows/perf-check.yml`:

```yaml
name: Performance Check

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Build extensions
        run: pnpm run build:all
        
      - name: Check bundle sizes
        run: pnpm run perf:check:bundles
        
      - name: Run tests with coverage
        run: pnpm run test:coverage
        
      - name: Check performance budgets
        run: pnpm run perf:check:all
        
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('./perf-report.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
```

### GitLab CI

```yaml
performance-check:
  stage: test
  script:
    - pnpm install
    - pnpm run build:all
    - pnpm run perf:check:all -- --pr-comment
  artifacts:
    reports:
      junit: test-results.xml
    paths:
      - perf-report.html
  only:
    - merge_requests
    - main
```

### Jenkins

```groovy
pipeline {
    agent any
    
    stages {
        stage('Performance Check') {
            steps {
                sh 'pnpm install'
                sh 'pnpm run build:all'
                sh 'pnpm run perf:check:all'
            }
        }
    }
    
    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: '.',
                reportFiles: 'perf-report.html',
                reportName: 'Performance Report'
            ])
        }
    }
}
```

### CircleCI

```yaml
version: 2.1

jobs:
  performance:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: pnpm install
      - run:
          name: Build
          command: pnpm run build:all
      - run:
          name: Performance checks
          command: pnpm run perf:check:all
      - store_artifacts:
          path: perf-report.html

workflows:
  performance:
    jobs:
      - performance
```

### Azure DevOps

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
    displayName: 'Install Node.js'

  - script: |
      pnpm install
      pnpm run build:all
      pnpm run perf:check:all
    displayName: 'Performance checks'

  - task: PublishTestResults@2
    inputs:
      testResultsFormat: 'JUnit'
      testResultsFiles: '**/test-results.xml'
    condition: succeededOrFailed()
```

---

## Interpreting Results

### CLI Output

```bash
$ pnpm perf:check:all

╔══════════════════════════════════════════════════════════╗
║     React Perf Profiler - Budget Check Report           ║
╚══════════════════════════════════════════════════════════╝

📊 Profile: ./test-profile.json
🕐 Generated: 2024-03-22T10:30:00.000Z

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Overall Status: ❌ FAILED

| Metric | Value |
|--------|-------|
| Total Violations | 3 |
| Errors | 2 |
| Warnings | 1 |
| Info | 0 |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Bundle Sizes (Chrome)

| Chunk | Size | Budget | Status |
|-------|------|--------|--------|
| panel | 485 KB | 500 KB | ✅ Pass |
| background | 89 KB | 100 KB | ✅ Pass |
| content | 145 KB | 150 KB | ✅ Pass |
| **Total** | **890 KB** | **1000 KB** | ✅ Pass |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Performance Budgets

❌ **Wasted Render Rate**
   Actual: 15.3% | Threshold: 10%
   45 of 294 renders were wasted
   
   🔧 Recommendation:
   • Wrap UserCard with React.memo
   • Add useCallback for onClick handlers in PostList
   • Move inline style objects to CSS modules

⚠️ **Memo Hit Rate**
   Actual: 73% | Threshold: 80%
   Components with poor memoization:
   - Button (45% hit rate)
   - Avatar (62% hit rate)

❌ **Maximum Render Time**
   Actual: 23.5ms | Threshold: 16ms
   Slow components:
   - DataTable: 45ms average
   - ChartContainer: 32ms average

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Test Coverage

| Metric | Actual | Threshold | Status |
|--------|--------|-----------|--------|
| Lines | 72% | 70% | ✅ Pass |
| Functions | 68% | 70% | ⚠️ Warning |
| Branches | 58% | 60% | ❌ Fail |
| Statements | 71% | 70% | ✅ Pass |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Exit Code: 1 (budget violations detected)
```

### JSON Output

```bash
pnpm perf:check --format json --output report.json ./profile.json
```

```json
{
  "passed": false,
  "totalViolations": 3,
  "errorCount": 2,
  "warningCount": 1,
  "infoCount": 0,
  "violations": [
    {
      "id": "v1",
      "budgetId": "wasted-render-rate",
      "budgetName": "Wasted Render Rate",
      "severity": "error",
      "actualValue": 0.153,
      "threshold": 0.1,
      "difference": 0.053,
      "percentageOver": 53,
      "message": "Wasted render rate exceeds 10% threshold",
      "recommendation": "Wrap UserCard with React.memo"
    }
  ],
  "summary": {
    "totalComponents": 45,
    "totalCommits": 12,
    "averageWastedRenderRate": 0.153,
    "averageMemoHitRate": 0.73,
    "averageRenderTime": 23.5,
    "performanceScore": 62,
    "budgetsPassedPercentage": 67
  },
  "bundleResults": [...],
  "coverageResult": {...}
}
```

### Markdown Output (for PR comments)

```bash
pnpm perf:check --format markdown --output report.md ./profile.json
```

Produces a formatted markdown table suitable for PR comments.

---

## Troubleshooting Budget Violations

### High Wasted Render Rate

**Problem:** More than 10% of renders are unnecessary

**Diagnosis:**
```bash
# Check which components have high wasted render rates
pnpm perf:check --verbose ./profile.json
```

**Solutions:**

1. **Wrap components with React.memo:**
   ```tsx
   const UserCard = React.memo(function UserCard({ user }) {
     return <div>{user.name}</div>;
   });
   ```

2. **Stabilize callback props:**
   ```tsx
   // ❌ Bad: New function every render
   <Button onClick={() => handleClick(id)} />
   
   // ✅ Good: Stable callback
   const handleClick = useCallback((id) => {
     // handle click
   }, []);
   <Button onClick={handleClick} />
   ```

3. **Move inline objects to constants:**
   ```tsx
   // ❌ Bad: New object every render
   <Chart options={{ responsive: true }} />
   
   // ✅ Good: Constant reference
   const CHART_OPTIONS = { responsive: true };
   <Chart options={CHART_OPTIONS} />
   ```

### Low Memo Hit Rate

**Problem:** Memoized components re-render too often

**Common Causes:**
- Unstable prop references
- Context changes
- Parent re-renders

**Solutions:**

1. **Check prop stability:**
   ```tsx
   // Use the profiler's Memo Effectiveness report
   // to identify unstable props
   ```

2. **Split contexts:**
   ```tsx
   // ❌ Bad: Single context with many values
   <AppContext.Provider value={{ user, theme, config }}>
   
   // ✅ Good: Separate contexts
   <UserContext.Provider value={user}>
     <ThemeContext.Provider value={theme}>
   ```

### Slow Render Times

**Problem:** Components take >16ms to render

**Solutions:**

1. **Virtualize long lists:**
   ```tsx
   import { useVirtualizer } from '@tanstack/react-virtual';
   
   const virtualizer = useVirtualizer({
     count: items.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 50,
   });
   ```

2. **Defer non-critical work:**
   ```tsx
   useDeferredValue(slowFilter(data));
   ```

3. **Use React.lazy for code splitting:**
   ```tsx
   const HeavyChart = React.lazy(() => import('./HeavyChart'));
   ```

### Large RSC Payloads

**Problem:** RSC payloads exceed 100KB

**Solutions:**

1. **Move data to server components:**
   ```tsx
   // ❌ Bad: Large data passed to client
   'use client';
   function Page({ hugeData }) { ... }
   
   // ✅ Good: Fetch on server
   async function Page() {
     const data = await fetchData(); // Server-side
     return <ClientComponent summary={data.summary} />;
   }
   ```

2. **Use streaming:**
   ```tsx
   <Suspense fallback={<Loading />}>
     <SlowComponent />
   </Suspense>
   ```

### Bundle Size Violations

**Solutions:**

1. **Analyze bundle:**
   ```bash
   pnpm run analyze
   ```

2. **Code split:**
   ```tsx
   const Panel = React.lazy(() => import('./Panel'));
   ```

3. **Tree shake dependencies:**
   ```typescript
   // ✅ Import specific functions
   import { debounce } from 'lodash-es';
   
   // ❌ Avoid full imports
   import _ from 'lodash';
   ```

---

## Best Practices

### Setting Realistic Budgets

Start with current performance and improve gradually:

```json
{
  // Phase 1: Current baseline
  "wastedRenderThreshold": 0.20,
  
  // Phase 2: After initial optimization
  "wastedRenderThreshold": 0.15,
  
  // Phase 3: Strict target
  "wastedRenderThreshold": 0.10
}
```

### Team Workflow

1. **Define budgets in planning** - Set performance goals for features
2. **Check locally** - Run checks before pushing
3. **Review in CI** - Automated checks on PRs
4. **Monitor trends** - Track performance over time

### Gradual Rollout

```javascript
// .github/workflows/perf-check.yml
steps:
  - name: Performance check (report only)
    run: |
      pnpm run perf:check:all || true
    # Allow failures during adoption phase
    
  - name: Performance check (enforced)
    if: github.base_ref == 'main'
    run: |
      pnpm run perf:check:all
    # Fail on main branch
```

### Documenting Exceptions

```json
{
  "budgets": [
    {
      "id": "data-table-render-time",
      "name": "DataTable Render Time",
      "description": "DataTable has known performance issues tracked in JIRA-1234",
      "threshold": 50,
      "severity": "warning",
      "enabled": true
    }
  ]
}
```

### Monitoring Trends

Store reports for trend analysis:

```bash
#!/bin/bash
# perf-trend.sh

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
pnpm perf:check:all --format json > "reports/perf-${TIMESTAMP}.json"

# Compare with baseline
node scripts/compare-perf.js reports/perf-baseline.json "reports/perf-${TIMESTAMP}.json"
```

---

## Advanced Topics

### Programmatic Usage

```typescript
import { 
  checkPerformanceBudget, 
  checkBundleSizes,
  checkCoverage,
  generateBudgetReport 
} from 'react-perf-profiler/performance-budgets';

// Check performance profile
const profileResult = checkPerformanceBudget(profileData, config);

// Check bundle sizes
const bundleResult = checkBundleSizes('./dist-chrome', 'chrome');

// Check test coverage
const coverageResult = checkCoverage('./coverage');

// Generate combined report
const report = generateBudgetReport(
  profileResult,
  [bundleResult],
  coverageResult
);

// Custom actions based on results
if (!profileResult.passed) {
  await notifyTeam(profileResult.violations);
  await createJiraTickets(profileResult.violations);
}
```

### Custom Budget Checkers

```typescript
import type { PerformanceBudget, BudgetViolation } from 'react-perf-profiler';

const customBudget: PerformanceBudget = {
  id: 'custom-api-calls',
  name: 'API Calls During Render',
  description: 'Maximum API calls made during component render',
  threshold: 0,
  severity: 'error',
  enabled: true,
};

// In your plugin
hooks: {
  onAnalysisComplete: (result, api, context) => {
    const apiCalls = api.getPluginData('apiCalls') || [];
    const violations: BudgetViolation[] = [];
    
    if (apiCalls.length > customBudget.threshold) {
      violations.push({
        id: 'custom-violation-1',
        budgetId: customBudget.id,
        budgetName: customBudget.name,
        severity: customBudget.severity,
        actualValue: apiCalls.length,
        threshold: customBudget.threshold,
        difference: apiCalls.length,
        percentageOver: 100,
        message: `${apiCalls.length} API calls detected during render`,
        recommendation: 'Move API calls to useEffect or event handlers',
        timestamp: Date.now(),
      });
    }
    
    // Add to result
    return { customViolations: violations };
  },
}
```

---

## Support

- [GitHub Issues](https://github.com/rejisterjack/react-perf-profiler/issues)
- [Performance Budget Schema](../src/shared/performance-budgets/schema.json)
- [Type Definitions](../src/shared/performance-budgets/types.ts)
