/**
 * Flamegraph Fallback for 3D Visualization
 * Renders when Three.js/WebGL fails or is unavailable.
 * Uses D3 (already loaded for the main flamegraph) to show a simplified
 * tree view so the user never loses access to their profiling data.
 */

import type React from 'react';
import { useMemo } from 'react';
import type { useProfilerStore } from '@/panel/stores/profilerStore';
import { getRenderSeverityColor } from '@/shared/constants';

interface FallbackFlamegraphProps {
  commits: ReturnType<typeof useProfilerStore.getState>['commits'];
  error?: string;
}

export const FallbackFlamegraph: React.FC<FallbackFlamegraphProps> = ({ commits, error }) => {
  const treeData = useMemo(() => buildFlatTree(commits), [commits]);

  return (
    <div style={{
      padding: '16px',
      fontFamily: 'system-ui, sans-serif',
      color: '#94a3b8',
      height: '100%',
      overflow: 'auto',
    }}>
      {error && (
        <div style={{
          padding: '8px 12px',
          marginBottom: '12px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#f59e0b',
        }}>
          3D view unavailable: {error}. Showing simplified flamegraph instead.
        </div>
      )}

      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#e2e8f0' }}>
        Component Render Tree ({treeData.length} components)
      </div>

      <div style={{ position: 'relative' }}>
        {treeData.map((node, i) => (
          <div
            key={`${node.name}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '24px',
              marginBottom: '1px',
              paddingLeft: `${node.depth * 16}px`,
            }}
          >
            <div
              style={{
                height: '20px',
                minWidth: '4px',
                width: `${Math.max(4, node.durationPercent)}%`,
                background: getRenderSeverityColor(node.severity),
                borderRadius: '2px',
                opacity: 0.8,
                display: 'flex',
                alignItems: 'center',
                padding: '0 6px',
                fontSize: '11px',
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={`${node.name} — ${node.averageDuration.toFixed(2)}ms avg (${node.renderCount} renders)`}
            >
              {node.name}
            </div>
            <span style={{
              marginLeft: '6px',
              fontSize: '10px',
              color: '#64748b',
              whiteSpace: 'nowrap',
            }}>
              {node.averageDuration.toFixed(1)}ms
            </span>
          </div>
        ))}
      </div>

      {treeData.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>
          No component data available for the current selection.
        </div>
      )}
    </div>
  );
};

interface FlatTreeNode {
  name: string;
  depth: number;
  renderCount: number;
  averageDuration: number;
  durationPercent: number;
  severity: 'none' | 'info' | 'warning' | 'critical';
}

function buildFlatTree(commits: FallbackFlamegraphProps['commits']): FlatTreeNode[] {
  if (!commits || commits.length === 0) return [];

  const componentMap = new Map<string, { renderCount: number; totalDuration: number; depth: number }>();

  for (const commit of commits) {
    for (const node of commit.nodes ?? []) {
      const name = node.displayName;
      if (!name) continue;

      const existing = componentMap.get(name);
      if (existing) {
        existing.renderCount++;
        existing.totalDuration += node.actualDuration ?? 0;
      } else {
        componentMap.set(name, {
          renderCount: 1,
          totalDuration: node.actualDuration ?? 0,
          depth: 0,
        });
      }
    }
  }

  const maxDuration = Math.max(1, ...Array.from(componentMap.values()).map((c) => c.totalDuration / c.renderCount));

  return Array.from(componentMap.entries())
    .map(([name, data]) => {
      const avg = data.renderCount > 0 ? data.totalDuration / data.renderCount : 0;
      return {
        name,
        depth: data.depth,
        renderCount: data.renderCount,
        averageDuration: avg,
        durationPercent: (avg / maxDuration) * 80,
        severity: avg >= 16 ? 'critical' as const : avg >= 8 ? 'warning' as const : avg >= 2 ? 'info' as const : 'none' as const,
      };
    })
    .sort((a, b) => b.averageDuration - a.averageDuration)
    .slice(0, 200);
}

export default FallbackFlamegraph;
