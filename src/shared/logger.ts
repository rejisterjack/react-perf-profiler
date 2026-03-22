/**
 * Structured Logger Utility
 * Provides consistent, level-based logging across the extension
 */

// =============================================================================
// Types
// =============================================================================

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
  /** Minimum log level to output */
  minLevel?: LogLevel;
  /** Prefix for all log messages */
  prefix?: string;
  /** Whether to include timestamps */
  timestamps?: boolean;
  /** Custom handler for log entries */
  onLog?: (entry: LogEntry) => void;
}

// =============================================================================
// Log Level Priority
// =============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// =============================================================================
// Environment Detection
// =============================================================================

/**
 * Check if running in development mode
 */
const isDevelopment = (): boolean => {
  return import.meta.env?.DEV === true || import.meta.env?.MODE === 'development';
};



// =============================================================================
// Logger Class
// =============================================================================

class Logger {
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

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    void level; // Parameter used via LOG_LEVEL_PRIORITY lookup
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  /**
   * Format log message with prefix and timestamp
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const parts: string[] = [];
    
    if (this.timestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    
    parts.push(this.prefix);
    parts.push(`[${level.toUpperCase()}]`);
    
    if (context?.['source']) {
      parts.push(`[${context['source']}]`);
    }
    
    parts.push(message);
    
    return parts.join(' ');
  }

  /**
   * Create a log entry
   */
  private createEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    return {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      source: (context?.['source'] as string) || 'unknown',
    };
  }

  /**
   * Output log to console
   */
  private output(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, context);
    const formattedMessage = this.formatMessage(level, message, context);

    // Call custom handler if provided
    this.onLog?.(entry);

    // Output to console with appropriate method
    const consoleMethod = console[level] || console.log;
    
    if (context && Object.keys(context).length > 0) {
      // Exclude internal fields from context output
      const { source, ...userContext } = context;
      if (Object.keys(userContext).length > 0) {
        consoleMethod(formattedMessage, userContext);
      } else {
        consoleMethod(formattedMessage);
      }
    } else {
      consoleMethod(formattedMessage);
    }
  }

  // =============================================================================
  // Public API
  // =============================================================================

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.output('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.output('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.output('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext): void {
    this.output('error', message, context);
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger({
      minLevel: this.minLevel,
      prefix: this.prefix,
      timestamps: this.timestamps,
    });

    // Override the output method to include additional context
    const originalOutput = this.output.bind(this);
    childLogger['output'] = (level: LogLevel, message: string, context?: LogContext) => {
      originalOutput(level, message, { ...additionalContext, ...context });
    };

    return childLogger;
  }
}

// =============================================================================
// Default Logger Instance
// =============================================================================

/**
 * Default logger instance for general use
 */
export const logger = new Logger();

// =============================================================================
// Context-specific Loggers
// =============================================================================

/**
 * Create a logger for a specific component/context
 */
export const createLogger = (source: string, options?: LoggerOptions): Logger => {
  return new Logger({
    prefix: `[React Perf Profiler] [${source}]`,
    ...options,
  });
};

/**
 * Logger for background script
 */
export const backgroundLogger = createLogger('Background');

/**
 * Logger for content script
 */
export const contentLogger = createLogger('Content');

/**
 * Logger for DevTools panel
 */
export const panelLogger = createLogger('Panel');

/**
 * Logger for plugin system
 */
export const pluginLogger = createLogger('Plugin');

/**
 * Logger for worker threads
 */
export const workerLogger = createLogger('Worker');

// =============================================================================
// Convenience Exports
// =============================================================================

export const logDebug = (message: string, context?: LogContext): void => {
  logger.debug(message, context);
};

export const logInfo = (message: string, context?: LogContext): void => {
  logger.info(message, context);
};

export const logWarn = (message: string, context?: LogContext): void => {
  logger.warn(message, context);
};

export const logError = (message: string, context?: LogContext): void => {
  logger.error(message, context);
};

export default logger;
