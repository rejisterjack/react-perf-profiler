/**
 * Golden checks: profile JSON fixtures run through the same analysis helpers used in the worker.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { analyzeWastedRenders } from '@/panel/utils/wastedRenderAnalysis';
import { calculatePerformanceScore } from '@/panel/utils/performanceScore';
import type { ProfileData } from '@/shared/performance-budgets/types';

describe('golden profile analysis pipeline', () => {
  it('passing fixture: score in range, no wasted-render reports for single commit', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(path.join(dir, '../../fixtures/perf-profile-passing.json'), 'utf-8');
    const profile = JSON.parse(raw) as ProfileData;
    const wasted = analyzeWastedRenders(profile.commits);
    const metrics = calculatePerformanceScore(profile.commits, wasted, []);
    expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
    expect(metrics.overallScore).toBeLessThanOrEqual(100);
    expect(wasted).toEqual([]);
  });

  it('violation fixture: still yields bounded score', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(path.join(dir, '../../fixtures/perf-profile-violations.json'), 'utf-8');
    const profile = JSON.parse(raw) as ProfileData;
    const wasted = analyzeWastedRenders(profile.commits);
    const metrics = calculatePerformanceScore(profile.commits, wasted, []);
    expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
    expect(metrics.overallScore).toBeLessThanOrEqual(100);
  });
});
