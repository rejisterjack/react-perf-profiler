import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MessageRouter } from '@/background/messageRouter';
import type { ConnectionManager } from '@/background/connectionManager';
import type { SessionManager } from '@/background/sessionManager';
import { MessageTypeEnum } from '@/shared/constants';
import type { ExtensionMessage, CommitData } from '@/shared/types';

describe('Extension Integration Tests', () => {
  // Mock implementations
  let mockConnectionManager: ConnectionManager;
  let mockSessionManager: SessionManager;
  let messageRouter: MessageRouter;
  let broadcastedMessages: Array<{ tabId: number; portType: string; message: any }>;

  beforeEach(() => {
    broadcastedMessages = [];

    // Create mock connection manager
    mockConnectionManager = {
      broadcastToPort: vi.fn((tabId, portType, message) => {
        broadcastedMessages.push({ tabId, portType, message });
      }),
      broadcastToAllPorts: vi.fn((tabId, message) => {
        broadcastedMessages.push({ tabId, portType: 'all', message });
      }),
      getConnection: vi.fn(() => ({ sessionStartTime: Date.now() })),
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
    } as any;

    // Create mock session manager
    mockSessionManager = {
      startSession: vi.fn(() => ({ success: true })),
      stopSession: vi.fn(() => []),
      addCommit: vi.fn(),
      getSessionData: vi.fn(() => []),
      clearSession: vi.fn(),
    } as any;

    messageRouter = new MessageRouter(
      mockConnectionManager,
      mockSessionManager,
      console,
      false
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Routing', () => {
    it('should route START_PROFILING message to content script', () => {
      const message: ExtensionMessage = {
        type: MessageTypeEnum.START_PROFILING,
        timestamp: Date.now(),
      };

      messageRouter.handleDevtoolsMessage(123, message);

      // Should forward to content script
      const contentBroadcast = broadcastedMessages.find(
        m => m.portType === 'content' && m.message.type === MessageTypeEnum.START_PROFILING
      );
      expect(contentBroadcast).toBeDefined();

      // Should broadcast to all ports
      const allBroadcast = broadcastedMessages.find(
        m => m.portType === 'all' && m.message.type === 'PROFILING_STARTED'
      );
      expect(allBroadcast).toBeDefined();
    });

    it('should route STOP_PROFILING message to content script', () => {
      const message: ExtensionMessage = {
        type: MessageTypeEnum.STOP_PROFILING,
        timestamp: Date.now(),
      };

      messageRouter.handleDevtoolsMessage(123, message);

      // Should forward to content script
      const contentBroadcast = broadcastedMessages.find(
        m => m.portType === 'content' && m.message.type === MessageTypeEnum.STOP_PROFILING
      );
      expect(contentBroadcast).toBeDefined();

      // Should broadcast to all ports
      const allBroadcast = broadcastedMessages.find(
        m => m.portType === 'all' && m.message.type === 'PROFILING_STOPPED'
      );
      expect(allBroadcast).toBeDefined();
    });

    it('should route COMMIT message to devtools and popup', () => {
      const commit: CommitData = {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 10,
        rootFiber: {} as any,
        nodes: [],
        priorityLevel: 3,
        interactions: new Set(),
      };

      const message: ExtensionMessage = {
        type: MessageTypeEnum.COMMIT,
        payload: { commit },
        timestamp: Date.now(),
      };

      messageRouter.handleContentMessage(123, message);

      // Should store commit
      expect(mockSessionManager.addCommit).toHaveBeenCalledWith(123, commit);

      // Should forward to devtools
      const devtoolsBroadcast = broadcastedMessages.find(
        m => m.portType === 'devtools' && m.message.type === MessageTypeEnum.COMMIT
      );
      expect(devtoolsBroadcast).toBeDefined();

      // Should forward to popup
      const popupBroadcast = broadcastedMessages.find(
        m => m.portType === 'popup' && m.message.type === MessageTypeEnum.COMMIT
      );
      expect(popupBroadcast).toBeDefined();
    });

    it('should handle CLEAR_DATA message', () => {
      const message: ExtensionMessage = {
        type: MessageTypeEnum.CLEAR_DATA,
        timestamp: Date.now(),
      };

      messageRouter.handleDevtoolsMessage(123, message);

      // Should clear session
      expect(mockSessionManager.clearSession).toHaveBeenCalledWith(123);

      // Should broadcast to all ports
      const allBroadcast = broadcastedMessages.find(
        m => m.portType === 'all' && m.message.type === 'DATA_CLEARED'
      );
      expect(allBroadcast).toBeDefined();
    });

    it('should handle GET_DATA message', () => {
      const sessionData = [
        { id: 'commit-1', timestamp: Date.now(), duration: 10 },
      ];
      mockSessionManager.getSessionData = vi.fn(() => sessionData);

      const message: ExtensionMessage = {
        type: MessageTypeEnum.GET_DATA,
        timestamp: Date.now(),
      };

      messageRouter.handleDevtoolsMessage(123, message);

      // Should get session data
      expect(mockSessionManager.getSessionData).toHaveBeenCalledWith(123);

      // Should send data response
      const devtoolsBroadcast = broadcastedMessages.find(
        m => m.portType === 'devtools' && m.message.type === 'DATA_RESPONSE'
      );
      expect(devtoolsBroadcast).toBeDefined();
      expect(devtoolsBroadcast?.message.payload.commits).toEqual(sessionData);
    });

    it('should reject invalid messages', () => {
      const invalidMessage = { invalid: 'message' };

      messageRouter.handleContentMessage(123, invalidMessage);

      // Should not route invalid messages
      expect(broadcastedMessages).toHaveLength(0);
      expect(mockSessionManager.addCommit).not.toHaveBeenCalled();
    });

    it('should reject messages with unknown type', () => {
      const unknownMessage = {
        type: 'UNKNOWN_TYPE',
        timestamp: Date.now(),
      };

      messageRouter.handleContentMessage(123, unknownMessage);

      // Should not route unknown message types
      expect(broadcastedMessages).toHaveLength(0);
    });
  });

  describe('Session Management', () => {
    it('should start session on START_PROFILING', () => {
      const message: ExtensionMessage = {
        type: MessageTypeEnum.START_PROFILING,
        timestamp: Date.now(),
      };

      messageRouter.handleDevtoolsMessage(123, message);

      expect(mockSessionManager.startSession).toHaveBeenCalledWith(123);
    });

    it('should stop session on STOP_PROFILING', () => {
      const message: ExtensionMessage = {
        type: MessageTypeEnum.STOP_PROFILING,
        timestamp: Date.now(),
      };

      messageRouter.handleDevtoolsMessage(123, message);

      expect(mockSessionManager.stopSession).toHaveBeenCalledWith(123);
    });

    it('should handle failed session start', () => {
      mockSessionManager.startSession = vi.fn(() => ({
        success: false,
        error: new Error('Session already exists'),
      }));

      const message: ExtensionMessage = {
        type: MessageTypeEnum.START_PROFILING,
        timestamp: Date.now(),
      };

      messageRouter.handleDevtoolsMessage(123, message);

      // Should send error message
      const errorBroadcast = broadcastedMessages.find(
        m => m.message.type === MessageTypeEnum.ERROR
      );
      expect(errorBroadcast).toBeDefined();
    });

    it('should store commits during profiling session', () => {
      const commit: CommitData = {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 10,
        rootFiber: {} as any,
        nodes: [],
        priorityLevel: 3,
        interactions: new Set(),
      };

      const message: ExtensionMessage = {
        type: MessageTypeEnum.COMMIT,
        payload: { commit },
        timestamp: Date.now(),
      };

      messageRouter.handleContentMessage(123, message);

      expect(mockSessionManager.addCommit).toHaveBeenCalledWith(123, commit);
    });
  });

  describe('Multi-Tab Support', () => {
    it('should handle messages from different tabs independently', () => {
      const commit1: CommitData = {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 10,
        rootFiber: {} as any,
        nodes: [],
        priorityLevel: 3,
        interactions: new Set(),
      };

      const commit2: CommitData = {
        id: 'commit-2',
        timestamp: Date.now(),
        duration: 15,
        rootFiber: {} as any,
        nodes: [],
        priorityLevel: 3,
        interactions: new Set(),
      };

      messageRouter.handleContentMessage(123, {
        type: MessageTypeEnum.COMMIT,
        payload: { commit: commit1 },
        timestamp: Date.now(),
      });

      messageRouter.handleContentMessage(456, {
        type: MessageTypeEnum.COMMIT,
        payload: { commit: commit2 },
        timestamp: Date.now(),
      });

      expect(mockSessionManager.addCommit).toHaveBeenCalledWith(123, commit1);
      expect(mockSessionManager.addCommit).toHaveBeenCalledWith(456, commit2);
    });

    it('should maintain separate sessions per tab', () => {
      messageRouter.handleDevtoolsMessage(123, {
        type: MessageTypeEnum.START_PROFILING,
        timestamp: Date.now(),
      });

      messageRouter.handleDevtoolsMessage(456, {
        type: MessageTypeEnum.START_PROFILING,
        timestamp: Date.now(),
      });

      expect(mockSessionManager.startSession).toHaveBeenCalledWith(123);
      expect(mockSessionManager.startSession).toHaveBeenCalledWith(456);
    });
  });

  describe('Error Handling', () => {
    it('should handle commit message without payload', () => {
      const message: ExtensionMessage = {
        type: MessageTypeEnum.COMMIT,
        timestamp: Date.now(),
      };

      // Should not throw
      expect(() => {
        messageRouter.handleContentMessage(123, message);
      }).not.toThrow();

      // Should not store commit
      expect(mockSessionManager.addCommit).not.toHaveBeenCalled();
    });

    it('should handle commit message with missing commit data', () => {
      const message: ExtensionMessage = {
        type: MessageTypeEnum.COMMIT,
        payload: { other: 'data' },
        timestamp: Date.now(),
      };

      messageRouter.handleContentMessage(123, message);

      // Should not store commit
      expect(mockSessionManager.addCommit).not.toHaveBeenCalled();
    });

    it('should handle session manager errors gracefully', () => {
      mockSessionManager.startSession = vi.fn(() => {
        throw new Error('Storage full');
      });

      const message: ExtensionMessage = {
        type: MessageTypeEnum.START_PROFILING,
        timestamp: Date.now(),
      };

      // Should not throw
      expect(() => {
        messageRouter.handleDevtoolsMessage(123, message);
      }).not.toThrow();
    });
  });
});
