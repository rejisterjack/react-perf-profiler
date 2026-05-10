/**
 * React Perf Profiler — Injected Script
 *
 * Lightweight companion to bridge.js. Runs in the page context and provides
 * CSP-safe detection of React applications by checking DOM heuristics and
 * global variables. Used as a fallback when bridge.js faces CSP restrictions.
 */
(function injected() {
  'use strict';

  if (window.__REACT_PERF_PROFILER_INJECTED__) return;
  window.__REACT_PERF_PROFILER_INJECTED__ = true;

  const SOURCE = 'react-perf-profiler-injected';
  const CONTENT_SOURCE = 'react-perf-profiler-content';

  function send(type, data) {
    window.postMessage(
      { source: SOURCE, payload: { type, data } },
      window.location.origin === 'null' ? '*' : window.location.origin
    );
  }

  /**
   * Detect React via DOM heuristics (works even without DevTools hook).
   */
  function detectReactViaDOM() {
    // Check for React 18+ root
    const rootEl = document.getElementById('root') || document.getElementById('__next');
    if (rootEl && rootEl._reactRootContainer) return true;

    // Check for data-reactroot attribute (older React)
    if (document.querySelector('[data-reactroot]')) return true;

    // Check for React internals on root elements
    const allElements = document.querySelectorAll('*');
    for (let i = 0; i < Math.min(allElements.length, 100); i++) {
      const el = allElements[i];
      for (const key of Object.keys(el)) {
        if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Detect React version from global hook.
   */
  function getReactVersion() {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || !hook.renderers) return null;
    for (const renderer of hook.renderers.values()) {
      if (renderer?.version) return renderer.version;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Listen for detection requests from content script
  // ---------------------------------------------------------------------------

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== CONTENT_SOURCE) return;
    if (!message.payload) return;

    if (message.payload.type === 'DETECT_REACT') {
      const hasHook = !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const hasReactGlobal = !!window.React;
      const hasDOMReact = detectReactViaDOM();
      const reactDetected = hasHook || hasReactGlobal || hasDOMReact;

      send('DETECT_RESULT', {
        reactDetected,
        devtoolsDetected: hasHook,
        isInitialized: hasHook && !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size,
        reactVersion: getReactVersion(),
        detectionMethod: hasHook ? 'hook' : hasReactGlobal ? 'global' : hasDOMReact ? 'dom' : 'none',
      });
    }
  });

  // Signal that injected script is ready
  send('INJECTED_READY', { timestamp: Date.now() });
})();
