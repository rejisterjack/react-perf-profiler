import type { APMConfig, APMResult } from './types';
import type { AnalysisResult } from '@/src/shared/types';

export async function sendToDatadog(
  analysis: AnalysisResult,
  config: APMConfig,
): Promise<APMResult> {
  try {
    const site = config.endpoint.includes('datadoghq.eu') ? 'eu' : 'com';
    const apiKey = config.endpoint;
    const url = `https://api.datadoghq.${site}/api/v1/series`;

    const now = Math.floor(analysis.timestamp / 1000);
    const series = [
      {
        metric: 'react.perf.score',
        points: [[now, analysis.performanceScore]],
        type: 'gauge',
        tags: [`env:${config.environment ?? 'development'}`],
      },
      {
        metric: 'react.perf.wasted_renders',
        points: [[now, analysis.wastedRenderReports.length]],
        type: 'count',
        tags: [`env:${config.environment ?? 'development'}`],
      },
      {
        metric: 'react.perf.total_commits',
        points: [[now, analysis.totalCommits]],
        type: 'count',
        tags: [`env:${config.environment ?? 'development'}`],
      },
    ];

    // Add per-component metrics
    for (const report of analysis.wastedRenderReports.slice(0, 20)) {
      series.push({
        metric: 'react.perf.component.waste_rate',
        points: [[now, report.wastedRenderRate]],
        type: 'gauge',
        tags: [`component:${report.componentName}`, `severity:${report.severity}`],
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': apiKey,
      },
      body: JSON.stringify({ series }),
    });

    return {
      success: response.ok,
      provider: 'datadog',
      status: response.status,
    };
  } catch (err) {
    return {
      success: false,
      provider: 'datadog',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
