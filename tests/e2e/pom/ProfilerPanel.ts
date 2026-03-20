/**
 * Page Object Model for React Perf Profiler DevTools Panel
 * Provides an abstraction layer for interacting with the profiler UI
 */

import type { Page, Locator, BrowserContext, Download } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface ProfileData {
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
}

export interface ComponentInfo {
  name: string;
  renderCount: number;
  wastedRenders: number;
  wastedRenderRate: number;
  averageDuration: number;
  isMemoized: boolean;
  severity: 'none' | 'info' | 'warning' | 'critical';
}

export class ProfilerPanel {
  readonly page: Page;
  readonly context: BrowserContext;
  
  // Toolbar selectors
  private readonly toolbar: Locator;
  private readonly recordButton: Locator;
  private readonly stopButton: Locator;
  private readonly clearButton: Locator;
  private readonly exportButton: Locator;
  readonly connectionStatus: Locator;
  private readonly statsContainer: Locator;
  
  // View mode selectors
  private readonly viewModeToggle: Locator;
  
  // Tree view selectors
  private readonly treeView: Locator;
  private readonly emptyState: Locator;
  
  // Detail panel selectors
  private readonly detailPanel: Locator;
  private readonly detailPanelCloseButton: Locator;
  
  // Welcome screen selectors
  private readonly welcomeScreen: Locator;
  private readonly startProfilingButton: Locator;
  
  // Import dialog selectors
  private readonly importDialog: Locator;
  private readonly importDropZone: Locator;
  private readonly importConfirmButton: Locator;
  private readonly importCancelButton: Locator;
  private readonly importFileInput: Locator;
  
  // Public accessors for tests
  readonly importButton: Locator;
  
  // Analysis view selectors
  private readonly analysisView: Locator;
  private readonly wastedRenderReport: Locator;
  private readonly memoEffectivenessReport: Locator;
  private readonly recommendationsPanel: Locator;

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
    
    // Toolbar
    this.toolbar = page.locator('[class*="toolbar"]').first();
    this.recordButton = page.locator('button:has-text("Record"), button:has([name="record"])').first();
    this.stopButton = page.locator('button:has-text("Stop"), button:has([name="stop"])').first();
    this.clearButton = page.locator('button:has-text("Clear"), button:has([name="trash"])').first();
    this.exportButton = page.locator('button:has-text("Export"), button:has([name="download"])').first();
    this.importButton = page.locator('button:has-text("Import"), button:has([name="upload"])').first();
    this.connectionStatus = page.locator('[class*="connectionStatus"]').first();
    this.statsContainer = page.locator('[class*="stats"]').first();
    
    // View modes
    this.viewModeToggle = page.locator('[class*="viewModeToggle"]').first();
    
    // Tree view
    this.treeView = page.locator('[role="tree"], [class*="treeView"]').first();
    this.emptyState = page.locator('[class*="emptyState"]').first();
    
    // Detail panel
    this.detailPanel = page.locator('[class*="detailPanel"]').first();
    this.detailPanelCloseButton = page.locator('[class*="detailPanel"] [aria-label*="Close"], [class*="detailPanel"] button:has([name="close"])').first();
    
    // Welcome screen
    this.welcomeScreen = page.locator('[class*="welcomeScreen"]').first();
    this.startProfilingButton = page.locator('[class*="welcomeScreen"] button:has-text("Start Profiling")').first();
    
    // Import dialog
    this.importDialog = page.locator('[class*="dialog"]').filter({ hasText: 'Import Profile Data' });
    this.importDropZone = page.locator('[class*="dropZone"]').first();
    this.importConfirmButton = page.locator('button:has-text("Import")').first();
    this.importCancelButton = page.locator('button:has-text("Cancel")').first();
    this.importFileInput = page.locator('input[type="file"]').first();
    
    // Analysis views
    this.analysisView = page.locator('[class*="analysisView"]').first();
    this.wastedRenderReport = page.locator('[class*="report"]').filter({ hasText: 'Wasted Renders' }).first();
    this.memoEffectivenessReport = page.locator('[class*="report"]').filter({ hasText: 'Memo' }).first();
    this.recommendationsPanel = page.locator('[class*="recommendations"], [class*="optimization"]').first();
  }

  // ============================================================================
  // Navigation & Setup
  // ============================================================================

  /**
   * Opens the DevTools panel for the extension
   * Note: In a real Chrome extension test, this would navigate to the DevTools page
   */
  async openDevToolsPanel(): Promise<void> {
    // Open DevTools using F12 key
    await this.page.keyboard.press('F12');
    await this.page.waitForTimeout(1000);
    
    // Try to navigate to the React Perf Profiler tab
    // This is a simplified approach - in real tests, you may need to use CDP
    await this.page.keyboard.press('Control+Shift+P');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.type('Show React Perf Profiler');
    await this.page.waitForTimeout(200);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
  }

  /**
   * Navigates directly to the panel HTML for testing
   * This is useful for testing the panel UI in isolation
   */
  async navigateToPanel(): Promise<void> {
    // For testing, we can load the panel directly via file URL or served URL
    const panelUrl = process.env.PANEL_URL || 'http://localhost:5173/src/panel/index.html';
    await this.page.goto(panelUrl);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Waits for the panel to be fully loaded
   */
  async waitForPanelLoad(): Promise<void> {
    await this.page.waitForSelector('[class*="app"], [class*="welcomeScreen"]', { timeout: 10000 });
  }

  // ============================================================================
  // Recording Controls
  // ============================================================================

  /**
   * Starts a profiling session
   */
  async startProfiling(): Promise<void> {
    // Check if we're on welcome screen or have the record button
    const isWelcomeScreen = await this.welcomeScreen.isVisible().catch(() => false);
    
    if (isWelcomeScreen) {
      await this.startProfilingButton.click();
    } else {
      await this.recordButton.click();
    }
    
    // Wait for recording state to be active
    await this.page.waitForSelector('[data-recording="true"]', { timeout: 5000 });
  }

  /**
   * Stops the current profiling session
   */
  async stopProfiling(): Promise<void> {
    await this.stopButton.click();
    
    // Wait for recording to stop
    await this.page.waitForSelector('[data-recording="false"]', { timeout: 5000 });
    
    // Wait for data to be processed
    await this.page.waitForTimeout(500);
  }

  /**
   * Clears all profiling data
   */
  async clearData(): Promise<void> {
    await this.clearButton.click();
    
    // Wait for empty state or welcome screen
    await this.page.waitForSelector('[class*="emptyState"], [class*="welcomeScreen"]', { timeout: 5000 });
  }

  /**
   * Checks if currently recording
   */
  async isRecording(): Promise<boolean> {
    const app = this.page.locator('[class*="app"]').first();
    const recordingAttr = await app.getAttribute('data-recording');
    return recordingAttr === 'true';
  }

  // ============================================================================
  // Component Tree
  // ============================================================================

  /**
   * Gets the component tree element
   */
  async getComponentTree(): Promise<Locator> {
    return this.treeView;
  }

  /**
   * Gets all component nodes in the tree
   */
  async getComponentNodes(): Promise<Locator[]> {
    return this.page.locator('[role="treeitem"], [class*="treeNode"]').all();
  }

  /**
   * Gets component info by name
   */
  async getComponentByName(name: string): Promise<Locator | null> {
    const component = this.page.locator(`[role="treeitem"]:has-text("${name}"), [class*="treeNode"]:has-text("${name}")`).first();
    const isVisible = await component.isVisible().catch(() => false);
    return isVisible ? component : null;
  }

  /**
   * Clicks on a component in the tree to select it
   */
  async selectComponent(name: string): Promise<void> {
    const component = await this.getComponentByName(name);
    if (!component) {
      throw new Error(`Component "${name}" not found in tree`);
    }
    await component.click();
    
    // Wait for selection to be applied
    await this.page.waitForTimeout(200);
  }

  /**
   * Expands a tree node by name
   */
  async expandNode(name: string): Promise<void> {
    const node = this.page.locator(`[role="treeitem"]:has-text("${name}"), [class*="treeNode"]:has-text("${name}")`).first();
    const expandButton = node.locator('button[class*="expand"], [class*="chevron"], [class*="toggle"]').first();
    
    const isVisible = await expandButton.isVisible().catch(() => false);
    if (isVisible) {
      await expandButton.click();
      await this.page.waitForTimeout(200);
    }
  }

  /**
   * Collapses a tree node by name
   */
  async collapseNode(name: string): Promise<void> {
    const node = this.page.locator(`[role="treeitem"]:has-text("${name}"), [class*="treeNode"]:has-text("${name}")`).first();
    const collapseButton = node.locator('button[class*="expand"], [class*="chevron"], [class*="toggle"]').first();
    
    const isVisible = await collapseButton.isVisible().catch(() => false);
    if (isVisible) {
      await collapseButton.click();
      await this.page.waitForTimeout(200);
    }
  }

  /**
   * Gets the number of components in the tree
   */
  async getComponentCount(): Promise<number> {
    const nodes = await this.getComponentNodes();
    return nodes.length;
  }

  /**
   * Checks if the tree view has data
   */
  async hasTreeData(): Promise<boolean> {
    const emptyState = await this.emptyState.isVisible().catch(() => false);
    return !emptyState;
  }

  // ============================================================================
  // View Modes
  // ============================================================================

  /**
   * Switches to a different view mode
   */
  async switchViewMode(mode: 'tree' | 'flamegraph' | 'timeline' | 'analysis'): Promise<void> {
    const modeButton = this.page.locator(`button:has-text("${mode}"), [data-mode="${mode}"]`).first();
    await modeButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Gets the current view mode
   */
  async getCurrentViewMode(): Promise<string> {
    const activeButton = this.page.locator('[data-active="true"], [class*="active"]').first();
    return activeButton.textContent() || 'unknown';
  }

  // ============================================================================
  // Detail Panel
  // ============================================================================

  /**
   * Checks if detail panel is open
   */
  async isDetailPanelOpen(): Promise<boolean> {
    return this.detailPanel.isVisible().catch(() => false);
  }

  /**
   * Closes the detail panel
   */
  async closeDetailPanel(): Promise<void> {
    const isOpen = await this.isDetailPanelOpen();
    if (isOpen) {
      // Press Escape key to close
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(200);
    }
  }

  /**
   * Gets component details from the detail panel
   */
  async getComponentDetails(): Promise<Partial<ComponentInfo> | null> {
    const isOpen = await this.isDetailPanelOpen();
    if (!isOpen) return null;

    const name = await this.detailPanel.locator('h2, h3').first().textContent().catch(() => null);
    
    return {
      name: name || undefined,
    };
  }

  // ============================================================================
  // Analysis Features
  // ============================================================================

  /**
   * Runs the performance analysis
   */
  async runAnalysis(): Promise<void> {
    // Switch to analysis view
    await this.switchViewMode('analysis');
    
    // Wait for analysis to complete
    await this.page.waitForTimeout(1000);
  }

  /**
   * Gets the wasted render report
   */
  async getWastedRenderReport(): Promise<Locator | null> {
    const report = this.wastedRenderReport;
    const isVisible = await report.isVisible().catch(() => false);
    return isVisible ? report : null;
  }

  /**
   * Gets the memo effectiveness report
   */
  async getMemoEffectivenessReport(): Promise<Locator | null> {
    const report = this.memoEffectivenessReport;
    const isVisible = await report.isVisible().catch(() => false);
    return isVisible ? report : null;
  }

  /**
   * Gets optimization recommendations
   */
  async getRecommendations(): Promise<string[]> {
    const recs = await this.page.locator('[class*="recommendation"], [class*="suggestion"]').all();
    const texts: string[] = [];
    for (const rec of recs) {
      const text = await rec.textContent().catch(() => null);
      if (text) texts.push(text.trim());
    }
    return texts;
  }

  /**
   * Checks if wasted renders were detected
   */
  async hasWastedRenders(): Promise<boolean> {
    const report = await this.getWastedRenderReport();
    if (!report) return false;
    
    const hasItems = await report.locator('[class*="item"], li').count() > 0;
    return hasItems;
  }

  // ============================================================================
  // Export/Import
  // ============================================================================

  /**
   * Exports profiling data to a JSON file
   * @returns Path to the downloaded file
   */
  async exportData(downloadPath: string): Promise<string> {
    // Set up download listener
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportButton.click(),
    ]);
    
    const filePath = path.join(downloadPath, await download.suggestedFilename());
    await download.saveAs(filePath);
    
    return filePath;
  }

  /**
   * Imports profiling data from a JSON file
   */
  async importData(filePath: string): Promise<void> {
    await this.importButton.click();
    
    // Wait for import dialog
    await this.importDialog.waitFor({ state: 'visible', timeout: 5000 });
    
    // Upload file
    await this.importFileInput.setInputFiles(filePath);
    
    // Wait for preview and click import
    await this.page.waitForTimeout(500);
    await this.importConfirmButton.click();
    
    // Wait for dialog to close
    await this.importDialog.waitFor({ state: 'hidden', timeout: 10000 });
    
    // Wait for data to load
    await this.page.waitForTimeout(500);
  }

  /**
   * Creates a sample profile data file for testing
   */
  createSampleProfileData(): ProfileData {
    return {
      version: 1,
      commits: [
        {
          id: 'commit-1',
          timestamp: Date.now(),
          duration: 12.5,
          nodes: [
            {
              id: 1,
              displayName: 'App',
              actualDuration: 5.2,
              isMemoized: false,
            },
            {
              id: 2,
              displayName: 'Counter',
              actualDuration: 3.1,
              isMemoized: false,
            },
            {
              id: 3,
              displayName: 'MemoizedList',
              actualDuration: 1.8,
              isMemoized: true,
            },
          ],
        },
        {
          id: 'commit-2',
          timestamp: Date.now() + 100,
          duration: 8.3,
          nodes: [
            {
              id: 1,
              displayName: 'App',
              actualDuration: 3.5,
              isMemoized: false,
            },
            {
              id: 2,
              displayName: 'Counter',
              actualDuration: 2.8,
              isMemoized: false,
            },
          ],
        },
      ],
      recordingDuration: 150,
    };
  }

  /**
   * Saves sample profile data to a file
   */
  async saveSampleProfileData(filePath: string): Promise<void> {
    const data = this.createSampleProfileData();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  /**
   * Presses a keyboard shortcut in the panel
   */
  async pressShortcut(key: string, modifier?: 'Control' | 'Meta' | 'Shift' | 'Alt'): Promise<void> {
    if (modifier) {
      await this.page.keyboard.press(`${modifier}+${key}`);
    } else {
      await this.page.keyboard.press(key);
    }
    await this.page.waitForTimeout(200);
  }

  /**
   * Navigates the component tree using arrow keys
   */
  async navigateTreeWithArrows(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    const keyMap = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };
    
    await this.page.keyboard.press(keyMap[direction]);
    await this.page.waitForTimeout(200);
  }

  /**
   * Opens the currently selected component's details
   */
  async openSelectedComponentDetails(): Promise<void> {
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(300);
  }

  /**
   * Closes the current panel/dialog with Escape
   */
  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  // ============================================================================
  // Stats & Metrics
  // ============================================================================

  /**
   * Gets the commit count from stats
   */
  async getCommitCount(): Promise<number> {
    const statsText = await this.statsContainer.textContent().catch(() => '');
    const match = statsText.match(/(\d+)\s*commits?/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Gets the performance score
   */
  async getPerformanceScore(): Promise<number | null> {
    const statsText = await this.statsContainer.textContent().catch(() => '');
    const match = statsText.match(/Score:\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Gets the recording duration
   */
  async getRecordingDuration(): Promise<number | null> {
    const statsText = await this.statsContainer.textContent().catch(() => '');
    const match = statsText.match(/(\d+\.?\d*)s/);
    return match ? parseFloat(match[1]) : null;
  }

  // ============================================================================
  // Connection Status
  // ============================================================================

  /**
   * Checks if connected to a React app
   */
  async isConnected(): Promise<boolean> {
    const statusText = await this.connectionStatus.textContent().catch(() => '');
    return statusText.includes('Connected');
  }

  /**
   * Waits for connection to be established
   */
  async waitForConnection(timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const status = document.querySelector('[class*="connectionStatus"]');
        return status?.textContent?.includes('Connected');
      },
      { timeout }
    );
  }

  // ============================================================================
  // Screenshots & Debugging
  // ============================================================================

  /**
   * Takes a screenshot of the panel
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ 
      path: `test-results/${name}.png`,
      fullPage: true 
    });
  }

  /**
   * Gets the current URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Waits for a specific element to be visible
   */
  async waitForElement(selector: string, timeout = 5000): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }
}

export default ProfilerPanel;
