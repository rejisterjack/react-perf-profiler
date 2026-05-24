import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

interface MetricsChartProps {
  data: { label: string; value: number; color?: string }[];
  title: string;
  unit?: string;
}

const DEFAULT_COLOR = '#3b82f6';

const MARGIN = { top: 8, right: 16, bottom: 8, left: 120 };

const MetricsChart: React.FC<MetricsChartProps> = ({ data, title, unit = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({ width: Math.floor(width), height: 0 });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // D3 render
  useEffect(() => {
    const container = containerRef.current;
    if (!container || dimensions.width === 0 || data.length === 0) return;

    // Cleanup
    d3.select(container).selectAll('svg').remove();

    // Sort data descending by value
    const sorted = [...data].sort((a, b) => b.value - a.value);

    const barHeight = 28;
    const barGap = 6;
    const totalHeight = sorted.length * (barHeight + barGap) + MARGIN.top + MARGIN.bottom;
    const width = dimensions.width;
    const innerWidth = width - MARGIN.left - MARGIN.right;

    if (innerWidth <= 0) return;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', totalHeight)
      .style('display', 'block');

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Scale
    const maxValue = d3.max(sorted, (d) => d.value) ?? 1;
    const xScale = d3
      .scaleLinear()
      .domain([0, maxValue])
      .range([0, innerWidth]);

    // Bar groups
    const groups = g
      .selectAll('g.bar-group')
      .data(sorted)
      .join('g')
      .attr('class', 'bar-group')
      .attr('transform', (_d, i) => `translate(0, ${i * (barHeight + barGap)})`);

    // Background track
    groups
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', barHeight)
      .attr('rx', 4)
      .attr('fill', 'currentColor')
      .attr('fill-opacity', 0.06);

    // Value bar
    groups
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', (d) => Math.max(xScale(d.value), 2))
      .attr('height', barHeight)
      .attr('rx', 4)
      .attr('fill', (d) => d.color || DEFAULT_COLOR)
      .attr('fill-opacity', 0.8)
      .style('transition', 'width 0.3s ease');

    // Label text (left side, outside the chart area)
    groups
      .append('text')
      .attr('x', -8)
      .attr('y', barHeight / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('fill', 'currentColor')
      .attr('font-size', 11)
      .text((d) => {
        const label = d.label;
        const maxLabelWidth = MARGIN.left - 16;
        const approxChars = Math.floor(maxLabelWidth / 7);
        return label.length > approxChars
          ? label.slice(0, approxChars - 1) + '...'
          : label;
      });

    // Value text (right side of bar)
    groups
      .append('text')
      .attr('x', (d) => Math.max(xScale(d.value), 2) + 6)
      .attr('y', barHeight / 2)
      .attr('dy', '0.35em')
      .attr('fill', 'currentColor')
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .text((d) => `${d.value.toFixed(1)}${unit}`);

    return () => {
      d3.select(container).selectAll('svg').remove();
    };
  }, [data, dimensions, unit]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {title && (
        <div className="px-2 py-1.5 text-sm font-medium text-foreground">
          {title}
        </div>
      )}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-auto">
        {data.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No metrics data available.
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsChart;
