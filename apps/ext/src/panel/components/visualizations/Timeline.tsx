import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { CommitData } from '@/src/shared/types';

interface TimelineProps {
  commits: CommitData[];
  selectedCommitId: string | null;
  onSelectCommit: (id: string) => void;
}

const SEVERITY_COLORS = {
  critical: '#dc2626',
  warning: '#f59e0b',
  normal: '#3b82f6',
  low: '#6b7280',
} as const;

function getCommitColor(durationMs: number): string {
  if (durationMs > 16) return SEVERITY_COLORS.critical;
  if (durationMs > 8) return SEVERITY_COLORS.warning;
  if (durationMs > 2) return SEVERITY_COLORS.normal;
  return SEVERITY_COLORS.low;
}

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };

const Timeline: React.FC<TimelineProps> = ({
  commits,
  selectedCommitId,
  onSelectCommit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Main D3 render
  useEffect(() => {
    const container = containerRef.current;
    if (!container || dimensions.width === 0 || commits.length === 0) return;

    // Cleanup
    d3.select(container).selectAll('svg').remove();

    const width = dimensions.width;
    const height = dimensions.height || 300;
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('display', 'block');

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
    const timeExtent = d3.extent(commits, (d) => d.timestamp) as [
      number,
      number,
    ];

    const xScale = d3
      .scaleTime()
      .domain(timeExtent)
      .range([0, innerWidth]);

    const maxDuration = d3.max(commits, (d) => d.duration) ?? 16;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxDuration * 1.1])
      .range([innerHeight, 0]);

    // Bar width
    const barWidth = Math.max(
      Math.min(innerWidth / commits.length - 2, 24),
      2
    );

    // X axis
    const timeFormatter = d3.timeFormat('%H:%M:%S');
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.min(commits.length, 8))
      .tickSize(-innerHeight)
      .tickFormat((d: Date | d3.NumberValue) => timeFormatter(new Date(d.valueOf())));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis as unknown as (sel: d3.Selection<SVGGElement, unknown, null, undefined>) => void)
      .call((sel) => sel.select('.domain').remove())
      .call((sel) =>
        sel
          .selectAll('.tick line')
          .attr('stroke', 'currentColor')
          .attr('stroke-opacity', 0.1)
      )
      .call((sel) =>
        sel.selectAll('.tick text').attr('fill', 'currentColor').attr('font-size', 10)
      );

    // Y axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d: d3.NumberValue) => `${d}ms`);

    g.append('g')
      .call(yAxis as unknown as (sel: d3.Selection<SVGGElement, unknown, null, undefined>) => void)
      .call((sel) => sel.select('.domain').remove())
      .call((sel) =>
        sel
          .selectAll('.tick line')
          .attr('stroke', 'currentColor')
          .attr('stroke-opacity', 0.1)
      )
      .call((sel) =>
        sel.selectAll('.tick text').attr('fill', 'currentColor').attr('font-size', 10)
      );

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .attr('fill', 'currentColor')
      .attr('font-size', 11)
      .text('Duration (ms)');

    // Threshold lines
    const thresholds = [
      { value: 16, label: 'Critical (16ms)', color: '#dc2626' },
      { value: 8, label: 'Warning (8ms)', color: '#f59e0b' },
    ];

    thresholds.forEach(({ value, label, color }) => {
      if (value <= maxDuration * 1.1) {
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerWidth)
          .attr('y1', yScale(value))
          .attr('y2', yScale(value))
          .attr('stroke', color)
          .attr('stroke-dasharray', '4,3')
          .attr('stroke-opacity', 0.6);

        g.append('text')
          .attr('x', innerWidth - 4)
          .attr('y', yScale(value) - 4)
          .attr('text-anchor', 'end')
          .attr('fill', color)
          .attr('font-size', 9)
          .text(label);
      }
    });

    // Bars
    const tooltip = tooltipRef.current;

    g.selectAll('rect.bar')
      .data(commits)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(d.timestamp) - barWidth / 2)
      .attr('y', (d) => yScale(d.duration))
      .attr('width', barWidth)
      .attr('height', (d) => innerHeight - yScale(d.duration))
      .attr('rx', 2)
      .attr('fill', (d) => getCommitColor(d.duration))
      .attr('fill-opacity', (d) =>
        selectedCommitId === d.id ? 1 : 0.7
      )
      .attr('stroke', (d) =>
        selectedCommitId === d.id ? '#ffffff' : 'none'
      )
      .attr('stroke-width', (d) => (selectedCommitId === d.id ? 2 : 0))
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('fill-opacity', 1);
        if (tooltip) {
          const time = new Date(d.timestamp);
          const timeStr = time.toLocaleTimeString();
          const nodeCount = d.nodes?.length ?? d.fibers?.length ?? 0;

          tooltip.style.opacity = '1';
          tooltip.style.left = `${event.offsetX + 12}px`;
          tooltip.style.top = `${event.offsetY - 8}px`;

          // Clear and rebuild tooltip content safely
          tooltip.textContent = '';
          const lines = [
            { text: `Commit: ${d.id.slice(0, 8)}`, cls: 'font-medium' },
            { text: `Duration: ${d.duration.toFixed(2)}ms`, cls: 'text-xs text-muted-foreground' },
            { text: `Components: ${nodeCount}`, cls: 'text-xs text-muted-foreground' },
            { text: `Time: ${timeStr}`, cls: 'text-xs text-muted-foreground' },
            { text: `Priority: ${d.priorityLevel}`, cls: 'text-xs text-muted-foreground' },
          ];
          lines.forEach(({ text, cls }) => {
            const el = document.createElement('div');
            el.className = cls;
            el.textContent = text;
            tooltip.appendChild(el);
          });
        }
      })
      .on('mousemove', function (event) {
        if (tooltip) {
          tooltip.style.left = `${event.offsetX + 12}px`;
          tooltip.style.top = `${event.offsetY - 8}px`;
        }
      })
      .on('mouseleave', function (_event: MouseEvent, d: CommitData) {
        d3.select(this).attr('fill-opacity', selectedCommitId === d.id ? 1 : 0.7);
        if (tooltip) {
          tooltip.style.opacity = '0';
        }
      })
      .on('click', function (_event, d) {
        onSelectCommit(d.id);
      });

    return () => {
      d3.select(container).selectAll('svg').remove();
    };
  }, [commits, dimensions, selectedCommitId, onSelectCommit]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={tooltipRef}
          className="absolute pointer-events-none opacity-0 transition-opacity bg-popover text-popover-foreground border border-border rounded-md px-2 py-1.5 shadow-md text-xs z-50"
        />
      </div>

      {commits.length === 0 && (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          No commit data available. Start profiling to see the timeline.
        </div>
      )}
    </div>
  );
};

export default Timeline;
