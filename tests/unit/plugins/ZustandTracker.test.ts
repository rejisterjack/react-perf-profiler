/**
 * Zustand Tracker Tests
 * @module tests/unit/plugins/ZustandTracker
 */

import { describe, it, expect, vi } from 'vitest';
import { ZustandTracker } from '@/panel/plugins/built-in/state-managers/ZustandTracker';

describe('ZustandTracker', () => {
  describe('metadata', () => {
    it('should have correct plugin metadata', () => {
      expect(ZustandTracker.metadata.id).toBe('react-perf-profiler.built-in.zustand-tracker');
      expect(ZustandTracker.metadata.name).toBe('Zustand Store Tracker');
      expect(ZustandTracker.metadata.version).toBe('1.0.0');
    });

    it('should be disabled by default', () => {
      expect(ZustandTracker.metadata.enabledByDefault).toBe(false);
    });
  });

  describe('hooks', () => {
    it('should have onRecordingStart hook', () => {
      expect(ZustandTracker.hooks.onRecordingStart).toBeTypeOf('function');
    });

    it('should have onCommit hook', () => {
      expect(ZustandTracker.hooks.onCommit).toBeTypeOf('function');
    });
  });

  describe('onRecordingStart', () => {
    it('should initialize store data', () => {
      const mockAPI = {
        setPluginData: vi.fn(),
      };
      const mockContext = {
        pluginId: 'test-plugin',
        pluginName: 'Test Plugin',
        log: vi.fn(),
      };

      ZustandTracker.hooks.onRecordingStart!(mockAPI as any, mockContext);

      expect(mockAPI.setPluginData).toHaveBeenCalledWith('stores', expect.any(Map));
      expect(mockAPI.setPluginData).toHaveBeenCalledWith('renderTriggers', []);
    });
  });

  describe('onCommit', () => {
    it('should process commits with nodes', () => {
      const mockAPI = {
        getPluginData: vi.fn(() => new Map()),
        recordMetric: vi.fn(),
      };
      const mockContext = {
        pluginId: 'test-plugin',
        pluginName: 'Test Plugin',
      };

      const mockCommit = {
        id: 'commit-1',
        timestamp: Date.now(),
        nodes: [{ id: 1, name: 'TestComponent' }],
        duration: 16,
      };

      // Should not throw
      expect(() => 
        ZustandTracker.hooks.onCommit!(mockCommit as any, mockAPI as any, mockContext)
      ).not.toThrow();
    });
  });
});
