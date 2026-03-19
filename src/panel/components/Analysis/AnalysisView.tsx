import type React from 'react';
import { useEffect } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { PerformanceScore } from './PerformanceScore';
import { WastedRenderReport } from './WastedRenderReport';
import { MemoEffectiveness } from './MemoEffectiveness';
import { OptimizationSuggestions } from './OptimizationSuggestions';
import styles from './AnalysisView.module.css';

export const AnalysisView: React.FC = () => {
  const { commits, isAnalyzing, runAnalysis, performanceScore, wastedRenderReports, memoReports } =
    useProfilerStore();

  // Auto-run analysis when commits change
  useEffect(() => {
    if (commits.length > 0 && !isAnalyzing) {
      runAnalysis();
    }
  }, [commits.length, isAnalyzing, runAnalysis]);

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

  return (
    <div className={styles["analysisView"]}>
      <PerformanceScore score={performanceScore} />

      <div className={styles["reportsGrid"]}>
        <WastedRenderReport reports={wastedRenderReports} />
        <MemoEffectiveness reports={memoReports} />
      </div>

      <OptimizationSuggestions wastedReports={wastedRenderReports} memoReports={memoReports} />
    </div>
  );
};

export default AnalysisView;
