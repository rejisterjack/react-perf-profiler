/**
 * Unit tests for the structured logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, createLogger, logDebug, logInfo, logWarn, logError } from '@/shared/logger';
import type { LogEntry } from '@/shared/logger';

// =============================================================================
// Helpers
// =============================================================================

function makeLogger(options: Parameters<typeof createLogger>[1] = {}) {
  return createLogger('Test', { minLevel: 'debug', ...options });
}

// =============================================================================
// Tests
// =============================================================================

describe('Logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Log level filtering
  // ---------------------------------------------------------------------------

  describe('log level filtering', () => {
    it('outputs debug when minLevel is debug', () => {
      const l = makeLogger({ minLevel: 'debug' });
      l.debug('hello');
      expect(console.debug).toHaveBeenCalledOnce();
    });

    it('suppresses debug when minLevel is info', () => {
      const l = makeLogger({ minLevel: 'info' });
      l.debug('silent');
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('suppresses info and debug when minLevel is warn', () => {
      const l = makeLogger({ minLevel: 'warn' });
      l.debug('silent');
      l.info('also silent');
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
    });

    it('only outputs error when minLevel is error', () => {
      const l = makeLogger({ minLevel: 'error' });
      l.debug('no');
      l.info('no');
      l.warn('no');
      l.error('yes');
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledOnce();
    });

    it('outputs all levels when minLevel is debug', () => {
      const l = makeLogger({ minLevel: 'debug' });
      l.debug('d');
      l.info('i');
      l.warn('w');
      l.error('e');
      expect(console.debug).toHaveBeenCalledOnce();
      expect(console.info).toHaveBeenCalledOnce();
      expect(console.warn).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // setMinLevel
  // ---------------------------------------------------------------------------

  describe('setMinLevel', () => {
    it('dynamically updates the minimum log level', () => {
      const l = makeLogger({ minLevel: 'error' });
      l.info('should be silent');
      expect(console.info).not.toHaveBeenCalled();

      l.setMinLevel('debug');
      l.info('should be visible');
      expect(console.info).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // Custom onLog handler
  // ---------------------------------------------------------------------------

  describe('onLog handler', () => {
    it('invokes custom handler with LogEntry on every logged message', () => {
      const handler = vi.fn<[LogEntry], void>();
      const l = makeLogger({ onLog: handler });

      l.info('test message', { source: 'TestComp', extra: 'data' });

      expect(handler).toHaveBeenCalledOnce();
      const entry = handler.mock.calls[0]![0];
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('test message');
      expect(entry.context?.['source']).toBe('TestComp');
      expect(entry.context?.['extra']).toBe('data');
    });

    it('does not invoke handler for suppressed log levels', () => {
      const handler = vi.fn();
      const l = makeLogger({ minLevel: 'warn', onLog: handler });

      l.debug('suppressed');
      l.info('suppressed');

      expect(handler).not.toHaveBeenCalled();
    });

    it('includes a valid ISO timestamp in the LogEntry', () => {
      const handler = vi.fn<[LogEntry], void>();
      const l = makeLogger({ onLog: handler });
      l.warn('ts check');

      const entry = handler.mock.calls[0]![0];
      expect(() => new Date(entry.timestamp)).not.toThrow();
      expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Context formatting
  // ---------------------------------------------------------------------------

  describe('context formatting', () => {
    it('strips the source field from visible console output', () => {
      const l = makeLogger();
      l.info('msg', { source: 'Hidden', visible: 'shown' });

      // Console should be called with the formatted message and remaining context
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('msg'),
        expect.objectContaining({ visible: 'shown' })
      );
      // The context passed to console should NOT contain source
      const callArgs = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0];
      expect(callArgs?.[1]).not.toHaveProperty('source');
    });

    it('omits context argument when only source is provided', () => {
      const l = makeLogger();
      l.info('clean', { source: 'OnlySource' });

      // Should be called with just the message, no second argument
      const callArgs = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0];
      expect(callArgs).toHaveLength(1);
    });

    it('omits context argument when no context is passed', () => {
      const l = makeLogger();
      l.warn('no context');

      const callArgs = (console.warn as ReturnType<typeof vi.spyOn>).mock.calls[0];
      expect(callArgs).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Timestamp toggle
  // ---------------------------------------------------------------------------

  describe('timestamps option', () => {
    it('includes timestamp prefix in output when enabled', () => {
      const l = makeLogger({ timestamps: true });
      l.info('with ts');

      const msg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0]?.[0] as string;
      // ISO timestamp pattern: [2024-...T...]
      expect(msg).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('excludes timestamp prefix when disabled', () => {
      const l = makeLogger({ timestamps: false });
      l.info('no ts');

      const msg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0]?.[0] as string;
      expect(msg).not.toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ---------------------------------------------------------------------------
  // child() logger
  // ---------------------------------------------------------------------------

  describe('child()', () => {
    it('merges parent additional context into every child log entry', () => {
      const handler = vi.fn<[LogEntry], void>();
      const parent = makeLogger({ onLog: handler });
      const child = parent.child({ requestId: 'abc-123' });

      child.info('child message', { source: 'Child' });

      expect(handler).toHaveBeenCalledOnce();
      const entry = handler.mock.calls[0]![0];
      expect(entry.context?.['requestId']).toBe('abc-123');
      expect(entry.context?.['source']).toBe('Child');
    });

    it('child context overrides parent context for same key', () => {
      const handler = vi.fn<[LogEntry], void>();
      const parent = makeLogger({ onLog: handler });
      const child = parent.child({ env: 'parent' });

      child.info('override', { env: 'child' });

      const entry = handler.mock.calls[0]![0];
      expect(entry.context?.['env']).toBe('child');
    });

    it('child does not emit to console directly — routes through parent onLog', () => {
      const handler = vi.fn();
      const parent = makeLogger({ onLog: handler });
      const child = parent.child({ x: 1 });

      child.warn('routed');

      // parent handler gets called
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // createLogger factory
  // ---------------------------------------------------------------------------

  describe('createLogger', () => {
    it('creates a logger with a custom source prefix', () => {
      const l = createLogger('MyModule', { minLevel: 'debug' });
      l.info('factory test');

      const msg = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0]?.[0] as string;
      expect(msg).toContain('MyModule');
    });
  });

  // ---------------------------------------------------------------------------
  // Convenience exports
  // ---------------------------------------------------------------------------

  describe('convenience exports', () => {
    it('logDebug delegates to default logger at debug level', () => {
      logger.setMinLevel('debug');
      logDebug('debug msg');
      expect(console.debug).toHaveBeenCalledOnce();
    });

    it('logInfo delegates to default logger at info level', () => {
      logger.setMinLevel('debug');
      logInfo('info msg');
      expect(console.info).toHaveBeenCalledOnce();
    });

    it('logWarn delegates to default logger at warn level', () => {
      logger.setMinLevel('debug');
      logWarn('warn msg');
      expect(console.warn).toHaveBeenCalledOnce();
    });

    it('logError delegates to default logger at error level', () => {
      logger.setMinLevel('debug');
      logError('error msg');
      expect(console.error).toHaveBeenCalledOnce();
    });
  });
});
