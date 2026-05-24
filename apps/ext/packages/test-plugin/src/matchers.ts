/**
 * Custom matchers for React performance assertions.
 * Compatible with both Vitest and Jest expect.extend().
 */

import type { CapturedCommit } from './collector';

interface MatcherResult {
  pass: boolean;
  message: () => string;
}

interface CommitData {
  componentName: string;
  commits: CapturedCommit[];
}

function getCommitsForComponent(
  received: string | CommitData,
  componentName?: string,
): { name: string; commits: CapturedCommit[] } {
  if (typeof received === 'string') {
    return { name: received, commits: [] };
  }
  return { name: received.componentName, commits: received.commits };
}

export interface PerfMatchers {
  notToHaveWastedRenders(options?: { threshold?: number }): MatcherResult;
  toHaveMemoHitRateAbove(minRate: number): MatcherResult;
  toHaveRenderCountBelow(maxRenders: number): MatcherResult;
  toHaveAverageRenderTimeBelow(maxMs: number): MatcherResult;
}

export const perfMatchers = {
  notToHaveWastedRenders(
    received: string | { componentName: string; commits: CapturedCommit[] },
    options?: { threshold?: number },
  ): MatcherResult {
    const { name, commits } = getCommitsForComponent(received);
    const threshold = options?.threshold ?? 30;

    const componentCommits = commits.filter(c =>
      c.fibers.some(f => f.displayName === name)
    );

    if (componentCommits.length === 0) {
      return {
        pass: true,
        message: () => `No commits found for component "${name}"`,
      };
    }

    const totalRenders = componentCommits.length;
    const wastedRenders = componentCommits.filter(c => {
      const fiber = c.fibers.find(f => f.displayName === name);
      return fiber && fiber.actualDuration === 0;
    }).length;
    const wastedRate = (wastedRenders / totalRenders) * 100;
    const pass = wastedRate <= threshold;

    return {
      pass,
      message: () => pass
        ? `Expected "${name}" to have wasted render rate above ${threshold}% but got ${wastedRate.toFixed(1)}%`
        : `Expected "${name}" to have wasted render rate below ${threshold}% but got ${wastedRate.toFixed(1)}% (${wastedRenders}/${totalRenders} wasted)`,
    };
  },

  toHaveMemoHitRateAbove(
    received: string | { componentName: string; commits: CapturedCommit[] },
    minRate: number,
  ): MatcherResult {
    const { name, commits } = getCommitsForComponent(received);
    const componentCommits = commits.filter(c =>
      c.fibers.some(f => f.displayName === name)
    );

    if (componentCommits.length === 0) {
      return { pass: false, message: () => `No commits found for component "${name}"` };
    }

    // Check if component is memoized (tag 14 or 15)
    const memoizedCommits = componentCommits.filter(c => {
      const fiber = c.fibers.find(f => f.displayName === name);
      return fiber && (fiber.tag === 14 || fiber.tag === 15);
    });

    const hitRate = memoizedCommits.length > 0
      ? (memoizedCommits.filter(c => {
          const fiber = c.fibers.find(f => f.displayName === name);
          return fiber && fiber.actualDuration === 0;
        }).length / memoizedCommits.length) * 100
      : 0;

    return {
      pass: hitRate >= minRate,
      message: () => `Expected "${name}" memo hit rate to be above ${minRate}% but got ${hitRate.toFixed(1)}%`,
    };
  },

  toHaveRenderCountBelow(
    received: string | { componentName: string; commits: CapturedCommit[] },
    maxRenders: number,
  ): MatcherResult {
    const { name, commits } = getCommitsForComponent(received);
    const count = commits.filter(c =>
      c.fibers.some(f => f.displayName === name)
    ).length;

    return {
      pass: count <= maxRenders,
      message: () => `Expected "${name}" render count to be below ${maxRenders} but got ${count}`,
    };
  },

  toHaveAverageRenderTimeBelow(
    received: string | { componentName: string; commits: CapturedCommit[] },
    maxMs: number,
  ): MatcherResult {
    const { name, commits } = getCommitsForComponent(received);
    const durations = commits
      .map(c => c.fibers.find(f => f.displayName === name)?.actualDuration)
      .filter((d): d is number => d !== undefined);

    const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      pass: avg <= maxMs,
      message: () => `Expected "${name}" average render time to be below ${maxMs}ms but got ${avg.toFixed(2)}ms`,
    };
  },
};
