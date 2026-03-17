import { describe, it, expect } from 'vitest';
import type { CommitData, FiberData } from '@/content/types';

// Timeline generator utility (to be implemented in src)
interface TimelineEvent {
  id: string;
  timestamp: number;
  duration: number;
  componentName: string;
  type: 'render' | 'commit';
  depth: number;
}

interface TimelineData {
  events: TimelineEvent[];
  startTime: number;
  endTime: number;
  totalDuration: number;
}

/**
 * Generate timeline data from commits
 */
function generateTimeline(commits: CommitData[]): TimelineData {
  if (commits.length === 0) {
    return {
      events: [],
      startTime: 0,
      endTime: 0,
      totalDuration: 0,
    };
  }

  const events: TimelineEvent[] = [];
  let minTime = Infinity;
  let maxTime = 0;

  for (const commit of commits) {
    minTime = Math.min(minTime, commit.timestamp);
    maxTime = Math.max(maxTime, commit.timestamp + commit.duration);

    // Add commit event
    events.push({
      id: `commit-${commit.commitId || commit.id}`,
      timestamp: commit.timestamp,
      duration: commit.duration,
      componentName: 'Commit',
      type: 'commit',
      depth: 0,
    });

    // Add fiber render events
    if (commit.fibers) {
      for (const fiber of commit.fibers) {
        events.push({
          id: `render-${fiber.id}-${commit.commitId || commit.id}`,
          timestamp: fiber.actualStartTime || commit.timestamp,
          duration: fiber.actualDuration,
          componentName: fiber.displayName || 'Unknown',
          type: 'render',
          depth: calculateDepth(fiber),
        });
      }
    }
  }

  // Sort events by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);

  return {
    events,
    startTime: minTime,
    endTime: maxTime,
    totalDuration: maxTime - minTime,
  };
}

/**
 * Calculate depth of a fiber in the tree
 */
function calculateDepth(fiber: FiberData): number {
  let depth = 0;
  let current = fiber;
  while (current.return) {
    depth++;
    current = current.return;
  }
  return depth;
}

/**
 * Group events by time window
 */
function groupEventsByTimeWindow(
  events: TimelineEvent[],
  windowSize: number
): Map<number, TimelineEvent[]> {
  const groups = new Map<number, TimelineEvent[]>();

  for (const event of events) {
    const windowStart = Math.floor(event.timestamp / windowSize) * windowSize;
    
    if (!groups.has(windowStart)) {
      groups.set(windowStart, []);
    }
    
    groups.get(windowStart)!.push(event);
  }

  return groups;
}

/**
 * Find performance bottlenecks in timeline
 */
function findBottlenecks(
  events: TimelineEvent[],
  threshold: number = 16
): TimelineEvent[] {
  return events
    .filter(e => e.duration > threshold)
    .sort((a, b) => b.duration - a.duration);
}

// Test data helpers
function createMockFiber(overrides: Partial<FiberData> = {}): FiberData {
  return {
    id: 'fiber-1',
    displayName: 'TestComponent',
    key: null,
    child: null,
    sibling: null,
    return: null,
    type: 'div',
    elementType: 'div',
    memoizedProps: {},
    memoizedState: null,
    actualDuration: 1,
    actualStartTime: 0,
    selfBaseDuration: 1,
    treeBaseDuration: 1,
    tag: 5,
    index: 0,
    mode: 0,
    ...overrides,
  };
}

function createMockCommit(overrides: Partial<CommitData> = {}): CommitData {
  return {
    commitId: 'commit-1',
    timestamp: Date.now(),
    priorityLevel: 3,
    duration: 10,
    rootFiber: null,
    fibers: [],
    ...overrides,
  };
}

describe('generateTimeline', () => {
  it('should return empty timeline for no commits', () => {
    const timeline = generateTimeline([]);
    
    expect(timeline.events).toEqual([]);
    expect(timeline.startTime).toBe(0);
    expect(timeline.endTime).toBe(0);
    expect(timeline.totalDuration).toBe(0);
  });

  it('should generate events from single commit', () => {
    const fiber = createMockFiber({
      id: 'fiber-1',
      displayName: 'ComponentA',
      actualDuration: 5,
      actualStartTime: 1000,
    });
    
    const commit = createMockCommit({
      commitId: 'commit-1',
      timestamp: 1000,
      duration: 10,
      fibers: [fiber],
    });

    const timeline = generateTimeline([commit]);

    expect(timeline.events).toHaveLength(2); // 1 commit + 1 render
    expect(timeline.events[0].type).toBe('commit');
    expect(timeline.events[1].type).toBe('render');
    expect(timeline.events[1].componentName).toBe('ComponentA');
  });

  it('should generate events from multiple commits', () => {
    const commit1 = createMockCommit({
      commitId: 'commit-1',
      timestamp: 1000,
      duration: 10,
      fibers: [createMockFiber({ id: 'f1', displayName: 'A' })],
    });

    const commit2 = createMockCommit({
      commitId: 'commit-2',
      timestamp: 1500,
      duration: 15,
      fibers: [createMockFiber({ id: 'f2', displayName: 'B' })],
    });

    const timeline = generateTimeline([commit1, commit2]);

    expect(timeline.events).toHaveLength(4); // 2 commits + 2 renders
    expect(timeline.startTime).toBe(1000);
    expect(timeline.endTime).toBe(1515);
    expect(timeline.totalDuration).toBe(515);
  });

  it('should calculate correct depths', () => {
    const childFiber = createMockFiber({
      id: 'child',
      displayName: 'Child',
      return: createMockFiber({ id: 'parent', displayName: 'Parent' }),
    });

    const commit = createMockCommit({
      fibers: [childFiber],
    });

    const timeline = generateTimeline([commit]);

    const renderEvent = timeline.events.find(e => e.type === 'render');
    expect(renderEvent?.depth).toBe(1);
  });

  it('should sort events by timestamp', () => {
    const commit1 = createMockCommit({
      commitId: 'commit-1',
      timestamp: 2000,
    });

    const commit2 = createMockCommit({
      commitId: 'commit-2',
      timestamp: 1000,
    });

    const timeline = generateTimeline([commit1, commit2]);

    expect(timeline.events[0].timestamp).toBeLessThanOrEqual(timeline.events[1].timestamp);
  });
});

describe('groupEventsByTimeWindow', () => {
  it('should group events into time windows', () => {
    const events: TimelineEvent[] = [
      { id: '1', timestamp: 100, duration: 10, componentName: 'A', type: 'render', depth: 0 },
      { id: '2', timestamp: 150, duration: 10, componentName: 'B', type: 'render', depth: 0 },
      { id: '3', timestamp: 250, duration: 10, componentName: 'C', type: 'render', depth: 0 },
    ];

    const groups = groupEventsByTimeWindow(events, 100);

    expect(groups.size).toBe(2);
    expect(groups.get(100)).toHaveLength(2);
    expect(groups.get(200)).toHaveLength(1);
  });

  it('should handle empty events array', () => {
    const groups = groupEventsByTimeWindow([], 100);
    expect(groups.size).toBe(0);
  });

  it('should handle single event', () => {
    const events: TimelineEvent[] = [
      { id: '1', timestamp: 150, duration: 10, componentName: 'A', type: 'render', depth: 0 },
    ];

    const groups = groupEventsByTimeWindow(events, 100);

    expect(groups.size).toBe(1);
    expect(groups.get(100)).toHaveLength(1);
  });
});

describe('findBottlenecks', () => {
  it('should find events exceeding threshold', () => {
    const events: TimelineEvent[] = [
      { id: '1', timestamp: 100, duration: 5, componentName: 'Fast', type: 'render', depth: 0 },
      { id: '2', timestamp: 200, duration: 20, componentName: 'Slow', type: 'render', depth: 0 },
      { id: '3', timestamp: 300, duration: 50, componentName: 'VerySlow', type: 'render', depth: 0 },
    ];

    const bottlenecks = findBottlenecks(events, 16);

    expect(bottlenecks).toHaveLength(2);
    expect(bottlenecks[0].componentName).toBe('VerySlow'); // Sorted by duration
    expect(bottlenecks[1].componentName).toBe('Slow');
  });

  it('should return empty array when no bottlenecks', () => {
    const events: TimelineEvent[] = [
      { id: '1', timestamp: 100, duration: 5, componentName: 'A', type: 'render', depth: 0 },
      { id: '2', timestamp: 200, duration: 10, componentName: 'B', type: 'render', depth: 0 },
    ];

    const bottlenecks = findBottlenecks(events, 16);

    expect(bottlenecks).toEqual([]);
  });

  it('should use 16ms as default threshold', () => {
    const events: TimelineEvent[] = [
      { id: '1', timestamp: 100, duration: 15, componentName: 'Almost', type: 'render', depth: 0 },
      { id: '2', timestamp: 200, duration: 17, componentName: 'Over', type: 'render', depth: 0 },
    ];

    const bottlenecks = findBottlenecks(events);

    expect(bottlenecks).toHaveLength(1);
    expect(bottlenecks[0].componentName).toBe('Over');
  });

  it('should handle custom threshold', () => {
    const events: TimelineEvent[] = [
      { id: '1', timestamp: 100, duration: 50, componentName: 'A', type: 'render', depth: 0 },
      { id: '2', timestamp: 200, duration: 100, componentName: 'B', type: 'render', depth: 0 },
    ];

    const bottlenecks = findBottlenecks(events, 75);

    expect(bottlenecks).toHaveLength(1);
    expect(bottlenecks[0].componentName).toBe('B');
  });
});
