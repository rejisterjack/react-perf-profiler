/**
 * Unit tests for the background ConnectionManager
 * @module tests/unit/background/connectionManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager } from '@/background/connectionManager';

// ─── Fake port factory ───────────────────────────────────────────────────────

function makePort(name = 'test-port') {
  const disconnectListeners: (() => void)[] = [];
  return {
    name,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onDisconnect: {
      addListener: vi.fn((fn: () => void) => {
        disconnectListeners.push(fn);
      }),
      removeListener: vi.fn(),
      _trigger: () => disconnectListeners.forEach(fn => fn()),
    },
  };
}

type FakePort = ReturnType<typeof makePort>;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ConnectionManager – getOrCreateConnection', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ConnectionManager({ enableLogging: false });
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  it('creates a new connection for an unknown tab', () => {
    const conn = manager.getOrCreateConnection(42);
    expect(conn.tabId).toBe(42);
    expect(conn.isProfiling).toBe(false);
    expect(conn.contentPort).toBeNull();
  });

  it('returns the same connection on subsequent calls', () => {
    const a = manager.getOrCreateConnection(1);
    const b = manager.getOrCreateConnection(1);
    expect(a).toBe(b);
  });

  it('getConnection returns undefined for unknown tab', () => {
    expect(manager.getConnection(999)).toBeUndefined();
  });

  it('tracks connection count', () => {
    manager.getOrCreateConnection(1);
    manager.getOrCreateConnection(2);
    expect(manager.getConnectionCount()).toBe(2);
  });
});

describe('ConnectionManager – connectPort', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ConnectionManager({ enableLogging: false });
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  it('succeeds for a fresh port type', () => {
    const port = makePort() as unknown as chrome.runtime.Port;
    const result = manager.connectPort(1, 'devtools', port);
    expect(result.success).toBe(true);
  });

  it('stores the port on the connection', () => {
    const port = makePort() as unknown as chrome.runtime.Port;
    manager.connectPort(1, 'devtools', port);
    const conn = manager.getConnection(1)!;
    expect(conn.devtoolsPort).toBe(port);
  });

  it('sends a STATUS_UPDATE to the port on connect', () => {
    const port = makePort();
    manager.connectPort(1, 'devtools', port as unknown as chrome.runtime.Port);
    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'STATUS_UPDATE' })
    );
  });

  it('returns failure when the port type is already connected', () => {
    const port = makePort() as unknown as chrome.runtime.Port;
    manager.connectPort(1, 'content', port);
    const result = manager.connectPort(1, 'content', port);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PORT_ALREADY_CONNECTED');
  });

  it('clears the port reference when the port disconnects', () => {
    const port = makePort();
    manager.connectPort(1, 'content', port as unknown as chrome.runtime.Port);
    expect(manager.getConnection(1)?.contentPort).not.toBeNull();
    port.onDisconnect._trigger();
    // Connection may be cleaned up entirely if all ports are gone
    const conn = manager.getConnection(1);
    expect(conn === undefined || conn.contentPort === null).toBe(true);
  });
});

describe('ConnectionManager – broadcastToPort', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ConnectionManager({ enableLogging: false });
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  it('returns failure when no connection exists for tab', () => {
    const result = manager.broadcastToPort(99, 'devtools', { type: 'TEST' });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CONNECTION_NOT_FOUND');
  });

  it('returns failure when the port is not connected', () => {
    manager.getOrCreateConnection(1); // connection exists, no devtools port
    const result = manager.broadcastToPort(1, 'devtools', { type: 'TEST' });
    expect(result.success).toBe(false);
  });

  it('calls postMessage on the connected port', () => {
    const port = makePort();
    manager.connectPort(1, 'devtools', port as unknown as chrome.runtime.Port);
    port.postMessage.mockClear(); // clear STATUS_UPDATE call
    manager.broadcastToPort(1, 'devtools', { type: 'HELLO' });
    expect(port.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'HELLO' }));
  });

  it('returns failure and logs when postMessage throws', () => {
    const port = makePort();
    port.postMessage.mockImplementation(() => {
      throw new Error('port closed');
    });
    manager.connectPort(1, 'content', port as unknown as chrome.runtime.Port);
    const result = manager.broadcastToPort(1, 'content', { type: 'TEST' });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('BROADCAST_FAILED');
  });
});

describe('ConnectionManager – broadcastToAllPorts', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ConnectionManager({ enableLogging: false });
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  it('sends to all connected ports', () => {
    const contentPort = makePort('content');
    const devtoolsPort = makePort('devtools');
    manager.connectPort(1, 'content', contentPort as unknown as chrome.runtime.Port);
    manager.connectPort(1, 'devtools', devtoolsPort as unknown as chrome.runtime.Port);
    contentPort.postMessage.mockClear();
    devtoolsPort.postMessage.mockClear();

    manager.broadcastToAllPorts(1, { type: 'BROADCAST' });

    expect(contentPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'BROADCAST' })
    );
    expect(devtoolsPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'BROADCAST' })
    );
  });
});

describe('ConnectionManager – cleanupConnection', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ConnectionManager({ enableLogging: false });
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  it('removes connection from tracking', () => {
    manager.getOrCreateConnection(5);
    expect(manager.getConnectionCount()).toBe(1);
    manager.cleanupConnection(5);
    expect(manager.getConnectionCount()).toBe(0);
  });

  it('does not throw when cleaning up non-existent connection', () => {
    expect(() => manager.cleanupConnection(999)).not.toThrow();
  });
});

describe('ConnectionManager – dispose', () => {
  it('clears the cleanup interval and removes all connections', () => {
    vi.useFakeTimers();
    const manager = new ConnectionManager({ enableLogging: false });
    manager.getOrCreateConnection(1);
    manager.getOrCreateConnection(2);
    manager.dispose();
    expect(manager.getConnectionCount()).toBe(0);
    vi.useRealTimers();
  });
});
