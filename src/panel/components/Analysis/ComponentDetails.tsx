import React, { useMemo } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon } from '../Common/Icon/Icon';
import styles from './ComponentDetails.module.css';

export const ComponentDetails: React.FC = () => {
  const { 
    selectedComponentName, 
    componentData, 
    wastedRenderReports,
    memoReports,
    commits 
  } = useProfilerStore();

  const component = useMemo(() => {
    if (!selectedComponentName) return null;
    return componentData.get(selectedComponentName) || null;
  }, [selectedComponentName, componentData]);

  const wastedReport = useMemo(() => {
    if (!selectedComponentName) return null;
    return wastedRenderReports.find(r => r.componentName === selectedComponentName) || null;
  }, [selectedComponentName, wastedRenderReports]);

  const memoReport = useMemo(() => {
    if (!selectedComponentName) return null;
    return memoReports.find(r => r.componentName === selectedComponentName) || null;
  }, [selectedComponentName, memoReports]);

  const commitHistory = useMemo(() => {
    if (!selectedComponentName) return [];
    return commits.filter(commit => 
      commit.nodes.some(node => node.displayName === selectedComponentName)
    );
  }, [selectedComponentName, commits]);

  if (!selectedComponentName || !component) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <Icon name="component" size="xl" />
        </div>
        <p>Select a component to view details</p>
      </div>
    );
  }

  return (
    <div className={styles.details}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.componentIcon}>
            <Icon name={component.isMemoized ? 'memo' : 'component'} size="md" />
          </span>
          <h3>{component.name}</h3>
        </div>
        {component.isMemoized && (
          <span className={styles.memoBadge}>
            <Icon name="check" size="xs" />
            Memoized
          </span>
        )}
      </div>

      <div className={styles.statsGrid}>
        <StatCard
          label="Total Renders"
          value={component.renderCount}
          icon="refresh"
        />
        <StatCard
          label="Avg Duration"
          value={`${component.averageDuration.toFixed(2)}ms`}
          icon="time"
        />
        <StatCard
          label="Wasted Renders"
          value={component.wastedRenders}
          icon="warning"
          variant={component.wastedRenders > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Wasted Rate"
          value={`${component.wastedRenderRate.toFixed(1)}%`}
          icon="performance"
          variant={component.wastedRenderRate > 20 ? 'error' : component.wastedRenderRate > 5 ? 'warning' : 'default'}
        />
      </div>

      {wastedReport && wastedReport.issues.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <Icon name="warning" size="sm" />
            Detected Issues
          </h4>
          <ul className={styles.issuesList}>
            {wastedReport.issues.map((issue, index) => (
              <li key={index} className={styles.issue}>
                <Badge type={issue.severity} />
                <div className={styles.issueContent}>
                  <span className={styles.issueType}>{issue.type}</span>
                  <p className={styles.issueSuggestion}>{issue.suggestion}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {memoReport && !memoReport.isEffective && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <Icon name="memo" size="sm" />
            Memoization Analysis
          </h4>
          <div className={styles.memoStats}>
            <div className={styles.memoStat}>
              <span className={styles.memoStatLabel}>Current Hit Rate</span>
              <span className={`${styles.memoStatValue} ${styles.warning}`}>
                {Math.round(memoReport.currentHitRate)}%
              </span>
            </div>
            <div className={styles.memoStat}>
              <span className={styles.memoStatLabel}>Optimal Hit Rate</span>
              <span className={`${styles.memoStatValue} ${styles.success}`}>
                {Math.round(memoReport.optimalHitRate)}%
              </span>
            </div>
          </div>
          {memoReport.recommendations.length > 0 && (
            <ul className={styles.recommendations}>
              {memoReport.recommendations.map((rec, index) => (
                <li key={index} className={styles.recommendation}>
                  <Icon name="info" size="xs" />
                  {rec}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>
          <Icon name="commit" size="sm" />
          Commit History
        </h4>
        <div className={styles.commitInfo}>
          <p className={styles.commitCount}>
            Appears in <strong>{commitHistory.length}</strong> of {commits.length} commits
          </p>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Icon>['name'];
  variant?: 'default' | 'warning' | 'error' | 'success';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, variant = 'default' }) => (
  <div className={`${styles.statCard} ${styles[variant]}`}>
    <div className={styles.statIcon}>
      <Icon name={icon} size="sm" />
    </div>
    <div className={styles.statContent}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  </div>
);

const Badge: React.FC<{ type: string }> = ({ type }) => {
  const severityClass = type === 'high' ? styles.error : type === 'medium' ? styles.warning : styles.info;
  return (
    <span className={`${styles.severityBadge} ${severityClass}`}>
      {type}
    </span>
  );
};

export default ComponentDetails;
