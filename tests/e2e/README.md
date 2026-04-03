# React Perf Profiler - E2E Tests

This directory contains comprehensive End-to-End (E2E) tests for the React Perf Profiler Chrome DevTools extension using Playwright.

## Test Structure

```
tests/e2e/
├── pom/
│   └── ProfilerPanel.ts          # Page Object Model for the profiler panel
├── fixtures/
│   └── test-app.html             # React test application for profiling
├── coreFlows.spec.ts             # Main profiling flow tests
├── analysisFlow.spec.ts          # Analysis features tests
├── exportImport.spec.ts          # Data persistence tests
├── keyboardNavigation.spec.ts    # Keyboard shortcuts tests
├── profiling.spec.ts             # Supplementary integration tests (see file comment)
├── global-setup.ts               # Global test setup
├── global-teardown.ts            # Global test teardown
└── README.md                     # This file
```

## Test Files Overview

### 1. coreFlows.spec.ts
Tests the main profiling workflow:
- Extension loading and React detection
- Starting/stopping profiling sessions
- Capturing React render commits
- Displaying component tree
- Detecting wasted renders
- Stats display (commits, duration, performance score)
- Clear data functionality
- Error handling

### 2. analysisFlow.spec.ts
Tests analysis features:
- Recording and viewing analysis
- Wasted render reports
- Memo effectiveness reports
- Component selection and details
- Optimization recommendations
- Severity indicators
- View mode switching (tree, flamegraph, timeline, analysis)
- Performance metrics

### 3. exportImport.spec.ts
Tests data persistence:
- Export to JSON functionality
- Import from JSON functionality
- Import dialog interactions
- Data validation
- Full export-import roundtrip
- Large file handling
- Error handling for invalid files
- Clear data functionality

### 4. keyboardNavigation.spec.ts
Tests keyboard accessibility:
- Tree navigation (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
- Home/End keys for first/last item
- Enter key for opening component details
- Escape key for closing panels/dialogs
- Recording shortcuts (Ctrl+R)
- Export shortcut (Ctrl+S)
- Import shortcut (Ctrl+O)
- Clear shortcut (Ctrl+Delete)
- View mode switching with number keys
- Focus management

## Page Object Model

The `ProfilerPanel.ts` provides an abstraction layer for interacting with the profiler UI:

### Key Methods

**Navigation & Setup:**
- `navigateToPanel()` - Navigate to the panel HTML for testing
- `waitForPanelLoad()` - Wait for panel to be fully loaded
- `openDevToolsPanel()` - Open Chrome DevTools (for extension testing)

**Recording Controls:**
- `startProfiling()` - Start a profiling session
- `stopProfiling()` - Stop the current session
- `clearData()` - Clear all profiling data
- `isRecording()` - Check if currently recording

**Component Tree:**
- `getComponentTree()` - Get the tree view element
- `getComponentNodes()` - Get all component nodes
- `selectComponent(name)` - Select a component by name
- `expandNode(name)` / `collapseNode(name)` - Toggle node expansion
- `getComponentCount()` - Get number of components

**View Modes:**
- `switchViewMode(mode)` - Switch between tree/flamegraph/timeline/analysis
- `getCurrentViewMode()` - Get current view mode

**Analysis:**
- `runAnalysis()` - Run performance analysis
- `getWastedRenderReport()` - Get wasted render report
- `getMemoEffectivenessReport()` - Get memo effectiveness report
- `getRecommendations()` - Get optimization recommendations

**Export/Import:**
- `exportData(path)` - Export profiling data to JSON
- `importData(path)` - Import profiling data from JSON
- `saveSampleProfileData(path)` - Create sample data for testing

**Keyboard Navigation:**
- `navigateTreeWithArrows(direction)` - Navigate tree with arrow keys
- `openSelectedComponentDetails()` - Press Enter to open details
- `pressEscape()` - Press Escape key
- `pressShortcut(key, modifier)` - Press keyboard shortcuts

**Stats:**
- `getCommitCount()` - Get number of commits
- `getPerformanceScore()` - Get performance score
- `getRecordingDuration()` - Get recording duration

## Test Fixtures

### test-app.html
A comprehensive React test application that includes:
- Unmemoized child components (causes wasted renders)
- Memoized child components (optimized)
- Components with inline functions (bad practice)
- Heavy computation components
- Todo list with CRUD operations
- Context usage
- Statistics tracking

## Running Tests

### Run all E2E tests:
```bash
pnpm run test:e2e
```

### Run with UI mode (for debugging):
```bash
pnpm run test:e2e:ui
```

### Run specific test file:
```bash
npx playwright test tests/e2e/coreFlows.spec.ts
```

### Run tests in headed mode (see browser):
```bash
npx playwright test --headed
```

### Run tests with specific project (browser):
```bash
npx playwright test --project=chromium
```

### Debug a specific test:
```bash
npx playwright test tests/e2e/coreFlows.spec.ts --debug
```

## Configuration

Tests use the existing `playwright.config.ts` at the project root:
- Test directory: `./tests/e2e`
- Base URL: `http://localhost:5173`
- Browsers: Chromium, Firefox, WebKit
- Mobile viewports: Pixel 5, iPhone 12
- Screenshots on failure
- Video recording on first retry

## CI/CD Integration

Tests are designed to run in CI environments:
- Retry failed tests (2 retries in CI)
- Single worker in CI for stability
- Screenshots and videos for debugging
- HTML and list reporters

## Writing New Tests

When adding new tests:

1. **Use the Page Object Model:**
```typescript
const panel = new ProfilerPanel(page, context);
await panel.navigateToPanel();
await panel.startProfiling();
```

2. **Import sample data for consistent tests:**
```typescript
const sampleDataPath = path.join(testResultsDir, 'my-test-data.json');
await panel.saveSampleProfileData(sampleDataPath);
await panel.importData(sampleDataPath);
```

3. **Use proper assertions:**
```typescript
await expect(page.locator('[class*="treeView"]')).toBeVisible();
expect(await panel.getCommitCount()).toBeGreaterThan(0);
```

4. **Handle async operations:**
```typescript
await page.waitForTimeout(300); // For UI transitions
await panel.waitForPanelLoad(); // For panel initialization
```

## Troubleshooting

### Tests failing with "Extension not found"
Make sure to build the extension first:
```bash
pnpm run build
```

### Tests timing out
Increase timeout in `playwright.config.ts` or use:
```typescript
test.setTimeout(120000);
```

### Screenshots not showing expected state
Add explicit waits:
```typescript
await page.waitForSelector('[class*="expected-element"]');
await page.waitForTimeout(500);
```

### File system operations failing
Ensure test-results directory exists:
```typescript
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
}
```

## Best Practices

1. **Use beforeEach/afterEach** for setup and cleanup
2. **Close contexts** after tests to free resources
3. **Use descriptive test names** that explain the behavior being tested
4. **Group related tests** using `test.describe`
5. **Skip tests** that require unavailable features with `test.skip`
6. **Take screenshots** for debugging complex flows
7. **Use the POM methods** instead of direct selectors when possible
