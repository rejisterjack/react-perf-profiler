/**
 * Timeline generation utilities
 * Creates visualizable timeline data from profiler commits
 */

import type { CommitData, FiberData } from '../../content/types';

/** Event types for the timeline */
export type TimelineEventType = 'render' | 'commit' | 'wasted-render';

/** Single event in the performance timeline */
export interface TimelineEvent {
  /** Unique event identifier */
  id: string;
  /** Timestamp when event occurred (ms) */
  timestamp: number;
  /** Type of event */
  type: TimelineEventType;
  /** Component name (for render events) */
  componentName: string;
  /** Duration of the event in ms */
  duration: number;
  /** Additional event-specific details */
  details: {
    /** Fiber ID */
    fiberId?: string;
    /** Whether this was a wasted render */
    isWasted?: boolean;
    /** Self duration (without children) */
    selfDuration?: number;
    /** React priority level */
    priorityLevel?: number;
    /** Props that changed (if tracked) */
    changedProps?: string[];
    /** Commit ID this event belongs to */
    commitId?: string;
  };
}

/** Complete timeline data structure */
export interface TimelineData {
  /** Start time of the timeline (ms) */
  startTime: number;
  /** End time of the timeline (ms) */
  endTime: number;
  /** All events in chronological order */
  events: TimelineEvent[];
  /** Original commit data */
  commits: CommitData[];
}

/** Configuration for timeline generation */
export interface TimelineConfig {
  /** Minimum duration to include an event (filters out very fast renders) */
  minDuration?: number;
  /** Filter for specific components (empty = all) */
  componentFilter?: string[];
  /** Include only wasted renders */
  onlyWasted?: boolean;
  /** Maximum number of events (for memory efficiency) */
  maxEvents?: number;
}

/**
 * Generates a timeline from commit data
 * Creates a chronological list of render events for visualization
 *
 * @param commits - Array of commit data from React profiler
 * @param config - Optional timeline configuration
 * @returns Timeline data with events and metadata
 *
 * @example
 * ```typescript
 * const timeline = generateTimeline(commits, {
 *   minDuration: 1,
 *   onlyWasted: false
 * });
 *
 * // Use with visualization library
 * timeline.events.forEach(event => {
 *   drawEvent(event.timestamp, event.duration, event.type);
 * });
 * ```
 */
export function generateTimeline(commits: CommitData[], config: TimelineConfig = {}): TimelineData {
  const { minDuration = 0, componentFilter, onlyWasted = false, maxEvents = 10000 } = config;

  // Handle empty commits
  if (!commits || commits.length === 0) {
    return {
      startTime: 0,
      endTime: 0,
      events: [],
      commits: [],
    };
  }

  // Build component filter set for O(1) lookups
  const filterSet = componentFilter && componentFilter.length > 0 ? new Set(componentFilter) : null;

  // Calculate time range
  const startTime = commits[0]?.timestamp ?? 0;
  const endTime = commits[commits.length - 1]?.timestamp ?? startTime;

  // Build previous fiber map for detecting wasted renders
  const prevFiberMap = new Map<string, FiberData>();

  // Generate events
  const events: TimelineEvent[] = [];
  let eventId = 0;

  for (const commit of commits) {
    if (!commit.fibers) continue;

    // Create commit-level event
    events.push({
      id: `commit-${commit.id}`,
      timestamp: commit.timestamp,
      type: 'commit',
      componentName: 'React Commit',
      duration: commit.duration,
      details: {
        commitId: commit.id,
      },
    });

    // Process each fiber in the commit
    for (const fiber of commit.fibers) {
      // Apply duration filter
      if (fiber.actualDuration < minDuration) continue;

      // Apply component filter
      if (filterSet && !filterSet.has(fiber.displayName)) continue;

      // Detect if this was a wasted render
      const prevFiber = prevFiberMap.get(fiber.id) ?? null;
      const isWasted = detectWastedRender(fiber, prevFiber);

      // Apply wasted-only filter
      if (onlyWasted && !isWasted) continue;

      // Determine event type
      const type: TimelineEventType = isWasted ? 'wasted-render' : 'render';

      // Build changed props list
      const changedProps = prevFiber
        ? detectChangedProps(prevFiber.memoizedProps, fiber.memoizedProps)
        : [];

      events.push({
        id: `event-${eventId++}`,
        timestamp: commit.timestamp + (fiber.actualStartTime || 0),
        type,
        componentName: fiber.displayName || 'Unknown',
        duration: fiber.actualDuration,
        details: {
          fiberId: fiber.id,
          isWasted,
          selfDuration: fiber.selfBaseDuration,

          changedProps,
          commitId: commit.id,
        },
      });

      // Update previous fiber map
      prevFiberMap.set(fiber.id, fiber);
    }

    // Check max events limit
    if (events.length >= maxEvents) break;
  }

  // Sort events by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);

  return {
    startTime,
    endTime,
    events,
    commits,
  };
}

/**
 * Groups events into time buckets for aggregation
 * Useful for creating histograms or heatmaps
 *
 * @param events - Array of timeline events
 * @param bucketSizeMs - Size of each time bucket in milliseconds
 * @returns Map of bucket start time to events in that bucket
 *
 * @example
 * ```typescript
 * const buckets = bucketEvents(timeline.events, 100); // 100ms buckets
 * buckets.forEach((events, time) => {
 *   console.log(`${time}ms: ${events.length} renders`);
 * });
 * ```
 */
export function bucketEvents(
  events: TimelineEvent[],
  bucketSizeMs: number
): Map<number, TimelineEvent[]> {
  const buckets = new Map<number, TimelineEvent[]>();

  if (!events || events.length === 0 || bucketSizeMs <= 0) {
    return buckets;
  }

  for (const event of events) {
    // Calculate bucket start time
    const bucketTime = Math.floor(event.timestamp / bucketSizeMs) * bucketSizeMs;

    // Get or create bucket
    let bucket = buckets.get(bucketTime);
    if (!bucket) {
      bucket = [];
      buckets.set(bucketTime, bucket);
    }

    bucket.push(event);
  }

  return buckets;
}

/**
 * Finds peaks in render activity
 * Identifies time periods with unusually high render counts
 *
 * @param timeline - Timeline data
 * @param threshold - Threshold for considering activity a peak (renders per ms)
 * @returns Array of peak events (the highest activity events in each peak period)
 *
 * @example
 * ```typescript
 * const peaks = findRenderPeaks(timeline, 0.5); // 0.5 renders/ms threshold
 * peaks.forEach(peak => {
 *   console.log(`Peak at ${peak.timestamp}ms: ${peak.duration}ms duration`);
 * });
 * ```
 */
export function findRenderPeaks(timeline: TimelineData, threshold: number): TimelineEvent[] {
  if (!timeline.events || timeline.events.length === 0 || threshold <= 0) {
    return [];
  }

  // Filter to only render events
  const renderEvents = timeline.events.filter(
    (e) => e.type === 'render' || e.type === 'wasted-render'
  );

  if (renderEvents.length === 0) return [];

  // Calculate total duration for rate calculation
  const totalDuration = timeline.endTime - timeline.startTime;
  if (totalDuration <= 0) return [];

  // Calculate average render rate
  const averageRate = renderEvents.length / totalDuration;
  const peakThreshold = Math.max(threshold, averageRate * 3); // At least 3x average

  // Group events into small windows (100ms)
  const windowSize = 100;
  const windows = new Map<number, TimelineEvent[]>();

  for (const event of renderEvents) {
    const windowStart = Math.floor(event.timestamp / windowSize) * windowSize;
    let window = windows.get(windowStart);
    if (!window) {
      window = [];
      windows.set(windowStart, window);
    }
    window.push(event);
  }

  // Find windows that exceed threshold
  const peaks: TimelineEvent[] = [];
  const processedWindows = new Set<number>();

  windows.forEach((windowEvents, windowStart) => {
    if (processedWindows.has(windowStart)) return;

    const windowRate = windowEvents.length / windowSize;

    if (windowRate > peakThreshold) {
      // Find the most significant event in this peak
      const peakEvent = windowEvents.reduce((max, event) =>
        event.duration > max.duration ? event : max
      );

      // Mark nearby windows as processed to avoid duplicate peaks
      for (let i = windowStart - windowSize; i <= windowStart + windowSize; i += windowSize) {
        processedWindows.add(i);
      }

      peaks.push(peakEvent);
    }
  });

  // Sort by severity (total duration in peak)
  return peaks.sort((a, b) => b.duration - a.duration);
}

/**
 * Detects if a render was wasted by comparing with previous fiber state
 */
function detectWastedRender(current: FiberData, previous: FiberData | null): boolean {
  if (!previous) return false;

  // Quick check: if duration is 0, likely a bailout (not a real render)
  if (current.actualDuration === 0 && previous.actualDuration === 0) {
    return false;
  }

  // Compare props
  const prevProps = previous.memoizedProps || {};
  const currProps = current.memoizedProps || {};

  // Different number of keys = not wasted
  if (Object.keys(prevProps).length !== Object.keys(currProps).length) {
    return false;
  }

  // Check each prop
  for (const key of Object.keys(currProps)) {
    if (!(key in prevProps)) return false;
    if (prevProps[key] !== currProps[key]) return false;
  }

  // Compare state
  if (previous.memoizedState !== current.memoizedState) {
    return false;
  }

  return true;
}

/**
 * Detects which props changed between renders
 */
function detectChangedProps(
  prev: Record<string, unknown> | null,
  curr: Record<string, unknown> | null
): string[] {
  const changed: string[] = [];

  if (!prev || !curr) return changed;

  const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);

  for (const key of allKeys) {
    if (prev[key] !== curr[key]) {
      changed.push(key);
    }
  }

  return changed;
}

/**
 * Generates a summary of timeline statistics
 * Useful for high-level performance overview
 *
 * @param timeline - Timeline data
 * @returns Statistics object
 */
export function generateTimelineStats(timeline: TimelineData): {
  totalRenders: number;
  wastedRenders: number;
  averageRenderDuration: number;
  maxRenderDuration: number;
  totalCommits: number;
  timeRange: number;
  renderRate: number;
} {
  if (!timeline.events || timeline.events.length === 0) {
    return {
      totalRenders: 0,
      wastedRenders: 0,
      averageRenderDuration: 0,
      maxRenderDuration: 0,
      totalCommits: 0,
      timeRange: 0,
      renderRate: 0,
    };
  }

  let totalRenders = 0;
  let wastedRenders = 0;
  let totalDuration = 0;
  let maxDuration = 0;

  for (const event of timeline.events) {
    if (event.type === 'render' || event.type === 'wasted-render') {
      totalRenders++;
      totalDuration += event.duration;
      maxDuration = Math.max(maxDuration, event.duration);

      if (event.type === 'wasted-render') {
        wastedRenders++;
      }
    }
  }

  const timeRange = timeline.endTime - timeline.startTime;
  const renderRate = timeRange > 0 ? totalRenders / timeRange : 0;

  return {
    totalRenders,
    wastedRenders,
    averageRenderDuration: totalRenders > 0 ? totalDuration / totalRenders : 0,
    maxRenderDuration: maxDuration,
    totalCommits: timeline.commits.length,
    timeRange,
    renderRate,
  };
}
