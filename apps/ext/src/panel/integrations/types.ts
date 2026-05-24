export type APMProviderType = 'webhook' | 'sentry' | 'datadog';

export interface APMConfig {
  enabled: boolean;
  provider: APMProviderType;
  /** Webhook: URL. Sentry: DSN. Datadog: API key. */
  endpoint: string;
  /** Additional headers for webhook */
  headers?: Record<string, string>;
  /** Sentry/Datadog specific */
  environment?: string;
  release?: string;
  /** Behavior config */
  sendOnAnalysis: boolean;
  sendOnBudgetViolation: boolean;
  minSeverity: 'low' | 'medium' | 'high' | 'critical';
}

export interface APMResult {
  success: boolean;
  provider: APMProviderType;
  status?: number;
  error?: string;
}
