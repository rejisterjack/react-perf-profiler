/**
 * Export React profiling commits as Chrome DevTools CPU Profile (.cpuprofile).
 * Allows loading into Chrome DevTools Performance panel for cross-tool correlation.
 */

import type { CommitData } from '@/src/shared/types';

interface CPUProfileNode {
  id: number;
  callFrame: {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  children?: number[];
  hitCount?: number;
}

interface CPUProfile {
  nodes: CPUProfileNode[];
  samples: number[];
  timeDeltas: number[];
  startTime: number;
  endTime: number;
}

let nodeIdCounter = 1;

export function convertToCPUProfile(commits: CommitData[]): CPUProfile {
  nodeIdCounter = 1;
  const nodes: CPUProfileNode[] = [];
  const samples: number[] = [];
  const timeDeltas: number[] = [];
  const componentToNodeId = new Map<string, number>();

  // Root node
  const rootNode: CPUProfileNode = {
    id: nodeIdCounter++,
    callFrame: { functionName: '(root)', scriptId: '0', url: '', lineNumber: 0, columnNumber: 0 },
    children: [],
  };
  nodes.push(rootNode);

  // First pass: create unique nodes per component
  const allComponents = new Set<string>();
  for (const commit of commits) {
    const fibers = commit.fibers ?? [];
    for (const fiber of fibers) {
      if (fiber.displayName) {
        allComponents.add(fiber.displayName);
      }
    }
  }

  for (const componentName of allComponents) {
    const nodeId = nodeIdCounter++;
    componentToNodeId.set(componentName, nodeId);

    // Find source location from first occurrence
    let url = '';
    let line = 0;
    let col = 0;
    for (const commit of commits) {
      const fibers = commit.fibers ?? [];
      for (const fiber of fibers) {
        if (fiber.displayName === componentName && fiber.sourceLocation) {
          url = fiber.sourceLocation.fileName ?? '';
          line = fiber.sourceLocation.lineNumber ?? 0;
          col = fiber.sourceLocation.columnNumber ?? 0;
          break;
        }
      }
      if (url) break;
    }

    const node: CPUProfileNode = {
      id: nodeId,
      callFrame: {
        functionName: componentName,
        scriptId: String(nodeId),
        url,
        lineNumber: line,
        columnNumber: col,
      },
    };
    nodes.push(node);
    rootNode.children!.push(nodeId);
  }

  // Second pass: create samples from commits
  const startTime = commits.length > 0 ? commits[0].timestamp : Date.now();

  for (const commit of commits) {
    const fibers = commit.fibers ?? [];

    // For each fiber in this commit, add a sample
    for (const fiber of fibers) {
      if (!fiber.displayName) continue;
      const nodeId = componentToNodeId.get(fiber.displayName);
      if (nodeId != null) {
        samples.push(nodeId);
        // Distribute duration across fibers proportionally
        const fiberDuration = Math.max(1, Math.round((fiber.actualDuration ?? 1) * 1000)); // microseconds
        timeDeltas.push(fiberDuration);
      }
    }
  }

  const endTime = commits.length > 0 ? commits[commits.length - 1].timestamp : startTime;

  return {
    nodes,
    samples,
    timeDeltas,
    startTime,
    endTime,
  };
}

export function exportAsCPUProfile(commits: CommitData[], filename?: string): void {
  const profile = convertToCPUProfile(commits);
  const json = JSON.stringify(profile, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `react-perf-${Date.now()}.cpuprofile`;
  a.click();
  URL.revokeObjectURL(url);
}
