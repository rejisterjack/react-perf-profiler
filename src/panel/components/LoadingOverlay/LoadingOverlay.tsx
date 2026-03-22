/**
 * LoadingOverlay Component
 * Displays loading states for async operations with progress indication
 */

import type React from 'react';
import { CircularProgress } from '../Common/CircularProgress/CircularProgress';
import { Icon } from '../Common/Icon/Icon';
import styles from './LoadingOverlay.module.css';

// =============================================================================
// Types
// =============================================================================

export type LoadingOverlayType = 
  | 'analysis'
  | 'rsc-analysis'
  | 'import'
  | 'export'
  | 'generic';

export interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  isLoading: boolean;
  /** Type of loading operation */
  type?: LoadingOverlayType;
  /** Custom message to display */
  message?: string;
  /** Progress value (0-100), undefined for indeterminate */
  progress?: number;
  /** Whether to show a backdrop that blocks interaction */
  blocking?: boolean;
  /** Additional CSS class */
  className?: string;
}

export interface LoadingState {
  isLoading: boolean;
  message: string;
  progress?: number;
}

// =============================================================================
// Component
// =============================================================================

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  type = 'generic',
  message,
  progress,
  blocking = true,
  className = '',
}) => {
  if (!isLoading) {
    return null;
  }

  const config = getLoadingConfig(type, message);
  const containerClasses = [
    styles["loadingOverlay"],
    blocking ? styles["blocking"] : styles["nonBlocking"],
    className,
  ].join(' ');

  return (
    <div 
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles["loadingContent"]}>
        <div className={styles["loadingIcon"]}>
          {progress !== undefined ? (
            <CircularProgress 
              value={progress} 
              size={64} 
              color="primary"
              showLabel={true}
            />
          ) : (
            <div className={styles["spinner"]}>
              <Icon name={config.icon} size={32} />
            </div>
          )}
        </div>
        
        <div className={styles["loadingText"]}>
          <h3 className={styles["loadingTitle"]}>{config.title}</h3>
          <p className={styles["loadingMessage"]}>{config.message}</p>
        </div>

        {progress !== undefined && progress < 100 && (
          <div className={styles["progressBar"]}>
            <div 
              className={styles["progressFill"]} 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {blocking && <div className={styles["backdrop"]} />}
    </div>
  );
};

// =============================================================================
// Inline Loading Component
// =============================================================================

export interface InlineLoadingProps {
  /** Loading message */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show a spinner */
  showSpinner?: boolean;
  /** Additional CSS class */
  className?: string;
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  message = 'Loading...',
  size = 'md',
  showSpinner = true,
  className = '',
}) => {
  const sizeClasses = {
    sm: styles["inlineSm"],
    md: styles["inlineMd"],
    lg: styles["inlineLg"],
  };

  return (
    <div className={`${styles["inlineLoading"]} ${sizeClasses[size]} ${className}`}>
      {showSpinner && (
        <div className={styles["inlineSpinner"]}>
          <Icon name="spinner" size={size === 'sm' ? 14 : size === 'md' ? 18 : 24} />
        </div>
      )}
      <span className={styles["inlineMessage"]}>{message}</span>
    </div>
  );
};

// =============================================================================
// Skeleton Loading Component
// =============================================================================

export interface SkeletonProps {
  /** Number of skeleton rows */
  rows?: number;
  /** Whether to show a header skeleton */
  showHeader?: boolean;
  /** Additional CSS class */
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  rows = 3,
  showHeader = true,
  className = '',
}) => {
  return (
    <div className={`${styles["skeleton"]} ${className}`}>
      {showHeader && <div className={styles["skeletonHeader"]} />}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles["skeletonRow"]}>
          <div className={styles["skeletonCell"]} style={{ width: `${30 + Math.random() * 40}%` }} />
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Analysis Progress Component
// =============================================================================

export interface AnalysisProgressProps {
  /** Current analysis stage */
  stage: 'parsing' | 'analyzing' | 'generating';
  /** Progress percentage (0-100) */
  progress: number;
  /** Number of commits being analyzed */
  commitCount?: number;
  /** Estimated time remaining in seconds */
  eta?: number;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  stage,
  progress,
  commitCount,
  eta,
}) => {
  const stageMessages = {
    parsing: 'Parsing component tree...',
    analyzing: 'Analyzing render performance...',
    generating: 'Generating recommendations...',
  };

  return (
    <div className={styles["analysisProgress"]}>
      <div className={styles["analysisHeader"]}>
        <Icon name="analysis" size={20} />
        <span>Running Performance Analysis</span>
      </div>
      
      <div className={styles["progressInfo"]}>
        <span className={styles["stageLabel"]}>{stageMessages[stage]}</span>
        <span className={styles["progressValue"]}>{Math.round(progress)}%</span>
      </div>

      <div className={styles["progressBar"]}>
        <div 
          className={`${styles["progressFill"]} ${styles[stage]}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className={styles["analysisMeta"]}>
        {commitCount !== undefined && (
          <span>{commitCount} commits to analyze</span>
        )}
        {eta !== undefined && eta > 0 && (
          <span>~{formatETA(eta)} remaining</span>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Helper Functions
// =============================================================================

interface LoadingConfig {
  icon: import('../Common/Icon/Icon').IconName;
  title: string;
  message: string;
}

function getLoadingConfig(type: LoadingOverlayType, customMessage?: string): LoadingConfig {
  const configs: Record<LoadingOverlayType, LoadingConfig> = {
    'analysis': {
      icon: 'analysis',
      title: 'Analyzing Performance',
      message: 'Processing component renders and detecting optimization opportunities...',
    },
    'rsc-analysis': {
      icon: 'timeline',
      title: 'Analyzing RSC',
      message: 'Processing React Server Components and streaming metrics...',
    },
    'import': {
      icon: 'upload',
      title: 'Importing Data',
      message: 'Loading profile data, please wait...',
    },
    'export': {
      icon: 'download',
      title: 'Exporting Data',
      message: 'Preparing export file, please wait...',
    },
    'generic': {
      icon: 'spinner',
      title: 'Loading',
      message: 'Please wait...',
    },
  };

  const config = configs[type];
  if (customMessage) {
    return { ...config, message: customMessage };
  }
  return config;
}

function formatETA(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

// =============================================================================
// Hook for managing loading state
// =============================================================================

import { useState, useCallback } from 'react';

export interface UseLoadingStateReturn {
  /** Current loading state */
  loadingState: LoadingState;
  /** Start loading with optional message */
  startLoading: (message?: string) => void;
  /** Update loading progress */
  updateProgress: (progress: number, message?: string) => void;
  /** Stop loading */
  stopLoading: () => void;
  /** Whether currently loading */
  isLoading: boolean;
}

export function useLoadingState(initialMessage = ''): UseLoadingStateReturn {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: initialMessage,
  });

  const startLoading = useCallback((message?: string) => {
    setLoadingState({
      isLoading: true,
      message: message || 'Loading...',
      progress: undefined,
    });
  }, []);

  const updateProgress = useCallback((progress: number, message?: string) => {
    setLoadingState(prev => ({
      ...prev,
      progress,
      message: message || prev.message,
    }));
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingState({
      isLoading: false,
      message: '',
      progress: undefined,
    });
  }, []);

  return {
    loadingState,
    startLoading,
    updateProgress,
    stopLoading,
    isLoading: loadingState.isLoading,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default LoadingOverlay;
