/**
 * Jest setup for React performance testing.
 *
 * Usage:
 *   // jest.config.js
 *   setupFilesAfterFramework: ['@react-perf-profiler/test-plugin/jest']
 *
 *   // In tests:
 *   import { perfMatchers } from '@react-perf-profiler/test-plugin/matchers';
 *   expect.extend(perfMatchers);
 */

import { perfMatchers } from './matchers.js';
import { startCollection, stopCollection } from './collector.js';

// Auto-extend if in Jest environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).expect !== 'undefined' && typeof (globalThis as any).expect?.extend === 'function') {
  (globalThis as any).expect.extend(perfMatchers);
}

// Export for manual setup
export { perfMatchers, startCollection, stopCollection } from './index.js';
