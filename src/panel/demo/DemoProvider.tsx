/**
 * Demo Provider Component
 * Provides sample data for first-time users to explore the profiler
 * @module panel/demo/DemoProvider
 */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { notifications } from '@/panel/stores/notificationStore';
import { sampleProfile } from './sampleProfile';
import styles from './DemoProvider.module.css';

interface DemoProviderProps {
  /** Child components */
  children: React.ReactNode;
}

/**
 * Check if demo mode has been shown before
 */
function hasSeenDemo(): boolean {
  try {
    return localStorage.getItem('react-perf-profiler-demo-seen') === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark demo as seen
 */
function markDemoSeen(): void {
  try {
    localStorage.setItem('react-perf-profiler-demo-seen', 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load demo data into the profiler store
 */
function loadDemoData(): void {
  const { addCommits, setAnalysisResults } = useProfilerStore.getState();
  
  // Add commits one by one
  for (const commit of sampleProfile.commits) {
    addCommits([commit]);
  }
  
  // Set analysis results with sample metrics
  setAnalysisResults({
    timestamp: Date.now(),
    totalCommits: sampleProfile.commits.length,
    performanceScore: 75,
    wastedRenderReports: [
      {
        componentName: 'Header',
        renderCount: 3,
        totalRenders: 3,
        wastedRenders: 2,
        wastedRenderRate: 66.7,
        recommendedAction: 'memo',
        estimatedSavingsMs: 10,
        severity: 'medium',
        issues: [
          {
            type: 'inline-object',
            description: 'Props change on every render causing unnecessary re-renders',
            suggestion: 'Use React.memo or extract stable props',
            occurrences: ['commit_2'],
            severity: 'medium',
          },
        ],
      },
      {
        componentName: 'Logo',
        renderCount: 2,
        totalRenders: 2,
        wastedRenders: 2,
        wastedRenderRate: 100,
        recommendedAction: 'memo',
        estimatedSavingsMs: 5,
        severity: 'medium',
        issues: [
          {
            type: 'inline-object',
            description: 'No props but re-renders with parent',
            suggestion: 'Wrap component in React.memo',
            occurrences: ['commit_2'],
            severity: 'medium',
          },
        ],
      },
    ],
    memoReports: [
      {
        componentName: 'MenuItem',
        hasMemo: true,
        currentHitRate: 0.67,
        optimalHitRate: 0.9,
        isEffective: true,
        issues: [],
        recommendations: [
          {
            type: 'useCallback',
            description: 'Props are stable, memoization is working effectively',
          },
        ],
      },
      {
        componentName: 'MemoizedChart',
        hasMemo: true,
        currentHitRate: 0.5,
        optimalHitRate: 0.8,
        isEffective: true,
        issues: [],
        recommendations: [
          {
            type: 'useMemo',
            description: 'Consider using useMemo for data processing',
          },
        ],
      },
    ],
    topOpportunities: [
      {
        componentName: 'ExpensiveChart',
        type: 'useMemo',
        impact: 'high',
        estimatedSavings: 80,
        description: 'Expensive computation (100ms) - consider using useMemo for calculations',
      },
      {
        componentName: 'Header',
        type: 'memo',
        impact: 'medium',
        estimatedSavings: 15,
        description: 'Wrap in React.memo to prevent unnecessary re-renders',
      },
    ],
  });
  
  markDemoSeen();
  notifications.success(
    'Demo Mode Loaded',
    'Sample profile data has been loaded. Explore the profiler features!'
  );
}

/**
 * Demo Banner Component
 */
const DemoBanner: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => {
  const handleTryDemo = useCallback(() => {
    loadDemoData();
    onDismiss();
  }, [onDismiss]);

  return (
    <div className={styles['banner']}>
      <div className={styles['content']}>
        <div className={styles['icon']}>📊</div>
        <div className={styles['text']}>
          <h3>Welcome to React Perf Profiler!</h3>
          <p>
            New here? Try our demo mode to explore sample profiling data and 
            learn how to optimize your React applications.
          </p>
        </div>
      </div>
      <div className={styles['actions']}>
        <button type="button" className={styles['primary']} onClick={handleTryDemo}>
          Try Demo
        </button>
        <button type="button" className={styles['secondary']} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
};

/**
 * Demo Provider
 * Shows demo banner for first-time users
 */
export const DemoProvider: React.FC<DemoProviderProps> = ({ children }) => {
  const [showBanner, setShowBanner] = useState(false);
  const isRecording = useProfilerStore((state) => state.isRecording);
  const commits = useProfilerStore((state) => state.commits);

  useEffect(() => {
    // Show demo banner if:
    // 1. User hasn't seen it before
    // 2. Not currently recording
    // 3. No commits loaded yet
    if (!hasSeenDemo() && !isRecording && commits.length === 0) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isRecording, commits.length]);

  const handleDismiss = useCallback(() => {
    markDemoSeen();
    setShowBanner(false);
  }, []);

  return (
    <>
      {showBanner && <DemoBanner onDismiss={handleDismiss} />}
      {children}
    </>
  );
};

/**
 * Button to manually trigger demo mode
 */
export const DemoButton: React.FC = () => {
  const handleClick = useCallback(() => {
    loadDemoData();
  }, []);

  return (
    <button type="button" className={styles['demo-button']} onClick={handleClick}>
      <span className={styles['demo-icon']}>🎮</span>
      Load Demo Data
    </button>
  );
};

export default DemoProvider;
