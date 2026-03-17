/**
 * TreeView Component
 * Main tree view with virtualization using @tanstack/react-virtual
 * Provides efficient rendering of large component trees
 */

import React, { useCallback, useMemo, useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useProfilerStore, selectTreeData } from '@/panel/stores/profilerStore';
import type { TreeNode } from '@/panel/stores/profilerStore';
import { TreeNode as TreeNodeComponent } from './TreeNode';
import styles from './TreeView.module.css';

// Virtualization constants
const ITEM_HEIGHT = 28;
const OVERSCAN = 5;

/**
 * Props for the TreeView component
 */
export interface TreeViewProps {
  /** Optional className for styling */
  className?: string;
}

/**
 * TreeView - Virtualized tree component for displaying React component hierarchy
 * 
 * Features:
 * - Virtual scrolling for large trees (thousands of nodes)
 * - Smooth expand/collapse animations
 * - Keyboard navigation support
 * - Accessibility (ARIA tree roles)
 * 
 * @example
 * ```tsx
 * <TreeView className="my-tree" />
 * ```
 */
export const TreeView: React.FC<TreeViewProps> = memo(({ className }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Get tree data from store using memoized selector
  const treeData = useProfilerStore(selectTreeData);
  
  // Get UI state from store
  const { 
    selectedComponentName, 
    selectComponent, 
    expandedNodes, 
    toggleNodeExpanded,
    setViewMode,
  } = useProfilerStore();

  // Set up virtualizer for efficient rendering
  const virtualizer = useVirtualizer({
    count: treeData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Get currently selected index
    const selectedIndex = treeData.findIndex(
      node => node.name === selectedComponentName
    );

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = Math.min(selectedIndex + 1, treeData.length - 1);
        if (nextIndex >= 0) {
          selectComponent(treeData[nextIndex].name);
          virtualizer.scrollToIndex(nextIndex, { align: 'center' });
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = Math.max(selectedIndex - 1, 0);
        if (prevIndex >= 0) {
          selectComponent(treeData[prevIndex].name);
          virtualizer.scrollToIndex(prevIndex, { align: 'center' });
        }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (selectedIndex >= 0) {
          const node = treeData[selectedIndex];
          if (node.hasChildren && !expandedNodes.has(node.id)) {
            toggleNodeExpanded(node.id);
          }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (selectedIndex >= 0) {
          const node = treeData[selectedIndex];
          if (expandedNodes.has(node.id)) {
            toggleNodeExpanded(node.id);
          } else if (node.parentId) {
            // Move to parent
            const parentIndex = treeData.findIndex(n => n.id === node.parentId);
            if (parentIndex >= 0) {
              const parentNode = treeData[parentIndex];
              selectComponent(parentNode.name);
              virtualizer.scrollToIndex(parentIndex, { align: 'center' });
            }
          }
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (selectedComponentName) {
          // Open detail view
          setViewMode('analysis');
        }
        break;
      }
      case 'Home': {
        e.preventDefault();
        if (treeData.length > 0) {
          selectComponent(treeData[0].name);
          virtualizer.scrollToIndex(0);
        }
        break;
      }
      case 'End': {
        e.preventDefault();
        if (treeData.length > 0) {
          const lastIndex = treeData.length - 1;
          selectComponent(treeData[lastIndex].name);
          virtualizer.scrollToIndex(lastIndex);
        }
        break;
      }
    }
  }, [
    treeData, 
    selectedComponentName, 
    expandedNodes, 
    selectComponent, 
    toggleNodeExpanded,
    setViewMode,
    virtualizer
  ]);

  /**
   * Handle node selection
   */
  const handleSelect = useCallback((node: TreeNode) => {
    selectComponent(node.name);
  }, [selectComponent]);

  /**
   * Handle node expand/collapse toggle
   */
  const handleToggle = useCallback((nodeId: string) => {
    toggleNodeExpanded(nodeId);
  }, [toggleNodeExpanded]);

  // Memoize container classes
  const containerClasses = useMemo(() => {
    return [styles.treeView, className].filter(Boolean).join(' ');
  }, [className]);

  // Empty state when no data
  if (treeData.length === 0) {
    return (
      <div className={styles.emptyState} role="status" aria-live="polite">
        <div className={styles.emptyIcon}>🌳</div>
        <p className={styles.emptyText}>No component data available</p>
        <p className={styles.emptySubtext}>
          Start recording to capture React component renders
        </p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={containerClasses}
      onKeyDown={handleKeyDown}
      role="tree"
      aria-label="Component tree"
      tabIndex={0}
    >
      <div
        className={styles.treeContent}
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const node = treeData[virtualItem.index];
          const isSelected = selectedComponentName === node.name;
          const isExpanded = expandedNodes.has(node.id);

          return (
            <div
              key={node.id}
              className={styles.virtualItem}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              data-index={virtualItem.index}
            >
              <TreeNodeComponent
                node={node}
                isSelected={isSelected}
                isExpanded={isExpanded}
                onSelect={() => handleSelect(node)}
                onToggle={() => handleToggle(node.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

TreeView.displayName = 'TreeView';

export default TreeView;
