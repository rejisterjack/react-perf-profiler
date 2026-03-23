/**
 * CommitDetailPanel Component
 * Displays detailed information about a selected commit including
 * component stats, slow components, and wasted render information
 */

import React, { memo } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon } from '../Common/Icon/Icon';
import { getRenderSeverity, getRenderSeverityColor } from '@/shared/constants';
import styles from './Views.module.css';

export const CommitDetailPanel: React.FC = () => {
  const { commits, selectedCommitId, selectedComponent, wastedRenderReports } =
    useProfilerStore();

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
    const allOccurrences = commits.flatMap((c) =>
      (c.nodes ?? []).filter((n) => n.displayName === selectedComponent)
    );
    if (allOccurrences.length === 0) return null;
    const renderCount = allOccurrences.length;
    const avgDuration =
      allOccurrences.reduce((s, n) => s + n.actualDuration, 0) / renderCount;
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

  // Wasted renders count
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
    <div
      style={{
        padding: '16px',
        overflowY: 'auto',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
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
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {timestamp}
          </span>
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
            background: getRenderSeverityColor(getRenderSeverity(commit.duration || 0)),
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

      <div className={styles['analysisGrid']}>
        {/* Component Detail (when selectedComponent is set) */}
        {componentDetail && (
          <div className={`${styles['analysisCard']} ${styles['fullWidth']}`}>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px' }}>
              Component Detail — <em>{selectedComponent}</em>
            </h4>
            <div className={styles['metricsList']}>
              <div className={styles['metric']}>
                <span className={styles['metricLabel']}>Render Count</span>
                <span className={styles['metricValue']}>
                  {componentDetail.renderCount}
                </span>
              </div>
              <div className={styles['metric']}>
                <span className={styles['metricLabel']}>Avg Duration</span>
                <span className={styles['metricValue']}>
                  {componentDetail.avgDuration.toFixed(1)}ms
                </span>
              </div>
              <div className={styles['metric']}>
                <span className={styles['metricLabel']}>Worst Render</span>
                <span className={styles['metricValue']}>
                  {componentDetail.worstDuration.toFixed(1)}ms
                </span>
              </div>
              <div className={styles['metric']}>
                <span className={styles['metricLabel']}>Memoized</span>
                <span className={styles['metricValue']}>
                  {componentDetail.isMemoized ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Top Slow Components */}
        <div className={`${styles['analysisCard']} ${styles['fullWidth']}`}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px' }}>
            Top Slow Components
          </h4>
          {topSlowNodes.length === 0 ? (
            <p className={styles['noIssues']}>No component data available.</p>
          ) : (
            <div className={styles['issuesList']}>
              {topSlowNodes.map((node) => {
                const sev = getRenderSeverity(node.actualDuration);
                return (
                  <div
                    key={node.id}
                    className={`${styles['issue']} ${styles[sev] ?? ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: getRenderSeverityColor(sev),
                        flexShrink: 0,
                      }}
                    />
                    <span className={styles['issueName']}>{node.displayName}</span>
                    {node.isMemoized && (
                      <span
                        style={{ fontSize: '10px', color: 'var(--text-secondary)' }}
                      >
                        (memo)
                      </span>
                    )}
                    <span
                      className={styles['issueDetail']}
                      style={{ marginLeft: 'auto' }}
                    >
                      {node.actualDuration.toFixed(1)}ms
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Wasted Renders */}
        <div className={styles['analysisCard']}>
          <h4 style={{ margin: '0 0 10px', fontSize: '13px' }}>Wasted Renders</h4>
          <div className={styles['metricsList']}>
            <div className={styles['metric']}>
              <span className={styles['metricLabel']}>Wasted render count</span>
              <span
                className={styles['metricValue']}
                style={{
                  color:
                    wastedRendersCount > 0 ? 'var(--severity-warning)' : undefined,
                }}
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

export default memo(CommitDetailPanel);
