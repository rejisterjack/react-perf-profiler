/**
 * PropDiffViewer — shows the diff between props from two consecutive renders.
 * Changed values highlighted in red (previous) / green (current).
 * Added props marked with green "+", removed with red "-".
 */

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PropDiffViewerProps {
  prevProps: Record<string, unknown> | undefined;
  currentProps: Record<string, unknown>;
}

/** Compare two unknown values for equality. */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Handle NaN
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  // Deep compare simple objects/arrays
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/** Format a prop value for display. */
function formatPropValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return value.toString();
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 3) return `[${value.map(formatPropValue).join(', ')}]`;
    return `[${value.slice(0, 3).map(formatPropValue).join(', ')}, ...] (${value.length} items)`;
  }
  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value, null, 2);
      return str.length > 200 ? str.slice(0, 200) + '...' : str;
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}

type DiffStatus = 'unchanged' | 'changed' | 'added' | 'removed';

interface PropDiffEntry {
  key: string;
  status: DiffStatus;
  prevValue: unknown;
  currentValue: unknown;
}

/** Compute the diff between previous and current props. */
function computeDiff(
  prevProps: Record<string, unknown> | undefined,
  currentProps: Record<string, unknown>,
): PropDiffEntry[] {
  const prevKeys = prevProps ? Object.keys(prevProps) : [];
  const currentKeys = Object.keys(currentProps);
  const allKeys = Array.from(new Set([...prevKeys, ...currentKeys])).sort();

  return allKeys.map((key) => {
    const inPrev = prevProps && key in prevProps;
    const inCurrent = key in currentProps;

    if (inPrev && inCurrent) {
      const prevVal = prevProps![key];
      const curVal = currentProps[key];
      const equal = valuesEqual(prevVal, curVal);
      return {
        key,
        status: equal ? 'unchanged' : 'changed',
        prevValue: prevVal,
        currentValue: curVal,
      };
    }

    if (!inPrev && inCurrent) {
      return {
        key,
        status: 'added' as const,
        prevValue: undefined,
        currentValue: currentProps[key],
      };
    }

    // inPrev && !inCurrent
    return {
      key,
      status: 'removed' as const,
      prevValue: prevProps![key],
      currentValue: undefined,
    };
  });
}

export function PropDiffViewer({ prevProps, currentProps }: PropDiffViewerProps) {
  const diff = computeDiff(prevProps, currentProps);

  const changedCount = diff.filter((d) => d.status === 'changed').length;
  const addedCount = diff.filter((d) => d.status === 'added').length;
  const removedCount = diff.filter((d) => d.status === 'removed').length;
  const unchangedCount = diff.filter((d) => d.status === 'unchanged').length;

  if (diff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <p className="text-sm">No props to compare.</p>
        <p className="text-xs">Select a component with captured props data.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-4">
        {/* Summary */}
        <div className="flex items-center gap-2 flex-wrap">
          {changedCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400">
              {changedCount} changed
            </Badge>
          )}
          {addedCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400">
              {addedCount} added
            </Badge>
          )}
          {removedCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400">
              {removedCount} removed
            </Badge>
          )}
          {unchangedCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
              {unchangedCount} unchanged
            </Badge>
          )}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_1fr] gap-3 text-[10px] text-muted-foreground font-medium px-1">
          <span>Previous</span>
          <span>Current</span>
        </div>

        {/* Diff rows */}
        <div className="flex flex-col gap-1.5">
          {diff.map((entry) => (
            <PropDiffRow key={entry.key} entry={entry} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function PropDiffRow({ entry }: { entry: PropDiffEntry }) {
  const { key, status, prevValue, currentValue } = entry;

  if (status === 'added') {
    return (
      <div className="grid grid-cols-[1fr_1fr] gap-3 rounded-md px-2 py-1.5 text-xs bg-emerald-500/5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Badge className="text-[9px] px-1 py-0 h-4 min-w-4 bg-emerald-500/20 text-emerald-700 border-emerald-500/30 dark:text-emerald-400">
            +
          </Badge>
          <span className="opacity-50">&mdash;</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-medium text-foreground shrink-0">{key}</span>
          <span className="text-muted-foreground mx-0.5">=</span>
          <span className="font-mono text-emerald-700 dark:text-emerald-400 break-all">
            {formatPropValue(currentValue)}
          </span>
        </div>
      </div>
    );
  }

  if (status === 'removed') {
    return (
      <div className="grid grid-cols-[1fr_1fr] gap-3 rounded-md px-2 py-1.5 text-xs bg-red-500/5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Badge className="text-[9px] px-1 py-0 h-4 min-w-4 bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400">
            &minus;
          </Badge>
          <span className="font-mono font-medium text-foreground shrink-0">{key}</span>
          <span className="text-muted-foreground mx-0.5">=</span>
          <span className="font-mono text-red-700 dark:text-red-400 break-all">
            {formatPropValue(prevValue)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="opacity-50">&mdash;</span>
        </div>
      </div>
    );
  }

  if (status === 'changed') {
    return (
      <div className="grid grid-cols-[1fr_1fr] gap-3 rounded-md px-2 py-1.5 text-xs bg-amber-500/5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono font-medium text-foreground shrink-0">{key}</span>
            <span className="text-muted-foreground mx-0.5">=</span>
            <span className="font-mono text-red-700 dark:text-red-400 break-all line-through decoration-red-400/40">
              {formatPropValue(prevValue)}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono font-medium text-foreground shrink-0">{key}</span>
            <span className="text-muted-foreground mx-0.5">=</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 break-all">
              {formatPropValue(currentValue)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Unchanged
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-3 rounded-md px-2 py-1.5 text-xs">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono font-medium text-muted-foreground shrink-0">{key}</span>
        <span className="text-muted-foreground/60 mx-0.5">=</span>
        <span className="font-mono text-muted-foreground/70 break-all">
          {formatPropValue(prevValue)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono font-medium text-muted-foreground shrink-0">{key}</span>
        <span className="text-muted-foreground/60 mx-0.5">=</span>
        <span className="font-mono text-muted-foreground/70 break-all">
          {formatPropValue(currentValue)}
        </span>
      </div>
    </div>
  );
}
