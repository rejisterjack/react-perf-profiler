/**
 * Structured Logger Utility
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  source: string;
}

export interface LoggerOptions {
  minLevel?: LogLevel;
  prefix?: string;
  timestamps?: boolean;
  onLog?: (entry: LogEntry) => void;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDevelopment = (): boolean => import.meta.env?.DEV === true;

export class Logger {
  private minLevel: LogLevel;
  private prefix: string;
  private timestamps: boolean;
  private onLog?: (entry: LogEntry) => void;

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel || (isDevelopment() ? 'debug' : 'warn');
    this.prefix = options.prefix || '[React Perf Profiler]';
    this.timestamps = options.timestamps ?? true;
    this.onLog = options.onLog;
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const parts: string[] = [];
    if (this.timestamps) parts.push(`[${new Date().toISOString()}]`);
    parts.push(this.prefix);
    parts.push(`[${level.toUpperCase()}]`);
    if (context?.['source']) parts.push(`[${context['source']}]`);
    parts.push(message);
    return parts.join(' ');
  }

  private createEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    return { level, message, context, timestamp: new Date().toISOString(), source: (context?.['source'] as string) || 'unknown' };
  }

  private output(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;
    const entry = this.createEntry(level, message, context);
    const formattedMessage = this.formatMessage(level, message, context);
    this.onLog?.(entry);
    const consoleMethod = console[level] || console.log;
    if (context && Object.keys(context).length > 0) {
      const { source, ...userContext } = context;
      if (Object.keys(userContext).length > 0) consoleMethod(formattedMessage, userContext);
      else consoleMethod(formattedMessage);
    } else {
      consoleMethod(formattedMessage);
    }
  }

  debug(message: string, context?: LogContext): void { this.output('debug', message, context); }
  info(message: string, context?: LogContext): void { this.output('info', message, context); }
  warn(message: string, context?: LogContext): void { this.output('warn', message, context); }
  error(message: string, context?: LogContext): void { this.output('error', message, context); }

  child(additionalContext: LogContext): Logger {
    return new Logger({
      minLevel: this.minLevel,
      prefix: this.prefix,
      timestamps: this.timestamps,
      onLog: (entry) => { this.onLog?.({ ...entry, context: { ...additionalContext, ...entry.context } }); },
    });
  }
}

export const logger = new Logger();

export const createLogger = (source: string, options?: LoggerOptions): Logger =>
  new Logger({ prefix: `[React Perf Profiler] [${source}]`, ...options });

export const backgroundLogger = createLogger('Background');
export const contentLogger = createLogger('Content');
export const panelLogger = createLogger('Panel');
