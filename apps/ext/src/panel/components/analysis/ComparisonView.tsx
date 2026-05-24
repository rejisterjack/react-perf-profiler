/**
 * ComparisonView — diff two profiling sessions to detect regressions.
 * Shows score delta, component-level regressions/improvements, new/removed components.
 */

import { useState, useCallback } from 'react';
import { useProfilerStore } from '@/src/panel/stores/profilerStore';
import { compareProfiles, type ProfileDiff, type ComponentDiff } from '@/src/panel/utils/profileComparison';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { GitCompare, TrendingUp, TrendingDown, Plus, Minus, ArrowRight } from 'lucide-react';

export function ComparisonView() {
  const commits = useProfilerStore((s) => s.commits);
  const performanceScore = useProfilerStore((s) => s.performanceScore);
  const [baselineCommits, setBaselineCommits] = useState<ReturnType<typeof commits.toArray> | null>(null);
  const [baselineScore, setBaselineScore] = useState<number | null>(null);
  const [diff, setDiff] = useState<ProfileDiff | null>(null);

  const setAsBaseline = useCallback(() => {
    const arr = commits.toArray();
    setBaselineCommits(arr);
    setBaselineScore(performanceScore);
    setDiff(null);
  }, [commits, performanceScore]);

  const runComparison = useCallback(() => {
    if (!baselineCommits) return;
    const current = commits.toArray();
    const result = compareProfiles(baselineCommits, current, baselineScore ?? undefined, performanceScore ?? undefined);
    setDiff(result);
  }, [baselineCommits, baselineScore, commits, performanceScore]);

  const currentCommits = commits.toArray();
  const hasData = currentCommits.length > 0;
  const hasBaseline = baselineCommits !== null;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <GitCompare className="size-4 text-primary" />
          <h3 className="text-sm font-medium">Baseline Comparison</h3>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={setAsBaseline}
            disabled={!hasData}
          >
            Set Current as Baseline
          </Button>
          <Button
            size="sm"
            onClick={runComparison}
            disabled={!hasBaseline || !hasData}
          >
            Compare with Current
          </Button>
        </div>

        {/* Baseline info */}
        {hasBaseline && (
          <Card>
            <CardContent className="flex items-center gap-4 py-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Baseline</p>
                <p className="text-sm font-medium">
                  {baselineCommits.length} commits
                  {baselineScore != null && <span className="ml-2 tabular-nums">Score: {baselineScore}</span>}
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Current</p>
                <p className="text-sm font-medium">
                  {currentCommits.length} commits
                  {performanceScore != null && <span className="ml-2 tabular-nums">Score: {performanceScore}</span>}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Diff results */}
        {diff && (
          <>
            {/* Score delta */}
            {diff.scoreDelta != null && (
              <Card>
                <CardContent className="flex items-center gap-3 py-3">
                  <span className="text-sm text-muted-foreground">Score Change</span>
                  <span className={cn(
                    'text-lg font-bold tabular-nums',
                    diff.scoreDelta > 0 ? 'text-emerald-500' : diff.scoreDelta < 0 ? 'text-red-500' : 'text-muted-foreground'
                  )}>
                    {diff.scoreDelta > 0 ? '+' : ''}{diff.scoreDelta}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({baselineScore} → {performanceScore})
                  </span>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <Card size="sm">
                <CardContent>
                  <p className="text-[10px] text-muted-foreground">Regressions</p>
                  <p className={cn('text-lg font-semibold tabular-nums', diff.regressions.length > 0 ? 'text-red-500' : 'text-muted-foreground')}>
                    {diff.regressions.length}
                  </p>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent>
                  <p className="text-[10px] text-muted-foreground">Improvements</p>
                  <p className={cn('text-lg font-semibold tabular-nums', diff.improvements.length > 0 ? 'text-emerald-500' : 'text-muted-foreground')}>
                    {diff.improvements.length}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* New components */}
            {diff.newComponents.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Plus className="size-3" /> New Components ({diff.newComponents.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {diff.newComponents.map((name) => (
                    <Badge key={name} variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Regressions */}
            {diff.regressions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                  <TrendingDown className="size-3" /> Regressions ({diff.regressions.length})
                </h4>
                <div className="flex flex-col gap-1.5">
                  {diff.regressions.slice(0, 20).map((r, idx) => (
                    <ComponentDiffRow key={idx} diff={r} type="regression" />
                  ))}
                  {diff.regressions.length > 20 && (
                    <p className="text-[10px] text-muted-foreground text-center">+{diff.regressions.length - 20} more</p>
                  )}
                </div>
              </div>
            )}

            {/* Improvements */}
            {diff.improvements.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                  <TrendingUp className="size-3" /> Improvements ({diff.improvements.length})
                </h4>
                <div className="flex flex-col gap-1.5">
                  {diff.improvements.slice(0, 10).map((r, idx) => (
                    <ComponentDiffRow key={idx} diff={r} type="improvement" />
                  ))}
                  {diff.improvements.length > 10 && (
                    <p className="text-[10px] text-muted-foreground text-center">+{diff.improvements.length - 10} more</p>
                  )}
                </div>
              </div>
            )}

            {/* No changes */}
            {diff.regressions.length === 0 && diff.improvements.length === 0 && diff.newComponents.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-6 text-muted-foreground">
                  <p className="text-sm">No differences detected between baseline and current.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Empty state */}
        {!hasBaseline && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <GitCompare className="size-8 opacity-40" />
              <p className="text-sm">No baseline set.</p>
              <p className="text-xs">Profile your app, set the current session as baseline, then profile again after making changes to compare.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

function ComponentDiffRow({ diff, type }: { diff: ComponentDiff; type: 'regression' | 'improvement' }) {
  const metricLabels: Record<string, string> = {
    renderCount: 'Render Count',
    avgRenderTime: 'Avg Duration',
    maxRenderTime: 'Max Duration',
    totalRenderTime: 'Total Time',
  };

  const formatValue = (metric: string, value: number) => {
    if (metric.includes('Time')) return `${value.toFixed(2)}ms`;
    return String(value);
  };

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs',
      type === 'regression' ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
    )}>
      <span className="font-mono font-medium min-w-0 truncate flex-1">{diff.componentName}</span>
      <span className="text-muted-foreground shrink-0">{metricLabels[diff.metric] ?? diff.metric}</span>
      <span className="text-muted-foreground tabular-nums shrink-0">{formatValue(diff.metric, diff.baselineValue)}</span>
      <span className="text-muted-foreground shrink-0">→</span>
      <span className={cn(
        'font-medium tabular-nums shrink-0',
        type === 'regression' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
      )}>
        {formatValue(diff.metric, diff.currentValue)}
      </span>
      <Badge variant="outline" className={cn(
        'text-[9px] px-1 py-0 h-4 shrink-0',
        diff.severity === 'critical' && 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400',
        diff.severity === 'warning' && 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
        diff.severity === 'info' && 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400',
      )}>
        {diff.deltaPercent > 0 ? '+' : ''}{diff.deltaPercent.toFixed(0)}%
      </Badge>
    </div>
  );
}
