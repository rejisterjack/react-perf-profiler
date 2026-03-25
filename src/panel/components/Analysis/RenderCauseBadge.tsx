/**
 * Render Cause Badge Component
 * Shows WHY a component rendered: parent re-render, state change, context change, hook change, or forced update
 * @module panel/components/Analysis/RenderCauseBadge
 */

import type React from 'react';
import { useMemo } from 'react';
import type { CommitData, FiberNode } from '@/shared/types';
import { Icon } from '../Common/Icon/Icon';
import styles from './RenderCauseBadge.module.css';

/**
 * Type for render cause
 */
export type RenderCause =
  | 'parent-render'
  | 'state-change'
  | 'props-change'
  | 'context-change'
  | 'hook-change'
  | 'force-update'
  | 'initial'
  | 'unknown';

/**
 * Type for icon names used in this component
 */
type IconName = React.ComponentProps<typeof Icon>['name'];

/**
 * Render cause info with display properties
 */
interface RenderCauseInfo {
  type: RenderCause;
  label: string;
  description: string;
  icon: IconName;
  severity: 'info' | 'warning' | 'success' | 'error';
}

/**
 * Props for the RenderCauseBadge component
 */
interface RenderCauseBadgeProps {
  /** The cause of the render */
  cause: RenderCause;
  /** Optional detailed description */
  detail?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Whether to show the icon */
  showIcon?: boolean;
}

/**
 * Get render cause info for display
 */
function getRenderCauseInfo(cause: RenderCause): RenderCauseInfo {
  switch (cause) {
    case 'parent-render':
      return {
        type: cause,
        label: 'Parent Render',
        description: 'Re-rendered because parent component updated',
        icon: 'forward',
        severity: 'warning',
      };
    case 'state-change':
      return {
        type: cause,
        label: 'State Change',
        description: 'Re-rendered due to local state update',
        icon: 'component',
        severity: 'info',
      };
    case 'props-change':
      return {
        type: cause,
        label: 'Props Change',
        description: 'Re-rendered because props changed',
        icon: 'memo',
        severity: 'info',
      };
    case 'context-change':
      return {
        type: cause,
        label: 'Context Change',
        description: 'Re-rendered due to context value change',
        icon: 'context',
        severity: 'warning',
      };
    case 'hook-change':
      return {
        type: cause,
        label: 'Hook Change',
        description: 'Re-rendered due to hook state update',
        icon: 'lightbulb',
        severity: 'info',
      };
    case 'force-update':
      return {
        type: cause,
        label: 'Force Update',
        description: 'Re-rendered due to forceUpdate() call',
        icon: 'refresh',
        severity: 'error',
      };
    case 'initial':
      return {
        type: cause,
        label: 'Initial',
        description: 'First render of the component',
        icon: 'dot',
        severity: 'success',
      };
    default:
      return {
        type: 'unknown',
        label: 'Unknown',
        description: 'Render cause could not be determined',
        icon: 'info',
        severity: 'info',
      };
  }
}

/**
 * Render Cause Badge Component
 * Displays a badge indicating why a component rendered
 */
export const RenderCauseBadge: React.FC<RenderCauseBadgeProps> = ({
  cause,
  detail,
  size = 'medium',
  showIcon = true,
}) => {
  const info = useMemo(() => getRenderCauseInfo(cause), [cause]);

  return (
    <span
      className={`${styles['badge']} ${styles[info.severity]} ${styles[size]}`}
      title={detail || info.description}
    >
      {showIcon && (
        <span className={styles['icon']}>
          <Icon name={info.icon} size={size === 'small' ? 10 : size === 'large' ? 16 : 12} />
        </span>
      )}
      <span className={styles['label']}>{info.label}</span>
    </span>
  );
};

/**
 * Props for the RenderCauseAnalysis component
 */
interface RenderCauseAnalysisProps {
  /** Component name */
  componentName: string;
  /** Array of commits containing the component */
  commits: CommitData[];
  /** Maximum number of renders to analyze */
  maxRenders?: number;
}

/**
 * Analyze render causes for a component across commits
 */
function analyzeRenderCauses(
  componentName: string,
  commits: CommitData[]
): Array<{
  commitId: string;
  timestamp: number;
  cause: RenderCause;
  detail?: string;
}> {
  const causes: Array<{
    commitId: string;
    timestamp: number;
    cause: RenderCause;
    detail?: string;
  }> = [];

  let prevNode: FiberNode | undefined;

  for (const commit of commits) {
    const node = commit.nodes?.find((n) => n.displayName === componentName);
    if (!node) continue;

    // Determine render cause
    let cause: RenderCause = 'unknown';
    let detail: string | undefined;

    if (!prevNode) {
      cause = 'initial';
    } else {
      // Check for context change
      if (node.hasContextChanged) {
        cause = 'context-change';
        detail = 'Subscribed context value changed';
      }
      // Check for props change (shallow comparison)
      else if (JSON.stringify(node.props) !== JSON.stringify(prevNode.props)) {
        cause = 'props-change';
        detail = 'Props reference or value changed';
      }
      // Check for state change (shallow comparison)
      else if (JSON.stringify(node.state) !== JSON.stringify(prevNode.state)) {
        cause = 'state-change';
        detail = 'Local state updated';
      }
      // If no specific cause detected but still re-rendered, it's likely parent render
      else if (node.actualDuration > 0) {
        cause = 'parent-render';
        detail = 'Parent component re-rendered';
      }
    }

    causes.push({
      commitId: commit.id,
      timestamp: commit.timestamp,
      cause,
      detail,
    });

    prevNode = node;
  }

  return causes;
}

/**
 * Render Cause Analysis Component
 * Shows a summary of render causes for a component
 */
export const RenderCauseAnalysis: React.FC<RenderCauseAnalysisProps> = ({
  componentName,
  commits,
  maxRenders = 20,
}) => {
  const renderCauses = useMemo(() => {
    const causes = analyzeRenderCauses(componentName, commits);
    return causes.slice(-maxRenders); // Get most recent renders
  }, [componentName, commits, maxRenders]);

  const causeCounts = useMemo(() => {
    const counts: Record<RenderCause, number> = {
      'parent-render': 0,
      'state-change': 0,
      'props-change': 0,
      'context-change': 0,
      'hook-change': 0,
      'force-update': 0,
      initial: 0,
      unknown: 0,
    };

    for (const { cause } of renderCauses) {
      counts[cause]++;
    }

    return counts;
  }, [renderCauses]);

  if (renderCauses.length === 0) {
    return (
      <div className={styles['empty']}>
        <Icon name="info" size={16} />
        <span>No render history available</span>
      </div>
    );
  }

  // Get the most common cause (excluding initial renders)
  const nonInitialCauses = Object.entries(causeCounts).filter(
    ([type]) => type !== 'initial' && type !== 'unknown'
  );
  const mostCommonCause = nonInitialCauses.sort((a, b) => b[1] - a[1])[0];

  return (
    <div className={styles['renderCauseAnalysis']}>
      <h4 className={styles['title']}>
        <Icon name="analysis" size={16} />
        Render Cause Analysis
      </h4>

      {mostCommonCause && mostCommonCause[1] > 0 && (
        <div className={styles['primaryCause']}>
          <span className={styles['primaryCauseLabel']}>Primary Cause:</span>
          <RenderCauseBadge cause={mostCommonCause[0] as RenderCause} size="medium" />
        </div>
      )}

      <div className={styles['causeDistribution']}>
        <h5 className={styles['distributionTitle']}>Distribution</h5>
        <div className={styles['causeBars']}>
          {Object.entries(causeCounts)
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([cause, count]) => {
              const percentage = (count / renderCauses.length) * 100;
              return (
                <div key={cause} className={styles['causeBar']}>
                  <div className={styles['causeBarHeader']}>
                    <RenderCauseBadge cause={cause as RenderCause} size="small" />
                    <span className={styles['causeBarCount']}>{count}</span>
                  </div>
                  <div className={styles['causeBarTrack']}>
                    <div
                      className={`${styles['causeBarFill']} ${styles[cause]}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className={styles['recentRenders']}>
        <h5 className={styles['recentTitle']}>Recent Renders</h5>
        <div className={styles['renderList']}>
          {renderCauses
            .slice()
            .reverse()
            .slice(0, 5)
            .map((render, index) => (
              <div key={render.commitId} className={styles['renderItem']}>
                <span className={styles['renderNumber']}>#{renderCauses.length - index}</span>
                <RenderCauseBadge cause={render.cause} size="small" />
                <span className={styles['renderTime']}>
                  {new Date(render.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default RenderCauseBadge;
