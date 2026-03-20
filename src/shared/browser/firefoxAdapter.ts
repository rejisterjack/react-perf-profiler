/**
 * Firefox DevTools API Adapter
 *
 * Provides a unified interface for Chrome and Firefox browser extension APIs.
 * Handles the differences between:
 * - Chrome: chrome.* namespace with callbacks
 * - Firefox: browser.* namespace with Promises
 */

// =============================================================================
// Browser Detection
// =============================================================================

export type BrowserType = 'chrome' | 'firefox' | 'unknown';

/**
 * Detects the current browser type based on available APIs
 */
export function detectBrowser(): BrowserType {
  if (browser?.devtools) {
    return 'firefox';
  }
  if (typeof chrome !== 'undefined' && chrome.devtools) {
    return 'chrome';
  }
  return 'unknown';
}

/**
 * Checks if the current browser is Firefox
 */
export function isFirefox(): boolean {
  return detectBrowser() === 'firefox';
}

/**
 * Checks if the current browser is Chrome
 */
export function isChrome(): boolean {
  return detectBrowser() === 'chrome';
}

// =============================================================================
// DevTools API Abstraction
// =============================================================================

export interface DevToolsPanel {
  /** Unique identifier for the panel */
  id: string;
  /** Panel title */
  title: string;
  /** Icon URL (optional) */
  iconPath?: string;
  /** Panel page URL */
  pagePath: string;
  /** Show the panel */
  show(): void;
  /** Hide the panel */
  hide(): void;
  /** Set panel height (Firefox only) */
  setHeight?(height: number): void;
  /** Set panel width (Firefox only) */
  setWidth?(width: number): void;
  /** Register a callback for when the panel is shown */
  onShown(callback: () => void): void;
  /** Register a callback for when the panel is hidden */
  onHidden(callback: () => void): void;
}

export interface CreatePanelOptions {
  /** Panel title */
  title: string;
  /** Icon URL (optional) */
  iconPath?: string;
  /** Panel page URL */
  pagePath: string;
  /** Initial panel ID */
  id?: string;
}

/**
 * Creates a DevTools panel with browser-specific API handling
 */
export function createDevToolsPanel(options: CreatePanelOptions): Promise<DevToolsPanel> {
  const browserType = detectBrowser();
  const { title, iconPath, pagePath, id = 'react-perf-profiler' } = options;

  if (browserType === 'firefox') {
    return createFirefoxPanel(id, title, iconPath, pagePath);
  }

  if (browserType === 'chrome') {
    return createChromePanel(id, title, iconPath, pagePath);
  }

  return Promise.reject(new Error('Unsupported browser: DevTools API not available'));
}

/**
 * Creates a panel for Firefox using browser.devtools API
 */
function createFirefoxPanel(
  id: string,
  title: string,
  iconPath: string | undefined,
  pagePath: string
): Promise<DevToolsPanel> {
  // Firefox uses browser.devtools.panels.create with Promise
  const createPromise = browser!.devtools.panels.create(title, iconPath || '', pagePath);

  return createPromise.then((panel) => {
    const shownCallbacks: Array<() => void> = [];
    const hiddenCallbacks: Array<() => void> = [];

    // Firefox uses onShown/onHidden with addListener
    panel.onShown.addListener(() => {
      shownCallbacks.forEach((cb) => {
        cb();
      });
    });

    panel.onHidden.addListener(() => {
      hiddenCallbacks.forEach((cb) => {
        cb();
      });
    });

    return {
      id,
      title,
      iconPath,
      pagePath,
      show: () => {
        // Firefox doesn't have a direct show method, panel is shown by user
        console.warn('Panel show is not directly supported in Firefox DevTools API');
      },
      hide: () => {
        // Firefox doesn't have a direct hide method
        console.warn('Panel hide is not directly supported in Firefox DevTools API');
      },
      setHeight: (height: number) => {
        // Firefox-specific: may not be available in all versions
        if ('setHeight' in panel) {
          (panel as unknown as { setHeight(h: number): void }).setHeight(height);
        }
      },
      setWidth: (width: number) => {
        // Firefox-specific: may not be available in all versions
        if ('setWidth' in panel) {
          (panel as unknown as { setWidth(w: number): void }).setWidth(width);
        }
      },
      onShown: (callback: () => void) => {
        shownCallbacks.push(callback);
      },
      onHidden: (callback: () => void) => {
        hiddenCallbacks.push(callback);
      },
    };
  });
}

/**
 * Creates a panel for Chrome using chrome.devtools API
 */
function createChromePanel(
  id: string,
  title: string,
  iconPath: string | undefined,
  pagePath: string
): Promise<DevToolsPanel> {
  return new Promise((resolve, reject) => {
    // Chrome uses chrome.devtools.panels.create with callback
    chrome.devtools.panels.create(title, iconPath || '', pagePath, (panel) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const shownCallbacks: Array<() => void> = [];
      const hiddenCallbacks: Array<() => void> = [];

      // Chrome uses onShown/onHidden with addListener
      panel.onShown.addListener(() => {
        shownCallbacks.forEach((cb) => {
          cb();
        });
      });

      panel.onHidden.addListener(() => {
        hiddenCallbacks.forEach((cb) => {
          cb();
        });
      });

      resolve({
        id,
        title,
        iconPath,
        pagePath,
        show: () => {
          // Chrome doesn't have a direct show method
          console.warn('Panel show is not directly supported in Chrome DevTools API');
        },
        hide: () => {
          // Chrome doesn't have a direct hide method
          console.warn('Panel hide is not directly supported in Chrome DevTools API');
        },
        onShown: (callback: () => void) => {
          shownCallbacks.push(callback);
        },
        onHidden: (callback: () => void) => {
          hiddenCallbacks.push(callback);
        },
      });
    });
  });
}

// =============================================================================
// Extension API Polyfills
// =============================================================================

// Firefox-specific type extensions
interface FirefoxDevToolsPanel extends chrome.devtools.panels.ExtensionPanel {
  /** Firefox may have additional panel methods */
  setHeight?(height: number): void;
  setWidth?(width: number): void;
}

interface FirefoxDevToolsPanelsAPI {
  /** Firefox returns a Promise from create() */
  create(title: string, iconPath: string, pagePath: string): Promise<FirefoxDevToolsPanel>;
  [key: string]: unknown;
}

interface FirefoxStorageArea {
  /** Firefox uses Promise-based API */
  get<T = unknown>(keys?: string | string[] | Record<string, T> | null): Promise<T>;
  set<T>(items: Record<string, T>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
  getBytesInUse?(keys?: string | string[] | null): Promise<number>;
}

type FirefoxStorageAPI = {
  local: FirefoxStorageArea;
  sync: FirefoxStorageArea;
  managed: FirefoxStorageArea;
} & typeof chrome.storage;

interface FirefoxDevToolsAPI {
  panels: FirefoxDevToolsPanelsAPI;
  inspectedWindow: typeof chrome.devtools.inspectedWindow;
  network: typeof chrome.devtools.network;
}

/** Firefox WebExtension API namespace (Promise-based) */
interface FirefoxAPI {
  devtools: FirefoxDevToolsAPI;
  runtime: typeof chrome.runtime;
  storage: FirefoxStorageAPI;
  tabs: typeof chrome.tabs;
}

declare global {
  /** Firefox WebExtension API namespace (Promise-based) */
  const browser: FirefoxAPI | undefined;

  interface Window {
    browser?: FirefoxAPI;
  }
}

/**
 * Gets the runtime API with unified interface
 * Firefox: browser.runtime (Promise-based)
 * Chrome: chrome.runtime (callback-based)
 */
export function getRuntime(): typeof chrome.runtime {
  if (browser?.runtime) {
    return browser.runtime;
  }
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome.runtime;
  }
  throw new Error('Runtime API not available');
}

/**
 * Gets the storage API with unified interface
 * Firefox: browser.storage (Promise-based)
 * Chrome: chrome.storage (callback-based)
 */
export function getStorage(): typeof chrome.storage {
  if (browser?.storage) {
    return browser.storage;
  }
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome.storage;
  }
  throw new Error('Storage API not available');
}

/**
 * Gets the tabs API with unified interface
 * Firefox: browser.tabs (Promise-based)
 * Chrome: chrome.tabs (callback-based)
 */
export function getTabs(): typeof chrome.tabs {
  if (browser?.tabs) {
    return browser.tabs;
  }
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    return chrome.tabs;
  }
  throw new Error('Tabs API not available');
}

// =============================================================================
// Message Passing
// =============================================================================

export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: MessageResponse) => void
) => boolean | undefined | Promise<MessageResponse>;

/**
 * Sends a message with unified Promise-based interface
 * Handles both Firefox (Promises) and Chrome (callbacks)
 */
export function sendMessage<T = unknown>(message: unknown): Promise<T> {
  const browserType = detectBrowser();

  if (browserType === 'firefox' && browser) {
    // Firefox uses Promise-based API
    return browser.runtime.sendMessage(message) as Promise<T>;
  }

  if (browserType === 'chrome') {
    // Chrome uses callback-based API, wrap in Promise
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response as T);
        }
      });
    });
  }

  return Promise.reject(new Error('Message passing not available'));
}

/**
 * Sends a message to a specific tab
 */
export function sendMessageToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
  const browserType = detectBrowser();

  if (browserType === 'firefox' && browser) {
    return browser.tabs.sendMessage(tabId, message) as Promise<T>;
  }

  if (browserType === 'chrome') {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response as T);
        }
      });
    });
  }

  return Promise.reject(new Error('Message passing not available'));
}

/**
 * Unified onMessage listener
 * Handles both Firefox and Chrome event systems
 */
export const onMessage = {
  /**
   * Adds a message listener
   */
  addListener(callback: MessageListener): void {
    const runtime = getRuntime();
    runtime.onMessage.addListener(callback);
  },

  /**
   * Removes a message listener
   */
  removeListener(callback: MessageListener): void {
    const runtime = getRuntime();
    runtime.onMessage.removeListener(callback);
  },

  /**
   * Checks if a listener is registered
   */
  hasListener(callback: MessageListener): boolean {
    const runtime = getRuntime();
    return runtime.onMessage.hasListener(callback);
  },
};

// =============================================================================
// Manifest Adaptation
// =============================================================================

export type ManifestVersion = 2 | 3;

/**
 * Gets the appropriate manifest version for the current browser
 * Firefox: Typically uses Manifest V2 for DevTools extensions
 * Chrome: Uses Manifest V3
 */
export function getManifestVersion(): ManifestVersion {
  const browserType = detectBrowser();

  if (browserType === 'firefox') {
    // Firefox still widely uses V2 for DevTools extensions
    // though V3 support is being added
    return 2;
  }

  if (browserType === 'chrome') {
    // Chrome primarily uses V3 now
    return 3;
  }

  // Default to V3 as it's the modern standard
  return 3;
}

/**
 * Checks if the current manifest version matches the expected version
 */
export function isManifestVersion(version: ManifestVersion): boolean {
  return getManifestVersion() === version;
}

/**
 * Gets manifest-specific configuration
 */
export function getManifestConfig(): {
  version: ManifestVersion;
  backgroundScriptKey: string;
  serviceWorkerKey: string;
  permissionsKey: string;
} {
  const version = getManifestVersion();

  if (version === 2) {
    return {
      version,
      backgroundScriptKey: 'background',
      serviceWorkerKey: 'scripts', // V2 uses 'scripts' array
      permissionsKey: 'permissions',
    };
  }

  return {
    version,
    backgroundScriptKey: 'background',
    serviceWorkerKey: 'service_worker', // V3 uses 'service_worker'
    permissionsKey: 'permissions',
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Wraps a Chrome-style callback API into a Promise
 * Useful for normalizing Chrome callbacks to Promise-based APIs
 */
export function promisifyChrome<T>(
  chromeMethod: (callback: (result: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    chromeMethod((result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Creates a Promise-based wrapper for storage operations
 */
export function createStoragePromise<T>(
  storageArea: 'local' | 'sync' | 'managed',
  operation: 'get' | 'set' | 'remove' | 'clear',
  keysOrItems?: string | string[] | Record<string, T>
): Promise<T | boolean> {
  const storage = getStorage();
  const area = storage[storageArea];

  if (isFirefox()) {
    // Firefox uses Promise-based API
    switch (operation) {
      case 'get':
        return area.get(keysOrItems as string | string[]) as Promise<T>;
      case 'set':
        return area.set(keysOrItems as Record<string, T>).then(() => true);
      case 'remove':
        return area.remove(keysOrItems as string | string[]).then(() => true);
      case 'clear':
        return area.clear().then(() => true);
      default:
        return Promise.reject(new Error(`Unknown operation: ${operation}`));
    }
  }

  // Chrome uses callback-based API
  return new Promise((resolve, reject) => {
    const callback = () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve((operation === 'get' ? undefined : true) as boolean);
      }
    };

    switch (operation) {
      case 'get':
        area.get(keysOrItems as string | string[], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result as T);
          }
        });
        break;
      case 'set':
        area.set(keysOrItems as Record<string, T>, callback);
        break;
      case 'remove':
        area.remove(keysOrItems as string | string[], callback);
        break;
      case 'clear':
        area.clear(callback);
        break;
    }
  });
}

/**
 * Gets extension info with browser-specific details
 */
export function getExtensionInfo(): {
  browser: BrowserType;
  manifestVersion: ManifestVersion;
  extensionId: string;
  extensionVersion: string;
} {
  const runtime = getRuntime();
  const manifest = runtime.getManifest();

  return {
    browser: detectBrowser(),
    manifestVersion: getManifestVersion(),
    extensionId: runtime.id || 'unknown',
    extensionVersion: manifest.version || '0.0.0',
  };
}
