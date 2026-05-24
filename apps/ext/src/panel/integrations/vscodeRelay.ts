/**
 * VS Code Extension relay — broadcasts analysis results to a local WebSocket server
 * that the VS Code extension can connect to.
 *
 * Since Chrome extensions can't run WebSocket servers from service workers,
 * this uses a lightweight HTTP server approach via the offscreen API or
 * a companion Node.js relay script.
 *
 * For the initial implementation, we use chrome.storage events as the
 * transport layer and the VS Code extension polls via a native messaging host.
 */

import type { AnalysisResult } from '@/src/shared/types';

const VSCODE_RELAY_KEY = 'react-perf-vscode-relay';

export function broadcastToVSCode(analysis: AnalysisResult): void {
  try {
    const payload = {
      timestamp: analysis.timestamp,
      performanceScore: analysis.performanceScore,
      totalCommits: analysis.totalCommits,
      components: extractComponentData(analysis),
      budgetViolations: [] as Array<{ componentName: string; metric: string; actualValue: number; threshold: number }>,
    };

    chrome.storage.local.set({ [VSCODE_RELAY_KEY]: payload });
  } catch { /* ignore */ }
}

function extractComponentData(analysis: AnalysisResult): Record<string, {
  name: string;
  renderCount: number;
  wastedRenderRate: number;
  avgRenderTime: number;
  maxRenderTime: number;
  isMemoized: boolean;
  issues: string[];
}> {
  const components: Record<string, {
    name: string;
    renderCount: number;
    wastedRenderRate: number;
    avgRenderTime: number;
    maxRenderTime: number;
    isMemoized: boolean;
    issues: string[];
  }> = {};

  for (const report of analysis.wastedRenderReports) {
    components[report.componentName] = {
      name: report.componentName,
      renderCount: report.totalRenders,
      wastedRenderRate: report.wastedRenderRate,
      avgRenderTime: report.estimatedSavingsMs,
      maxRenderTime: 0,
      isMemoized: report.recommendedAction === 'memo',
      issues: report.issues.map((i) => i.description),
    };
  }

  for (const memo of analysis.memoReports) {
    const existing = components[memo.componentName];
    if (existing) {
      existing.isMemoized = memo.hasMemo;
    } else {
      components[memo.componentName] = {
        name: memo.componentName,
        renderCount: 0,
        wastedRenderRate: 0,
        avgRenderTime: 0,
        maxRenderTime: 0,
        isMemoized: memo.hasMemo,
        issues: memo.recommendations.map((r) => r.description),
      };
    }
  }

  return components;
}
