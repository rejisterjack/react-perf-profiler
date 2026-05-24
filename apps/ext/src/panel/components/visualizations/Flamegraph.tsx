import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { FiberData } from '@/src/shared/types';

interface FlamegraphProps {
  fibers: FiberData[];
  selectedComponent: string | null;
  onSelectComponent: (name: string | null) => void;
}

interface HierarchyNode {
  id: string;
  displayName: string;
  duration: number;
  children: HierarchyNode[];
}

type PartitionNode = d3.HierarchyRectangularNode<HierarchyNode>;

const SEVERITY_COLORS = {
  critical: '#dc2626',
  warning: '#f59e0b',
  normal: '#3b82f6',
  low: '#6b7280',
} as const;

function getSeverityColor(durationMs: number): string {
  if (durationMs > 16) return SEVERITY_COLORS.critical;
  if (durationMs > 8) return SEVERITY_COLORS.warning;
  if (durationMs > 2) return SEVERITY_COLORS.normal;
  return SEVERITY_COLORS.low;
}

function buildHierarchy(fibers: FiberData[]): HierarchyNode | null {
  if (fibers.length === 0) return null;

  const fiberMap = new Map<string, FiberData>();
  fibers.forEach((f) => fiberMap.set(f.id, f));

  let rootFiber: FiberData | null = null;
  for (const fiber of fibers) {
    if (!fiber.return || !fiberMap.has(fiber.return.id)) {
      rootFiber = fiber;
      break;
    }
  }
  if (!rootFiber) {
    rootFiber = fibers[0];
  }

  function toNode(fiber: FiberData): HierarchyNode {
    const children: HierarchyNode[] = [];
    if (fiber.child) {
      let child: FiberData | null = fiber.child;
      while (child) {
        if (fiberMap.has(child.id)) {
          children.push(toNode(child));
        }
        child = child.sibling;
      }
    }
    return {
      id: fiber.id,
      displayName: fiber.displayName || '(anonymous)',
      duration: fiber.actualDuration ?? 0,
      children,
    };
  }

  return toNode(rootFiber);
}

function setTooltipContent(
  tooltip: HTMLDivElement,
  name: string,
  duration: number
): void {
  const titleEl = tooltip.querySelector('.tt-title') as HTMLDivElement | null;
  const detailEl = tooltip.querySelector('.tt-detail') as HTMLDivElement | null;

  if (!titleEl || !detailEl) {
    tooltip.textContent = '';
    const t = document.createElement('div');
    t.className = 'tt-title font-medium';
    t.textContent = name;
    tooltip.appendChild(t);

    const d = document.createElement('div');
    d.className = 'tt-detail text-xs text-muted-foreground';
    d.textContent = `Duration: ${duration.toFixed(2)}ms`;
    tooltip.appendChild(d);
  } else {
    titleEl.textContent = name;
    detailEl.textContent = `Duration: ${duration.toFixed(2)}ms`;
  }
}

const Flamegraph: React.FC<FlamegraphProps> = ({
  fibers,
  selectedComponent,
  onSelectComponent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [zoomPath, setZoomPath] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Responsive sizing via ResizeObserver
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

  // Create SVG once, resize on dimension change
  useEffect(() => {
    const container = containerRef.current;
    if (!container || dimensions.width === 0) return;

    let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    let g: d3.Selection<SVGGElement, unknown, null, undefined>;

    if (!svgRef.current) {
      svg = d3
        .select(container)
        .append('svg')
        .style('display', 'block');
      g = svg.append('g');
      svgRef.current = svg;
      gRef.current = g;
    } else {
      svg = svgRef.current;
      g = gRef.current!;
    }

    svg.attr('width', dimensions.width);

    return () => {
      if (svgRef.current) {
        svgRef.current.remove();
        svgRef.current = null;
        gRef.current = null;
      }
    };
  }, [dimensions.width]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    setZoomPath((prev) => prev.slice(0, index + 1));
  }, []);

  // Update D3 data with enter/update/exit pattern
  useEffect(() => {
    const g = gRef.current;
    const svg = svgRef.current;
    if (!g || !svg || dimensions.width === 0) return;

    const hierarchyData = buildHierarchy(fibers);
    if (!hierarchyData) {
      g.selectAll('g.cell').remove();
      svg.attr('height', 0);
      return;
    }

    const root = d3
      .hierarchy<HierarchyNode>(hierarchyData)
      .sum((d) => d.duration)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const rowHeight = 24;
    const headerHeight = zoomPath.length > 0 ? 32 : 0;
    const totalHeight =
      Math.max(root.height + 1, 1) * rowHeight + headerHeight + 8;
    const width = dimensions.width;

    svg.attr('height', totalHeight);
    g.attr('transform', `translate(0, ${headerHeight})`);

    let zoomRoot = root;
    if (zoomPath.length > 0) {
      let current = root;
      for (const targetId of zoomPath) {
        const child = current.children?.find((c) => c.data.id === targetId);
        if (child) current = child;
        else break;
      }
      zoomRoot = current;
    }

    const partitionLayout = d3
      .partition<HierarchyNode>()
      .size([width, totalHeight - headerHeight])
      .padding(1);

    const zoomClone = zoomRoot.copy();
    partitionLayout(zoomClone);

    const descendants: PartitionNode[] = zoomClone.descendants() as PartitionNode[];

    const cells = g
      .selectAll<SVGGElement, PartitionNode>('g.cell')
      .data(descendants, (d) => d.data.id);

    // EXIT
    cells.exit().remove();

    // ENTER + MERGE
    const entered = cells
      .enter()
      .append('g')
      .attr('class', 'cell');

    // Append rect and text to new cells
    entered.append('rect').attr('rx', 3).style('cursor', 'pointer');
    entered.append('text').attr('font-size', 11).attr('fill', '#ffffff').attr('pointer-events', 'none');

    const merged = entered.merge(cells);

    // Update rects
    merged
      .select('rect')
      .attr('x', (d: PartitionNode) => d.x0)
      .attr('y', (d: PartitionNode) => d.y0)
      .attr('width', (d: PartitionNode) => Math.max(d.x1 - d.x0 - 1, 0))
      .attr('height', (d: PartitionNode) => Math.max(d.y1 - d.y0 - 1, 0))
      .attr('fill', (d: PartitionNode) => getSeverityColor(d.data.duration))
      .attr('fill-opacity', (d: PartitionNode) =>
        selectedComponent === d.data.displayName ? 1 : 0.75
      )
      .attr('stroke', (d: PartitionNode) =>
        selectedComponent === d.data.displayName ? '#ffffff' : 'none'
      )
      .attr('stroke-width', (d: PartitionNode) =>
        selectedComponent === d.data.displayName ? 2 : 0
      )
      .on('mouseenter', function (event: MouseEvent, d: PartitionNode) {
        d3.select(this).attr('fill-opacity', 1);
        if (tooltipRef.current) {
          tooltipRef.current.style.opacity = '1';
          tooltipRef.current.style.left = `${event.offsetX + 12}px`;
          tooltipRef.current.style.top = `${event.offsetY - 8}px`;
          setTooltipContent(tooltipRef.current, d.data.displayName, d.data.duration);
        }
      })
      .on('mousemove', function (event: MouseEvent) {
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${event.offsetX + 12}px`;
          tooltipRef.current.style.top = `${event.offsetY - 8}px`;
        }
      })
      .on('mouseleave', function (_event: MouseEvent, d: PartitionNode) {
        d3.select(this).attr('fill-opacity', selectedComponent === d.data.displayName ? 1 : 0.75);
        if (tooltipRef.current) {
          tooltipRef.current.style.opacity = '0';
        }
      })
      .on('click', function (_event: MouseEvent, d: PartitionNode) {
        if (d.children && d.children.length > 0) {
          setZoomPath((prev) => [...prev, d.data.id]);
        }
        onSelectComponent(d.data.displayName);
      });

    // Update labels
    merged
      .select('text')
      .attr('x', (d: PartitionNode) => d.x0 + 4)
      .attr('y', (d: PartitionNode) => (d.y0 + d.y1) / 2)
      .attr('dy', '0.35em')
      .text((d: PartitionNode) => {
        const cellWidth = d.x1 - d.x0;
        if (cellWidth < 40) return '';
        const label = d.data.displayName;
        return label.length * 7 > cellWidth - 8
          ? label.slice(0, Math.floor((cellWidth - 8) / 7)) + '...'
          : label;
      });
  }, [fibers, dimensions, zoomPath, selectedComponent, onSelectComponent]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {zoomPath.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground border-b border-border bg-muted/30">
          <button
            className="text-primary hover:underline cursor-pointer"
            onClick={() => setZoomPath([])}
          >
            root
          </button>
          {zoomPath.map((id, i) => {
            const fiber = fibers.find((f) => f.id === id);
            const name = fiber?.displayName || id;
            return (
              <React.Fragment key={id}>
                <span className="text-muted-foreground">/</span>
                <button
                  className="text-primary hover:underline cursor-pointer"
                  onClick={() => handleBreadcrumbClick(i)}
                >
                  {name}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-auto">
        <div
          ref={tooltipRef}
          className="absolute pointer-events-none opacity-0 transition-opacity bg-popover text-popover-foreground border border-border rounded-md px-2 py-1.5 shadow-md text-xs z-50"
        />
      </div>

      {fibers.length === 0 && (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          No fiber data available. Start profiling to see the flamegraph.
        </div>
      )}
    </div>
  );
};

export default Flamegraph;
