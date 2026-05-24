/**
 * Memoization effectiveness analysis.
 * Examines memoized components (tag 14 = MemoComponent, tag 15 = SimpleMemoComponent)
 * and determines if memoization is working effectively.
 *
 * Pure analysis — zero browser dependencies.
 */

import type {
  CommitData,
  FiberData,
  MemoIssue,
  MemoRecommendation,
  MemoReport,
  Severity,
} from './types.js';
import { shallowEqual } from './shallowEqual.js';

/** Track render history per memoized component */
interface MemoComponentRecord {
  displayName: string;
  totalRenders: number;
  /** Renders where props were equal to previous (memo "hit") */
  memoHits: number;
  /** Renders where props changed (legitimate re-render) */
  memoMisses: number;
  /** Sequence of props for issue detection */
  propsHistory: Record<string, unknown>[];
  issues: MemoIssue[];
}

const MEMO_TAGS = new Set([14, 15]); // MemoComponent, SimpleMemoComponent

function collectMemoFibers(fiber: FiberData | null | undefined, out: FiberData[]): void {
  if (!fiber) return;
  if (MEMO_TAGS.has(fiber.tag) && fiber.displayName) {
    out.push(fiber);
  }
  if (fiber.child) collectMemoFibers(fiber.child, out);
  if (fiber.sibling) collectMemoFibers(fiber.sibling, out);
}

function classifyIssueSeverity(missRate: number): Severity {
  if (missRate > 0.7) return 'critical';
  if (missRate > 0.5) return 'high';
  if (missRate > 0.3) return 'medium';
  return 'low';
}

/**
 * Detect unstable prop patterns that defeat memoization.
 */
function detectUnstableProps(
  propsHistory: Record<string, unknown>[],
): MemoIssue[] {
  if (propsHistory.length < 2) return [];

  const issues: MemoIssue[] = [];

  // Get all prop keys from the first entry
  const propKeys = Object.keys(propsHistory[0]);

  for (const key of propKeys) {
    const values = propsHistory.map((p) => p[key]);

    // Check for unstable callbacks: function props that change reference every render
    const functionValues = values.filter((v) => typeof v === 'function');
    if (functionValues.length >= 2) {
      // Functions are always !== across renders (no stable reference)
      let allDifferent = true;
      for (let i = 1; i < functionValues.length; i++) {
        if (functionValues[i] === functionValues[i - 1]) {
          allDifferent = false;
          break;
        }
      }
      if (allDifferent) {
        issues.push({
          type: 'unstable-callback',
          propName: key,
          description: `Prop "${key}" is an unstable function reference that changes every render, defeating memoization.`,
          suggestion: `Wrap the callback with useCallback() to maintain a stable reference.`,
          severity: 'high',
        });
        continue; // Skip further checks for this prop
      }
    }

    // Check for unstable objects: object props with same content but different reference
    const objectValues = values.filter(
      (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    );
    if (objectValues.length >= 2) {
      let allShallowEqual = true;
      for (let i = 1; i < objectValues.length; i++) {
        if (
          !shallowEqual(
            objectValues[i] as Record<string, unknown>,
            objectValues[i - 1] as Record<string, unknown>,
          )
        ) {
          allShallowEqual = false;
          break;
        }
      }
      if (allShallowEqual) {
        issues.push({
          type: 'unstable-object',
          propName: key,
          description: `Prop "${key}" is an object with stable content but a new reference each render, defeating memoization.`,
          suggestion: `Wrap the object with useMemo() to maintain a stable reference.`,
          severity: 'high',
        });
        continue;
      }
    }

    // Check for unstable arrays
    const arrayValues = values.filter((v) => Array.isArray(v));
    if (arrayValues.length >= 2) {
      // If all arrays have the same length and shallow-equal elements
      const first = arrayValues[0] as unknown[];
      let allSame = true;
      for (let i = 1; i < arrayValues.length; i++) {
        const arr = arrayValues[i] as unknown[];
        if (arr.length !== first.length) {
          allSame = false;
          break;
        }
        for (let j = 0; j < arr.length; j++) {
          if (arr[j] !== first[j]) {
            allSame = false;
            break;
          }
        }
        if (!allSame) break;
      }
      if (allSame && first.length > 0) {
        issues.push({
          type: 'unstable-array',
          propName: key,
          description: `Prop "${key}" is an array with stable content but a new reference each render, defeating memoization.`,
          suggestion: `Wrap the array with useMemo() to maintain a stable reference.`,
          severity: 'medium',
        });
      }
    }
  }

  return issues;
}

function buildRecommendations(
  issues: MemoIssue[],
  componentName: string,
): MemoRecommendation[] {
  const recommendations: MemoRecommendation[] = [];
  const seen = new Set<string>();

  for (const issue of issues) {
    if (seen.has(issue.type)) continue;
    seen.add(issue.type);

    switch (issue.type) {
      case 'unstable-callback':
        recommendations.push({
          type: 'useCallback',
          description: `Stabilize the "${issue.propName}" callback passed to ${componentName}.`,
          codeExample: `const ${issue.propName} = useCallback((...args) => {\n  // handler body\n}, [/* dependencies */]);`,
        });
        break;
      case 'unstable-object':
        recommendations.push({
          type: 'useMemo',
          description: `Stabilize the "${issue.propName}" object passed to ${componentName}.`,
          codeExample: `const ${issue.propName} = useMemo(() => ({\n  // object properties\n}), [/* dependencies */]);`,
        });
        break;
      case 'unstable-array':
        recommendations.push({
          type: 'useMemo',
          description: `Stabilize the "${issue.propName}" array passed to ${componentName}.`,
          codeExample: `const ${issue.propName} = useMemo(() => [\n  // array elements\n], [/* dependencies */]);`,
        });
        break;
    }
  }

  // If no issues but memo is ineffective, suggest deeper analysis
  if (issues.length === 0) {
    recommendations.push({
      type: 'React.memo',
      description: `Consider adding a custom comparison function to ${componentName}'s React.memo() wrapper for deep prop comparison.`,
      codeExample: `const ${componentName} = React.memo(\n  ${componentName}Impl,\n  (prevProps, nextProps) => {\n    // Return true if props are equal\n    return prevProps.id === nextProps.id;\n  }\n);`,
    });
  }

  return recommendations;
}

export function analyzeMemoization(commits: CommitData[]): MemoReport[] {
  if (commits.length === 0) return [];

  const records = new Map<string, MemoComponentRecord>();

  for (const commit of commits) {
    const fibers: FiberData[] = [];
    if (commit.fibers) {
      fibers.push(...commit.fibers);
    }
    if (commit.rootFiber) {
      collectMemoFibers(commit.rootFiber, fibers);
    }

    // Filter to memoized components only
    const memoFibers = fibers.filter((f) => MEMO_TAGS.has(f.tag) && f.displayName);

    for (const fiber of memoFibers) {
      const key = fiber.displayName!;
      let record = records.get(key);

      if (!record) {
        record = {
          displayName: key,
          totalRenders: 0,
          memoHits: 0,
          memoMisses: 0,
          propsHistory: [],
          issues: [],
        };
        records.set(key, record);
      }

      const currentProps = fiber.memoizedProps ?? {};
      record.totalRenders += 1;

      // Compare with previous props
      if (record.propsHistory.length > 0) {
        const prevProps = record.propsHistory[record.propsHistory.length - 1];
        if (shallowEqual(prevProps, currentProps)) {
          // Props are the same but component still rendered — memo is NOT working
          record.memoMisses += 1;
        } else {
          // Props changed, render was legitimate
          record.memoMisses += 1;
        }
      } else {
        // First render — always a "miss" since there's nothing to compare against
        record.memoMisses += 1;
      }

      record.propsHistory.push({ ...currentProps });

      // Limit props history to last 20 entries to manage memory
      if (record.propsHistory.length > 20) {
        record.propsHistory = record.propsHistory.slice(-20);
      }
    }
  }

  // Build reports
  const reports: MemoReport[] = [];

  for (const record of records.values()) {
    const rendersAfterFirst = record.totalRenders - 1;
    let samePropRenders = 0;

    for (let i = 1; i < record.propsHistory.length; i++) {
      if (shallowEqual(record.propsHistory[i - 1], record.propsHistory[i])) {
        samePropRenders += 1;
      }
    }

    const ineffectiveRate = rendersAfterFirst > 0 ? samePropRenders / rendersAfterFirst : 0;
    const currentHitRate = Math.round((1 - ineffectiveRate) * 1000) / 10;
    const isEffective = currentHitRate > 70;

    // Detect unstable props
    const unstableIssues = detectUnstableProps(record.propsHistory);

    // Assign severity
    const missRate = 100 - currentHitRate;
    for (const issue of unstableIssues) {
      issue.severity = classifyIssueSeverity(missRate / 100);
    }

    const recommendations = buildRecommendations(unstableIssues, record.displayName);

    reports.push({
      componentName: record.displayName,
      hasMemo: true,
      currentHitRate,
      optimalHitRate: 95, // Ideal target
      isEffective,
      issues: unstableIssues,
      recommendations,
    });
  }

  // Sort: ineffective first, then by hit rate ascending
  reports.sort((a, b) => {
    if (a.isEffective !== b.isEffective) return a.isEffective ? 1 : -1;
    return a.currentHitRate - b.currentHitRate;
  });

  return reports;
}
