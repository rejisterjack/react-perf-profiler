/**
 * DetailPanel — right-side panel for selected component details.
 * Uses shadcn Tabs with Overview, Props, and History tabs.
 */

import type { CommitData, FiberNode } from '@/src/shared/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ComponentDetails } from '../analysis/ComponentDetails';
import { PropDiffViewer } from '../analysis/PropDiffViewer';

interface DetailPanelProps {
  selectedComponent: string | null;
  commits: CommitData[];
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

/** Format duration with color coding. */
function formatDuration(ms: number): { text: string; className: string } {
  if (ms < 5) return { text: `${ms.toFixed(2)}ms`, className: 'text-emerald-600 dark:text-emerald-400' };
  if (ms < 16) return { text: `${ms.toFixed(2)}ms`, className: 'text-amber-600 dark:text-amber-400' };
  return { text: `${ms.toFixed(2)}ms`, className: 'text-red-600 dark:text-red-400' };
}

/** Extract the props from the last two commits where the component appeared. */
function getLastTwoProps(
  componentName: string,
  commits: CommitData[],
): { prevProps: Record<string, unknown> | undefined; currentProps: Record<string, unknown> } {
  const propsList: Array<Record<string, unknown>> = [];

  for (const commit of commits) {
    const nodes = commit.nodes ?? [];
    for (const node of nodes) {
      if (node.displayName === componentName) {
        propsList.push(node.props);
      }
    }
  }

  if (propsList.length === 0) {
    return { prevProps: undefined, currentProps: {} };
  }

  if (propsList.length === 1) {
    return { prevProps: undefined, currentProps: propsList[0] };
  }

  return {
    prevProps: propsList[propsList.length - 2],
    currentProps: propsList[propsList.length - 1],
  };
}

/** Get all commit entries where the component appeared. */
function getComponentCommits(
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

interface DetailPanelInnerProps {
  selectedComponent: string;
  commits: CommitData[];
  onClose: () => void;
}

function DetailPanelInner({ selectedComponent, commits, onClose }: DetailPanelInnerProps) {
  const componentCommits = getComponentCommits(selectedComponent, commits);
  const { prevProps, currentProps } = getLastTwoProps(selectedComponent, commits);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border">
        <h2 className="text-sm font-mono font-semibold text-foreground truncate">
          {selectedComponent}
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="Close detail panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden">
        <div className="shrink-0 px-2 pt-1">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="props">
              Props
              {prevProps !== undefined && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0 h-4 min-w-4 flex items-center justify-center">
                  Diff
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              History
              {componentCommits.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0 h-4 min-w-4 flex items-center justify-center">
                  {componentCommits.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-hidden">
          <ComponentDetails componentName={selectedComponent} commits={commits} />
        </TabsContent>

        <TabsContent value="props" className="flex-1 overflow-hidden">
          <PropDiffViewer prevProps={prevProps} currentProps={currentProps} />
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden">
          <HistoryTab componentName={selectedComponent} commits={commits} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistoryTab({
  componentName,
  commits,
}: {
  componentName: string;
  commits: CommitData[];
}) {
  const entries = getComponentCommits(componentName, commits);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <p className="text-sm">No render history.</p>
        <p className="text-xs">Profile your application to capture commits.</p>
      </div>
    );
  }

  // Show most recent first
  const sorted = [...entries].reverse();

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-4">
        <h3 className="text-sm font-medium text-foreground">
          All Renders
          <span className="text-muted-foreground font-normal ml-1.5">
            ({sorted.length} commits)
          </span>
        </h3>
        <div className="flex flex-col gap-1.5">
          {sorted.map((entry, idx) => {
            const dur = formatDuration(entry.node.actualDuration);
            const baseDur = formatDuration(entry.node.baseDuration);
            return (
              <div
                key={`${entry.commit.id}-${idx}`}
                className="flex flex-col gap-1 rounded-md bg-muted/50 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      #{sorted.length - idx}
                    </span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {formatTimestamp(entry.commit.timestamp)}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                    {entry.commit.priorityLevel}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Actual</span>
                  <span className={cn('font-mono tabular-nums', dur.className)}>
                    {dur.text}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Base</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {baseDur.text}
                  </span>
                </div>
                {entry.node.isMemoized && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Memoized</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400">
                      {entry.node.memoType ?? 'Yes'}
                    </Badge>
                  </div>
                )}
                {entry.node.hasContextChanged && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Context Changed</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400">
                      Yes
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}

export function DetailPanel({ selectedComponent, commits }: DetailPanelProps) {
  if (!selectedComponent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground/50"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium">Select a component</p>
          <p className="text-xs mt-1">
            Click a component in the tree or flamegraph to inspect its details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DetailPanelInner
      selectedComponent={selectedComponent}
      commits={commits}
      onClose={() => {
        // This component is designed to be used with the profiler store,
        // so we dispatch selection clearing via a callback pattern.
        // The parent should wire this to profilerStore.selectComponent(null).
        // For self-contained usage we dispatch a custom event.
        window.dispatchEvent(
          new CustomEvent('rpp:deselect-component'),
        );
      }}
    />
  );
}
