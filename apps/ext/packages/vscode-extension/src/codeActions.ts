/**
 * Code actions — quick fixes for common React performance issues.
 */

import * as vscode from 'vscode';

export class PerfCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== 'react-perf') continue;

      const componentName = extractComponentName(diag.message);
      if (!componentName) continue;

      if (diag.code === 'wasted-render' || diag.code === 'budget-violation') {
        const memoAction = new vscode.CodeAction(
          `Wrap ${componentName} with React.memo`,
          vscode.CodeActionKind.QuickFix,
        );
        memoAction.diagnostics = [diag];
        memoAction.command = {
          command: 'reactPerf.wrapWithMemo',
          title: 'Wrap with React.memo',
          arguments: [document, range, componentName],
        };
        actions.push(memoAction);

        const viewAction = new vscode.CodeAction(
          'View Performance Report',
          vscode.CodeActionKind.QuickFix,
        );
        viewAction.diagnostics = [diag];
        viewAction.command = {
          command: 'reactPerf.showReport',
          title: 'View Performance Report',
        };
        actions.push(viewAction);
      }
    }

    return actions;
  }
}

function extractComponentName(message: string): string | null {
  const match = message.match(/\[React Perf\]\s+(\w+)/);
  return match?.[1] ?? null;
}

export function registerCodeActions(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: 'file', pattern: '**/*.{tsx,jsx,ts,js}' },
      new PerfCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'reactPerf.wrapWithMemo',
      async (document: vscode.TextDocument, _range: vscode.Range, componentName: string) => {
        const text = document.getText();
        const edit = new vscode.WorkspaceEdit();

        const funcPattern = new RegExp(
          `(export\\s+default\\s+)?function\\s+${escapeRegex(componentName)}\\s*\\(`,
        );
        const match = funcPattern.exec(text);

        if (match?.index !== undefined) {
          const line = document.positionAt(match.index).line;
          const newLine = `${match[1] ?? ''}const ${componentName} = React.memo(function ${componentName}(`;

          edit.replace(
            document.uri,
            new vscode.Range(line, 0, line, match[0].length),
            newLine,
          );

          const closingBrace = findMatchingBrace(text, match.index);
          if (closingBrace !== null) {
            const closingPos = document.positionAt(closingBrace + 1);
            edit.insert(document.uri, closingPos, ');');
          }

          await vscode.workspace.applyEdit(edit);
        }
      },
    ),
  );
}

function findMatchingBrace(text: string, startIndex: number): number | null {
  let depth = 0;
  let foundOpen = false;
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === '{') {
      depth++;
      foundOpen = true;
    } else if (text[i] === '}') {
      depth--;
      if (foundOpen && depth === 0) return i;
    }
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
