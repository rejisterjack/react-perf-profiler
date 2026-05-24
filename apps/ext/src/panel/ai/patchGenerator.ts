/**
 * Generate unified diff patches from AI suggestions.
 * Produces copy-ready patches for common React optimization patterns.
 */

import type { AISuggestion } from './types';

interface PatchContext {
  fileName: string;
  lineNumber?: number;
}

export function generatePatch(suggestion: AISuggestion, context: PatchContext): string {
  const { category, codeExample } = suggestion;
  const file = context.fileName || 'unknown.tsx';

  // If the AI already provided a code example with before/after, use it directly
  if (codeExample && codeExample.includes('/* before */') && codeExample.includes('/* after */')) {
    return formatCodeExampleAsDiff(codeExample, file);
  }

  // Otherwise, generate a pattern-based patch from the category
  switch (category) {
    case 'memoization':
      return generateMemoPatch(suggestion, file);
    case 'prop-optimization':
    case 'useCallback':
      return generateUseCallbackPatch(suggestion, file);
    case 'useMemo':
      return generateUseMemoPatch(suggestion, file);
    case 'state-colocation':
      return generateStateColocationPatch(suggestion, file);
    case 'context-optimization':
      return generateContextSplitPatch(suggestion, file);
    case 'lazy-loading':
      return generateLazyLoadPatch(suggestion, file);
    default:
      return generateGenericPatch(suggestion, file);
  }
}

function formatCodeExampleAsDiff(codeExample: string, file: string): string {
  const beforeMatch = codeExample.match(/\/\*\s*before\s*\*\/([\s\S]*?)\/\*\s*after\s*\*\//);
  const afterMatch = codeExample.match(/\/\*\s*after\s*\*\/([\s\S]*)/);

  const before = beforeMatch?.[1]?.trim() ?? '';
  const after = afterMatch?.[1]?.trim() ?? '';

  if (!before || !after) return `--- a/${file}\n+++ b/${file}\n${codeExample}`;

  return `--- a/${file}\n+++ b/${file}\n${formatHunk(before.split('\n'), after.split('\n'))}`;
}

function formatHunk(beforeLines: string[], afterLines: string[]): string {
  const lines: string[] = [`@@ -1,${beforeLines.length} +1,${afterLines.length} @@`];
  for (const line of beforeLines) lines.push(`-${line}`);
  for (const line of afterLines) lines.push(`+${line}`);
  return lines.join('\n');
}

function generateMemoPatch(suggestion: AISuggestion, file: string): string {
  const name = suggestion.componentName;
  const before = [
    `function ${name}(props: ${name}Props) {`,
    `  // component body`,
    `}`,
    `export default ${name};`,
  ];
  const after = [
    `const ${name} = React.memo(function ${name}(props: ${name}Props) {`,
    `  // component body`,
    `});`,
    `export default ${name};`,
  ];
  return `--- a/${file}\n+++ b/${file}\n${formatHunk(before, after)}`;
}

function generateUseCallbackPatch(suggestion: AISuggestion, file: string): string {
  const before = [
    `  const handleClick = () => {`,
    `    // handler logic`,
    `  };`,
  ];
  const after = [
    `  const handleClick = useCallback(() => {`,
    `    // handler logic`,
    `  }, [/* deps */]);`,
  ];
  return `--- a/${file}\n+++ b/${file}\n${formatHunk(before, after)}`;
}

function generateUseMemoPatch(suggestion: AISuggestion, file: string): string {
  const before = [
    `  const computed = expensiveCalc(a, b);`,
  ];
  const after = [
    `  const computed = useMemo(() => expensiveCalc(a, b), [a, b]);`,
  ];
  return `--- a/${file}\n+++ b/${file}\n${formatHunk(before, after)}`;
}

function generateStateColocationPatch(suggestion: AISuggestion, file: string): string {
  return `--- a/${file}\n+++ b/${file}\n@@ -1,3 +1,8 @@\n-suggestion: ${suggestion.suggestion}\n+Move state closer to where it's consumed:\n+1. Identify the state variable\n+2. Find the deepest component that reads it\n+3. Lift state down to that component\n+\n+${suggestion.codeExample || '// See code example above'}`;
}

function generateContextSplitPatch(suggestion: AISuggestion, file: string): string {
  return `--- a/${file}\n+++ b/${file}\n@@ -1,3 +1,8 @@\n-suggestion: ${suggestion.suggestion}\n+Split context to reduce re-render scope:\n+1. Create separate contexts for different data slices\n+2. Each provider wraps only consumers that need that data\n+3. Use selectors for derived state\n+\n+${suggestion.codeExample || '// See code example above'}`;
}

function generateLazyLoadPatch(suggestion: AISuggestion, file: string): string {
  const name = suggestion.componentName;
  const before = [`import ${name} from './${name}';`];
  const after = [`const ${name} = React.lazy(() => import('./${name}'));`];
  return `--- a/${file}\n+++ b/${file}\n${formatHunk(before, after)}`;
}

function generateGenericPatch(suggestion: AISuggestion, file: string): string {
  return `--- a/${file}\n+++ b/${file}\n@@ component: ${suggestion.componentName} @@\n-Issue: ${suggestion.issue}\n+Fix: ${suggestion.suggestion}\n+\n+${suggestion.codeExample || ''}`;
}
