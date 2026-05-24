/**
 * DependencyGraph — force-directed graph showing render causality.
 * Visualizes which components' state/prop changes cause which other components to re-render.
 * Uses SVG for lightweight rendering without D3 dependency.
 */

import { useMemo } from 'react';
import { useProfilerStore } from '@/src/panel/stores/profilerStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface GraphNode {
  id: string;
  label: string;
  group: 'state-change' | 'context' | 'parent' | 'child';
  x: number;
  y: number;
  renderCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
  cause: string;
  strength: number;
}

/** Simple force-directed layout approximation using circular placement */
function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): { nodes: GraphNode[]; edges: Array<{ x1: number; y1: number; x2: number; y2: number; cause: string; strength: number }> } {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  const cx = width / 2;
  const cy = height / 2;

  // Group nodes by their role
  const stateNodes = nodes.filter((n) => n.group === 'state-change');
  const contextNodes = nodes.filter((n) => n.group === 'context');
  const parentNodes = nodes.filter((n) => n.group === 'parent');
  const childNodes = nodes.filter((n) => n.group === 'child');

  // Place in concentric rings
  let placed = 0;
  const total = nodes.length;

  const placeRing = (ringNodes: GraphNode[], radius: number) => {
    const count = ringNodes.length;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      ringNodes[i].x = cx + radius * Math.cos(angle);
      ringNodes[i].y = cy + radius * Math.sin(angle);
      placed++;
    }
  };

  placeRing(stateNodes, Math.min(width, height) * 0.12);
  placeRing(contextNodes, Math.min(width, height) * 0.25);
  placeRing(parentNodes, Math.min(width, height) * 0.37);
  placeRing(childNodes, Math.min(width, height) * 0.47);

  // Build positioned edges
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const positionedEdges = edges.map((e) => {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    return {
      x1: src?.x ?? cx,
      y1: src?.y ?? cy,
      x2: tgt?.x ?? cx,
      y2: tgt?.y ?? cy,
      cause: e.cause,
      strength: e.strength,
    };
  });

  return { nodes, edges: positionedEdges };
}

/** Extract dependency graph from render causes data */
function extractDependencyGraph(
  commits: Array<{ renderCauses?: Array<{ componentName: string; causes: Array<{ type: string; details: string }> }> }>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map<string, GraphNode>();
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  const renderCounts = new Map<string, number>();

  for (const commit of commits) {
    if (!commit.renderCauses) continue;

    for (const cause of commit.renderCauses) {
      const target = cause.componentName;

      // Count renders
      renderCounts.set(target, (renderCounts.get(target) ?? 0) + 1);

      if (!nodeMap.has(target)) {
        nodeMap.set(target, {
          id: target,
          label: target,
          group: 'child',
          x: 0,
          y: 0,
          renderCount: renderCounts.get(target) ?? 0,
        });
      } else {
        nodeMap.get(target)!.renderCount = renderCounts.get(target) ?? 0;
      }

      for (const c of cause.causes) {
        if (c.type === 'parent-rerendered') {
          // Extract parent name from details
          const parentMatch = c.details.match(/Parent "(.+?)" re-rendered/);
          if (parentMatch) {
            const parent = parentMatch[1]!;
            if (!nodeMap.has(parent)) {
              nodeMap.set(parent, {
                id: parent,
                label: parent,
                group: 'parent',
                x: 0,
                y: 0,
                renderCount: 0,
              });
            }
            const edgeKey = `${parent}->${target}:parent`;
            if (!edgeSet.has(edgeKey)) {
              edgeSet.add(edgeKey);
              edges.push({ source: parent, target, cause: 'parent-rerendered', strength: 0.6 });
            }
          }
        } else if (c.type === 'state-changed') {
          // State change — this component is a source
          const node = nodeMap.get(target)!;
          node.group = 'state-change';
        } else if (c.type === 'props-changed') {
          // Props change — parent caused it (already handled above if parent rerendered)
          const node = nodeMap.get(target)!;
          if (node.group === 'child') node.group = 'child';
        } else if (c.type === 'context-changed') {
          const node = nodeMap.get(target)!;
          node.group = 'context';
        }
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), edges };
}

const GROUP_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  'state-change': { fill: '#f59e0b', stroke: '#d97706', label: 'State Change' },
  'context': { fill: '#8b5cf6', stroke: '#7c3aed', label: 'Context' },
  'parent': { fill: '#3b82f6', stroke: '#2563eb', label: 'Parent' },
  'child': { fill: '#6b7280', stroke: '#4b5563', label: 'Re-rendered' },
};

const GRAPH_WIDTH = 500;
const GRAPH_HEIGHT = 400;

export function DependencyGraph() {
  const commits = useProfilerStore((s) => s.commits);
  const commitsArray = useMemo(() => commits.toArray(), [commits]);

  const { nodes, edges: rawEdges } = useMemo(
    () => extractDependencyGraph(commitsArray),
    [commitsArray],
  );

  const { nodes: positionedNodes, edges: positionedEdges } = useMemo(
    () => computeLayout(nodes, rawEdges, GRAPH_WIDTH, GRAPH_HEIGHT),
    [nodes, rawEdges],
  );

  if (positionedNodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Render Dependency Graph</CardTitle>
          <CardDescription>Which components cause others to re-render</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <p className="text-xs">No render cause data captured yet.</p>
          <p className="text-[10px]">Profile your app to build the dependency graph. Enable render cause tracking in settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Render Dependency Graph</CardTitle>
                <CardDescription>
                  {positionedNodes.length} components · {positionedEdges.length} dependencies
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(GROUP_COLORS).map(([group, { fill, label }]) => {
                  const count = positionedNodes.filter((n) => n.group === group).length;
                  if (count === 0) return null;
                  return (
                    <div key={group} className="flex items-center gap-1">
                      <div className="size-2.5 rounded-full" style={{ backgroundColor: fill }} />
                      <span className="text-[10px] text-muted-foreground">{label} ({count})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <svg
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
              className="w-full border border-border rounded-md bg-background"
              style={{ maxHeight: GRAPH_HEIGHT }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 8 3, 0 6"
                    className="fill-muted-foreground/50"
                  />
                </marker>
              </defs>

              {/* Edges */}
              {positionedEdges.map((edge, i) => (
                <line
                  key={i}
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  stroke="currentColor"
                  className="text-muted-foreground/30"
                  strokeWidth={Math.max(1, edge.strength * 2)}
                  markerEnd="url(#arrowhead)"
                />
              ))}

              {/* Nodes */}
              {positionedNodes.map((node) => {
                const colors = GROUP_COLORS[node.group] ?? GROUP_COLORS['child'];
                const radius = Math.max(6, Math.min(20, 6 + node.renderCount));
                return (
                  <g key={node.id}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={1.5}
                      opacity={0.85}
                    />
                    {radius >= 10 && (
                      <text
                        x={node.x}
                        y={node.y + radius + 12}
                        textAnchor="middle"
                        className="fill-foreground text-[9px] font-medium"
                      >
                        {node.label.length > 15 ? node.label.slice(0, 12) + '...' : node.label}
                      </text>
                    )}
                    {node.renderCount > 1 && (
                      <text
                        x={node.x}
                        y={node.y + 3}
                        textAnchor="middle"
                        className="fill-white text-[8px] font-bold"
                      >
                        {node.renderCount}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </CardContent>
        </Card>

        {/* Component list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Components by Render Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              {positionedNodes
                .sort((a, b) => b.renderCount - a.renderCount)
                .slice(0, 20)
                .map((node) => {
                  const colors = GROUP_COLORS[node.group] ?? GROUP_COLORS['child'];
                  return (
                    <div key={node.id} className="flex items-center gap-2 text-xs">
                      <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: colors.fill }} />
                      <span className="font-mono truncate flex-1">{node.label}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                        {node.renderCount}x
                      </Badge>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
