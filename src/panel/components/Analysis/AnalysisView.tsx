import type React from 'react';
import { useEffect, useMemo } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { PerformanceScore } from './PerformanceScore';
import { WastedRenderReport } from './WastedRenderReport';
import { MemoEffectiveness } from './MemoEffectiveness';
import { OptimizationSuggestions } from './OptimizationSuggestions';
import { PluginMetricsPanel } from '../Plugins/PluginMetricsPanel';
import type { PluginMetric } from '@/panel/plugins/types';
import styles from './AnalysisView.module.css';

/**
 * Extract plugin metrics from analysis results
 * Plugins can contribute metrics through the analysis results
 */
function extractPluginMetrics(analysisResults: Record<string, unknown> | null): PluginMetric[] {
  if (!analysisResults) return [];

  const metrics: PluginMetric[] = [];

  // Extract Redux metrics
  if (analysisResults['reduxMetrics']) {
    const reduxMetrics = analysisResults['reduxMetrics'] as {
      totalActions: number;
      actionsCausingRerenders: number;
      averageTimeToCommit: number;
    };

    metrics.push(
      {
        id: 'redux:total-actions',
        name: 'Redux Actions',
        value: reduxMetrics.totalActions,
        formattedValue: String(reduxMetrics.totalActions),
        description: 'Total Redux actions tracked',
        category: 'Redux',
        priority: 1,
      },
      {
        id: 'redux:actions-rerender',
        name: 'Actions → Renders',
        value: reduxMetrics.actionsCausingRerenders,
        formattedValue: String(reduxMetrics.actionsCausingRerenders),
        description: 'Actions causing re-renders',
        category: 'Redux',
        trend: reduxMetrics.actionsCausingRerenders > 0 ? 'up' : 'neutral',
        trendPositive: reduxMetrics.actionsCausingRerenders === 0,
        priority: 2,
      }
    );
  }

  // Extract Context metrics
  if (analysisResults['contextMetrics']) {
    const contextMetrics = analysisResults['contextMetrics'] as {
      totalContextChanges: number;
      contextsCausingRerenders: number;
      mostProblematicContext: string | null;
      averageComponentsAffected: number;
    };

    metrics.push(
      {
        id: 'context:total-changes',
        name: 'Context Changes',
        value: contextMetrics.totalContextChanges,
        formattedValue: String(contextMetrics.totalContextChanges),
        description: 'Total context value changes',
        category: 'Context',
        priority: 3,
      },
      {
        id: 'context:avg-affected',
        name: 'Avg Affected Components',
        value: Number(contextMetrics.averageComponentsAffected.toFixed(1)),
        formattedValue: contextMetrics.averageComponentsAffected.toFixed(1),
        description: 'Average components affected per change',
        category: 'Context',
        priority: 4,
      }
    );

    if (contextMetrics.mostProblematicContext) {
      metrics.push({
        id: 'context:problematic',
        name: 'Problematic Context',
        value: contextMetrics.mostProblematicContext,
        formattedValue: contextMetrics.mostProblematicContext,
        description: 'Context causing most re-renders',
        category: 'Context',
        priority: 5,
      });
    }
  }

  // Extract Provider metrics
  if (analysisResults['providerMetrics']) {
    const providerMetrics = analysisResults['providerMetrics'] as {
      totalProviders: number;
      totalContexts: number;
      averageDepth: number;
      highFrequencyCount: number;
    };

    metrics.push(
      {
        id: 'provider:total-providers',
        name: 'Context Providers',
        value: providerMetrics.totalProviders,
        formattedValue: String(providerMetrics.totalProviders),
        description: 'Total context providers detected',
        category: 'Context',
        priority: 6,
      },
      {
        id: 'provider:avg-depth',
        name: 'Avg Nesting Depth',
        value: Number(providerMetrics.averageDepth.toFixed(1)),
        formattedValue: providerMetrics.averageDepth.toFixed(1),
        description: 'Average provider nesting depth',
        category: 'Context',
        priority: 7,
      }
    );
  }

  return metrics;
}

/**
 * Analysis View Component
 *
 * Main analysis view that displays:
 * - Performance score
 * - Wasted render reports
 * - Memo effectiveness reports
 * - Plugin-contributed metrics
 * - Optimization suggestions
 */
export const AnalysisView: React.FC = () => {
  const { 
    commits, 
    isAnalyzing, 
    runAnalysis, 
    performanceScore, 
    wastedRenderReports, 
    memoReports,
    analysisResults 
  } = useProfilerStore();

  // Auto-run analysis when commits change
  useEffect(() => {
    if (commits.length > 0 && !isAnalyzing) {
      runAnalysis();
    }
  }, [commits.length, isAnalyzing, runAnalysis]);

  // Extract plugin metrics from analysis results
  const pluginMetrics = useMemo(() => {
    return extractPluginMetrics(analysisResults as Record<string, unknown> | null);
  }, [analysisResults]);

  if (commits.length === 0) {
    return (
      <div className={styles["empty"]}>
        <p>No data to analyze. Start recording to see analysis.</p>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className={styles["loading"]}>
        <div className={styles["spinner"]} />
        <p>Analyzing performance data...</p>
      </div>
    );
  }

  const hasPluginMetrics = pluginMetrics.length > 0;

  return (
    <div className={styles["analysisView"]}>
      <PerformanceScore score={performanceScore} />

      <div className={styles["reportsGrid"]}>
        <WastedRenderReport reports={wastedRenderReports} />
        <MemoEffectiveness reports={memoReports} />
      </div>

      {hasPluginMetrics && (
        <div className={styles["pluginSection"]}>
          <PluginMetricsPanel metrics={pluginMetrics} />
        </div>
      )}

      <OptimizationSuggestions wastedReports={wastedRenderReports} memoReports={memoReports} />
    </div>
  );
};

export default AnalysisView;
