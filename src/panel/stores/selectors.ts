/**
 * Memoized selectors for the profiler store
 * Provides efficient data transformation and filtering
 */

import { createSelector } from 'reselect';
import type { CommitData, FiberNode, WastedRenderReport } from '@/shared/types';
import type { ComponentData, ProfilerState, TreeNode } from './profilerStore';

// ============================================================================
// Type Definitions
// ============================================================================

type ProfilerStoreSelector<T> = (state: ProfilerState) => T;

interface FilteredCommit {
  /** Commit data */
  commit: CommitData;
  /** Whether this commit passes the filter */
  visible: boolean;
  /** Filtered nodes within this commit */
  filteredNodes: FiberNode[];
}

// ============================================================================
// Base Selectors
// ============================================================================

/** Select all commits from state */
export const selectCommits: ProfilerStoreSelector<CommitData[]> = (state) => state.commits;

/** Select the currently selected commit id */
export const selectSelectedCommitId: ProfilerStoreSelector<string | null> = (state) =>
  state.selectedCommitId;

/** Select the currently selected component */
export const selectSelectedComponent: ProfilerStoreSelector<string | null> = (state) =>
  state.selectedComponent;

/** Select the filter text */
export const selectFilterText: ProfilerStoreSelector<string> = (state) => state.filterText;

/** Select wasted render reports */
export const selectWastedRenderReports: ProfilerStoreSelector<WastedRenderReport[]> = (state) =>
  state.wastedRenderReports;

/** Select expanded nodes set */
export const selectExpandedNodes: ProfilerStoreSelector<Set<string>> = (state) =>
  state.expandedNodes;

/** Select view mode */
export const selectViewMode: ProfilerStoreSelector<string> = (state) => state.viewMode;

/** Select whether detail panel is open */
export const selectIsDetailPanelOpen: ProfilerStoreSelector<boolean> = (state) =>
  state.isDetailPanelOpen;

// ============================================================================
// Derived Selectors
// ============================================================================

/**
 * Select the currently selected commit
 * Returns null if no commit is selected or if the selected commit doesn't exist
 */
export const selectSelectedCommit = createSelector(
  [selectCommits, selectSelectedCommitId],
  (commits, selectedCommitId): CommitData | null => {
    if (!selectedCommitId) return null;
    const found = commits.find((commit) => commit.id === selectedCommitId);
    return found ?? null;
  }
);

/**
 * Select the last/most recent commit
 */
export const selectLastCommit = createSelector([selectCommits], (commits): CommitData | null => {
  if (commits.length === 0) return null;
  return commits[commits.length - 1] ?? null;
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Aggregate component data from commits
 * Shared helper to eliminate duplication between selectors
 */
function aggregateComponentData(commits: CommitData[]): Map<string, ComponentData> {
  const componentMap = new Map<string, ComponentData>();

  for (const commit of commits) {
    const nodes = commit.nodes ?? [];
    for (const node of nodes) {
      const name = node.displayName;
      if (!name) continue;

      let data = componentMap.get(name);
      if (!data) {
        data = {
          name,
          renderCount: 0,
          wastedRenders: 0,
          wastedRenderRate: 0,
          averageDuration: 0,
          totalDuration: 0,
          isMemoized: false,
          memoHitRate: 0,
          commitIds: [],
          severity: 'none',
        };
        componentMap.set(name, data);
      }

      data.renderCount++;
      data.totalDuration += node.actualDuration;
      data.commitIds.push(commit.id);

      if (node.isMemoized) {
        data.isMemoized = true;
      }
    }
  }

  // Calculate averages
  for (const data of componentMap.values()) {
    data.averageDuration = data.totalDuration / data.renderCount;
  }

  return componentMap;
}

/**
 * Select component data for the currently selected component
 * Aggregates data across all commits
 */
export const selectSelectedComponentData = createSelector(
  [selectCommits, selectSelectedComponent],
  (commits, componentName): ComponentData | null => {
    if (!componentName) return null;

    const componentMap = aggregateComponentData(commits);
    return componentMap.get(componentName) ?? null;
  }
);

/**
 * Select filtered commits based on current filters
 */
export const selectFilteredCommits = createSelector(
  [selectCommits, selectFilterText],
  (commits, filterText): FilteredCommit[] => {
    const normalizedFilter = filterText.toLowerCase().trim();

    return commits.map((commit) => {
      let visibleNodes = commit.nodes ?? [];

      // Apply text filter
      if (normalizedFilter) {
        visibleNodes = visibleNodes.filter((node) =>
          node.displayName?.toLowerCase().includes(normalizedFilter)
        );
      }

      // Commit is visible if it has any visible nodes
      const visible = visibleNodes.length > 0;

      return {
        commit,
        visible,
        filteredNodes: visibleNodes,
      };
    });
  }
);

/**
 * Select commits that pass all filters
 */
export const selectVisibleCommits = createSelector(
  [selectFilteredCommits],
  (filteredCommits): CommitData[] => {
    return filteredCommits.filter((fc) => fc.visible).map((fc) => fc.commit);
  }
);

/**
 * Select all unique component names from commits
 */
export const selectAllComponentNames = createSelector([selectCommits], (commits): string[] => {
  const names = new Set<string>();
  for (const commit of commits) {
    const nodes = commit.nodes ?? [];
    for (const node of nodes) {
      if (node.displayName) {
        names.add(node.displayName);
      }
    }
  }
  return Array.from(names).sort();
});

/**
 * Select filtered component names based on text filter
 */
export const selectFilteredComponentNames = createSelector(
  [selectAllComponentNames, selectFilterText],
  (names, filterText): string[] => {
    if (!filterText.trim()) return names;
    const normalizedFilter = filterText.toLowerCase().trim();
    return names.filter((name) => name.toLowerCase().includes(normalizedFilter));
  }
);

/**
 * Select aggregated data for all components
 */
export const selectAllComponentData = createSelector(
  [selectCommits],
  (commits): Map<string, ComponentData> => {
    return aggregateComponentData(commits);
  }
);

/**
 * Select filtered component data based on all filters
 */
export const selectFilteredComponentData = createSelector(
  [selectAllComponentData, selectFilterText],
  (componentMap, filterText): ComponentData[] => {
    let components = Array.from(componentMap.values());

    // Apply text filter
    if (filterText.trim()) {
      const normalizedFilter = filterText.toLowerCase().trim();
      components = components.filter((c) => c.name.toLowerCase().includes(normalizedFilter));
    }

    // Sort by severity (critical first) then by wasted render rate
    return components.sort((a, b) => {
      const severityOrder: Record<string, number> = {
        critical: 0,
        high: 0,
        warning: 1,
        medium: 1,
        info: 2,
        low: 2,
        none: 3,
      };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
      }
      return b.wastedRenderRate - a.wastedRenderRate;
    });
  }
);

/**
 * Select count of critical issues
 */
export const selectCriticalIssuesCount = createSelector(
  [selectWastedRenderReports],
  (reports): number => {
    return reports.filter((r) => r.severity === 'critical' || r.severity === 'high').length;
  }
);

/**
 * Select count of warning issues
 */
export const selectWarningIssuesCount = createSelector(
  [selectWastedRenderReports],
  (reports): number => {
    return reports.filter((r) => r.severity === 'medium').length;
  }
);

/**
 * Select total issues count by severity
 */
export const selectIssuesCountBySeverity = createSelector(
  [selectWastedRenderReports],
  (reports): { critical: number; warning: number; info: number } => {
    return {
      critical: reports.filter((r) => r.severity === 'critical' || r.severity === 'high').length,
      warning: reports.filter((r) => r.severity === 'medium').length,
      info: reports.filter((r) => r.severity === 'low').length,
    };
  }
);

/**
 * Select tree data for virtual list rendering
 * Transforms commits into a flattened tree structure
 * Uses O(1) node lookup map for efficient child traversal
 */
export const selectTreeData = createSelector(
  [selectSelectedCommit, selectExpandedNodes, selectFilterText],
  (selectedCommit, expandedNodes, filterText): TreeNode[] => {
    if (!selectedCommit) return [];

    const nodes: TreeNode[] = [];
    const normalizedFilter = filterText.toLowerCase().trim();

    // Build O(1) lookup map for nodes
    const nodeMap = new Map<number, FiberNode>();
    for (const node of selectedCommit.nodes ?? []) {
      if (node.id !== undefined && node.id !== null) {
        nodeMap.set(node.id, node);
      }
    }

    function processNode(fiber: FiberNode, depth: number, parentId: string | null): string {
      if (!selectedCommit) return '';
      const nodeId = `${selectedCommit.id}-${fiber.id}`;
      const hasChildren = fiber.children && fiber.children.length > 0;
      const isExpanded = expandedNodes.has(nodeId);

      // Check if node matches filter
      const matchesFilter =
        !normalizedFilter || fiber.displayName?.toLowerCase().includes(normalizedFilter);

      const treeNode: TreeNode = {
        id: nodeId,
        name: fiber.displayName || 'Unknown',
        depth,
        hasChildren,
        isExpanded,
        isSelected: false, // Would be set based on selection state
        renderCount: 1, // Would be aggregated from all commits
        wastedRenders: 0,
        averageDuration: fiber.actualDuration,
        isMemoized: fiber.isMemoized,
        severity: 'none',
        parentId,
        childIds: [],
        fiberId: fiber.id,
      };

      // Only add if it matches filter or has children that might match
      if (matchesFilter || hasChildren) {
        nodes.push(treeNode);

        // Process children if expanded or no filter
        if (hasChildren && (isExpanded || !normalizedFilter)) {
          for (const childId of fiber.children) {
            // O(1) lookup instead of O(n) linear search
            const childFiber = nodeMap.get(childId);
            if (childFiber) {
              const childNodeId = processNode(childFiber, depth + 1, nodeId);
              treeNode.childIds.push(childNodeId);
            }
          }
        }
      }

      return nodeId;
    }

    // Start processing from root
    if (selectedCommit?.rootId) {
      const rootFiber = nodeMap.get(selectedCommit.rootId);
      if (rootFiber) {
        processNode(rootFiber, 0, null);
      }
    }

    return nodes;
  }
);

/**
 * Select timeline data for timeline view
 * Returns commits formatted for timeline visualization
 */
export const selectTimelineData = createSelector(
  [selectCommits],
  (
    commits
  ): Array<{
    id: string;
    timestamp: number;
    duration: number;
    componentCount: number;
    totalRenderTime: number;
  }> => {
    return commits.map((commit) => {
      const nodes = commit.nodes ?? [];
      return {
        id: commit.id,
        timestamp: commit.timestamp,
        duration: commit.duration || 0,
        componentCount: nodes.length,
        totalRenderTime: nodes.reduce((sum, node) => sum + node.actualDuration, 0),
      };
    });
  }
);

/**
 * Local flamegraph node type for selectors
 */
interface LocalFlamegraphNode {
  id: string;
  name: string;
  value: number;
  children: LocalFlamegraphNode[];
  depth: number;
}

/**
 * Select flamegraph data for flamegraph view
 * Uses O(1) node lookup map for efficient child traversal
 */
export const selectFlamegraphData = createSelector(
  [selectSelectedCommit],
  (commit): LocalFlamegraphNode | null => {
    if (!commit) return null;

    // Build O(1) lookup map for nodes
    const nodeMap = new Map<number, FiberNode>();
    for (const node of commit.nodes ?? []) {
      if (node.id !== undefined && node.id !== null) {
        nodeMap.set(node.id, node);
      }
    }

    function buildFlamegraphNode(fiber: FiberNode, depth: number): LocalFlamegraphNode {
      const children: LocalFlamegraphNode[] = [];

      // Find child nodes using O(1) lookup
      for (const childId of fiber.children ?? []) {
        const childFiber = nodeMap.get(childId);
        if (childFiber) {
          children.push(buildFlamegraphNode(childFiber, depth + 1));
        }
      }

      return {
        id: String(fiber.id),
        name: fiber.displayName || 'Unknown',
        value: fiber.actualDuration,
        children,
        depth,
      };
    }

    const rootFiber = nodeMap.get(commit.rootId ?? -1);
    return rootFiber ? buildFlamegraphNode(rootFiber, 0) : null;
  }
);

/**
 * Select summary statistics for the current session
 */
export const selectSessionStats = createSelector(
  [selectCommits, selectWastedRenderReports],
  (commits, wastedRenderReports) => {
    if (commits.length === 0) {
      return {
        totalCommits: 0,
        totalComponents: 0,
        totalRenderTime: 0,
        averageCommitDuration: 0,
        totalWastedRenders: 0,
        componentsWithIssues: 0,
      };
    }

    const uniqueComponents = new Set<string>();
    let totalRenderTime = 0;
    let totalCommitDuration = 0;

    for (const commit of commits) {
      totalCommitDuration += commit.duration || 0;
      const nodes = commit.nodes ?? [];
      for (const node of nodes) {
        if (node.displayName) {
          uniqueComponents.add(node.displayName);
        }
        totalRenderTime += node.actualDuration;
      }
    }

    const totalWastedRenders = wastedRenderReports.reduce(
      (sum, r) => sum + (r.wastedRenders || 0),
      0
    );

    return {
      totalCommits: commits.length,
      totalComponents: uniqueComponents.size,
      totalRenderTime,
      averageCommitDuration: totalCommitDuration / commits.length,
      totalWastedRenders,
      componentsWithIssues: wastedRenderReports.length,
    };
  }
);

// ============================================================================
// Export all selectors
// ============================================================================

export const selectors = {
  // Base selectors
  selectCommits,
  selectSelectedCommitId,
  selectSelectedComponent,
  selectFilterText,
  selectWastedRenderReports,
  selectExpandedNodes,
  selectViewMode,
  selectIsDetailPanelOpen,

  // Derived selectors
  selectSelectedCommit,
  selectLastCommit,
  selectSelectedComponentData,
  selectFilteredCommits,
  selectVisibleCommits,
  selectAllComponentNames,
  selectFilteredComponentNames,
  selectAllComponentData,
  selectFilteredComponentData,
  selectCriticalIssuesCount,
  selectWarningIssuesCount,
  selectIssuesCountBySeverity,
  selectTreeData,
  selectTimelineData,
  selectFlamegraphData,
  selectSessionStats,
};

export default selectors;
