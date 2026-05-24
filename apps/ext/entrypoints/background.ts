/**
 * Background Service Worker
 * Manages connections, routes messages, and maintains profiling sessions.
 */

import { PortNameEnum } from '@/src/shared/constants';
import { backgroundLogger as log } from '@/src/shared/logger';

// Types
type PortType = 'content' | 'devtools' | 'popup' | 'panel';

interface TabConnection {
  content: chrome.runtime.Port | null;
  devtools: chrome.runtime.Port | null;
  popup: chrome.runtime.Port | null;
  panel: chrome.runtime.Port | null;
  isProfiling: boolean;
  sessionStartTime: number | null;
  commitCount: number;
  reactDetected: boolean;
}

const EXTENSION_VERSION = '1.0.0';
const tabReactDetected = new Map<number, boolean>();
const connections = new Map<number, TabConnection>();

// Auto-profile settings
const AUTO_PROFILE_STORAGE_KEY = 'perf-profiler-auto-profile';
interface AutoProfileConfig {
  enabled: boolean;
  urlPatterns: string[];
}
const defaultAutoProfileConfig: AutoProfileConfig = { enabled: false, urlPatterns: ['*'] };

async function getAutoProfileConfig(): Promise<AutoProfileConfig> {
  return new Promise((resolve) => {
    chrome.storage.local.get(AUTO_PROFILE_STORAGE_KEY, (result) => {
      resolve((result[AUTO_PROFILE_STORAGE_KEY] as AutoProfileConfig) ?? defaultAutoProfileConfig);
    });
  });
}

function shouldAutoProfile(url: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === '*') return true;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    if (regex.test(url)) return true;
  }
  return false;
}

const ICON_ACTIVE = { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' };
const ICON_INACTIVE = { 16: 'icon/16-gray.png', 32: 'icon/32-gray.png', 48: 'icon/48-gray.png', 128: 'icon/128-gray.png' };

const KEEPALIVE_ALARM = 'perf-profiler-keepalive';
const KEEPALIVE_PERIOD_MINUTES = 0.5;
const STATE_STORAGE_KEY = 'perf-profiler-sw-state';

// =============================================================================
// Connection Management
// =============================================================================

function getOrCreateConnection(tabId: number): TabConnection {
  if (!connections.has(tabId)) {
    connections.set(tabId, { content: null, devtools: null, popup: null, panel: null, isProfiling: false, sessionStartTime: null, commitCount: 0, reactDetected: false });
  }
  return connections.get(tabId)!;
}

function getPortTypeFromName(portName: string): PortType | null {
  if (portName === PortNameEnum.CONTENT_BACKGROUND || portName.startsWith('content-background')) return 'content';
  if (portName === PortNameEnum.DEVTOOLS_BACKGROUND || portName.startsWith('devtools-background')) return 'devtools';
  if (portName === PortNameEnum.POPUP_BACKGROUND || portName.startsWith('popup-background')) return 'popup';
  if (portName === PortNameEnum.PANEL_BACKGROUND || portName.startsWith('react-perf-profiler-panel')) return 'panel';
  return null;
}

function getTabIdFromPort(port: chrome.runtime.Port): number | null {
  if (port.sender?.tab?.id !== undefined) return port.sender.tab.id;
  // Extract tab ID from port name suffix (e.g., 'react-perf-profiler-panel-42' → 42)
  const parts = port.name.split('-');
  const lastPart = parts[parts.length - 1]!;
  const parsed = Number.parseInt(lastPart, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function cleanupConnection(tabId: number): void {
  connections.delete(tabId);
  tabReactDetected.delete(tabId);
}

// =============================================================================
// Message Routing
// =============================================================================

function broadcastToAllPorts(tabId: number, message: Record<string, unknown>): void {
  const conn = connections.get(tabId);
  if (!conn) return;
  for (const port of [conn.devtools, conn.panel, conn.popup]) {
    if (port) { try { port.postMessage(message); } catch { /* ignore */ } }
  }
}

function forwardToDevTools(tabId: number, message: Record<string, unknown>): void {
  const conn = connections.get(tabId);
  if (!conn) return;
  const target = conn.panel || conn.devtools;
  if (target) { try { target.postMessage(message); } catch { /* ignore */ } }
}

function forwardToContent(tabId: number, message: Record<string, unknown>): void {
  const conn = connections.get(tabId);
  if (conn?.content) {
    try { conn.content.postMessage(message); return; } catch { /* fall through */ }
  }
  // Fallback: use chrome.tabs.sendMessage (works even without an established port)
  try {
    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) { /* tab may not have content script */ }
    });
  } catch { /* ignore */ }
}

// =============================================================================
// Icon Management
// =============================================================================

function updateActionIcon(detected: boolean, tabId?: number): void {
  const iconPaths = detected ? ICON_ACTIVE : ICON_INACTIVE;
  if (tabId !== undefined) {
    try { chrome.action.setIcon({ tabId, path: iconPaths }); } catch { /* ignore */ }
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const id = tabs[0]?.id;
      if (id !== undefined) { try { chrome.action.setIcon({ tabId: id, path: iconPaths }); } catch { /* ignore */ } }
    });
  }
}

function maybeUpdateIcon(tabId: number, message: Record<string, unknown>): void {
  const type = message.type;
  if (type === 'REACT_DETECT_RESULT' && message.payload && typeof message.payload === 'object') {
    const detected = !!(message.payload as Record<string, unknown>).reactDetected;
    tabReactDetected.set(tabId, detected);
    updateActionIcon(detected, tabId);
  } else if (type === 'BRIDGE_INIT' && message.payload && typeof message.payload === 'object') {
    const detected = (message.payload as Record<string, unknown>).reactDetected !== false;
    tabReactDetected.set(tabId, detected);
    updateActionIcon(detected, tabId);
  } else if (type === 'BRIDGE_ERROR') {
    const payload = message.payload as Record<string, unknown> | undefined;
    if (payload?.recoverable === false) { tabReactDetected.set(tabId, false); updateActionIcon(false, tabId); }
  }
}

// =============================================================================
// Port Message Handler
// =============================================================================

function handlePortMessage(tabId: number, portType: PortType, message: Record<string, unknown>): void {
  const conn = getOrCreateConnection(tabId);
  const type = message.type as string;

  if (portType === 'content') maybeUpdateIcon(tabId, message);

  switch (portType) {
    case 'content':
      // Content script → background → DevTools panel
      switch (type) {
        case 'COMMIT_DATA':
          conn.commitCount++;
          forwardToDevTools(tabId, message);
          break;
        case 'BRIDGE_INIT':
        case 'BRIDGE_STATUS':
        case 'BRIDGE_RETRY_SCHEDULED':
        case 'REACT_DETECT_RESULT':
        case 'PROFILING_STARTED':
        case 'PROFILING_STOPPED':
        case 'WEB_VITALS':
          forwardToDevTools(tabId, message);
          // Auto-profile: start when React is first detected
          if (type === 'BRIDGE_INIT') {
            const payload = message.payload as Record<string, unknown> | undefined;
            if (payload?.success && payload?.reactVersion) {
              getAutoProfileConfig().then((config) => {
                if (!config.enabled || conn.isProfiling) return;
                chrome.tabs.get(tabId, (tab) => {
                  if (chrome.runtime.lastError) return;
                  if (!shouldAutoProfile(tab.url ?? '', config.urlPatterns)) return;
                  forwardToContent(tabId, { type: 'START_PROFILING' });
                  conn.isProfiling = true;
                  conn.sessionStartTime = Date.now();
                  conn.commitCount = 0;
                  armKeepalive();
                  log.info('Auto-started profiling', { tabId, url: tab.url });
                });
              });
            }
          }
          break;
        case 'ERROR':
          log.error('Content script error', { tabId, error: message.error });
          forwardToDevTools(tabId, message);
          break;
        case 'COMPONENT_TREE_RESULT':
          forwardToDevTools(tabId, message);
          break;
        case 'PING':
          // Content ping — respond via port
          break;
        case 'PONG':
          forwardToDevTools(tabId, { type: 'CONNECTION_STATUS', payload: message.payload });
          break;
      }
      break;

    case 'panel':
    case 'devtools':
      // DevTools panel → background
      switch (type) {
        case 'START_PROFILING':
          conn.isProfiling = true;
          conn.sessionStartTime = Date.now();
          conn.commitCount = 0;
          armKeepalive();
          forwardToContent(tabId, message);
          break;
        case 'STOP_PROFILING':
          conn.isProfiling = false;
          forwardToContent(tabId, message);
          break;
        case 'DETECT_REACT':
        case 'FORCE_INIT':
        case 'GET_BRIDGE_STATUS':
          forwardToContent(tabId, message);
          break;
        case 'GET_COMPONENT_TREE':
          // Run component tree scan directly in MAIN world (bypasses bridge)
          (async () => {
            let sent = false;
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId },
                world: 'MAIN',
                func: () => {
                  const fibers: Array<{ id: string; displayName: string | null; key: string | null; tag: number; actualDuration: number; child: string | null; sibling: string | null; return: string | null }> = [];
                  const idMap = new WeakMap<object, string>();
                  let idCounter = 0;
                  const MAX = 5000;
                  const visited = new WeakSet<object>();

                  function getFiberId(f: unknown): string {
                    if (!f || typeof f !== 'object') return '';
                    if (idMap.has(f as object)) return idMap.get(f as object)!;
                    const id = `f-${++idCounter}`;
                    idMap.set(f as object, id);
                    return id;
                  }

                  function getDisplayName(o: Record<string, unknown>): string | null {
                    const tag = (o['tag'] as number) ?? -1;
                    const type = o['type'];
                    if (typeof type === 'function') return (type as { displayName?: string; name?: string }).displayName || (type as { name?: string }).name || 'Anonymous';
                    if (typeof type === 'string') return type;
                    if (typeof type === 'object' && type !== null) {
                      const t = type as Record<string, unknown>;
                      if (t['displayName']) return t['displayName'] as string;
                      if (t['name']) return t['name'] as string;
                      // memo / forwardRef
                      const inner = (t['type'] ?? t['render']) as { displayName?: string; name?: string } | undefined;
                      if (inner && typeof inner === 'function') return (inner.displayName || inner.name || null);
                    }
                    // Fall back to tag names
                    const tagNames: Record<number, string> = { 3: 'HostRoot', 4: 'Portal', 5: type as string, 6: '#text', 7: 'Fragment', 8: 'Mode', 9: 'Context.Consumer', 10: 'Context.Provider', 11: 'ForwardRef', 12: 'Profiler', 13: 'Suspense', 14: 'Memo', 15: 'SimpleMemo', 16: 'Lazy', 22: 'Offscreen' };
                    return tagNames[tag] ?? null;
                  }

                  function walkFiber(fiber: unknown): void {
                    if (!fiber || typeof fiber !== 'object' || visited.has(fiber as object) || fibers.length >= MAX) return;
                    visited.add(fiber as object);
                    const o = fiber as Record<string, unknown>;
                    const tag = (o['tag'] as number) ?? 0;
                    // Skip HostText (tag=6) — pure text nodes with no useful component info
                    if (tag !== 6) {
                      const id = getFiberId(fiber);
                      fibers.push({ id, displayName: getDisplayName(o), key: (o['key'] as string) ?? null, tag, actualDuration: (o['actualDuration'] as number) ?? 0, child: o['child'] ? getFiberId(o['child']) : null, sibling: o['sibling'] ? getFiberId(o['sibling']) : null, return: o['return'] ? getFiberId(o['return']) : null });
                    }
                    if (o['child']) walkFiber(o['child']);
                    if (o['sibling']) walkFiber(o['sibling']);
                  }

                  // Strategy 1: DevTools hook renderers (same as React DevTools)
                  const hook = (window as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ as { getFiberRoots?: (id: number) => Set<unknown>; renderers?: Map<number, unknown>; _fiberRoots?: Map<number, Set<unknown>> } | undefined;
                  if (hook?.getFiberRoots && hook.renderers) {
                    for (const [id] of hook.renderers) {
                      try { for (const root of hook.getFiberRoots(id)) { walkFiber((root as Record<string, unknown>)['current'] ?? root); } } catch { /* ignore */ }
                    }
                  }
                  if (fibers.length === 0 && hook?._fiberRoots) {
                    for (const [, roots] of hook._fiberRoots) {
                      for (const root of roots) { walkFiber((root as Record<string, unknown>)['current'] ?? root); }
                    }
                  }

                  // Strategy 2: DOM scan
                  if (fibers.length === 0) {
                    const body = document.body;
                    if (body) {
                      const FIBER_KEYS = ['__reactContainer$', '__reactFiber$'];
                      const scanned = new Set<unknown>();
                      const scanEl = (el: Element) => {
                        for (const prop of Object.getOwnPropertyNames(el)) {
                          for (const prefix of FIBER_KEYS) {
                            if (prop.startsWith(prefix)) {
                              const val = (el as Record<string, unknown>)[prop];
                              if (val && typeof val === 'object' && !scanned.has(val)) {
                                scanned.add(val);
                                const vo = val as Record<string, unknown>;
                                let root = val;
                                if (vo['stateNode'] && vo['current']) root = vo['current'];
                                else if (vo['current'] && typeof vo['current'] === 'object') root = vo['current'];
                                walkFiber(root);
                              }
                            }
                          }
                        }
                      };
                      scanEl(body);
                      const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
                      let count = 0;
                      while (walker.nextNode() && count++ < 500 && fibers.length < MAX) {
                        scanEl(walker.currentNode as Element);
                      }
                    }
                  }
                  return fibers;
                },
              });
              const tree = results?.[0]?.result ?? [];
              if (tree.length > 0) {
                forwardToDevTools(tabId, { type: 'COMPONENT_TREE_RESULT', payload: tree });
                sent = true;
              }
            } catch { /* scripting API failed — fall through to content script */ }
            // Always also request via content script / bridge (they may return richer data)
            if (!sent) {
              // Ask content script to get tree via bridge (MAIN world, richer fiber data)
              forwardToContent(tabId, { type: 'GET_COMPONENT_TREE' });
            }
          })();
          break;
        case 'PING':
          try { (message as { port?: chrome.runtime.Port }).port?.postMessage?.({ type: 'PONG', timestamp: Date.now() }); } catch { /* ignore */ }
          break;
        case 'CLEAR_DATA':
          conn.commitCount = 0;
          forwardToDevTools(tabId, { type: 'DATA_CLEARED' });
          break;
      }
      break;

    case 'popup':
      switch (type) {
        case 'CHECK_REACT':
          forwardToContent(tabId, { type: 'DETECT_REACT' });
          break;
        case 'GET_SESSIONS':
          break; // Handled via sendResponse
      }
      break;
  }
}

// =============================================================================
// Keepalive & State Persistence
// =============================================================================

function persistState(): void {
  const activeProfilingTabs = Array.from(connections.entries())
    .filter(([, conn]) => conn.isProfiling)
    .map(([tabId]) => tabId);

  if (activeProfilingTabs.length > 0) {
    chrome.storage.local.set({ [STATE_STORAGE_KEY]: { activeProfilingTabs, version: EXTENSION_VERSION } });
  } else {
    chrome.storage.local.remove(STATE_STORAGE_KEY);
  }
}

function armKeepalive(): void {
  if (!chrome.alarms) return;
  chrome.alarms.get(KEEPALIVE_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_PERIOD_MINUTES, delayInMinutes: KEEPALIVE_PERIOD_MINUTES });
    }
  });
}

function setupKeepAlive(): void {
  if (!chrome.alarms) return;
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_PERIOD_MINUTES, delayInMinutes: KEEPALIVE_PERIOD_MINUTES });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== KEEPALIVE_ALARM) return;
    const hasActive = Array.from(connections.values()).some((c) => c.isProfiling);
    if (hasActive) {
      chrome.runtime.getPlatformInfo(() => { /* no-op: extends SW lifetime */ });
      persistState();
    } else {
      chrome.alarms.clear(KEEPALIVE_ALARM);
      persistState();
    }
  });
}

// =============================================================================
// Tab Resolution Helper (for popup-origin messages)
// =============================================================================

function resolveTabId(sender: chrome.runtime.MessageSender): Promise<number | undefined> {
  if (sender.tab?.id !== undefined) return Promise.resolve(sender.tab.id);
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]?.id);
    });
  });
}

// =============================================================================
// Main Background Entry
// =============================================================================

export default defineBackground(() => {
  log.info('Initializing React Perf Profiler background service worker', { version: EXTENSION_VERSION });

  // Port connections
  chrome.runtime.onConnect.addListener((port) => {
    const portType = getPortTypeFromName(port.name);
    const tabId = getTabIdFromPort(port);

    if (!portType || tabId === null) {
      log.warn('Rejecting unknown connection', { portName: port.name });
      port.disconnect();
      return;
    }

    const conn = getOrCreateConnection(tabId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (conn as any)[portType] = port;

    log.info('Port connected', { portType, tabId });

    // When panel connects, auto-detect React and send status
    if (portType === 'panel') {
      (async () => {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () => {
              let detected = false;
              let version: string | undefined;
              if ((window as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                detected = true;
                const hook = (window as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ as Record<string, unknown>;
                const renderers = hook.renderers as Map<number, Record<string, unknown>> | undefined;
                if (renderers) renderers.forEach((r) => { if (r.version) version = r.version as string; });
              }
              if ((window as Record<string, unknown>).React) detected = true;
              if (!detected) {
                const body = document.body;
                if (body) {
                  const check = (el: Element) => Object.getOwnPropertyNames(el).some(p => p.startsWith('__react') && !p.startsWith('__REACT') || p.startsWith('_react'));
                  for (let i = 0; i < Math.min(body.children.length, 200); i++) {
                    if (check(body.children[i])) { detected = true; break; }
                  }
                }
              }
              return { detected, version };
            },
          });
          const result = results?.[0]?.result as { detected: boolean; version?: string } | undefined;
          if (result) {
            tabReactDetected.set(tabId, result.detected);
            conn.reactDetected = result.detected;
            updateActionIcon(result.detected, tabId);
            try {
              port.postMessage({ type: 'REACT_DETECT_RESULT', payload: { reactDetected: result.detected, devtoolsDetected: false, isInitialized: false, reactVersion: result.version } });
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      })();
    }

    port.onMessage.addListener((message) => {
      handlePortMessage(tabId, portType, message as Record<string, unknown>);
    });

    port.onDisconnect.addListener(() => {
      log.info('Port disconnected', { portType, tabId });
      const conn = connections.get(tabId);
      if (conn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (conn as any)[portType] = null;
        // If content script disconnected, clean up
        if (portType === 'content') cleanupConnection(tabId);
      }
    });
  });

  // One-time messages (all async-aware for popup-origin support)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (typeof message !== 'object' || message === null) return false;
    const msg = message as { type: string };

    // Synchronous handlers (no tab needed)
    if (msg.type === 'PING') {
      sendResponse({ type: 'PONG', version: EXTENSION_VERSION, timestamp: Date.now() });
      return true;
    }
    if (msg.type === 'GET_VERSION') {
      sendResponse({ version: EXTENSION_VERSION, timestamp: Date.now() });
      return true;
    }

    // All other handlers need tab resolution — wrap in async IIFE
    (async () => {
      try {
        switch (msg.type) {
          case 'CHECK_REACT': {
            const tabId = await resolveTabId(sender);
            if (tabId === undefined) { sendResponse({ hasReact: false }); return; }
            // Run detection directly in the page's MAIN world via scripting API
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId },
                world: 'MAIN',
                func: () => {
                  // Strategy 1: DevTools hook
                  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return { hasReact: true };
                  // Strategy 2: Global React
                  if ((window as Record<string, unknown>).React || (window as Record<string, unknown>).__REACT__) return { hasReact: true };
                  // Strategy 3: DOM scan for fiber properties
                  const body = document.body;
                  if (body) {
                    const checkEl = (el: Element): boolean => {
                      const props = Object.getOwnPropertyNames(el);
                      for (const p of props) {
                        if (p.startsWith('__reactFiber$') || p.startsWith('__reactContainer$') ||
                            p.startsWith('__reactProps$') || p.startsWith('__reactInternalInstance$') ||
                            p.startsWith('_reactRoot') || p.startsWith('_reactListeners')) return true;
                        if (p.startsWith('__react') && !p.startsWith('__REACT')) return true;
                        if (p.startsWith('_react')) return true;
                      }
                      return false;
                    };
                    const children = body.children;
                    for (let i = 0; i < Math.min(children.length, 200); i++) {
                      if (checkEl(children[i])) return { hasReact: true };
                    }
                    let count = 0;
                    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
                    while (walker.nextNode() && count < 2000) {
                      count++;
                      if (checkEl(walker.currentNode as Element)) return { hasReact: true };
                    }
                  }
                  return { hasReact: false };
                },
              });
              const result = results?.[0]?.result as { hasReact: boolean } | undefined;
              sendResponse(result ?? { hasReact: false });
            } catch {
              // Fallback: try content script
              chrome.tabs.sendMessage(tabId, { type: 'CHECK_REACT' }, (response) => {
                if (chrome.runtime.lastError || !response) {
                  const conn = connections.get(tabId);
                  sendResponse({ hasReact: conn?.reactDetected ?? tabReactDetected.get(tabId) ?? false });
                } else {
                  sendResponse(response);
                }
              });
            }
            break;
          }
          case 'START_PROFILING': {
            const tabId = await resolveTabId(sender);
            if (tabId === undefined) { sendResponse({ success: false }); return; }
            const conn = getOrCreateConnection(tabId);
            conn.isProfiling = true;
            conn.sessionStartTime = Date.now();
            conn.commitCount = 0;
            armKeepalive();
            forwardToContent(tabId, { type: 'START_PROFILING' });
            sendResponse({ success: true });
            break;
          }
          case 'STOP_PROFILING': {
            const tabId = await resolveTabId(sender);
            if (tabId === undefined) { sendResponse({ success: false }); return; }
            const conn = connections.get(tabId);
            if (conn) { conn.isProfiling = false; }
            forwardToContent(tabId, { type: 'STOP_PROFILING' });
            sendResponse({ success: true });
            break;
          }
          case 'GET_ACTIVE_SESSIONS': {
            const tabId = await resolveTabId(sender);
            if (tabId === undefined) { sendResponse({ sessions: [] }); return; }
            const conn = connections.get(tabId);
            const sessions = conn
              ? [{ tabId, isProfiling: conn.isProfiling, sessionStartTime: conn.sessionStartTime, commitCount: conn.commitCount, avgDuration: 0 }]
              : [];
            sendResponse({ sessions });
            break;
          }
          case 'DETECT_TECH_STACK': {
            const tabId = await resolveTabId(sender);
            if (tabId === undefined) { sendResponse(null); return; }
            // Run tech stack detection directly in MAIN world
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId },
                world: 'MAIN',
                func: () => {
                  const w = window as Record<string, unknown>;
                  // Detect React
                  let reactDetected = false;
                  let reactVersion: string | undefined;
                  if (w.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                    reactDetected = true;
                    const hook = w.__REACT_DEVTOOLS_GLOBAL_HOOK__ as Record<string, unknown>;
                    const renderers = hook.renderers as Map<number, Record<string, unknown>> | undefined;
                    if (renderers) renderers.forEach((r) => { if (r.version) reactVersion = r.version as string; });
                  }
                  if (w.React || w.__REACT__) reactDetected = true;
                  if (!reactDetected) {
                    const body = document.body;
                    if (body) {
                      const check = (el: Element) => Object.getOwnPropertyNames(el).some(p =>
                        p.startsWith('__react') && !p.startsWith('__REACT') || p.startsWith('_react'));
                      for (let i = 0; i < Math.min(body.children.length, 200); i++) {
                        if (check(body.children[i])) { reactDetected = true; break; }
                      }
                      if (!reactDetected) {
                        let c = 0;
                        const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
                        while (walker.nextNode() && c < 2000) { c++; if (check(walker.currentNode as Element)) { reactDetected = true; break; } }
                      }
                    }
                  }
                  // Frameworks
                  const frameworks: Array<{ name: string; version: string | undefined; confidence: string }> = [];
                  if (reactDetected) frameworks.push({ name: 'React', version: reactVersion, confidence: 'high' });
                  if (w.__VUE_DEVTOOLS_GLOBAL_HOOK__ || w.Vue) frameworks.push({ name: 'Vue.js', version: (w.Vue as Record<string, unknown>)?.version as string || undefined, confidence: 'high' });
                  const ngEl = document.querySelector('[ng-version]');
                  if (ngEl || document.querySelector('[ng-app]')) frameworks.push({ name: 'Angular', version: ngEl?.getAttribute('ng-version') || undefined, confidence: 'high' });
                  const svelteEl = document.querySelector('[class*="svelte-"]');
                  if (svelteEl || w.__SVELTE_HMR) frameworks.push({ name: 'Svelte', version: undefined, confidence: 'medium' });
                  if (w.__NEXT_DATA__) frameworks.push({ name: 'Next.js', version: undefined, confidence: 'high' });
                  if (w.__NUXT__ || w.$nuxt || document.getElementById('__nuxt')) frameworks.push({ name: 'Nuxt.js', version: undefined, confidence: 'high' });
                  if (w.___GATSBY) frameworks.push({ name: 'Gatsby', version: undefined, confidence: 'high' });
                  if (w.__remixContext) frameworks.push({ name: 'Remix', version: undefined, confidence: 'high' });
                  // CSS tools
                  const cssTools: Array<{ name: string; version: string | undefined; confidence: string }> = [];
                  if (w.__SC_VERSION__) cssTools.push({ name: 'styled-components', version: w.__SC_VERSION__ as string, confidence: 'high' });
                  if (w.__EMOTION_VERSION__) cssTools.push({ name: 'Emotion', version: w.__EMOTION_VERSION__ as string, confidence: 'high' });
                  // Build tools
                  const buildTools: string[] = [];
                  if (w.__webpack_require__) buildTools.push('webpack');
                  else { for (const k of Object.keys(w)) { if (k.startsWith('webpackChunk')) { buildTools.push('webpack'); break; } } }
                  // Colors
                  const colorSet = new Set<string>();
                  const rootStyle = getComputedStyle(document.documentElement);
                  for (let i = 0; i < rootStyle.length; i++) {
                    const v = rootStyle.getPropertyValue(rootStyle[i]).trim();
                    if (v && (v.startsWith('#') || v.startsWith('rgb'))) colorSet.add(v);
                  }
                  // Fonts
                  const fonts: Array<{ family: string; source: string }> = [];
                  if (document.fonts && document.fonts.forEach) document.fonts.forEach((f: FontFace) => fonts.push({ family: f.family, source: 'document-fonts-api' }));
                  // Meta
                  const meta = {
                    title: document.title || '',
                    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
                    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
                    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || undefined,
                    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined,
                    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || undefined,
                    ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || undefined,
                  };
                  return {
                    frameworks,
                    meta,
                    fonts,
                    colorPalette: Array.from(colorSet).slice(0, 12),
                    cssTools,
                    buildTools,
                    performance: {
                      domSize: document.querySelectorAll('*').length,
                      scriptCount: document.querySelectorAll('script').length,
                      stylesheetCount: document.querySelectorAll('link[rel="stylesheet"], style').length,
                      imageCount: document.querySelectorAll('img').length,
                    },
                  };
                },
              });
              sendResponse(results?.[0]?.result ?? null);
            } catch {
              // Fallback to content script
              chrome.tabs.sendMessage(tabId, { type: 'DETECT_TECH_STACK' }, (response) => {
                if (chrome.runtime.lastError) { sendResponse(null); return; }
                sendResponse(response);
              });
            }
            break;
          }
          case 'EXPORT_PROFILE': {
            const tabId = await resolveTabId(sender);
            if (tabId === undefined) { sendResponse(null); return; }
            const conn = connections.get(tabId);
            const target = conn?.panel || conn?.devtools;
            if (!target) { sendResponse(null); return; }
            const timeout = setTimeout(() => sendResponse(null), 3000);
            const listener = (m: Record<string, unknown>) => {
              if (m.type === 'EXPORT_PROFILE_DATA') {
                clearTimeout(timeout);
                chrome.runtime.onMessage.removeListener(listener);
                sendResponse(m.payload);
              }
            };
            chrome.runtime.onMessage.addListener(listener);
            try { target.postMessage({ type: 'EXPORT_PROFILE' }); } catch { clearTimeout(timeout); chrome.runtime.onMessage.removeListener(listener); sendResponse(null); }
            break;
          }
          default: {
            const tabId = sender.tab?.id;
            if (tabId !== undefined) {
              handlePortMessage(tabId, 'content', message as Record<string, unknown>);
              sendResponse({ success: true });
            }
          }
        }
      } catch {
        try { sendResponse(null); } catch { /* channel already closed */ }
      }
    })();

    return true; // Always keep channel open for async response
  });

  // Tab lifecycle
  chrome.tabs.onRemoved.addListener((tabId) => {
    log.info('Tab removed, cleaning up', { tabId });
    cleanupConnection(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      tabReactDetected.delete(tabId);
      updateActionIcon(false, tabId);
      const conn = connections.get(tabId);
      if (conn?.isProfiling) {
        conn.isProfiling = false;
        broadcastToAllPorts(tabId, { type: 'PROFILING_STOPPED', reason: 'navigation', timestamp: Date.now() });
      }
    }
  });

  chrome.tabs.onActivated.addListener((activeInfo) => {
    const detected = tabReactDetected.get(activeInfo.tabId) ?? false;
    updateActionIcon(detected, activeInfo.tabId);
  });

  // Extension lifecycle
  chrome.runtime.onInstalled.addListener((details) => {
    log.info('Extension installed/updated', { reason: details.reason, version: EXTENSION_VERSION });
  });

  // Error handlers
  self.addEventListener('error', (event) => {
    log.error('Unhandled error in background', { message: event.message, filename: event.filename });
  });
  self.addEventListener('unhandledrejection', (event) => {
    log.error('Unhandled promise rejection in background', { reason: String(event.reason) });
  });

  // Keepalive
  setupKeepAlive();

  // Restore state from previous SW lifecycle
  chrome.storage.local.get(STATE_STORAGE_KEY, (result) => {
    const state = result[STATE_STORAGE_KEY] as { activeProfilingTabs?: number[] } | undefined;
    if (state?.activeProfilingTabs?.length) {
      chrome.tabs.query({}, (tabs) => {
        const activeTabIds = new Set(tabs.map((t) => t.id));
        const surviving = state.activeProfilingTabs!.filter((id) => activeTabIds.has(id));
        if (surviving.length > 0) armKeepalive();
        persistState();
      });
    }
  });

  log.info('Background service worker ready');
});
