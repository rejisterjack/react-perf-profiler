/**
 * VS Code Extension entry point for React Perf Profiler.
 *
 * Provides:
 * - Tree view showing profiling insights in the sidebar
 * - Commands to open profiles and run budget checks
 * - Inline decorations for components that exceed budgets
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs';

interface ProfileData {
  commits: Array<{
    fiberNodes: Array<{
      name: string;
      renderTime: number;
      renderCount: number;
    }>;
  }>;
}

let profileData: ProfileData | null = null;

export function activate(context: vscode.ExtensionContext): void {
  // Tree data provider for sidebar
  const treeProvider = new PerfTreeDataProvider();
  const treeView = vscode.window.createTreeView('reactPerfProfiler.sidebar', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Command: Open Profile
  const openProfileCmd = vscode.commands.registerCommand(
    'reactPerfProfiler.openProfile',
    async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'Profile JSON': ['json'] },
        title: 'Select React Perf Profiler Export',
      });

      if (!uris?.[0]) return;

      try {
        const content = fs.readFileSync(uris[0].fsPath, 'utf-8');
        profileData = JSON.parse(content) as ProfileData;
        treeProvider.refresh();
        vscode.window.showInformationMessage(
          `Loaded profile with ${profileData.commits?.length ?? 0} commits`
        );
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to load profile: ${(err as Error).message}`);
      }
    }
  );

  // Command: Run Budget Check
  const budgetCheckCmd = vscode.commands.registerCommand(
    'reactPerfProfiler.runBudgetCheck',
    () => {
      if (!profileData) {
        vscode.window.showWarningMessage('No profile loaded. Open a profile first.');
        return;
      }

      const config = vscode.workspace.getConfiguration('reactPerfProfiler.budgets');
      const maxRenderTime = config.get<number>('renderTime', 16);
      const maxRenderCount = config.get<number>('renderCount', 10);

      const violations: string[] = [];
      const componentMap = new Map<string, { renderTime: number; renderCount: number }>();

      for (const commit of profileData.commits ?? []) {
        for (const fiber of commit.fiberNodes ?? []) {
          const existing = componentMap.get(fiber.name);
          componentMap.set(fiber.name, {
            renderTime: Math.max(existing?.renderTime ?? 0, fiber.renderTime),
            renderCount: (existing?.renderCount ?? 0) + fiber.renderCount,
          });
        }
      }

      for (const [name, data] of componentMap) {
        if (data.renderTime > maxRenderTime) {
          violations.push(`${name}: ${data.renderTime.toFixed(1)}ms (>${maxRenderTime}ms)`);
        }
        if (data.renderCount > maxRenderCount) {
          violations.push(`${name}: ${data.renderCount} renders (>${maxRenderCount})`);
        }
      }

      if (violations.length === 0) {
        vscode.window.showInformationMessage('All components within performance budgets');
      } else {
        vscode.window.showWarningMessage(
          `${violations.length} budget violation(s):\n${violations.slice(0, 10).join('\n')}`
        );
      }
    }
  );

  context.subscriptions.push(openProfileCmd, budgetCheckCmd, treeView);
}

class PerfTreeDataProvider implements vscode.TreeDataProvider<PerfTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PerfTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: PerfTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(_element?: PerfTreeItem): PerfTreeItem[] {
    if (!profileData) {
      return [new PerfTreeItem('No profile loaded — use "Open Profile" command', vscode.TreeItemCollapsibleState.None)];
    }

    const items: PerfTreeItem[] = [];
    const totalCommits = profileData.commits?.length ?? 0;
    items.push(new PerfTreeItem(`Commits: ${totalCommits}`, vscode.TreeItemCollapsibleState.None));

    const componentMap = new Map<string, { totalTime: number; count: number }>();
    for (const commit of profileData.commits ?? []) {
      for (const fiber of commit.fiberNodes ?? []) {
        const existing = componentMap.get(fiber.name) ?? { totalTime: 0, count: 0 };
        componentMap.set(fiber.name, {
          totalTime: existing.totalTime + fiber.renderTime,
          count: existing.count + fiber.renderCount,
        });
      }
    }

    const sorted = Array.from(componentMap.entries()).sort((a, b) => b[1].totalTime - a[1].totalTime);
    for (const [name, data] of sorted.slice(0, 20)) {
      items.push(new PerfTreeItem(
        `${name} — ${data.totalTime.toFixed(1)}ms / ${data.count} renders`,
        vscode.TreeItemCollapsibleState.None
      ));
    }

    return items;
  }
}

class PerfTreeItem extends vscode.TreeItem {}

export function deactivate(): void {
  // Cleanup
}
