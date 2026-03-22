/**
 * Page Object Model for React Perf Profiler DevTools Panel
 * Provides an abstraction layer for interacting with the profiler UI
 */

import { expect, type Page, type Locator, type BrowserContext, type Download } from '@playwright/test';
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

export interface WastedRenderInfo {
  componentName: string;
  totalRenders: number;
  wastedRenders: number;
  wastedRenderRate: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
}

export interface OptimizationRecommendation {
  type: 'memo' | 'useMemo' | 'useCallback' | 'colocate' | 'none';
  description: string;
  componentName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
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
  readonly emptyState: Locator;
  private readonly sidebar: Locator;
  
  // Detail panel selectors
  private readonly detailPanel: Locator;
  private readonly detailPanelCloseButton: Locator;
  
  // Welcome screen selectors
  private readonly welcomeScreen: Locator;
  private readonly startProfilingButton: Locator;
  
  // Import dialog selectors
  private readonly importDialog: Locator;
  private readonly importDialogOverlay: Locator;
  private readonly importDropZone: Locator;
  private readonly importConfirmButton: Locator;
  private readonly importCancelButton: Locator;
  private readonly importCloseButton: Locator;
  private readonly importFileInput: Locator;
  private readonly importPreview: Locator;
  private readonly importError: Locator;
  
  // Public accessors for tests
  readonly importButton: Locator;
  
  // Analysis view selectors
  private readonly analysisView: Locator;
  private readonly wastedRenderReport: Locator;
  private readonly memoEffectivenessReport: Locator;
  private readonly recommendationsPanel: Locator;
  private readonly performanceScore: Locator;
  
  // Keyboard shortcuts help
  private readonly keyboardShortcutsHelp: Locator;

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
    
    // Toolbar - using data-testid where available, falling back to class selectors
    this.toolbar = page.locator('[class*="toolbar"]').first();
    this.recordButton = page.locator('button:has-text("Record"), button[aria-label*="record" i]').first();
    this.stopButton = page.locator('button:has-text("Stop"), button[aria-label*="stop" i]').first();
    this.clearButton = page.locator('button:has-text("Clear"), button[aria-label*="clear" i]').first();
    this.exportButton = page.locator('button:has-text("Export"), button[aria-label*="export" i]').first();
    this.importButton = page.locator('button:has-text("Import"), button[aria-label*="import" i]').first();
    this.connectionStatus = page.locator('[class*="connectionStatus"]').first();
    this.statsContainer = page.locator('[class*="stats"]').first();
    
    // View modes
    this.viewModeToggle = page.locator('[class*="viewModeToggle"]').first();
    
    // Sidebar and Tree view
    this.sidebar = page.locator('[class*="sidebar"]').first();
    this.treeView = page.locator('[role="tree"], [class*="treeView"], [class*="treeContainer"]').first();
    this.emptyState = page.locator('[class*="emptyState"]').first();
    
    // Detail panel
    this.detailPanel = page.locator('[class*="detailPanel"]').first();
    this.detailPanelCloseButton = page.locator('[class*="detailPanel"] [aria-label*="Close"], [class*="detailPanel"] button[aria-label*="close" i]').first();
    
    // Welcome screen
    this.welcomeScreen = page.locator('[class*="welcomeScreen"]').first();
    this.startProfilingButton = page.locator('[class*="welcomeScreen"] button:has-text("Start Profiling"), button[class*="recordButton"]').first();
    
    // Import dialog - targeting the dialog by role and title
    this.importDialogOverlay = page.locator('[class*="overlay"]').filter({ has: page.locator('text=Import Profile Data') });
    this.importDialog = page.locator('[role="dialog"]').filter({ has: page.locator('text=Import Profile Data') });
    this.importDropZone = page.locator('[class*="dropZone"]').first();
    this.importConfirmButton = page.locator('[class*="importButton"]').first();
    this.importCancelButton = page.locator('[class*="cancelButton"]').first();
    this.importCloseButton = page.locator('[class*="closeButton"]').first();
    this.importFileInput = page.locator('input[type="file"]').first();
    this.importPreview = page.locator('[class*="preview"]').first();
    this.importError = page.locator('[class*="error"]').filter({ hasNot: page.locator('[class*="dropZone"]') }).first();
    
    // Analysis views
    this.analysisView = page.locator('[class*="analysisView"]').first();
    this.wastedRenderReport = page.locator('[class*="report"]').filter({ hasText: 'Wasted' }).first();
    this.memoEffectivenessReport = page.locator('[class*="report"]').filter({ hasText: 'Memo' }).first();
    this.recommendationsPanel = page.locator('[class*="recommendations"], [class*="optimization"]').first();
    this.performanceScore = page.locator('[class*="performanceScore"]').first();
    
    // Keyboard shortcuts help
    this.keyboardShortcutsHelp = page.locator('[class*="keyboardShortcutsHelp"]').first();
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

  /**
   * Waits for the toolbar to be visible
   */
  async waitForToolbar(): Promise<void> {
    await expect(this.toolbar).toBeVisible({ timeout: 5000 });
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

  /**
   * Gets the recording state text
   */
  async getRecordingStateText(): Promise<string> {
    const recordBtn = this.page.locator('button[aria-label*="record" i], button:has-text("Record"), button:has-text("Stop")').first();
    return recordBtn.textContent() || '';
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
    return this.page.locator('[role="treeitem"], [class*="treeNode"], [class*="placeholderItem"]').all();
  }

  /**
   * Gets component info by name
   */
  async getComponentByName(name: string): Promise<Locator | null> {
    const component = this.page.locator(`[role="treeitem"]:has-text("${name}"), [class*="treeNode"]:has-text("${name}"), [class*="placeholderItem"]:has-text("${name}")`).first();
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
    const welcomeScreen = await this.welcomeScreen.isVisible().catch(() => false);
    return !emptyState && !welcomeScreen;
  }

  // ============================================================================
  // View Modes
  // ============================================================================

  /**
   * Switches to a different view mode
   */
  async switchViewMode(mode: 'tree' | 'flamegraph' | 'timeline' | 'analysis'): Promise<void> {
    // Try to find by data-mode attribute first, then by text
    const modeButton = this.page.locator(`[data-mode="${mode}"], button:has-text("${mode}")`).first();
    
    const isVisible = await modeButton.isVisible().catch(() => false);
    if (isVisible) {
      await modeButton.click();
    } else {
      // Fallback: use keyboard shortcut (1-4)
      const modeIndex = ['tree', 'flamegraph', 'timeline', 'analysis'].indexOf(mode);
      if (modeIndex !== -1) {
        await this.page.keyboard.press(String(modeIndex + 1));
      }
    }
    
    await this.page.waitForTimeout(300);
  }

  /**
   * Gets the current view mode
   */
  async getCurrentViewMode(): Promise<string> {
    const activeButton = this.page.locator('[data-active="true"], [class*="active"]').first();
    const text = await activeButton.textContent().catch(() => null);
    if (text) return text.toLowerCase();
    
    // Try to infer from visible content
    const analysisVisible = await this.analysisView.isVisible().catch(() => false);
    if (analysisVisible) return 'analysis';
    
    const treeVisible = await this.treeView.isVisible().catch(() => false);
    if (treeVisible) return 'tree';
    
    return 'unknown';
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
   * Gets wasted render information for all components
   */
  async getWastedRenderInfo(): Promise<WastedRenderInfo[]> {
    const report = await this.getWastedRenderReport();
    if (!report) return [];

    const items = await report.locator('[class*="item"], li').all();
    const results: WastedRenderInfo[] = [];

    for (const item of items) {
      const name = await item.locator('[class*="name"]').textContent().catch(() => null);
      const text = await item.textContent().catch(() => '');
      
      // Parse render counts from text
      const renderMatch = text.match(/(\d+)\s*renders?/);
      const wastedMatch = text.match(/(\d+)\s*wasted/);
      const rateMatch = text.match(/(\d+)%/);
      
      // Determine severity from badge
      const hasCritical = await item.locator('[class*="error"], [class*="critical"]').count() > 0;
      const hasWarning = await item.locator('[class*="warning"]').count() > 0;
      const severity = hasCritical ? 'critical' : hasWarning ? 'high' : 'medium';

      if (name) {
        results.push({
          componentName: name,
          totalRenders: renderMatch ? parseInt(renderMatch[1], 10) : 0,
          wastedRenders: wastedMatch ? parseInt(wastedMatch[1], 10) : 0,
          wastedRenderRate: rateMatch ? parseInt(rateMatch[1], 10) : 0,
          severity,
          recommendedAction: this.extractRecommendedAction(text),
        });
      }
    }

    return results;
  }

  /**
   * Extracts recommended action from text
   */
  private extractRecommendedAction(text: string): string {
    if (text.includes('React.memo')) return 'Wrap with React.memo';
    if (text.includes('useMemo')) return 'Use useMemo for expensive calculations';
    if (text.includes('useCallback')) return 'Wrap callbacks with useCallback';
    if (text.includes('colocate')) return 'Colocate state to reduce prop drilling';
    return 'Review component for optimization';
  }

  /**
   * Gets optimization recommendations
   */
  async getRecommendations(): Promise<OptimizationRecommendation[]> {
    const recs = await this.page.locator('[class*="recommendation"], [class*="suggestion"], [class*="issue"]').all();
    const results: OptimizationRecommendation[] = [];
    
    for (const rec of recs) {
      const text = await rec.textContent().catch(() => null);
      const componentName = await rec.locator('[class*="name"]').textContent().catch(() => '');
      
      if (text) {
        let type: OptimizationRecommendation['type'] = 'none';
        if (text.includes('memo')) type = 'memo';
        else if (text.includes('useMemo')) type = 'useMemo';
        else if (text.includes('useCallback')) type = 'useCallback';
        else if (text.includes('colocate')) type = 'colocate';

        const hasCritical = await rec.locator('[class*="error"], [class*="critical"]').count() > 0;
        const hasWarning = await rec.locator('[class*="warning"]').count() > 0;
        const severity = hasCritical ? 'critical' : hasWarning ? 'high' : 'medium';

        results.push({
          type,
          description: text.trim(),
          componentName: componentName || '',
          severity,
        });
      }
    }
    
    return results;
  }

  /**
   * Checks if wasted renders were detected
   */
  async hasWastedRenders(): Promise<boolean> {
    const report = await this.getWastedRenderReport();
    if (!report) return false;
    
    const hasItems = await report.locator('[class*="item"], li').count() > 0;
    const hasEmptyState = await report.locator('[class*="empty"]').count() > 0;
    
    return hasItems && !hasEmptyState;
  }

  /**
   * Gets the count of critical wasted render issues
   */
  async getCriticalWastedRenderCount(): Promise<number> {
    const report = await this.getWastedRenderReport();
    if (!report) return 0;
    
    const badge = report.locator('[class*="badge"]').filter({ hasText: /Critical/ });
    const text = await badge.textContent().catch(() => '0');
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Gets performance score information
   */
  async getPerformanceScoreInfo(): Promise<{ score: number; grade: string } | null> {
    const score = await this.getPerformanceScore();
    if (score === null) return null;
    
    let grade = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    
    return { score, grade };
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
   * Opens the import dialog
   */
  async openImportDialog(): Promise<void> {
    await this.importButton.click();
    await this.importDialog.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Closes the import dialog by clicking cancel
   */
  async cancelImport(): Promise<void> {
    await this.importCancelButton.click();
    await this.importDialog.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Checks if import dialog is open
   */
  async isImportDialogOpen(): Promise<boolean> {
    return this.importDialog.isVisible().catch(() => false);
  }

  /**
   * Gets import preview information
   */
  async getImportPreview(): Promise<{ commitCount: number; version: string } | null> {
    const preview = this.importPreview;
    const isVisible = await preview.isVisible().catch(() => false);
    if (!isVisible) return null;

    const text = await preview.textContent() || '';
    const commitMatch = text.match(/(\d+)\s*commits?/i);
    const versionMatch = text.match(/version[:\s]+(\d+)/i);

    return {
      commitCount: commitMatch ? parseInt(commitMatch[1], 10) : 0,
      version: versionMatch ? versionMatch[1] : 'unknown',
    };
  }

  /**
   * Checks if import has error
   */
  async getImportError(): Promise<string | null> {
    const error = this.importError;
    const isVisible = await error.isVisible().catch(() => false);
    if (!isVisible) return null;
    return error.textContent();
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
   * Creates sample profile data with wasted renders for testing
   */
  createWastedRenderProfileData(): ProfileData {
    return {
      version: 1,
      commits: Array.from({ length: 10 }, (_, i) => ({
        id: `commit-${i}`,
        timestamp: Date.now() + i * 100,
        duration: 5 + Math.random() * 5,
        nodes: [
          {
            id: 1,
            displayName: 'UnmemoizedChild',
            actualDuration: 2 + Math.random(),
            isMemoized: false,
          },
          {
            id: 2,
            displayName: 'MemoizedChild',
            actualDuration: 1 + Math.random() * 0.5,
            isMemoized: true,
          },
          {
            id: 3,
            displayName: 'App',
            actualDuration: 3 + Math.random(),
            isMemoized: false,
          },
        ],
      })),
      recordingDuration: 1000,
    };
  }

  /**
   * Saves sample profile data to a file
   */
  async saveSampleProfileData(filePath: string, data?: ProfileData): Promise<void> {
    const profileData = data || this.createSampleProfileData();
    fs.writeFileSync(filePath, JSON.stringify(profileData, null, 2));
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

  /**
   * Presses the Space key to toggle recording
   */
  async pressSpace(): Promise<void> {
    await this.page.keyboard.press('Space');
    await this.page.waitForTimeout(300);
  }

  /**
   * Opens keyboard shortcuts help with '?' key
   */
  async openKeyboardShortcutsHelp(): Promise<void> {
    await this.page.keyboard.press('?');
    await this.page.waitForTimeout(300);
  }

  /**
   * Checks if keyboard shortcuts help is open
   */
  async isKeyboardShortcutsHelpOpen(): Promise<boolean> {
    return this.keyboardShortcutsHelp.isVisible().catch(() => false);
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

  /**
   * Gets all stats as an object
   */
  async getAllStats(): Promise<{ commits: number; score: number | null; duration: number | null }> {
    return {
      commits: await this.getCommitCount(),
      score: await this.getPerformanceScore(),
      duration: await this.getRecordingDuration(),
    };
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

  /**
   * Gets connection status text
   */
  async getConnectionStatusText(): Promise<string> {
    return this.connectionStatus.textContent() || '';
  }

  // ============================================================================
  // Welcome Screen
  // ============================================================================

  /**
   * Checks if welcome screen is visible
   */
  async isWelcomeScreenVisible(): Promise<boolean> {
    return this.welcomeScreen.isVisible().catch(() => false);
  }

  /**
   * Gets welcome screen shortcuts info
   */
  async getWelcomeScreenShortcuts(): Promise<string> {
    const shortcutsSection = this.page.locator('[class*="shortcuts"]').first();
    return shortcutsSection.textContent() || '';
  }

  /**
   * Clicks start profiling button on welcome screen
   */
  async clickStartProfilingFromWelcome(): Promise<void> {
    await this.startProfilingButton.click();
    await this.page.waitForSelector('[data-recording="true"]', { timeout: 5000 });
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

  /**
   * Gets page content for debugging
   */
  async getPageContent(): Promise<string> {
    return this.page.content();
  }
}

export default ProfilerPanel;
