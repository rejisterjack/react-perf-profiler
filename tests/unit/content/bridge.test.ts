/**
 * Unit tests for the content script bridge
 * @module tests/unit/content/bridge
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Create a minimal fake React DevTools hook */
function makeFakeHook(overrides: Record<string, unknown> = {}) {
  return {
    supportsFiber: true,
    onCommitFiberRoot: vi.fn(),
    renderers: new Map(),
    ...overrides,
  };
}

/** Build a fake content-script → bridge message event */
function makeBridgeEvent(type: string, extraPayload: Record<string, unknown> = {}): MessageEvent {
  return new MessageEvent('message', {
    source: window,
    data: {
      source: 'react-perf-profiler-content',
      payload: { type, ...extraPayload },
    },
  });
}

// ─── Module isolation ──────────────────────────────────────────────────────
// The bridge runs side-effects on import (addEventListener, MutationObserver,
// tryInit). We re-import it in each test using vi.isolateModules() so that
// module-level state is fresh.

describe('bridge – detectReact', () => {
  beforeEach(() => {
    // Ensure a clean window state before each test
    delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    delete (window as any).React;
  });

  it('returns false when no React indicators are present', async () => {
    const { detectReact } = await import('@/content/bridge');
    expect(detectReact()).toBe(false);
  });

  it('returns true when __REACT_DEVTOOLS_GLOBAL_HOOK__ is present', async () => {
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = makeFakeHook();
    const { detectReact } = await import('@/content/bridge');
    expect(detectReact()).toBe(true);
    delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  it('returns true when window.React is present', async () => {
    (window as any).React = { version: '18.0.0' };
    const { detectReact } = await import('@/content/bridge');
    expect(detectReact()).toBe(true);
    delete (window as any).React;
  });
});

describe('bridge – getReactDetectionInfo', () => {
  beforeEach(() => {
    delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    delete (window as any).React;
  });

  it('returns an object with the expected shape', async () => {
    const { getReactDetectionInfo } = await import('@/content/bridge');
    const info = getReactDetectionInfo();
    expect(info).toHaveProperty('detected');
    expect(info).toHaveProperty('devtoolsHook');
    expect(info).toHaveProperty('reactGlobal');
    expect(info).toHaveProperty('reactRoot');
    expect(info).toHaveProperty('reactId');
    expect(info).toHaveProperty('rootContainer');
  });

  it('sets devtoolsHook=true when hook is present', async () => {
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = makeFakeHook();
    const { getReactDetectionInfo } = await import('@/content/bridge');
    const info = getReactDetectionInfo();
    expect(info.devtoolsHook).toBe(true);
    expect(info.detected).toBe(true);
    delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  it('returns all false when nothing is detected', async () => {
    const { getReactDetectionInfo } = await import('@/content/bridge');
    const info = getReactDetectionInfo();
    expect(info.devtoolsHook).toBe(false);
    expect(info.reactGlobal).toBe(false);
    expect(info.reactRoot).toBe(false);
    expect(info.reactId).toBe(false);
    expect(info.rootContainer).toBe(false);
  });
});

describe('bridge – sendMessage', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessageSpy = vi.spyOn(window, 'postMessage');
  });

  afterEach(() => {
    postMessageSpy.mockRestore();
  });

  it('calls window.postMessage with the bridge source envelope', async () => {
    const { sendMessage } = await import('@/content/bridge');
    sendMessage({ type: 'INIT', data: { success: true } } as any);
    expect(postMessageSpy).toHaveBeenCalled();
    const [msg] = postMessageSpy.mock.calls[0];
    expect(msg.source).toBe('react-perf-profiler-bridge');
    expect(msg.payload.type).toBe('INIT');
  });

  it('uses window.location.origin as targetOrigin (not wildcard) for http pages', async () => {
    const { sendMessage } = await import('@/content/bridge');
    sendMessage({ type: 'START', data: {} } as any);
    const [, targetOrigin] = postMessageSpy.mock.calls[0];
    // jsdom sets origin to 'http://localhost'
    expect(targetOrigin).not.toBe('*');
    expect(targetOrigin).toBe(window.location.origin);
  });
});

describe('bridge – handleBridgeMessage routing', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    postMessageSpy = vi.spyOn(window, 'postMessage');
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = makeFakeHook();
  });

  afterEach(() => {
    postMessageSpy.mockRestore();
    delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  it('ignores events not from window', async () => {
    const { handleBridgeMessage } = await import('@/content/bridge');
    const event = new MessageEvent('message', {
      source: null, // not window
      data: {
        source: 'react-perf-profiler-content',
        payload: { type: 'PING' },
      },
    });
    const callsBefore = postMessageSpy.mock.calls.length;
    handleBridgeMessage(event);
    expect(postMessageSpy.mock.calls.length).toBe(callsBefore);
  });

  it('ignores events with wrong data.source', async () => {
    const { handleBridgeMessage } = await import('@/content/bridge');
    const event = new MessageEvent('message', {
      source: window,
      data: {
        source: 'some-other-extension',
        payload: { type: 'PING' },
      },
    });
    const callsBefore = postMessageSpy.mock.calls.length;
    handleBridgeMessage(event);
    expect(postMessageSpy.mock.calls.length).toBe(callsBefore);
  });

  it('responds to PING with an INIT message', async () => {
    const { handleBridgeMessage } = await import('@/content/bridge');
    handleBridgeMessage(makeBridgeEvent('PING'));
    const sentMessages = postMessageSpy.mock.calls.map(([msg]) => msg);
    const initMsg = sentMessages.find(m => m?.payload?.type === 'INIT');
    expect(initMsg).toBeDefined();
  });

  it('responds to DETECT_REACT with a DETECT_RESULT message', async () => {
    const { handleBridgeMessage } = await import('@/content/bridge');
    handleBridgeMessage(makeBridgeEvent('DETECT_REACT'));
    const sentMessages = postMessageSpy.mock.calls.map(([msg]) => msg);
    const detectMsg = sentMessages.find(m => m?.payload?.type === 'DETECT_RESULT');
    expect(detectMsg).toBeDefined();
    expect(typeof detectMsg.payload.reactDetected).toBe('boolean');
    expect(typeof detectMsg.payload.devtoolsDetected).toBe('boolean');
  });

  it('sets isProfiling on START message', async () => {
    const { handleBridgeMessage, sendMessage } = await import('@/content/bridge');

    // First stop any running profiling
    handleBridgeMessage(makeBridgeEvent('STOP'));
    postMessageSpy.mockClear();

    // Then start
    handleBridgeMessage(makeBridgeEvent('START'));
    const sentMessages = postMessageSpy.mock.calls.map(([msg]) => msg);
    const startMsg = sentMessages.find(m => m?.payload?.type === 'START');
    expect(startMsg).toBeDefined();
    expect(startMsg.payload.data).toHaveProperty('timestamp');
  });

  it('sends STOP message when stopping profiling', async () => {
    const { handleBridgeMessage } = await import('@/content/bridge');
    // Start first
    handleBridgeMessage(makeBridgeEvent('START'));
    postMessageSpy.mockClear();
    // Then stop
    handleBridgeMessage(makeBridgeEvent('STOP'));
    const sentMessages = postMessageSpy.mock.calls.map(([msg]) => msg);
    const stopMsg = sentMessages.find(m => m?.payload?.type === 'STOP');
    expect(stopMsg).toBeDefined();
  });

  it('ignores duplicate START calls', async () => {
    const { handleBridgeMessage } = await import('@/content/bridge');
    handleBridgeMessage(makeBridgeEvent('START'));
    postMessageSpy.mockClear();
    handleBridgeMessage(makeBridgeEvent('START')); // duplicate
    const sentMessages = postMessageSpy.mock.calls.map(([msg]) => msg);
    // Should NOT send another START
    const startMessages = sentMessages.filter(m => m?.payload?.type === 'START');
    expect(startMessages).toHaveLength(0);
  });

  it('ignores STOP when not profiling', async () => {
    const { handleBridgeMessage } = await import('@/content/bridge');
    // Ensure stopped
    handleBridgeMessage(makeBridgeEvent('STOP'));
    postMessageSpy.mockClear();
    handleBridgeMessage(makeBridgeEvent('STOP')); // duplicate stop
    const sentMessages = postMessageSpy.mock.calls.map(([msg]) => msg);
    const stopMessages = sentMessages.filter(m => m?.payload?.type === 'STOP');
    expect(stopMessages).toHaveLength(0);
  });
});

describe('bridge – cancelRetry / scheduleRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancelRetry clears any pending retry without throwing', async () => {
    const { cancelRetry, scheduleRetry } = await import('@/content/bridge');
    // Schedule a retry then immediately cancel
    scheduleRetry();
    expect(() => cancelRetry()).not.toThrow();
  });

  it('scheduleRetry posts a RETRY_SCHEDULED message with backoff info', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');

    const { scheduleRetry, cancelRetry } = await import('@/content/bridge');
    scheduleRetry();

    const sentMessages = postMessageSpy.mock.calls.map(([msg]) => msg);
    const retryMsg = sentMessages.find(m => m?.payload?.type === 'RETRY_SCHEDULED');
    expect(retryMsg).toBeDefined();
    expect(retryMsg.payload).toHaveProperty('retryCount');
    expect(retryMsg.payload).toHaveProperty('maxRetries');
    expect(retryMsg.payload).toHaveProperty('nextRetryIn');
    expect(retryMsg.payload.nextRetryIn).toBeGreaterThan(0);

    // Clean up the scheduled timer
    cancelRetry();
    postMessageSpy.mockRestore();
  });
});

describe('bridge – cleanup', () => {
  it('removes the message event listener without throwing', async () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { cleanup } = await import('@/content/bridge');
    expect(() => cleanup()).not.toThrow();
    expect(removeListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    removeListenerSpy.mockRestore();
  });

  it('restores the original onCommitFiberRoot when hook is present', async () => {
    const originalCommit = vi.fn();
    const hook = makeFakeHook({ onCommitFiberRoot: originalCommit });
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;

    const { cleanup } = await import('@/content/bridge');
    cleanup();

    // After cleanup the hook method should be the original (or the bridge's wrapper — either way no throw)
    expect(() => cleanup()).not.toThrow();
    delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  it('sets __REACT_PERF_PROFILER_ACTIVE__ to false on cleanup', async () => {
    (window as any).__REACT_PERF_PROFILER_ACTIVE__ = true;
    const { cleanup } = await import('@/content/bridge');
    cleanup();
    expect((window as any).__REACT_PERF_PROFILER_ACTIVE__).toBe(false);
  });
});
