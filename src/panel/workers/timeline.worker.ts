/**
 * Timeline Web Worker
 * Offloads timeline generation from the main thread
 * Handles processing commit data, generating timeline items, markers, and statistics
 */

import type { CommitData, FiberData } from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

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

/** Timeline marker for significant events */
export interface TimelineMarker {
  /** Unique marker identifier */
  id: string;
  /** Timestamp for marker position */
  timestamp: number;
  /** Marker label */
  label: string;
  /** Marker type */
  type: 'commit' | 'peak' | 'interaction' | 'error';
  /** Additional metadata */
  data?: Record<string, unknown>;
}

/** Timeline statistics */
export interface TimelineStatistics {
  /** Total number of renders */
  totalRenders: number;
  /** Number of wasted renders */
  wastedRenders: number;
  /** Average render duration in ms */
  averageRenderDuration: number;
  /** Maximum render duration in ms */
  maxRenderDuration: number;
  /** Total number of commits */
  totalCommits: number;
  /** Time range in ms */
  timeRange: number;
  /** Render rate (renders per ms) */
  renderRate: number;
  /** Wasted render percentage */
  wastedRenderPercentage: number;
}

/** Complete timeline generation result */
export interface TimelineResult {
  /** Timeline data with events */
  timeline: TimelineData;
  /** Markers for significant events */
  markers: TimelineMarker[];
  /** Computed statistics */
  statistics: TimelineStatistics;
  /** Processing duration in ms */
  processingDuration: number;
}

/** Progress update during timeline generation */
export interface TimelineProgress {
  /** Progress percentage (0-100) */
  percent: number;
  /** Current operation description */
  stage: string;
  /** Number of commits processed */
  processedCommits: number;
  /** Total number of commits */
  totalCommits: number;
}

// ============================================================================
// Worker Message Types
// ============================================================================

export type TimelineWorkerRequestType = 'GENERATE_TIMELINE' | 'CANCEL';

export type TimelineWorkerResponseType = 
  | 'TIMELINE_PROGRESS'
  | 'TIMELINE_COMPLETE'
  | 'TIMELINE_ERROR';

/** Request message sent to the worker */
export interface TimelineWorkerRequest {
  /** Unique identifier for request/response matching */
  id: string;
  /** Type of operation */
  type: TimelineWorkerRequestType;
  /** Request payload */
  payload: {
    commits: CommitData[];
    config?: TimelineConfig;
  };
}

/** Response message sent from the worker */
export interface TimelineWorkerResponse {
  /** Request ID for matching */
  id: string;
  /** Type of response */
  type: TimelineWorkerResponseType;
  /** Progress data (for PROGRESS type) */
  progress?: TimelineProgress;
  /** Result data (for COMPLETE type) */
  result?: TimelineResult;
  /** Error message (for ERROR type) */
  error?: string;
}

// ============================================================================
// Timeline Generation Logic (Worker Context)
// ============================================================================

let currentRequestId: string | null = null;

/**
 * Main message handler
 */
self.onmessage = (event: MessageEvent<TimelineWorkerRequest>) => {
  const { id, type, payload } = event.data;

  if (type === 'CANCEL') {
    currentRequestId = null;
    return;
  }

  if (type === 'GENERATE_TIMELINE') {
    currentRequestId = id;
    
    try {
      const result = generateTimelineWithProgress(
        id,
        payload.commits,
        payload.config
      );
      
      // Check if request was cancelled during processing
      if (currentRequestId !== id) {
        return;
      }
      
      sendResponse(id, 'TIMELINE_COMPLETE', { result });
    } catch (error) {
      if (currentRequestId === id) {
        sendError(id, error);
      }
    }
  }
};

/**
 * Generates timeline with progress updates for large profiles
 */
function generateTimelineWithProgress(
  requestId: string,
  commits: CommitData[],
  config: TimelineConfig = {}
): TimelineResult {
  const startTime = performance.now();
  const { 
    minDuration = 0, 
    componentFilter, 
    onlyWasted = false, 
    maxEvents = 10000 
  } = config;

  // Handle empty commits
  if (!commits || commits.length === 0) {
    return {
      timeline: {
        startTime: 0,
        endTime: 0,
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
      processingDuration: 0,
    };
  }

  // Build component filter set for O(1) lookups
  const filterSet = componentFilter && componentFilter.length > 0 
    ? new Set(componentFilter) 
    : null;

  // Calculate time range
  const startTimeMs = commits[0]?.timestamp ?? 0;
  const endTimeMs = commits[commits.length - 1]?.timestamp ?? startTimeMs;

  // Progress tracking - send updates every N commits for large profiles
  const progressInterval = commits.length > 500 ? Math.floor(commits.length / 10) : 0;
  let lastProgressUpdate = 0;

  // Build previous fiber map for detecting wasted renders
  const prevFiberMap = new Map<string, FiberData>();

  // Generate events
  const events: TimelineEvent[] = [];
  let eventId = 0;
  const markers: TimelineMarker[] = [];

  for (let i = 0; i < commits.length; i++) {
    // Check for cancellation
    if (currentRequestId !== requestId) {
      throw new Error('Timeline generation cancelled');
    }

    const commit = commits[i];
    if (!commit?.fibers) continue;

    // Send progress updates for large profiles
    if (progressInterval > 0 && i - lastProgressUpdate >= progressInterval) {
      sendProgress(requestId, {
        percent: Math.round((i / commits.length) * 80), // Reserve 20% for post-processing
        stage: 'Processing commits...',
        processedCommits: i,
        totalCommits: commits.length,
      });
      lastProgressUpdate = i;
    }

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

    // Add commit marker
    markers.push({
      id: `marker-commit-${commit.id}`,
      timestamp: commit.timestamp,
      label: `Commit ${i + 1}`,
      type: 'commit',
      data: { duration: commit.duration },
    });

    // Process each fiber in the commit
    for (const fiber of commit.fibers) {
      // Apply duration filter
      if (fiber.actualDuration < minDuration) continue;

      // Apply component filter
      if (filterSet && fiber.displayName && !filterSet.has(fiber.displayName)) continue;

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

  // Generate peak markers for high activity areas
  if (currentRequestId === requestId) {
    const peakMarkers = generatePeakMarkers(events, startTimeMs, endTimeMs);
    markers.push(...peakMarkers);
  }

  // Calculate statistics
  const statistics = calculateStatistics(events, commits, startTimeMs, endTimeMs);

  const processingDuration = performance.now() - startTime;

  return {
    timeline: {
      startTime: startTimeMs,
      endTime: endTimeMs,
      events,
      commits,
    },
    markers: markers.sort((a, b) => a.timestamp - b.timestamp),
    statistics,
    processingDuration,
  };
}

/**
 * Generates markers for peak activity periods
 */
function generatePeakMarkers(
  events: TimelineEvent[],
  startTime: number,
  endTime: number
): TimelineMarker[] {
  const markers: TimelineMarker[] = [];
  const renderEvents = events.filter(
    (e) => e.type === 'render' || e.type === 'wasted-render'
  );

  if (renderEvents.length === 0 || endTime <= startTime) {
    return markers;
  }

  // Calculate average render rate
  const totalDuration = endTime - startTime;
  const averageRate = renderEvents.length / totalDuration;
  const peakThreshold = averageRate * 3; // At least 3x average

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

  // Find peak windows
  const processedWindows = new Set<number>();
  let peakCount = 0;

  windows.forEach((windowEvents, windowStart) => {
    if (processedWindows.has(windowStart)) return;

    const windowRate = windowEvents.length / windowSize;

    if (windowRate > peakThreshold && windowEvents.length > 5) {
      // Find the most significant event in this peak
      const peakEvent = windowEvents.reduce((max, event) =>
        event.duration > max.duration ? event : max
      );

      // Mark nearby windows as processed to avoid duplicate peaks
      for (let i = windowStart - windowSize; i <= windowStart + windowSize; i += windowSize) {
        processedWindows.add(i);
      }

      markers.push({
        id: `marker-peak-${peakCount++}`,
        timestamp: peakEvent.timestamp,
        label: `Peak (${windowEvents.length} renders)`,
        type: 'peak',
        data: {
          renderCount: windowEvents.length,
          maxDuration: peakEvent.duration,
          windowStart,
        },
      });
    }
  });

  return markers;
}

/**
 * Calculates timeline statistics
 */
function calculateStatistics(
  events: TimelineEvent[],
  commits: CommitData[],
  startTime: number,
  endTime: number
): TimelineStatistics {
  if (!events || events.length === 0) {
    return {
      totalRenders: 0,
      wastedRenders: 0,
      averageRenderDuration: 0,
      maxRenderDuration: 0,
      totalCommits: 0,
      timeRange: 0,
      renderRate: 0,
      wastedRenderPercentage: 0,
    };
  }

  let totalRenders = 0;
  let wastedRenders = 0;
  let totalDuration = 0;
  let maxDuration = 0;

  for (const event of events) {
    if (event.type === 'render' || event.type === 'wasted-render') {
      totalRenders++;
      totalDuration += event.duration;
      maxDuration = Math.max(maxDuration, event.duration);

      if (event.type === 'wasted-render') {
        wastedRenders++;
      }
    }
  }

  const timeRange = endTime - startTime;
  const renderRate = timeRange > 0 ? totalRenders / timeRange : 0;
  const wastedRenderPercentage = totalRenders > 0 
    ? (wastedRenders / totalRenders) * 100 
    : 0;

  return {
    totalRenders,
    wastedRenders,
    averageRenderDuration: totalRenders > 0 ? totalDuration / totalRenders : 0,
    maxRenderDuration: maxDuration,
    totalCommits: commits.length,
    timeRange,
    renderRate,
    wastedRenderPercentage: Math.round(wastedRenderPercentage * 100) / 100,
  };
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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sends a progress update
 */
function sendProgress(id: string, progress: TimelineProgress): void {
  const response: TimelineWorkerResponse = {
    id,
    type: 'TIMELINE_PROGRESS',
    progress,
  };
  self.postMessage(response);
}

/**
 * Sends a successful response
 */
function sendResponse(
  id: string,
  type: TimelineWorkerResponseType,
  data: { result?: TimelineResult }
): void {
  const response: TimelineWorkerResponse = {
    id,
    type,
    ...data,
  };
  self.postMessage(response);
}

/**
 * Sends an error response
 */
function sendError(id: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const response: TimelineWorkerResponse = {
    id,
    type: 'TIMELINE_ERROR',
    error: errorMessage,
  };
  self.postMessage(response);
}
