/**
 * Runtime performance monitor.
 * Tracks the extension's own memory usage, analysis durations, and UI responsiveness.
 */

import { trackEvent } from '@/shared/telemetry';

interface PerfSample {
  timestamp: number;
  memoryUsedMB: number;
  analysisDurationMs: number | null;
  commitCount: number;
  componentCount: number;
}

const MAX_SAMPLES = 100;
const samples: PerfSample[] = [];

let analysisStart: number | null = null;

export function startAnalysisTimer(): void {
  analysisStart = performance.now();
}

export function endAnalysisTimer(commitCount: number, componentCount: number): void {
  const duration = analysisStart ? performance.now() - analysisStart : null;
  analysisStart = null;

  const memoryMB = getMemoryMB();

  const sample: PerfSample = {
    timestamp: Date.now(),
    memoryUsedMB: memoryMB,
    analysisDurationMs: duration,
    commitCount,
    componentCount,
  };

  samples.push(sample);
  if (samples.length > MAX_SAMPLES) samples.shift();

  if (duration !== null) {
    trackEvent('analysis_complete', {
      duration_ms: Math.round(duration),
      commit_count: commitCount,
      component_count: componentCount,
      memory_mb: memoryMB,
    });
  }
}

export function getMemoryMB(): number {
  // chrome.performance.memory is available in some contexts
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  if (perf.memory) {
    return Math.round((perf.memory.usedJSHeapSize / 1024 / 1024) * 100) / 100;
  }
  return 0;
}

export function getPerfSamples(): PerfSample[] {
  return [...samples];
}

export function getPerfSummary(): {
  sampleCount: number;
  avgAnalysisMs: number | null;
  maxAnalysisMs: number | null;
  p95AnalysisMs: number | null;
  peakMemoryMB: number;
  currentMemoryMB: number;
} {
  const durations = samples
    .map((s) => s.analysisDurationMs)
    .filter((d): d is number => d !== null);

  const avg = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : null;

  const max = durations.length ? Math.max(...durations) : null;

  let p95: number | null = null;
  if (durations.length >= 2) {
    const sorted = [...durations].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    p95 = sorted[Math.min(idx, sorted.length - 1)]!;
  }

  const memValues = samples.map((s) => s.memoryUsedMB).filter((m) => m > 0);

  return {
    sampleCount: samples.length,
    avgAnalysisMs: avg !== null ? Math.round(avg) : null,
    maxAnalysisMs: max !== null ? Math.round(max) : null,
    p95AnalysisMs: p95 !== null ? Math.round(p95) : null,
    peakMemoryMB: memValues.length ? Math.max(...memValues) : 0,
    currentMemoryMB: getMemoryMB(),
  };
}

// Take a periodic memory sample every 30s during recording
let memoryInterval: ReturnType<typeof setInterval> | null = null;

export function startMemorySampling(): void {
  stopMemorySampling();
  memoryInterval = setInterval(() => {
    const memoryMB = getMemoryMB();
    if (memoryMB > 0) {
      samples.push({
        timestamp: Date.now(),
        memoryUsedMB: memoryMB,
        analysisDurationMs: null,
        commitCount: 0,
        componentCount: 0,
      });
      if (samples.length > MAX_SAMPLES) samples.shift();
    }
  }, 30_000);
}

export function stopMemorySampling(): void {
  if (memoryInterval) {
    clearInterval(memoryInterval);
    memoryInterval = null;
  }
}
