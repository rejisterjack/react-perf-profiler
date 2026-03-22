/**
 * Hook for running analysis on profiling data
 * @module panel/hooks/useAnalysis
 */

import { useCallback, useState, useRef } from 'react';
import { analysisWorker } from '@/panel/workers/workerClient';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import type { AnalysisResult, CommitData } from '@/shared/types';

/**
 * Analysis stage for progress tracking
 */
export type AnalysisStage = 'idle' | 'parsing' | 'analyzing' | 'generating' | 'complete' | 'error';

/**
 * Return type for the useAnalysis hook
 */
export interface UseAnalysisReturn {
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Current analysis stage */
  stage: AnalysisStage;
  /** Analysis progress (0-100) */
  progress: number;
  /** Error message if analysis failed */
  error: string | null;
  /** Run the analysis */
  runAnalysis: () => Promise<void>;
  /** Cancel the current analysis */
  cancelAnalysis: () => void;
  /** Clear any error */
  clearError: () => void;
  /** Reset the analysis state */
  reset: () => void;
}

/**
 * Hook for running performance analysis on captured commits
 *
 * Offloads analysis computation to a web worker to avoid blocking
 * the main thread. Analysis includes wasted render detection and
 * memo effectiveness scoring.
 *
 * @example
 * ```tsx
 * function AnalysisButton() {
 *   const { isAnalyzing, stage, progress, error, runAnalysis } = useAnalysis();
 *
 *   return (
 *     <div>
 *       <button onClick={runAnalysis} disabled={isAnalyzing}>
 *         {isAnalyzing ? `Analyzing... ${progress}%` : 'Run Analysis'}
 *       </button>
 *       {error && <div className="error">{error}</div>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns Object containing analysis state and run function
 */
export function useAnalysis(): UseAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref for abort controller to allow cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Access store state directly to avoid re-renders
  const storeState = useProfilerStore.getState();
  const { commits, setAnalysisResults } = storeState;

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setError(null);
    setStage(prev => prev === 'error' ? 'idle' : prev);
  }, []);

  /**
   * Reset the analysis state
   */
  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setStage('idle');
    setProgress(0);
    setError(null);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  /**
   * Cancel the current analysis
   */
  const cancelAnalysis = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsAnalyzing(false);
    setStage('idle');
    setProgress(0);
  }, []);

  /**
   * Simulate progress updates for better UX
   */
  const simulateProgress = useCallback((targetStage: AnalysisStage) => {
    const stages: Record<AnalysisStage, { min: number; max: number }> = {
      idle: { min: 0, max: 0 },
      parsing: { min: 0, max: 30 },
      analyzing: { min: 30, max: 70 },
      generating: { min: 70, max: 95 },
      complete: { min: 100, max: 100 },
      error: { min: 0, max: 0 },
    };

    const target = stages[targetStage];
    setProgress(prev => {
      const next = prev + Math.random() * 5;
      return Math.min(target.max, Math.max(target.min, next));
    });
  }, []);

  /**
   * Run analysis on all captured commits
   */
  const runAnalysis = useCallback(async (): Promise<void> => {
    // Validate preconditions
    if (commits.length === 0) {
      setError('No commits to analyze. Record some profiling data first.');
      setStage('error');
      return;
    }

    // Check if analysis is already running
    if (isAnalyzing) {
      return;
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsAnalyzing(true);
    setStage('parsing');
    setProgress(0);
    setError(null);

    // Progress simulation interval
    const progressInterval = setInterval(() => {
      if (signal.aborted) {
        clearInterval(progressInterval);
        return;
      }
      simulateProgress(stage);
    }, 100);

    try {
      // Stage: Parsing
      setStage('parsing');
      simulateProgress('parsing');
      
      // Small delay to show parsing stage
      await new Promise(resolve => setTimeout(resolve, 200));
      if (signal.aborted) throw new Error('Analysis cancelled');

      // Stage: Analyzing
      setStage('analyzing');
      simulateProgress('analyzing');

      // Validate commits before analysis
      const validCommits = commits.filter((commit): commit is CommitData => {
        return commit && typeof commit === 'object' && 'id' in commit;
      });

      if (validCommits.length === 0) {
        throw new Error('No valid commits found for analysis');
      }

      if (validCommits.length !== commits.length) {
        console.warn(
          `[React Perf Profiler] Filtered out ${commits.length - validCommits.length} invalid commits`
        );
      }

      // Run the actual analysis
      const result: AnalysisResult = await analysisWorker.analyzeAll(validCommits);
      
      if (signal.aborted) throw new Error('Analysis cancelled');

      // Stage: Generating results
      setStage('generating');
      setProgress(95);

      // Store results
      setAnalysisResults(result);

      // Complete
      setStage('complete');
      setProgress(100);
      
      // Reset to idle after a brief delay
      setTimeout(() => {
        setStage('idle');
        setIsAnalyzing(false);
        setProgress(0);
      }, 500);

    } catch (err) {
      // Handle cancellation
      if (signal.aborted || (err instanceof Error && err.message === 'Analysis cancelled')) {
        setStage('idle');
        setIsAnalyzing(false);
        setProgress(0);
        return;
      }

      // Handle worker errors
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      
      // Provide more helpful error messages
      let userMessage = errorMessage;
      if (errorMessage.includes('worker')) {
        userMessage = 'Analysis worker failed to initialize. Try reloading the panel.';
      } else if (errorMessage.includes('timeout')) {
        userMessage = 'Analysis timed out. Try analyzing fewer commits.';
      } else if (errorMessage.includes('memory')) {
        userMessage = 'Analysis ran out of memory. Try clearing data and recording again.';
      }

      setError(userMessage);
      setStage('error');
      setIsAnalyzing(false);
      setProgress(0);

      // Log detailed error for debugging
      console.error('[React Perf Profiler] Analysis error:', err);
    } finally {
      clearInterval(progressInterval);
      abortControllerRef.current = null;
    }
  }, [commits, isAnalyzing, setAnalysisResults, simulateProgress, stage]);

  return {
    isAnalyzing,
    stage,
    progress,
    error,
    runAnalysis,
    cancelAnalysis,
    clearError,
    reset,
  };
}

/**
 * Hook for RSC analysis with loading states
 */
export interface UseRSCAnalysisReturn {
  isAnalyzing: boolean;
  progress: number;
  error: string | null;
  runRSCAnalysis: () => Promise<void>;
  clearError: () => void;
}

export function useRSCAnalysis(): UseRSCAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const runRSCAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setProgress(0);
    setError(null);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(90, prev + Math.random() * 10));
    }, 200);

    try {
      // TODO: Implement actual RSC analysis worker call
      // For now, simulate the analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setProgress(100);
      clearInterval(progressInterval);
      
      setTimeout(() => {
        setIsAnalyzing(false);
        setProgress(0);
      }, 300);
    } catch (err) {
      clearInterval(progressInterval);
      const errorMessage = err instanceof Error ? err.message : 'RSC analysis failed';
      setError(errorMessage);
      setIsAnalyzing(false);
      setProgress(0);
    }
  }, []);

  return {
    isAnalyzing,
    progress,
    error,
    runRSCAnalysis,
    clearError,
  };
}

export default useAnalysis;
