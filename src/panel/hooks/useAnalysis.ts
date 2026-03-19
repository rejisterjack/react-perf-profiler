/**
 * Hook for running analysis on profiling data
 * @module panel/hooks/useAnalysis
 */

import { useCallback, useState } from 'react';
import { analysisWorker } from '@/panel/workers/workerClient';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import type { AnalysisResult } from '@/shared/types';

/**
 * Return type for the useAnalysis hook
 */
export interface UseAnalysisReturn {
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Error message if analysis failed */
  error: string | null;
  /** Run the analysis */
  runAnalysis: () => Promise<void>;
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
 *   const { isAnalyzing, error, runAnalysis } = useAnalysis();
 *
 *   return (
 *     <div>
 *       <button onClick={runAnalysis} disabled={isAnalyzing}>
 *         {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
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
  const [error, setError] = useState<string | null>(null);

  // Access store state directly to avoid re-renders
  const storeState = useProfilerStore.getState();
  const { commits, setAnalysisResults } = storeState;

  /**
   * Run analysis on all captured commits
   */
  const runAnalysis = useCallback(async (): Promise<void> => {
    if (commits.length === 0) {
      setError('No commits to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result: AnalysisResult = await analysisWorker.analyzeAll(commits);
      setAnalysisResults(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }, [commits, setAnalysisResults]);

  return {
    isAnalyzing,
    error,
    runAnalysis,
  };
}
