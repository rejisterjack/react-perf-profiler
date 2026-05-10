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

  const SOURCE = 'react-perf-profiler-bridge';
  const CONTENT_SOURCE = 'react-perf-profiler-content';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function send(type, data) {
    window.postMessage(
      { source: SOURCE, payload: { type, data } },
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

    const tag = typeof fiber.tag === 'number' ? fiber.tag : -1;
    const name = getDisplayName(fiber);
    const key = fiber.key != null ? String(fiber.key) : null;

    return {
      id: fiber._debugID ?? null,
      tag,
      name,
      key,
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
    const children = [];
    let current = fiber;
    while (current && depth <= maxDepth) {
      const data = extractFiberData(current, depth, maxDepth);
      if (data) children.push(data);
      current = current.sibling;
    }
    return children;
  }

  function getDisplayName(fiber) {
    if (!fiber) return null;
    if (fiber._debugSource?.fileName) {
      // Try to get a meaningful name from the type
    }
    const type = fiber.type;
    if (typeof type === 'string') return type;
    if (typeof type === 'function' || typeof type === 'object') {
      return type.displayName || type.name || null;
    }
    if (fiber.tag === 5) return fiber.type; // HostComponent
    if (fiber.tag === 6) return '#text'; // HostText
    return null;
  }

  function isMemoizedFiber(fiber) {
    if (!fiber) return false;
    return fiber.tag === 14 || fiber.tag === 15 ||
      (fiber.memoizedProps !== null && fiber.pendingProps === fiber.memoizedProps);
  }

  function safeProps(props) {
    if (!props || typeof props !== 'object') return {};
    try {
      // Only capture keys, not values (to avoid serializing large objects / functions)
      return { __keys: Object.keys(props).slice(0, 20) };
    } catch {
      return {};
    }
  }

  // ---------------------------------------------------------------------------
  // React DevTools Hook Listener
  // ---------------------------------------------------------------------------

  const MAX_TREE_DEPTH = 500;
  let isProfiling = false;
  let hookDetected = false;
  let devtoolsDetected = false;

  function waitForHook(maxAttempts, interval) {
    let attempts = 0;

    function check() {
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        hookDetected = true;
        devtoolsDetected = true;
        attachToHook();
        send('INIT', { success: true, reactVersion: detectReactVersion() });
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(check, interval);
      } else {
        sendError('React DevTools global hook not found after retries', 'HOOK_NOT_FOUND', true);
      }
    }

    check();
  }

  function detectReactVersion() {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) return null;
    const renderers = hook.renderers;
    if (!renderers) return null;
    for (const renderer of renderers.values()) {
      if (renderer && renderer.version) return renderer.version;
    }
    return null;
  }

  function attachToHook() {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook) return;

    // Listen for fiber commits
    const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
    hook.onCommitFiberRoot = function (rendererID, root, priority) {
      // Call original if it exists (e.g., React DevTools)
      if (typeof originalOnCommitFiberRoot === 'function') {
        try {
          originalOnCommitFiberRoot(rendererID, root, priority);
        } catch {
          // Don't let DevTools errors break our bridge
        }
      }

      if (!isProfiling) return;

      try {
        const commitData = buildCommitData(root, rendererID);
        if (commitData) {
          send('COMMIT', commitData);
        }
      } catch (err) {
        sendError('Error processing commit: ' + (err.message || err), 'COMMIT_ERROR', true);
      }
    };
  }

  function buildCommitData(root, rendererID) {
    if (!root) return null;

    const current = root.current;
    if (!current) return null;

    const nodes = [];
    collectNodes(current, nodes, 0);

    return {
      id: 'commit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      nodes,
      rendererID,
      reactVersion: detectReactVersion(),
    };
  }

  function collectNodes(fiber, nodes, depth) {
    if (!fiber || depth > MAX_TREE_DEPTH) return;

    const name = getDisplayName(fiber);
    const tag = typeof fiber.tag === 'number' ? fiber.tag : -1;

    nodes.push({
      id: fiber._debugID ?? null,
      tag,
      displayName: name,
      actualDuration: fiber.actualDuration ?? 0,
      actualStartTime: fiber.actualStartTime ?? 0,
      selfBaseDuration: fiber.selfBaseDuration ?? 0,
      treeBaseDuration: fiber.treeBaseDuration ?? 0,
      isMemoized: isMemoizedFiber(fiber),
      propsKeys: safeProps(fiber.memoizedProps).__keys || [],
    });

    // Walk children
    let child = fiber.child;
    while (child) {
      collectNodes(child, nodes, depth + 1);
      child = child.sibling;
    }
  }

  // ---------------------------------------------------------------------------
  // Message handler (Content Script → Bridge)
  // ---------------------------------------------------------------------------

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== CONTENT_SOURCE) return;
    if (!message.payload) return;

    const { type } = message.payload;

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
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        const reactDetected = !!hook;
        const hasRenderers = hook && hook.renderers && hook.renderers.size > 0;
        send('DETECT_RESULT', {
          reactDetected,
          devtoolsDetected: reactDetected,
          isInitialized: hasRenderers,
          reactVersion: detectReactVersion(),
        });
        break;
      }

      case 'FORCE_INIT':
        // Re-attempt hook attachment
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          hookDetected = true;
          attachToHook();
          send('INIT', { success: true, reactVersion: detectReactVersion() });
        } else {
          waitForHook(5, 500);
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
      send('INIT', { success: true, reactVersion: detectReactVersion() });
    } else {
      // Hook not yet available — wait for it (React may load asynchronously)
      waitForHook(10, 500);
    }
  } catch (err) {
    sendError('Bridge init failed: ' + (err.message || err), 'INIT_ERROR', true);
  }
})();
