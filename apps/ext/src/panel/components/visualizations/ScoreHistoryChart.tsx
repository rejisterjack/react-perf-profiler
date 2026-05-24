/**
 * ScoreHistoryChart — line chart showing performance score over time.
 * Uses SVG for lightweight rendering without a charting library dependency.
 */

import { useMemo } from 'react';
import { useProfilerStore, type ScoreHistoryEntry } from '@/src/panel/stores/profilerStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const CHART_WIDTH = 400;
const CHART_HEIGHT = 160;
const PADDING = { top: 20, right: 20, bottom: 30, left: 40 };
const INNER_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

function getTrend(entries: ScoreHistoryEntry[]): 'up' | 'down' | 'stable' {
  if (entries.length < 2) return 'stable';
  const recent = entries.slice(-5);
  const avgFirst = recent.slice(0, Math.ceil(recent.length / 2)).reduce((s, e) => s + e.score, 0) / Math.ceil(recent.length / 2);
  const avgLast = recent.slice(Math.ceil(recent.length / 2)).reduce((s, e) => s + e.score, 0) / Math.max(1, recent.length - Math.ceil(recent.length / 2));
  if (avgLast > avgFirst + 3) return 'up';
  if (avgLast < avgFirst - 3) return 'down';
  return 'stable';
}

export function ScoreHistoryChart() {
  const scoreHistory = useProfilerStore((s) => s.scoreHistory);

  const { pathD, points, xScale, yScale, trend } = useMemo(() => {
    const entries = scoreHistory.slice(-30); // Show last 30
    if (entries.length === 0) {
      return { pathD: '', points: [] as Array<{ x: number; y: number; score: number; ts: number }>, xScale: (i: number) => 0, yScale: (v: number) => 0, trend: 'stable' as const };
    }

    const minScore = Math.max(0, Math.min(...entries.map((e) => e.score)) - 5);
    const maxScore = Math.min(100, Math.max(...entries.map((e) => e.score)) + 5);
    const scoreRange = maxScore - minScore || 1;

    const xScale = (i: number) => PADDING.left + (i / Math.max(1, entries.length - 1)) * INNER_WIDTH;
    const yScale = (score: number) => PADDING.top + INNER_HEIGHT - ((score - minScore) / scoreRange) * INNER_HEIGHT;

    const pts = entries.map((e, i) => ({
      x: xScale(i),
      y: yScale(e.score),
      score: e.score,
      ts: e.timestamp,
    }));

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return { pathD: linePath, points: pts, xScale, yScale, trend: getTrend(entries) };
  }, [scoreHistory]);

  if (scoreHistory.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <p className="text-xs">No score history yet. Complete a profiling session to start tracking.</p>
        </CardContent>
      </Card>
    );
  }

  const entries = scoreHistory.slice(-30);
  const latest = entries[entries.length - 1];
  const previous = entries.length > 1 ? entries[entries.length - 2] : null;
  const delta = previous ? latest.score - previous.score : 0;

  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  // Y-axis ticks
  const minScore = Math.max(0, Math.min(...entries.map((e) => e.score)) - 5);
  const maxScore = Math.min(100, Math.max(...entries.map((e) => e.score)) + 5);
  const yTicks = [minScore, Math.round((minScore + maxScore) / 2), maxScore];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Score History</CardTitle>
            <CardDescription>Performance score over {entries.length} session{entries.length !== 1 ? 's' : ''}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('flex items-center gap-1 text-sm font-medium', trendColor)}>
              <TrendIcon className="size-3.5" />
              {delta > 0 ? '+' : ''}{delta}
            </span>
            <span className="text-xs text-muted-foreground">from last session</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          style={{ maxHeight: CHART_HEIGHT }}
        >
          {/* Y-axis grid lines */}
          {yTicks.map((tick) => {
            const y = PADDING.top + INNER_HEIGHT - ((tick - minScore) / (maxScore - minScore || 1)) * INNER_HEIGHT;
            return (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={CHART_WIDTH - PADDING.right}
                  y2={y}
                  className="stroke-muted/50"
                  strokeDasharray="3 3"
                />
                <text
                  x={PADDING.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Area fill under the line */}
          {points.length > 1 && (
            <path
              d={`${pathD} L ${points[points.length - 1]!.x} ${PADDING.top + INNER_HEIGHT} L ${points[0]!.x} ${PADDING.top + INNER_HEIGHT} Z`}
              className="fill-primary/10"
            />
          )}

          {/* Score line */}
          {points.length > 1 && (
            <path
              d={pathD}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-primary"
            />
          )}

          {/* Data points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={3}
                className={cn(
                  'fill-background stroke-2',
                  p.score >= 80 ? 'stroke-emerald-500' :
                  p.score >= 60 ? 'stroke-amber-500' :
                  'stroke-red-500'
                )}
              />
            </g>
          ))}

          {/* X-axis labels (first, last) */}
          {entries.length > 1 && (
            <>
              <text
                x={PADDING.left}
                y={CHART_HEIGHT - 5}
                className="fill-muted-foreground text-[9px]"
              >
                {new Date(entries[0]!.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
              <text
                x={CHART_WIDTH - PADDING.right}
                y={CHART_HEIGHT - 5}
                textAnchor="end"
                className="fill-muted-foreground text-[9px]"
              >
                {new Date(entries[entries.length - 1]!.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            </>
          )}
        </svg>

        {/* Session list */}
        <div className="mt-3 flex flex-col gap-1 max-h-32 overflow-y-auto">
          {entries.slice().reverse().slice(0, 5).map((entry, idx) => (
            <div key={idx} className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="flex items-center gap-2">
                <span>{entry.commitCount} commits</span>
                <span className={cn(
                  'font-medium tabular-nums',
                  entry.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                  entry.score >= 60 ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                )}>
                  {entry.score}
                </span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
