/**
 * Analysis Worker Manager
 * Provides a clean API to run analysis in a Web Worker with progress reporting.
 * Falls back to synchronous analysis if Workers are unavailable.
 */

import type { AnalysisResult, CommitData } from '@/src/shared/types';
import { runAnalysis } from './analysisPipeline';
import type { WorkerAnalysisRequest, WorkerAnalysisProgress, WorkerAnalysisResult, WorkerAnalysisError } from './analysisWorker';

type ProgressCallback = (phase: string, progress: number) => void;

let worker: Worker | null = null;
let isRunning = false;

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(
      new URL('./analysisWorker.ts', import.meta.url),
      { type: 'module' }
    );
    return worker;
  } catch {
    return null;
  }
}

export function runAnalysisAsync(
  commits: CommitData[],
  onProgress?: ProgressCallback,
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const w = getWorker();

    if (!w) {
      // Fallback to synchronous analysis
      try {
        const result = runAnalysis(commits);
        resolve(result);
      } catch (error) {
        reject(error);
      }
      return;
    }

    if (isRunning) {
      reject(new Error('Analysis already running'));
      return;
    }

    isRunning = true;

    const handleMessage = (ev: MessageEvent<WorkerAnalysisProgress | WorkerAnalysisResult | WorkerAnalysisError>) => {
      const msg = ev.data;

      switch (msg.type) {
        case 'PROGRESS':
          onProgress?.(msg.phase, msg.progress);
          break;
        case 'RESULT':
          cleanup();
          resolve(msg.result);
          break;
        case 'ERROR':
          cleanup();
          reject(new Error(msg.error));
          break;
      }
    };

    const handleError = (ev: ErrorEvent) => {
      cleanup();
      reject(new Error(ev.message));
    };

    const cleanup = () => {
      isRunning = false;
      w.removeEventListener('message', handleMessage);
      w.removeEventListener('error', handleError);
    };

    w.addEventListener('message', handleMessage);
    w.addEventListener('error', handleError);

    const request: WorkerAnalysisRequest = { type: 'ANALYZE', commits };
    w.postMessage(request);
  });
}

export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  isRunning = false;
}
