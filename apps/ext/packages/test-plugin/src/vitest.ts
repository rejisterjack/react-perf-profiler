/**
 * Vitest plugin for React performance testing.
 *
 * Usage:
 *   // vitest.config.ts
 *   import { reactPerfPlugin } from '@react-perf-profiler/test-plugin/vitest';
 *   export default defineConfig({ plugins: [reactPerfPlugin()] });
 *
 *   // In tests:
 *   import { startCollection, stopCollection } from '@react-perf-profiler/test-plugin';
 *   import { perfMatchers } from '@react-perf-profiler/test-plugin/matchers';
 *
 *   expect.extend(perfMatchers);
 *
 *   beforeEach(() => startCollection());
 *   afterEach(() => stopCollection());
 */

import type { Plugin } from 'vitest/config';
import { startCollection, stopCollection } from './collector.js';

export function reactPerfPlugin(): Plugin {
  return {
    name: 'react-perf-profiler',
    config: () => ({
      test: {
        setupFiles: [],
      },
    }),
  };
}

export { startCollection, stopCollection, getCapturedCommits, onCommit } from './collector.js';
export { perfMatchers } from './matchers.js';
export type { CapturedCommit } from './collector.js';
export type { PerfMatchers } from './matchers.js';
