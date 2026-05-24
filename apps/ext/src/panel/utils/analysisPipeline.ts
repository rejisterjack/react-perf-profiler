/**
 * Analysis pipeline — orchestrates all analysis passes and produces
 * a complete AnalysisResult.
 */

import type {
  AnalysisResult,
  AnomalyReportGroup,
  CommitData,
  MemoReport,
  OptimizationOpportunity,
  PatternReportEntry,
  TrendReportEntry,
  WastedRenderReport,
} from '@/src/shared/types';
import { analyzeWastedRenders } from './wastedRenderAnalysis';
import { analyzeMemoization } from './memoAnalysis';
import { calculatePerformanceScore } from './performanceScore';
import { detectAnomalies, detectPatterns, detectTrends } from '@/src/panel/ml/statisticalModel';

function generateOpportunities(
  wastedReports: WastedRenderReport[],
  memoReports: MemoReport[],
): OptimizationOpportunity[] {
  const opportunities: OptimizationOpportunity[] = [];

  // From wasted renders
  for (const report of wastedReports) {
    if (report.recommendedAction === 'none') continue;

    const impact: Record<string, 'high' | 'medium' | 'low'> = {
      critical: 'high',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };

    opportunities.push({
      componentName: report.componentName,
      type: report.recommendedAction,
      impact: impact[report.severity] ?? 'low',
      estimatedSavings: report.estimatedSavingsMs,
      description: `"${report.componentName}" wastes ${report.wastedRenderRate}% of its ${report.totalRenders} renders. Recommended: ${report.recommendedAction}.`,
    });
  }

  // From memo analysis — add recommendations for ineffective memos
  for (const report of memoReports) {
    if (report.isEffective) continue;

    for (const rec of report.recommendations) {
      const typeMap: Record<string, OptimizationOpportunity['type']> = {
        useCallback: 'useCallback',
        useMemo: 'useMemo',
        'React.memo': 'memo',
        'split-props': 'split-props',
      };

      const opportunityType = typeMap[rec.type] ?? 'memo';

      // Avoid duplicates from the same component
      const exists = opportunities.some(
        (o) => o.componentName === report.componentName && o.type === opportunityType,
      );
      if (exists) continue;

      opportunities.push({
        componentName: report.componentName,
        type: opportunityType,
        impact: report.currentHitRate < 30 ? 'high' : report.currentHitRate < 60 ? 'medium' : 'low',
        estimatedSavings: 0, // Memo savings are harder to estimate precisely
        description: rec.description,
      });
    }
  }

  // Sort by impact: high first
  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  opportunities.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return opportunities;
}

export function runAnalysis(commits: CommitData[]): AnalysisResult {
  const wastedRenderReports = analyzeWastedRenders(commits);
  const memoReports = analyzeMemoization(commits);
  const performanceScore = calculatePerformanceScore(wastedRenderReports, memoReports, commits);
  const topOpportunities = generateOpportunities(wastedRenderReports, memoReports);

  // Statistical anomaly detection (replaces TensorFlow.js)
  const anomalyMap = detectAnomalies(commits);
  const anomalyReports: AnomalyReportGroup[] = [];
  for (const [componentName, reports] of anomalyMap) {
    anomalyReports.push({
      componentName,
      reports: reports.map(r => ({
        commitIndex: r.commitIndex,
        duration: r.duration,
        expectedRange: r.expectedRange,
        zScore: r.zScore,
        severity: r.severity,
      })),
    });
  }

  const trendMap = detectTrends(commits);
  const trendReports: TrendReportEntry[] = [];
  for (const [, report] of trendMap) {
    trendReports.push({
      componentName: report.componentName,
      slope: report.slope,
      rSquared: report.rSquared,
      direction: report.direction,
      sampleSize: report.sampleSize,
    });
  }

  const patternReports: PatternReportEntry[] = detectPatterns(commits).map(p => ({
    pattern: p.pattern,
    components: p.components,
    description: p.description,
    confidence: p.confidence,
  }));

  return {
    timestamp: Date.now(),
    totalCommits: commits.length,
    wastedRenderReports,
    memoReports,
    performanceScore,
    topOpportunities,
    anomalyReports,
    trendReports,
    patternReports,
  };
}
