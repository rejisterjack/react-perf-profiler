/**
 * Sentry Error Reporting Integration
 * Initializes Sentry for the DevTools panel with Chrome extension context
 */

import * as Sentry from '@sentry/browser';

const SENTRY_DSN = import.meta.env?.VITE_SENTRY_DSN;
const EXTENSION_VERSION = '1.0.0';

let initialized = false;

/**
 * Initialize Sentry error reporting.
 * Safe to call multiple times — no-ops if already initialized or DSN is missing.
 */
export function initSentry(): void {
  if (initialized) return;

  if (!SENTRY_DSN) {
    // No DSN configured — skip Sentry init (development or self-hosted)
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    release: EXTENSION_VERSION,
    environment: import.meta.env?.MODE || 'production',

    // Chrome extension context
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.extraErrorDataIntegration(),
    ],

    // Performance monitoring — keep overhead low for DevTools panel
    tracesSampleRate: 0.1, // 10% of transactions

    // Error sampling
    sampleRate: 1.0, // Capture all errors

    // Filter out noisy / non-actionable errors
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection',
      'Extension context invalidated',
      'Could not establish connection',
      'Receiving end does not exist',
      'The message port closed before a response was received',
    ],

    // Don't send PII
    sendDefaultPii: false,

    // Tag all events with extension context
    initialScope: {
      tags: {
        component: 'devtools-panel',
        extension: 'react-perf-profiler',
      },
    },
  });

  initialized = true;
}

/**
 * Report a caught error to Sentry with additional context.
 */
export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (!initialized) return;

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setTag(key, typeof value === 'string' ? value : String(value));
      }
      scope.setContext('errorContext', context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Add a breadcrumb for debugging error context.
 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (!initialized) return;

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

/**
 * Set user context for error tracking (anonymized).
 */
export function setSentryUser(id: string): void {
  if (!initialized) return;

  Sentry.setUser({ id }); // No email or PII
}
