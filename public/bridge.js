/**
 * React Perf Profiler — Bridge Script
 *
 * Runs in the PAGE context (injected by the content script) so it can access
 * `__REACT_DEVTOOLS_GLOBAL_HOOK__`. Communicates back to the content script
 * via `window.postMessage`.
 *
 * Flow:  React commit → hook.onCommitFiberRoot → bridge → postMessage → content script
 */
(function bridge() {
  'use strict';

  // Guard: prevent double-injection
  if (window.__REACT_PERF_PROFILER_BRIDGE__) return;
  window.__REACT_PERF_PROFILER_BRIDGE__ = true;

  var SOURCE = 'react-perf-profiler-bridge';
  var CONTENT_SOURCE = 'react-perf-profiler-content';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function send(type, data) {
    window.postMessage(
      { source: SOURCE, payload: { type: type, data: data } },
      window.location.origin === 'null' ? '*' : window.location.origin
    );
  }

  function sendError(message, errorType, recoverable) {
    window.postMessage(
      {
        source: SOURCE,
        payload: {
          type: 'ERROR',
          error: message,
          errorType: errorType || 'UNKNOWN',
          recoverable: recoverable !== false,
        },
      },
      window.location.origin === 'null' ? '*' : window.location.origin
    );
  }

  // ---------------------------------------------------------------------------
  // Fiber-tree utilities
  // ---------------------------------------------------------------------------

  /** Extract render-relevant data from a fiber node (bounded depth). */
  function extractFiberData(fiber, depth, maxDepth) {
    if (!fiber || depth > maxDepth) return null;

    var tag = typeof fiber.tag === 'number' ? fiber.tag : -1;
    var name = getDisplayName(fiber);
    var key = fiber.key != null ? String(fiber.key) : null;

    return {
      id: fiber._debugID ?? null,
      tag: tag,
      name: name,
      key: key,
      displayName: name,
      actualDuration: fiber.actualDuration ?? 0,
      actualStartTime: fiber.actualStartTime ?? 0,
      selfBaseDuration: fiber.selfBaseDuration ?? 0,
      treeBaseDuration: fiber.treeBaseDuration ?? 0,
      memoizedProps: safeProps(fiber.memoizedProps),
      isMemoized: isMemoizedFiber(fiber),
      children: extractChildren(fiber.child, depth + 1, maxDepth),
    };
  }

  function extractChildren(fiber, depth, maxDepth) {
    var children = [];
    var current = fiber;
    while (current && depth <= maxDepth) {
      var data = extractFiberData(current, depth, maxDepth);
      if (data) children.push(data);
      current = current.sibling;
    }
    return children;
  }

  function getDisplayName(fiber) {
    if (!fiber) return null;
    var type = fiber.type;
    if (typeof type === 'string') return type;
    if (typeof type === 'function' || typeof type === 'object') {
      return (type && (type.displayName || type.name)) || null;
    }
    if (fiber.tag === 5) return fiber.type; // HostComponent
    if (fiber.tag === 6) return '#text'; // HostText
    return null;
  }

  function isMemoizedFiber(fiber) {
    if (!fiber) return false;
    return (
      fiber.tag === 14 ||
      fiber.tag === 15 ||
      (fiber.memoizedProps !== null && fiber.pendingProps === fiber.memoizedProps)
    );
  }

  function safeProps(props) {
    if (!props || typeof props !== 'object') return {};
    try {
      return { __keys: Object.keys(props).slice(0, 20) };
    } catch (e) {
      return {};
    }
  }

  // ---------------------------------------------------------------------------
  // React DevTools Hook Listener
  // ---------------------------------------------------------------------------

  var MAX_TREE_DEPTH = 500;
  var isProfiling = false;
  var hookDetected = false;
  var devtoolsDetected = false;

  function waitForHook(maxAttempts, interval) {
    var attempts = 0;

    function check() {
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        hookDetected = true;
        devtoolsDetected = true;
        attachToHook();
        send('INIT', {
          success: true,
          reactDetected: true,
          devtoolsDetected: true,
          isInitialized: true,
          reactVersion: detectReactVersion(),
        });
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(check, interval);
      } else {
        // Hook not found after all retries — try DOM-based detection as fallback
        var reactOnPage = detectReactOnPage();
        if (reactOnPage) {
          send('INIT', {
            success: true,
            reactDetected: true,
            devtoolsDetected: false,
            isInitialized: false,
            hasHook: false,
            productionBuild: true,
            reactVersion: null,
          });
        } else {
          // Start MutationObserver to watch for late-mounting React apps
          startDOMObserver();
          sendError(
            'React DevTools global hook not found after retries',
            'HOOK_NOT_FOUND',
            true
          );
        }
      }
    }

    check();
  }

  // ---------------------------------------------------------------------------
  // MutationObserver — catches late-hydrating React apps (Next.js App Router)
  // ---------------------------------------------------------------------------

  var domObserver = null;
  var domObserverTimeout = null;

  function startDOMObserver() {
    if (domObserver) return; // already running

    // Stop observing after 30 seconds to avoid resource waste
    domObserverTimeout = setTimeout(function () {
      stopDOMObserver();
    }, 30000);

    domObserver = new MutationObserver(function () {
      // Check if React appeared on the page
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        hookDetected = true;
        devtoolsDetected = true;
        attachToHook();
        send('INIT', {
          success: true,
          reactDetected: true,
          devtoolsDetected: true,
          isInitialized: true,
          reactVersion: detectReactVersion(),
          lateDetection: true,
        });
        stopDOMObserver();
        return;
      }

      if (detectReactOnPage()) {
        send('DETECT_RESULT', {
          reactDetected: true,
          devtoolsDetected: false,
          isInitialized: false,
          reactVersion: null,
          lateDetection: true,
        });
        stopDOMObserver();
      }
    });

    domObserver.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  }

  function stopDOMObserver() {
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
    if (domObserverTimeout) {
      clearTimeout(domObserverTimeout);
      domObserverTimeout = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Version detection
  // ---------------------------------------------------------------------------

  function detectReactVersion() {
    var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) return null;
    var renderers = hook.renderers;
    if (!renderers) return null;
    try {
      for (var renderer of renderers.values()) {
        if (renderer && renderer.version) return renderer.version;
      }
    } catch (e) {
      // renderers.values() may not be iterable in all environments
    }
    return null;
  }

  function attachToHook() {
    var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) return;

    var originalOnCommitFiberRoot = hook.onCommitFiberRoot;
    hook.onCommitFiberRoot = function (rendererID, root, priority) {
      if (typeof originalOnCommitFiberRoot === 'function') {
        try {
          originalOnCommitFiberRoot(rendererID, root, priority);
        } catch (e) {
          // Don't let DevTools errors break our bridge
        }
      }

      if (!isProfiling) return;

      try {
        var commitData = buildCommitData(root, rendererID);
        if (commitData) {
          send('COMMIT', commitData);
        }
      } catch (err) {
        sendError(
          'Error processing commit: ' + (err.message || err),
          'COMMIT_ERROR',
          true
        );
      }
    };
  }

  function buildCommitData(root, rendererID) {
    if (!root) return null;
    var current = root.current;
    if (!current) return null;

    var nodes = [];
    collectNodes(current, nodes, 0);

    return {
      id:
        'commit-' +
        Date.now() +
        '-' +
        Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      nodes: nodes,
      rendererID: rendererID,
      reactVersion: detectReactVersion(),
    };
  }

  function collectNodes(fiber, nodes, depth) {
    if (!fiber || depth > MAX_TREE_DEPTH) return;

    var name = getDisplayName(fiber);
    var tag = typeof fiber.tag === 'number' ? fiber.tag : -1;

    nodes.push({
      id: fiber._debugID ?? null,
      tag: tag,
      displayName: name,
      actualDuration: fiber.actualDuration ?? 0,
      actualStartTime: fiber.actualStartTime ?? 0,
      selfBaseDuration: fiber.selfBaseDuration ?? 0,
      treeBaseDuration: fiber.treeBaseDuration ?? 0,
      isMemoized: isMemoizedFiber(fiber),
      propsKeys: safeProps(fiber.memoizedProps).__keys || [],
    });

    var child = fiber.child;
    while (child) {
      collectNodes(child, nodes, depth + 1);
      child = child.sibling;
    }
  }

  // ---------------------------------------------------------------------------
  // React detection (comprehensive — works on production builds)
  // ---------------------------------------------------------------------------

  function detectReactOnPage() {
    // 1. DevTools hook (set by DevTools extension or React dev build)
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return true;

    // 2. React global (dev builds only)
    if (window.React || window.__REACT__) return true;

    // 3. Check common root containers
    var rootSelectors = [
      '#root',
      '#app',
      '#__next',
      '#__nuxt',
      '#__gatsby',
      '#___gatsby',
      '[data-reactroot]',
      '#react-root',
      '#react-app',
      '#main',
      '#application',
    ];
    var roots = document.querySelectorAll(rootSelectors.join(','));

    for (var i = 0; i < roots.length; i++) {
      if (hasReactInternals(roots[i])) return true;
    }

    // 4. Scan direct children of body as a universal fallback
    var bodyChildren = document.querySelectorAll('body > div, body > main, body > section');
    for (var b = 0; b < Math.min(bodyChildren.length, 15); b++) {
      if (hasReactInternals(bodyChildren[b])) return true;
    }

    // 5. Deep scan: check first-level children of root-like containers
    var deepSelectors = [
      '#root > *',
      '#app > *',
      '#__next > *',
      'body > div > *',
      'main > *',
    ];
    for (var s = 0; s < deepSelectors.length; s++) {
      try {
        var els = document.querySelectorAll(deepSelectors[s]);
        for (var e = 0; e < Math.min(els.length, 10); e++) {
          if (hasReactInternals(els[e])) return true;
        }
      } catch (_) {}
    }

    return false;
  }

  /**
   * Check if an element has React internal properties attached
   */
  function hasReactInternals(el) {
    if (!el) return false;
    try {
      var names = Object.getOwnPropertyNames(el);
      for (var j = 0; j < names.length; j++) {
        var n = names[j];
        if (
          n.indexOf('__reactContainer$') === 0 ||
          n.indexOf('_reactRootContainer') === 0 ||
          n.indexOf('__reactFiber$') === 0 ||
          n.indexOf('__reactProps$') === 0 ||
          n.indexOf('__reactEvents$') === 0 ||
          n.indexOf('__react') === 0 ||
          n.indexOf('_react') === 0
        ) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  // ---------------------------------------------------------------------------
  // Message handler (Content Script → Bridge)
  // ---------------------------------------------------------------------------

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    var message = event.data;
    if (!message || message.source !== CONTENT_SOURCE) return;
    if (!message.payload) return;

    var type = message.payload.type;

    switch (type) {
      case 'START':
        isProfiling = true;
        send('START', { timestamp: Date.now() });
        break;

      case 'STOP':
        isProfiling = false;
        send('STOP', { timestamp: Date.now() });
        break;

      case 'DETECT_REACT': {
        var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        var reactDetected = !!hook || detectReactOnPage();
        var hasRenderers = hook && hook.renderers && hook.renderers.size > 0;
        send('DETECT_RESULT', {
          reactDetected: reactDetected,
          devtoolsDetected: !!hook,
          isInitialized: !!hasRenderers,
          reactVersion: detectReactVersion(),
        });
        break;
      }

      case 'FORCE_INIT':
        // Re-attempt hook attachment
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          hookDetected = true;
          devtoolsDetected = true;
          attachToHook();
          send('INIT', {
            success: true,
            reactDetected: true,
            devtoolsDetected: true,
            isInitialized: true,
            reactVersion: detectReactVersion(),
          });
        } else {
          waitForHook(10, 500);
        }
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------

  try {
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      hookDetected = true;
      devtoolsDetected = true;
      attachToHook();
      send('INIT', {
        success: true,
        reactDetected: true,
        devtoolsDetected: true,
        isInitialized: true,
        hasHook: true,
        reactVersion: detectReactVersion(),
      });
    } else if (detectReactOnPage()) {
      // React detected on page but DevTools hook not available (production build)
      send('INIT', {
        success: true,
        reactDetected: true,
        devtoolsDetected: false,
        isInitialized: false,
        hasHook: false,
        productionBuild: true,
        reactVersion: null,
      });
    } else {
      // Hook not yet available — wait for it (React may load asynchronously)
      waitForHook(20, 500);
    }
  } catch (err) {
    sendError(
      'Bridge init failed: ' + (err.message || err),
      'INIT_ERROR',
      true
    );
  }
})();
