import type { APMConfig, APMResult } from './types';
import type { AnalysisResult } from '@/src/shared/types';

export async function sendToWebhook(
  analysis: AnalysisResult,
  config: APMConfig,
): Promise<APMResult> {
  try {
    const payload = {
      timestamp: analysis.timestamp,
      score: analysis.performanceScore,
      totalCommits: analysis.totalCommits,
      wastedRenders: analysis.wastedRenderReports.length,
      topOpportunities: analysis.topOpportunities.slice(0, 10),
      metadata: {
        environment: config.environment,
        release: config.release,
      },
    };

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });

    return {
      success: response.ok,
      provider: 'webhook',
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      success: false,
      provider: 'webhook',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
