/**
 * MainContent Component
 * Center content area that displays different views based on current mode
 */

import React from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon, type IconName } from '../Common/Icon/Icon';
import { WelcomeScreen } from './WelcomeScreen';
import { CommitDetailPanel, AnalysisView } from '../Views';
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
        {viewMode === 'tree' && <CommitDetailPanel />}
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
        {viewMode === 'analysis' && <AnalysisView />}
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
// Helper Functions
// =============================================================================

function getViewIcon(viewMode: string): IconName {
  switch (viewMode) {
    case 'tree':
      return 'tree';
    case 'flamegraph':
      return 'flame';
    case 'timeline':
      return 'timeline';
    case 'analysis':
      return 'analysis';
    case 'compare':
      return 'diff';
    default:
      return 'tree';
  }
}

function getViewTitle(viewMode: string): string {
  switch (viewMode) {
    case 'tree':
      return 'Component Tree';
    case 'flamegraph':
      return 'Flamegraph';
    case 'timeline':
      return 'Timeline';
    case 'analysis':
      return 'Performance Analysis';
    case 'compare':
      return 'Profile Comparison';
    default:
      return 'View';
  }
}

export default MainContent;
