/**
 * Structured logger for the web app.
 *
 * Goals:
 *  - Emit JSON-parseable lines with consistent fields (level, time, msg,
 *    requestId, userId) so they can be ingested by any log aggregator.
 *  - Attach a per-request correlation id so a single user-reported
 *    `requestId` can be grep'd across logs, traces, and Sentry.
 *  - Be a single drop-in replacement for the bare `console.error` calls that
 *    were sprinkled across every route handler.
 *
 * Future: when @sentry/nextjs is wired up, `captureException` should be called
 * from `logger.error` so server-side errors flow to Sentry with the same
 * `requestId` attached as a tag.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function emit(level: LogLevel, msg: string, context: LogContext = {}) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) {
    return;
  }

  const line = {
    level,
    time: new Date().toISOString(),
    msg,
    ...context,
  };

  // Use the native stderr/stdout for serverless log collection.
  if (level === 'error' || level === 'warn') {
    process.stderr.write(`${JSON.stringify(line)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(line)}\n`);
  }
}

export const logger = {
  debug: (msg: string, context?: LogContext) => emit('debug', msg, context),
  info: (msg: string, context?: LogContext) => emit('info', msg, context),
  warn: (msg: string, context?: LogContext) => emit('warn', msg, context),
  error: (msg: string, context?: LogContext) => emit('error', msg, context),
};

/**
 * Generate a short, URL-safe request id. Suitable for surfacing in the
 * `X-Request-Id` response header and the error envelope so a user reporting
 * an error can hand it to support.
 */
export function generateRequestId(): string {
  // 16 bytes of entropy, base36-encoded — short and opaque.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}
