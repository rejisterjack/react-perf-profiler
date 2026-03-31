/**
 * Memory Analyzer
 * Analyzes heap snapshots and correlates with React renders
 * @module panel/utils/memory/MemoryAnalyzer
 */


/**
 * Memory snapshot node
 */
export interface MemoryNode {
  id: number;
  name: string;
  type: 'object' | 'array' | 'function' | 'closure' | 'other';
  size: number;
  retainedSize: number;
  children: number[];
  allocatedAt?: number;
  componentName?: string;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeak {
  type: 'growing' | 'detached' | 'closure';
  componentName?: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  retainedSize: number;
  recommendation: string;
}

/**
 * Memory timeline entry
 */
export interface MemoryTimelineEntry {
  timestamp: number;
  usedHeapSize: number;
  totalHeapSize: number;
  componentAllocations: Map<string, number>;
}

/**
 * Memory Analyzer
 */
export class MemoryAnalyzer {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private snapshots: MemoryNode[][] = [];
  private timeline: MemoryTimelineEntry[] = [];

  /**
   * Record memory timeline entry
   */
  recordTimelineEntry(componentAllocations: Map<string, number>): void {
    if (!('memory' in performance)) return;

    const mem = (performance as any).memory;
    
    this.timeline.push({
      timestamp: Date.now(),
      usedHeapSize: mem.usedJSHeapSize,
      totalHeapSize: mem.totalJSHeapSize,
      componentAllocations: new Map(componentAllocations),
    });

    // Keep last 100 entries
    if (this.timeline.length > 100) {
      this.timeline = this.timeline.slice(-100);
    }
  }

  /**
   * Detect memory leaks
   */
  detectLeaks(): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];

    if (this.timeline.length < 2) return leaks;

    // Analyze growth trend
    const recent = this.timeline.slice(-10);
    const first = recent[0]!;
    const last = recent[recent.length - 1]!;
    const growth = last.usedHeapSize - first.usedHeapSize;
    const growthRate = growth / recent.length;

    if (growthRate > 1024 * 1024) { // > 1MB per entry
      leaks.push({
        type: 'growing',
        description: `Heap growing at ${this.formatBytes(growthRate)}/sample`,
        severity: growthRate > 5 * 1024 * 1024 ? 'critical' : 'warning',
        retainedSize: growth,
        recommendation: 'Check for accumulating event listeners, subscriptions, or caches',
      });
    }

    return leaks;
  }

  /**
   * Get memory flamegraph data
   */
  getFlamegraphData(): Array<{
    name: string;
    value: number;
    children: Array<{ name: string; value: number }>;
  }> {
    const data: Array<{
      name: string;
      value: number;
      children: Array<{ name: string; value: number }>;
    }> = [];

    // Aggregate by component
    const componentTotals = new Map<string, number>();
    for (const entry of this.timeline) {
      for (const [component, size] of entry.componentAllocations) {
        const current = componentTotals.get(component) || 0;
        componentTotals.set(component, current + size);
      }
    }

    for (const [component, totalSize] of componentTotals) {
      data.push({
        name: component,
        value: totalSize,
        children: [],
      });
    }

    return data.sort((a, b) => b.value - a.value);
  }

  /**
   * Get memory timeline for charting
   */
  getTimeline(): MemoryTimelineEntry[] {
    return this.timeline;
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.snapshots = [];
    this.timeline = [];
  }
}

// Singleton
let analyzer: MemoryAnalyzer | null = null;

export function getMemoryAnalyzer(): MemoryAnalyzer {
  if (!analyzer) {
    analyzer = new MemoryAnalyzer();
  }
  return analyzer;
}
