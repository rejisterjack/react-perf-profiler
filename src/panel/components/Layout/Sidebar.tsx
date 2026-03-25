/**
 * Sidebar Component
 * Left sidebar containing the component tree and search functionality
 */

import React, { forwardRef, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon } from '../Common/Icon/Icon';
import { getRenderSeverity, getRenderSeverityColor } from '@/shared/constants';
import styles from './Sidebar.module.css';

// =============================================================================
// Types
// =============================================================================

interface SidebarProps {
  /** Current width of the sidebar in pixels */
  width: number;
  /** Callback when sidebar is resized */
  onResize: (width: number) => void;
}

// =============================================================================
// Component
// =============================================================================

export const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(({ width }, ref) => {
  const {
    filterText,
    setFilterText,
    severityFilter,
    setSeverityFilter,
    componentTypeFilter,
    setComponentTypeFilter,
    commits,
    expandedNodes,
    expandAll,
    collapseAll,
  } = useProfilerStore();

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleSeverityToggle = (severity: 'critical' | 'warning' | 'info') => {
    if (severityFilter.includes(severity)) {
      setSeverityFilter(
        severityFilter.filter((s: 'critical' | 'warning' | 'info') => s !== severity)
      );
    } else {
      setSeverityFilter([...severityFilter, severity]);
    }
  };

  const hasData = commits.length > 0;

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <aside
      ref={ref}
      className={styles["sidebar"]}
      style={{ width }}
      aria-label="Component tree sidebar"
    >
      {/* Search and Filter Header */}
      <div className={styles["header"]}>
        <div className={`${styles["searchContainer"]} ${isSearchFocused ? styles["focused"] : ''}`}>
          <Icon name="search" size={16} className={styles["searchIcon"]} />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Filter components..."
            className={styles["searchInput"]}
            aria-label="Filter components"
          />
          {filterText && (
            <button
              type="button"
              className={styles["clearButton"]}
              onClick={() => setFilterText('')}
              aria-label="Clear filter"
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>

        {/* Severity Filters */}
        <fieldset className={styles["filterChips"]} aria-label="Severity filters">
          {(['critical', 'warning', 'info'] as const).map((severity) => (
            <button
              type="button"
              key={severity}
              className={`${styles["filterChip"]} ${
                severityFilter.includes(severity) ? styles["active"] : ''
              } ${styles[severity]}`}
              onClick={() => handleSeverityToggle(severity)}
              aria-pressed={severityFilter.includes(severity)}
            >
              <span className={styles["chipDot"]} />
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </fieldset>

        {/* Component Type Filter */}
        <select
          value={componentTypeFilter}
          onChange={(e) =>
            setComponentTypeFilter(e.target.value as 'memoized' | 'unmemoized' | 'all')
          }
          className={styles["typeFilter"]}
          aria-label="Component type filter"
        >
          <option value="all">All Components</option>
          <option value="memoized">Memoized Only</option>
          <option value="unmemoized">Unmemoized Only</option>
        </select>
      </div>

      {/* Tree Actions */}
      <div className={styles["actions"]}>
        <span className={styles["nodeCount"]}>{expandedNodes.size} nodes expanded</span>
        <div className={styles["actionButtons"]}>
          <button
            type="button"
            className={styles["actionButton"]}
            onClick={expandAll}
            disabled={!hasData}
            title="Expand all nodes"
            aria-label="Expand all nodes"
          >
            <Icon name="expand" size={16} />
            Expand
          </button>
          <button
            type="button"
            className={styles["actionButton"]}
            onClick={collapseAll}
            disabled={!hasData}
            title="Collapse all nodes"
            aria-label="Collapse all nodes"
          >
            <Icon name="collapse" size={16} />
            Collapse
          </button>
        </div>
      </div>

      {/* Tree Container */}
      <div className={styles["treeContainer"]}>
        {hasData ? <TreeViewPlaceholder /> : <EmptyState />}
      </div>

      {/* Sidebar Footer */}
      <div className={styles["footer"]}>
        <div className={styles["legend"]}>
          <div className={styles["legendItem"]}>
            <span className={`${styles["legendDot"]} ${styles["critical"]}`} />
            Critical
          </div>
          <div className={styles["legendItem"]}>
            <span className={`${styles["legendDot"]} ${styles["warning"]}`} />
            Warning
          </div>
          <div className={styles["legendItem"]}>
            <span className={`${styles["legendDot"]} ${styles["info"]}`} />
            Info
          </div>
        </div>
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

// =============================================================================
// Sub-components
// =============================================================================

// =============================================================================
// Severity helpers (using shared constants)
// =============================================================================

const severityColor = getRenderSeverityColor;

// =============================================================================
// TreeView row type
// =============================================================================

interface TreeRow {
  node: {
    id: number;
    displayName: string;
    actualDuration: number;
    isMemoized: boolean;
    children: number[];
    parentId: number | null;
  };
  depth: number;
}

// =============================================================================
// Real TreeView component
// =============================================================================

const TreeViewPlaceholder: React.FC = () => {
  const {
    commits,
    selectedCommitId,
    selectCommit,
    filterText,
    severityFilter,
    componentTypeFilter,
    expandedNodes,
    toggleNodeExpanded,
    selectComponent,
  } = useProfilerStore();

  // Local state to track which commit's tree to show (defaults to selectedCommitId or latest)
  const [localCommitId, setLocalCommitId] = React.useState<string | null>(null);

  const activeCommitId = localCommitId ?? selectedCommitId ?? commits[commits.length - 1]?.id ?? null;

  const activeCommit = React.useMemo(
    () => commits.find((c) => c.id === activeCommitId) ?? commits[commits.length - 1] ?? null,
    [commits, activeCommitId]
  );

  // Build flat DFS list respecting expandedNodes
  const allRows = React.useMemo<TreeRow[]>(() => {
    if (!activeCommit?.nodes) return [];
    const nodes = activeCommit.nodes;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const roots = nodes.filter((n) => n.parentId === null);

    const rows: TreeRow[] = [];

    function dfs(nodeId: number, depth: number) {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      rows.push({ node, depth });
      const key = String(nodeId);
      if (expandedNodes.has(key) && node.children.length > 0) {
        for (const childId of node.children) {
          dfs(childId, depth + 1);
        }
      }
    }

    for (const r of roots) {
      dfs(r.id, 0);
    }
    return rows;
  }, [activeCommit, expandedNodes]);

  // Apply filters
  const visibleRows = React.useMemo<TreeRow[]>(() => {
    return allRows.filter(({ node }) => {
      if (filterText && !node.displayName.toLowerCase().includes(filterText.toLowerCase())) {
        return false;
      }
      if (componentTypeFilter === 'memoized' && !node.isMemoized) return false;
      if (componentTypeFilter === 'unmemoized' && node.isMemoized) return false;
      if (severityFilter.length > 0) {
        const sev = getRenderSeverity(node.actualDuration);
        if (sev === 'none') return false;
        if (!severityFilter.includes(sev as 'critical' | 'warning' | 'info')) return false;
      }
      return true;
    });
  }, [allRows, filterText, componentTypeFilter, severityFilter]);

  // Summary stats
  const summary = React.useMemo(() => {
    const nodes = activeCommit?.nodes ?? [];
    const memoizedCount = nodes.filter((n) => n.isMemoized).length;
    const totalDuration = nodes.reduce((sum, n) => sum + n.actualDuration, 0);
    return { total: nodes.length, memoized: memoizedCount, totalDuration };
  }, [activeCommit]);

  if (!activeCommit) {
    return (
      <div className={styles["emptyState"]}>
        <Icon name="component" size={24} />
        <p>No components found in commits</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Commit selector */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color, #333)', flexShrink: 0 }}>
        <select
          value={activeCommitId ?? ''}
          onChange={(e) => {
            const id = e.target.value;
            setLocalCommitId(id);
            selectCommit(id);
          }}
          style={{
            width: '100%',
            background: 'var(--surface-2, #2a2a2a)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color, #444)',
            borderRadius: '4px',
            padding: '4px 6px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
          aria-label="Select commit to inspect"
        >
          {commits.map((commit, idx) => (
            <option key={commit.id} value={commit.id}>
              Commit #{idx + 1} — {(commit.duration || 0).toFixed(1)}ms ({commit.nodes?.length ?? 0} components)
            </option>
          ))}
        </select>
      </div>

      {/* Summary line */}
      <div style={{
        padding: '4px 8px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border-color, #333)',
        flexShrink: 0,
      }}>
        {summary.total} components | {summary.memoized} memoized | {summary.totalDuration.toFixed(1)}ms total
      </div>

      {/* Tree rows */}
      <div
        role="tree"
        aria-label="Component tree"
        style={{ overflowY: 'auto', flex: 1 }}
      >
        {visibleRows.length === 0 ? (
          <div className={styles["emptyState"]}>
            <Icon name="component" size={24} />
            <p>No components match filters</p>
          </div>
        ) : (
          visibleRows.map(({ node, depth }) => {
            const key = String(node.id);
            const isExpanded = expandedNodes.has(key);
            const hasChildren = node.children.length > 0;
            const severity = getRenderSeverity(node.actualDuration);

            return (
              <div
                key={key}
                role="treeitem"
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-level={depth + 1}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectComponent(node.displayName); } }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  paddingLeft: `${8 + depth * 16}px`,
                  paddingRight: '8px',
                  paddingTop: '3px',
                  paddingBottom: '3px',
                  cursor: 'default',
                  userSelect: 'none',
                  fontSize: '12px',
                  minHeight: '24px',
                  borderBottom: '1px solid var(--border-color-subtle, rgba(255,255,255,0.04))',
                }}
              >
                {/* Expand/collapse toggle */}
                <button
                  type="button"
                  onClick={() => hasChildren && toggleNodeExpanded(key)}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: hasChildren ? 'pointer' : 'default',
                    color: hasChildren ? 'var(--text-secondary)' : 'transparent',
                    padding: '0',
                    width: '14px',
                    flexShrink: 0,
                    fontSize: '10px',
                    lineHeight: 1,
                  }}
                  tabIndex={hasChildren ? 0 : -1}
                >
                  {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
                </button>

                {/* Severity dot */}
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: severityColor(severity),
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />

                {/* Component name */}
                <button
                  type="button"
                  onClick={() => selectComponent(node.displayName)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '12px',
                    textAlign: 'left',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={node.displayName}
                >
                  {node.displayName}
                  {node.isMemoized && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '10px', marginLeft: '4px' }}>
                      (memo)
                    </span>
                  )}
                </button>

                {/* Duration badge */}
                <span
                  style={{
                    fontSize: '10px',
                    color: severityColor(severity),
                    background: 'var(--surface-2, rgba(0,0,0,0.3))',
                    borderRadius: '3px',
                    padding: '1px 4px',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {node.actualDuration.toFixed(1)}ms
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div className={styles["emptyState"]}>
    <Icon name="tree" size={32} className={styles["emptyIcon"]} />
    <p className={styles["emptyTitle"]}>No Data</p>
    <p className={styles["emptyText"]}>Start recording to see the component tree</p>
  </div>
);

export default Sidebar;
