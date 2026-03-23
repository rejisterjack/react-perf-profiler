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

// =============================================================================
// Severity helpers (local to MainContent)
// =============================================================================

type MCseverity = 'critical' | 'warning' | 'info' | 'none';

function mcGetSeverity(actualDuration: number): MCseverity {
  if (actualDuration >= 16) return 'critical';
  if (actualDuration >= 8) return 'warning';
  if (actualDuration >= 2) return 'info';
  return 'none';
}

function mcSeverityColor(severity: MCseverity): string {
  switch (severity) {
    case 'critical': return 'var(--severity-critical)';
    case 'warning': return 'var(--severity-warning)';
    case 'info': return 'var(--severity-info, var(--text-secondary))';
    default: return 'var(--text-secondary)';
  }
}

// =============================================================================
// CommitDetailPanel — replaces ComponentTreeViewPlaceholder
// =============================================================================

const ComponentTreeViewPlaceholder: React.FC = () => {
  const { commits, selectedCommitId, selectedComponent, wastedRenderReports } = useProfilerStore();

  const commit = React.useMemo(
    () => commits.find((c) => c.id === selectedCommitId) ?? null,
    [commits, selectedCommitId]
  );

  const commitIndex = React.useMemo(
    () => commits.findIndex((c) => c.id === selectedCommitId),
    [commits, selectedCommitId]
  );

  // Component detail: stats for selectedComponent across ALL commits
  const componentDetail = React.useMemo(() => {
    if (!selectedComponent) return null;
    const allOccurrences = commits.flatMap(
      (c) => (c.nodes ?? []).filter((n) => n.displayName === selectedComponent)
    );
    if (allOccurrences.length === 0) return null;
    const renderCount = allOccurrences.length;
    const avgDuration = allOccurrences.reduce((s, n) => s + n.actualDuration, 0) / renderCount;
    const worstDuration = Math.max(...allOccurrences.map((n) => n.actualDuration));
    const isMemoized = allOccurrences.some((n) => n.isMemoized);
    return { renderCount, avgDuration, worstDuration, isMemoized };
  }, [selectedComponent, commits]);

  // Top 5 slow nodes in selected commit
  const topSlowNodes = React.useMemo(() => {
    if (!commit?.nodes) return [];
    return [...commit.nodes]
      .sort((a, b) => b.actualDuration - a.actualDuration)
      .slice(0, 5);
  }, [commit]);

  // Wasted renders count — components in this commit that appear in the authoritative wasted-render analysis
  const wastedRendersCount = React.useMemo(() => {
    if (!commit?.nodes || wastedRenderReports.length === 0) return 0;
    const wastedNames = new Set(wastedRenderReports.map((r) => r.componentName));
    return commit.nodes.filter((n) => wastedNames.has(n.displayName ?? '')).length;
  }, [commit, wastedRenderReports]);

  if (!commit) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '12px',
          color: 'var(--text-secondary)',
        }}
      >
        <Icon name="tree" size={40} />
        <p style={{ margin: 0, fontSize: '14px' }}>
          Select a commit from the sidebar to inspect its component tree
        </p>
      </div>
    );
  }

  const timestamp = commit.timestamp
    ? new Date(commit.timestamp).toLocaleTimeString()
    : null;
  const totalDuration = (commit.duration || 0).toFixed(1);
  const nodeCount = commit.nodes?.length ?? 0;
  const priorityLevel = commit.priorityLevel ?? 'unknown';

  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>
          Commit #{commitIndex + 1}
        </h3>
        {timestamp && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{timestamp}</span>
        )}
        <span
          style={{
            fontSize: '11px',
            background: 'var(--surface-2, #2a2a2a)',
            border: '1px solid var(--border-color, #444)',
            borderRadius: '4px',
            padding: '2px 6px',
            color: 'var(--text-secondary)',
          }}
        >
          {String(priorityLevel)}
        </span>
        <span
          style={{
            fontSize: '11px',
            background: mcSeverityColor(mcGetSeverity(commit.duration || 0)),
            color: '#fff',
            borderRadius: '4px',
            padding: '2px 6px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {totalDuration}ms
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {nodeCount} components
        </span>
      </div>

      <div className={styles["analysisGrid"]}>
        {/* Component Detail (when selectedComponent is set) */}
        {componentDetail && (
          <div className={`${styles["analysisCard"]} ${styles["fullWidth"]}`}>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px' }}>
              Component Detail — <em>{selectedComponent}</em>
            </h4>
            <div className={styles["metricsList"]}>
              <div className={styles["metric"]}>
                <span className={styles["metricLabel"]}>Render Count</span>
                <span className={styles["metricValue"]}>{componentDetail.renderCount}</span>
              </div>
              <div className={styles["metric"]}>
                <span className={styles["metricLabel"]}>Avg Duration</span>
                <span className={styles["metricValue"]}>{componentDetail.avgDuration.toFixed(1)}ms</span>
              </div>
              <div className={styles["metric"]}>
                <span className={styles["metricLabel"]}>Worst Render</span>
                <span className={styles["metricValue"]}>{componentDetail.worstDuration.toFixed(1)}ms</span>
              </div>
              <div className={styles["metric"]}>
                <span className={styles["metricLabel"]}>Memoized</span>
                <span className={styles["metricValue"]}>{componentDetail.isMemoized ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Top Slow Components */}
        <div className={`${styles["analysisCard"]} ${styles["fullWidth"]}`}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px' }}>Top Slow Components</h4>
          {topSlowNodes.length === 0 ? (
            <p className={styles["noIssues"]}>No component data available.</p>
          ) : (
            <div className={styles["issuesList"]}>
              {topSlowNodes.map((node) => {
                const sev = mcGetSeverity(node.actualDuration);
                return (
                  <div
                    key={node.id}
                    className={`${styles["issue"]} ${styles[sev] ?? ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: mcSeverityColor(sev),
                        flexShrink: 0,
                      }}
                    />
                    <span className={styles["issueName"]}>{node.displayName}</span>
                    {node.isMemoized && (
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        (memo)
                      </span>
                    )}
                    <span className={styles["issueDetail"]} style={{ marginLeft: 'auto' }}>
                      {node.actualDuration.toFixed(1)}ms
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Wasted Renders */}
        <div className={styles["analysisCard"]}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px' }}>Wasted Renders</h4>
          <div className={styles["metricsList"]}>
            <div className={styles["metric"]}>
              <span className={styles["metricLabel"]}>Wasted render count</span>
              <span
                className={styles["metricValue"]}
                style={{ color: wastedRendersCount > 0 ? 'var(--severity-warning)' : undefined }}
              >
                {wastedRendersCount}
              </span>
            </div>
          </div>
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
        <button onClick={runAnalysis} className={styles["retryButton"]} aria-label="Retry performance analysis">
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
        <button onClick={runAnalysis} className={styles["analyzeButton"]} aria-label="Run performance analysis">
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
