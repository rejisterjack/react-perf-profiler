/**
 * Diagnostics provider — shows budget violations in the Problems panel.
 */

import * as vscode from 'vscode';
import type { AnalysisPayload } from './types';

export class DiagnosticsProvider {
  private collection: vscode.DiagnosticCollection;
  private baseline: AnalysisPayload | null = null;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('react-perf');
  }

  setBaseline(data: AnalysisPayload): void {
    this.baseline = data;
  }

  updateDiagnostics(data: AnalysisPayload): void {
    this.collection.clear();

    // Show budget violations
    for (const violation of data.budgetViolations) {
      const componentData = data.components[violation.componentName];
      if (!componentData?.sourceFile) continue;

      const file = mapToWorkspaceFile(componentData.sourceFile);
      if (!file) continue;

      const uri = vscode.Uri.file(file);
      const line = (componentData.sourceLine ?? 1) - 1;
      const range = new vscode.Range(line, 0, line, 100);

      const severity = violation.metric.includes('Count') || violation.metric.includes('Rate')
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(
        range,
        `[React Perf] ${violation.componentName}: ${violation.metric} is ${violation.actualValue} (threshold: ${violation.threshold})`,
        severity,
      );
      diagnostic.source = 'react-perf';
      diagnostic.code = 'budget-violation';

      this.collection.set(uri, [...(this.collection.get(uri) ?? []), diagnostic]);
    }

    // Show high wasted render components
    for (const [name, perf] of Object.entries(data.components)) {
      if (perf.wastedRenderRate > 50 && perf.sourceFile) {
        const file = mapToWorkspaceFile(perf.sourceFile);
        if (!file) continue;

        const uri = vscode.Uri.file(file);
        const line = (perf.sourceLine ?? 1) - 1;
        const range = new vscode.Range(line, 0, line, 100);

        const diagnostic = new vscode.Diagnostic(
          range,
          `[React Perf] ${name}: ${perf.wastedRenderRate.toFixed(0)}% wasted renders (${perf.renderCount} total)`,
          vscode.DiagnosticSeverity.Warning,
        );
        diagnostic.source = 'react-perf';
        diagnostic.code = 'wasted-render';

        this.collection.set(uri, [...(this.collection.get(uri) ?? []), diagnostic]);
      }
    }
  }

  dispose(): void {
    this.collection.dispose();
  }
}

function mapToWorkspaceFile(sourcePath: string): string | null {
  // Handle webpack:// paths: webpack:///./src/components/App.tsx
  const webpackMatch = sourcePath.match(/webpack:\/\/\/?\.\/(.+)/);
  if (webpackMatch) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return vscode.Uri.joinPath(workspaceFolders[0].uri, webpackMatch[1]).fsPath;
    }
  }

  // Handle absolute paths
  if (sourcePath.startsWith('/')) return sourcePath;

  // Handle relative paths
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return vscode.Uri.joinPath(workspaceFolders[0].uri, sourcePath).fsPath;
  }

  return null;
}
