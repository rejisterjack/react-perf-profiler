/**
 * Content Script Utilities
 * Helper functions for data serialization, throttling, and ID generation
 */

import type { CommitData } from './types';

/**
 * Generate a unique commit ID
 * Format: commit-{timestamp}-{random}
 */
export function generateCommitId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `commit-${timestamp}-${random}`;
}

/**
 * Generate a short unique ID
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Serialize commit data for messaging
 * Converts to JSON string with handling for circular references and large data
 */
export function serializeCommitData(data: CommitData): string {
  const seen = new WeakSet();
  const warnings: string[] = [];
  
  const serialized = JSON.stringify(data, (key, value) => {
    // Skip internal React properties
    if (key.startsWith('__react')) {
      return undefined;
    }
    
    // Handle circular references
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
      
      // Limit array size
      if (Array.isArray(value) && value.length > 1000) {
        warnings.push(`Array "${key}" truncated from ${value.length} to 1000 items`);
        return value.slice(0, 1000);
      }
      
      // Limit object key count
      if (!Array.isArray(value)) {
        const keys = Object.keys(value);
        if (keys.length > 100) {
          warnings.push(`Object "${key}" truncated from ${keys.length} to 100 keys`);
          const truncated: Record<string, any> = {};
          keys.slice(0, 100).forEach(k => {
            truncated[k] = value[k];
          });
          return truncated;
        }
      }
    }
    
    // Handle functions
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }
    
    // Handle symbols
    if (typeof value === 'symbol') {
      return `[Symbol: ${value.toString()}]`;
    }
    
    // Handle big integers
    if (typeof value === 'bigint') {
      return `[BigInt: ${value.toString()}]`;
    }
    
    // Handle undefined
    if (value === undefined) {
      return '[undefined]';
    }
    
    return value;
  });
  
  if (warnings.length > 0) {
    console.warn('[React Perf Profiler] Serialization warnings:', warnings);
  }
  
  return serialized;
}

/**
 * Deserialize commit data from string
 */
export function deserializeCommitData(serialized: string): CommitData {
  return JSON.parse(serialized);
}

/**
 * Throttle function calls to limit rate
 * Ensures the function is not called more than once per limit period
 */
export function throttleCommits<T extends (...args: any[]) => void>(
  fn: T,
  limitMs: number
): T {
  let inThrottle = false;
  let pendingArgs: Parameters<T> | null = null;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  
  const throttled = function (this: any, ...args: Parameters<T>): void {
    if (!inThrottle) {
      // Execute immediately
      fn.apply(this, args);
      inThrottle = true;
      
      // Reset throttle after limit period
      setTimeout(() => {
        inThrottle = false;
        
        // Execute pending call if any
        if (pendingArgs !== null) {
          throttled.apply(this, pendingArgs);
          pendingArgs = null;
        }
      }, limitMs);
    } else {
      // Store args for later execution
      pendingArgs = args;
      
      // Clear existing timeout
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
      }
      
      // Set new timeout to execute pending call
      pendingTimeout = setTimeout(() => {
        if (pendingArgs !== null) {
          throttled.apply(this, pendingArgs);
          pendingArgs = null;
        }
      }, limitMs);
    }
  } as T;
  
  return throttled;
}

/**
 * Debounce function calls
 * Delays execution until after wait milliseconds have elapsed since last call
 */
export function debounceCommits<T extends (...args: any[]) => void>(
  fn: T,
  waitMs: number
): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = function (this: any, ...args: Parameters<T>): void {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      fn.apply(this, args);
      timeout = null;
    }, waitMs);
  } as T;
  
  return debounced;
}

/**
 * Batch multiple commits for efficient transmission
 */
export class CommitBatcher {
  private commits: CommitData[] = [];
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private readonly maxSize: number;
  private readonly flushInterval: number;
  private flushCallback: (commits: CommitData[]) => void;
  
  constructor(
    flushCallback: (commits: CommitData[]) => void,
    options: { maxSize?: number; flushInterval?: number } = {}
  ) {
    this.flushCallback = flushCallback;
    this.maxSize = options.maxSize ?? 50;
    this.flushInterval = options.flushInterval ?? 100;
  }
  
  /**
   * Add a commit to the batch
   */
  add(commit: CommitData): void {
    this.commits.push(commit);
    
    // Flush immediately if batch is full
    if (this.commits.length >= this.maxSize) {
      this.flush();
      return;
    }
    
    // Schedule flush
    if (this.timeout === null) {
      this.timeout = setTimeout(() => this.flush(), this.flushInterval);
    }
  }
  
  /**
   * Flush all pending commits
   */
  flush(): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.commits.length === 0) {
      return;
    }
    
    const batch = this.commits.splice(0, this.commits.length);
    this.flushCallback(batch);
  }
  
  /**
   * Clear all pending commits without flushing
   */
  clear(): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.commits = [];
  }
  
  /**
   * Get current batch size
   */
  get size(): number {
    return this.commits.length;
  }
  
  /**
   * Destroy the batcher
   */
  destroy(): void {
    this.clear();
    this.flushCallback = () => {};
  }
}

/**
 * Calculate approximate size of data in bytes
 */
export function calculateDataSize(data: any): number {
  try {
    const json = JSON.stringify(data);
    // Each character is approximately 2 bytes in JavaScript strings
    return json.length * 2;
  } catch (e) {
    return 0;
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Deep clone an object, handling circular references
 */
export function deepClone<T>(obj: T): T {
  const seen = new WeakMap();
  
  function clone(value: any): any {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    if (seen.has(value)) {
      return seen.get(value);
    }
    
    if (Array.isArray(value)) {
      const cloned: any[] = [];
      seen.set(value, cloned);
      value.forEach((item, index) => {
        cloned[index] = clone(item);
      });
      return cloned;
    }
    
    if (value instanceof Date) {
      return new Date(value.getTime());
    }
    
    if (value instanceof RegExp) {
      return new RegExp(value.source, value.flags);
    }
    
    const cloned: Record<string, any> = {};
    seen.set(value, cloned);
    
    for (const key of Object.keys(value)) {
      cloned[key] = clone(value[key]);
    }
    
    return cloned;
  }
  
  return clone(obj);
}

/**
 * Safely access nested properties
 */
export function safeGet<T>(
  obj: any,
  path: string,
  defaultValue: T
): T {
  try {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current !== undefined ? current : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Check if running in a valid extension context
 */
export function isExtensionContext(): boolean {
  try {
    return typeof chrome !== 'undefined' && 
           chrome.runtime && 
           chrome.runtime.id !== undefined;
  } catch (e) {
    return false;
  }
}

/**
 * Create a promise that resolves after a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number; maxDelay?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 100;
  const maxDelay = options.maxDelay ?? 5000;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delayMs = Math.min(
          baseDelay * Math.pow(2, attempt),
          maxDelay
        );
        await delay(delayMs);
      }
    }
  }
  
  throw lastError;
}

/**
 * Rate limiter for controlling message frequency
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  /**
   * Check if a request is allowed
   */
  allowRequest(): boolean {
    const now = Date.now();
    
    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(
      ts => now - ts < this.windowMs
    );
    
    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get time until next request is allowed
   */
  timeUntilNext(): number {
    if (this.timestamps.length < this.maxRequests) {
      return 0;
    }
    
    const oldest = this.timestamps[0];
    const now = Date.now();
    return Math.max(0, this.windowMs - (now - oldest));
  }
  
  /**
   * Reset the limiter
   */
  reset(): void {
    this.timestamps = [];
  }
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private samples: { timestamp: number; used: number }[] = [];
  private readonly maxSamples: number;
  
  constructor(maxSamples: number = 100) {
    this.maxSamples = maxSamples;
  }
  
  /**
   * Record current memory usage
   */
  sample(): void {
    if (typeof performance === 'undefined' || !(performance as any).memory) {
      return;
    }
    
    const memory = (performance as any).memory;
    this.samples.push({
      timestamp: Date.now(),
      used: memory.usedJSHeapSize,
    });
    
    // Keep only recent samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }
  
  /**
   * Get average memory usage
   */
  getAverage(): number {
    if (this.samples.length === 0) return 0;
    const total = this.samples.reduce((sum, s) => sum + s.used, 0);
    return total / this.samples.length;
  }
  
  /**
   * Get peak memory usage
   */
  getPeak(): number {
    if (this.samples.length === 0) return 0;
    return Math.max(...this.samples.map(s => s.used));
  }
  
  /**
   * Clear all samples
   */
  clear(): void {
    this.samples = [];
  }
  
  /**
   * Get memory trend (increasing/decreasing)
   */
  getTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.samples.length < 10) return 'stable';
    
    const recent = this.samples.slice(-10);
    const first = recent[0].used;
    const last = recent[recent.length - 1].used;
    const change = (last - first) / first;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }
}
