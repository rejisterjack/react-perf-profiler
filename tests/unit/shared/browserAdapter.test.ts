import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectBrowser,
  isFirefox,
  isChrome,
  createDevToolsPanel,
  getRuntime,
  getStorage,
  getTabs,
  sendMessage,
  sendMessageToTab,
  onMessage,
  getManifestVersion,
  isManifestVersion,
  getManifestConfig,
  promisifyChrome,
  createStoragePromise,
  getExtensionInfo,
  type BrowserType,
  type DevToolsPanel,
  type CreatePanelOptions,
  type MessageResponse,
} from '@/shared/browser/firefoxAdapter';

describe('Browser Adapter', () => {
  // Store original references
  let originalChrome: typeof global.chrome;
  let originalBrowser: typeof global.browser;

  // Mock chrome API factory
  const createMockChrome = () => ({
    devtools: {
      panels: {
        create: vi.fn(),
      },
    },
    runtime: {
      id: 'chrome-extension-id',
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn(),
      },
      getManifest: vi.fn(() => ({ version: '1.0.0' })),
      lastError: undefined as chrome.runtime.LastError | undefined,
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
      sync: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
      managed: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
  });

  // Mock browser API factory (Firefox - Promise-based)
  const createMockBrowser = () => ({
    devtools: {
      panels: {
        create: vi.fn(),
      },
    },
    runtime: {
      id: 'firefox-extension-id',
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn(),
      },
      getManifest: vi.fn(() => ({ version: '2.0.0' })),
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
      sync: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
      managed: {
        get: vi.fn(),
        set: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
  });

  beforeEach(() => {
    // Save originals
    originalChrome = global.chrome;
    originalBrowser = (global as typeof globalThis & { browser?: typeof global.browser }).browser;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore originals
    global.chrome = originalChrome;
    (global as typeof globalThis & { browser?: typeof global.browser }).browser = originalBrowser;
  });

  // =============================================================================
  // detectBrowser Tests
  // =============================================================================
  describe('detectBrowser', () => {
    it('should detect Firefox when browser.devtools exists', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      expect(detectBrowser()).toBe('firefox');
    });

    it('should detect Chrome when chrome.devtools exists', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(detectBrowser()).toBe('chrome');
    });

    it('should return unknown when neither chrome nor browser exists', () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(detectBrowser()).toBe('unknown');
    });

    it('should return unknown when chrome exists but without devtools', () => {
      global.chrome = { runtime: {} } as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(detectBrowser()).toBe('unknown');
    });

    it('should prioritize Firefox over Chrome when both are present', () => {
      const mockBrowser = createMockBrowser();
      const mockChrome = createMockChrome();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = mockChrome as any;

      expect(detectBrowser()).toBe('firefox');
    });

    it('should handle browser object without devtools property', () => {
      (global as typeof globalThis & { browser: any }).browser = { runtime: {} };
      global.chrome = undefined as any;

      expect(detectBrowser()).toBe('unknown');
    });
  });

  // =============================================================================
  // isFirefox / isChrome Tests
  // =============================================================================
  describe('isFirefox', () => {
    it('should return true when browser is Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      expect(isFirefox()).toBe(true);
    });

    it('should return false when browser is Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(isFirefox()).toBe(false);
    });

    it('should return false when browser is unknown', () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(isFirefox()).toBe(false);
    });
  });

  describe('isChrome', () => {
    it('should return true when browser is Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(isChrome()).toBe(true);
    });

    it('should return false when browser is Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      expect(isChrome()).toBe(false);
    });

    it('should return false when browser is unknown', () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(isChrome()).toBe(false);
    });
  });

  // =============================================================================
  // createDevToolsPanel Tests
  // =============================================================================
  describe('createDevToolsPanel', () => {
    const mockPanelOptions: CreatePanelOptions = {
      id: 'test-panel',
      title: 'Test Panel',
      iconPath: '/icon.png',
      pagePath: '/panel.html',
    };

    it('should create a Firefox panel using Promise-based API', async () => {
      const mockPanel = {
        onShown: { addListener: vi.fn() },
        onHidden: { addListener: vi.fn() },
        setHeight: vi.fn(),
        setWidth: vi.fn(),
      };

      const mockBrowser = createMockBrowser();
      mockBrowser.devtools.panels.create.mockResolvedValue(mockPanel);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const panel = await createDevToolsPanel(mockPanelOptions);

      expect(mockBrowser.devtools.panels.create).toHaveBeenCalledWith(
        'Test Panel',
        '/icon.png',
        '/panel.html'
      );
      expect(panel.id).toBe('test-panel');
      expect(panel.title).toBe('Test Panel');
      expect(panel.iconPath).toBe('/icon.png');
      expect(panel.pagePath).toBe('/panel.html');
    });

    it('should create a Chrome panel using callback-based API', async () => {
      const mockPanel = {
        onShown: { addListener: vi.fn() },
        onHidden: { addListener: vi.fn() },
      };

      const mockChrome = createMockChrome();
      mockChrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback(mockPanel);
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const panel = await createDevToolsPanel(mockPanelOptions);

      expect(mockChrome.devtools.panels.create).toHaveBeenCalledWith(
        'Test Panel',
        '/icon.png',
        '/panel.html',
        expect.any(Function)
      );
      expect(panel.id).toBe('test-panel');
      expect(panel.title).toBe('Test Panel');
    });

    it('should reject when browser is unknown', async () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      await expect(createDevToolsPanel(mockPanelOptions)).rejects.toThrow(
        'Unsupported browser: DevTools API not available'
      );
    });

    it('should handle Chrome panel creation errors', async () => {
      const mockChrome = createMockChrome();
      const errorMessage = 'Panel creation failed';
      mockChrome.runtime.lastError = { message: errorMessage };
      mockChrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback({ onShown: { addListener: vi.fn() }, onHidden: { addListener: vi.fn() } });
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      await expect(createDevToolsPanel(mockPanelOptions)).rejects.toThrow(errorMessage);
    });

    it('should register onShown callbacks for Firefox panel', async () => {
      const mockPanel = {
        onShown: { addListener: vi.fn() },
        onHidden: { addListener: vi.fn() },
      };

      const mockBrowser = createMockBrowser();
      mockBrowser.devtools.panels.create.mockResolvedValue(mockPanel);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const panel = await createDevToolsPanel(mockPanelOptions);
      const callback = vi.fn();
      panel.onShown(callback);

      // Simulate the onShown event
      const onShownHandler = mockPanel.onShown.addListener.mock.calls[0][0];
      onShownHandler();

      expect(callback).toHaveBeenCalled();
    });

    it('should register onHidden callbacks for Firefox panel', async () => {
      const mockPanel = {
        onShown: { addListener: vi.fn() },
        onHidden: { addListener: vi.fn() },
      };

      const mockBrowser = createMockBrowser();
      mockBrowser.devtools.panels.create.mockResolvedValue(mockPanel);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const panel = await createDevToolsPanel(mockPanelOptions);
      const callback = vi.fn();
      panel.onHidden(callback);

      // Simulate the onHidden event
      const onHiddenHandler = mockPanel.onHidden.addListener.mock.calls[0][0];
      onHiddenHandler();

      expect(callback).toHaveBeenCalled();
    });

    it('should register onShown callbacks for Chrome panel', async () => {
      const mockPanel = {
        onShown: { addListener: vi.fn() },
        onHidden: { addListener: vi.fn() },
      };

      const mockChrome = createMockChrome();
      mockChrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback(mockPanel);
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const panel = await createDevToolsPanel(mockPanelOptions);
      const callback = vi.fn();
      panel.onShown(callback);

      // Simulate the onShown event
      const onShownHandler = mockPanel.onShown.addListener.mock.calls[0][0];
      onShownHandler();

      expect(callback).toHaveBeenCalled();
    });

    it('should use default panel ID when not provided', async () => {
      const mockPanel = {
        onShown: { addListener: vi.fn() },
        onHidden: { addListener: vi.fn() },
      };

      const mockBrowser = createMockBrowser();
      mockBrowser.devtools.panels.create.mockResolvedValue(mockPanel);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const optionsWithoutId: CreatePanelOptions = {
        title: 'Test Panel',
        pagePath: '/panel.html',
      };

      const panel = await createDevToolsPanel(optionsWithoutId);
      expect(panel.id).toBe('react-perf-profiler');
    });

    it('should use empty string for iconPath when not provided', async () => {
      const mockPanel = {
        onShown: { addListener: vi.fn() },
        onHidden: { addListener: vi.fn() },
      };

      const mockBrowser = createMockBrowser();
      mockBrowser.devtools.panels.create.mockResolvedValue(mockPanel);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const optionsWithoutIcon: CreatePanelOptions = {
        title: 'Test Panel',
        pagePath: '/panel.html',
      };

      await createDevToolsPanel(optionsWithoutIcon);
      expect(mockBrowser.devtools.panels.create).toHaveBeenCalledWith(
        'Test Panel',
        '',
        '/panel.html'
      );
    });

    it('should support setHeight and setWidth on Firefox panel', async () => {
      const mockPanel = {
        onShown: { addListener: vi.fn() },
        onHidden: { addListener: vi.fn() },
        setHeight: vi.fn(),
        setWidth: vi.fn(),
      };

      const mockBrowser = createMockBrowser();
      mockBrowser.devtools.panels.create.mockResolvedValue(mockPanel);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const panel = await createDevToolsPanel(mockPanelOptions);

      panel.setHeight?.(400);
      expect(mockPanel.setHeight).toHaveBeenCalledWith(400);

      panel.setWidth?.(600);
      expect(mockPanel.setWidth).toHaveBeenCalledWith(600);
    });

    it('should handle Firefox panel without setHeight/setWidth methods', async () => {
      const mockPanel = {
        onShown: { addListener: vi.fn() },
        onHidden: { addListener: vi.fn() },
      };

      const mockBrowser = createMockBrowser();
      mockBrowser.devtools.panels.create.mockResolvedValue(mockPanel);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const panel = await createDevToolsPanel(mockPanelOptions);

      // Should not throw when calling setHeight/setWidth
      expect(() => panel.setHeight?.(400)).not.toThrow();
      expect(() => panel.setWidth?.(600)).not.toThrow();
    });
  });

  // =============================================================================
  // Extension API Polyfills Tests
  // =============================================================================
  describe('getRuntime', () => {
    it('should return browser.runtime for Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      expect(getRuntime()).toBe(mockBrowser.runtime);
    });

    it('should return chrome.runtime for Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(getRuntime()).toBe(mockChrome.runtime);
    });

    it('should throw error when runtime API is not available', () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(() => getRuntime()).toThrow('Runtime API not available');
    });

    it('should prioritize browser.runtime over chrome.runtime', () => {
      const mockBrowser = createMockBrowser();
      const mockChrome = createMockChrome();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = mockChrome as any;

      expect(getRuntime()).toBe(mockBrowser.runtime);
    });
  });

  describe('getStorage', () => {
    it('should return browser.storage for Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      expect(getStorage()).toBe(mockBrowser.storage);
    });

    it('should return chrome.storage for Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(getStorage()).toBe(mockChrome.storage);
    });

    it('should throw error when storage API is not available', () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(() => getStorage()).toThrow('Storage API not available');
    });
  });

  describe('getTabs', () => {
    it('should return browser.tabs for Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      expect(getTabs()).toBe(mockBrowser.tabs);
    });

    it('should return chrome.tabs for Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(getTabs()).toBe(mockChrome.tabs);
    });

    it('should throw error when tabs API is not available', () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(() => getTabs()).toThrow('Tabs API not available');
    });
  });

  describe('sendMessage', () => {
    it('should send message using browser.runtime.sendMessage for Firefox', async () => {
      const mockResponse = { success: true, data: 'test' };
      const mockBrowser = createMockBrowser();
      mockBrowser.runtime.sendMessage.mockResolvedValue(mockResponse);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const message = { type: 'TEST', payload: 'data' };
      const response = await sendMessage(message);

      expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledWith(message);
      expect(response).toEqual(mockResponse);
    });

    it('should send message using chrome.runtime.sendMessage for Chrome', async () => {
      const mockResponse = { success: true, data: 'test' };
      const mockChrome = createMockChrome();
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback(mockResponse);
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const message = { type: 'TEST', payload: 'data' };
      const response = await sendMessage(message);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
      expect(response).toEqual(mockResponse);
    });

    it('should reject when Chrome runtime has lastError', async () => {
      const errorMessage = 'Message send failed';
      const mockChrome = createMockChrome();
      mockChrome.runtime.lastError = { message: errorMessage };
      mockChrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback();
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const message = { type: 'TEST' };
      await expect(sendMessage(message)).rejects.toThrow(errorMessage);
    });

    it('should reject when browser is unknown', async () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const message = { type: 'TEST' };
      await expect(sendMessage(message)).rejects.toThrow('Message passing not available');
    });
  });

  describe('sendMessageToTab', () => {
    it('should send message to tab using browser.tabs.sendMessage for Firefox', async () => {
      const mockResponse = { success: true };
      const mockBrowser = createMockBrowser();
      mockBrowser.tabs.sendMessage.mockResolvedValue(mockResponse);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const message = { type: 'TEST' };
      const response = await sendMessageToTab(123, message);

      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(123, message);
      expect(response).toEqual(mockResponse);
    });

    it('should send message to tab using chrome.tabs.sendMessage for Chrome', async () => {
      const mockResponse = { success: true };
      const mockChrome = createMockChrome();
      mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
        callback(mockResponse);
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const message = { type: 'TEST' };
      const response = await sendMessageToTab(123, message);

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, message, expect.any(Function));
      expect(response).toEqual(mockResponse);
    });

    it('should reject when Chrome tabs has lastError', async () => {
      const errorMessage = 'Tab message failed';
      const mockChrome = createMockChrome();
      mockChrome.runtime.lastError = { message: errorMessage };
      mockChrome.tabs.sendMessage.mockImplementation((tabId, msg, callback) => {
        callback();
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const message = { type: 'TEST' };
      await expect(sendMessageToTab(123, message)).rejects.toThrow(errorMessage);
    });

    it('should reject when browser is unknown', async () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const message = { type: 'TEST' };
      await expect(sendMessageToTab(123, message)).rejects.toThrow('Message passing not available');
    });
  });

  describe('onMessage', () => {
    const mockListener = vi.fn();

    it('should add listener using runtime.onMessage.addListener for Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      onMessage.addListener(mockListener);

      expect(mockBrowser.runtime.onMessage.addListener).toHaveBeenCalledWith(mockListener);
    });

    it('should add listener using runtime.onMessage.addListener for Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      onMessage.addListener(mockListener);

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockListener);
    });

    it('should remove listener using runtime.onMessage.removeListener for Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      onMessage.removeListener(mockListener);

      expect(mockBrowser.runtime.onMessage.removeListener).toHaveBeenCalledWith(mockListener);
    });

    it('should remove listener using runtime.onMessage.removeListener for Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      onMessage.removeListener(mockListener);

      expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(mockListener);
    });

    it('should check if listener is registered using runtime.onMessage.hasListener for Firefox', () => {
      const mockBrowser = createMockBrowser();
      mockBrowser.runtime.onMessage.hasListener.mockReturnValue(true);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const result = onMessage.hasListener(mockListener);

      expect(mockBrowser.runtime.onMessage.hasListener).toHaveBeenCalledWith(mockListener);
      expect(result).toBe(true);
    });

    it('should check if listener is registered using runtime.onMessage.hasListener for Chrome', () => {
      const mockChrome = createMockChrome();
      mockChrome.runtime.onMessage.hasListener.mockReturnValue(false);

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const result = onMessage.hasListener(mockListener);

      expect(mockChrome.runtime.onMessage.hasListener).toHaveBeenCalledWith(mockListener);
      expect(result).toBe(false);
    });
  });

  // =============================================================================
  // Manifest Adaptation Tests
  // =============================================================================
  describe('getManifestVersion', () => {
    it('should return 2 for Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      expect(getManifestVersion()).toBe(2);
    });

    it('should return 3 for Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(getManifestVersion()).toBe(3);
    });

    it('should return 3 as default for unknown browser', () => {
      global.chrome = undefined as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(getManifestVersion()).toBe(3);
    });
  });

  describe('isManifestVersion', () => {
    it('should return true when version matches for Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      expect(isManifestVersion(2)).toBe(true);
      expect(isManifestVersion(3)).toBe(false);
    });

    it('should return true when version matches for Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      expect(isManifestVersion(3)).toBe(true);
      expect(isManifestVersion(2)).toBe(false);
    });
  });

  describe('getManifestConfig', () => {
    it('should return V2 config for Firefox', () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const config = getManifestConfig();

      expect(config.version).toBe(2);
      expect(config.backgroundScriptKey).toBe('background');
      expect(config.serviceWorkerKey).toBe('scripts');
      expect(config.permissionsKey).toBe('permissions');
    });

    it('should return V3 config for Chrome', () => {
      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const config = getManifestConfig();

      expect(config.version).toBe(3);
      expect(config.backgroundScriptKey).toBe('background');
      expect(config.serviceWorkerKey).toBe('service_worker');
      expect(config.permissionsKey).toBe('permissions');
    });
  });

  // =============================================================================
  // Utility Functions Tests
  // =============================================================================
  describe('promisifyChrome', () => {
    it('should wrap callback API in a Promise and resolve on success', async () => {
      const mockResult = { data: 'test' };
      const mockChromeMethod = vi.fn((callback) => {
        callback(mockResult);
      });

      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;

      const promise = promisifyChrome(mockChromeMethod);
      const result = await promise;

      expect(result).toEqual(mockResult);
    });

    it('should reject when chrome.runtime.lastError exists', async () => {
      const errorMessage = 'Operation failed';
      const mockChromeMethod = vi.fn((callback) => {
        (global.chrome as any).runtime.lastError = { message: errorMessage };
        callback();
      });

      const mockChrome = createMockChrome();
      global.chrome = mockChrome as any;

      const promise = promisifyChrome(mockChromeMethod);
      await expect(promise).rejects.toThrow(errorMessage);
    });
  });

  describe('createStoragePromise', () => {
    it('should perform get operation for Firefox', async () => {
      const mockData = { key: 'value' };
      const mockBrowser = createMockBrowser();
      mockBrowser.storage.local.get.mockResolvedValue(mockData);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const result = await createStoragePromise('local', 'get', 'key');

      expect(mockBrowser.storage.local.get).toHaveBeenCalledWith('key');
      expect(result).toEqual(mockData);
    });

    it('should perform set operation for Firefox', async () => {
      const mockBrowser = createMockBrowser();
      mockBrowser.storage.local.set.mockResolvedValue(undefined);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const result = await createStoragePromise('local', 'set', { key: 'value' });

      expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({ key: 'value' });
      expect(result).toBe(true);
    });

    it('should perform remove operation for Firefox', async () => {
      const mockBrowser = createMockBrowser();
      mockBrowser.storage.local.remove.mockResolvedValue(undefined);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const result = await createStoragePromise('local', 'remove', 'key');

      expect(mockBrowser.storage.local.remove).toHaveBeenCalledWith('key');
      expect(result).toBe(true);
    });

    it('should perform clear operation for Firefox', async () => {
      const mockBrowser = createMockBrowser();
      mockBrowser.storage.local.clear.mockResolvedValue(undefined);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const result = await createStoragePromise('local', 'clear');

      expect(mockBrowser.storage.local.clear).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should perform get operation for Chrome', async () => {
      const mockData = { key: 'value' };
      const mockChrome = createMockChrome();
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(mockData);
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const result = await createStoragePromise('local', 'get', 'key');

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith('key', expect.any(Function));
      expect(result).toEqual(mockData);
    });

    it('should perform set operation for Chrome', async () => {
      const mockChrome = createMockChrome();
      mockChrome.storage.local.set.mockImplementation((items, callback) => {
        callback();
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const result = await createStoragePromise('local', 'set', { key: 'value' });

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ key: 'value' }, expect.any(Function));
      expect(result).toBe(true);
    });

    it('should reject on Chrome storage error', async () => {
      const errorMessage = 'Storage error';
      const mockChrome = createMockChrome();
      mockChrome.runtime.lastError = { message: errorMessage };
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback();
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      await expect(createStoragePromise('local', 'get', 'key')).rejects.toThrow(errorMessage);
    });

    it('should reject for unknown operation', async () => {
      const mockBrowser = createMockBrowser();
      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      await expect(createStoragePromise('local', 'invalid' as any, 'key')).rejects.toThrow(
        'Unknown operation: invalid'
      );
    });

    it('should support sync storage area for Firefox', async () => {
      const mockData = { key: 'value' };
      const mockBrowser = createMockBrowser();
      mockBrowser.storage.sync.get.mockResolvedValue(mockData);

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      await createStoragePromise('sync', 'get', 'key');

      expect(mockBrowser.storage.sync.get).toHaveBeenCalledWith('key');
    });

    it('should support managed storage area for Chrome', async () => {
      const mockChrome = createMockChrome();
      mockChrome.storage.managed.get.mockImplementation((keys, callback) => {
        callback({});
      });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      await createStoragePromise('managed', 'get', 'key');

      expect(mockChrome.storage.managed.get).toHaveBeenCalledWith('key', expect.any(Function));
    });
  });

  describe('getExtensionInfo', () => {
    it('should return extension info for Firefox', () => {
      const mockBrowser = createMockBrowser();
      mockBrowser.runtime.getManifest.mockReturnValue({ version: '2.5.0', name: 'Test Extension' });

      (global as typeof globalThis & { browser: typeof global.browser }).browser = mockBrowser as any;
      global.chrome = undefined as any;

      const info = getExtensionInfo();

      expect(info.browser).toBe('firefox');
      expect(info.manifestVersion).toBe(2);
      expect(info.extensionId).toBe('firefox-extension-id');
      expect(info.extensionVersion).toBe('2.5.0');
    });

    it('should return extension info for Chrome', () => {
      const mockChrome = createMockChrome();
      mockChrome.runtime.getManifest.mockReturnValue({ version: '3.1.0', name: 'Test Extension' });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const info = getExtensionInfo();

      expect(info.browser).toBe('chrome');
      expect(info.manifestVersion).toBe(3);
      expect(info.extensionId).toBe('chrome-extension-id');
      expect(info.extensionVersion).toBe('3.1.0');
    });

    it('should handle missing runtime id', () => {
      const mockChrome = createMockChrome();
      mockChrome.runtime.id = undefined;
      mockChrome.runtime.getManifest.mockReturnValue({ version: '1.0.0' });

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const info = getExtensionInfo();

      expect(info.extensionId).toBe('unknown');
    });

    it('should handle missing manifest version', () => {
      const mockChrome = createMockChrome();
      mockChrome.runtime.getManifest.mockReturnValue({});

      global.chrome = mockChrome as any;
      (global as typeof globalThis & { browser?: typeof global.browser }).browser = undefined;

      const info = getExtensionInfo();

      expect(info.extensionVersion).toBe('0.0.0');
    });
  });
});
