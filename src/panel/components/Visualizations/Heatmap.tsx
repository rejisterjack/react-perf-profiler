/**
 * Heatmap Component
 * Visualizes component render frequency and duration as a heatmap grid
 * Helps identify "hot" components that render frequently or take long
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import styles from './Heatmap.module.css';

interface HeatmapCell {
  componentName: string;
  renderCount: number;
  totalDuration: number;
  averageDuration: number;
  wastedRenders: number;
  isMemoized: boolean;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: HeatmapCell | null;
}

type ColorMode = 'count' | 'duration' | 'wasted';

const MARGIN = { top: 40, right: 20, bottom: 60, left: 150 };
const CELL_HEIGHT = 24;
const MAX_VISIBLE_ROWS = 25;

/**
 * Heatmap visualization component
 * Shows component render frequency and performance as a color-coded grid
 */
export const Heatmap: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { commits } = useProfilerStore();
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [colorMode, setColorMode] = useState<ColorMode>('count');
  const [filterText, setFilterText] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });

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

  // Process commit data into heatmap cells
  const heatmapData = useMemo(() => {
    if (commits.length === 0) return [];

    const componentMap = new Map<string, HeatmapCell>();

    for (const commit of commits) {
      for (const fiber of commit.fibers || []) {
        const name = fiber.displayName;
        if (!name) continue;

        let cell = componentMap.get(name);
        if (!cell) {
          cell = {
            componentName: name,
            renderCount: 0,
            totalDuration: 0,
            averageDuration: 0,
            wastedRenders: 0,
            isMemoized: false,
          };
          componentMap.set(name, cell);
        }

        cell.renderCount++;
        cell.totalDuration += fiber.actualDuration;

        // Simple wasted render detection
        if (fiber.actualDuration < 0.1 && fiber.selfBaseDuration === fiber.treeBaseDuration) {
          cell.wastedRenders++;
        }

        // Check if memoized
        if (fiber.tag === 14 || fiber.tag === 15) {
          cell.isMemoized = true;
        }
      }
    }

    // Calculate averages and sort
    const data = Array.from(componentMap.values());
    for (const cell of data) {
      cell.averageDuration = cell.totalDuration / cell.renderCount;
    }

    // Sort by the current color mode metric
    return data.sort((a, b) => {
      switch (colorMode) {
        case 'count':
          return b.renderCount - a.renderCount;
        case 'duration':
          return b.totalDuration - a.totalDuration;
        case 'wasted':
          return b.wastedRenders - a.wastedRenders;
        default:
          return 0;
      }
    });
  }, [commits, colorMode]);

  // Filter data based on search text
  const filteredData = useMemo(() => {
    if (!filterText.trim()) return heatmapData.slice(0, MAX_VISIBLE_ROWS);
    return heatmapData
      .filter((d) => d.componentName.toLowerCase().includes(filterText.toLowerCase()))
      .slice(0, MAX_VISIBLE_ROWS);
  }, [heatmapData, filterText]);

  // Get color scale based on current mode
  const getColorScale = useCallback(() => {
    let maxValue: number;
    let colorInterpolator: (t: number) => string;

    switch (colorMode) {
      case 'count':
        maxValue = d3.max(filteredData, (d) => d.renderCount) || 1;
        colorInterpolator = d3.interpolateBlues;
        break;
      case 'duration':
        maxValue = d3.max(filteredData, (d) => d.totalDuration) || 1;
        colorInterpolator = d3.interpolateOranges;
        break;
      case 'wasted':
        maxValue = d3.max(filteredData, (d) => d.wastedRenders) || 1;
        colorInterpolator = d3.interpolateReds;
        break;
      default:
        maxValue = 1;
        colorInterpolator = d3.interpolateBlues;
    }

    return d3.scaleSequential(colorInterpolator).domain([0, maxValue]);
  }, [filteredData, colorMode]);

  // Show tooltip
  const showTooltip = useCallback((event: MouseEvent, d: HeatmapCell) => {
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

  // Render heatmap with D3
  useEffect(() => {
    if (!svgRef.current || filteredData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = Math.min(
      height - MARGIN.top - MARGIN.bottom,
      filteredData.length * CELL_HEIGHT
    );

    const colorScale = getColorScale();

    // Create main group
    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Create scales
    const yScale = d3
      .scaleBand()
      .domain(filteredData.map((d) => d.componentName))
      .range([0, innerHeight])
      .padding(0.1);

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);

    // Create cells
    const cells = g
      .selectAll('rect')
      .data(filteredData)
      .join('g')
      .attr('transform', (d) => `translate(0,${yScale(d.componentName)})`);

    // Add main heatmap bars
    cells
      .append('rect')
      .attr('class', styles.heatmapCell)
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => {
        switch (colorMode) {
          case 'count':
            return colorScale(d.renderCount);
          case 'duration':
            return colorScale(d.totalDuration);
          case 'wasted':
            return colorScale(d.wastedRenders);
          default:
            return colorScale(d.renderCount);
        }
      })
      .attr('rx', 2)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);
        showTooltip(event as unknown as MouseEvent, d);
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', 'none').attr('stroke-width', 0);
        hideTooltip();
      });

    // Add memoized indicator
    cells
      .filter((d) => d.isMemoized)
      .append('rect')
      .attr('class', styles.memoIndicator)
      .attr('x', innerWidth - 8)
      .attr('y', 2)
      .attr('width', 6)
      .attr('height', yScale.bandwidth() - 4)
      .attr('rx', 1);

    // Add Y axis (component names)
    g.append('g')
      .attr('class', styles.axis)
      .call(d3.axisLeft(yScale).tickSize(0))
      .selectAll('text')
      .attr('class', styles.yAxisLabel)
      .style('text-anchor', 'end');

    // Add value labels on cells
    cells
      .append('text')
      .attr('class', styles.valueLabel)
      .attr('x', innerWidth - 15)
      .attr('y', yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((d) => {
        switch (colorMode) {
          case 'count':
            return d.renderCount.toString();
          case 'duration':
            return `${d.totalDuration.toFixed(1)}ms`;
          case 'wasted':
            return d.wastedRenders > 0 ? d.wastedRenders.toString() : '';
          default:
            return d.renderCount.toString();
        }
      });

    // Add legend gradient
    const legendWidth = 150;
    const legendHeight = 12;

    const legendScale = d3
      .scaleLinear()
      .domain(colorScale.domain())
      .range([0, legendWidth]);

    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(3)
      .tickSize(legendHeight);

    const legend = svg
      .append('g')
      .attr('transform', `translate(${width - legendWidth - 20}, 20)`);

    // Create gradient for legend
    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'heatmap-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      gradient
        .append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', colorScale(colorScale.domain()[1] * t));
    }

    legend
      .append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#heatmap-gradient)')
      .attr('rx', 2);

    legend
      .append('g')
      .attr('class', styles.legendAxis)
      .attr('transform', `translate(0,${legendHeight})`)
      .call(legendAxis);
  }, [filteredData, dimensions, colorMode, getColorScale, showTooltip, hideTooltip]);

  if (commits.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🔥</div>
        <p>Record commits to see component heatmap</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Component Heatmap</h3>
        <div className={styles.controls}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Filter components..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <div className={styles.modeButtons}>
            <button
              className={`${styles.modeButton} ${colorMode === 'count' ? styles.active : ''}`}
              onClick={() => setColorMode('count')}
              title="Render Count"
            >
              Count
            </button>
            <button
              className={`${styles.modeButton} ${colorMode === 'duration' ? styles.active : ''}`}
              onClick={() => setColorMode('duration')}
              title="Total Duration"
            >
              Duration
            </button>
            <button
              className={`${styles.modeButton} ${colorMode === 'wasted' ? styles.active : ''}`}
              onClick={() => setColorMode('wasted')}
              title="Wasted Renders"
            >
              Wasted
            </button>
          </div>
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendInfo}>
          <span className={styles.legendText}>
            Showing top {filteredData.length} of {heatmapData.length} components
          </span>
          {colorMode === 'count' && (
            <span className={styles.legendDesc}>Darker = more renders</span>
          )}
          {colorMode === 'duration' && (
            <span className={styles.legendDesc}>Darker = longer duration</span>
          )}
          {colorMode === 'wasted' && (
            <span className={styles.legendDesc}>Darker = more wasted</span>
          )}
        </div>
        <div className={styles.legendItem}>
          <span className={styles.memoIndicator} />
          <span>Memoized</span>
        </div>
      </div>

      <div className={styles.chartContainer}>
        <svg
          ref={svgRef}
          className={styles.svg}
          width={dimensions.width}
          height={dimensions.height}
        />
      </div>

      <Tooltip tooltip={tooltip} colorMode={colorMode} />
    </div>
  );
};

/**
 * Tooltip component for heatmap cells
 */
const Tooltip: React.FC<{ tooltip: TooltipState; colorMode: ColorMode }> = ({
  tooltip,
  colorMode,
}) => {
  if (!tooltip.visible || !tooltip.data) return null;

  const { data } = tooltip;

  return (
    <div
      className={styles.tooltip}
      style={{
        left: tooltip.x,
        top: tooltip.y,
      }}
    >
      <div className={styles.tooltipHeader}>
        {data.componentName}
        {data.isMemoized && <span className={styles.memoBadge}>Memoized</span>}
      </div>
      <div className={styles.tooltipContent}>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Render Count:</span>
          <span className={styles.tooltipValue}>{data.renderCount}</span>
        </div>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Total Duration:</span>
          <span className={styles.tooltipValue}>
            {data.totalDuration.toFixed(2)}ms
          </span>
        </div>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Average:</span>
          <span className={styles.tooltipValue}>
            {data.averageDuration.toFixed(2)}ms
          </span>
        </div>
        {data.wastedRenders > 0 && (
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Wasted Renders:</span>
            <span className={`${styles.tooltipValue} ${styles.wastedValue}`}>
              {data.wastedRenders}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Heatmap;
