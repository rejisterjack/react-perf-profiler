/**
 * AI-Powered Optimization Suggestions Generator
 * Generates specific, copy-paste-ready code fixes for detected performance issues
 * @module panel/utils/aiOptimizationGenerator
 */

import type { WastedRenderReport, WastedRenderReason } from './wastedRenderAnalysis';
import type { MemoEffectivenessReport, MemoIssue } from './memoAnalysis';

/**
 * Generated optimization suggestion with code fix
 */
export interface AIOptimizationSuggestion {
  /** Unique ID for the suggestion */
  id: string;
  /** Component name */
  componentName: string;
  /** Type of optimization */
  type: 'memo' | 'useMemo' | 'useCallback' | 'split-props' | 'colocate-state' | 'fix-deps';
  /** Severity level */
  severity: 'critical' | 'warning' | 'info';
  /** Human-readable description */
  description: string;
  /** Detailed explanation of the issue */
  explanation: string;
  /** Current problematic code */
  currentCode: string;
  /** Suggested fixed code */
  suggestedCode: string;
  /** Estimated performance improvement */
  estimatedImprovement: string;
  /** Whether the suggestion has been applied */
  applied: boolean;
}

/**
 * Context for generating suggestions
 */
interface SuggestionContext {
  componentName: string;
  issue?: MemoIssue;
  reason?: WastedRenderReason;
  report: WastedRenderReport | MemoEffectivenessReport;
  props?: string[];
  hooks?: string[];
}

/**
 * Generate memo wrapper suggestion for components with parent-render issues
 */
function generateMemoSuggestion(context: SuggestionContext): AIOptimizationSuggestion {
  const { componentName, report } = context;
  const wastedRate = (report as WastedRenderReport).wastedRenderRate || 0.5;

  return {
    id: `memo-${componentName}-${Date.now()}`,
    componentName,
    type: 'memo',
    severity: wastedRate > 0.5 ? 'critical' : 'warning',
    description: `Wrap ${componentName} with React.memo()`,
    explanation: `This component re-renders ${Math.round(wastedRate * 100)}% of the time without props changing. React.memo() will prevent unnecessary re-renders when props are equal.`,
    currentCode: `function ${componentName}(props) {
  return (
    <div>
      {/* component JSX */}
    </div>
  );
}`,
    suggestedCode: `import { memo } from 'react';

const ${componentName} = memo(function ${componentName}(props) {
  return (
    <div>
      {/* component JSX */}
    </div>
  );
});

export default ${componentName};`,
    estimatedImprovement: `~${Math.round(wastedRate * 100)}% reduction in renders`,
    applied: false,
  };
}

/**
 * Generate useCallback suggestion for inline function props
 */
function generateUseCallbackSuggestion(
  context: SuggestionContext,
  functionName: string = 'handleClick'
): AIOptimizationSuggestion {
  const { componentName } = context;

  return {
    id: `usecallback-${componentName}-${Date.now()}`,
    componentName,
    type: 'useCallback',
    severity: 'warning',
    description: `Memoize ${functionName} with useCallback()`,
    explanation: `Inline functions are recreated on every render, causing child components to re-render. useCallback() memoizes the function reference.`,
    currentCode: `function ${componentName}() {
  return (
    <ChildComponent
      onClick={() => handleSomething()}
    />
  );
}`,
    suggestedCode: `import { useCallback } from 'react';

function ${componentName}() {
  const ${functionName} = useCallback(() => {
    handleSomething();
  }, []); // Add dependencies if needed

  return (
    <ChildComponent
      onClick={${functionName}}
    />
  );
}`,
    estimatedImprovement: 'Prevents child re-renders',
    applied: false,
  };
}

/**
 * Generate useMemo suggestion for inline objects/arrays
 */
function generateUseMemoSuggestion(
  context: SuggestionContext,
  valueName: string = 'config'
): AIOptimizationSuggestion {
  const { componentName } = context;

  return {
    id: `usememo-${componentName}-${Date.now()}`,
    componentName,
    type: 'useMemo',
    severity: 'warning',
    description: `Memoize ${valueName} object with useMemo()`,
    explanation: `Inline objects are recreated on every render with a new reference, breaking memo comparisons. useMemo() preserves the reference when dependencies haven't changed.`,
    currentCode: `function ${componentName}() {
  return (
    <ChildComponent
      config={{ key: 'value', option: true }}
    />
  );
}`,
    suggestedCode: `import { useMemo } from 'react';

function ${componentName}() {
  const ${valueName} = useMemo(() => ({
    key: 'value',
    option: true
  }), []); // Add dependencies if values change

  return (
    <ChildComponent
      config={${valueName}}
    />
  );
}`,
    estimatedImprovement: 'Prevents unnecessary re-renders',
    applied: false,
  };
}

/**
 * Generate colocate state suggestion
 */
function generateColocateStateSuggestion(context: SuggestionContext): AIOptimizationSuggestion {
  const { componentName } = context;

  return {
    id: `colocate-${componentName}-${Date.now()}`,
    componentName,
    type: 'colocate-state',
    severity: 'info',
    description: 'Move state closer to where it is used',
    explanation: 'State in parent components causes all children to re-render. Moving state down the tree reduces render scope.',
    currentCode: `function ParentComponent() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <UnrelatedChild />
      <Counter count={count} setCount={setCount} />
    </div>
  );
}`,
    suggestedCode: `function ParentComponent() {
  return (
    <div>
      <UnrelatedChild />
      <Counter /> {/* State moved inside */}
    </div>
  );
}

function Counter() {
  const [count, setCount] = useState(0);
  // Component implementation...
}`,
    estimatedImprovement: 'Reduces parent re-render scope',
    applied: false,
  };
}

/**
 * Map wasted render reasons to optimization suggestions
 */
function mapWastedRenderReasonToSuggestion(
  report: WastedRenderReport,
  reason: WastedRenderReason
): AIOptimizationSuggestion | null {
  const context: SuggestionContext = {
    componentName: report.componentName,
    reason,
    report,
  };

  switch (reason.type) {
    case 'parent-render':
      return generateMemoSuggestion(context);

    case 'context-change':
      return generateColocateStateSuggestion(context);

    case 'force-update':
      return null; // No automatic fix for force-update

    default:
      return null;
  }
}

/**
 * Map memo issues to optimization suggestions
 */
function mapMemoIssueToSuggestion(
  report: MemoEffectivenessReport,
  issue: MemoIssue
): AIOptimizationSuggestion | null {
  const context: SuggestionContext = {
    componentName: report.componentName,
    issue,
    report,
  };

  switch (issue.type) {
    case 'unstable-callback':
      return generateUseCallbackSuggestion(context, issue.propName);

    case 'unstable-object':
    case 'unstable-array':
    case 'inline-object':
    case 'inline-array':
      return generateUseMemoSuggestion(context, issue.propName);

    case 'inline-function':
      return generateUseCallbackSuggestion(context, issue.propName);

    case 'missing-memo':
      return generateMemoSuggestion(context);

    default:
      return null;
  }
}

/**
 * Generate AI-powered optimization suggestions from analysis results
 */
export function generateAIOptimizations(
  wastedRenderReports: WastedRenderReport[],
  memoReports: MemoEffectivenessReport[]
): AIOptimizationSuggestion[] {
  const suggestions: AIOptimizationSuggestion[] = [];
  const seenIds = new Set<string>();

  // Process wasted render reports
  for (const report of wastedRenderReports) {
    if (report.wastedRenderRate < 0.2) continue; // Skip low-impact issues

    // Handle reports with reasons array (from wastedRenderAnalysis)
    const reasons = (report as unknown as { reasons?: unknown[] }).reasons;
    if (reasons && Array.isArray(reasons)) {
      for (const reason of reasons) {
        const suggestion = mapWastedRenderReasonToSuggestion(
          report as unknown as import('./wastedRenderAnalysis').WastedRenderReport,
          reason as import('./wastedRenderAnalysis').WastedRenderReason
        );
        if (suggestion && !seenIds.has(suggestion.id)) {
          seenIds.add(suggestion.id);
          suggestions.push(suggestion);
        }
      }
    }

    // Generate memo suggestion for high wasted render rates
    const recommendations = (report as unknown as { recommendations?: string[] }).recommendations;
    const hasMemoRecommendation = recommendations?.some((r: string) => r.includes('memo'));
    if (report.wastedRenderRate > 0.4 && !hasMemoRecommendation) {
      const context: SuggestionContext = {
        componentName: report.componentName,
        report: report as unknown as import('./wastedRenderAnalysis').WastedRenderReport,
      };
      const memoSuggestion = generateMemoSuggestion(context);
      if (!seenIds.has(memoSuggestion.id)) {
        seenIds.add(memoSuggestion.id);
        suggestions.push(memoSuggestion);
      }
    }
  }

  // Process memo reports
  for (const report of memoReports) {
    if (report.isEffective) continue;

    for (const issue of report.issues) {
      const suggestion = mapMemoIssueToSuggestion(report, issue);
      if (suggestion && !seenIds.has(suggestion.id)) {
        seenIds.add(suggestion.id);
        suggestions.push(suggestion);
      }
    }
  }

  // Sort by severity (critical first)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  suggestions.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return suggestions;
}

/**
 * Format suggestion for display
 */
export function formatSuggestionForDisplay(
  suggestion: AIOptimizationSuggestion
): string {
  return `
## ${suggestion.description}

**Component:** \`${suggestion.componentName}\`
**Type:** ${suggestion.type}
**Severity:** ${suggestion.severity}
**Expected Improvement:** ${suggestion.estimatedImprovement}

### Explanation
${suggestion.explanation}

### Current Code
\`\`\`jsx
${suggestion.currentCode}
\`\`\`

### Suggested Fix
\`\`\`jsx
${suggestion.suggestedCode}
\`\`\`
`.trim();
}

/**
 * Apply a suggestion (mark as applied)
 */
export function applySuggestion(
  suggestion: AIOptimizationSuggestion
): AIOptimizationSuggestion {
  return {
    ...suggestion,
    applied: true,
  };
}

/**
 * Group suggestions by component
 */
export function groupSuggestionsByComponent(
  suggestions: AIOptimizationSuggestion[]
): Map<string, AIOptimizationSuggestion[]> {
  const grouped = new Map<string, AIOptimizationSuggestion[]>();

  for (const suggestion of suggestions) {
    const existing = grouped.get(suggestion.componentName) || [];
    existing.push(suggestion);
    grouped.set(suggestion.componentName, existing);
  }

  return grouped;
}

/**
 * Get top suggestions by impact
 */
export function getTopSuggestions(
  suggestions: AIOptimizationSuggestion[],
  limit: number = 5
): AIOptimizationSuggestion[] {
  const severityOrder = { critical: 0, warning: 1, info: 2 };

  return suggestions
    .filter((s) => !s.applied)
    .sort((a, b) => {
      // Sort by severity first
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by type (memo changes have higher impact)
      const typePriority: Record<string, number> = {
        memo: 0,
        'fix-deps': 1,
        useCallback: 2,
        useMemo: 3,
        'split-props': 4,
        'colocate-state': 5,
      };
      return (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
    })
    .slice(0, limit);
}

export default generateAIOptimizations;
