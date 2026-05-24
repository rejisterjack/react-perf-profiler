import type { APMConfig, APMResult } from './types';
import type { AnalysisResult } from '@/src/shared/types';

export async function sendToSentry(
  analysis: AnalysisResult,
  config: APMConfig,
): Promise<APMResult> {
  try {
    // Parse DSN: https://key@host/project_id
    const dsn = config.endpoint;
    const dsnUrl = new URL(dsn);
    const key = dsnUrl.username;
    const host = dsnUrl.host;
    const projectId = dsnUrl.pathname.replace(/^\//, '');
    const envelopeUrl = `https://${host}/api/${projectId}/envelope/`;

    const event = {
      event_id: crypto.randomUUID?.() ?? Date.now().toString(36),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      environment: config.environment ?? 'development',
      release: config.release,
      tags: {
        'perf-score': String(analysis.performanceScore),
        'total-commits': String(analysis.totalCommits),
      },
      breadcrumbs: analysis.topOpportunities.slice(0, 5).map((opp) => ({
        timestamp: analysis.timestamp / 1000,
        category: 'performance',
        message: `${opp.componentName}: ${opp.description}`,
        level: opp.impact === 'high' ? 'error' : opp.impact === 'medium' ? 'warning' : 'info',
      })),
      extra: {
        performanceScore: analysis.performanceScore,
        wastedRenderCount: analysis.wastedRenderReports.length,
        topIssues: analysis.topOpportunities.slice(0, 10),
      },
    };

    const envelopeHeader = JSON.stringify({
      event_id: event.event_id,
      sent_at: new Date().toISOString(),
    });
    const itemHeader = JSON.stringify({ type: 'event', content_type: 'application/json' });
    const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`;

    const response = await fetch(envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry key=${key}, version=7`,
      },
      body,
    });

    return {
      success: response.ok,
      provider: 'sentry',
      status: response.status,
    };
  } catch (err) {
    return {
      success: false,
      provider: 'sentry',
      error: err instanceof Error ? err.message : 'Invalid DSN',
    };
  }
}
