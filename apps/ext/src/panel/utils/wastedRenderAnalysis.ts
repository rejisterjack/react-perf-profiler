/**
 * Wasted render analysis — detects components that re-rendered
 * with unchanged props across commits, tracks which specific props
 * are the likely cause, and generates targeted fix suggestions.
 */

import type {
  CommitData,
  FiberData,
  Severity,
  WastedRenderIssue,
  WastedRenderReport,
} from '@/src/shared/types';
import { shallowEqual } from './shallowEqual';

interface ComponentRenderRecord {
  displayName: string;
  totalRenders: number;
  wastedRenders: number;
  totalDurationMs: number;
  wastedDurationMs: number;
  issues: WastedRenderIssue[];
  lastProps: Record<string, unknown> | null;
  identicalPropRenders: number;
  inlineFunctionCount: number;
  inlineObjectCount: number;
  /** Per-prop tracking: how many times each prop was identical across consecutive renders */
  propIdenticalCounts: Map<string, number>;
  /** Per-prop tracking: which props are inline functions */
  inlineFunctionProps: Set<string>;
  /** Per-prop tracking: which props are inline objects/arrays */
  inlineObjectProps: Set<string>;
  /** Props that changed between the last two renders */
  changedProps: string[];
}

function classifySeverity(rate: number): Severity {
  if (rate > 0.7) return 'critical';
  if (rate > 0.5) return 'high';
  if (rate > 0.3) return 'medium';
  return 'low';
}

function recommendAction(
  rate: number,
  inlineFunctionCount: number,
  inlineObjectCount: number,
): WastedRenderReport['recommendedAction'] {
  if (rate < 0.2) return 'none';
  if (inlineFunctionCount > 0) return 'useCallback';
  if (inlineObjectCount > 0) return 'useMemo';
  return 'memo';
}

function collectFibers(fiber: FiberData | null | undefined, out: FiberData[]): void {
  if (!fiber) return;
  out.push(fiber);
  if (fiber.child) collectFibers(fiber.child, out);
  if (fiber.sibling) collectFibers(fiber.sibling, out);
}

function detectInlineFunctionProps(props: Record<string, unknown>): string[] {
  const names: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') {
      const fn = value as (...args: unknown[]) => unknown;
      const name = fn.name || '';
      if (!name || name === 'anonymous' || name === '' || name.startsWith('(')) {
        names.push(key);
      }
    }
  }
  return names;
}

function detectInlineObjectProps(props: Record<string, unknown>): string[] {
  const names: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (value.constructor === Object || value.constructor === undefined) {
        names.push(key);
      }
    }
    if (Array.isArray(value)) {
      names.push(key);
    }
  }
  return names;
}

/** Find which specific props changed between two prop objects */
function diffProps(
  prev: Record<string, unknown>,
  curr: Record<string, unknown>,
): { changed: string[]; added: string[]; removed: string[] } {
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const key of Object.keys(curr)) {
    if (!(key in prev)) {
      added.push(key);
    } else if (!Object.is(prev[key], curr[key])) {
      changed.push(key);
    }
  }
  for (const key of Object.keys(prev)) {
    if (!(key in curr)) {
      removed.push(key);
    }
  }

  return { changed, added, removed };
}

/** Generate a prop-specific fix suggestion */
function buildPropSpecificSuggestion(
  propName: string,
  propType: 'function' | 'object' | 'array' | 'other',
): string {
  switch (propType) {
    case 'function':
      return `Wrap the "${propName}" prop with useCallback() in the parent component`;
    case 'object':
      return `Move the "${propName}" prop outside the render scope or wrap with useMemo()`;
    case 'array':
      return `Move the "${propName}" prop outside the render scope or wrap with useMemo()`;
    default:
      return `Stabilize the "${propName}" prop reference to prevent unnecessary re-renders`;
  }
}

function classifyPropType(value: unknown): 'function' | 'object' | 'array' | 'other' {
  if (typeof value === 'function') return 'function';
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'object';
  return 'other';
}

export function analyzeWastedRenders(commits: CommitData[]): WastedRenderReport[] {
  if (commits.length === 0) return [];

  const records = new Map<string, ComponentRenderRecord>();

  for (const commit of commits) {
    const fibers: FiberData[] = [];
    if (commit.fibers) {
      fibers.push(...commit.fibers);
    }
    if (commit.rootFiber) {
      collectFibers(commit.rootFiber, fibers);
    }

    for (const fiber of fibers) {
      if (!fiber.displayName) continue;

      const key = fiber.displayName;
      let record = records.get(key);

      if (!record) {
        record = {
          displayName: fiber.displayName,
          totalRenders: 0,
          wastedRenders: 0,
          totalDurationMs: 0,
          wastedDurationMs: 0,
          issues: [],
          lastProps: null,
          identicalPropRenders: 0,
          inlineFunctionCount: 0,
          inlineObjectCount: 0,
          propIdenticalCounts: new Map(),
          inlineFunctionProps: new Set(),
          inlineObjectProps: new Set(),
          changedProps: [],
        };
        records.set(key, record);
      }

      record.totalRenders += 1;
      record.totalDurationMs += fiber.actualDuration ?? 0;

      const currentProps = fiber.memoizedProps ?? {};
      const inlineFns = detectInlineFunctionProps(currentProps);
      const inlineObjs = detectInlineObjectProps(currentProps);

      for (const fn of inlineFns) record.inlineFunctionProps.add(fn);
      for (const ob of inlineObjs) record.inlineObjectProps.add(ob);
      if (inlineFns.length > 0) record.inlineFunctionCount += 1;
      if (inlineObjs.length > 0) record.inlineObjectCount += 1;

      if (record.lastProps !== null) {
        const isWasted = shallowEqual(record.lastProps, currentProps);
        const propDiff = diffProps(record.lastProps, currentProps);

        if (isWasted) {
          record.wastedRenders += 1;
          record.wastedDurationMs += fiber.actualDuration ?? 0;
          record.identicalPropRenders += 1;

          // All props were identical — build targeted issues based on known inline props
          if (record.inlineFunctionProps.size > 0) {
            for (const propName of record.inlineFunctionProps) {
              record.issues.push({
                type: 'inline-function',
                description: `"${propName}" prop is an inline function — recreated every render`,
                suggestion: buildPropSpecificSuggestion(propName, 'function'),
                occurrences: [commit.id],
                severity: 'high',
              });
            }
          }
          if (record.inlineObjectProps.size > 0) {
            for (const propName of record.inlineObjectProps) {
              record.issues.push({
                type: 'inline-object',
                description: `"${propName}" prop is an inline object/array — recreated every render`,
                suggestion: buildPropSpecificSuggestion(propName, 'object'),
                occurrences: [commit.id],
                severity: 'medium',
              });
            }
          }

          // Generic issue if no specific prop causes identified
          if (record.inlineFunctionProps.size === 0 && record.inlineObjectProps.size === 0) {
            record.issues.push({
              type: 'prop-reference',
              description: `Re-rendered with identical props (${Object.keys(currentProps).length} props)`,
              suggestion: 'Wrap with React.memo() to prevent re-renders when props are unchanged',
              occurrences: [commit.id],
              severity: 'medium',
            });
          }
        } else {
          // Props DID change — track which props were identical (stable) vs changed
          for (const propName of Object.keys(currentProps)) {
            const prevVal = record.lastProps[propName];
            const currVal = currentProps[propName];
            if (Object.is(prevVal, currVal)) {
              const count = record.propIdenticalCounts.get(propName) ?? 0;
              record.propIdenticalCounts.set(propName, count + 1);
            }
          }
          record.changedProps = propDiff.changed;
        }
      }

      record.lastProps = { ...currentProps };
    }
  }

  // Build reports
  const reports: WastedRenderReport[] = [];

  for (const record of records.values()) {
    if (record.totalRenders < 2) continue;

    const rate = record.wastedRenders / record.totalRenders;
    const severity = classifySeverity(rate);
    const recommendedAction = recommendAction(
      rate,
      record.inlineFunctionCount,
      record.inlineObjectCount,
    );

    // Deduplicate issues — keep at most 10 unique descriptions
    const uniqueIssues: WastedRenderIssue[] = [];
    const seenDescriptions = new Set<string>();
    for (const issue of record.issues) {
      if (!seenDescriptions.has(issue.description)) {
        seenDescriptions.add(issue.description);
        uniqueIssues.push({ ...issue, severity });
      }
      if (uniqueIssues.length >= 10) break;
    }

    reports.push({
      componentName: record.displayName,
      renderCount: record.totalRenders,
      totalRenders: record.totalRenders,
      wastedRenders: record.wastedRenders,
      wastedRenderRate: Math.round(rate * 1000) / 10,
      recommendedAction,
      estimatedSavingsMs: Math.round(record.wastedDurationMs * 100) / 100,
      severity,
      issues: uniqueIssues,
    });
  }

  const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  reports.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return reports;
}

/** Calculate total time lost to wasted renders and equivalent dropped frames */
export function calculateFrameImpact(reports: WastedRenderReport[]): {
  totalWastedMs: number;
  droppedFrames: number;
  frameBudgetMs: number;
} {
  const frameBudgetMs = 16.67; // ~60fps
  const totalWastedMs = reports.reduce((sum, r) => sum + r.estimatedSavingsMs, 0);
  const droppedFrames = Math.floor(totalWastedMs / frameBudgetMs);
  return { totalWastedMs, droppedFrames, frameBudgetMs };
}
