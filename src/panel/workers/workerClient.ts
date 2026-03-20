/**
 * Web Worker client for offloading analysis tasks
 * @module panel/workers/workerClient
 */

import type { CommitData, AnalysisResult } from '@/shared/types';
import type {
  RSCPayload,
  RSCMetrics,
  RSCBoundary,
  RSCAnalysisResult,
  RSCAnalysisConfig,
} from '@/shared/types/rsc';
import type {
  RSCWorkerRequest,
  RSCWorkerResponse,
  RSCWorkerRequestType,
  RSCWorkerResponseType,
} from './rscAnalysis.worker';
import type {
  TimelineConfig,
  TimelineResult,
  TimelineProgress,
} from './timeline.worker';

/**
 * Request message sent to the general analysis worker
 */
interface WorkerRequest {
  /** Unique request ID */
  id: string;
  /** Type of analysis to perform */
  type: 'analyzeAll' | 'analyzeWastedRenders' | 'analyzeMemo';
  /** Data to analyze */
  payload: CommitData[];
}

/**
 * Response message received from the general analysis worker
 */
interface WorkerResponse {
  /** Request ID this response corresponds to */
  id: string;
  /** Whether the analysis succeeded */
  success: boolean;
  /** Result data if successful */
  data?: AnalysisResult;
  /** Error message if failed */
  error?: string;
}

/**
 * RSC analysis pending request
 */
interface RSCPendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  type: RSCWorkerResponseType;
}

/**
 * Singleton class for managing the analysis worker
 */
class AnalysisWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<
    string,
    { resolve: (value: AnalysisResult) => void; reject: (error: Error) => void }
  > = new Map();
  private requestId = 0;

  /**
   * Initialize the worker
   */
  private initWorker(): Worker {
    if (this.worker) return this.worker;

    // Create worker from blob URL (inline worker)
    const workerCode = `
      self.onmessage = function(e) {
        const { id, type, payload } = e.data;
        
        try {
          let result;
          
          switch (type) {
            case 'analyzeAll':
              result = analyzeAll(payload);
              break;
            case 'analyzeWastedRenders':
              result = analyzeWastedRenders(payload);
              break;
            case 'analyzeMemo':
              result = analyzeMemo(payload);
              break;
            default:
              throw new Error('Unknown analysis type: ' + type);
          }
          
          self.postMessage({ id, success: true, data: result });
        } catch (error) {
          self.postMessage({ 
            id, 
            success: false, 
            error: error instanceof Error ? error.message : 'Analysis failed' 
          });
        }
      };
      
      function analyzeAll(commits) {
        const wastedRenderReports = analyzeWastedRenders(commits);
        const memoReports = analyzeMemo(commits);
        
        // Calculate performance score
        const totalWastedRate = wastedRenderReports.reduce((sum, r) => sum + r.wastedRenderRate, 0);
        const avgWastedRate = wastedRenderReports.length > 0 ? totalWastedRate / wastedRenderReports.length : 0;
        const performanceScore = Math.max(0, Math.round(100 - avgWastedRate));
        
        // Generate top opportunities
        const topOpportunities = wastedRenderReports
          .filter(r => r.wastedRenderRate > 20)
          .sort((a, b) => b.wastedRenderRate - a.wastedRenderRate)
          .slice(0, 5)
          .map(r => ({
            componentName: r.componentName,
            type: r.recommendedAction,
            impact: r.wastedRenderRate > 50 ? 'high' : 'medium',
            estimatedSavings: parseFloat(r.estimatedSavings) || 0,
            description: 'High wasted render rate detected',
          }));
        
        return {
          timestamp: Date.now(),
          totalCommits: commits.length,
          wastedRenderReports,
          memoReports,
          performanceScore,
          topOpportunities,
        };
      }
      
      function analyzeWastedRenders(commits) {
        const componentMap = new Map();
        
        commits.forEach(commit => {
          commit.nodes.forEach(node => {
            const key = node.displayName;
            if (!key) return;
            
            if (!componentMap.has(key)) {
              componentMap.set(key, {
                componentName: key,
                renderCount: 0,
                wastedRenders: 0,
                issues: [],
              });
            }
            
            const data = componentMap.get(key);
            data.renderCount++;
            
            // Simple heuristic: check if props and state are unchanged
            const propsEqual = shallowEqual(node.prevProps, node.props);
            const stateEqual = shallowEqual(node.prevState, node.state);
            
            if (propsEqual && stateEqual && !node.hasContextChanged) {
              data.wastedRenders++;
            }
          });
        });
        
        return Array.from(componentMap.values()).map(data => {
          const wastedRenderRate = data.renderCount > 0 
            ? (data.wastedRenders / data.renderCount) * 100 
            : 0;
            
          let recommendedAction = 'none';
          if (wastedRenderRate > 30) recommendedAction = 'memo';
          else if (wastedRenderRate > 15) recommendedAction = 'useMemo';
          else if (wastedRenderRate > 5) recommendedAction = 'useCallback';
          
          return {
            componentName: data.componentName,
            renderCount: data.renderCount,
            wastedRenders: data.wastedRenders,
            wastedRenderRate: Math.round(wastedRenderRate * 100) / 100,
            recommendedAction,
            estimatedSavings: (data.wastedRenders * 2) + 'ms',
            issues: data.issues,
          };
        });
      }
      
      function analyzeMemo(commits) {
        const componentMap = new Map();
        
        commits.forEach(commit => {
          commit.nodes.forEach(node => {
            const key = node.displayName;
            if (!key || !node.isMemoized) return;
            
            if (!componentMap.has(key)) {
              componentMap.set(key, {
                componentName: key,
                totalRenders: 0,
                skippedRenders: 0,
                issues: [],
              });
            }
            
            const data = componentMap.get(key);
            data.totalRenders++;
            
            // Check if memo prevented render
            const propsEqual = shallowEqual(node.prevProps, node.props);
            if (propsEqual) {
              data.skippedRenders++;
            }
          });
        });
        
        return Array.from(componentMap.values()).map(data => {
          const currentHitRate = data.totalRenders > 0 
            ? data.skippedRenders / data.totalRenders 
            : 0;
            
          return {
            componentName: data.componentName,
            currentHitRate: Math.round(currentHitRate * 100) / 100,
            optimalHitRate: 0.9,
            isEffective: currentHitRate > 0.7,
            issues: data.issues,
          };
        });
      }
      
      function shallowEqual(a, b) {
        if (a === b) return true;
        if (!a || !b) return false;
        
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        
        if (keysA.length !== keysB.length) return false;
        
        for (const key of keysA) {
          if (a[key] !== b[key]) return false;
        }
        
        return true;
      }
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    this.worker = new Worker(workerUrl);

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, success, data, error } = e.data;
      const request = this.pendingRequests.get(id);

      if (request) {
        if (success && data) {
          request.resolve(data);
        } else {
          request.reject(new Error(error || 'Analysis failed'));
        }
        this.pendingRequests.delete(id);
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
   * Send a request to the worker
   */
  private sendRequest(type: WorkerRequest['type'], payload: CommitData[]): Promise<AnalysisResult> {
    const worker = this.initWorker();
    const id = `${Date.now()}-${++this.requestId}`;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload } as WorkerRequest);
    });
  }

  /**
   * Run complete analysis on all commits
   * @param commits - Array of commit data to analyze
   * @returns Promise resolving to analysis results
   */
  async analyzeAll(commits: CommitData[]): Promise<AnalysisResult> {
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

    return this.sendRequest('analyzeAll', commits);
  }

  /**
   * Analyze wasted renders only
   * @param commits - Array of commit data to analyze
   * @returns Promise resolving to analysis results
   */
  async analyzeWastedRenders(commits: CommitData[]): Promise<AnalysisResult> {
    return this.sendRequest('analyzeWastedRenders', commits);
  }

  /**
   * Analyze memo effectiveness only
   * @param commits - Array of commit data to analyze
   * @returns Promise resolving to analysis results
   */
  async analyzeMemo(commits: CommitData[]): Promise<AnalysisResult> {
    return this.sendRequest('analyzeMemo', commits);
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
    this.worker = new Worker(
      new URL('./rscAnalysis.worker.ts', import.meta.url),
      { type: 'module' }
    );

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
  private sendRequest<T>(
    type: RSCWorkerRequestType,
    payload: unknown
  ): Promise<T> {
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
  async analyzeBoundaryCrossings(
    payload: RSCPayload
  ): Promise<{
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
    this.worker = new Worker(
      new URL('./timeline.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent<{
      id: string;
      type: 'TIMELINE_PROGRESS' | 'TIMELINE_COMPLETE' | 'TIMELINE_ERROR';
      progress?: TimelineProgress;
      result?: TimelineResult;
      error?: string;
    }>) => {
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
