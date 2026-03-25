/**
 * Render Cause Badge Component
 * Shows WHY a component re-rendered
 * @module panel/components/Analysis
 */

import React, { useMemo } from 'react';
import type { CommitData } from '@/shared/types';
import { analyzeRenderCause, aggregateRenderCauses, type RenderCause } from '@/panel/utils/renderCauseAnalysis';
import styles from './RenderCauseBadge.module.css';

interface RenderCauseBadgeProps {
  componentName: string;
  commits: CommitData[];
  currentCommitIndex?: number;
  showDistribution?: boolean;
}

/**
 * Get icon and color for render cause
 */
function getCauseStyle(cause: RenderCause): { icon: string; color: string; label: string } {
  switch (cause) {
    case 'initial':
      return { icon: '🆕', color: '#10B981', label: 'Mount' };
    case 'parent-render':
      return { icon: '👆', color: '#F59E0B', label: 'Parent' };
    case 'state-change':
      return { icon: '🔄', color: '#3B82F6', label: 'State' };
    case 'context-change':
      return { icon: '🌐', color: '#8B5CF6', label: 'Context' };
    case 'hook-change':
      return { icon: '🎣', color: '#EC4899', label: 'Hook' };
    case 'force-update':
      return { icon: '⚡', color: '#DC2626', label: 'Force' };
    default:
      return { icon: '❓', color: '#6B7280', label: 'Unknown' };
  }
}

/**
 * Render Cause Badge - Shows the primary cause for the current commit
 */
export const RenderCauseBadge: React.FC<RenderCauseBadgeProps> = ({
  componentName,
  commits,
  currentCommitIndex = commits.length - 1,
}) => {
  const causeInfo = useMemo(() => {
    const currentCommit = commits[currentCommitIndex];
    if (!currentCommit) return null;
    
    const prevCommit = currentCommitIndex > 0 ? commits[currentCommitIndex - 1] : undefined;
    return analyzeRenderCause(componentName, currentCommit, prevCommit);
  }, [componentName, commits, currentCommitIndex]);

  if (!causeInfo) return null;

  const style = getCauseStyle(causeInfo.cause);

  return (
    <span
      className={styles['badge']}
      style={{ backgroundColor: `${style.color}20`, color: style.color, borderColor: style.color }}
      title={causeInfo.description}
    >
      <span className={styles['icon']}>{style.icon}</span>
      <span className={styles['label']}>{style.label}</span>
      {causeInfo.isWasted && <span className={styles['wasted']}>⚠️</span>}
    </span>
  );
};

/**
 * Render Cause Analysis - Full component with distribution and recent causes
 */
export const RenderCauseAnalysis: React.FC<RenderCauseBadgeProps & { maxRenders?: number }> = ({
  componentName,
  commits,
  maxRenders = 20,
}) => {
  const recentCommits = commits.slice(-maxRenders);
  
  return (
    <div className={styles['analysis']}>
      <h4 className={styles['title']}>Render Causes</h4>
      <RenderCauseDistribution componentName={componentName} commits={commits} />
      
      <div className={styles['recent']}>
        <h5 className={styles['subtitle']}>Recent Renders</h5>
        <div className={styles['badges']}>
          {recentCommits.map((commit, idx) => (
            <RenderCauseBadge
              key={commit.id}
              componentName={componentName}
              commits={recentCommits}
              currentCommitIndex={idx}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Render Cause Distribution - Shows breakdown of all causes across commits
 */
export const RenderCauseDistribution: React.FC<RenderCauseBadgeProps> = ({
  componentName,
  commits,
}) => {
  const distribution = useMemo(() => {
    return aggregateRenderCauses(componentName, commits);
  }, [componentName, commits]);

  const total = commits.length;
  
  if (total === 0) return null;

  const entries = Array.from(distribution.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className={styles['distribution']}>
      {entries.map(([cause, count]) => {
        const style = getCauseStyle(cause);
        const percentage = (count / total) * 100;
        
        return (
          <div key={cause} className={styles['barRow']}>
            <span className={styles['barLabel']}>{style.icon} {style.label}</span>
            <div className={styles['barContainer']}>
              <div
                className={styles['bar']}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: style.color,
                }}
              />
            </div>
            <span className={styles['barValue']}>{Math.round(percentage)}%</span>
          </div>
        );
      })}
    </div>
  );
};

export default RenderCauseBadge;
