/**
 * Unit tests for the background MessageRouter
 * @module tests/unit/background/messageRouter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRouter } from '@/background/messageRouter';
import { MessageTypeEnum } from '@/shared/constants';

// ─── Minimal fakes ──────────────────────────────────────────────────────────

function makeConnectionManager() {
  return {
    broadcastToPort: vi.fn().mockReturnValue({ success: true }),
    broadcastToAllPorts: vi.fn(),
    getConnection: vi.fn().mockReturnValue(undefined),
    getOrCreateConnection: vi.fn().mockReturnValue({
      tabId: 1,
      isProfiling: false,
      sessionStartTime: null,
      commits: [],
      commitCount: 0,
      sessionStatus: 'idle',
      contentPort: null,
      devtoolsPort: null,
      popupPort: null,
    }),
  };
}

function makeSessionManager() {
  return {
    startSession: vi.fn().mockReturnValue({ success: true }),
    stopSession: vi.fn().mockReturnValue([]),
    addCommit: vi.fn(),
    getSessionData: vi.fn().mockReturnValue([]),
    clearSession: vi.fn(),
  };
}

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Console;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('MessageRouter – isValidExtensionMessage guard', () => {
  let router: MessageRouter;
  let connectionManager: ReturnType<typeof makeConnectionManager>;
  let sessionManager: ReturnType<typeof makeSessionManager>;

  beforeEach(() => {
    connectionManager = makeConnectionManager();
    sessionManager = makeSessionManager();
    router = new MessageRouter(connectionManager as any, sessionManager as any, makeLogger());
  });

  it('ignores null messages', () => {
    router.handleContentMessage(1, null);
    expect(connectionManager.broadcastToPort).not.toHaveBeenCalled();
  });

  it('ignores non-object messages', () => {
    router.handleContentMessage(1, 'hello');
    expect(connectionManager.broadcastToPort).not.toHaveBeenCalled();
  });

  it('ignores messages without a type field', () => {
    router.handleContentMessage(1, { payload: {} });
    expect(connectionManager.broadcastToPort).not.toHaveBeenCalled();
  });

  it('ignores messages with unknown type', () => {
    router.handleContentMessage(1, { type: 'TOTALLY_UNKNOWN_TYPE' });
    expect(connectionManager.broadcastToPort).not.toHaveBeenCalled();
  });
});

describe('MessageRouter – START_PROFILING routing', () => {
  let router: MessageRouter;
  let connectionManager: ReturnType<typeof makeConnectionManager>;
  let sessionManager: ReturnType<typeof makeSessionManager>;

  beforeEach(() => {
    connectionManager = makeConnectionManager();
    sessionManager = makeSessionManager();
    router = new MessageRouter(connectionManager as any, sessionManager as any, makeLogger());
  });

  it('starts a session and broadcasts START to content port', () => {
    router.handleDevtoolsMessage(1, { type: MessageTypeEnum.START_PROFILING });
    expect(sessionManager.startSession).toHaveBeenCalledWith(1);
    expect(connectionManager.broadcastToPort).toHaveBeenCalledWith(
      1,
      'content',
      expect.objectContaining({ type: MessageTypeEnum.START_PROFILING })
    );
  });

  it('notifies all ports via broadcastToAllPorts', () => {
    router.handleDevtoolsMessage(1, { type: MessageTypeEnum.START_PROFILING });
    expect(connectionManager.broadcastToAllPorts).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: 'PROFILING_STARTED' })
    );
  });

  it('sends ERROR back to source when session fails to start', () => {
    sessionManager.startSession.mockReturnValue({
      success: false,
      error: { message: 'Already started' },
    });
    router.handleDevtoolsMessage(1, { type: MessageTypeEnum.START_PROFILING });
    expect(connectionManager.broadcastToPort).toHaveBeenCalledWith(
      1,
      'devtools',
      expect.objectContaining({ type: MessageTypeEnum.ERROR })
    );
  });
});

describe('MessageRouter – STOP_PROFILING routing', () => {
  let router: MessageRouter;
  let connectionManager: ReturnType<typeof makeConnectionManager>;
  let sessionManager: ReturnType<typeof makeSessionManager>;

  beforeEach(() => {
    connectionManager = makeConnectionManager();
    sessionManager = makeSessionManager();
    router = new MessageRouter(connectionManager as any, sessionManager as any, makeLogger());
  });

  it('stops the session and broadcasts STOP to content port', () => {
    router.handleDevtoolsMessage(1, { type: MessageTypeEnum.STOP_PROFILING });
    expect(sessionManager.stopSession).toHaveBeenCalledWith(1);
    expect(connectionManager.broadcastToPort).toHaveBeenCalledWith(
      1,
      'content',
      expect.objectContaining({ type: MessageTypeEnum.STOP_PROFILING })
    );
  });

  it('broadcasts PROFILING_STOPPED to all ports with commit data', () => {
    const fakeCommits = [{ id: 'c1' }];
    sessionManager.stopSession.mockReturnValue(fakeCommits);
    router.handleDevtoolsMessage(1, { type: MessageTypeEnum.STOP_PROFILING });
    expect(connectionManager.broadcastToAllPorts).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: 'PROFILING_STOPPED', commits: fakeCommits })
    );
  });
});

describe('MessageRouter – COMMIT routing', () => {
  let router: MessageRouter;
  let connectionManager: ReturnType<typeof makeConnectionManager>;
  let sessionManager: ReturnType<typeof makeSessionManager>;

  beforeEach(() => {
    connectionManager = makeConnectionManager();
    sessionManager = makeSessionManager();
    router = new MessageRouter(connectionManager as any, sessionManager as any, makeLogger());
  });

  it('stores commit and forwards to devtools port', () => {
    const commit = { id: 'c1', timestamp: Date.now() };
    router.handleContentMessage(1, {
      type: MessageTypeEnum.COMMIT,
      payload: { commit },
    });
    expect(sessionManager.addCommit).toHaveBeenCalledWith(1, commit);
    expect(connectionManager.broadcastToPort).toHaveBeenCalledWith(
      1,
      'devtools',
      expect.objectContaining({ type: MessageTypeEnum.COMMIT })
    );
  });

  it('does nothing when commit payload is missing', () => {
    router.handleContentMessage(1, {
      type: MessageTypeEnum.COMMIT,
      payload: {},
    });
    expect(sessionManager.addCommit).not.toHaveBeenCalled();
  });
});

describe('MessageRouter – GET_DATA routing', () => {
  let router: MessageRouter;
  let connectionManager: ReturnType<typeof makeConnectionManager>;
  let sessionManager: ReturnType<typeof makeSessionManager>;

  beforeEach(() => {
    connectionManager = makeConnectionManager();
    sessionManager = makeSessionManager();
    router = new MessageRouter(connectionManager as any, sessionManager as any, makeLogger());
  });

  it('responds with DATA_RESPONSE back to the requesting port', () => {
    const commits = [{ id: 'c1' }];
    sessionManager.getSessionData.mockReturnValue(commits);
    router.handleDevtoolsMessage(1, { type: MessageTypeEnum.GET_DATA });
    expect(connectionManager.broadcastToPort).toHaveBeenCalledWith(
      1,
      'devtools',
      expect.objectContaining({ type: 'DATA_RESPONSE', payload: expect.objectContaining({ commits }) })
    );
  });
});

describe('MessageRouter – CLEAR_DATA routing', () => {
  let router: MessageRouter;
  let connectionManager: ReturnType<typeof makeConnectionManager>;
  let sessionManager: ReturnType<typeof makeSessionManager>;

  beforeEach(() => {
    connectionManager = makeConnectionManager();
    sessionManager = makeSessionManager();
    router = new MessageRouter(connectionManager as any, sessionManager as any, makeLogger());
  });

  it('clears session data and broadcasts DATA_CLEARED', () => {
    router.handleDevtoolsMessage(1, { type: MessageTypeEnum.CLEAR_DATA });
    expect(sessionManager.clearSession).toHaveBeenCalledWith(1);
    expect(connectionManager.broadcastToAllPorts).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: 'DATA_CLEARED' })
    );
  });
});
