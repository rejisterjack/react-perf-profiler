/**
 * Main profiling hook for controlling the profiler state
 * @module panel/hooks/useProfiler
 */

import { useCallback, useEffect, useRef } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { useConnectionStore } from '@/panel/stores/connectionStore';
import type { CommitData } from '@/shared/types';

/** Delay in ms before auto-running analysis after stopRecording */
const AUTO_ANALYSIS_DELAY_MS = 500;

/**
 * Return type for the useProfiler hook
 */
export interface UseProfilerReturn {
  /** Whether the profiler is currently recording */
  isRecording: boolean;
  /** Whether connected to the content script */
  isConnected: boolean;
  /** Array of captured commits */
  commits: CommitData[];
  /** Start recording profiling data */
  startRecording: () => void;
  /** Stop recording profiling data */
  stopRecording: () => void;
  /** Clear all captured data */
  clearData: () => void;
  /** Export all data as JSON string */
  exportData: () => string;
  /** Import data from JSON string */
  importData: (json: string) => void;
}

/**
 * Hook for controlling the React Perf Profiler
 *
 * Provides access to profiler state and control functions. Automatically
 * syncs with the connection store to send control messages to the content script.
 *
 * @example
 * ```tsx
 * function ProfilerControls() {
 *   const { isRecording, startRecording, stopRecording, commits } = useProfiler();
 *
 *   return (
 *     <div>
 *       <button onClick={isRecording ? stopRecording : startRecording}>
 *         {isRecording ? 'Stop' : 'Start'} Recording
 *       </button>
 *       <span>{commits.length} commits captured</span>
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns Object containing profiler state and control functions
 */
export function useProfiler(): UseProfilerReturn {
  const {
    isRecording,
    commits,
    startRecording,
    stopRecording,
    clearData,
    exportData,
    importData,
    runAnalysis,
  } = useProfilerStore();

  const { isConnected } = useConnectionStore();

  // Ref to store the debounce timeout
  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Start recording and notify the content script
   */
  const handleStartRecording = useCallback((): void => {
    useConnectionStore.getState().sendMessage({ type: 'START_PROFILING' });
    startRecording();
  }, [startRecording]);

  /**
   * Stop recording and notify the content script
   */
  const handleStopRecording = useCallback((): void => {
    useConnectionStore.getState().sendMessage({ type: 'STOP_PROFILING' });
    stopRecording();
  }, [stopRecording]);

  /**
   * Clear all data and notify the content script
   */
  const handleClearData = useCallback((): void => {
    useConnectionStore.getState().sendMessage({ type: 'CLEAR_DATA' });
    clearData();
  }, [clearData]);

  /**
   * Auto-run analysis with debounce when recording stops
   */
  useEffect(() => {
    // Clear any pending analysis
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }

    // If we just stopped recording and have commits, schedule analysis
    if (!isRecording && commits.length > 0) {
      analysisTimeoutRef.current = setTimeout(() => {
        runAnalysis();
      }, AUTO_ANALYSIS_DELAY_MS);
    }

    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [isRecording, commits.length, runAnalysis]);

  return {
    isRecording,
    isConnected,
    commits,
    startRecording: handleStartRecording,
    stopRecording: handleStopRecording,
    clearData: handleClearData,
    exportData,
    importData,
  };
}
