/**
 * Content Script (ISOLATED world)
 * Relays messages between the MAIN-world bridge and the background service worker.
 * Also performs direct React & tech stack detection from the ISOLATED world as fallback.
 */

import { isBridgeMessage, isBackgroundMessage } from '@/src/shared/messaging';

const CONTENT_SOURCE = 'react-perf-profiler-content';
const SESSION_TOKEN = crypto.getRandomValues(new Uint8Array(16)).reduce((acc: string, b: number) => acc + b.toString(16).padStart(2, '0'), '');

// State
let port: { postMessage: (msg: unknown) => void; disconnect: () => void; onMessage: { addListener: (fn: (msg: unknown) => void) => void }; onDisconnect: { addListener: (fn: () => void) => void } } | null = null;
let isBridgeReady = false;
let bridgeInitState: 'pending' | 'success' | 'failed' = 'pending';
let bridgeError: { type: string; message: string; recoverable: boolean } | null = null;
let bridgeRetryCount = 0;
let lastKnownReactDetected = false;
let lastKnownDevtoolsDetected = false;
const pendingMessages: unknown[] = [];

// Popup request handlers
let checkReactPopup: { timer: ReturnType<typeof setTimeout>; respond: (result: { hasReact: boolean }) => void } | null = null;
let pendingTechStackPopup: { timer: ReturnType<typeof setTimeout>; respond: (result: unknown) => void } | null = null;
let pendingComponentTreePopup: { timer: ReturnType<typeof setTimeout>; respond: (result: unknown) => void } | null = null;

// =============================================================================
// Direct Detection (ISOLATED world — scans DOM directly, no bridge needed)
// =============================================================================

/**
 * Direct React detection via MAIN world script injection.
 * ISOLATED world content scripts can't see expando properties set by page JS,
 * so we inject a small script that checks in the MAIN world and passes results back.
 */
let cachedReactDetection: { detected: boolean; version: string | undefined } | null = null;

function detectReactDirectly(): boolean {
  if (cachedReactDetection) return cachedReactDetection.detected;
  // Check legacy data attributes (these ARE visible from ISOLATED world)
  if (document.querySelector('[data-reactroot], [data-reactid]')) {
    cachedReactDetection = { detected: true, version: undefined };
    return true;
  }
  // Check known root containers for _reactRootContainer
  for (const id of ['root', 'app', '__next', '__nuxt']) {
    const el = document.getElementById(id);
    if (el && (el as Record<string, unknown>)._reactRootContainer) {
      cachedReactDetection = { detected: true, version: undefined };
      return true;
    }
  }
  return false;
}

function detectReactViaMainWorld(): Promise<{ detected: boolean; version: string | undefined }> {
  return new Promise((resolve) => {
    if (cachedReactDetection) { resolve(cachedReactDetection); return; }

    const callbackId = 'rpp-detect-' + Math.random().toString(36).slice(2);
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.callbackId === callbackId) {
        document.removeEventListener('rpp-detect-result', handler);
        cachedReactDetection = { detected: !!detail.detected, version: detail.version };
        resolve({ detected: !!detail.detected, version: detail.version });
      }
    };
    document.addEventListener('rpp-detect-result', handler);

    // Timeout fallback
    setTimeout(() => {
      document.removeEventListener('rpp-detect-result', handler);
      const result = detectReactDirectly();
      cachedReactDetection = { detected: result, version: undefined };
      resolve({ detected: result, version: undefined });
    }, 1000);

    // Inject detection script into MAIN world
    const script = document.createElement('script');
    script.textContent = `(function(){
      var cbId = ${JSON.stringify(callbackId)};
      var detected = false;
      var version = undefined;
      try {
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) detected = true;
        if (window.React || window.__REACT__) detected = true;
        if (!detected) {
          var body = document.body;
          if (body) {
            var checkEl = function(el) {
              var props = Object.getOwnPropertyNames(el);
              for (var i = 0; i < props.length; i++) {
                var p = props[i];
                if (p.indexOf('__reactFiber$')===0 || p.indexOf('__reactContainer$')===0 ||
                    p.indexOf('__reactProps$')===0 || p.indexOf('__reactInternalInstance$')===0 ||
                    p.indexOf('_reactRoot')===0 || p.indexOf('_reactListeners')===0) return true;
                if (p.indexOf('__react')===0 && p.indexOf('__REACT')!==0) return true;
                if (p.indexOf('_react')===0) return true;
              }
              return false;
            };
            var children = body.children;
            for (var i = 0; i < Math.min(children.length, 200); i++) {
              if (checkEl(children[i])) { detected = true; break; }
            }
            if (!detected) {
              var walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
              var count = 0;
              while (walker.nextNode() && count < 2000) {
                count++;
                if (checkEl(walker.currentNode)) { detected = true; break; }
              }
            }
          }
        }
        if (detected && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          var renderers = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers;
          if (renderers && renderers.size > 0) {
            renderers.forEach(function(r) { if (r.version) version = r.version; });
          }
        }
      } catch(e) {}
      document.dispatchEvent(new CustomEvent('rpp-detect-result', { detail: { callbackId: cbId, detected: detected, version: version } }));
    })();`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  });
}

function detectReactVersionDirectly(): string | undefined {
  return cachedReactDetection?.version;
}

interface FrameworkInfo {
  name: string;
  version: string | undefined;
  confidence: 'high' | 'medium' | 'low';
}

interface TechStackResult {
  frameworks: FrameworkInfo[];
  meta: {
    title: string;
    description: string;
    viewport: string;
    themeColor: string | undefined;
    ogImage: string | undefined;
    ogTitle: string | undefined;
    ogDescription: string | undefined;
  };
  fonts: Array<{ family: string; source: string }>;
  colorPalette: string[];
  cssTools: FrameworkInfo[];
  buildTools: string[];
  performance: {
    domSize: number;
    scriptCount: number;
    stylesheetCount: number;
    imageCount: number;
  };
}

function detectTechStackDirectly(): TechStackResult {
  return {
    frameworks: detectFrameworksDirectly(),
    meta: detectMetaDirectly(),
    fonts: detectFontsDirectly(),
    colorPalette: detectColorsDirectly(),
    cssTools: detectCSSToolsDirectly(),
    buildTools: detectBuildToolsDirectly(),
    performance: detectPerformanceDirectly(),
  };
}

function detectFrameworksDirectly(): FrameworkInfo[] {
  const results: FrameworkInfo[] = [];
  // React
  if (detectReactDirectly()) {
    results.push({ name: 'React', version: detectReactVersionDirectly(), confidence: 'high' });
  }
  // Angular
  const ngVersionEl = document.querySelector('[ng-version]');
  if (ngVersionEl || document.querySelector('[ng-app]')) {
    results.push({ name: 'Angular', version: ngVersionEl?.getAttribute('ng-version') || undefined, confidence: 'high' });
  }
  // Svelte
  const svelteEl = document.querySelector('[class*="svelte-"]');
  if (svelteEl) results.push({ name: 'Svelte', version: undefined, confidence: 'medium' });
  // Next.js
  if (document.querySelector('meta[name="next-head-count"]') || document.getElementById('__next')) {
    results.push({ name: 'Next.js', version: undefined, confidence: 'high' });
  }
  // Nuxt.js
  if (document.getElementById('__nuxt')) results.push({ name: 'Nuxt.js', version: undefined, confidence: 'high' });
  // Gatsby
  const gatsbyMeta = document.querySelector('meta[name="generator"][content*="Gatsby"]');
  if (gatsbyMeta) {
    const content = gatsbyMeta.getAttribute('content') || '';
    const v = content.match(/Gatsby\s*(\S+)/);
    results.push({ name: 'Gatsby', version: v?.[1], confidence: 'high' });
  }
  // Remix
  if (document.querySelector('meta[name="generator"][content*="Remix"]')) {
    results.push({ name: 'Remix', version: undefined, confidence: 'high' });
  }
  return results;
}

function detectMetaDirectly(): TechStackResult['meta'] {
  return {
    title: document.title || '',
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || undefined,
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined,
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || undefined,
    ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || undefined,
  };
}

function detectFontsDirectly(): Array<{ family: string; source: string }> {
  const fontMap = new Map<string, string>();
  if (document.fonts && document.fonts.forEach) {
    document.fonts.forEach((font: FontFace) => { fontMap.set(font.family, 'document-fonts-api'); });
  }
  for (const sel of ['body', 'h1', 'p', 'a']) {
    const el = document.querySelector(sel);
    if (el) {
      for (const f of getComputedStyle(el).fontFamily.split(',')) {
        const trimmed = f.trim().replace(/^["']|["']$/g, '');
        if (trimmed && !fontMap.has(trimmed)) fontMap.set(trimmed, 'computed-style');
      }
    }
  }
  return Array.from(fontMap.entries()).map(([family, source]) => ({ family, source }));
}

function rgbToHex(color: string): string | null {
  if (/^#([0-9a-fA-F]{3,8})$/.test(color)) return color;
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map(v => parseInt(v, 10).toString(16).padStart(2, '0')).join('');
  return null;
}

function detectColorsDirectly(): string[] {
  const colorSet = new Set<string>();
  const rootStyle = getComputedStyle(document.documentElement);
  for (let i = 0; i < rootStyle.length; i++) {
    const v = rootStyle.getPropertyValue(rootStyle[i]).trim();
    if (v && (v.startsWith('#') || v.startsWith('rgb'))) { const hex = rgbToHex(v); if (hex) colorSet.add(hex); }
  }
  if (document.body) {
    const bg = getComputedStyle(document.body).backgroundColor;
    if (bg) { const hex = rgbToHex(bg); if (hex && hex !== '#000000' && hex !== '#ffffff') colorSet.add(hex); }
  }
  return Array.from(colorSet).slice(0, 12);
}

function detectCSSToolsDirectly(): FrameworkInfo[] {
  const results: FrameworkInfo[] = [];
  const twPatterns = ['flex', 'bg-', 'text-', 'p-', 'm-', 'grid', 'rounded-'];
  const elements = document.body ? document.body.querySelectorAll('*') : [];
  const limit = Math.min(elements.length, 50);
  let twMatches = 0;
  for (let i = 0; i < limit; i++) {
    for (let j = 0; j < elements[i].classList.length; j++) {
      const cls = elements[i].classList[j];
      for (const p of twPatterns) {
        if (p.endsWith('-') ? cls.startsWith(p) : cls === p) { twMatches++; break; }
      }
    }
  }
  if (twMatches >= 5) results.push({ name: 'Tailwind CSS', version: undefined, confidence: 'high' });
  // Bootstrap
  const bsPatterns = ['container', 'row', 'col-', 'btn-'];
  let bsMatches = 0;
  for (let i = 0; i < limit; i++) {
    for (let j = 0; j < elements[i].classList.length; j++) {
      const cls = elements[i].classList[j];
      for (const p of bsPatterns) {
        if (p.endsWith('-') ? cls.startsWith(p) : cls === p) { bsMatches++; break; }
      }
    }
  }
  if (bsMatches >= 3) results.push({ name: 'Bootstrap', version: undefined, confidence: 'medium' });
  if (document.querySelector('style[data-styled]')) results.push({ name: 'styled-components', version: undefined, confidence: 'medium' });
  return results;
}

function detectBuildToolsDirectly(): string[] {
  const results: string[] = [];
  const scripts = document.querySelectorAll('script[type="module"]');
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i].getAttribute('src') || '';
    if (src.includes('/@vite/') || src.includes('/node_modules/.vite/')) { results.push('Vite'); break; }
  }
  return results;
}

function detectPerformanceDirectly(): TechStackResult['performance'] {
  return {
    domSize: document.querySelectorAll('*').length,
    scriptCount: document.querySelectorAll('script').length,
    stylesheetCount: document.querySelectorAll('link[rel="stylesheet"], style').length,
    imageCount: document.querySelectorAll('img').length,
  };
}

// =============================================================================
// Initialization
// =============================================================================

function init(): void {
  setupBridgeListener();
  handshakeBridge();
  connectToBackground();
  window.addEventListener('beforeunload', cleanup);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// =============================================================================
// Bridge Handshake
// =============================================================================

let handshakeAttempts = 0;
const MAX_HANDSHAKE_ATTEMPTS = 20;
const HANDSHAKE_INTERVAL_MS = 100;
let handshakeTimer: ReturnType<typeof setInterval> | null = null;

function handshakeBridge(): void {
  flushPendingIfNeeded();
  sendToBridge({ type: 'DETECT_REACT' });

  handshakeTimer = setInterval(() => {
    if (isBridgeReady || handshakeAttempts >= MAX_HANDSHAKE_ATTEMPTS) {
      if (handshakeTimer) { clearInterval(handshakeTimer); handshakeTimer = null; }
      if (!isBridgeReady) {
        bridgeInitState = 'failed';
        reportError('Bridge handshake timed out', { type: 'HANDSHAKE_TIMEOUT', recoverable: false });
      }
      return;
    }
    handshakeAttempts++;
    sendToBridge({ type: 'DETECT_REACT' });
  }, HANDSHAKE_INTERVAL_MS);
}

function flushPendingIfNeeded(): void {
  if (isBridgeReady && pendingMessages.length > 0) {
    while (pendingMessages.length > 0) { const msg = pendingMessages.shift(); sendToBridge(msg); }
  }
}

// =============================================================================
// Bridge Communication
// =============================================================================

function setupBridgeListener(): void {
  window.addEventListener('message', handleBridgeMessageEvent);
}

function handleBridgeMessageEvent(event: MessageEvent): void {
  if (event.source !== window) return;
  const message = event.data;
  if (!isBridgeMessage(message)) return;
  if (!message.payload) return;

  if (!isBridgeReady) {
    isBridgeReady = true;
    flushPendingIfNeeded();
    sendToBackground({ type: 'BRIDGE_INJECTED', payload: { url: window.location.href } });
  }

  const { type, data, error, errorType, recoverable, retryCount } = message.payload;

  if (type === 'INIT' && data && typeof data === 'object' && 'success' in (data as Record<string, unknown>)) {
    bridgeInitState = 'success';
    bridgeError = null;
    bridgeRetryCount = 0;
  }

  if (type === 'ERROR') {
    bridgeError = { type: errorType || 'UNKNOWN', message: error || 'Unknown error', recoverable: recoverable !== false };
    if (bridgeInitState === 'pending') bridgeInitState = 'failed';
    reportError(error || 'Bridge error', { type: errorType, recoverable, retryCount });
  }

  if (type === 'RETRY_SCHEDULED') {
    bridgeRetryCount = retryCount || 0;
    sendToBackground({ type: 'BRIDGE_RETRY_SCHEDULED', payload: { retryCount, maxRetries: message.payload.maxRetries, nextRetryIn: message.payload.nextRetryIn } });
  }

  switch (type) {
    case 'COMMIT': sendToBackground({ type: 'COMMIT_DATA', payload: data }); break;
    case 'COMMIT_BATCH': {
      const batch = data as Record<string, unknown>[];
      for (const commit of batch) {
        sendToBackground({ type: 'COMMIT_DATA', payload: commit });
      }
      break;
    }
    case 'INIT':
      if (typeof data === 'object' && data !== null) {
        if ('reactDetected' in (data as Record<string, unknown>)) lastKnownReactDetected = !!(data as Record<string, unknown>).reactDetected;
        if ('isInitialized' in (data as Record<string, unknown>)) bridgeInitState = (data as Record<string, unknown>).isInitialized ? 'success' : 'pending';
      }
      sendToBackground({ type: 'BRIDGE_INIT', payload: { ...(typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}), url: window.location.href, state: bridgeInitState } });
      break;
    case 'START': sendToBackground({ type: 'PROFILING_STARTED', payload: data }); break;
    case 'STOP': sendToBackground({ type: 'PROFILING_STOPPED', payload: data }); break;
    case 'DETECT_RESULT': {
      lastKnownReactDetected = !!message.payload.reactDetected;
      lastKnownDevtoolsDetected = !!message.payload.devtoolsDetected;
      if (checkReactPopup) { const { timer, respond } = checkReactPopup; checkReactPopup = null; clearTimeout(timer); respond({ hasReact: lastKnownReactDetected }); }
      sendToBackground({ type: 'REACT_DETECT_RESULT', payload: { reactDetected: lastKnownReactDetected, devtoolsDetected: lastKnownDevtoolsDetected, isInitialized: message.payload.isInitialized } });
      break;
    }
    case 'WEB_VITALS': sendToBackground({ type: 'WEB_VITALS', payload: data }); break;
    case 'TECH_STACK_RESULT': {
      sendToBackground({ type: 'TECH_STACK_RESULT', payload: data });
      if (pendingTechStackPopup) {
        const { timer, respond } = pendingTechStackPopup;
        pendingTechStackPopup = null;
        clearTimeout(timer);
        respond(data);
      }
      break;
    }
    case 'COMPONENT_TREE_RESULT': {
      sendToBackground({ type: 'COMPONENT_TREE_RESULT', payload: data });
      if (pendingComponentTreePopup) {
        const { timer, respond } = pendingComponentTreePopup;
        pendingComponentTreePopup = null;
        clearTimeout(timer);
        respond(data);
      }
      break;
    }
  }
}

function sendToBridge(payload: unknown): void {
  const message = { source: CONTENT_SOURCE, token: SESSION_TOKEN, payload };
  if (!isBridgeReady) { pendingMessages.push(payload); return; }
  const targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;
  window.postMessage(message, targetOrigin);
}

// =============================================================================
// Background Communication
// =============================================================================

function connectToBackground(): void {
  try {
    port = chrome.runtime.connect({ name: 'content-background' });

    port.onMessage.addListener((msg: unknown) => {
      if (!isBackgroundMessage(msg)) return;
      const message = msg as Record<string, unknown>;

      switch (message.type) {
        case 'START_PROFILING': sendToBridge({ type: 'START' }); break;
        case 'STOP_PROFILING': sendToBridge({ type: 'STOP' }); break;
        case 'PING':
          sendToBackground({ type: 'PONG', payload: { active: true, bridgeState: bridgeInitState, bridgeError } });
          break;
        case 'DETECT_REACT': sendToBridge({ type: 'DETECT_REACT' }); break;
        case 'GET_COMPONENT_TREE': sendToBridge({ type: 'GET_COMPONENT_TREE' }); break;
        case 'FORCE_INIT': bridgeInitState = 'pending'; bridgeError = null; sendToBridge({ type: 'FORCE_INIT' }); break;
        case 'GET_BRIDGE_STATUS':
          sendToBridge({ type: 'DETECT_REACT' });
          sendToBackground({ type: 'BRIDGE_STATUS', payload: { state: bridgeInitState, error: bridgeError, retryCount: bridgeRetryCount, isInjected: isBridgeReady, reactDetected: lastKnownReactDetected, devtoolsDetected: lastKnownDevtoolsDetected } });
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      port = null;
      sendToBridge({ type: 'BACKGROUND_DISCONNECTED' });
      setTimeout(() => { if (!port) connectToBackground(); }, 1000);
    });

    sendToBackground({ type: 'PING', payload: { url: window.location.href } });
  } catch { /* ignore */ }
}

function sendToBackground(message: Record<string, unknown>): void {
  if (!port) return;
  try { port.postMessage(message); } catch { /* ignore */ }
}

function reportError(error: string, context?: { type?: string; details?: string; recoverable?: boolean; retryCount?: number }): void {
  sendToBackground({ type: 'ERROR', error, payload: { url: window.location.href, errorType: context?.type, errorDetails: context?.details, recoverable: context?.recoverable, retryCount: context?.retryCount } });
}

// =============================================================================
// Event Handlers
// =============================================================================

function handleVisibilityChange(): void {
  if (!document.hidden) {
    if (!port) connectToBackground();
    if (bridgeInitState === 'failed' && bridgeError?.recoverable) sendToBridge({ type: 'FORCE_INIT' });
    sendToBridge({ type: 'DETECT_REACT' });
  }
}

function cleanup(): void {
  window.removeEventListener('message', handleBridgeMessageEvent);
  window.removeEventListener('beforeunload', cleanup);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (handshakeTimer) { clearInterval(handshakeTimer); handshakeTimer = null; }
  if (port) { try { port.disconnect(); } catch { /* ignore */ } port = null; }
  sendToBridge({ type: 'STOP' });
}

// =============================================================================
// Setup
// =============================================================================

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    // Handle popup messages — uses bridge when available, falls back to direct detection
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message) return false;

      if (message.type === 'DETECT_TECH_STACK') {
        if (pendingTechStackPopup) { clearTimeout(pendingTechStackPopup.timer); pendingTechStackPopup.respond(null); }
        let settled = false;
        const timer = setTimeout(() => {
          pendingTechStackPopup = null;
          if (!settled) {
            settled = true;
            // Fallback: return direct detection if bridge didn't respond
            sendResponse(detectTechStackDirectly());
          }
        }, 3000);
        const respond = (result: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          pendingTechStackPopup = null;
          // Bridge response takes priority, but merge with direct detection
          sendResponse(result && typeof result === 'object' && (result as FrameworkInfo[]).length > 0 ? result : detectTechStackDirectly());
        };
        pendingTechStackPopup = { timer, respond };
        sendToBridge({ type: 'DETECT_TECH_STACK' });
        return true;
      }

      if (message.type === 'GET_COMPONENT_TREE') {
        if (pendingComponentTreePopup) { clearTimeout(pendingComponentTreePopup.timer); pendingComponentTreePopup.respond(null); }
        let settled = false;
        const timer = setTimeout(() => {
          pendingComponentTreePopup = null;
          if (!settled) { settled = true; sendResponse([]); }
        }, 3000);
        const respond = (result: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          pendingComponentTreePopup = null;
          sendResponse(result);
        };
        pendingComponentTreePopup = { timer, respond };
        sendToBridge({ type: 'GET_COMPONENT_TREE' });
        return true;
      }

      if (message.type !== 'CHECK_REACT') return false;

      if (checkReactPopup) { clearTimeout(checkReactPopup.timer); checkReactPopup.respond({ hasReact: false }); }

      let settled = false;
      const respondFinal = (detected: boolean) => {
        if (settled) return;
        settled = true;
        checkReactPopup = null;
        lastKnownReactDetected = detected;
        sendResponse({ hasReact: detected });
      };

      // Timeout fallback
      const timer = setTimeout(() => { respondFinal(detectReactDirectly()); }, 3000);

      // Bridge response handler
      checkReactPopup = {
        timer,
        respond: (result: { hasReact: boolean }) => {
          if (settled) return;
          if (result.hasReact) { respondFinal(true); return; }
          // Bridge said no — run MAIN world detection as final check
          detectReactViaMainWorld().then((r) => { respondFinal(r.detected); });
        },
      };

      // Try bridge first
      sendToBridge({ type: 'DETECT_REACT' });
      // Also run MAIN world detection in parallel (fast path)
      detectReactViaMainWorld().then((r) => {
        if (r.detected) respondFinal(true);
      });

      return true;
    });
  },
});
