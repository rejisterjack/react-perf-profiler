/**
 * Flamegraph Component
 * D3.js-based icicle chart visualization of component render hierarchy
 * Color-coded by render duration and memoization status
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useProfilerStore, selectSelectedCommit } from '@/panel/stores/profilerStore';
import { useProfilerStore as useStore } from '@/panel/stores/profilerStore';
import { analysisWorker } from '@/panel/workers/workerClient';
import type { FlamegraphNode, FlamegraphData } from '@/panel/workers/flamegraphGenerator';
import styles from './Flamegraph.module.css';

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: FlamegraphNode | null;
}

const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };

/**
 * Flamegraph visualization component
 * Displays hierarchical component renders as an icicle chart
 */
export const Flamegraph: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const commit = useProfilerStore(selectSelectedCommit);
  const [flamegraphData, setFlamegraphData] = useState<FlamegraphData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FlamegraphNode | null>(null);

  // Measure container size with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width - MARGIN.left - MARGIN.right,
          height: entry.contentRect.height - MARGIN.top - MARGIN.bottom,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Generate flamegraph data via worker
  useEffect(() => {
    if (!commit) {
      setFlamegraphData(null);
      return;
    }

    setIsLoading(true);
    analysisWorker
      .generateFlamegraph(commit)
      .then((data) => {
        setFlamegraphData(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to generate flamegraph:', error);
        setIsLoading(false);
      });

    return () => {
      setSelectedNode(null);
    };
  }, [commit]);

  // Show tooltip
  const showTooltip = useCallback((event: MouseEvent, d: d3.HierarchyRectangularNode<FlamegraphNode>) => {
    setTooltip({
      visible: true,
      x: event.clientX + 10,
      y: event.clientY - 10,
      data: d.data,
    });
  }, []);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((d: d3.HierarchyRectangularNode<FlamegraphNode>) => {
    const componentName = d.data.name;
    if (componentName && componentName !== 'Unknown') {
      useStore.getState().selectComponent(componentName);
      setSelectedNode(d.data);
    }
  }, []);

  // Render D3 flamegraph
  useEffect(() => {
    if (!svgRef.current || !flamegraphData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    // Create main group with margin
    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Create hierarchy from flamegraph data
    const root = d3
      .hierarchy<FlamegraphNode>(flamegraphData.root, (d) => d.children)
      .sum((d) => Math.max(d.selfDuration, 0.1))
      .sort((a, b) => b.value! - a.value!);

    // Create partition layout (icicle chart - horizontal)
    const partition = d3.partition<FlamegraphNode>().size([height, width]).padding(1);

    partition(root);

    // Create color scale based on duration
    const maxDuration = d3.max(root.descendants(), (d) => d.data.selfDuration) || 16;
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxDuration]);

    // Create cell groups
    const cell = g
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', (d) => `translate(${d.y0},${d.x0})`);

    // Add rectangles
    cell
      .append('rect')
      .attr('class', styles.flameRect)
      .attr('width', (d) => Math.max(0, d.y1 - d.y0 - 1))
      .attr('height', (d) => Math.max(0, d.x1 - d.x0 - 1))
      .attr('fill', (d) => getNodeColor(d.data, colorScale))
      .attr('rx', 2)
      .attr('stroke', (d) =>
        selectedNode?.name === d.data.name ? '#fff' : 'none'
      )
      .attr('stroke-width', (d) =>
        selectedNode?.name === d.data.name ? 2 : 0
      )
      .style('cursor', (d) => (d.children ? 'pointer' : 'default'))
      .on('click', function (event, d) {
        event.stopPropagation();
        handleNodeClick(d);
      })
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);
        showTooltip(event as unknown as MouseEvent, d);
      })
      .on('mouseout', function (event, d) {
        if (selectedNode?.name !== d.data.name) {
          d3.select(this).attr('stroke', 'none').attr('stroke-width', 0);
        }
        hideTooltip();
      });

    // Add labels
    cell
      .append('text')
      .attr('class', styles.flameLabel)
      .attr('x', 4)
      .attr('y', 13)
      .text((d) => d.data.name)
      .attr('pointer-events', 'none')
      .style('display', (d) => ((d.x1 - d.x0) < 20 ? 'none' : 'block'));

    // Add duration labels for larger cells
    cell
      .append('text')
      .attr('class', styles.flameDuration)
      .attr('x', 4)
      .attr('y', 24)
      .text((d) =>
        d.data.selfDuration >= 0.1 ? `${d.data.selfDuration.toFixed(1)}ms` : ''
      )
      .attr('pointer-events', 'none')
      .style('display', (d) => ((d.x1 - d.x0) < 35 ? 'none' : 'block'));
  }, [flamegraphData, dimensions, selectedNode, showTooltip, hideTooltip, handleNodeClick]);

  if (!commit) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📊</div>
        <p>Select a commit to view flamegraph</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Generating flamegraph...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.flamegraphContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Flamegraph</h3>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span
              className={styles.legendColor}
              style={{ background: '#4ade80' }}
            />
            <span>Fast (&lt;1ms)</span>
          </div>
          <div className={styles.legendItem}>
            <span
              className={styles.legendColor}
              style={{ background: '#60a5fa' }}
            />
            <span>Normal (1-5ms)</span>
          </div>
          <div className={styles.legendItem}>
            <span
              className={styles.legendColor}
              style={{ background: '#fbbf24' }}
            />
            <span>Slow (5-16ms)</span>
          </div>
          <div className={styles.legendItem}>
            <span
              className={styles.legendColor}
              style={{ background: '#f87171' }}
            />
            <span>Critical (&gt;16ms)</span>
          </div>
          <div className={styles.legendItem}>
            <span
              className={styles.legendColor}
              style={{ background: '#4ec9b0' }}
            />
            <span>Memoized</span>
          </div>
        </div>
      </div>
      <svg
        ref={svgRef}
        className={styles.svg}
        width={dimensions.width + MARGIN.left + MARGIN.right}
        height={dimensions.height + MARGIN.top + MARGIN.bottom}
      />
      <Tooltip tooltip={tooltip} />
    </div>
  );
};

/**
 * Tooltip component for flamegraph nodes
 */
const Tooltip: React.FC<{ tooltip: TooltipState }> = ({ tooltip }) => {
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
      <div className={styles.tooltipHeader}>{data.name}</div>
      <div className={styles.tooltipContent}>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Self Duration:</span>
          <span className={styles.tooltipValue}>
            {data.selfDuration.toFixed(2)}ms
          </span>
        </div>
        <div className={styles.tooltipRow}>
          <span className={styles.tooltipLabel}>Cumulative:</span>
          <span className={styles.tooltipValue}>
            {data.cumulativeDuration.toFixed(2)}ms
          </span>
        </div>
        {data.originalData.tag === 14 || data.originalData.tag === 15 ? (
          <div className={styles.tooltipRow}>
            <span className={styles.badgeMemoized}>Memoized</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * Determine color for a flamegraph node based on its performance characteristics
 */
function getNodeColor(
  node: FlamegraphNode,
  scale: d3.ScaleSequential<string, never>
): string {
  // Memoized components - green
  if (node.originalData.tag === 14 || node.originalData.tag === 15) {
    return '#4ec9b0';
  }

  // Critical - red (> 16ms, 60fps budget)
  if (node.selfDuration > 16) {
    return '#f87171';
  }

  // Slow - orange (> 5ms)
  if (node.selfDuration > 5) {
    return '#fbbf24';
  }

  // Use scale for normal range
  return scale(node.selfDuration);
}

export default Flamegraph;
