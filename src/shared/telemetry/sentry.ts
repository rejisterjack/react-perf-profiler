/**
 * Sentry crash reporting initialization
 * Opt-in only — enabled when the user toggles it in settings.
 */

import * as Sentry from '@sentry/browser';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

let initialized = false;

export function initCrashReporting(): void {
  if (initialized || !SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: chrome.runtime?.getManifest?.()?.version ?? 'unknown',
    tracesSampleRate: 0,
    defaultIntegrations: false,
    integrations: [Sentry.globalHandlersIntegration()],
    beforeSend(event) {
      // Strip URLs and file paths that may contain user info
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url);
          event.request.url = url.origin + url.pathname;
        } catch { /* keep as-is */ }
      }
      return event;
    },
  });

  initialized = true;
}

export function setCrashReportingEnabled(enabled: boolean): void {
  if (enabled && !initialized) {
    initCrashReporting();
  }
  const client = Sentry.getClient();
  if (client) {
    client.getOptions().enabled = enabled;
  }
}

export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) {
      for (const [k, v] of Object.entries(context)) {
        scope.setTag(k, String(v));
      }
    }
    Sentry.captureException(error);
  });
}
