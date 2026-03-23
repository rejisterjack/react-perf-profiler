/**
 * Tests for Timeline Worker - Testing types and interfaces
 */

import { describe, it, expect } from 'vitest';
import type {
  TimelineEvent,
  TimelineData,
  TimelineConfig,
  TimelineMarker,
  TimelineStatistics,
  TimelineResult,
  TimelineProgress,
  TimelineWorkerRequest,
  TimelineWorkerResponse,
  CommitData,
  FiberData,
} from '@/panel/workers/timeline.worker';

describe('Timeline Worker Types', () => {
  describe('TimelineEvent', () => {
    it('should have required properties', () => {
      const event: TimelineEvent = {
        id: 'event-1',
        timestamp: 1000,
        type: 'render',
        componentName: 'TestComponent',
        duration: 16,
        details: {
          fiberId: 'fiber-1',
          isWasted: false,
        },
      };

      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('componentName');
      expect(event).toHaveProperty('duration');
      expect(event).toHaveProperty('details');
      expect(typeof event.timestamp).toBe('number');
      expect(typeof event.duration).toBe('number');
    });

    it('should support different event types', () => {
      const renderEvent: TimelineEvent = {
        id: '1',
        timestamp: 0,
        type: 'render',
        componentName: 'A',
        duration: 10,
        details: {},
      };

      const wastedEvent: TimelineEvent = {
        id: '2',
        timestamp: 0,
        type: 'wasted-render',
        componentName: 'B',
        duration: 5,
        details: { isWasted: true },
      };

      const commitEvent: TimelineEvent = {
        id: '3',
        timestamp: 0,
        type: 'commit',
        componentName: 'React Commit',
        duration: 20,
        details: { commitId: 'c1' },
      };

      expect(renderEvent.type).toBe('render');
      expect(wastedEvent.type).toBe('wasted-render');
      expect(commitEvent.type).toBe('commit');
    });
  });

  describe('TimelineData', () => {
    it('should have required properties', () => {
      const data: TimelineData = {
        startTime: 0,
        endTime: 1000,
        events: [],
        commits: [],
      };

      expect(data).toHaveProperty('startTime');
      expect(data).toHaveProperty('endTime');
      expect(data).toHaveProperty('events');
      expect(data).toHaveProperty('commits');
      expect(Array.isArray(data.events)).toBe(true);
      expect(Array.isArray(data.commits)).toBe(true);
    });

    it('should calculate correct time range', () => {
      const data: TimelineData = {
        startTime: 1000,
        endTime: 5000,
        events: [],
        commits: [],
      };

      const range = data.endTime - data.startTime;
      expect(range).toBe(4000);
    });
  });

  describe('TimelineConfig', () => {
    it('should support optional filters', () => {
      const config: TimelineConfig = {
        minDuration: 10,
        componentFilter: ['ComponentA', 'ComponentB'],
        onlyWasted: true,
        maxEvents: 1000,
      };

      expect(config.minDuration).toBe(10);
      expect(config.componentFilter).toEqual(['ComponentA', 'ComponentB']);
      expect(config.onlyWasted).toBe(true);
      expect(config.maxEvents).toBe(1000);
    });

    it('should work with empty config', () => {
      const config: TimelineConfig = {};
      expect(config).toBeDefined();
    });
  });

  describe('TimelineMarker', () => {
    it('should have required properties', () => {
      const marker: TimelineMarker = {
        id: 'marker-1',
        timestamp: 500,
        label: 'Peak Activity',
        type: 'peak',
        data: { renderCount: 10 },
      };

      expect(marker).toHaveProperty('id');
      expect(marker).toHaveProperty('timestamp');
      expect(marker).toHaveProperty('label');
      expect(marker).toHaveProperty('type');
      expect(marker).toHaveProperty('data');
    });

    it('should support different marker types', () => {
      const types = ['commit', 'peak', 'warning', 'error'] as const;
      
      types.forEach((type) => {
        const marker: TimelineMarker = {
          id: `m-${type}`,
          timestamp: 0,
          label: type,
          type,
          data: {},
        };
        expect(marker.type).toBe(type);
      });
    });
  });

  describe('TimelineStatistics', () => {
    it('should have all required statistics', () => {
      const stats: TimelineStatistics = {
        totalRenders: 100,
        wastedRenders: 20,
        averageRenderDuration: 8.5,
        maxRenderDuration: 50,
        totalCommits: 10,
        timeRange: 5000,
        renderRate: 20,
        wastedRenderPercentage: 20,
      };

      expect(stats.totalRenders).toBe(100);
      expect(stats.wastedRenders).toBe(20);
      expect(stats.averageRenderDuration).toBe(8.5);
      expect(stats.maxRenderDuration).toBe(50);
      expect(stats.wastedRenderPercentage).toBe(20);
    });

    it('should calculate wasted render percentage correctly', () => {
      const stats: TimelineStatistics = {
        totalRenders: 100,
        wastedRenders: 25,
        averageRenderDuration: 10,
        maxRenderDuration: 50,
        totalCommits: 5,
        timeRange: 1000,
        renderRate: 100,
        wastedRenderPercentage: 25,
      };

      const calculated = (stats.wastedRenders / stats.totalRenders) * 100;
      expect(calculated).toBe(stats.wastedRenderPercentage);
    });
  });

  describe('TimelineResult', () => {
    it('should have required properties', () => {
      const result: TimelineResult = {
        timeline: {
          startTime: 0,
          endTime: 1000,
          events: [],
          commits: [],
        },
        markers: [],
        statistics: {
          totalRenders: 0,
          wastedRenders: 0,
          averageRenderDuration: 0,
          maxRenderDuration: 0,
          totalCommits: 0,
          timeRange: 0,
          renderRate: 0,
          wastedRenderPercentage: 0,
        },
        processingDuration: 150,
      };

      expect(result).toHaveProperty('timeline');
      expect(result).toHaveProperty('markers');
      expect(result).toHaveProperty('statistics');
      expect(result).toHaveProperty('processingDuration');
      expect(result.processingDuration).toBe(150);
    });
  });

  describe('TimelineProgress', () => {
    it('should track progress correctly', () => {
      const progress: TimelineProgress = {
        percent: 50,
        stage: 'Processing commits...',
        processedCommits: 5,
        totalCommits: 10,
      };

      expect(progress.percent).toBe(50);
      expect(progress.processedCommits).toBe(5);
      expect(progress.totalCommits).toBe(10);
    });
  });
});

describe('Timeline Worker Request Types', () => {
  it('should define valid request types', () => {
    const validTypes = ['GENERATE_TIMELINE', 'CANCEL'] as const;

    validTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});

describe('Timeline Worker Response Types', () => {
  it('should define valid response types', () => {
    const validTypes = [
      'TIMELINE_PROGRESS',
      'TIMELINE_COMPLETE',
      'TIMELINE_CANCELLED',
      'ERROR',
    ] as const;

    validTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});

describe('TimelineWorkerRequest', () => {
  it('should have required properties', () => {
    const request: TimelineWorkerRequest = {
      id: 'test-id',
      type: 'GENERATE_TIMELINE',
      payload: {
        commits: [],
        config: {},
      },
    };

    expect(request).toHaveProperty('id');
    expect(request).toHaveProperty('type');
    expect(request).toHaveProperty('payload');
  });

  it('should support CANCEL request', () => {
    const cancelRequest: TimelineWorkerRequest = {
      id: 'cancel-1',
      type: 'CANCEL',
    };

    expect(cancelRequest.type).toBe('CANCEL');
    expect(cancelRequest.payload).toBeUndefined();
  });
});

describe('TimelineWorkerResponse', () => {
  it('should have required properties', () => {
    const response: TimelineWorkerResponse = {
      id: 'test-id',
      type: 'TIMELINE_COMPLETE',
      result: {
        timeline: {
          startTime: 0,
          endTime: 1000,
          events: [],
          commits: [],
        },
        markers: [],
        statistics: {
          totalRenders: 10,
          wastedRenders: 2,
          averageRenderDuration: 8,
          maxRenderDuration: 20,
          totalCommits: 5,
          timeRange: 1000,
          renderRate: 10,
          wastedRenderPercentage: 20,
        },
        processingDuration: 100,
      },
    };

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('type');
    expect(response).toHaveProperty('result');
  });

  it('should support progress responses', () => {
    const progressResponse: TimelineWorkerResponse = {
      id: 'progress-1',
      type: 'TIMELINE_PROGRESS',
      progress: {
        percent: 50,
        stage: 'Processing...',
        processedCommits: 5,
        totalCommits: 10,
      },
    };

    expect(progressResponse.type).toBe('TIMELINE_PROGRESS');
    expect(progressResponse.progress).toBeDefined();
    expect(progressResponse.progress?.percent).toBe(50);
  });

  it('should support error responses', () => {
    const errorResponse: TimelineWorkerResponse = {
      id: 'error-1',
      type: 'ERROR',
      error: 'Failed to generate timeline',
    };

    expect(errorResponse.type).toBe('ERROR');
    expect(errorResponse.error).toBe('Failed to generate timeline');
  });
});

describe('CommitData', () => {
  it('should have required properties', () => {
    const commit: CommitData = {
      id: 'commit-1',
      timestamp: 1000,
      duration: 16,
      fibers: [
        {
          id: 'fiber-1',
          displayName: 'ComponentA',
          tag: 0,
          actualDuration: 10,
        },
      ],
    };

    expect(commit).toHaveProperty('id');
    expect(commit).toHaveProperty('timestamp');
    expect(commit).toHaveProperty('duration');
    expect(commit).toHaveProperty('fibers');
    expect(Array.isArray(commit.fibers)).toBe(true);
  });
});

describe('FiberData', () => {
  it('should have required properties', () => {
    const fiber: FiberData = {
      id: 'fiber-1',
      displayName: 'TestComponent',
      tag: 0,
      actualDuration: 10,
      selfBaseDuration: 8,
      actualStartTime: 100,
    };

    expect(fiber).toHaveProperty('id');
    expect(fiber).toHaveProperty('displayName');
    expect(fiber).toHaveProperty('tag');
    expect(fiber).toHaveProperty('actualDuration');
  });

  it('should support optional properties', () => {
    const fiber: FiberData = {
      id: 'fiber-1',
      displayName: 'TestComponent',
      tag: 0,
      actualDuration: 10,
      selfBaseDuration: 8,
      actualStartTime: 100,
      memoizedProps: { value: 123 },
      memoizedState: { count: 0 },
    };

    expect(fiber.memoizedProps).toEqual({ value: 123 });
    expect(fiber.memoizedState).toEqual({ count: 0 });
  });
});

describe('Timeline Event Sorting', () => {
  it('should sort events by timestamp', () => {
    const events: TimelineEvent[] = [
      {
        id: '3',
        timestamp: 300,
        type: 'render',
        componentName: 'C',
        duration: 10,
        details: {},
      },
      {
        id: '1',
        timestamp: 100,
        type: 'render',
        componentName: 'A',
        duration: 10,
        details: {},
      },
      {
        id: '2',
        timestamp: 200,
        type: 'render',
        componentName: 'B',
        duration: 10,
        details: {},
      },
    ];

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

    expect(sorted[0].id).toBe('1');
    expect(sorted[1].id).toBe('2');
    expect(sorted[2].id).toBe('3');
  });
});

describe('Timeline Validation', () => {
  it('should validate commit timestamps are ordered', () => {
    const commits: CommitData[] = [
      { id: '1', timestamp: 1000, duration: 16, fibers: [] },
      { id: '2', timestamp: 2000, duration: 8, fibers: [] },
      { id: '3', timestamp: 3000, duration: 12, fibers: [] },
    ];

    const isOrdered = commits.every((commit, i) => 
      i === 0 || commit.timestamp >= commits[i - 1].timestamp
    );

    expect(isOrdered).toBe(true);
  });

  it('should calculate correct time range from commits', () => {
    const commits: CommitData[] = [
      { id: '1', timestamp: 1000, duration: 16, fibers: [] },
      { id: '2', timestamp: 5000, duration: 8, fibers: [] },
    ];

    const startTime = commits[0]?.timestamp ?? 0;
    const endTime = commits[commits.length - 1]?.timestamp ?? startTime;
    const range = endTime - startTime;

    expect(startTime).toBe(1000);
    expect(endTime).toBe(5000);
    expect(range).toBe(4000);
  });

  it('should filter events by component name', () => {
    const events: TimelineEvent[] = [
      { id: '1', timestamp: 0, type: 'render', componentName: 'ComponentA', duration: 10, details: {} },
      { id: '2', timestamp: 0, type: 'render', componentName: 'ComponentB', duration: 10, details: {} },
      { id: '3', timestamp: 0, type: 'render', componentName: 'ComponentA', duration: 10, details: {} },
    ];

    const filterSet = new Set(['ComponentA']);
    const filtered = events.filter(e => filterSet.has(e.componentName));

    expect(filtered).toHaveLength(2);
    expect(filtered.every(e => e.componentName === 'ComponentA')).toBe(true);
  });

  it('should filter events by minimum duration', () => {
    const events: TimelineEvent[] = [
      { id: '1', timestamp: 0, type: 'render', componentName: 'A', duration: 5, details: {} },
      { id: '2', timestamp: 0, type: 'render', componentName: 'B', duration: 15, details: {} },
      { id: '3', timestamp: 0, type: 'render', componentName: 'C', duration: 25, details: {} },
    ];

    const minDuration = 10;
    const filtered = events.filter(e => e.duration >= minDuration);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].duration).toBe(15);
    expect(filtered[1].duration).toBe(25);
  });
});
