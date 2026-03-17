import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConnectionStore } from '@/panel/stores/connectionStore';

// Mock chrome API
const mockPort = {
  postMessage: vi.fn(),
  disconnect: vi.fn(),
  onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
};

const mockTabsQuery = vi.fn();
const mockRuntimeConnect = vi.fn();
const mockRuntimeSendMessage = vi.fn();

vi.stubGlobal('chrome', {
  tabs: {
    query: mockTabsQuery,
  },
  runtime: {
    connect: mockRuntimeConnect,
    sendMessage: mockRuntimeSendMessage,
    lastError: null,
  },
});

// Get the store's initial state for reset
const getInitialState = () => ({
  isConnected: false,
  port: null,
  lastError: null,
  retryCount: 0,
  isReconnecting: false,
  tabId: null,
  messageQueue: [],
  messageHandlers: new Set(),
});

describe('connectionStore', () => {
  beforeEach(() => {
    useConnectionStore.setState(getInitialState(), true);
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should establish connection successfully', () => {
      mockTabsQuery.mockImplementation((query, callback) => {
        callback([{ id: 123 }]);
      });
      mockRuntimeConnect.mockReturnValue(mockPort);

      const store = useConnectionStore.getState();
      store.connect();

      expect(mockTabsQuery).toHaveBeenCalled();
      expect(mockRuntimeConnect).toHaveBeenCalled();
    });

    it('should not connect if already connected', () => {
      useConnectionStore.setState({ isConnected: true, port: mockPort as any });

      const store = useConnectionStore.getState();
      store.connect();

      expect(mockTabsQuery).not.toHaveBeenCalled();
    });

    it('should handle tab query error', () => {
      mockTabsQuery.mockImplementation((query, callback) => {
        (global as any).chrome.runtime.lastError = { message: 'Tab query failed' };
        callback([]);
      });

      const store = useConnectionStore.getState();
      store.connect();

      expect(useConnectionStore.getState().lastError).toBe('Tab query failed');
      (global as any).chrome.runtime.lastError = null;
    });

    it('should handle missing tab ID', () => {
      mockTabsQuery.mockImplementation((query, callback) => {
        callback([{}]);
      });

      const store = useConnectionStore.getState();
      store.connect();

      expect(useConnectionStore.getState().lastError).toBe('Could not determine current tab');
    });

    it('should send queued messages after connection', () => {
      const queuedMessage = { type: 'TEST', payload: {} };
      useConnectionStore.setState({ messageQueue: [queuedMessage] });

      mockTabsQuery.mockImplementation((query, callback) => {
        callback([{ id: 123 }]);
      });
      mockRuntimeConnect.mockReturnValue(mockPort);

      const store = useConnectionStore.getState();
      store.connect();

      expect(mockPort.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'TEST' }));
      expect(useConnectionStore.getState().messageQueue).toHaveLength(0);
    });

    it('should handle disconnect event', () => {
      let disconnectHandler: Function;
      mockPort.onDisconnect.addListener.mockImplementation((handler) => {
        disconnectHandler = handler;
      });

      mockTabsQuery.mockImplementation((query, callback) => {
        callback([{ id: 123 }]);
      });
      mockRuntimeConnect.mockReturnValue(mockPort);

      const store = useConnectionStore.getState();
      store.connect();

      // Simulate disconnect
      if (disconnectHandler) disconnectHandler();

      expect(useConnectionStore.getState().isConnected).toBe(false);
      expect(useConnectionStore.getState().port).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should disconnect and reset state', () => {
      useConnectionStore.setState({
        isConnected: true,
        port: mockPort as any,
      });

      const store = useConnectionStore.getState();
      store.disconnect();

      expect(mockPort.disconnect).toHaveBeenCalled();
      expect(useConnectionStore.getState().isConnected).toBe(false);
      expect(useConnectionStore.getState().port).toBeNull();
    });

    it('should handle disconnect when not connected', () => {
      const store = useConnectionStore.getState();
      
      expect(() => store.disconnect()).not.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('should send message when connected', () => {
      useConnectionStore.setState({
        isConnected: true,
        port: mockPort as any,
      });

      const store = useConnectionStore.getState();
      store.sendMessage({ type: 'TEST' });

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TEST',
          timestamp: expect.any(Number),
          messageId: expect.any(String),
        })
      );
    });

    it('should queue message when not connected', () => {
      const store = useConnectionStore.getState();
      store.sendMessage({ type: 'TEST' });

      expect(useConnectionStore.getState().messageQueue).toHaveLength(1);
      expect(useConnectionStore.getState().messageQueue[0].type).toBe('TEST');
    });

    it('should queue message on send error', () => {
      mockPort.postMessage.mockImplementation(() => {
        throw new Error('Send failed');
      });

      useConnectionStore.setState({
        isConnected: true,
        port: mockPort as any,
      });

      const store = useConnectionStore.getState();
      store.sendMessage({ type: 'TEST' });

      expect(useConnectionStore.getState().messageQueue).toHaveLength(1);
      expect(useConnectionStore.getState().isConnected).toBe(false);
    });
  });

  describe('sendTypedMessage', () => {
    it('should send typed message when connected', () => {
      useConnectionStore.setState({
        isConnected: true,
        port: mockPort as any,
      });

      const store = useConnectionStore.getState();
      store.sendTypedMessage({ type: 'PING' } as any);

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PING' })
      );
    });

    it('should queue message when not connected', () => {
      const store = useConnectionStore.getState();
      store.sendTypedMessage({ type: 'PING' } as any);

      expect(useConnectionStore.getState().messageQueue).toHaveLength(1);
    });
  });

  describe('handleMessage', () => {
    it('should notify all registered handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      useConnectionStore.setState({
        messageHandlers: new Set([handler1, handler2]),
      });

      const message = { type: 'TEST' };
      const store = useConnectionStore.getState();
      store.handleMessage(message as any);

      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
    });

    it('should handle handler errors gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      useConnectionStore.setState({
        messageHandlers: new Set([errorHandler, normalHandler]),
      });

      const store = useConnectionStore.getState();
      
      expect(() => store.handleMessage({ type: 'TEST' } as any)).not.toThrow();
      expect(normalHandler).toHaveBeenCalled();
    });

    it('should handle PONG message', () => {
      const store = useConnectionStore.getState();
      store.handleMessage({ type: 'PONG' } as any);

      expect(useConnectionStore.getState().isConnected).toBe(true);
      expect(useConnectionStore.getState().retryCount).toBe(0);
    });

    it('should handle ERROR message', () => {
      const store = useConnectionStore.getState();
      store.handleMessage({
        type: 'ERROR',
        payload: { message: 'Test error' },
      } as any);

      expect(useConnectionStore.getState().lastError).toBe('Test error');
    });
  });

  describe('onMessage', () => {
    it('should register handler and return unsubscribe', () => {
      const handler = vi.fn();

      const store = useConnectionStore.getState();
      const unsubscribe = store.onMessage(handler);

      expect(useConnectionStore.getState().messageHandlers.has(handler)).toBe(true);

      unsubscribe();

      expect(useConnectionStore.getState().messageHandlers.has(handler)).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear last error', () => {
      useConnectionStore.setState({ lastError: 'Test error' });

      const store = useConnectionStore.getState();
      store.clearError();

      expect(useConnectionStore.getState().lastError).toBeNull();
    });
  });

  describe('ping', () => {
    it('should send ping when connected', () => {
      useConnectionStore.setState({
        isConnected: true,
        port: mockPort as any,
      });

      const store = useConnectionStore.getState();
      store.ping();

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PING' })
      );
    });

    it('should handle ping error', () => {
      mockPort.postMessage.mockImplementation(() => {
        throw new Error('Ping failed');
      });

      useConnectionStore.setState({
        isConnected: true,
        port: mockPort as any,
      });

      const store = useConnectionStore.getState();
      store.ping();

      expect(useConnectionStore.getState().isConnected).toBe(false);
      expect(useConnectionStore.getState().lastError).toBe('Ping failed - connection lost');
    });

    it('should do nothing when not connected', () => {
      const store = useConnectionStore.getState();
      store.ping();

      expect(mockPort.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('reconnect', () => {
    it('should attempt reconnect with exponential backoff', async () => {
      mockTabsQuery.mockImplementation((query, callback) => {
        callback([{ id: 123 }]);
      });
      mockRuntimeConnect.mockReturnValue(mockPort);

      useConnectionStore.setState({ retryCount: 2 });

      const store = useConnectionStore.getState();
      const startTime = Date.now();
      await store.reconnect();
      const endTime = Date.now();

      // Should wait at least 4 seconds (2^2 * 1000ms)
      expect(endTime - startTime).toBeGreaterThanOrEqual(4000);
      expect(useConnectionStore.getState().isReconnecting).toBe(false);
    });

    it('should not reconnect if already reconnecting', async () => {
      useConnectionStore.setState({ isReconnecting: true });

      const store = useConnectionStore.getState();
      await store.reconnect();

      expect(mockRuntimeConnect).not.toHaveBeenCalled();
    });

    it('should not reconnect after max retries', async () => {
      useConnectionStore.setState({ retryCount: 5 });

      const store = useConnectionStore.getState();
      await store.reconnect();

      expect(mockRuntimeConnect).not.toHaveBeenCalled();
    });

    it('should cap delay at 30 seconds', async () => {
      mockTabsQuery.mockImplementation((query, callback) => {
        callback([{ id: 123 }]);
      });
      mockRuntimeConnect.mockReturnValue(mockPort);

      useConnectionStore.setState({ retryCount: 10 });

      const store = useConnectionStore.getState();
      const startTime = Date.now();
      await store.reconnect();
      const endTime = Date.now();

      // Should wait at most 30 seconds
      expect(endTime - startTime).toBeLessThan(35000);
    });
  });
});
