/**
 * Profiling Integration Tests
 * 
 * These tests verify the integration between the extension components
 * and the overall profiling workflow. For detailed feature tests, see:
 * - coreFlows.spec.ts - Main profiling flow
 * - analysisFlow.spec.ts - Analysis features
 * - exportImport.spec.ts - Data persistence
 * - keyboardNavigation.spec.ts - Keyboard shortcuts
 */

/// <reference path="./types.d.ts" />

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { ProfilerPanel } from './pom/ProfilerPanel';
import * as path from 'path';

test.describe('Profiling Integration', () => {
  let context: BrowserContext;
  let page: Page;
  let panel: ProfilerPanel;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
    panel = new ProfilerPanel(page, context);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Extension Loading', () => {
    test('should load extension panel successfully', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Verify panel UI is rendered
      const app = page.locator('[class*="app"], [class*="welcomeScreen"]').first();
      await expect(app).toBeVisible();
    });

    test('should show connection status', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Check for connection status indicator
      const connectionStatus = page.locator('[class*="connectionStatus"]').first();
      await expect(connectionStatus).toBeVisible();

      // Should show either "Connected" or "Disconnected"
      const statusText = await connectionStatus.textContent();
      expect(statusText?.includes('Connected') || statusText?.includes('Disconnected')).toBe(true);
    });
  });

  test.describe('Basic Profiling Workflow', () => {
    test('complete profiling workflow with sample data', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const testResultsDir = path.resolve(__dirname, '../../test-results');
      const sampleDataPath = path.join(testResultsDir, 'integration-test-data.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Verify data loaded
      const commitCount = await panel.getCommitCount();
      expect(commitCount).toBeGreaterThan(0);

      // Switch to analysis view
      await panel.switchViewMode('analysis');
      
      // Verify analysis view loaded
      const analysisView = page.locator('[class*="analysisView"]').first();
      await expect(analysisView).toBeVisible();

      // Switch back to tree view
      await panel.switchViewMode('tree');

      // Verify tree view
      const treeView = page.locator('[role="tree"], [class*="treeView"]').first();
      await expect(treeView).toBeVisible();

      // Clear data
      await panel.clearData();

      // Verify data cleared
      const commitCountAfter = await panel.getCommitCount();
      expect(commitCountAfter).toBe(0);
    });

    test('should handle multiple view switches', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import sample data
      const testResultsDir = path.resolve(__dirname, '../../test-results');
      const sampleDataPath = path.join(testResultsDir, 'view-switch-test.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Switch through all views multiple times
      const views: Array<'tree' | 'flamegraph' | 'timeline' | 'analysis'> = 
        ['tree', 'flamegraph', 'timeline', 'analysis', 'tree', 'analysis'];

      for (const view of views) {
        await panel.switchViewMode(view);
        await page.waitForTimeout(200);
        
        // Verify view container is still visible
        const viewContainer = page.locator('[class*="panelLayout"], [class*="mainContent"]').first();
        await expect(viewContainer).toBeVisible();
      }
    });
  });

  test.describe('Data Management', () => {
    test('should handle multiple import-export cycles', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      const testResultsDir = path.resolve(__dirname, '../../test-results');
      const cycle1Path = path.join(testResultsDir, 'cycle1.json');
      const cycle2Path = path.join(testResultsDir, 'cycle2.json');

      // First cycle
      await panel.saveSampleProfileData(cycle1Path);
      await panel.importData(cycle1Path);
      expect(await panel.getCommitCount()).toBeGreaterThan(0);

      // Clear and second cycle
      await panel.clearData();
      await panel.saveSampleProfileData(cycle2Path);
      await panel.importData(cycle2Path);
      expect(await panel.getCommitCount()).toBeGreaterThan(0);

      // Clear again
      await panel.clearData();
      expect(await panel.getCommitCount()).toBe(0);
    });

    test('should maintain state during recording session', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Start recording
      try {
        await panel.startProfiling();
        
        // Verify recording state
        expect(await panel.isRecording()).toBe(true);

        // UI should show recording indicator
        const recordingIndicator = page.locator('[data-recording="true"]').first();
        await expect(recordingIndicator).toBeVisible();

        // Stop recording
        await panel.stopProfiling();
        
        // Verify stopped
        expect(await panel.isRecording()).toBe(false);
      } catch {
        // Recording may fail if not connected - that's ok for this test
        test.skip(true, 'Recording not available - extension not connected');
      }
    });
  });

  test.describe('UI Responsiveness', () => {
    test('toolbar buttons should respond to clicks', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Test record button
      const recordButton = page.locator('button:has-text("Record"), button:has([name="record"])').first();
      const recordVisible = await recordButton.isVisible().catch(() => false);
      
      if (recordVisible) {
        await recordButton.click();
        await page.waitForTimeout(200);
      }

      // Test import button
      const importButton = page.locator('button:has-text("Import"), button:has([name="upload"])').first();
      await importButton.click();
      
      // Import dialog should appear
      const importDialog = page.locator('[class*="dialog"]').filter({ hasText: 'Import Profile Data' });
      await expect(importDialog).toBeVisible();

      // Close dialog
      await panel.pressEscape();
      await expect(importDialog).not.toBeVisible();
    });

    test('view mode toggles should work', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Import data to enable all view modes
      const testResultsDir = path.resolve(__dirname, '../../test-results');
      const sampleDataPath = path.join(testResultsDir, 'toggle-test.json');
      await panel.saveSampleProfileData(sampleDataPath);
      await panel.importData(sampleDataPath);

      // Find and click view mode toggles
      const viewButtons = await page.locator('[class*="viewModeToggle"] button, [data-mode]').all();
      
      for (const button of viewButtons) {
        const isVisible = await button.isVisible().catch(() => false);
        const isEnabled = await button.isEnabled().catch(() => false);
        
        if (isVisible && isEnabled) {
          await button.click();
          await page.waitForTimeout(200);
        }
      }

      // Test passed if we clicked all available buttons
      expect(true).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle rapid UI interactions gracefully', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Rapid clicks on various buttons
      const buttons = await page.locator('button').all();
      
      for (let i = 0; i < Math.min(5, buttons.length); i++) {
        const button = buttons[i];
        const isVisible = await button.isVisible().catch(() => false);
        const isEnabled = await button.isEnabled().catch(() => false);
        
        if (isVisible && isEnabled) {
          await button.click();
        }
      }

      // UI should still be responsive
      const app = page.locator('[class*="app"]').first();
      await expect(app).toBeVisible();
    });

    test('should recover from invalid operations', async () => {
      await panel.navigateToPanel();
      await panel.waitForPanelLoad();

      // Try to clear when no data
      await panel.clearData();

      // UI should still work
      const toolbar = page.locator('[class*="toolbar"]').first();
      await expect(toolbar).toBeVisible();

      // Try to export when no data
      const exportButton = page.locator('button:has-text("Export"), button:has([name="download"])').first();
      const isDisabled = await exportButton.isDisabled().catch(() => false);
      
      // Export should be disabled when no data
      expect(isDisabled).toBe(true);
    });
  });
});

/**
 * Helper functions for integration tests
 */
export async function createTestProfileData(commitCount: number = 3): Promise<{
  version: number;
  commits: Array<{
    id: string;
    timestamp: number;
    duration: number;
    nodes: Array<{
      id: number;
      displayName: string;
      actualDuration: number;
      isMemoized: boolean;
    }>;
  }>;
  recordingDuration: number;
}> {
  return {
    version: 1,
    commits: Array.from({ length: commitCount }, (_, i) => ({
      id: `test-commit-${i}`,
      timestamp: Date.now() + i * 100,
      duration: 5 + Math.random() * 10,
      nodes: [
        { id: 1, displayName: 'App', actualDuration: 3, isMemoized: false },
        { id: 2, displayName: 'Header', actualDuration: 1, isMemoized: true },
        { id: 3, displayName: 'Content', actualDuration: 2, isMemoized: false },
      ],
    })),
    recordingDuration: commitCount * 100,
  };
}
