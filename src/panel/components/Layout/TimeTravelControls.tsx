/**
 * TimeTravelControls
 * Scrubber bar that lets the user step through recorded commits one by one,
 * "rewinding" the component tree to any point in time.
 *
 * Reads/writes `timeTravelIndex` and `selectedCommitId` from the profiler store.
 * The store already tracks these — this is the missing UI surface.
 */

import React, { useCallback, useEffect } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon } from '../Common/Icon/Icon';
import { Tooltip } from '../Common/Tooltip/Tooltip';
import styles from './TimeTravelControls.module.css';

export const TimeTravelControls: React.FC = () => {
  const { commits, timeTravelIndex, setTimeTravelIndex, selectCommit } = useProfilerStore();

  const total = commits.length;
  // When timeTravelIndex is null we treat it as "live" (end of commits)
  const currentIndex = timeTravelIndex ?? total - 1;
  const isLive = timeTravelIndex === null;

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(total - 1, index));
      setTimeTravelIndex(clamped);
      const commit = commits[clamped];
      if (commit) selectCommit(commit.id);
    },
    [commits, total, setTimeTravelIndex, selectCommit]
  );

  const goLive = useCallback(() => {
    setTimeTravelIndex(null);
    const last = commits[total - 1];
    if (last) selectCommit(last.id);
  }, [commits, total, setTimeTravelIndex, selectCommit]);

  // Keyboard navigation: ← / → when the scrubber is focused
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(currentIndex + 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goLive();
      }
    },
    [currentIndex, goTo, goLive]
  );

  // Keep selectedCommitId in sync when commits arrive and we're in live mode
  useEffect(() => {
    if (isLive && total > 0) {
      const last = commits[total - 1];
      if (last) selectCommit(last.id);
    }
  }, [isLive, total, commits, selectCommit]);

  if (total === 0) return null;

  const commit = commits[currentIndex];
  const duration = commit ? (commit.duration ?? 0).toFixed(1) : '0.0';

  return (
    <div className={styles['timeTravelControls']} role="group" aria-label="Time travel controls">
      <Tooltip content="First commit (Home)">
        <button
          className={styles['navButton']}
          onClick={() => goTo(0)}
          disabled={currentIndex === 0}
          aria-label="Jump to first commit"
        >
          <Icon name="skipBack" size={14} />
        </button>
      </Tooltip>

      <Tooltip content="Previous commit (←)">
        <button
          className={styles['navButton']}
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          aria-label="Go to previous commit"
        >
          <Icon name="chevron-left" size={14} />
        </button>
      </Tooltip>

      <div className={styles['scrubberWrapper']}>
        <input
          type="range"
          className={styles['scrubber']}
          min={0}
          max={Math.max(0, total - 1)}
          value={currentIndex}
          onChange={(e) => goTo(Number(e.target.value))}
          onKeyDown={handleKeyDown}
          aria-label={`Time travel: commit ${currentIndex + 1} of ${total}`}
          aria-valuemin={0}
          aria-valuemax={total - 1}
          aria-valuenow={currentIndex}
          aria-valuetext={`Commit ${currentIndex + 1} of ${total}, ${duration}ms`}
        />
        <span className={styles['scrubberLabel']}>
          {currentIndex + 1} / {total}
          <span className={styles['commitDuration']}>{duration}ms</span>
        </span>
      </div>

      <Tooltip content="Next commit (→)">
        <button
          className={styles['navButton']}
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex >= total - 1}
          aria-label="Go to next commit"
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </Tooltip>

      <Tooltip content={isLive ? 'Already at latest commit' : 'Jump to latest (End)'}>
        <button
          className={`${styles['navButton']} ${isLive ? styles['liveActive'] : ''}`}
          onClick={goLive}
          disabled={isLive}
          aria-label="Jump to latest commit (live)"
          aria-pressed={isLive}
        >
          <Icon name="skipForward" size={14} />
          <span className={styles['liveLabel']}>Live</span>
        </button>
      </Tooltip>
    </div>
  );
};

export default TimeTravelControls;
