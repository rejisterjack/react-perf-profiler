/**
 * AnalysisView — main analysis tab with Overview, Wasted Renders,
 * Memoization, and Suggestions sub-tabs.
 */

import type { AnalysisResult, CommitData, OptimizationOpportunity } from '@/src/shared/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WastedRenderReportView } from './WastedRenderReport';
import { MemoEffectiveness } from './MemoEffectiveness';
import { PerformanceBudgetView } from './PerformanceBudgetView';
import MetricsChart from '@/src/panel/components/visualizations/MetricsChart';
import { ScoreHistoryChart } from '@/src/panel/components/visualizations/ScoreHistoryChart';
import { calculateFrameImpact } from '@/src/panel/utils/wastedRenderAnalysis';

interface AnalysisViewProps {
  analysisResults: AnalysisResult | null;
  commits: CommitData[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 60) return 'stroke-amber-500';
  if (score >= 40) return 'stroke-orange-500';
  return 'stroke-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}

/** SVG circular gauge for the performance score */
function ScoreGauge({ score }: { score: number }) {
  const radius = 54;
  const strokeWidth = 6;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={radius * 2}
        height={radius * 2}
        className="-rotate-90"
        viewBox={`0 0 ${radius * 2} ${radius * 2}`}
      >
        {/* Background track */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        {/* Score arc */}
        <circle
          cx={radius}
          cy={radius}
          r={normalizedRadius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-700 ease-out', getScoreRingColor(score))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold tabular-nums', getScoreColor(score))}>
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground">{getScoreLabel(score)}</span>
      </div>
    </div>
  );
}

const IMPACT_STYLES: Record<string, string> = {
  high: 'bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400',
  medium: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400',
  low: 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400',
};

const TYPE_ICONS: Record<string, string> = {
  memo: 'M',
  useMemo: 'U',
  useCallback: 'C',
  'split-props': 'S',
  'colocate-state': 'L',
};

function OpportunityCard({ opportunity }: { opportunity: OptimizationOpportunity }) {
  return (
    <Card size="sm">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-mono">
            {opportunity.componentName}
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            <Badge
              variant="outline"
              className="text-[10px] bg-primary/10 text-primary border-primary/25"
            >
              {TYPE_ICONS[opportunity.type] ?? '?'} {opportunity.type}
            </Badge>
            <Badge
              variant="outline"
              className={cn('text-[10px]', IMPACT_STYLES[opportunity.impact])}
            >
              {opportunity.impact} impact
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {opportunity.description}
        </p>
        {opportunity.estimatedSavings > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Estimated savings: {opportunity.estimatedSavings.toFixed(1)}ms
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ results, commits }: { results: AnalysisResult; commits: CommitData[] }) {
  const {
    performanceScore,
    wastedRenderReports,
    memoReports,
    topOpportunities,
    totalCommits,
  } = results;

  const criticalCount = wastedRenderReports.filter((r) => r.severity === 'critical').length;
  const highCount = wastedRenderReports.filter((r) => r.severity === 'high').length;
  const ineffectiveMemos = memoReports.filter((r) => !r.isEffective).length;
  const frameImpact = calculateFrameImpact(wastedRenderReports);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Score */}
      <Card>
        <CardContent className="flex flex-col items-center py-6">
          <ScoreGauge score={performanceScore} />
          <p className="text-sm text-muted-foreground mt-2">
            Performance Score
          </p>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card size="sm">
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Total Commits</p>
            <p className="text-lg font-semibold tabular-nums">{totalCommits}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Components Analyzed</p>
            <p className="text-lg font-semibold tabular-nums">
              {wastedRenderReports.length + memoReports.length}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Wasted Render Issues</p>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-semibold tabular-nums">
                {wastedRenderReports.length}
              </p>
              {criticalCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400"
                >
                  {criticalCount} critical
                </Badge>
              )}
              {highCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400"
                >
                  {highCount} high
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-[10px] text-muted-foreground">Memo Issues</p>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-semibold tabular-nums">
                {memoReports.length}
              </p>
              {ineffectiveMemos > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400"
                >
                  {ineffectiveMemos} ineffective
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Frame impact */}
      {frameImpact.totalWastedMs > 0 && (
        <Card>
          <CardContent className="flex items-center gap-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
              <span className="text-lg font-bold text-red-500">{frameImpact.droppedFrames}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {frameImpact.totalWastedMs.toFixed(1)}ms lost to wasted renders
              </p>
              <p className="text-xs text-muted-foreground">
                That&apos;s {frameImpact.droppedFrames} dropped frame{frameImpact.droppedFrames !== 1 ? 's' : ''} at 60fps ({frameImpact.frameBudgetMs.toFixed(1)}ms budget)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score History */}
      <ScoreHistoryChart />

      {/* Top 10 slowest components */}
      {(() => {
        const durationsByComponent = new Map<string, number>();
        for (const commit of commits) {
          const fibers = commit.fibers ?? [];
          for (const fiber of fibers) {
            if (!fiber.displayName) continue;
            durationsByComponent.set(
              fiber.displayName,
              (durationsByComponent.get(fiber.displayName) ?? 0) + (fiber.actualDuration ?? 0),
            );
          }
        }
        const chartData = Array.from(durationsByComponent.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([label, value]) => ({
            label,
            value,
            color: value > 100 ? '#dc2626' : value > 50 ? '#f59e0b' : '#3b82f6',
          }));

        if (chartData.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top 10 Slowest Components</CardTitle>
              <CardDescription>Total render time across all commits</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricsChart data={chartData} title="" unit="ms" />
            </CardContent>
          </Card>
        );
      })()}

      {/* Top opportunities */}
      {topOpportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Optimization Opportunities</CardTitle>
            <CardDescription>
              {topOpportunities.length} opportunities found, sorted by impact
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {topOpportunities.slice(0, 10).map((opp, idx) => (
              <OpportunityCard key={`${opp.componentName}-${opp.type}-${idx}`} opportunity={opp} />
            ))}
            {topOpportunities.length > 10 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                +{topOpportunities.length - 10} more opportunities
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SuggestionsTab({ results }: { results: AnalysisResult }) {
  const { topOpportunities } = results;

  if (topOpportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No optimization suggestions available.</p>
        <p className="text-xs mt-1">
          Profile your application to generate suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-medium text-foreground">
        Optimization Suggestions ({topOpportunities.length})
      </h3>
      <div className="flex flex-col gap-2">
        {topOpportunities.map((opp, idx) => (
          <OpportunityCard key={`${opp.componentName}-${opp.type}-${idx}`} opportunity={opp} />
        ))}
      </div>
    </div>
  );
}

export function AnalysisView({ analysisResults, commits }: AnalysisViewProps) {
  if (!analysisResults) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <p className="text-sm">No analysis data available.</p>
        <p className="text-xs">
          {commits.length > 0
            ? 'Run analysis on the captured commits to see results.'
            : 'Start profiling to capture commits for analysis.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Tabs defaultValue="overview" className="flex flex-col h-full">
        <div className="shrink-0 border-b border-border px-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="wasted">
              Wasted Renders
              {analysisResults.wastedRenderReports.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0 h-4 min-w-4 flex items-center justify-center">
                  {analysisResults.wastedRenderReports.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="memo">
              Memoization
              {analysisResults.memoReports.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0 h-4 min-w-4 flex items-center justify-center">
                  {analysisResults.memoReports.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suggestions">
              Suggestions
              {analysisResults.topOpportunities.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0 h-4 min-w-4 flex items-center justify-center">
                  {analysisResults.topOpportunities.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 overflow-y-auto">
          <OverviewTab results={analysisResults} commits={commits} />
        </TabsContent>

        <TabsContent value="wasted" className="flex-1 overflow-y-auto">
          <WastedRenderReportView reports={analysisResults.wastedRenderReports} />
        </TabsContent>

        <TabsContent value="memo" className="flex-1 overflow-y-auto">
          <MemoEffectiveness reports={analysisResults.memoReports} />
        </TabsContent>

        <TabsContent value="suggestions" className="flex-1 overflow-y-auto">
          <SuggestionsTab results={analysisResults} />
        </TabsContent>

        <TabsContent value="budgets" className="flex-1 overflow-y-auto">
          <PerformanceBudgetView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
