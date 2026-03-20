/**
 * Performance Benchmarks for React Perf Profiler
 * 
 * These tests measure the performance of core analysis functions
 * to ensure they meet the target thresholds.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { analyzeWastedRenders } from '@/panel/utils/wastedRenderAnalysis';
import { analyzeMemoEffectiveness } from '@/panel/utils/memoAnalysis';
import { calculatePerformanceScore } from '@/panel/utils/performanceScore';
import { parseRSCPayload, extractRSCMetrics } from '@/panel/utils/rscParser';
import { walkFiberTree, parseFiberRoot } from '@/content/fiberParser';
import type { CommitData, FiberNode, FiberData } from '@/shared/types';
import type { RSCPayload } from '@/shared/types/rsc';

// Performance threshold constants (in milliseconds)
const THRESHOLDS = {
  wastedRenderAnalysis: 100,    // For 1000 components
  memoAnalysis: 50,             // Per component
  performanceScore: 10,         // Total calculation
  rscPayloadParse: 20,          // Per 100KB payload
  rscMetricsExtract: 10,        // Per payload
  fiberTreeWalk: 50,            // For 10000 nodes
  fiberRootParse: 100,          // For full commit
};

// Helper to measure execution time
function measureTime<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
}

// Generate mock commit data with specified size
function generateMockCommits(
  commitCount: number,
  nodesPerCommit: number
): CommitData[] {
  return Array.from({ length: commitCount }, (_, i) => ({
    id: `commit-${i}`,
    timestamp: Date.now() + i * 100,
    priorityLevel: 'Normal',
    duration: Math.random() * 16,
    nodes: generateMockFiberNodes(nodesPerCommit),
  }));
}

function generateMockFiberNodes(count: number): FiberNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    displayName: `Component${i}`,
    actualDuration: Math.random() * 5,
    baseDuration: Math.random() * 10,
    props: { id: i, data: `value-${i}` },
    prevProps: i > 0 ? { id: i, data: `value-${i - 1}` } : undefined,
    state: { count: i },
    prevState: i > 0 ? { count: i - 1 } : undefined,
    hasContextChanged: false,
    parentId: i > 0 ? Math.floor((i - 1) / 2) : null,
    children: [],
    isMemoized: i % 3 === 0,
    memoType: i % 3 === 0 ? 'React.memo' : undefined,
  }));
}

// Generate mock RSC payload
function generateMockRSCPayload(size: number): RSCPayload {
  const chunks = Array.from({ length: Math.ceil(size / 10000) }, (_, i) => ({
    id: `chunk-${i}`,
    sequence: i,
    data: 'x'.repeat(Math.min(10000, size - i * 10000)),
    parsedData: null,
    size: Math.min(10000, size - i * 10000),
    timestamp: Date.now() + i,
    containsBoundary: i % 5 === 0,
    boundaryIds: [`boundary-${i % 5}`],
    elements: [] as any[],
  }));

  return {
    chunks,
    boundaries: Array.from({ length: 5 }, (_, i) => ({
      id: `boundary-${i}`,
      componentName: `Component${i}`,
      type: (i % 2 === 0 ? 'server' : 'client') as 'server' | 'client' | 'shared',
      depth: Math.floor(i / 2),
      props: { id: i },
      renderTime: Math.random() * 50,
      payloadSize: 10000,
      cacheStatus: (['hit', 'miss', 'stale', 'pending'][i % 4]) as 'hit' | 'miss' | 'stale' | 'pending',
      cacheTTL: 3600,
    })),
    id: `payload-${Date.now()}`,
    metadata: {
      reactVersion: '18.2.0',
      framework: 'next.js',
      frameworkVersion: '14.0.0',
      streamingEnabled: true,
      generatedAt: Date.now(),
    },
    metrics: {
      totalPayloadSize: size,
      transferTime: Math.random() * 100,
      serializationCost: Math.random() * 20,
      deserializationCost: Math.random() * 10,
      boundaryCount: 5,
      serverComponentCount: 3,
      clientBoundaryCount: 2,
      cacheHits: 3,
      cacheMisses: 2,
      cacheHitRatio: 0.6,
    },
    streamMetrics: {
      totalChunks: chunks.length,
      interleavedChunks: 0,
      timeToFirstChunk: chunks[0]?.timestamp || 0,
      timeToLastChunk: chunks[chunks.length - 1]?.timestamp || 0,
      averageChunkSize: size / chunks.length,
      maxChunkSize: 10000,
      minChunkSize: 1000,
      boundaryChunks: chunks.filter(c => c.containsBoundary).length,
      timeToFirstByte: Math.random() * 50,
      streamDuration: Math.random() * 100,
      suspenseResolutions: 2,
    },
  };
}

describe('Performance Benchmarks', () => {
  describe('Wasted Render Analysis', () => {
    it(`should analyze 1000 components in < ${THRESHOLDS.wastedRenderAnalysis}ms`, () => {
      const commits = generateMockCommits(10, 100);
      
      const { duration } = measureTime(() => {
        return analyzeWastedRenders(commits, []);
      });
      
      console.log(`Wasted render analysis (1000 components): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.wastedRenderAnalysis);
    });

    it(`should handle 10000 components in < ${THRESHOLDS.wastedRenderAnalysis * 5}ms`, () => {
      const commits = generateMockCommits(10, 1000);
      
      const { duration } = measureTime(() => {
        return analyzeWastedRenders(commits, []);
      });
      
      console.log(`Wasted render analysis (10000 components): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.wastedRenderAnalysis * 5);
    });
  });

  describe('Memo Analysis', () => {
    it(`should analyze memoization in < ${THRESHOLDS.memoAnalysis * 10}ms for 50 components`, () => {
      const commits = generateMockCommits(10, 10);
      const componentMetrics = Array.from({ length: 50 }, (_, i) => ({
        componentName: `Component${i}`,
        renderCount: 100,
        wastedRenderCount: 30,
        wastedRenderRate: 0.3,
        totalRenderTime: 500,
        averageRenderTime: 5,
        maxRenderTime: 20,
        minRenderTime: 1,
        isMemoized: i % 2 === 0,
        memoHitRate: 0.7,
        firstSeen: Date.now() - 10000,
        lastSeen: Date.now(),
      }));

      const { duration } = measureTime(() => {
        return analyzeMemoEffectiveness(commits, componentMetrics);
      });
      
      console.log(`Memo analysis (50 components): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.memoAnalysis * 10);
    });
  });

  describe('Performance Score Calculation', () => {
    it(`should calculate score in < ${THRESHOLDS.performanceScore}ms`, () => {
      const wastedReports = Array.from({ length: 50 }, (_, i) => ({
        componentName: `Component${i}`,
        renderCount: 100,
        wastedRenders: 20 + (i % 30),
        wastedRenderRate: 0.2 + (i % 30) / 100,
        recommendedAction: 'memo' as const,
        estimatedSavingsMs: 10,
        severity: ['low', 'medium', 'high', 'critical'][i % 4] as 'low' | 'medium' | 'high' | 'critical',
        issues: [],
        totalRenders: 100,
        recommendations: ['Wrap component with React.memo'],
      }));

      const memoReports = Array.from({ length: 50 }, (_, i) => ({
        componentName: `Component${i}`,
        currentHitRate: 0.5 + Math.random() * 0.5,
        optimalHitRate: 0.9,
        isEffective: i % 2 === 0,
        issues: [],
        recommendations: [],
      }));

      const commits = generateMockCommits(100, 10);
      
      const { duration } = measureTime(() => {
        return calculatePerformanceScore(
          commits,
          wastedReports,
          memoReports,
        );
      });
      
      console.log(`Performance score calculation: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.performanceScore);
    });
  });

  describe('RSC Analysis', () => {
    it(`should parse 100KB RSC payload in < ${THRESHOLDS.rscPayloadParse}ms`, () => {
      const payload = generateMockRSCPayload(100000);
      
      const { duration } = measureTime(() => {
        return parseRSCPayload(JSON.stringify(payload));
      });
      
      console.log(`RSC payload parse (100KB): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.rscPayloadParse);
    });

    it(`should extract RSC metrics in < ${THRESHOLDS.rscMetricsExtract}ms`, () => {
      const payload = generateMockRSCPayload(50000);
      
      const { duration } = measureTime(() => {
        return extractRSCMetrics(payload);
      });
      
      console.log(`RSC metrics extraction: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.rscMetricsExtract);
    });
  });

  describe('Fiber Parsing', () => {
    it(`should walk 10000 fiber nodes in < ${THRESHOLDS.fiberTreeWalk}ms`, () => {
      // Create a mock fiber tree
      const createFiberTree = (depth: number, breadth: number): any => {
        const createNode = (level: number, index: number): any => {
          const node: any = {
            id: `${level}-${index}`,
            tag: 0,
            type: `Component${level}-${index}`,
            memoizedProps: { id: index },
            memoizedState: null,
            actualDuration: Math.random() * 5,
            actualStartTime: Date.now(),
            selfBaseDuration: Math.random() * 2,
            treeBaseDuration: Math.random() * 5,
            return: null,
            child: null,
            sibling: null,
          };
          
          if (level < depth) {
            node.child = createNode(level + 1, index * breadth);
            node.child.return = node;
            let current = node.child;
            for (let i = 1; i < breadth; i++) {
              current.sibling = createNode(level + 1, index * breadth + i);
              current.sibling.return = node;
              current = current.sibling;
            }
          }
          
          return node;
        };
        
        return createNode(0, 0);
      };

      const rootFiber = createFiberTree(3, 21); // ~9261 nodes
      let count = 0;
      
      const { duration } = measureTime(() => {
        walkFiberTree(rootFiber, () => {
          count++;
        });
      });
      
      console.log(`Fiber tree walk (${count} nodes): ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(THRESHOLDS.fiberTreeWalk);
      expect(count).toBeGreaterThan(9000);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated analysis', () => {
      const commits = generateMockCommits(5, 100);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run analysis 100 times
      for (let i = 0; i < 100; i++) {
        analyzeWastedRenders(commits, []);
      }
      
      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      console.log(`Memory increase after 100 analyses: ${memoryIncrease.toFixed(2)}MB`);
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });

  describe('Throughput', () => {
    it('should analyze > 1000 commits per second', () => {
      const commits = generateMockCommits(100, 10);
      
      const start = performance.now();
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        analyzeWastedRenders(commits, []);
      }
      
      const duration = performance.now() - start;
      const commitsPerSecond = (100 * iterations) / (duration / 1000);
      
      console.log(`Analysis throughput: ${commitsPerSecond.toFixed(0)} commits/second`);
      expect(commitsPerSecond).toBeGreaterThan(1000);
    });
  });
});

describe('Bundle Size Budgets', () => {
  it('should document bundle size constraints', () => {
    // These are the target bundle sizes
    const budgets = {
      'panel.js': 200 * 1024,      // 200KB
      'background.js': 50 * 1024,   // 50KB
      'content.js': 30 * 1024,      // 30KB
      'devtools.js': 20 * 1024,     // 20KB
      'popup.js': 20 * 1024,        // 20KB
    };

    // Log budgets for documentation
    console.log('Bundle Size Budgets:');
    Object.entries(budgets).forEach(([file, size]) => {
      console.log(`  ${file}: ${(size / 1024).toFixed(0)}KB`);
    });

    // This test always passes - it's for documentation
    expect(true).toBe(true);
  });
});
