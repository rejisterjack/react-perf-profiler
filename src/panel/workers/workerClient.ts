/**
 * Web Worker client for offloading analysis tasks
 * @module panel/workers/workerClient
 */

import type { PerformanceScoreConfig } from '@/panel/utils/performanceScore';
import type { WastedRenderConfig } from '@/panel/utils/wastedRenderAnalysis';
import type { AnalysisResult, CommitData, MemoReport } from '@/shared/types';
import type {
  RSCAnalysisConfig,
  RSCAnalysisResult,
  RSCBoundary,
  RSCMetrics,
  RSCPayload,
} from '@/shared/types/rsc';
import type {
  WorkerRequest,
  WorkerRequestType,
  WorkerResponse,
  WorkerResponseType,
} from './analysis.worker';
import type {
  RSCWorkerRequest,
  RSCWorkerRequestType,
  RSCWorkerResponse,
  RSCWorkerResponseType,
} from './rscAnalysis.worker';
import type { TimelineConfig, TimelineProgress, TimelineResult } from './timeline.worker';

/**
 * Extended analysis result with memo reports for internal handling
 * Uses the same type as AnalysisResult but allows partial memo reports during construction
 */
type ExtendedAnalysisResult = AnalysisResult;

/**
 * RSC analysis pending request
 */
interface RSCPendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  type: RSCWorkerResponseType;
}

/**
 * Pending request tracking for analysis worker
 */
interface AnalysisPendingRequest {
  resolve: (value: ExtendedAnalysisResult) => void;
  reject: (error: Error) => void;
  expectedResponseType: WorkerResponseType;
}

/**
 * Singleton class for managing the analysis worker
 */
class AnalysisWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, AnalysisPendingRequest> = new Map();
  private requestId = 0;

  /**
   * Initialize the worker using the proper analysis worker module
   */
  private initWorker(): Worker {
    if (this.worker) return this.worker;

    // Create worker using the analysis worker module
    this.worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, type, result, error } = e.data;
      const request = this.pendingRequests.get(id);

      if (!request) return;

      if (type === 'ERROR') {
        request.reject(new Error(error || 'Analysis failed'));
      } else if (type === request.expectedResponseType) {
        // Transform the result based on the expected response type
        let transformedResult: ExtendedAnalysisResult;

        if (type === 'ANALYSIS_COMPLETE') {
          // Result is wasted render reports - build full AnalysisResult
          const wastedRenderReports =
            (result as ExtendedAnalysisResult['wastedRenderReports']) || [];
          transformedResult = this.buildAnalysisResult(wastedRenderReports, [], []);
        } else {
          transformedResult = (result as ExtendedAnalysisResult) || {};
        }

        request.resolve(transformedResult);
      } else {
        request.reject(new Error(`Unexpected response type: ${type}`));
      }

      this.pendingRequests.delete(id);
    };

    this.worker.onerror = (error) => {
      // Reject all pending requests
      this.pendingRequests.forEach((request) => {
        request.reject(new Error(`Worker error: ${error.message}`));
      });
      this.pendingRequests.clear();
    };

    this.worker.onmessageerror = (error) => {
      // Reject all pending requests on message error
      this.pendingRequests.forEach((request) => {
        request.reject(new Error(`Worker message error: ${error}`));
      });
      this.pendingRequests.clear();
    };

    return this.worker;
  }

  /**
   * Build a complete AnalysisResult from worker results
   */
  private buildAnalysisResult(
    wastedRenderReports: ExtendedAnalysisResult['wastedRenderReports'],
    memoReports: ExtendedAnalysisResult['memoReports'],
    _commits: CommitData[]
  ): ExtendedAnalysisResult {
    // Constants for scoring
    const MAX_SCORE = 100;
    const MIN_SCORE = 0;
    const OPPORTUNITY_THRESHOLD = 20;
    const HIGH_IMPACT_THRESHOLD = 50;
    const TOP_OPPORTUNITIES_LIMIT = 5;

    // Calculate performance score
    const totalWastedRate = wastedRenderReports.reduce(
      (sum, r) => sum + (r.wastedRenderRate || 0),
      0
    );
    const avgWastedRate =
      wastedRenderReports.length > 0 ? totalWastedRate / wastedRenderReports.length : 0;
    const calculatedScore = MAX_SCORE - avgWastedRate;
    const performanceScore = Math.max(MIN_SCORE, Math.round(calculatedScore));

    // Generate top opportunities
    const topOpportunities = wastedRenderReports
      .filter((r) => (r.wastedRenderRate || 0) > OPPORTUNITY_THRESHOLD)
      .sort((a, b) => (b.wastedRenderRate || 0) - (a.wastedRenderRate || 0))
      .slice(0, TOP_OPPORTUNITIES_LIMIT)
      .map((r) => {
        const opportunityType = r.recommendedAction || 'memo';
        // Filter out 'none' and use valid types only
        const validType: 'memo' | 'useMemo' | 'useCallback' | 'split-props' | 'colocate-state' =
          opportunityType === 'none' ? 'memo' : opportunityType;
        return {
          componentName: r.componentName,
          type: validType,
          impact:
            (r.wastedRenderRate || 0) > HIGH_IMPACT_THRESHOLD
              ? ('high' as const)
              : ('medium' as const),
          estimatedSavings: r.estimatedSavingsMs || 0,
          description: 'High wasted render rate detected',
        };
      });

    return {
      timestamp: Date.now(),
      totalCommits: wastedRenderReports.length > 0 ? (wastedRenderReports[0]?.renderCount ?? 0) : 0,
      wastedRenderReports,
      memoReports: memoReports ?? [],
      performanceScore,
      topOpportunities,
    };
  }

  /**
   * Send a request to the worker
   */
  private sendRequest<T>(
    type: WorkerRequestType,
    payload: unknown,
    expectedResponseType: WorkerResponseType
  ): Promise<T> {
    const worker = this.initWorker();
    const id = `${Date.now()}-${++this.requestId}`;

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: ExtendedAnalysisResult) => void,
        reject,
        expectedResponseType,
      });
      worker.postMessage({ id, type, payload } as WorkerRequest);
    });
  }

  /**
   * Run complete analysis on all commits
   * Uses ANALYZE_COMMITS followed by CALCULATE_SCORE for complete results
   * @param commits - Array of commit data to analyze
   * @param config - Optional configuration for wasted render analysis
   * @returns Promise resolving to analysis results
   */
  async analyzeAll(commits: CommitData[], config?: WastedRenderConfig): Promise<AnalysisResult> {
    if (commits.length === 0) {
      return {
        timestamp: Date.now(),
        totalCommits: 0,
        wastedRenderReports: [],
        memoReports: [],
        performanceScore: 100,
        topOpportunities: [],
      };
    }

    // First, get wasted render reports
    const wastedRenderReports = await this.sendRequest<
      ExtendedAnalysisResult['wastedRenderReports']
    >('ANALYZE_COMMITS', { commits, config }, 'ANALYSIS_COMPLETE');

    // Build memo reports from commit data with memoized components
    const memoReports = this.buildMemoReports(commits);

    // Return complete result with both wasted render and memo reports
    return this.buildAnalysisResult(wastedRenderReports || [], memoReports, commits);
  }

  /**
   * Analyze wasted renders only
   * @param commits - Array of commit data to analyze
   * @param config - Optional configuration for wasted render analysis
   * @returns Promise resolving to analysis results
   */
  async analyzeWastedRenders(
    commits: CommitData[],
    config?: WastedRenderConfig
  ): Promise<AnalysisResult> {
    if (commits.length === 0) {
      return {
        timestamp: Date.now(),
        totalCommits: 0,
        wastedRenderReports: [],
        memoReports: [],
        performanceScore: 100,
        topOpportunities: [],
      };
    }

    const wastedRenderReports = await this.sendRequest<
      ExtendedAnalysisResult['wastedRenderReports']
    >('ANALYZE_COMMITS', { commits, config }, 'ANALYSIS_COMPLETE');

    return this.buildAnalysisResult(wastedRenderReports || [], [], commits);
  }

  /**
   * Analyze memo effectiveness only
   * Note: This uses the same ANALYZE_COMMITS endpoint as wasted render analysis
   * but filters for memo-related results
   * @param commits - Array of commit data to analyze
   * @returns Promise resolving to analysis results
   */
  async analyzeMemo(commits: CommitData[]): Promise<AnalysisResult> {
    if (commits.length === 0) {
      return {
        timestamp: Date.now(),
        totalCommits: 0,
        wastedRenderReports: [],
        memoReports: [],
        performanceScore: 100,
        topOpportunities: [],
      };
    }

    // Get the analysis results and build memo reports from commit data
    const wastedRenderReports = await this.sendRequest<
      ExtendedAnalysisResult['wastedRenderReports']
    >('ANALYZE_COMMITS', { commits }, 'ANALYSIS_COMPLETE');

    // Build memo reports from commit data with memoized components
    const memoReports = this.buildMemoReports(commits);

    return this.buildAnalysisResult(wastedRenderReports || [], memoReports, commits);
  }

  /**
   * Build memo effectiveness reports from commit data
   */
  private buildMemoReports(commits: CommitData[]): MemoReport[] {
    const componentMap = new Map<
      string,
      {
        componentName: string;
        totalRenders: number;
        skippedRenders: number;
        hasMemo: boolean;
      }
    >();

    commits.forEach((commit) => {
      commit.nodes?.forEach((node) => {
        const key = node.displayName;
        if (!key || !node.isMemoized) return;

        if (!componentMap.has(key)) {
          componentMap.set(key, {
            componentName: key,
            totalRenders: 0,
            skippedRenders: 0,
            hasMemo: true,
          });
        }

        const data = componentMap.get(key);
        if (data) {
          data.totalRenders++;
          // Check if memo prevented render (props equal = render prevented)
          const propsEqual = this.shallowEqual(node.prevProps, node.props);
          if (propsEqual) {
            data.skippedRenders++;
          }
        }
      });
    });

    return Array.from(componentMap.values()).map((data) => {
      const currentHitRate = data.totalRenders > 0 ? data.skippedRenders / data.totalRenders : 0;

      return {
        componentName: data.componentName,
        hasMemo: data.hasMemo,
        currentHitRate: Math.round(currentHitRate * 100) / 100,
        optimalHitRate: 0.9,
        isEffective: currentHitRate > 0.7,
        issues: [],
        recommendations: [],
      };
    });
  }

  /**
   * Simple shallow equality check for objects
   */
  private shallowEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate performance score via worker
   * @param commits - Array of commit data
   * @param wastedRenderReports - Wasted render analysis results
   * @param memoReports - Memo effectiveness reports
   * @param config - Optional score configuration
   * @returns Promise resolving to performance metrics
   */
  async calculateScore(
    commits: CommitData[],
    wastedRenderReports: ExtendedAnalysisResult['wastedRenderReports'],
    memoReports: ExtendedAnalysisResult['memoReports'],
    config?: PerformanceScoreConfig
  ): Promise<{
    score: number;
    breakdown: {
      wastedRenderPenalty: number;
      memoEffectivenessBonus: number;
      renderEfficiencyScore: number;
    };
    details: {
      totalRenders: number;
      wastedRenders: number;
      memoizedComponents: number;
      effectiveMemoizedComponents: number;
    };
  }> {
    return this.sendRequest(
      'CALCULATE_SCORE',
      { commits, wastedRenderReports, memoReports, config },
      'SCORE_READY'
    );
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      // Reject all pending requests
      this.pendingRequests.forEach((request) => {
        request.reject(new Error('Worker terminated'));
      });
      this.pendingRequests.clear();

      this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * Singleton class for managing the RSC analysis worker
 */
class RSCWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, RSCPendingRequest<unknown>> = new Map();
  private requestId = 0;

  /**
   * Initialize the RSC worker
   */
  private initWorker(): Worker {
    if (this.worker) return this.worker;

    // Create worker using the RSC analysis worker module
    // In development, this uses the raw TS file; in production, it's the compiled JS
    this.worker = new Worker(new URL('./rscAnalysis.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (e: MessageEvent<RSCWorkerResponse>) => {
      const { id, type, result, error } = e.data;
      const request = this.pendingRequests.get(id);

      if (request) {
        if (type === 'ERROR') {
          request.reject(new Error(error || 'RSC analysis failed'));
        } else {
          request.resolve(result);
        }
        this.pendingRequests.delete(id);
      }
    };

    this.worker.onerror = (error) => {
      // Reject all pending requests
      this.pendingRequests.forEach((request) => {
        request.reject(new Error(`Worker error: ${error.message}`));
      });
      this.pendingRequests.clear();
    };

    this.worker.onmessageerror = (error) => {
      // Reject all pending requests on message error
      this.pendingRequests.forEach((request) => {
        request.reject(new Error(`Worker message error: ${error}`));
      });
      this.pendingRequests.clear();
    };

    return this.worker;
  }

  /**
   * Send a request to the RSC worker
   */
  private sendRequest<T>(type: RSCWorkerRequestType, payload: unknown): Promise<T> {
    const worker = this.initWorker();
    const id = `${Date.now()}-${++this.requestId}`;

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        type: this.getExpectedResponseType(type),
      });
      worker.postMessage({ id, type, payload } as RSCWorkerRequest);
    });
  }

  /**
   * Get the expected response type for a request type
   */
  private getExpectedResponseType(requestType: RSCWorkerRequestType): RSCWorkerResponseType {
    switch (requestType) {
      case 'PARSE_PAYLOAD':
        return 'PAYLOAD_PARSED';
      case 'EXTRACT_METRICS':
        return 'METRICS_EXTRACTED';
      case 'DETECT_BOUNDARIES':
        return 'BOUNDARIES_DETECTED';
      case 'ANALYZE_BOUNDARY_CROSSINGS':
        return 'CROSSINGS_ANALYZED';
      case 'ANALYZE_ALL':
        return 'ANALYSIS_COMPLETE';
      default:
        return 'ERROR';
    }
  }

  /**
   * Parse raw RSC payload data
   * @param data - Raw payload data (string or object)
   * @returns Promise resolving to parsed RSCPayload
   */
  async parseRSCPayload(data: string | object): Promise<RSCPayload> {
    return this.sendRequest<RSCPayload>('PARSE_PAYLOAD', { data });
  }

  /**
   * Extract metrics from parsed RSC payload
   * @param payload - Parsed RSC payload
   * @returns Promise resolving to RSCMetrics
   */
  async extractRSCMetrics(payload: RSCPayload): Promise<RSCMetrics> {
    return this.sendRequest<RSCMetrics>('EXTRACT_METRICS', { payload });
  }

  /**
   * Detect RSC boundaries from fiber data
   * @param fiberData - Array of fiber nodes
   * @returns Promise resolving to array of RSCBoundaries
   */
  async detectRSCBoundaries(fiberData: CommitData['nodes']): Promise<RSCBoundary[]> {
    return this.sendRequest<RSCBoundary[]>('DETECT_BOUNDARIES', { fiberData });
  }

  /**
   * Analyze boundary crossings in payload
   * @param payload - Parsed RSC payload
   * @returns Promise resolving to boundary crossing analysis
   */
  async analyzeBoundaryCrossings(payload: RSCPayload): Promise<{
    totalCrossings: number;
    serverToClient: number;
    clientToServer: number;
    largePropTransfers: Array<{
      boundaryId: string;
      componentName: string;
      propsSize: number;
      warning: boolean;
    }>;
  }> {
    return this.sendRequest('ANALYZE_BOUNDARY_CROSSINGS', { payload });
  }

  /**
   * Run complete RSC analysis on payloads
   * @param payloads - Array of raw payload data (strings or objects)
   * @param fiberData - Optional fiber data for boundary detection
   * @param config - Optional analysis configuration
   * @returns Promise resolving to complete RSC analysis result
   */
  async analyzeRSC(
    payloads: (string | object)[],
    fiberData?: CommitData['nodes'],
    config?: Partial<RSCAnalysisConfig>
  ): Promise<RSCAnalysisResult> {
    if (payloads.length === 0) {
      throw new Error('No payloads to analyze');
    }

    return this.sendRequest<RSCAnalysisResult>('ANALYZE_ALL', {
      payloads,
      fiberData,
      config,
    });
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      // Reject all pending requests
      this.pendingRequests.forEach((request) => {
        request.reject(new Error('Worker terminated'));
      });
      this.pendingRequests.clear();

      this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * Callback for timeline generation progress updates
 */
export type TimelineProgressCallback = (progress: TimelineProgress) => void;

/**
 * Timeline worker client for offloading timeline generation
 */
class TimelineWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<
    string,
    {
      resolve: (value: TimelineResult) => void;
      reject: (error: Error) => void;
      onProgress?: TimelineProgressCallback;
    }
  > = new Map();
  private requestId = 0;

  /**
   * Initialize the worker
   */
  private initWorker(): Worker {
    if (this.worker) return this.worker;

    // Create worker by importing the timeline worker module
    this.worker = new Worker(new URL('./timeline.worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (
      e: MessageEvent<{
        id: string;
        type: 'TIMELINE_PROGRESS' | 'TIMELINE_COMPLETE' | 'TIMELINE_ERROR';
        progress?: TimelineProgress;
        result?: TimelineResult;
        error?: string;
      }>
    ) => {
      const { id, type, progress, result, error } = e.data;
      const request = this.pendingRequests.get(id);

      if (!request) return;

      switch (type) {
        case 'TIMELINE_PROGRESS':
          if (progress && request.onProgress) {
            request.onProgress(progress);
          }
          break;
        case 'TIMELINE_COMPLETE':
          if (result) {
            request.resolve(result);
          } else {
            request.reject(new Error('Timeline generation returned no result'));
          }
          this.pendingRequests.delete(id);
          break;
        case 'TIMELINE_ERROR':
          request.reject(new Error(error || 'Timeline generation failed'));
          this.pendingRequests.delete(id);
          break;
      }
    };

    this.worker.onerror = (_error) => {
      // Reject all pending requests
      this.pendingRequests.forEach((request) => {
        request.reject(new Error('Worker error'));
      });
      this.pendingRequests.clear();
    };

    return this.worker;
  }

  /**
   * Generate timeline data via worker
   * @param commits - Array of commit data
   * @param config - Optional timeline configuration
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to timeline result
   */
  async generateTimeline(
    commits: CommitData[],
    config?: TimelineConfig,
    onProgress?: TimelineProgressCallback
  ): Promise<TimelineResult> {
    // Handle empty commits quickly without worker overhead
    if (commits.length === 0) {
      return {
        timeline: {
          startTime: 0,
          endTime: 0,
          events: [],
          commits: [],
        },
        markers: [],
        statistics: {
          totalRenders: 0,
          wastedRenders: 0,
          averageRenderDuration: 0,
          maxRenderDuration: 0,
          totalCommits: 0,
          timeRange: 0,
          renderRate: 0,
          wastedRenderPercentage: 0,
        },
        processingDuration: 0,
      };
    }

    const worker = this.initWorker();
    const id = `timeline-${Date.now()}-${++this.requestId}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, onProgress });
      worker.postMessage({
        id,
        type: 'GENERATE_TIMELINE',
        payload: { commits, config },
      });
    });
  }

  /**
   * Cancel the current timeline generation
   */
  cancel(): void {
    if (this.worker) {
      this.worker.postMessage({ id: 'cancel', type: 'CANCEL' });
    }
    // Reject all pending requests
    this.pendingRequests.forEach((request) => {
      request.reject(new Error('Timeline generation cancelled'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    this.cancel();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * Singleton instance of the general analysis worker client
 */
export const analysisWorker = new AnalysisWorkerClient();

/**
 * Singleton instance of the RSC analysis worker client
 */
export const rscWorker = new RSCWorkerClient();

/**
 * Singleton instance of the timeline worker client
 */
export const timelineWorker = new TimelineWorkerClient();
