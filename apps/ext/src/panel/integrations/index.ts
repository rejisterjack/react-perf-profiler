import type { APMConfig, APMResult } from './types';
import type { AnalysisResult } from '@/src/shared/types';
import { sendToWebhook } from './webhookSender';
import { sendToSentry } from './sentryReporter';
import { sendToDatadog } from './datadogReporter';

export type { APMConfig, APMProviderType, APMResult } from './types';

export async function sendToAPM(
  analysis: AnalysisResult,
  config: APMConfig,
): Promise<APMResult> {
  if (!config.enabled || !config.endpoint) {
    return { success: false, provider: config.provider, error: 'APM not configured' };
  }

  switch (config.provider) {
    case 'webhook': return sendToWebhook(analysis, config);
    case 'sentry': return sendToSentry(analysis, config);
    case 'datadog': return sendToDatadog(analysis, config);
    default: return { success: false, provider: config.provider, error: 'Unknown provider' };
  }
}
