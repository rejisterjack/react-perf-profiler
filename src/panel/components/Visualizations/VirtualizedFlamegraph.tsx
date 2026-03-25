/**
 * Virtualized Flamegraph Component
 * D3.js-based icicle chart with viewport-based culling for large trees
 * Only renders nodes visible in the current viewport for 10x+ performance improvement
 * @module panel/components/Visualizations/VirtualizedFlamegraph
 */

import * as d3 from 'd3';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  selectSelectedCommit,
  useProfilerStore,
  useProfilerStore as useStore,
} from '@/panel/stores/profilerStore';
import type { FlamegraphData, FlamegraphNode } from '@/panel/workers/flamegraphGenerator';
import { analysisWorker } from '@/panel/workers/workerClient';
import { FiberTag } from '@/shared/types';
import { panelLogger } from '@/shared/logger';
import { useVirtualizer } from '@tanstack/react-virtual';
import styles from './Flamegraph.module.css';

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: FlamegraphNode | null;
}

const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };
const ROW_HEIGHT = 24; // Height of each row in the flamegraph
const OVERSCAN_ROWS = 5; // Number of extra rows to render outside viewport

/**
 * Flatten hierarchy into rows for virtualization
 */
function flattenHierarchy(
  root: d3.HierarchyRectangularNode<FlamegraphNode>
): Array<{
  node: d3.HierarchyRectangularNode<FlamegraphNode>;
  rowIndex: number;
  depth: number;
}> {
  const rows: Array<{
    node: d3.HierarchyRectangularNode<FlamegraphNode>;
    rowIndex: number;
    depth: number;
  }> = [];

  // Group nodes by their vertical position (row)
  const nodesByRow = new Map<number, typeof rows>();

  root.descendants().forEach((node) => {
    const rowIndex = Math.floor(node.x0 / ROW_HEIGHT);
    if (!nodesByRow.has(rowIndex)) {
      nodesByRow.set(rowIndex, []);
    }
    nodesByRow.get(rowIndex)!.push({
      node,
      rowIndex,
      depth: node.depth,
    });
  });

  // Sort by row index
  const sortedRows = Array.from(nodesByRow.entries()).sort((a, b) => a[0] - b[0]);

  for (const [, rowNodes] of sortedRows) {
    rows.push(...rowNodes);
  }

  return rows;
}

/**
 * Virtualized Flamegraph visualization component
 * Uses viewport-based culling to only render visible nodes
 */
export const VirtualizedFlamegraph: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlamegraphNode | null>(null);

  // Measure container size
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
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    analysisWorker
      .generateFlamegraph(commit)
      .then((data) => {
        setFlamegraphData(data as FlamegraphData);
      })
      .catch((err) => {
        const errorMsg = err instanceof Error ? err.message : 'Failed to generate flamegraph';
        setError(errorMsg);
        panelLogger.error('Flamegraph generation failed', {
          source: 'VirtualizedFlamegraph',
          error: errorMsg,
          commitId: commit.id,
        });
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      setSelectedNode(null);
    };
  }, [commit]);

  // Build hierarchy and calculate total height
  const { hierarchyRoot, totalRows, allNodes } = useMemo(() => {
    if (!flamegraphData) {
      return { hierarchyRoot: null, totalRows: 0, allNodes: [] };
    }

    const root = d3
      .hierarchy<FlamegraphNode>(flamegraphData.root, (d) => d.children)
      .sum((d) => Math.max(d.selfDuration, 0.1))
      .sort((a, b) => b.value! - a.value!);

    const partition = d3.partition<FlamegraphNode>().size([dimensions.height, dimensions.width]).padding(1);
    const partitionedRoot = partition(root);

    const flattened = flattenHierarchy(partitionedRoot);
    const maxRow = Math.max(...flattened.map((n) => n.rowIndex), 0);

    return {
      hierarchyRoot: partitionedRoot,
      totalRows: maxRow + 1,
      allNodes: flattened,
    };
  }, [flamegraphData, dimensions]);

  // Set up virtualizer
  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Show tooltip
  const showTooltip = useCallback((event: MouseEvent, data: FlamegraphNode) => {
    setTooltip({
      visible: true,
      x: event.clientX + 10,
      y: event.clientY - 10,
      data,
    });
  }, []);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((data: FlamegraphNode) => {
    const componentName = data.name;
    if (componentName && componentName !== 'Unknown') {
      useStore.getState().selectComponent(componentName);
      setSelectedNode(data);
    }
  }, []);

  // Filter visible nodes based on virtual scroll
  const visibleNodes = useMemo(() => {
    if (!hierarchyRoot || virtualItems.length === 0) return [];

    const visibleRowIndices = new Set(virtualItems.map((item) => item.index));

    return allNodes.filter((item) => visibleRowIndices.has(item.rowIndex));
  }, [allNodes, virtualItems, hierarchyRoot]);

  // Get color scale
  const colorScale = useMemo(() => {
    if (!hierarchyRoot) return null;
    const maxDuration = d3.max(hierarchyRoot.descendants(), (d) => d.data.selfDuration) || 16;
    return d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxDuration]);
  }, [hierarchyRoot]);

  // Render D3 flamegraph (only visible nodes)
  useEffect(() => {
    if (!svgRef.current || !hierarchyRoot || !colorScale) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    // Create main group with margin
    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Create background rect for click handling
    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('click', () => {
        setSelectedNode(null);
      });

    // Create cell groups for visible nodes only
    const cell = g
      .selectAll('g.cell')
      .data(visibleNodes, (d) => (d as (typeof visibleNodes)[0]).node.data.name + (d as (typeof visibleNodes)[0]).node.depth)
      .join('g')
      .attr('class', 'cell')
      .attr('transform', (d) => `translate(${d.node.y0},${d.node.x0})`);

    // Add rectangles with keyboard accessibility
    cell
      .append('rect')
      .attr('class', styles['flameRect']!)
      .attr('width', (d) => Math.max(0, d.node.y1 - d.node.y0 - 1))
      .attr('height', (d) => Math.max(0, d.node.x1 - d.node.x0 - 1))
      .attr('fill', (d) => getNodeColor(d.node.data, colorScale))
      .attr('rx', 2)
      .attr('stroke', (d) => (selectedNode?.name === d.node.data.name ? '#fff' : 'none'))
      .attr('stroke-width', (d) => (selectedNode?.name === d.node.data.name ? 2 : 0))
      .style('cursor', (d) => (d.node.children ? 'pointer' : 'default'))
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr(
        'aria-label',
        (d) =>
          `${d.node.data.name}, ${d.node.data.selfDuration.toFixed(2)}ms self, ${d.node.data.cumulativeDuration.toFixed(2)}ms total`
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        handleNodeClick(d.node.data);
      })
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);
        showTooltip(event as unknown as MouseEvent, d.node.data);
      })
      .on('mouseout', function (_event, d) {
        if (selectedNode?.name !== d.node.data.name) {
          d3.select(this).attr('stroke', 'none').attr('stroke-width', 0);
        }
        hideTooltip();
      })
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleNodeClick(d.node.data);
        }
      });

    // Add labels
    cell
      .append('text')
      .attr('class', styles['flameLabel']!)
      .attr('x', 4)
      .attr('y', 13)
      .text((d) => d.node.data.name)
      .attr('pointer-events', 'none')
      .style('display', (d) => (d.node.x1 - d.node.x0 < 20 ? 'none' : 'block'));

    // Add duration labels for larger cells
    cell
      .append('text')
      .attr('class', styles['flameDuration']!)
      .attr('x', 4)
      .attr('y', 24)
      .text((d) => (d.node.data.selfDuration >= 0.1 ? `${d.node.data.selfDuration.toFixed(1)}ms` : ''))
      .attr('pointer-events', 'none')
      .style('display', (d) => (d.node.x1 - d.node.x0 < 35 ? 'none' : 'block'));
  }, [visibleNodes, colorScale, dimensions, selectedNode, showTooltip, hideTooltip, handleNodeClick]);

  if (!commit) {
    return (
      <div className={styles['empty']}>
        <div className={styles['emptyIcon']}>📊</div>
        <p>Select a commit to view flamegraph</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles['error']}>
        <div className={styles['errorIcon']}>⚠️</div>
        <p>Failed to render flamegraph. Try selecting a different commit.</p>
        <p className={styles['errorMessage']}>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles['loading']}>
        <div className={styles['spinner']} />
        <p>Generating flamegraph...</p>
      </div>
    );
  }

  const totalHeight = totalRows * ROW_HEIGHT;

  return (
    <div ref={containerRef} className={styles['flamegraphContainer']} style={{ overflow: 'auto' }}>
      <div className={styles['header']}>
        <h3 className={styles['title']}>Flamegraph (Virtualized)</h3>
        <div className={styles['legend']}>
          <div className={styles['legendItem']}>
            <span className={styles['legendColor']} style={{ background: '#4ade80' }} />
            <span>Fast (&lt;1ms)</span>
          </div>
          <div className={styles['legendItem']}>
            <span className={styles['legendColor']} style={{ background: '#60a5fa' }} />
            <span>Normal (1-5ms)</span>
          </div>
          <div className={styles['legendItem']}>
            <span className={styles['legendColor']} style={{ background: '#fbbf24' }} />
            <span>Slow (5-16ms)</span>
          </div>
          <div className={styles['legendItem']}>
            <span className={styles['legendColor']} style={{ background: '#f87171' }} />
            <span>Critical (&gt;16ms)</span>
          </div>
          <div className={styles['legendItem']}>
            <span className={styles['legendColor']} style={{ background: '#4ec9b0' }} />
            <span>Memoized</span>
          </div>
        </div>
      </div>

      <div
        style={{
          height: `${totalHeight + MARGIN.top + MARGIN.bottom}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <svg
          ref={svgRef}
          className={styles['svg']}
          width={dimensions.width + MARGIN.left + MARGIN.right}
          height={totalHeight + MARGIN.top + MARGIN.bottom}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          role="img"
          aria-label={`Flamegraph: component render hierarchy for commit ${commit.id}. Each bar represents a component; wider bars indicate longer render times.`}
        >
          <title>{`Flamegraph — commit render hierarchy (${(commit.duration ?? 0).toFixed(1)}ms total)`}</title>
        </svg>
      </div>

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
      className={styles['tooltip']}
      style={{
        left: tooltip.x,
        top: tooltip.y,
        position: 'fixed',
        zIndex: 1000,
      }}
    >
      <div className={styles['tooltipHeader']}>{data.name}</div>
      <div className={styles['tooltipContent']}>
        <div className={styles['tooltipRow']}>
          <span className={styles['tooltipLabel']}>Self Duration:</span>
          <span className={styles['tooltipValue']}>{data.selfDuration.toFixed(2)}ms</span>
        </div>
        <div className={styles['tooltipRow']}>
          <span className={styles['tooltipLabel']}>Cumulative:</span>
          <span className={styles['tooltipValue']}>{data.cumulativeDuration.toFixed(2)}ms</span>
        </div>
        {data.originalData.tag === FiberTag.SimpleMemoComponent ||
        data.originalData.tag === FiberTag.MemoComponent ? (
          <div className={styles['tooltipRow']}>
            <span className={styles['badgeMemoized']}>Memoized</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/**
 * Determine color for a flamegraph node based on its performance characteristics
 */
function getNodeColor(node: FlamegraphNode, scale: d3.ScaleSequential<string, never>): string {
  // Memoized components - green
  if (
    node.originalData.tag === FiberTag.SimpleMemoComponent ||
    node.originalData.tag === FiberTag.MemoComponent
  ) {
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

export default VirtualizedFlamegraph;
