/**
 * Sidebar Component
 * Left sidebar containing the component tree and search functionality
 */

import React, { forwardRef, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon } from '../Common/Icon/Icon';
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
    expandAllNodes,
    collapseAllNodes,
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
              className={styles["clearButton"]}
              onClick={() => setFilterText('')}
              aria-label="Clear filter"
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>

        {/* Severity Filters */}
        <div className={styles["filterChips"]} role="group" aria-label="Severity filters">
          {(['critical', 'warning', 'info'] as const).map((severity) => (
            <button
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
        </div>

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
            className={styles["actionButton"]}
            onClick={expandAllNodes}
            disabled={!hasData}
            title="Expand all nodes"
            aria-label="Expand all nodes"
          >
            <Icon name="expand" size={16} />
            Expand
          </button>
          <button
            className={styles["actionButton"]}
            onClick={collapseAllNodes}
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

const TreeViewPlaceholder: React.FC = () => {
  // Placeholder for the actual TreeView component
  // This would be replaced with the real TreeView component
  const { commits } = useProfilerStore();

  // Generate a simple list view as placeholder
  const components = React.useMemo(() => {
    const uniqueComponents = new Set<string>();
    commits.forEach((commit) => {
      commit.nodes?.forEach((node) => {
        if (node.displayName) {
          uniqueComponents.add(node.displayName);
        }
      });
    });
    return Array.from(uniqueComponents).slice(0, 50);
  }, [commits]);

  if (components.length === 0) {
    return (
      <div className={styles["emptyState"]}>
        <Icon name="component" size={24} />
        <p>No components found in commits</p>
      </div>
    );
  }

  return (
    <div className={styles["placeholderList"]} role="tree">
      {components.map((name, index) => (
        <div
          key={name}
          className={styles["placeholderItem"]}
          role="treeitem"
          tabIndex={0}
          style={{
            paddingLeft: `${12 + (index % 3) * 20}px`,
            color:
              index % 5 === 0
                ? 'var(--severity-critical)'
                : index % 4 === 0
                  ? 'var(--severity-warning)'
                  : 'var(--text-primary)',
          }}
        >
          <Icon name="component" size={16} />
          <span className={styles["componentName"]}>{name}</span>
        </div>
      ))}
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
