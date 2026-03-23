/**
 * AnalysisView Component
 * Displays performance analysis results including scores, metrics,
 * and wasted render reports
 */

import type React from 'react';
import { memo } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon } from '../Common/Icon/Icon';
import styles from './Views.module.css';

export const AnalysisView: React.FC = () => {
  const {
    wastedRenderReports,
    performanceScore,
    isAnalyzing,
    analysisError,
    runAnalysis,
  } = useProfilerStore();

  if (isAnalyzing) {
    return (
      <div className={styles['analyzingState']}>
        <div className={styles['spinner']} />
        <p>Analyzing performance data...</p>
      </div>
    );
  }

  if (analysisError) {
    return (
      <div className={styles['errorState']}>
        <Icon name="error" size={32} />
        <h3>Analysis Failed</h3>
        <p>{analysisError}</p>
        <button
          type="button"
          onClick={runAnalysis}
          className={styles['retryButton']}
          aria-label="Retry performance analysis"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!performanceScore) {
    return (
      <div className={styles['noAnalysisState']}>
        <Icon name="analysis" size={32} />
        <h3>No Analysis Yet</h3>
        <p>Run analysis to see detailed performance insights</p>
        <button
          type="button"
          onClick={runAnalysis}
          className={styles['analyzeButton']}
          aria-label="Run performance analysis"
        >
          <Icon name="play" size={16} />
          Run Analysis
        </button>
      </div>
    );
  }

  return (
    <div className={styles['placeholderContainer']}>
      <div className={styles['placeholderHeader']}>
        <Icon name="analysis" size={24} />
        <h3>Performance Analysis</h3>
        <p>Insights and recommendations for optimization</p>
      </div>

      <div className={styles['analysisGrid']}>
        {/* Score Card */}
        <div className={styles['analysisCard']}>
          <h4>Overall Score</h4>
          <div
            className={styles['scoreCircle']}
            style={{
              borderColor:
                performanceScore.score >= 80
                  ? 'var(--success)'
                  : performanceScore.score >= 50
                    ? 'var(--warning)'
                    : 'var(--danger)',
              color:
                performanceScore.score >= 80
                  ? 'var(--success)'
                  : performanceScore.score >= 50
                    ? 'var(--warning)'
                    : 'var(--danger)',
            }}
          >
            {performanceScore.score.toFixed(0)}
          </div>
        </div>

        {/* Metrics */}
        <div className={styles['analysisCard']}>
          <h4>Key Metrics</h4>
          <div className={styles['metricsList']}>
            <div className={styles['metric']}>
              <span className={styles['metricLabel']}>Avg Render Time</span>
              <span className={styles['metricValue']}>
                {(performanceScore.averageRenderTime || 0).toFixed(2)}ms
              </span>
            </div>
            <div className={styles['metric']}>
              <span className={styles['metricLabel']}>Wasted Render Rate</span>
              <span className={styles['metricValue']}>
                {(performanceScore.wastedRenderRate || 0).toFixed(1)}%
              </span>
            </div>
            <div className={styles['metric']}>
              <span className={styles['metricLabel']}>Components</span>
              <span className={styles['metricValue']}>
                {performanceScore.totalComponents}
              </span>
            </div>
          </div>
        </div>

        {/* Issues */}
        <div className={`${styles['analysisCard']} ${styles['fullWidth']}`}>
          <h4>Issues Found</h4>
          {wastedRenderReports.length > 0 ? (
            <div className={styles['issuesList']}>
              {wastedRenderReports.slice(0, 5).map((report) => (
                <div
                  key={report.componentName}
                  className={`${styles['issue']} ${
                    styles[report.severity || 'info']
                  }`}
                >
                  <Icon
                    name={report.severity === 'critical' ? 'error' : 'warning'}
                    size={16}
                  />
                  <span className={styles['issueName']}>
                    {report.componentName}
                  </span>
                  <span className={styles['issueDetail']}>
                    {(report.wastedRenderRate || 0).toFixed(0)}% wasted renders
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles['noIssues']}>No significant issues found!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(AnalysisView);
