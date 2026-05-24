/**
 * ComponentDetails — full detail view for a selected component.
 * Shows stats cards, render history, current props, source location, and render causes.
 */

import type { CommitData, FiberNode } from '@/src/shared/types';
import { useProfilerStore } from '@/src/panel/stores/profilerStore';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { FileCode, ExternalLink } from 'lucide-react';

interface ComponentDetailsProps {
  componentName: string | null;
  commits: CommitData[];
}

/** Find all FiberNode entries for a given component across commits. */
function getComponentHistory(
  componentName: string,
  commits: CommitData[],
): Array<{ commit: CommitData; node: FiberNode }> {
  const entries: Array<{ commit: CommitData; node: FiberNode }> = [];

  for (const commit of commits) {
    const nodes = commit.nodes ?? [];
    for (const node of nodes) {
      if (node.displayName === componentName) {
        entries.push({ commit, node });
      }
    }
  }

  return entries;
}

/** Format a timestamp to a readable time string. */
function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

/** Format duration with ms suffix and color coding. */
function formatDuration(ms: number): { text: string; className: string } {
  if (ms < 5) return { text: `${ms.toFixed(2)}ms`, className: 'text-emerald-600 dark:text-emerald-400' };
  if (ms < 16) return { text: `${ms.toFixed(2)}ms`, className: 'text-amber-600 dark:text-amber-400' };
  return { text: `${ms.toFixed(2)}ms`, className: 'text-red-600 dark:text-red-400' };
}

/** Format an unknown prop value for display. */
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

export function ComponentDetails({ componentName, commits }: ComponentDetailsProps) {
  const sourceLocations = useProfilerStore((s) => s.sourceLocations);
  const renderCauses = useProfilerStore((s) => s.renderCauses);

  if (!componentName) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <p className="text-sm">No component selected.</p>
        <p className="text-xs">Click a component in the tree to view details.</p>
      </div>
    );
  }

  const history = getComponentHistory(componentName, commits);
  const sourceLoc = sourceLocations.get(componentName);
  const causes = renderCauses.get(componentName);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <p className="text-sm">No data for {componentName}.</p>
        <p className="text-xs">Profile your application to capture render data.</p>
      </div>
    );
  }

  // Compute stats
  const renderCount = history.length;
  const durations = history.map((e) => e.node.actualDuration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);
  const isMemoized = history.some((e) => e.node.isMemoized);
  const memoType = history.find((e) => e.node.memoType)?.node.memoType ?? null;

  // Most recent render
  const latest = history[history.length - 1];
  const latestProps = latest.node.props;

  // Last 10 history entries (most recent first)
  const recentHistory = history.slice(-10).reverse();

  // Open source in VS Code
  const openInEditor = (filePath: string, line?: number | null) => {
    const vscodeUrl = `vscode://file/${filePath}${line ? `:${line}` : ''}`;
    window.open(vscodeUrl, '_blank');
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {/* Component name header */}
        <div>
          <h2 className="text-lg font-mono font-semibold text-foreground break-all">
            {componentName}
          </h2>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {isMemoized && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400">
                Memoized
              </Badge>
            )}
            {memoType && (
              <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400">
                {memoType}
              </Badge>
            )}
          </div>
        </div>

        {/* Source Location */}
        {sourceLoc && sourceLoc.fileName && (
          <>
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <FileCode className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono text-foreground truncate flex-1">
                {sourceLoc.fileName}
                {sourceLoc.lineNumber != null && `:${sourceLoc.lineNumber}`}
                {sourceLoc.columnNumber != null && `:${sourceLoc.columnNumber}`}
              </span>
              <button
                onClick={() => openInEditor(sourceLoc.fileName!, sourceLoc.lineNumber)}
                className="shrink-0 text-primary hover:text-primary/80 transition-colors"
                title="Open in VS Code"
              >
                <ExternalLink className="size-3" />
              </button>
            </div>
            <Separator />
          </>
        )}

        {/* Render Causes (Why did this render?) */}
        {causes && causes.length > 0 && (
          <>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">
                Why did this render?
              </h3>
              <div className="flex flex-col gap-1.5">
                {causes.slice(-3).reverse().map((cause, idx) => (
                  <div key={idx} className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5 mb-1">
                      {cause.causes.map((c, cidx) => (
                        <Badge
                          key={cidx}
                          variant="outline"
                          className={cn(
                            'text-[9px] px-1 py-0 h-4',
                            c.type === 'state-changed' && 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400',
                            c.type === 'props-changed' && 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400',
                            c.type === 'parent-rerendered' && 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400',
                            c.type === 'context-changed' && 'bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400',
                            c.type === 'hooks-changed' && 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400',
                          )}
                        >
                          {c.type.replace('-', ' ')}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground">
                      {cause.causes.map((c) => c.details).join('; ')}
                    </p>
                    {cause.causes.some((c) => c.changedKeys && c.changedKeys.length > 0) && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="text-muted-foreground">Changed:</span>
                        {cause.causes
                          .filter((c) => c.changedKeys && c.changedKeys.length > 0)
                          .flatMap((c) => c.changedKeys!)
                          .slice(0, 5)
                          .map((key) => (
                            <code key={key} className="text-[10px] bg-background px-1 rounded font-mono">
                              {key}
                            </code>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card size="sm">
            <CardContent>
              <p className="text-[10px] text-muted-foreground">Render Count</p>
              <p className="text-lg font-semibold tabular-nums">{renderCount}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-[10px] text-muted-foreground">Avg Duration</p>
              <p className={cn('text-lg font-semibold tabular-nums', formatDuration(avgDuration).className)}>
                {formatDuration(avgDuration).text}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-[10px] text-muted-foreground">Max Duration</p>
              <p className={cn('text-lg font-semibold tabular-nums', formatDuration(maxDuration).className)}>
                {formatDuration(maxDuration).text}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p className="text-[10px] text-muted-foreground">Memoized</p>
              <p className={cn(
                'text-lg font-semibold',
                isMemoized
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground',
              )}>
                {isMemoized ? 'Yes' : 'No'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Render history */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">
            Render History
            <span className="text-muted-foreground font-normal ml-1.5">
              (last {recentHistory.length})
            </span>
          </h3>
          <div className="flex flex-col gap-1.5">
            {recentHistory.map((entry, idx) => {
              const dur = formatDuration(entry.node.actualDuration);
              return (
                <div
                  key={`${entry.commit.id}-${idx}`}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {formatTimestamp(entry.commit.timestamp)}
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                      {entry.commit.priorityLevel}
                    </Badge>
                  </div>
                  <span className={cn('font-mono tabular-nums shrink-0', dur.className)}>
                    {dur.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Current props */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">
            Current Props
            <span className="text-muted-foreground font-normal ml-1.5">
              ({Object.keys(latestProps).length} keys)
            </span>
          </h3>
          {Object.keys(latestProps).length === 0 ? (
            <p className="text-xs text-muted-foreground">No props captured.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {Object.entries(latestProps).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-md bg-muted/50 px-3 py-1.5 text-xs"
                >
                  <span className="font-mono font-medium text-foreground">{key}</span>
                  <span className="text-muted-foreground mx-1.5">=</span>
                  <span className="font-mono text-muted-foreground break-all">
                    {formatPropValue(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
