/**
 * Timeline Component
 * D3.js-based scatter plot visualization of render events over time
 * Supports zoom/pan, filtering, and detailed tooltips
 */

import * as d3 from 'd3';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import type {
  TimelineData,
  TimelineEvent,
  TimelineProgress,
} from '@/panel/workers/timeline.worker';
import { timelineWorker } from '@/panel/workers/workerClient';
import { panelLogger } from '@/shared/logger';
import styles from './Timeline.module.css';

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: TimelineEvent | null;
}

interface ZoomState {
  transform: d3.ZoomTransform;
  domain: [number, number];
}

const MARGIN = { top: 20, right: 30, bottom: 50, left: 70 };

/**
 * Timeline visualization component
 * Shows render events over time with zoom and filter capabilities
 */
export const Timeline: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const { commits } = useProfilerStore();
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 300 });
  const [zoomState, setZoomState] = useState<ZoomState | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [filterWasted, setFilterWasted] = useState(false);

  // Measure container size
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const [progress, setProgress] = useState<TimelineProgress | null>(null);

  // Generate timeline data via worker
  useEffect(() => {
    if (commits.length === 0) {
      setTimelineData(null);
      setProgress(null);
      return;
    }

    setIsLoading(true);
    setProgress(null);

    const abortController = new AbortController();

    timelineWorker
      .generateTimeline(
        commits,
        {
          onlyWasted: filterWasted,
          minDuration: 0,
        },
        (p) => {
          if (!abortController.signal.aborted) {
            setProgress(p);
          }
        }
      )
      .then((result) => {
        if (!abortController.signal.aborted) {
          setTimelineData(result.timeline);
        }
      })
      .catch((error) => {
        if (!abortController.signal.aborted) {
          panelLogger.error('Timeline generation failed', {
            source: 'Timeline',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
          setProgress(null);
        }
      });

    return () => {
      abortController.abort();
      timelineWorker.cancel();
    };
  }, [commits, filterWasted]);

  // Show tooltip
  const showTooltip = useCallback((event: MouseEvent, d: TimelineEvent) => {
    setTooltip({
      visible: true,
      x: event.clientX + 10,
      y: event.clientY - 10,
      data: d,
    });
  }, []);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  // Filter events based on current settings
  const filteredEvents = useMemo(() => {
    if (!timelineData) return [];
    return timelineData.events.filter((e) => e.type !== 'commit');
  }, [timelineData]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      svg
        .transition()
        .duration(750)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call(zoomRef.current.transform as unknown as (event: unknown) => void, d3.zoomIdentity);
    }
  }, []);

  // Render timeline with D3
  useEffect(() => {
    if (!svgRef.current || filteredEvents.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    // Create main group
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Calculate domains
    const timeExtent = d3.extent(filteredEvents, (d) => d.timestamp) as [number, number];
    const durationExtent = d3.extent(filteredEvents, (d) => d.duration) as [number, number];

    // Create scales
    const xScale = d3.scaleLinear().domain(timeExtent).range([0, innerWidth]);
    const yScale = d3
      .scaleLinear()
      .domain([0, durationExtent[1] * 1.1])
      .range([innerHeight, 0]);

    // Create axes
    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat((d) => `${(((d as number) - timeExtent[0]) / 1000).toFixed(1)}s`)
      .ticks(10);

    // Add axes groups
    const xAxisGroup = g
      .append('g')
      .attr('class', styles['axis']!)
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    // Add axis labels
    g.append('text')
      .attr('class', styles['axisLabel']!)
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .text('Time (seconds)');

    g.append('text')
      .attr('class', styles['axisLabel']!)
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .text('Render Duration (ms)');

    // Add grid lines
    const gridX = g
      .append('g')
      .attr('class', styles['grid']!)
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-innerHeight)
          .tickFormat(() => '')
      );

    // Create clip path for zooming
    svg
      .append('defs')
      .append('clipPath')
      .attr('id', 'timeline-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    // Create dots group with clip path
    const dotsGroup = g.append('g').attr('clip-path', 'url(#timeline-clip)');

    // Add dots for each event
    const dots = dotsGroup
      .selectAll('circle')
      .data(filteredEvents)
      .join('circle')
      .attr('class', styles['dot']!)
      .attr('cx', (d) => xScale(d.timestamp))
      .attr('cy', (d) => yScale(d.duration))
      .attr('r', (d) => (d.type === 'wasted-render' ? 5 : 4))
      .attr('fill', (d) => getEventColor(d))
      .attr('opacity', 0.7)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('r', 8).attr('opacity', 1);
        showTooltip(event as unknown as MouseEvent, d);
      })
      .on('mouseout', function (_event, d) {
        d3.select(this)
          .attr('r', d.type === 'wasted-render' ? 5 : 4)
          .attr('opacity', 0.7);
        hideTooltip();
      });

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 20])
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .on('zoom', (event) => {
        const newXScale = event.transform.rescaleX(xScale);

        // Update axes
        xAxisGroup.call(xAxis.scale(newXScale));
        gridX.call(
          d3
            .axisBottom(newXScale)
            .tickSize(-innerHeight)
            .tickFormat(() => '')
        );

        // Update dots
        dots.attr('cx', (d) => newXScale(d.timestamp));

        setZoomState({
          transform: event.transform,
          domain: newXScale.domain() as [number, number],
        });
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Apply saved zoom state if exists
    if (zoomState) {
      svg.call(zoom.transform, zoomState.transform);
    }
  }, [filteredEvents, dimensions, zoomState, showTooltip, hideTooltip]);

  if (commits.length === 0) {
    return (
      <div className={styles['empty']}>
        <div className={styles['emptyIcon']}>📈</div>
        <p>Record some commits to see timeline</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles['loading']}>
        <div className={styles['spinner']} />
        <p>Generating timeline...</p>
        {progress && (
          <div className={styles['progressInfo']}>
            <div className={styles['progressBar']}>
              <div className={styles['progressFill']} style={{ width: `${progress.percent}%` }} />
            </div>
            <span className={styles['progressText']}>
              {progress.stage} ({progress.processedCommits}/{progress.totalCommits})
            </span>
          </div>
        )}
      </div>
    );
  }

  const stats = timelineData
    ? {
        totalRenders: filteredEvents.length,
        wastedRenders: filteredEvents.filter((e) => e.type === 'wasted-render').length,
        timeRange: timelineData.endTime - timelineData.startTime,
      }
    : null;

  return (
    <div ref={containerRef} className={styles['timelineContainer']}>
      <div className={styles['header']}>
        <h3 className={styles['title']}>Timeline</h3>
        <div className={styles['controls']}>
          <label className={styles['filterLabel']}>
            <input
              type="checkbox"
              checked={filterWasted}
              onChange={(e) => setFilterWasted(e.target.checked)}
            />
            <span>Wasted renders only</span>
          </label>
          <button type="button" className={styles['resetButton']} onClick={resetZoom}>
            Reset Zoom
          </button>
        </div>
      </div>

      {stats && (
        <div className={styles['stats']}>
          <div className={styles['statItem']}>
            <span className={styles['statValue']}>{stats.totalRenders}</span>
            <span className={styles['statLabel']}>Renders</span>
          </div>
          <div className={styles['statItem']}>
            <span className={styles['statValue']} style={{ color: 'var(--danger)' }}>
              {stats.wastedRenders}
            </span>
            <span className={styles['statLabel']}>Wasted</span>
          </div>
          <div className={styles['statItem']}>
            <span className={styles['statValue']}>{(stats.timeRange / 1000).toFixed(1)}s</span>
            <span className={styles['statLabel']}>Duration</span>
          </div>
        </div>
      )}

      <div className={styles['legend']}>
        <div className={styles['legendItem']}>
          <span className={styles['legendDot']} style={{ background: '#0e639c' }} />
          <span>Normal Render</span>
        </div>
        <div className={styles['legendItem']}>
          <span className={styles['legendDot']} style={{ background: '#f14c4c' }} />
          <span>Wasted Render</span>
        </div>
      </div>

      <svg
        ref={svgRef}
        className={styles['svg']}
        width={dimensions.width}
        height={dimensions.height}
        role="img"
        aria-label="Timeline: render events over time. X-axis shows time in seconds, Y-axis shows render duration in milliseconds."
      >
        <title>Timeline — render events over time</title>
      </svg>

      <Tooltip tooltip={tooltip} />
    </div>
  );
};

/**
 * Tooltip component for timeline events
 */
const Tooltip: React.FC<{ tooltip: TooltipState }> = ({ tooltip }) => {
  if (!tooltip.visible || !tooltip.data) return null;

  const { data } = tooltip;

  return (
    <div
      className={styles['tooltip']}
      style={{
        left: tooltip.x,
        top: tooltip.y,
      }}
    >
      <div className={styles['tooltipHeader']}>{data.componentName}</div>
      <div className={styles['tooltipContent']}>
        <div className={styles['tooltipRow']}>
          <span className={styles['tooltipLabel']}>Duration:</span>
          <span className={styles['tooltipValue']}>{data.duration.toFixed(2)}ms</span>
        </div>
        <div className={styles['tooltipRow']}>
          <span className={styles['tooltipLabel']}>Type:</span>
          <span
            className={styles['badge']}
            data-type={data.type === 'wasted-render' ? 'wasted' : 'render'}
          >
            {data.type === 'wasted-render' ? 'Wasted' : 'Render'}
          </span>
        </div>
        {data.details.isWasted && (
          <div className={styles['tooltipHint']}>
            Props/state unchanged but component re-rendered
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Get color for a timeline event based on its type
 */
function getEventColor(event: TimelineEvent): string {
  switch (event.type) {
    case 'wasted-render':
      return '#f14c4c'; // Red for wasted renders
    case 'render':
      return '#0e639c'; // Blue for normal renders
    case 'commit':
      return '#6b7280'; // Gray for commits
    default:
      return '#6b7280';
  }
}

export default Timeline;
