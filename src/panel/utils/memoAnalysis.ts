/**
 * Memoization effectiveness analysis
 * Detects prop stability issues and evaluates memoization strategies
 */

import type { CommitData, FiberData } from '../../content/types';

/** Snapshot of a prop value at a specific time */
export interface PropValueSnapshot {
  /** String representation of value for comparison */
  value: any;
  /** Reference for identity comparison */
  reference: any;
  /** Timestamp of the snapshot */
  timestamp: number;
}

/** Analysis of a single prop's stability */
export interface PropStability {
  /** Prop name */
  name: string;
  /** Detected type of the prop */
  type: 'function' | 'object' | 'array' | 'primitive' | 'unknown';
  /** Whether the reference is stable across renders */
  isStable: boolean;
  /** Frequency of changes (0-1, where 0 = never changes, 1 = changes every render) */
  changeFrequency: number;
  /** Whether the prop is already memoized (useCallback/useMemo) */
  isMemoized: boolean;
  /** History of value snapshots */
  history: PropValueSnapshot[];
}

/** Types of memoization issues */
export type MemoIssueType =
  | 'unstable-callback'
  | 'unstable-object'
  | 'unstable-array'
  | 'inline-function'
  | 'inline-object'
  | 'inline-array'
  | 'missing-memo';

/** Identified memoization issue */
export interface MemoIssue {
  /** Type of issue */
  type: MemoIssueType;
  /** Name of the problematic prop */
  propName: string;
  /** Human-readable description */
  description: string;
  /** Suggested fix */
  suggestion: string;
  /** Estimated impact (0-1) */
  impact: number;
}

/** Metrics for a single component */
export interface ComponentMetrics {
  /** Component display name */
  componentName: string;
  /** Whether component is wrapped in React.memo */
  isMemoized: boolean;
  /** Current memo hit rate (0-1) */
  memoHitRate: number;
  /** Total renders */
  renderCount: number;
  /** Props that changed each render (for analysis) */
  propChanges: Map<string, number>;
  /** Average render duration */
  averageRenderDuration: number;
}

/** Report on memoization effectiveness */
export interface MemoEffectivenessReport {
  /** Component name */
  componentName: string;
  /** Whether component uses React.memo */
  hasMemo: boolean;
  /** Current memo hit rate (0-1) */
  currentHitRate: number;
  /** Optimal achievable hit rate (0-1) */
  optimalHitRate: number;
  /** Whether current memo strategy is effective */
  isEffective: boolean;
  /** Identified issues */
  issues: MemoIssue[];
  /** Prop stability analysis */
  propStability: PropStability[];
  /** Recommendations */
  recommendations: string[];
}

/** Configuration for memo analysis */
export interface MemoAnalysisConfig {
  /** Minimum renders to consider for analysis */
  minRenders?: number;
  /** Threshold for considering a prop unstable (0-1) */
  stabilityThreshold?: number;
  /** Hit rate threshold for considering memo effective (0-1) */
  effectivenessThreshold?: number;
}

/**
 * Analyzes prop stability across commits
 * Tracks how often each prop changes and whether it's properly memoized
 * 
 * @param componentName - Name of component to analyze
 * @param commits - Array of commit data
 * @returns Array of prop stability analyses
 */
export function analyzePropStability(
  componentName: string,
  commits: CommitData[]
): PropStability[] {
  if (!commits || commits.length < 2) {
    return [];
  }

  // Collect all prop snapshots for this component
  const propHistoryMap = new Map<string, PropValueSnapshot[]>();

  for (const commit of commits) {
    for (const fiber of commit.fibers) {
      if (fiber.displayName !== componentName) continue;

      const timestamp = commit.timestamp;
      const props = fiber.memoizedProps || {};

      for (const [key, value] of Object.entries(props)) {
        let history = propHistoryMap.get(key);
        if (!history) {
          history = [];
          propHistoryMap.set(key, history);
        }

        history.push({
          value: serializeValue(value),
          reference: value,
          timestamp,
        });
      }
    }
  }

  // Analyze stability for each prop
  const results: PropStability[] = [];
  propHistoryMap.forEach((history, name) => {
    if (history.length < 2) return;

    const type = detectPropType(history[0]?.reference);
    const changeFrequency = calculateChangeFrequency(history);
    const isStable = changeFrequency < 0.1;
    const isMemoized = detectMemoization(history);

    results.push({
      name,
      type,
      isStable,
      changeFrequency,
      isMemoized,
      history: history.slice(-100), // Keep last 100 for memory efficiency
    });
  });

  return results;
}

/**
 * Detects if a prop is properly memoized
 * Checks for reference stability patterns characteristic of useCallback/useMemo
 * 
 * @param history - Array of prop value snapshots
 * @returns True if the prop appears to be memoized
 */
export function detectMemoization(history: PropValueSnapshot[]): boolean {
  if (history.length < 3) return false;

  // Check for stable reference pattern
  let stableCount = 0;
  let totalComparisons = 0;

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];

    // Skip if values are different (memoization wouldn't help)
    if (prev.value !== curr.value) continue;

    totalComparisons++;
    if (prev.reference === curr.reference) {
      stableCount++;
    }
  }

  // Consider memoized if references are stable when values are equal
  return totalComparisons > 0 && stableCount / totalComparisons > 0.8;
}

/**
 * Calculates the optimal memo hit rate achievable
 * 
 * @param currentMetrics - Current component metrics
 * @param issues - Identified memoization issues
 * @returns Optimal hit rate (0-1)
 */
export function calculateOptimalHitRate(
  currentMetrics: ComponentMetrics,
  issues: MemoIssue[]
): number {
  if (!currentMetrics.isMemoized) {
    // If not memoized, optimal rate depends on how many renders could be avoided
    return Math.min(0.9, 1 - (issues.length * 0.15));
  }

  // Calculate potential improvement from fixing issues
  const fixableImpact = issues
    .filter(i => i.impact > 0.3)
    .reduce((sum, i) => sum + i.impact, 0);

  const optimalRate = Math.min(
    0.95,
    currentMetrics.memoHitRate + fixableImpact * 0.5
  );

  return optimalRate;
}

/**
 * Main memoization effectiveness analysis function
 * Analyzes all components in the commit history
 * 
 * @param commits - Array of commit data
 * @param componentMetrics - Metrics for each component
 * @param config - Optional analysis configuration
 * @returns Array of effectiveness reports
 */
export function analyzeMemoEffectiveness(
  commits: CommitData[],
  componentMetrics: ComponentMetrics[],
  config: MemoAnalysisConfig = {}
): MemoEffectivenessReport[] {
  const {
    minRenders = 3,
    effectivenessThreshold = 0.7,
    stabilityThreshold = 0.2,
  } = config;

  if (!commits || commits.length === 0 || componentMetrics.length === 0) {
    return [];
  }

  const reports: MemoEffectivenessReport[] = [];

  for (const metrics of componentMetrics) {
    // Skip components with too few renders
    if (metrics.renderCount < minRenders) continue;

    // Analyze prop stability
    const propStability = analyzePropStability(metrics.componentName, commits);

    // Detect issues
    const issues = detectMemoIssues(propStability, metrics, stabilityThreshold);

    // Calculate optimal hit rate
    const optimalHitRate = calculateOptimalHitRate(metrics, issues);

    // Determine if current strategy is effective
    const isEffective = metrics.isMemoized
      ? metrics.memoHitRate >= effectivenessThreshold
      : issues.length === 0;

    // Generate recommendations
    const recommendations = generateMemoRecommendations(issues, metrics);

    reports.push({
      componentName: metrics.componentName,
      hasMemo: metrics.isMemoized,
      currentHitRate: metrics.memoHitRate,
      optimalHitRate,
      isEffective,
      issues,
      propStability,
      recommendations,
    });
  }

  // Sort by effectiveness gap (optimal - current)
  return reports.sort((a, b) => {
    const gapA = a.optimalHitRate - a.currentHitRate;
    const gapB = b.optimalHitRate - b.currentHitRate;
    return gapB - gapA;
  });
}

/**
 * Detects memoization issues from prop stability analysis
 */
function detectMemoIssues(
  propStability: PropStability[],
  metrics: ComponentMetrics,
  stabilityThreshold: number
): MemoIssue[] {
  const issues: MemoIssue[] = [];

  for (const prop of propStability) {
    // Skip stable props
    if (prop.changeFrequency < stabilityThreshold) continue;

    const baseImpact = prop.changeFrequency;

    switch (prop.type) {
      case 'function':
        if (!prop.isMemoized) {
          issues.push({
            type: 'unstable-callback',
            propName: prop.name,
            description: `Function prop "${prop.name}" is recreated every render`,
            suggestion: `Wrap ${prop.name} with useCallback() and specify stable dependencies`,
            impact: baseImpact,
          });
        }
        break;

      case 'object':
        if (!prop.isMemoized) {
          issues.push({
            type: 'unstable-object',
            propName: prop.name,
            description: `Object prop "${prop.name}" has unstable reference`,
            suggestion: `Use useMemo() for ${prop.name} or extract to constant outside component`,
            impact: baseImpact * 0.8,
          });
        }
        break;

      case 'array':
        if (!prop.isMemoized) {
          issues.push({
            type: 'unstable-array',
            propName: prop.name,
            description: `Array prop "${prop.name}" is recreated every render`,
            suggestion: `Use useMemo() for ${prop.name} with proper dependencies`,
            impact: baseImpact * 0.8,
          });
        }
        break;
    }
  }

  // Check if component should have memo
  const hasUnstableProps = issues.length > 0;
  const hasManyRenders = metrics.renderCount > 10;
  const lowHitRate = metrics.memoHitRate < 0.3;

  if (!metrics.isMemoized && hasUnstableProps && hasManyRenders) {
    issues.push({
      type: 'missing-memo',
      propName: 'component',
      description: `Component renders frequently with ${issues.length} unstable props`,
      suggestion: 'Wrap component with React.memo() after stabilizing props',
      impact: 0.9,
    });
  }

  // Sort by impact
  return issues.sort((a, b) => b.impact - a.impact);
}

/**
 * Generates specific recommendations based on identified issues
 * 
 * @param issues - Identified memoization issues
 * @param component - Component metrics
 * @returns Array of recommendation strings
 */
export function generateMemoRecommendations(
  issues: MemoIssue[],
  component: ComponentMetrics
): string[] {
  const recommendations: string[] = [];

  if (issues.length === 0) {
    if (component.isMemoized) {
      recommendations.push('Memoization strategy is effective. No changes needed.');
    } else if (component.renderCount < 10) {
      recommendations.push('Low render count - memoization not yet necessary.');
    }
    return recommendations;
  }

  // Group issues by type
  const callbackIssues = issues.filter(i => i.type === 'unstable-callback');
  const objectIssues = issues.filter(i => i.type === 'unstable-object' || i.type === 'inline-object');
  const arrayIssues = issues.filter(i => i.type === 'unstable-array' || i.type === 'inline-array');
  const missingMemo = issues.find(i => i.type === 'missing-memo');

  // Generate recommendations
  if (callbackIssues.length > 0) {
    const props = callbackIssues.map(i => i.propName).join(', ');
    recommendations.push(
      `Wrap callback props (${props}) with useCallback() using stable dependencies`
    );
  }

  if (objectIssues.length > 0) {
    const props = objectIssues.map(i => i.propName).join(', ');
    recommendations.push(
      `Memoize object props (${props}) with useMemo() or extract to module scope`
    );
  }

  if (arrayIssues.length > 0) {
    const props = arrayIssues.map(i => i.propName).join(', ');
    recommendations.push(
      `Memoize array props (${props}) with useMemo() to maintain reference stability`
    );
  }

  if (missingMemo || !component.isMemoized) {
    recommendations.push(
      `Wrap ${component.componentName} with React.memo() to prevent unnecessary re-renders`
    );
  }

  // Add performance estimate
  const potentialImprovement = Math.round((component.memoHitRate - issues.length * 0.15) * 100);
  if (potentialImprovement > 30) {
    recommendations.push(
      `Expected improvement: ~${potentialImprovement}% reduction in renders`
    );
  }

  return recommendations;
}

/**
 * Serializes a value for comparison
 * Returns a string representation for object/array comparison
 */
function serializeValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return `fn:${value.name || 'anonymous'}`;
  if (typeof value === 'object') {
    // For objects/arrays, we can't reliably serialize without performance cost
    // Use a hash of keys for objects, length for arrays
    if (Array.isArray(value)) return `arr:${value.length}`;
    return `obj:${Object.keys(value).sort().join(',')}`;
  }
  return String(value);
}

/**
 * Detects the type of a prop value
 */
function detectPropType(value: any): PropStability['type'] {
  if (value === null || value === undefined) return 'primitive';
  if (typeof value === 'function') return 'function';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (['string', 'number', 'boolean', 'bigint', 'symbol'].includes(typeof value)) {
    return 'primitive';
  }
  return 'unknown';
}

/**
 * Calculates how frequently a prop changes
 */
function calculateChangeFrequency(history: PropValueSnapshot[]): number {
  if (history.length < 2) return 0;

  let changes = 0;
  for (let i = 1; i < history.length; i++) {
    if (history[i].value !== history[i - 1].value) {
      changes++;
    }
  }

  return changes / (history.length - 1);
}
