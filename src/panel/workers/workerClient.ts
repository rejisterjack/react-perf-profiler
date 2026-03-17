/**
 * Web Worker client for offloading analysis tasks
 * @module panel/workers/workerClient
 */

import type { CommitData, AnalysisResult } from '@/shared/types';

/**
 * Request message sent to the worker
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
 * Response message received from the worker
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
 * Singleton class for managing the analysis worker
 */
class AnalysisWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: (value: AnalysisResult) => void; reject: (error: Error) => void }> = new Map();
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

    this.worker.onerror = (error) => {
      console.error('Analysis worker error:', error);
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
 * Singleton instance of the analysis worker client
 */
export const analysisWorker = new AnalysisWorkerClient();
