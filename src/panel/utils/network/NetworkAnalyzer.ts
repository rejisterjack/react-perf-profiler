/**
 * Network Analyzer
 * Correlates network requests with React renders
 * @module panel/utils/network/NetworkAnalyzer
 */

import { logger } from '@/shared/logger';

/**
 * Network request entry
 */
export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  status?: number;
  size?: number;
  initiator?: string;
  type: 'xhr' | 'fetch' | 'websocket' | 'other';
}

/**
 * Network-render correlation
 */
export interface NetworkRenderCorrelation {
  request: NetworkRequest;
  renders: Array<{
    componentName: string;
    timestamp: number;
    triggerType: 'data-received' | 'loading-state' | 'error-state';
  }>;
  totalRenderTime: number;
}

/**
 * Network waterfall entry
 */
export interface WaterfallEntry {
  timestamp: number;
  type: 'network' | 'render' | 'paint';
  name: string;
  duration: number;
  startTime: number;
  details?: Record<string, unknown>;
}

/**
 * Network Analyzer
 */
export class NetworkAnalyzer {
  private requests: NetworkRequest[] = [];
  private correlations: NetworkRenderCorrelation[] = [];
  private isListening = false;

  /**
   * Start listening to network requests
   */
  startListening(): void {
    if (this.isListening) return;

    // Hook into fetch
    this.hookFetch();
    
    // Hook into XMLHttpRequest
    this.hookXHR();

    this.isListening = true;
    logger.info('Network analyzer started', { source: 'NetworkAnalyzer' });
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    this.isListening = false;
    // Note: Hooks remain in place (can't be removed)
    logger.info('Network analyzer stopped', { source: 'NetworkAnalyzer' });
  }

  /**
   * Hook fetch API
   */
  private hookFetch(): void {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function(...args) {
      const url = args[0]?.toString() || 'unknown';
      const startTime = performance.now();
      
      const request: NetworkRequest = {
        id: crypto.randomUUID(),
        url,
        method: 'GET',
        startTime,
        type: 'fetch',
      };

      self.requests.push(request);

      try {
        const response = await originalFetch.apply(this, args);
        request.endTime = performance.now();
        request.status = response.status;
        return response;
      } catch (error) {
        request.endTime = performance.now();
        throw error;
      }
    };
  }

  /**
   * Hook XMLHttpRequest
   */
  private hookXHR(): void {
    const OriginalXHR = window.XMLHttpRequest;
    const self = this;

    window.XMLHttpRequest = (() => {
      const xhr = new OriginalXHR();
      let request: NetworkRequest | null = null;

      const originalOpen = xhr.open;
      xhr.open = function(method: string, url: string) {
        request = {
          id: crypto.randomUUID(),
          url,
          method,
          startTime: performance.now(),
          type: 'xhr',
        };
        return originalOpen.apply(this, arguments as any);
      };

      const originalSend = xhr.send;
      xhr.send = function() {
        if (request) {
          self.requests.push(request);
          
          xhr.addEventListener('loadend', () => {
            request!.endTime = performance.now();
            request!.status = xhr.status;
          });
        }
        return originalSend.apply(this, arguments as any);
      };

      return xhr;
    }) as any;
  }

  /**
   * Correlate network requests with renders
   */
  correlateWithRenders(
    renderEvents: Array<{ componentName: string; timestamp: number; reason: string }>
  ): NetworkRenderCorrelation[] {
    const correlations: NetworkRenderCorrelation[] = [];

    for (const request of this.requests) {
      const relatedRenders = renderEvents.filter(render => {
        // Render happened during or shortly after request
        const timeDiff = render.timestamp - (request.endTime || request.startTime);
        return timeDiff >= 0 && timeDiff < 100; // Within 100ms
      }).map(render => ({
        componentName: render.componentName,
        timestamp: render.timestamp,
        triggerType: this.determineTriggerType(render.reason),
      }));

      if (relatedRenders.length > 0) {
        correlations.push({
          request,
          renders: relatedRenders,
          totalRenderTime: relatedRenders.length * 16, // Estimate
        });
      }
    }

    this.correlations = correlations;
    return correlations;
  }

  /**
   * Determine trigger type from render reason
   */
  private determineTriggerType(reason: string): 'data-received' | 'loading-state' | 'error-state' {
    if (reason.includes('error')) return 'error-state';
    if (reason.includes('load') || reason.includes('data')) return 'data-received';
    return 'loading-state';
  }

  /**
   * Generate waterfall data
   */
  generateWaterfall(
    renderEvents: Array<{ componentName: string; timestamp: number; duration: number }>
  ): WaterfallEntry[] {
    const entries: WaterfallEntry[] = [];

    // Add network requests
    for (const request of this.requests) {
      entries.push({
        timestamp: request.startTime,
        type: 'network',
        name: new URL(request.url).pathname.split('/').pop() || request.url,
        duration: (request.endTime || request.startTime) - request.startTime,
        startTime: request.startTime,
        details: { status: request.status, size: request.size },
      });
    }

    // Add renders
    for (const render of renderEvents) {
      entries.push({
        timestamp: render.timestamp,
        type: 'render',
        name: render.componentName,
        duration: render.duration,
        startTime: render.timestamp,
      });
    }

    // Sort by start time
    return entries.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Get slow requests that triggered renders
   */
  getSlowCorrelatedRequests(threshold = 500): NetworkRenderCorrelation[] {
    return this.correlations.filter(
      c => (c.request.endTime! - c.request.startTime) > threshold
    );
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.requests = [];
    this.correlations = [];
  }

  /**
   * Get all requests
   */
  getRequests(): NetworkRequest[] {
    return this.requests;
  }
}

// Singleton
let analyzer: NetworkAnalyzer | null = null;

export function getNetworkAnalyzer(): NetworkAnalyzer {
  if (!analyzer) {
    analyzer = new NetworkAnalyzer();
  }
  return analyzer;
}
