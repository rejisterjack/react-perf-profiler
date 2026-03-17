import { describe, it, expect } from 'vitest';
import {
  FiberTag,
  PriorityLevel,
  isMessageType,
  isSeverity,
  isRecommendedAction,
  type FiberNode,
  type CommitData,
  type ComponentMetrics,
  type WastedRenderReport,
  type MemoEffectivenessReport,
} from '@/shared/types';

describe('Shared Types', () => {
  describe('FiberTag enum', () => {
    it('should have all fiber tags defined', () => {
      expect(FiberTag.FunctionComponent).toBe(0);
      expect(FiberTag.ClassComponent).toBe(1);
      expect(FiberTag.HostComponent).toBe(5);
      expect(FiberTag.SimpleMemoComponent).toBe(12);
      expect(FiberTag.MemoComponent).toBe(21);
    });

    it('should have memo tag for memoized components', () => {
      expect(FiberTag.SimpleMemoComponent).toBeDefined();
      expect(FiberTag.MemoComponent).toBeDefined();
    });
  });

  describe('PriorityLevel enum', () => {
    it('should have all priority levels defined', () => {
      expect(PriorityLevel.NoPriority).toBe(0);
      expect(PriorityLevel.ImmediatePriority).toBe(1);
      expect(PriorityLevel.UserBlockingPriority).toBe(2);
      expect(PriorityLevel.NormalPriority).toBe(3);
      expect(PriorityLevel.LowPriority).toBe(4);
      expect(PriorityLevel.IdlePriority).toBe(5);
    });

    it('should have correct priority ordering', () => {
      expect(PriorityLevel.ImmediatePriority).toBeLessThan(PriorityLevel.NormalPriority);
      expect(PriorityLevel.NormalPriority).toBeLessThan(PriorityLevel.IdlePriority);
    });
  });

  describe('type guards', () => {
    describe('isMessageType', () => {
      it('should return true for valid message types', () => {
        expect(isMessageType('COMMIT')).toBe(true);
        expect(isMessageType('START_PROFILING')).toBe(true);
        expect(isMessageType('STOP_PROFILING')).toBe(true);
        expect(isMessageType('CLEAR_DATA')).toBe(true);
        expect(isMessageType('GET_DATA')).toBe(true);
        expect(isMessageType('COMPONENT_SELECTED')).toBe(true);
        expect(isMessageType('ANALYSIS_COMPLETE')).toBe(true);
        expect(isMessageType('INIT')).toBe(true);
        expect(isMessageType('PING')).toBe(true);
        expect(isMessageType('PONG')).toBe(true);
        expect(isMessageType('ERROR')).toBe(true);
      });

      it('should return false for invalid message types', () => {
        expect(isMessageType('INVALID')).toBe(false);
        expect(isMessageType('')).toBe(false);
        expect(isMessageType(123)).toBe(false);
        expect(isMessageType(null)).toBe(false);
        expect(isMessageType(undefined)).toBe(false);
        expect(isMessageType({})).toBe(false);
      });
    });

    describe('isSeverity', () => {
      it('should return true for valid severities', () => {
        expect(isSeverity('critical')).toBe(true);
        expect(isSeverity('warning')).toBe(true);
        expect(isSeverity('info')).toBe(true);
      });

      it('should return false for invalid severities', () => {
        expect(isSeverity('error')).toBe(false);
        expect(isSeverity('success')).toBe(false);
        expect(isSeverity('')).toBe(false);
        expect(isSeverity(1)).toBe(false);
      });
    });

    describe('isRecommendedAction', () => {
      it('should return true for valid actions', () => {
        expect(isRecommendedAction('memo')).toBe(true);
        expect(isRecommendedAction('useMemo')).toBe(true);
        expect(isRecommendedAction('useCallback')).toBe(true);
        expect(isRecommendedAction('none')).toBe(true);
        expect(isRecommendedAction('colocate')).toBe(true);
      });

      it('should return false for invalid actions', () => {
        expect(isRecommendedAction('optimize')).toBe(false);
        expect(isRecommendedAction('')).toBe(false);
        expect(isRecommendedAction(true)).toBe(false);
      });
    });
  });

  describe('FiberNode type', () => {
    it('should create valid fiber node', () => {
      const fiber: FiberNode = {
        id: 'fiber-1',
        displayName: 'TestComponent',
        key: null,
        child: null,
        sibling: null,
        parent: null,
        type: 'div',
        elementType: 'div',
        memoizedProps: { text: 'hello' },
        memoizedState: null,
        actualDuration: 1,
        actualStartTime: 0,
        selfBaseDuration: 1,
        treeBaseDuration: 1,
        mode: 0,
        tag: FiberTag.FunctionComponent,
        index: 0,
      };

      expect(fiber.id).toBe('fiber-1');
      expect(fiber.displayName).toBe('TestComponent');
    });
  });

  describe('CommitData type', () => {
    it('should create valid commit data', () => {
      const commit: CommitData = {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 10,
        rootFiber: {} as FiberNode,
        nodes: [],
        priorityLevel: PriorityLevel.NormalPriority,
        interactions: new Set(),
      };

      expect(commit.id).toBe('commit-1');
      expect(commit.priorityLevel).toBe(3);
    });
  });

  describe('ComponentMetrics type', () => {
    it('should create valid component metrics', () => {
      const metrics: ComponentMetrics = {
        componentName: 'TestComponent',
        renderCount: 10,
        wastedRenderCount: 3,
        totalRenderTime: 50,
        averageRenderTime: 5,
        lastRenderDuration: 4,
        memoHitRate: 70,
        hasMemoization: true,
        propChanges: [],
      };

      expect(metrics.componentName).toBe('TestComponent');
      expect(metrics.wastedRenderCount).toBe(3);
    });
  });

  describe('WastedRenderReport type', () => {
    it('should create valid wasted render report', () => {
      const report: WastedRenderReport = {
        componentName: 'TestComponent',
        totalRenders: 10,
        wastedRenders: 5,
        wastedRenderRate: 50,
        severity: 'warning',
        recommendedAction: 'memo',
        issues: [],
        estimatedSavingsMs: 25,
        wastedRenderDurations: [5, 5, 5, 5, 5],
      };

      expect(report.wastedRenderRate).toBe(50);
      expect(report.severity).toBe('warning');
    });
  });

  describe('MemoEffectivenessReport type', () => {
    it('should create valid memo effectiveness report', () => {
      const report: MemoEffectivenessReport = {
        componentName: 'TestComponent',
        hasMemoization: true,
        currentHitRate: 60,
        optimalHitRate: 95,
        isEffective: false,
        issues: [],
        recommendations: ['Use useCallback'],
      };

      expect(report.hasMemoization).toBe(true);
      expect(report.isEffective).toBe(false);
    });
  });
});
