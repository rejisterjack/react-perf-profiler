/**
 * DetailPanel Component
 * Right panel displaying detailed information about selected components
 */

import type React from 'react';
import { forwardRef } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon } from '../Common/Icon/Icon';
import styles from './DetailPanel.module.css';

// =============================================================================
// Component
// =============================================================================

export const DetailPanel = forwardRef<HTMLDivElement>((_, ref) => {
  const {
    selectedComponent,
    componentData,
    wastedRenderReports,
    memoReports,
    selectComponent,
    toggleDetailPanel,
    isDetailPanelOpen,
  } = useProfilerStore();

  // Get component data
  const componentInfo = selectedComponent ? componentData.get(selectedComponent) : null;

  // Get reports for this component
  const wastedReport = selectedComponent
    ? (wastedRenderReports.find((r) => r.componentName === selectedComponent) ?? null)
    : null;

  const memoReport = selectedComponent
    ? (memoReports.find((r) => r.componentName === selectedComponent) ?? null)
    : null;

  // Don't render if panel is closed
  if (!isDetailPanelOpen) {
    return null;
  }

  return (
    <aside ref={ref} className={styles["detailPanel"]} aria-label="Component details panel">
      {/* Header */}
      <div className={styles["header"]}>
        <h3 className={styles["title"]}>Component Details</h3>
        <button
          className={styles["closeButton"]}
          onClick={toggleDetailPanel}
          aria-label="Close detail panel"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Content */}
      <div className={styles["content"]}>
        {!selectedComponent || !componentInfo ? (
          <EmptyState />
        ) : (
          <ComponentDetails
            name={selectedComponent}
            data={componentInfo}
            wastedReport={wastedReport}
            memoReport={memoReport}
            onClose={() => selectComponent(null)}
          />
        )}
      </div>
    </aside>
  );
});

DetailPanel.displayName = 'DetailPanel';

// =============================================================================
// Sub-components
// =============================================================================

interface ComponentDetailsProps {
  name: string;
  data: ReturnType<typeof useProfilerStore.getState>['componentData'] extends Map<string, infer V>
    ? V
    : never;
  wastedReport: ReturnType<typeof useProfilerStore.getState>['wastedRenderReports'][0] | null;
  memoReport: ReturnType<typeof useProfilerStore.getState>['memoReports'][0] | null;
  onClose: () => void;
}

const ComponentDetails: React.FC<ComponentDetailsProps> = ({
  name,
  data,
  wastedReport,
  memoReport,
}) => {
  const severity = data?.severity || 'none';

  return (
    <div className={styles["details"]}>
      {/* Component Header */}
      <div className={styles["componentHeader"]}>
        <div className={styles["componentName"]}>
          <Icon
            name={data?.isMemoized ? 'memo' : 'component'}
            size={20}
            className={styles["componentIcon"]}
          />
          <span className={styles["nameText"]} title={name}>
            {name}
          </span>
        </div>

        {severity !== 'none' && (
          <div className={`${styles["severityBadge"]} ${styles[severity]}`}>
            <Icon name={severity === 'critical' ? 'error' : 'warning'} size={12} />
            {severity.charAt(0).toUpperCase() + severity.slice(1)}
          </div>
        )}
      </div>

      {/* Render Stats */}
      <section className={styles["section"]}>
        <h4 className={styles["sectionTitle"]}>
          <Icon name="performance" size={16} />
          Render Statistics
        </h4>
        <div className={styles["statsGrid"]}>
          <StatCard label="Total Renders" value={data?.renderCount || 0} unit="" />
          <StatCard
            label="Wasted Renders"
            value={data?.wastedRenders || 0}
            unit=""
            variant={data?.wastedRenders ? 'warning' : 'default'}
          />
          <StatCard
            label="Wasted Rate"
            value={(data?.wastedRenderRate || 0).toFixed(1)}
            unit="%"
            variant={getWastedRateVariant(data?.wastedRenderRate || 0)}
          />
          <StatCard
            label="Avg Duration"
            value={(data?.averageDuration || 0).toFixed(2)}
            unit="ms"
          />
          <StatCard
            label="Total Duration"
            value={(data?.totalDuration || 0).toFixed(2)}
            unit="ms"
          />
          {data?.isMemoized && (
            <StatCard
              label="Memo Hit Rate"
              value={(data?.memoHitRate || 0).toFixed(1)}
              unit="%"
              variant={getMemoHitRateVariant(data?.memoHitRate || 0)}
            />
          )}
        </div>
      </section>

      {/* Memoization Status */}
      <section className={styles["section"]}>
        <h4 className={styles["sectionTitle"]}>
          <Icon name="memo" size={16} />
          Memoization
        </h4>
        <div className={styles["memoStatus"]}>
          {data?.isMemoized ? (
            <div className={styles["memoized"]}>
              <Icon name="check" size={16} />
              <span>Component is memoized</span>
              {memoReport && (
                <div className={styles["memoDetails"]}>
                  <p>
                    Current hit rate:{' '}
                    <strong>{memoReport.currentHitRate?.toFixed(1) ?? 'N/A'}%</strong>
                  </p>
                  <p>Optimal hit rate: {memoReport.optimalHitRate ?? 'N/A'}%</p>
                  {!memoReport.isEffective && (
                    <div className={styles["ineffectiveWarning"]}>
                      <Icon name="warning" size={16} />
                      Memoization is not effective
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={styles["notMemoized"]}>
              <Icon name="info" size={16} />
              <span>Component is not memoized</span>
              {wastedReport && (wastedReport.wastedRenderRate || 0) > 20 && (
                <div className={styles["suggestion"]}>
                  <strong>Suggestion:</strong> Consider wrapping with React.memo() to reduce
                  unnecessary re-renders.
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Wasted Render Issues */}
      {wastedReport && (wastedReport.wastedRenderRate || 0) > 10 && (
        <section className={`${styles["section"]} ${styles["issueSection"]}`}>
          <h4 className={styles["sectionTitle"]}>
            <Icon name="warning" size={16} />
            Performance Issues
          </h4>
          <div className={styles["issuesList"]}>
            <div className={`${styles["issue"]} ${styles[wastedReport.severity || 'info']}`}>
              <div className={styles["issueHeader"]}>
                <Icon name="error" size={16} />
                <span>High Wasted Render Rate</span>
              </div>
              <p className={styles["issueDescription"]}>
                This component is rendering {(wastedReport.wastedRenderRate || 0).toFixed(1)}% of
                the time without any meaningful changes.
              </p>
              {(wastedReport.estimatedSavingsMs || 0) > 0 && (
                <p className={styles["potentialSavings"]}>
                  Potential time savings: <strong>{wastedReport.estimatedSavingsMs}ms</strong>
                </p>
              )}
              <div className={styles["recommendation"]}>
                <strong>Recommendation:</strong>
                <code className={styles["code"]}>
                  {wastedReport.recommendedAction === 'memo'
                    ? `const ${name} = React.memo(${name});`
                    : `useCallback(() => { ... }, [deps])`}
                </code>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Memo Issues */}
      {memoReport?.issues && memoReport.issues.length > 0 && (
        <section className={`${styles["section"]} ${styles["issueSection"]}`}>
          <h4 className={styles["sectionTitle"]}>
            <Icon name="info" size={16} />
            Memoization Issues
          </h4>
          <div className={styles["issuesList"]}>
            {memoReport.issues.map((issue, index) => (
              <div key={index} className={`${styles["issue"]} ${styles[issue.severity || 'info']}`}>
                <div className={styles["issueHeader"]}>
                  <Icon name="warning" size={16} />
                  <span>Unstable {issue.type === 'unstable-callback' ? 'Callback' : 'Prop'}</span>
                </div>
                <p className={styles["issueDescription"]}>
                  The prop <code>{issue.propName}</code> is causing unnecessary re-renders.
                </p>
                <div className={styles["recommendation"]}>
                  <strong>Suggestion:</strong> {issue.suggestion}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {memoReport?.recommendations && memoReport.recommendations.length > 0 && (
        <section className={styles["section"]}>
          <h4 className={styles["sectionTitle"]}>
            <Icon name="performance" size={16} />
            Recommendations
          </h4>
          <ul className={styles["recommendationsList"]}>
            {memoReport.recommendations.map((rec, index) => (
              <li key={index}>{rec.description}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Commits Info */}
      <section className={styles["section"]}>
        <h4 className={styles["sectionTitle"]}>
          <Icon name="commit" size={16} />
          Appears in {data?.commitIds.length || 0} Commits
        </h4>
        <div className={styles["commitsList"]}>
          {data?.commitIds.slice(0, 10).map((commitId, index) => (
            <span key={commitId} className={styles["commitTag"]}>
              #{index + 1}
            </span>
          ))}
          {(data?.commitIds.length || 0) > 10 && (
            <span className={styles["moreCommits"]}>
              +{(data?.commitIds.length || 0) - 10} more
            </span>
          )}
        </div>
      </section>
    </div>
  );
};

// =============================================================================
// Helper Components
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  unit: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, variant = 'default' }) => (
  <div className={`${styles["statCard"]} ${styles[variant]}`}>
    <span className={styles["statLabel"]}>{label}</span>
    <span className={styles["statValue"]}>
      {value}
      {unit && <span className={styles["statUnit"]}>{unit}</span>}
    </span>
  </div>
);

const EmptyState: React.FC = () => (
  <div className={styles["emptyState"]}>
    <Icon name="component" size={32} className={styles["emptyIcon"]} />
    <p className={styles["emptyTitle"]}>No Component Selected</p>
    <p className={styles["emptyText"]}>
      Click on a component in the tree to view detailed performance information
    </p>
  </div>
);

// =============================================================================
// Helper Functions
// =============================================================================

function getWastedRateVariant(rate: number): 'default' | 'warning' | 'danger' {
  if (rate > 50) return 'danger';
  if (rate > 20) return 'warning';
  return 'default';
}

function getMemoHitRateVariant(rate: number): 'default' | 'warning' | 'success' {
  if (rate >= 80) return 'success';
  if (rate < 50) return 'warning';
  return 'default';
}

export default DetailPanel;
