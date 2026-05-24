/**
 * VS Code Extension entry point — activates the React Perf Profiler integration.
 *
 * Connects to the Chrome extension via WebSocket, provides:
 * - Inline render count decorations
 * - Budget violation diagnostics in Problems panel
 * - Quick fix code actions (React.memo wrapping)
 * - Performance report sidebar
 */

import * as vscode from 'vscode';
import { PanelConnection } from './panelConnection';
import { DecorationProvider } from './decorationProvider';
import { DiagnosticsProvider } from './diagnosticsProvider';
import { registerCodeActions } from './codeActions';
import type { AnalysisPayload, WSMessage, ComponentPerfData } from './types';

export function activate(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('reactPerf');
  const port = config.get<number>('wsPort', 9876);

  const connection = new PanelConnection(port);
  const decorations = new DecorationProvider();
  const diagnostics = new DiagnosticsProvider();

  let latestData: AnalysisPayload | null = null;

  // Handle incoming messages from Chrome extension
  connection.onMessage((message: WSMessage) => {
    switch (message.type) {
      case 'analysis': {
        const payload = message.payload as AnalysisPayload;
        latestData = payload;

        // Update decorations
        decorations.updateData(payload.components);

        // Update diagnostics
        diagnostics.updateDiagnostics(payload);

        // Update status bar
        const score = payload.performanceScore;
        const icon = score >= 80 ? '$(check)' : score >= 60 ? '$(alert)' : '$(error)';
        vscode.window.setStatusBarMessage(`${icon} React Perf: Score ${score}/100`, 5000);
        break;
      }
      case 'budget_violation': {
        const payload = message.payload as AnalysisPayload;
        diagnostics.updateDiagnostics(payload);
        vscode.window.showWarningMessage(
          `React Perf: ${payload.budgetViolations.length} budget violation(s) detected`,
        );
        break;
      }
    }
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('reactPerf.showReport', () => {
      if (!latestData) {
        vscode.window.showInformationMessage('No performance data available. Profile an app first.');
        return;
      }
      // Show a quick pick with component performance data
      const items = Object.entries(latestData.components)
        .sort(([, a], [, b]) => b.renderCount - a.renderCount)
        .map(([name, data]) => ({
          label: name,
          description: `${data.renderCount} renders · ${data.wastedRenderRate.toFixed(0)}% waste`,
          detail: data.issues.length > 0 ? data.issues.join('; ') : undefined,
        }));

      vscode.window.showQuickPick(items, {
        placeHolder: `Score: ${latestData.performanceScore}/100 · ${latestData.totalCommits} commits`,
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('reactPerf.setBaseline', () => {
      if (latestData) {
        diagnostics.setBaseline(latestData);
        vscode.window.showInformationMessage('Baseline set for comparison');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('reactPerf.connect', () => {
      connection.connect();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('reactPerf.disconnect', () => {
      connection.disconnect();
      vscode.window.setStatusBarMessage('React Perf: Disconnected', 3000);
    }),
  );

  // Register code actions
  registerCodeActions(context);

  // Auto-connect on activate
  connection.connect();

  // Refresh decorations when editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      decorations.refresh();
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => {
      // Clear decorations on edit to avoid stale positions
    }),
  );

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(dashboard) React Perf';
  statusBarItem.command = 'reactPerf.showReport';
  statusBarItem.tooltip = 'React Perf Profiler — click for report';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Cleanup
  context.subscriptions.push(connection);
  context.subscriptions.push(decorations);
  context.subscriptions.push(diagnostics);
}

export function deactivate(): void {
  // Cleanup is handled by disposables in context.subscriptions
}
