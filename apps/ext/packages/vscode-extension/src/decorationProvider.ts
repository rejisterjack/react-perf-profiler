/**
 * Inline decoration provider — renders render count badges next to component
 * function declarations in the editor.
 */

import * as vscode from 'vscode';
import type { ComponentPerfData } from './types';

export class DecorationProvider {
  private renderCountDecoration = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 8px',
    },
  });

  private componentData: Record<string, ComponentPerfData> = {};

  updateData(data: Record<string, ComponentPerfData>): void {
    this.componentData = data;
    this.refresh();
  }

  refresh(): void {
    const config = vscode.workspace.getConfiguration('reactPerf');
    if (!config.get<boolean>('showInlineDecorations')) return;

    const maxGreen = config.get<number>('maxRenderCountForGreen', 5);
    const maxYellow = config.get<number>('maxRenderCountForYellow', 20);

    for (const editor of vscode.window.visibleTextEditors) {
      const decorations: vscode.DecorationOptions[] = [];
      const text = editor.document.getText();

      for (const [name, perfData] of Object.entries(this.componentData)) {
        const patterns = [
          new RegExp(`(?:function\\s+${escapeRegex(name)}\\s*\\(|const\\s+${escapeRegex(name)}\\s*=|export\\s+default\\s+function\\s+${escapeRegex(name)})`, 'g'),
        ];

        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const line = editor.document.positionAt(match.index).line;
            const range = new vscode.Range(line, 0, line, 0);

            const color = perfData.renderCount <= maxGreen ? 'green'
              : perfData.renderCount <= maxYellow ? '#e5c07b' : '#e06c75';

            const issuesSuffix = perfData.issues.length > 0
              ? ` (${perfData.issues.length} issue${perfData.issues.length !== 1 ? 's' : ''})`
              : '';

            const suffix = `${perfData.renderCount} renders${issuesSuffix}`;

            decorations.push({
              range,
              renderOptions: {
                after: {
                  contentText: suffix,
                  color,
                  fontStyle: 'italic',
                },
              },
            });
          }
        }
      }

      editor.setDecorations(this.renderCountDecoration, decorations);
    }
  }

  dispose(): void {
    this.renderCountDecoration.dispose();
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
