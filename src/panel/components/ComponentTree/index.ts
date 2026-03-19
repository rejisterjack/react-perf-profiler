/**
 * ComponentTree Module
 *
 * Exports all component tree view components, types, and utilities.
 *
 * @example
 * ```tsx
 * import { TreeView, TreeSearch, type TreeNodeProps } from './ComponentTree';
 *
 * function MyPanel() {
 *   return (
 *     <>
 *       <TreeSearch
 *         value={filterText}
 *         onChange={setFilterText}
 *         severityFilter={severityFilter}
 *         onSeverityFilterChange={setSeverityFilter}
 *       />
 *       <TreeView />
 *     </>
 *   );
 * }
 * ```
 */

// Components
export { TreeView } from './TreeView';
export { TreeNode } from './TreeNode';
export { TreeSearch } from './TreeSearch';

// Types
export type { TreeViewProps } from './TreeView';
export type { TreeNodeProps } from './TreeNode';
export type { TreeSearchProps, SeverityFilter } from './TreeSearch';

// Default exports
export { default as TreeViewDefault } from './TreeView';
export { default as TreeNodeDefault } from './TreeNode';
export { default as TreeSearchDefault } from './TreeSearch';

// Re-export types from store for convenience
export type { TreeNode as TreeNodeData } from '@/panel/stores/profilerStore';
