/**
 * MainContent Component
 * Center content area that displays different views based on current mode
 */

import React from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon, type IconName } from '../Common/Icon/Icon';
import { WelcomeScreen } from './WelcomeScreen';
import { CommitDetailPanel, AnalysisView } from '../Views';
import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';
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

// Lazy-load new beast mode features
const CloudSyncPanel = React.lazy(() =>
  import('../Cloud/CloudSyncPanel').then((m) => ({ default: m.CloudSyncPanel }))
);
const TeamSessionPanel = React.lazy(() =>
  import('../Collab/TeamSessionPanel').then((m) => ({ default: m.TeamSessionPanel }))
);
const AISuggestionsPanel = React.lazy(() =>
  import('../AI/AISuggestionsPanel').then((m) => ({ default: m.AISuggestionsPanel }))
);
const PluginMarketplace = React.lazy(() =>
  import('../Marketplace/PluginMarketplace').then((m) => ({ default: m.PluginMarketplace }))
);
const PerformanceDashboard = React.lazy(() =>
  import('../Dashboard/PerformanceDashboard').then((m) => ({ default: m.PerformanceDashboard }))
);
const ComponentTree3D = React.lazy(() =>
  import('../Visualizations3D/ComponentTree3D').then((m) => ({ default: m.ComponentTree3D }))
);

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
        {/* New Beast Mode Views */}
        {viewMode === 'cloud' && (
          <ErrorBoundary context="Cloud Sync">
            <React.Suspense fallback={<div className={styles["loadingFallback"]}>Loading cloud sync…</div>}>
              <CloudSyncPanel />
            </React.Suspense>
          </ErrorBoundary>
        )}
        {viewMode === 'collab' && (
          <ErrorBoundary context="Team Session">
            <React.Suspense fallback={<div className={styles["loadingFallback"]}>Loading team session…</div>}>
              <TeamSessionPanel />
            </React.Suspense>
          </ErrorBoundary>
        )}
        {viewMode === 'ai' && (
          <ErrorBoundary context="AI Suggestions">
            <React.Suspense fallback={<div className={styles["loadingFallback"]}>Loading AI suggestions…</div>}>
              <AISuggestionsPanel />
            </React.Suspense>
          </ErrorBoundary>
        )}
        {viewMode === 'marketplace' && (
          <ErrorBoundary context="Plugin Marketplace">
            <React.Suspense fallback={<div className={styles["loadingFallback"]}>Loading marketplace…</div>}>
              <PluginMarketplace />
            </React.Suspense>
          </ErrorBoundary>
        )}
        {viewMode === 'dashboard' && (
          <ErrorBoundary context="Performance Dashboard">
            <React.Suspense fallback={<div className={styles["loadingFallback"]}>Loading dashboard…</div>}>
              <PerformanceDashboard />
            </React.Suspense>
          </ErrorBoundary>
        )}
        {viewMode === '3d' && (
          <ErrorBoundary context="3D Component Tree">
            <React.Suspense fallback={<div className={styles["loadingFallback"]}>Loading 3D view…</div>}>
              <ComponentTree3D commits={commits} />
            </React.Suspense>
          </ErrorBoundary>
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
    case 'cloud':
      return 'cloud';
    case 'collab':
      return 'users';
    case 'ai':
      return 'sparkles';
    case 'marketplace':
      return 'shopping-bag';
    case 'dashboard':
      return 'bar-chart';
    case '3d':
      return 'box';
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
    case 'cloud':
      return 'Cloud Sync';
    case 'collab':
      return 'Team Session';
    case 'ai':
      return 'AI Suggestions';
    case 'marketplace':
      return 'Plugin Marketplace';
    case 'dashboard':
      return 'Performance Dashboard';
    case '3d':
      return '3D Component Tree';
    default:
      return 'View';
  }
}

export default MainContent;
