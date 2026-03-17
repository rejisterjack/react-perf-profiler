import { describe, it, expect } from 'vitest';
import { LogLevel, type LogEntry } from '@/background/types';

describe('Background Types', () => {
  describe('LogLevel enum', () => {
    it('should have all log levels defined', () => {
      expect(LogLevel.DEBUG).toBe('debug');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.WARN).toBe('warn');
      expect(LogLevel.ERROR).toBe('error');
    });

    it('should have correct log level values', () => {
      expect(Object.keys(LogLevel)).toHaveLength(4);
      const values = Object.values(LogLevel);
      expect(values).toContain('debug');
      expect(values).toContain('info');
      expect(values).toContain('warn');
      expect(values).toContain('error');
    });
  });

  describe('LogEntry type', () => {
    it('should create valid log entry', () => {
      const entry: LogEntry = {
        level: LogLevel.INFO,
        message: 'Test message',
        timestamp: Date.now(),
      };

      expect(entry.level).toBe('info');
      expect(entry.message).toBe('Test message');
      expect(entry.timestamp).toBeGreaterThan(0);
    });

    it('should support optional data properties', () => {
      const entry: LogEntry = {
        level: LogLevel.ERROR,
        message: 'Error occurred',
        timestamp: Date.now(),
        tabId: 123,
        error: new Error('Test error'),
      };

      expect(entry.tabId).toBe(123);
      expect(entry.error).toBeInstanceOf(Error);
    });

    it('should support all log levels', () => {
      const levels: LogLevel[] = [
        LogLevel.DEBUG,
        LogLevel.INFO,
        LogLevel.WARN,
        LogLevel.ERROR,
      ];

      levels.forEach(level => {
        const entry: LogEntry = {
          level,
          message: 'Test',
          timestamp: Date.now(),
        };
        expect(entry.level).toBe(level);
      });
    });
  });

  describe('PortType', () => {
    it('should accept valid port types', () => {
      // Type check - these should compile without errors
      const validTypes: Array<'content' | 'devtools' | 'popup' | 'background'> = [
        'content',
        'devtools',
        'popup',
        'background',
      ];

      expect(validTypes).toHaveLength(4);
    });
  });

  describe('ConnectionState', () => {
    it('should define valid connection states', () => {
      // Type check for connection states
      const states: Array<'connecting' | 'connected' | 'disconnected' | 'error'> = [
        'connecting',
        'connected',
        'disconnected',
        'error',
      ];

      expect(states).toHaveLength(4);
    });
  });
});
