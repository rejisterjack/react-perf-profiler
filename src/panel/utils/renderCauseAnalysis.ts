/**
 * Render Cause Analysis - Determine WHY a component re-rendered
 * @module panel/utils/renderCauseAnalysis
 */

import type { CommitData, FiberNode } from '@/shared/types';

/**
 * Possible reasons for a component re-render
 */
export type RenderCause =
  | 'initial' // First render (mount)
  | 'parent-render' // Parent re-rendered
  | 'state-change' // useState/useReducer update
  | 'context-change' // Context value changed
  | 'hook-change' // Other hook triggered update
  | 'force-update'; // forceUpdate() called

/**
 * Render cause with metadata
 */
export interface RenderCauseInfo {
  /** The primary cause */
  cause: RenderCause;
  /** Human-readable description */
  description: string;
  /** Whether this was a wasted render (no actual DOM change) */
  isWasted: boolean;
  /** Specific details (e.g., which state key changed) */
  details?: string;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Analyze why a component rendered in a specific commit
 */
export function analyzeRenderCause(
  componentName: string,
  commit: CommitData,
  prevCommit?: CommitData
): RenderCauseInfo {
  const node = findNodeInCommit(componentName, commit);
  
  if (!node) {
    return {
      cause: 'parent-render',
      description: 'Component did not render in this commit',
      isWasted: false,
      confidence: 1,
    };
  }

  // First render (mount)
  if (!prevCommit) {
    return {
      cause: 'initial',
      description: 'Initial mount',
      isWasted: false,
      confidence: 1,
    };
  }

  const prevNode = findNodeInCommit(componentName, prevCommit);
  
  // Component didn't exist in previous commit - mount
  if (!prevNode) {
    return {
      cause: 'initial',
      description: 'Component mounted',
      isWasted: false,
      confidence: 1,
    };
  }

  // Analyze flags to determine cause
  const flags = getFlags(node);
  
  // Check if it's a forced update (approximation via flags)
  if (flags.hasForceUpdate) {
    return {
      cause: 'force-update',
      description: 'forceUpdate() or setState callback was called',
      isWasted: isWastedRender(node, prevNode),
      confidence: 0.9,
    };
  }

  // Check for context change
  if (node.hasContextChanged || flags.hasContextChange) {
    return {
      cause: 'context-change',
      description: 'Context value changed',
      isWasted: isWastedRender(node, prevNode),
      confidence: 0.85,
    };
  }

  // Check for state change (most common)
  const stateChanged = hasStateChanged(node, prevNode);
  if (stateChanged) {
    const stateKeys = getChangedStateKeys(node, prevNode);
    return {
      cause: 'state-change',
      description: stateKeys 
        ? `State changed: ${stateKeys.join(', ')}`
        : 'useState/useReducer update',
      isWasted: isWastedRender(node, prevNode),
      details: stateKeys?.join(', '),
      confidence: 0.9,
    };
  }

  // Check for hook changes
  if (flags.hasHookEffect) {
    return {
      cause: 'hook-change',
      description: 'Hook dependency changed',
      isWasted: isWastedRender(node, prevNode),
      confidence: 0.7,
    };
  }

  // Default: parent rendered
  return {
    cause: 'parent-render',
    description: 'Parent component re-rendered',
    isWasted: isWastedRender(node, prevNode),
    confidence: 0.8,
  };
}

/**
 * Find a component in a commit by name
 */
function findNodeInCommit(componentName: string, commit: CommitData): FiberNode | undefined {
  return commit.nodes?.find(n => n.displayName === componentName);
}

/**
 * Extract flags from a fiber node
 */
function getFlags(node: FiberNode): {
  hasForceUpdate: boolean;
  hasContextChange: boolean;
  hasHookEffect: boolean;
} {
  // Flags are typically stored in a bitmask
  // These are approximations based on React internals
  // React fiber flags: https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactFiberFlags.js
  const flags = (node as unknown as { flags?: number }).flags ?? 0;
  
  // Flag constants (simplified subset)
  const Callback = 64;      // Force update callback
  const PerformedWork = 1;  // Work was performed
  const Passive = 512;      // Passive effect (useEffect)
  
  return {
    hasForceUpdate: !!(flags & Callback),
    hasContextChange: !!(flags & PerformedWork),
    hasHookEffect: !!(flags & Passive),
  };
}

/**
 * Check if state changed between renders
 */
function hasStateChanged(node: FiberNode, prevNode: FiberNode): boolean {
  if (!node.state && !prevNode.state) return false;
  if (!node.state || !prevNode.state) return true;
  
  return JSON.stringify(node.state) !== JSON.stringify(prevNode.state);
}

/**
 * Get keys that changed in state
 */
function getChangedStateKeys(node: FiberNode, prevNode: FiberNode): string[] | undefined {
  if (!node.state || !prevNode.state) return undefined;
  
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(node.state), ...Object.keys(prevNode.state)]);
  
  for (const key of allKeys) {
    if (JSON.stringify(node.state[key]) !== JSON.stringify(prevNode.state[key])) {
      changed.push(key);
    }
  }
  
  return changed.length > 0 ? changed : undefined;
}

/**
 * Determine if a render was "wasted" (no actual change)
 */
function isWastedRender(node: FiberNode, prevNode: FiberNode): boolean {
  // Props didn't change
  const propsEqual = JSON.stringify(node.props) === JSON.stringify(prevNode.props);
  
  // State didn't change
  const stateEqual = JSON.stringify(node.state) === JSON.stringify(prevNode.state);
  
  // Context didn't change
  const contextEqual = !node.hasContextChanged && !prevNode.hasContextChanged;
  
  // If nothing changed but it still rendered, it's wasted
  return propsEqual && stateEqual && contextEqual;
}

/**
 * Aggregate render causes across multiple commits
 */
export function aggregateRenderCauses(
  componentName: string,
  commits: CommitData[]
): Map<RenderCause, number> {
  const causes = new Map<RenderCause, number>();
  
  for (let i = 0; i < commits.length; i++) {
    const prevCommit: CommitData | undefined = i > 0 ? commits[i - 1] : undefined;
    const cause = analyzeRenderCause(componentName, commits[i]!, prevCommit);
    const count = causes.get(cause.cause) ?? 0;
    causes.set(cause.cause, count + 1);
  }
  
  return causes;
}

/**
 * Get the dominant render cause for a component
 */
export function getDominantRenderCause(
  componentName: string,
  commits: CommitData[]
): { cause: RenderCause; percentage: number } {
  const aggregated = aggregateRenderCauses(componentName, commits);
  const total = commits.length;
  
  let maxCause: RenderCause = 'parent-render';
  let maxCount = 0;
  
  for (const [cause, count] of aggregated) {
    if (count > maxCount) {
      maxCount = count;
      maxCause = cause;
    }
  }
  
  return {
    cause: maxCause,
    percentage: total > 0 ? (maxCount / total) * 100 : 0,
  };
}

export default analyzeRenderCause;
