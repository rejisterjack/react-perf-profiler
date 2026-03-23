import type React from 'react';
import type { PerformanceMetrics } from '@/panel/stores/profilerStore';
import {
  COMPONENT_COUNT_SCORE,
  MAX_PERFORMANCE_SCORE,
  MIN_PERFORMANCE_SCORE,
  RENDER_TIME_SCORE,
  WASTED_RENDER_SCORE,
} from '@/shared/constants';
import { CircularProgress } from '../Common/CircularProgress/CircularProgress';
import styles from './PerformanceScore.module.css';

interface PerformanceScoreProps {
  score: PerformanceMetrics | null;
}

/**
 * Get color based on score value
 */
function getScoreColor(value: number): 'success' | 'warning' | 'error' {
  if (value >= 80) return 'success';
  if (value >= 60) return 'warning';
  return 'error';
}

export const PerformanceScore: React.FC<PerformanceScoreProps> = ({ score }) => {
  if (!score) return null;

  return (
    <div className={styles['scoreCard']}>
      <div className={styles['header']}>
        <h3>Performance Score</h3>
        <CircularProgress value={score.score} size={80} color={getScoreColor(score.score)} />
      </div>

      <div className={styles['categories']}>
        <CategoryScore
          label="Wasted Renders"
          value={Math.max(
            MIN_PERFORMANCE_SCORE,
            MAX_PERFORMANCE_SCORE - (score.wastedRenderRate || 0) * WASTED_RENDER_SCORE.MULTIPLIER
          )}
          description="Avoid unnecessary re-renders"
        />
        <CategoryScore
          label="Memoization"
          value={score.averageMemoHitRate || 0}
          description="Effective use of memo"
        />
        <CategoryScore
          label="Render Time"
          value={Math.max(
            MIN_PERFORMANCE_SCORE,
            MAX_PERFORMANCE_SCORE - (score.averageRenderTime || 0) * RENDER_TIME_SCORE.MULTIPLIER
          )}
          description="Stay under 16ms per frame"
        />
        <CategoryScore
          label="Component Count"
          value={Math.min(
            MAX_PERFORMANCE_SCORE,
            Math.max(
              COMPONENT_COUNT_SCORE.MIN_BASELINE,
              MAX_PERFORMANCE_SCORE - (score.totalComponents || 0) / COMPONENT_COUNT_SCORE.DIVISOR
            )
          )}
          description="Reasonable tree complexity"
        />
      </div>

      <div className={styles['summary']}>
        <div className={styles['stat']}>
          <span className={styles['statValue']}>{score.totalComponents}</span>
          <span className={styles['statLabel']}>Components</span>
        </div>
        <div className={styles['stat']}>
          <span className={styles['statValue']}>{(score.averageRenderTime || 0).toFixed(1)}ms</span>
          <span className={styles['statLabel']}>Avg Render</span>
        </div>
        <div className={styles['stat']}>
          <span className={styles['statValue']}>{(score.wastedRenderRate || 0).toFixed(1)}%</span>
          <span className={styles['statLabel']}>Wasted Rate</span>
        </div>
      </div>
    </div>
  );
};

const CategoryScore: React.FC<{
  label: string;
  value: number;
  description: string;
}> = ({ label, value, description }) => {
  const getScoreColorClass = (val: number): string => {
    if (val >= 80) return styles['success'] ?? '';
    if (val >= 60) return styles['warning'] ?? '';
    return styles['error'] ?? '';
  };

  const getScoreLabel = (val: number): string => {
    if (val >= 80) return 'good';
    if (val >= 60) return 'fair';
    return 'poor';
  };

  const clampedValue = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={styles['category']}>
      <div className={styles['categoryHeader']}>
        <span className={styles['label']}>{label}</span>
        <span className={`${styles['value']} ${getScoreColorClass(clampedValue)}`}>
          {clampedValue}/100
        </span>
      </div>
      <div
        className={styles['bar']}
        role="progressbar"
        aria-label={`${label} score`}
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${clampedValue} out of 100, ${getScoreLabel(clampedValue)}`}
      >
        <div
          className={`${styles['fill']} ${getScoreColorClass(clampedValue)}`}
          style={{ width: `${clampedValue}%` }}
          aria-hidden="true"
        />
      </div>
      <small className={styles['description']}>{description}</small>
    </div>
  );
};

export default PerformanceScore;
