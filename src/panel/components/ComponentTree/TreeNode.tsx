/**
 * TreeNode Component
 * Individual tree node component for the component tree view
 * Displays component information with metrics badges
 */

import type React from 'react';
import { memo, useCallback } from 'react';
import type { TreeNode as TreeNodeType } from '@/panel/stores/profilerStore';
import styles from './TreeNode.module.css';

// Icon components for different node types
const ChevronRightIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M4.5 2.5L8 6L4.5 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronDownIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M2.5 4.5L6 8L9.5 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ComponentIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="7" cy="7" r="2" fill="currentColor" />
  </svg>
);

const MemoIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M4 7L6.5 9.5L10 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Props for the TreeNode component
 */
export interface TreeNodeProps {
  /** Tree node data */
  node: TreeNodeType;
  /** Whether this node is currently selected */
  isSelected: boolean;
  /** Whether this node is expanded (has visible children) */
  isExpanded: boolean;
  /** Callback when node is selected */
  onSelect: () => void;
  /** Callback when expand/collapse is toggled */
  onToggle: () => void;
}

/**
 * Get the appropriate icon based on node type/memoization
 */
function getNodeIcon(node: TreeNodeType): React.FC<{ size?: number }> {
  if (node.isMemoized) return MemoIcon;
  // Note: We don't have direct type info, so we infer from other properties
  // In a real implementation, you'd have a node.type field
  return ComponentIcon;
}

/**
 * Get severity-based CSS class
 */
function getSeverityClass(severity: TreeNodeType['severity']): string {
  switch (severity) {
    case 'critical':
      return styles["critical"] ?? '';
    case 'warning':
      return styles["warning"] ?? '';
    case 'info':
      return styles["info"] ?? '';
    default:
      return styles["none"] ?? '';
  }
}

/**
 * TreeNode - Renders a single node in the component tree
 *
 * Features:
 * - Expand/collapse toggle for nodes with children
 * - Visual indicators for memoization and performance issues
 * - Metrics badges for wasted renders and render count
 * - Accessibility support (ARIA roles)
 *
 * @example
 * ```tsx
 * <TreeNode
 *   node={nodeData}
 *   isSelected={false}
 *   isExpanded={true}
 *   onSelect={() => handleSelect(nodeData)}
 *   onToggle={() => handleToggle(nodeData.id)}
 * />
 * ```
 */
export const TreeNode: React.FC<TreeNodeProps> = memo(
  ({ node, isSelected, isExpanded, onSelect, onToggle }) => {
    const hasChildren = node.hasChildren;
    const Icon = getNodeIcon(node);
    const severityClass = getSeverityClass(node.severity);

    /**
     * Handle toggle click - prevent propagation to select
     */
    const handleToggleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggle();
      },
      [onToggle]
    );

    /**
     * Handle keyboard interaction on the toggle button
     */
    const handleToggleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      },
      [onToggle]
    );

    return (
      <div
        className={`${styles["node"]} ${isSelected ? styles["selected"] : ''} ${severityClass}`}
        style={{ paddingLeft: `${node.depth * 16}px` }}
        onClick={onSelect}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={node.depth + 1}
        data-node-id={node.id}
        data-fiber-id={node.fiberId}
      >
        {/* Expand/collapse toggle button */}
        <button
          className={`${styles["toggle"]} ${!hasChildren ? styles["hidden"] : ''}`}
          onClick={handleToggleClick}
          onKeyDown={handleToggleKeyDown}
          disabled={!hasChildren}
          aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          tabIndex={-1} /* Focus is managed by tree container */
          type="button"
        >
          {hasChildren &&
            (isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />)}
        </button>

        {/* Component type icon */}
        <span className={`${styles["icon"]} ${node.isMemoized ? styles["memoized"] : ''}`}>
          <Icon size={14} />
        </span>

        {/* Component name */}
        <span className={styles["name"]} title={node.name}>
          {node.name}
        </span>

        {/* Metrics badges */}
        <div className={styles["badges"]}>
          {/* Wasted renders badge - only show if > 0 */}
          {node.wastedRenders > 0 && (
            <span
              className={`${styles["badge"]} ${styles["badgeError"]}`}
              title={`${node.wastedRenders} wasted render${node.wastedRenders !== 1 ? 's' : ''}`}
            >
              {node.wastedRenders}
            </span>
          )}

          {/* Memoization badge */}
          {node.isMemoized && (
            <span
              className={`${styles["badge"]} ${styles["badgeSuccess"]}`}
              title="Memoized (React.memo)"
            >
              M
            </span>
          )}

          {/* Render count badge */}
          <span
            className={`${styles["badge"]} ${styles["badgeInfo"]}`}
            title={`${node.renderCount} render${node.renderCount !== 1 ? 's' : ''}`}
          >
            {node.renderCount}
          </span>
        </div>
      </div>
    );
  }
);

TreeNode.displayName = 'TreeNode';

export default TreeNode;
