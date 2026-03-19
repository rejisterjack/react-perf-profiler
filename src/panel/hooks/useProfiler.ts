/**
 * Main profiling hook for controlling the profiler state
 * @module panel/hooks/useProfiler
 */

import { useCallback } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { useConnectionStore } from '@/panel/stores/connectionStore';
import type { CommitData } from '@/shared/types';

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
  const { isRecording, commits, startRecording, stopRecording, clearData, exportData, importData } =
    useProfilerStore();

  const { isConnected } = useConnectionStore();

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
