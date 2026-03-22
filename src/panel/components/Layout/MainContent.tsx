/**
 * MainContent Component
 * Center content area that displays different views based on current mode
 */

import React from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon, type IconName } from '../Common/Icon/Icon';
import { WelcomeScreen } from './WelcomeScreen';
import styles from './MainContent.module.css';

// Lazy-load heavy D3 visualization panels and the compare view.
// Each is only parsed/executed when the user first switches to that tab,
// keeping the initial panel load fast.
const Flamegraph = React.lazy(() =>
  import('../Visualizations/Flamegraph').then((m) => ({ default: m.Flamegraph }))
);
const Timeline = React.lazy(() =>
  import('../Visualizations/Timeline').then((m) => ({ default: m.Timeline }))
);
const ProfileCompare = React.lazy(() => import('../Analysis/ProfileCompare'));

// =============================================================================
// Props Interface
// =============================================================================

interface MainContentProps {
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export const MainContent: React.FC<MainContentProps> = ({ className }) => {
  const { viewMode, commits, selectedCommitId } = useProfilerStore();

  // Show welcome screen if no data
  if (commits.length === 0) {
    return (
      <main className={`${styles["mainContent"]} ${className || ''}`} >
        <WelcomeScreen />
      </main>
    );
  }

  return (
    <main className={`${styles["mainContent"]} ${className || ''}`} >
      {/* View Mode Header */}
      <div className={styles["viewHeader"]}>
        <div className={styles["viewTitle"]}>
          <Icon name={getViewIcon(viewMode)} size={16} />
          <span>{getViewTitle(viewMode)}</span>
        </div>
        {selectedCommitId && (
          <div className={styles["commitBadge"]}>
            Commit {commits.findIndex((c) => c.id === selectedCommitId) + 1} of {commits.length}
          </div>
        )}
      </div>

      {/* View Content */}
      <div className={styles["viewContainer"]}>
        {viewMode === 'tree' && <ComponentTreeViewPlaceholder />}
        {viewMode === 'flamegraph' && (
          <React.Suspense fallback={<div className={styles["loadingFallback"]}>Loading flamegraph…</div>}>
            <Flamegraph />
          </React.Suspense>
        )}
        {viewMode === 'timeline' && (
          <React.Suspense fallback={<div className={styles["loadingFallback"]}>Loading timeline…</div>}>
            <Timeline />
          </React.Suspense>
        )}
        {viewMode === 'analysis' && <AnalysisViewPlaceholder />}
        {viewMode === 'compare' && (
          <React.Suspense fallback={<div className={styles["loadingFallback"]}>Loading comparison…</div>}>
            <ProfileCompare />
          </React.Suspense>
        )}
      </div>
    </main>
  );
};

// =============================================================================
// Placeholder Components (to be replaced with actual implementations)
// =============================================================================

const ComponentTreeViewPlaceholder: React.FC = () => {
  const { commits } = useProfilerStore();

  return (
    <div className={styles["placeholderContainer"]}>
      <div className={styles["placeholderHeader"]}>
        <Icon name="tree" size={24} />
        <h3>Component Tree View</h3>
        <p>Showing {commits.length} commits with component hierarchy</p>
      </div>

      <div className={styles["placeholderContent"]}>
        <div className={styles["commitList"]}>
          {commits.slice(0, 10).map((commit, index) => (
            <div key={commit.id} className={styles["commitItem"]}>
              <div className={styles["commitNumber"]}>#{index + 1}</div>
              <div className={styles["commitInfo"]}>
                <span className={styles["commitDuration"]}>
                  {(commit.duration || 0).toFixed(2)}ms
                </span>
                <span className={styles["commitComponents"]}>
                  {commit.nodes?.length ?? 0} components
                </span>
              </div>
            </div>
          ))}
          {commits.length > 10 && (
            <div className={styles["moreCommits"]}>... and {commits.length - 10} more commits</div>
          )}
        </div>
      </div>
    </div>
  );
};

const AnalysisViewPlaceholder: React.FC = () => {
  const { wastedRenderReports, performanceScore, isAnalyzing, analysisError, runAnalysis } =
    useProfilerStore();

  if (isAnalyzing) {
    return (
      <div className={styles["analyzingState"]}>
        <div className={styles["spinner"]} />
        <p>Analyzing performance data...</p>
      </div>
    );
  }

  if (analysisError) {
    return (
      <div className={styles["errorState"]}>
        <Icon name="error" size={32} />
        <h3>Analysis Failed</h3>
        <p>{analysisError}</p>
        <button onClick={runAnalysis} className={styles["retryButton"]}>
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!performanceScore) {
    return (
      <div className={styles["noAnalysisState"]}>
        <Icon name="analysis" size={32} />
        <h3>No Analysis Yet</h3>
        <p>Run analysis to see detailed performance insights</p>
        <button onClick={runAnalysis} className={styles["analyzeButton"]}>
          <Icon name="play" size={16} />
          Run Analysis
        </button>
      </div>
    );
  }

  return (
    <div className={styles["placeholderContainer"]}>
      <div className={styles["placeholderHeader"]}>
        <Icon name="analysis" size={24} />
        <h3>Performance Analysis</h3>
        <p>Insights and recommendations for optimization</p>
      </div>

      <div className={styles["analysisGrid"]}>
        {/* Score Card */}
        <div className={styles["analysisCard"]}>
          <h4>Overall Score</h4>
          <div
            className={styles["scoreCircle"]}
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
        <div className={styles["analysisCard"]}>
          <h4>Key Metrics</h4>
          <div className={styles["metricsList"]}>
            <div className={styles["metric"]}>
              <span className={styles["metricLabel"]}>Avg Render Time</span>
              <span className={styles["metricValue"]}>
                {(performanceScore.averageRenderTime || 0).toFixed(2)}ms
              </span>
            </div>
            <div className={styles["metric"]}>
              <span className={styles["metricLabel"]}>Wasted Render Rate</span>
              <span className={styles["metricValue"]}>
                {(performanceScore.wastedRenderRate || 0).toFixed(1)}%
              </span>
            </div>
            <div className={styles["metric"]}>
              <span className={styles["metricLabel"]}>Components</span>
              <span className={styles["metricValue"]}>{performanceScore.totalComponents}</span>
            </div>
          </div>
        </div>

        {/* Issues */}
        <div className={`${styles["analysisCard"]} ${styles["fullWidth"]}`}>
          <h4>Issues Found</h4>
          {wastedRenderReports.length > 0 ? (
            <div className={styles["issuesList"]}>
              {wastedRenderReports.slice(0, 5).map((report) => (
                <div
                  key={report.componentName}
                  className={`${styles["issue"]} ${styles[report.severity || 'info']}`}
                >
                  <Icon name={report.severity === 'critical' ? 'error' : 'warning'} size={16} />
                  <span className={styles["issueName"]}>{report.componentName}</span>
                  <span className={styles["issueDetail"]}>
                    {(report.wastedRenderRate || 0).toFixed(0)}% wasted renders
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles["noIssues"]}>No significant issues found!</p>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Helper Functions
// =============================================================================

function getViewIcon(viewMode: string): IconName {
  switch (viewMode) {
    case 'tree': return 'tree';
    case 'flamegraph': return 'flame';
    case 'timeline': return 'timeline';
    case 'analysis': return 'analysis';
    case 'compare': return 'diff';
    default: return 'tree';
  }
}

function getViewTitle(viewMode: string): string {
  switch (viewMode) {
    case 'tree': return 'Component Tree';
    case 'flamegraph': return 'Flamegraph';
    case 'timeline': return 'Timeline';
    case 'analysis': return 'Performance Analysis';
    case 'compare': return 'Profile Comparison';
    default: return 'View';
  }
}

export default MainContent;
