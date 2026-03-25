/**
 * Prop Diff Viewer Component
 * Shows the differences between previous and current props for components with wasted renders
 * @module panel/components/Analysis/PropDiffViewer
 */

import type React from 'react';
import { useMemo } from 'react';
import type { CommitData } from '@/shared/types';
import { Icon } from '../Common/Icon/Icon';
import styles from './PropDiffViewer.module.css';

/**
 * Type for prop diff entry
 */
interface PropDiff {
  key: string;
  prevValue: unknown;
  currentValue: unknown;
  type: 'changed' | 'added' | 'removed' | 'unchanged';
}

/**
 * Type for icon names used in this component
 */
type IconName = React.ComponentProps<typeof Icon>['name'];

/**
 * Props for the PropDiffViewer component
 */
interface PropDiffViewerProps {
  /** Component name */
  componentName: string;
  /** Array of commits containing the component */
  commits: CommitData[];
  /** Maximum number of prop changes to display */
  maxChanges?: number;
}

/**
 * Calculate prop differences between two prop objects
 */
function calculatePropDiff(
  prevProps: Record<string, unknown> | undefined,
  currentProps: Record<string, unknown> | undefined
): PropDiff[] {
  const prev = prevProps || {};
  const current = currentProps || {};
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(current)]);

  const diffs: PropDiff[] = [];

  for (const key of allKeys) {
    const hasPrev = key in prev;
    const hasCurrent = key in current;

    if (hasPrev && hasCurrent) {
      const prevValue = prev[key];
      const currentValue = current[key];
      const isEqual = JSON.stringify(prevValue) === JSON.stringify(currentValue);

      diffs.push({
        key,
        prevValue,
        currentValue,
        type: isEqual ? 'unchanged' : 'changed',
      });
    } else if (hasPrev && !hasCurrent) {
      diffs.push({
        key,
        prevValue: prev[key],
        currentValue: undefined,
        type: 'removed',
      });
    } else {
      diffs.push({
        key,
        prevValue: undefined,
        currentValue: current[key],
        type: 'added',
      });
    }
  }

  // Sort by type: changed first, then added, then removed, then unchanged
  const typeOrder = { changed: 0, added: 1, removed: 2, unchanged: 3 };
  return diffs.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `[Array(${value.length})]`;
    return '{...}';
  }
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

/**
 * Get color class for diff type
 */
function getDiffColorClass(type: PropDiff['type']): string {
  const colorClasses: Record<PropDiff['type'], string> = {
    changed: (styles as Record<string, string>)['changed'] || '',
    added: (styles as Record<string, string>)['added'] || '',
    removed: (styles as Record<string, string>)['removed'] || '',
    unchanged: (styles as Record<string, string>)['unchanged'] || '',
  };
  return colorClasses[type] || '';
}

/**
 * Get icon name for diff type
 */
function getDiffIcon(type: PropDiff['type']): IconName {
  switch (type) {
    case 'changed':
      return 'warning';
    case 'added':
      return 'check';
    case 'removed':
      return 'close';
    default:
      return 'check';
  }
}

/**
 * Prop Diff Viewer Component
 * Shows visual diff of props between renders
 */
export const PropDiffViewer: React.FC<PropDiffViewerProps> = ({
  componentName,
  commits,
  maxChanges = 20,
}) => {
  const propChanges = useMemo(() => {
    const changes: Array<{
      commitId: string;
      timestamp: number;
      diffs: PropDiff[];
    }> = [];

    let prevProps: Record<string, unknown> | undefined;

    for (const commit of commits) {
      const node = commit.nodes?.find((n) => n.displayName === componentName);
      if (!node) continue;

      const currentProps = node.props;
      const diffs = calculatePropDiff(prevProps, currentProps);

      // Only show changes if there are actual changes (not just first render)
      if (prevProps && diffs.some((d) => d.type !== 'unchanged')) {
        changes.push({
          commitId: commit.id,
          timestamp: commit.timestamp,
          diffs,
        });
      }

      prevProps = currentProps;

      // Limit the number of changes shown
      if (changes.length >= maxChanges) break;
    }

    return changes;
  }, [componentName, commits, maxChanges]);

  if (propChanges.length === 0) {
    return (
      <div className={styles['empty']}>
        <Icon name="info" size={16} />
        <span>No prop changes detected between renders</span>
      </div>
    );
  }

  return (
    <div className={styles['propDiffViewer']}>
      <h4 className={styles['title']}>
        <Icon name="diff" size={16} />
        Prop Changes ({propChanges.length})
      </h4>

      <div className={styles['changesList']}>
        {propChanges.map((change, index) => (
          <div key={change.commitId} className={styles['changeItem']}>
            <div className={styles['changeHeader']}>
              <span className={styles['changeNumber']}>#{index + 1}</span>
              <span className={styles['changeTime']}>
                {new Date(change.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className={styles['diffs']}>
              {change.diffs
                .filter((diff) => diff.type !== 'unchanged')
                .map((diff) => (
                  <div key={diff.key} className={`${styles['diffRow']} ${getDiffColorClass(diff.type)}`}>
                    <span className={styles['diffIcon']}>
                      <Icon name={getDiffIcon(diff.type)} size={12} />
                    </span>
                    <span className={styles['diffKey']}>{diff.key}</span>
                    <span className={styles['diffArrow']}>→</span>
                    <div className={styles['diffValues']}>
                      {diff.type === 'changed' && (
                        <>
                          <span className={styles['oldValue']}>
                            {formatValue(diff.prevValue)}
                          </span>
                          <span className={styles['diffSeparator']}>→</span>
                          <span className={styles['newValue']}>
                            {formatValue(diff.currentValue)}
                          </span>
                        </>
                      )}
                      {diff.type === 'added' && (
                        <span className={styles['newValue']}>
                          {formatValue(diff.currentValue)}
                        </span>
                      )}
                      {diff.type === 'removed' && (
                        <span className={styles['oldValue']}>
                          {formatValue(diff.prevValue)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles['legend']}>
        <span className={styles['legendItem']}>
          <span className={`${styles['legendDot']} ${styles['changed']}`} />
          Changed
        </span>
        <span className={styles['legendItem']}>
          <span className={`${styles['legendDot']} ${styles['added']}`} />
          Added
        </span>
        <span className={styles['legendItem']}>
          <span className={`${styles['legendDot']} ${styles['removed']}`} />
          Removed
        </span>
      </div>
    </div>
  );
};

export default PropDiffViewer;
