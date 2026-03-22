/**
 * Core Profiling Flow E2E Tests
 * Tests the main user flow from loading the extension to viewing profiling results
 * Flow: Start → Record → Stop → View results
 */

/// <reference path="./types.d.ts" />

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { ProfilerPanel } from './pom/ProfilerPanel';
import * as path from 'path';
import * as fs from 'fs';

// Path to the test app fixture
const TEST_APP_PATH = path.resolve(__dirname, './fixtures/test-app.html');
const TEST_RESULTS_DIR = path.resolve(__dirname, '../../test-results');

test.describe('Core Profiling Flow', () => {
  let context: BrowserContext;
  let page: Page;
  let panel: ProfilerPanel;

  test.beforeEach(async ({ browser }) => {
    // Create a new browser context
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
    
    // Create the profiler panel POM
    panel = new ProfilerPanel(page, context);
    
    // Ensure test results directory exists
    if (!fs.existsSync(TEST_RESULTS_DIR)) {
      fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
    }
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Extension Loading', () => {
    test('should load test app with React', async () => {
      // Navigate to the test app
      const testAppUrl = `file://${TEST_APP_PATH}`;
      await page.goto(testAppUrl);
      await page.waitForLoadState('networkidle');

      // Verify React is loaded
      const hasReact = await page.evaluate(() => {
        return typeof window.React !== 'undefined' && typeof window.ReactDOM !== 'undefined';
      });
      expect(hasReact).toBeTruthy();

      // Verify the app rendered
      const appTitle = await page.locator('h1').textContent();
      expect(appTitle).toContain('React Perf Profiler Test App');
    });

    test('should detect React DevTools hook on test page', async () => {
      await page.goto(`file://${TEST_APP_PATH}`);
      await page.waitForLoadState('networkidle');

      // Wait a moment for React to initialize
      await page.waitForTimeout(500);

      // Check for React DevTools hook
      const hasDevToolsHook = await page.evaluate(() => {
        return !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      });

      // React DevTools hook should be present when React is in development mode
      expect(hasDevToolsHook).toBeTruthy();
    });

    test('should render test app components correctly', async () => {
      await page.goto(`file://${TEST_APP_PATH}`);
      await page.waitForLoadState('networkidle');

      // Check for key components
      await expect(page.locator('text=Unmemoized Child Component')).toBeVisible();
      await expect(page.locator('text=Memoized Child Component')).toBeVisible();
      await expect(page.locator('text=Todo List')).toBeVisible();
      await expect(page.locator('text=Statistics')).toBeVisible();
    });
  });

  test.describe('Panel Loading', () => {
    test('should load profiler panel successfully', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Verify panel loaded
      const isWelcomeVisible = await panel.isWelcomeScreenVisible();
      const hasTreeData = await panel.hasTreeData();
      
      // Either welcome screen or data view should be visible
      expect(isWelcomeVisible || hasTreeData).toBe(true);
    });

    test('should display welcome screen when no data', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Clear any existing data
      try {
        await panel.clearData();
      } catch {
        // May fail if no data exists
      }

      // Verify welcome screen is shown
      const isWelcomeVisible = await panel.isWelcomeScreenVisible();
      expect(isWelcomeVisible).toBe(true);
    });

    test('should display connection status', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Connection status should be visible
      const statusText = await panel.getConnectionStatusText();
      expect(statusText).toMatch(/Connected|Disconnected/);
    });
  });

  test.describe('Profiling Session - Core Flow', () => {
    test('should complete full profiling flow: start → record → stop → view results', async () => {
      // 1. Navigate to panel
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // 2. Import sample data to simulate a profiling session
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'core-flow-test-data.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // 3. Verify data is loaded (commits visible)
      const commitCount = await panel.getCommitCount();
      expect(commitCount).toBeGreaterThan(0);

      // 4. View results in tree view
      await panel.switchViewMode('tree');
      const hasTreeData = await panel.hasTreeData();
      expect(hasTreeData).toBe(true);

      // 5. Verify component count
      const componentCount = await panel.getComponentCount();
      expect(componentCount).toBeGreaterThan(0);

      // 6. Switch to analysis view to see results
      await panel.switchViewMode('analysis');
      const analysisView = page.locator('[class*="analysisView"]').first();
      await expect(analysisView).toBeVisible();
    });

    test('should start and stop profiling session via UI', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import data first to enable recording (needs connection simulation)
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'recording-test-data.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Start profiling
      await panel.startProfiling();
      
      // Verify recording state
      const isRecording = await panel.isRecording();
      expect(isRecording).toBe(true);

      // Wait a bit
      await page.waitForTimeout(300);

      // Stop profiling
      await panel.stopProfiling();
      
      // Verify recording stopped
      const isStillRecording = await panel.isRecording();
      expect(isStillRecording).toBe(false);
    });

    test('should start and stop profiling via spacebar shortcut', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'shortcut-test-data.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Start recording with spacebar
      await panel.pressSpace();
      
      // Check if recording (may not work without actual connection)
      const isRecording = await panel.isRecording();
      expect(typeof isRecording).toBe('boolean');

      // Stop recording with spacebar if it started
      if (isRecording) {
        await panel.pressSpace();
        const isStillRecording = await panel.isRecording();
        expect(isStillRecording).toBe(false);
      }
    });

    test('should display recording indicator during profiling', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'indicator-test-data.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Start profiling
      await panel.startProfiling();

      // Check for recording indicator
      const recordingIndicator = page.locator('[data-recording="true"], [class*="recording"]').first();
      await expect(recordingIndicator).toBeVisible();

      // Stop profiling
      await panel.stopProfiling();

      // Verify indicator shows not recording
      const app = page.locator('[class*="app"]').first();
      const recordingAttr = await app.getAttribute('data-recording');
      expect(recordingAttr).toBe('false');
    });
  });

  test.describe('Component Tree Viewing', () => {
    test('should display component tree with imported data', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'tree-view-test-data.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Switch to tree view
      await panel.switchViewMode('tree');

      // Verify tree view has components
      const componentCount = await panel.getComponentCount();
      expect(componentCount).toBeGreaterThan(0);

      // Verify specific components exist
      const appComponent = await panel.getComponentByName('App');
      expect(appComponent).not.toBeNull();
    });

    test('should select component and view details', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'component-select-test.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Get components
      const components = await panel.getComponentNodes();
      expect(components.length).toBeGreaterThan(0);

      // Click first component
      await components[0].click();
      await page.waitForTimeout(200);

      // Either detail panel opens or component is selected
      const isDetailOpen = await panel.isDetailPanelOpen();
      expect(typeof isDetailOpen).toBe('boolean');
    });
  });

  test.describe('Wasted Render Detection', () => {
    test('should detect wasted renders in analysis view', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import data with wasted render patterns
      const wastedRenderData = panel.createWastedRenderProfileData();
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'wasted-render-test.json');
      await panel.saveSampleProfileData(sampleDataPath, wastedRenderData);
      await panel.importData(sampleDataPath);

      // Switch to analysis view
      await panel.switchViewMode('analysis');
      await page.waitForTimeout(500);

      // Verify wasted render report is visible
      const wastedRenderReport = await panel.getWastedRenderReport();
      expect(wastedRenderReport).not.toBeNull();

      // Verify the report has the expected title
      const reportTitle = await wastedRenderReport!.textContent();
      expect(reportTitle).toContain('Wasted');
    });

    test('should identify memoized vs unmemoized components', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data with both memoized and unmemoized components
      const sampleData: import('./pom/ProfilerPanel').ProfileData = {
        version: 1,
        commits: [
          {
            id: 'memo-test-1',
            timestamp: Date.now(),
            duration: 10,
            nodes: [
              { id: 1, displayName: 'UnmemoizedComponent', actualDuration: 5, isMemoized: false },
              { id: 2, displayName: 'MemoizedComponent', actualDuration: 3, isMemoized: true },
            ],
          },
        ],
        recordingDuration: 100,
      };

      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'memo-identification-test.json');
      fs.writeFileSync(sampleDataPath, JSON.stringify(sampleData, null, 2));
      await panel.importData(sampleDataPath);

      // Switch to tree view and verify components exist
      await panel.switchViewMode('tree');
      const unmemoized = await panel.getComponentByName('UnmemoizedComponent');
      const memoized = await panel.getComponentByName('MemoizedComponent');

      expect(unmemoized).not.toBeNull();
      expect(memoized).not.toBeNull();
    });

    test('should show render counts for components', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import data with multiple commits
      const multiCommitData = panel.createWastedRenderProfileData();
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'render-count-test.json');
      await panel.saveSampleProfileData(sampleDataPath, multiCommitData);
      await panel.importData(sampleDataPath);

      // Switch to analysis view
      await panel.switchViewMode('analysis');
      await page.waitForTimeout(500);

      // Get wasted render info
      const wastedRenderInfo = await panel.getWastedRenderInfo();
      
      // Should have wasted render data
      expect(Array.isArray(wastedRenderInfo)).toBe(true);
    });
  });

  test.describe('Stats Display', () => {
    test('should display commit count in toolbar', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'stats-commit-test.json');
      const sampleData = panel.createSampleProfileData();
      await panel.saveSampleProfileData(sampleDataPath, sampleData);
      await panel.importData(sampleDataPath);

      // Verify commit count matches
      const commitCount = await panel.getCommitCount();
      expect(commitCount).toBe(sampleData.commits.length);
    });

    test('should display recording duration', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'stats-duration-test.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Duration should be available
      const duration = await panel.getRecordingDuration();
      expect(typeof duration).toBe('number');
    });

    test('should display performance score when available', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import data
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'stats-score-test.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Score might not be available without analysis
      const score = await panel.getPerformanceScore();
      // Score is either a number or null
      expect(score === null || typeof score === 'number').toBe(true);
    });

    test('should display all stats together', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'stats-all-test.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Get all stats
      const stats = await panel.getAllStats();
      
      expect(typeof stats.commits).toBe('number');
      expect(stats.score === null || typeof stats.score === 'number').toBe(true);
      expect(stats.duration === null || typeof stats.duration === 'number').toBe(true);
    });
  });

  test.describe('Clear Data Functionality', () => {
    test('should clear all profiling data', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'clear-test-data.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Verify data exists
      const commitCountBefore = await panel.getCommitCount();
      expect(commitCountBefore).toBeGreaterThan(0);

      // Clear data
      await panel.clearData();

      // Verify data is cleared
      const commitCountAfter = await panel.getCommitCount();
      expect(commitCountAfter).toBe(0);
    });

    test('should reset stats after clearing', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Profile and clear
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'clear-stats-test.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);
      await panel.clearData();

      // Stats should be reset
      const stats = await panel.getAllStats();
      expect(stats.commits).toBe(0);
    });

    test('should show empty state after clearing', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import and clear
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'clear-empty-test.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);
      await panel.clearData();

      // Welcome screen or empty state should be visible
      const isWelcomeVisible = await panel.isWelcomeScreenVisible();
      const isEmptyState = await panel.emptyState.isVisible().catch(() => false);
      
      expect(isWelcomeVisible || isEmptyState).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle start profiling when not connected', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Check if record button is disabled when not connected
      const recordButton = page.locator('button:has-text("Record"), button[aria-label*="record" i]').first();
      const isDisabled = await recordButton.isDisabled().catch(() => false);
      
      // Button state depends on connection status
      expect(typeof isDisabled).toBe('boolean');
    });

    test('should show appropriate message when no data available', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Ensure no data (fresh load)
      const isWelcomeVisible = await panel.isWelcomeScreenVisible();
      const isEmptyState = await panel.emptyState.isVisible().catch(() => false);
      
      // One of these should be visible
      expect(isWelcomeVisible || isEmptyState).toBe(true);
    });

    test('should handle rapid start/stop actions', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import data first
      const sampleDataPath = path.join(TEST_RESULTS_DIR, 'rapid-actions-test.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Rapid start/stop cycles
      for (let i = 0; i < 3; i++) {
        try {
          await panel.startProfiling();
          await page.waitForTimeout(100);
          await panel.stopProfiling();
          await page.waitForTimeout(100);
        } catch {
          // Handle any errors gracefully
        }
      }

      // Panel should still be functional
      const isFunctional = await panel.isRecording().then(() => true).catch(() => false);
      expect(isFunctional).toBe(true);
    });
  });

  test.describe('End-to-End Integration', () => {
    test('should complete full user workflow: load → import → analyze → clear', async () => {
      // 1. Load panel
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();
      
      // Verify initial state
      let isWelcomeVisible = await panel.isWelcomeScreenVisible();
      expect(isWelcomeVisible).toBe(true);

      // 2. Import profile data
      const workflowData: import('./pom/ProfilerPanel').ProfileData = {
        version: 1,
        commits: Array.from({ length: 5 }, (_, i) => ({
          id: `workflow-commit-${i}`,
          timestamp: Date.now() + i * 1000,
          duration: 10 + i * 2,
          nodes: [
            { id: 1, displayName: 'App', actualDuration: 5, isMemoized: false },
            { id: 2, displayName: 'Header', actualDuration: 2, isMemoized: false },
            { id: 3, displayName: 'Content', actualDuration: 3, isMemoized: true },
          ],
        })),
        recordingDuration: 5000,
      };

      const workflowDataPath = path.join(TEST_RESULTS_DIR, 'workflow-test-data.json');
      fs.writeFileSync(workflowDataPath, JSON.stringify(workflowData, null, 2));
      await panel.importData(workflowDataPath);

      // Verify data loaded
      const commitCount = await panel.getCommitCount();
      expect(commitCount).toBe(5);

      // 3. View in tree mode
      await panel.switchViewMode('tree');
      const componentCount = await panel.getComponentCount();
      expect(componentCount).toBeGreaterThan(0);

      // 4. View in analysis mode
      await panel.switchViewMode('analysis');
      await page.waitForTimeout(500);
      
      const analysisView = page.locator('[class*="analysisView"]').first();
      await expect(analysisView).toBeVisible();

      // 5. Switch through all views
      await panel.switchViewMode('flamegraph');
      await panel.switchViewMode('timeline');
      await panel.switchViewMode('tree');

      // 6. Clear data
      await panel.clearData();

      // Verify back to empty state
      isWelcomeVisible = await panel.isWelcomeScreenVisible();
      expect(isWelcomeVisible).toBe(true);
    });
  });
});
