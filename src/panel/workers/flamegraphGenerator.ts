/**
 * Flamegraph data generation utilities
 * Converts React fiber tree to hierarchical format for D3 visualization
 */

import type { CommitData, FiberData } from '@/content/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Node in the flamegraph hierarchy
 * Represents a component render with timing information
 */
export interface FlamegraphNode {
  /** Component display name */
  name: string;
  /** Render duration in milliseconds */
  value: number;
  /** Child nodes */
  children: FlamegraphNode[];
  /** Reference to original fiber data */
  originalData: FiberData;
  /** Depth in the tree (0 = root) */
  depth: number;
  /** Self duration (excluding children) */
  selfDuration: number;
  /** Cumulative duration including all descendants */
  cumulativeDuration: number;
  /** Color for visualization */
  color?: string;
  /** Whether this node is visible (passed filters) */
  visible: boolean;
}

/**
 * Complete flamegraph data structure
 */
export interface FlamegraphData {
  /** Root node of the flamegraph */
  root: FlamegraphNode;
  /** Maximum depth of the tree */
  maxDepth: number;
  /** Total duration of the commit */
  totalDuration: number;
  /** Total number of nodes */
  nodeCount: number;
  /** Timestamp of the commit */
  timestamp: number;
  /** Commit ID */
  commitId: string;
}

/**
 * Configuration for flamegraph generation
 */
export interface FlamegraphConfig {
  /** Minimum duration threshold for including nodes (ms) */
  minDuration?: number;
  /** Maximum depth to traverse */
  maxDepth?: number;
  /** Whether to include native DOM components */
  includeHostComponents?: boolean;
  /** Color scheme for the flamegraph */
  colorScheme?: 'duration' | 'type' | 'self-time';
}

// ============================================================================
// Color Constants
// ============================================================================

/** Color palette for different render durations */
const DURATION_COLORS = {
  fast: '#4caf50',      // < 1ms - Green
  normal: '#2196f3',    // 1-5ms - Blue
  slow: '#ff9800',      // 5-16ms - Orange
  verySlow: '#f44336',  // > 16ms - Red
};

/** Color palette for component types */
const TYPE_COLORS = {
  function: '#2196f3',
  class: '#9c27b0',
  memo: '#4caf50',
  forwardRef: '#ff9800',
  host: '#757575',
  context: '#00bcd4',
  other: '#9e9e9e',
};

// ============================================================================
// Main Generation Functions
// ============================================================================

/**
 * Converts commit data to flamegraph format
 * Creates a hierarchical structure suitable for D3 visualization
 * 
 * @param commit - Commit data from React profiler
 * @param config - Optional configuration
 * @returns Flamegraph data structure
 * 
 * @example
 * ```typescript
 * const flamegraph = generateFlamegraphData(commit);
 * console.log(`Total nodes: ${flamegraph.nodeCount}`);
 * ```
 */
export function generateFlamegraphData(
  commit: CommitData,
  config: FlamegraphConfig = {}
): FlamegraphData {
  const {
    maxDepth = 50,
    includeHostComponents = false,
    colorScheme = 'duration',
  } = config;

  if (!commit.rootFiber) {
    throw new Error('Commit has no root fiber');
  }

  // Convert root fiber to hierarchy
  const root = convertFiberToHierarchy(
    commit.rootFiber,
    0,
    maxDepth,
    includeHostComponents
  );

  // Calculate node statistics
  const stats = calculateStats(root);

  // Apply colors based on scheme
  applyColors(root, colorScheme);

  return {
    root,
    maxDepth: stats.maxDepth,
    totalDuration: root.cumulativeDuration,
    nodeCount: stats.nodeCount,
    timestamp: commit.timestamp,
    commitId: commit.commitId,
  };
}

/**
 * Transforms a fiber node into a flamegraph node
 * Recursively processes children to build the hierarchy
 * 
 * @param fiber - Fiber node from React
 * @param depth - Current depth in the tree
 * @param maxDepth - Maximum depth to traverse
 * @param includeHostComponents - Whether to include DOM components
 * @returns Flamegraph node
 */
export function convertFiberToHierarchy(
  fiber: FiberData,
  depth: number,
  maxDepth: number,
  includeHostComponents: boolean
): FlamegraphNode {
  // Calculate self duration by subtracting children's time
  const childrenDuration = calculateChildrenDuration(fiber);
  const selfDuration = Math.max(0, fiber.actualDuration - childrenDuration);

  const node: FlamegraphNode = {
    name: fiber.displayName || 'Unknown',
    value: fiber.actualDuration,
    children: [],
    originalData: fiber,
    depth,
    selfDuration,
    cumulativeDuration: fiber.actualDuration,
    visible: true,
  };

  // Recursively process children if within depth limit
  if (depth < maxDepth && fiber.child) {
    let child = fiber.child;
    while (child) {
      // Skip host components if not included
      if (!includeHostComponents && isHostComponent(child)) {
        child = child.sibling;
        continue;
      }

      const childNode = convertFiberToHierarchy(
        child,
        depth + 1,
        maxDepth,
        includeHostComponents
      );
      node.children.push(childNode);
      child = child.sibling;
    }
  }

  return node;
}

/**
 * Calculates color for a node based on its duration relative to parent
 * Used for heat map visualization
 * 
 * @param node - Flamegraph node
 * @param parent - Parent node (for relative calculation)
 * @returns CSS color string
 */
export function calculateNodeColor(
  node: FlamegraphNode,
  parent: FlamegraphNode | null
): string {
  // If no parent, use absolute duration scale
  if (!parent) {
    return getDurationColor(node.selfDuration);
  }

  // Calculate relative duration
  const relativeDuration = node.cumulativeDuration / parent.cumulativeDuration;

  // Color based on relative significance
  if (relativeDuration > 0.5) {
    return DURATION_COLORS.verySlow;
  } else if (relativeDuration > 0.3) {
    return DURATION_COLORS.slow;
  } else if (relativeDuration > 0.1) {
    return DURATION_COLORS.normal;
  }
  return DURATION_COLORS.fast;
}

/**
 * Filters out components below a duration threshold
 * Removes nodes that are too small to be significant
 * 
 * @param root - Root flamegraph node
 * @param threshold - Minimum duration threshold (ms)
 * @returns Filtered root node
 */
export function filterSmallNodes(
  root: FlamegraphNode,
  threshold: number
): FlamegraphNode {
  // If node is below threshold, mark as invisible
  if (root.selfDuration < threshold) {
    return {
      ...root,
      visible: false,
      children: [], // Remove children of invisible nodes
    };
  }

  // Filter children recursively
  const filteredChildren = root.children
    .map(child => filterSmallNodes(child, threshold))
    .filter(child => child.visible);

  return {
    ...root,
    children: filteredChildren,
    visible: true,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates total duration of all children
 * Used to compute self duration
 */
function calculateChildrenDuration(fiber: FiberData): number {
  let total = 0;
  let child = fiber.child;
  while (child) {
    total += child.actualDuration;
    child = child.sibling;
  }
  return total;
}

/**
 * Checks if a fiber is a host component (DOM element)
 */
function isHostComponent(fiber: FiberData): boolean {
  // Host components have tag 5 in React
  return fiber.tag === 5 || fiber.tag === 6; // HostComponent or HostText
}

/**
 * Calculates statistics for the flamegraph
 */
function calculateStats(root: FlamegraphNode): { maxDepth: number; nodeCount: number } {
  let maxDepth = 0;
  let nodeCount = 0;

  function traverse(node: FlamegraphNode, currentDepth: number) {
    nodeCount++;
    maxDepth = Math.max(maxDepth, currentDepth);
    
    for (const child of node.children) {
      traverse(child, currentDepth + 1);
    }
  }

  traverse(root, 0);
  return { maxDepth, nodeCount };
}

/**
 * Applies colors to all nodes based on the selected scheme
 */
function applyColors(root: FlamegraphNode, scheme: FlamegraphConfig['colorScheme']): void {
  function traverse(node: FlamegraphNode, parent: FlamegraphNode | null) {
    switch (scheme) {
      case 'duration':
        node.color = getDurationColor(node.selfDuration);
        break;
      case 'self-time':
        node.color = getSelfTimeColor(node.selfDuration, parent?.selfDuration ?? node.selfDuration);
        break;
      case 'type':
        node.color = getTypeColor(node.originalData);
        break;
      default:
        node.color = DURATION_COLORS.normal;
    }

    for (const child of node.children) {
      traverse(child, node);
    }
  }

  traverse(root, null);
}

/**
 * Gets color based on absolute duration
 */
function getDurationColor(duration: number): string {
  if (duration < 1) return DURATION_COLORS.fast;
  if (duration < 5) return DURATION_COLORS.normal;
  if (duration < 16) return DURATION_COLORS.slow;
  return DURATION_COLORS.verySlow;
}

/**
 * Gets color based on self time relative to parent
 */
function getSelfTimeColor(selfDuration: number, parentDuration: number): string {
  if (parentDuration === 0) return DURATION_COLORS.fast;
  
  const ratio = selfDuration / parentDuration;
  if (ratio < 0.2) return DURATION_COLORS.fast;
  if (ratio < 0.5) return DURATION_COLORS.normal;
  if (ratio < 0.8) return DURATION_COLORS.slow;
  return DURATION_COLORS.verySlow;
}

/**
 * Gets color based on component type
 */
function getTypeColor(fiber: FiberData): string {
  const tag = fiber.tag;
  
  switch (tag) {
    case 0: // FunctionComponent
      return TYPE_COLORS.function;
    case 1: // ClassComponent
      return TYPE_COLORS.class;
    case 12: // SimpleMemoComponent
    case 14: // MemoComponent
      return TYPE_COLORS.memo;
    case 11: // ForwardRef
      return TYPE_COLORS.forwardRef;
    case 5: // HostComponent
    case 6: // HostText
      return TYPE_COLORS.host;
    case 9: // ContextConsumer
    case 10: // ContextProvider
      return TYPE_COLORS.context;
    default:
      return TYPE_COLORS.other;
  }
}

/**
 * Finds a node by name in the flamegraph
 * Useful for highlighting specific components
 * 
 * @param root - Root flamegraph node
 * @param name - Component name to find
 * @returns Array of matching nodes
 */
export function findNodesByName(
  root: FlamegraphNode,
  name: string
): FlamegraphNode[] {
  const results: FlamegraphNode[] = [];

  function traverse(node: FlamegraphNode) {
    if (node.name === name) {
      results.push(node);
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(root);
  return results;
}

/**
 * Aggregates nodes by component name
 * Useful for identifying frequently rendering components
 * 
 * @param root - Root flamegraph node
 * @returns Map of component names to aggregated data
 */
export function aggregateByComponent(
  root: FlamegraphNode
): Map<string, { count: number; totalDuration: number; avgDuration: number }> {
  const aggregation = new Map<string, { count: number; totalDuration: number }>();

  function traverse(node: FlamegraphNode) {
    const existing = aggregation.get(node.name);
    if (existing) {
      existing.count++;
      existing.totalDuration += node.selfDuration;
    } else {
      aggregation.set(node.name, {
        count: 1,
        totalDuration: node.selfDuration,
      });
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(root);

  // Calculate averages
  const result = new Map<string, { count: number; totalDuration: number; avgDuration: number }>();
  aggregation.forEach((data, name) => {
    result.set(name, {
      ...data,
      avgDuration: data.count > 0 ? data.totalDuration / data.count : 0,
    });
  });

  return result;
}
