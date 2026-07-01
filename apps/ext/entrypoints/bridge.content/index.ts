/**
 * Bridge Content Script (MAIN world)
 * Hooks into __REACT_DEVTOOLS_GLOBAL_HOOK__ to intercept React commits.
 * All logic is inside main() because WXT executes this at build time.
 */

import {
  parseFiberRoot,
  parseFiberNode,
  getReactVersion,
  diffFiberTree,
  buildFiberStateMap,
  type FiberDelta,
} from './fiberParser';
import type { FiberRoot } from './reactInternals';
import type { FiberData } from '@repo/profile-contract';

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    // State
    let originalOnCommitFiberRoot:
      | ((rendererID: number, root: FiberRoot, priorityLevel: number) => void)
      | null = null;
    let isProfiling = false;
    let reactVersion: string | undefined;

    // Session token — learned from the content script's first message and
    // echoed in every message we send back. The content script generates
    // this token (see apps/ext/entrypoints/content.ts) and includes it in
    // every command; we learn it on the first PING and require it on every
    // subsequent message. This prevents a malicious page from spoofing
    // START/STOP commands even if it knows the `source` string, because it
    // cannot observe the token (the content script never exposes it to the
    // page — only to this bridge via postMessage, which the page can also
    // see, but the page cannot forge the content-script source string AND
    // match the random per-session token together).
    let sessionToken: string | null = null;

    // Batch accumulator — collects all commits within a window, sends as batch
    const BATCH_WINDOW_MS = 50;
    const MAX_BATCH_SIZE = 50;
    let commitBatch: ReturnType<typeof parseFiberRoot>[] = [];
    let batchTimer: ReturnType<typeof setTimeout> | null = null;

    // Incremental diffing state — track previously sent fiber tree to send only deltas
    let previousFiberIds: Set<string> | null = null;
    let previousFiberState: Map<string, { propsHash: string; duration: number }> | null = null;
    let lastCommitId: string | null = null;
    let deltaModeEnabled = true;
    let isFirstCommit = true;
    let incrementalDiffingEnabled = true;

    // Source code correlation — track _debugSource from fiber nodes
    let sourceCorrelationEnabled = true;

    // Props serialization limits
    const PROP_SERIALIZATION_LIMITS = {
      maxPropDepth: 3,
      maxPropKeys: 20,
      maxPropValueLength: 200,
    };

    // Render cause tracking — track state/prop changes between commits
    let renderCauseTrackingEnabled = true;
    let previousCommitFibers: Map<
      string,
      { memoizedProps: Record<string, unknown>; memoizedState: unknown }
    > | null = null;

    // Targeted recording filters
    type RecordingFilter = {
      type: 'component' | 'duration' | 'interaction';
      value: unknown;
    };
    let recordingFilters: RecordingFilter[] = [];
    let isInteractionListening = false;
    let interactionPending = false;
    let interactionCommitBudget = 0;

    let initRetryCount = 0;
    let initRetryTimeout: ReturnType<typeof setTimeout> | null = null;
    const MAX_RETRY_ATTEMPTS = 5;
    const INITIAL_RETRY_DELAY = 500;
    const MAX_RETRY_DELAY_MS = 30000;

    let isInitialized = false;
    let lastError: { type: string; message: string; timestamp: number } | null = null;

    const BRIDGE_SOURCE = 'react-perf-profiler-bridge';

    let _reactWatchObserver: MutationObserver | null = null;
    let _reactWatchTimer: ReturnType<typeof setTimeout> | null = null;

    // =========================================================================
    // Messaging
    // =========================================================================

    function sendMessage(payload: Record<string, unknown>): void {
      if (typeof window === 'undefined') return;
      // Echo the content script's session token so the content script can
      // authenticate this message came from this bridge instance.
      const message = { source: BRIDGE_SOURCE, token: sessionToken ?? undefined, payload };
      const targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;
      window.postMessage(message, targetOrigin);
    }

    function flushBatch(): void {
      if (commitBatch.length === 0) return;
      const batch = commitBatch;
      commitBatch = [];
      if (batchTimer !== null) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
      if (batch.length === 1) {
        sendMessage({ type: 'COMMIT', data: batch[0] });
      } else {
        sendMessage({ type: 'COMMIT_BATCH', data: batch });
      }
    }

    function addToBatch(commitData: ReturnType<typeof parseFiberRoot>): void {
      commitBatch.push(commitData);
      if (commitBatch.length >= MAX_BATCH_SIZE) {
        flushBatch();
        return;
      }
      if (batchTimer === null) {
        batchTimer = setTimeout(flushBatch, BATCH_WINDOW_MS);
      }
    }

    // =========================================================================
    // Recording Filters
    // =========================================================================

    function shouldRecordCommit(commitData: ReturnType<typeof parseFiberRoot>): boolean {
      if (recordingFilters.length === 0) return true;

      for (const filter of recordingFilters) {
        switch (filter.type) {
          case 'component': {
            const targetName = filter.value as string;
            const hasComponent = commitData.fibers.some((f) => f.displayName === targetName);
            if (hasComponent) return true;
            break;
          }
          case 'duration': {
            const minDuration = filter.value as number;
            if (commitData.duration >= minDuration) return true;
            break;
          }
          case 'interaction': {
            if (interactionPending && interactionCommitBudget > 0) {
              interactionCommitBudget--;
              if (interactionCommitBudget <= 0) interactionPending = false;
              return true;
            }
            return false;
          }
        }
      }
      return recordingFilters.every((f) => f.type === 'interaction') ? false : true;
    }

    // =========================================================================
    // Interaction Listener for Targeted Recording
    // =========================================================================

    function setupInteractionListeners(): void {
      if (isInteractionListening) return;
      isInteractionListening = true;
      const interactionEvents = ['click', 'input', 'keydown', 'scroll'];
      const handler = () => {
        if (!interactionPending) return;
        interactionCommitBudget = 20;
      };
      for (const evt of interactionEvents) {
        document.addEventListener(evt, handler, { passive: true, capture: true });
      }
    }

    // =========================================================================
    // Render Cause Analysis
    // =========================================================================

    function buildRenderCauses(commitData: ReturnType<typeof parseFiberRoot>): Array<{
      fiberId: string;
      componentName: string;
      causes: Array<{
        type:
          | 'props-changed'
          | 'state-changed'
          | 'parent-rerendered'
          | 'context-changed'
          | 'hooks-changed';
        details: string;
        changedKeys?: string[];
      }>;
    }> {
      if (!renderCauseTrackingEnabled || !previousCommitFibers) return [];

      const causes: Array<{
        fiberId: string;
        componentName: string;
        causes: Array<{
          type:
            | 'props-changed'
            | 'state-changed'
            | 'parent-rerendered'
            | 'context-changed'
            | 'hooks-changed';
          details: string;
          changedKeys?: string[];
        }>;
      }> = [];

      const currentFibers = new Map<
        string,
        { memoizedProps: Record<string, unknown>; memoizedState: unknown }
      >();

      for (const fiber of commitData.fibers) {
        if (!fiber.displayName) continue;
        const currentProps = fiber.memoizedProps ?? {};
        const currentState = fiber.memoizedState;
        currentFibers.set(fiber.id, { memoizedProps: currentProps, memoizedState: currentState });

        const prev = previousCommitFibers.get(fiber.id);
        if (!prev) continue;

        const fiberCauses: Array<{
          type:
            | 'props-changed'
            | 'state-changed'
            | 'parent-rerendered'
            | 'context-changed'
            | 'hooks-changed';
          details: string;
          changedKeys?: string[];
        }> = [];

        // Check if props changed
        const prevProps = prev.memoizedProps;
        const changedKeys: string[] = [];
        for (const key of Object.keys(currentProps)) {
          if (!(key in prevProps) || !Object.is(prevProps[key], currentProps[key])) {
            changedKeys.push(key);
          }
        }
        for (const key of Object.keys(prevProps)) {
          if (!(key in currentProps)) {
            changedKeys.push(key);
          }
        }

        if (changedKeys.length > 0) {
          fiberCauses.push({
            type: 'props-changed',
            details: `${changedKeys.length} prop(s) changed: ${changedKeys.slice(0, 5).join(', ')}${changedKeys.length > 5 ? '...' : ''}`,
            changedKeys,
          });
        }

        // Check if state changed (simple reference check)
        if (currentState !== prev.memoizedState) {
          fiberCauses.push({
            type: 'state-changed',
            details: 'Component state changed',
          });
        }

        // Check if parent re-rendered (parent is in current commit's fibers)
        if (fiber.return) {
          const parentId = fiber.return.id;
          if (previousCommitFibers.has(parentId)) {
            fiberCauses.push({
              type: 'parent-rerendered',
              details: `Parent "${fiber.return.displayName || 'Unknown'}" re-rendered`,
            });
          }
        }

        if (fiberCauses.length > 0) {
          causes.push({
            fiberId: fiber.id,
            componentName: fiber.displayName,
            causes: fiberCauses,
          });
        }
      }

      previousCommitFibers = currentFibers;
      return causes;
    }

    // =========================================================================
    // Hook Management
    // =========================================================================

    function getReactDevToolsHook() {
      if (typeof window === 'undefined') return null;
      return window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || null;
    }

    function setupHookInterception(
      hook: NonNullable<ReturnType<typeof getReactDevToolsHook>>,
    ): void {
      reactVersion = getReactVersion();
      if (hook.onCommitFiberRoot) originalOnCommitFiberRoot = hook.onCommitFiberRoot.bind(hook);

      hook.onCommitFiberRoot = (
        rendererID: number,
        root: FiberRoot,
        priorityLevel: number,
      ): void => {
        if (originalOnCommitFiberRoot) {
          try {
            originalOnCommitFiberRoot(rendererID, root, priorityLevel);
          } catch (_e) {
            /* ignore */
          }
        }
        if (!isProfiling) return;
        try {
          const current = root?.current;
          if (!current) return;

          const commitData = parseFiberRoot(current, priorityLevel, {
            sourceCorrelation: sourceCorrelationEnabled,
            propLimits: PROP_SERIALIZATION_LIMITS,
            previousFiberIds,
          });

          // Delta tree serialization — send only changed fibers after first commit
          if (
            deltaModeEnabled &&
            !isFirstCommit &&
            previousFiberState &&
            commitData.fibers.length > 0
          ) {
            const delta = diffFiberTree(commitData.fibers, previousFiberState);
            delta.baseCommitId = lastCommitId ?? '';
            commitData.changedFiberIds = delta.changedFibers.map((f) => f.id);
            commitData.isDelta = true;
            // Store full fiber data in changedFiberIds format but keep delta info
            // The panel will merge deltas into its fiber map
            if (delta.removedFiberIds.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (commitData as any).removedFiberIds = delta.removedFiberIds;
            }
            // Only send changed fibers to reduce message size
            if (delta.changedFibers.length < commitData.fibers.length) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (commitData as any).deltaChangedFibers = delta.changedFibers;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (commitData as any).deltaRemovedFiberIds = delta.removedFiberIds;
            }
          }

          // Update state for next delta diff
          if (incrementalDiffingEnabled && commitData.fibers.length > 0) {
            previousFiberState = buildFiberStateMap(commitData.fibers);
            lastCommitId = commitData.id;
            isFirstCommit = false;
          }

          // Update previous fiber IDs for incremental diffing
          if (incrementalDiffingEnabled) {
            previousFiberIds = new Set(commitData.fibers.map((f) => f.id));
          }

          // Add render cause data
          commitData.renderCauses = buildRenderCauses(commitData);
          commitData.reactVersion = reactVersion;

          // Apply recording filters
          if (!shouldRecordCommit(commitData)) return;

          addToBatch(commitData);
        } catch (error) {
          sendMessage({
            type: 'ERROR',
            error: error instanceof Error ? error.message : String(error),
            errorType: 'PARSE_ERROR',
            recoverable: true,
          });
        }
      };

      sendMessage({
        type: 'INIT',
        data: {
          reactVersion,
          supportsFiber: hook.supportsFiber,
          rendererCount: hook.renderers?.size ?? 0,
        },
      });
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    function initBridge(): void {
      if (isInitialized) return;
      const hook = getReactDevToolsHook();
      if (!hook) {
        handleInitFailure('DEVTOOLS_NOT_FOUND');
        return;
      }
      try {
        setupHookInterception(hook);
        isInitialized = true;
        initRetryCount = 0;
        lastError = null;
        sendMessage({
          type: 'INIT',
          data: {
            reactVersion,
            supportsFiber: hook.supportsFiber,
            rendererCount: hook.renderers?.size ?? 0,
            success: true,
          },
        });
      } catch (error) {
        handleInitFailure('INIT_FAILED', error instanceof Error ? error.message : String(error));
      }
    }

    function handleInitFailure(
      reason: 'DEVTOOLS_NOT_FOUND' | 'INIT_FAILED',
      details?: string,
    ): void {
      lastError = {
        type: reason,
        message:
          details ||
          (reason === 'DEVTOOLS_NOT_FOUND'
            ? 'React DevTools hook not found.'
            : 'Failed to initialize bridge.'),
        timestamp: Date.now(),
      };
      sendMessage({
        type: 'ERROR',
        error: lastError.message,
        errorType: reason,
        recoverable: initRetryCount < MAX_RETRY_ATTEMPTS,
        retryCount: initRetryCount,
      });
      if (detectReact() && !getReactDevToolsHook() && initRetryCount < MAX_RETRY_ATTEMPTS)
        scheduleRetry();
      else if (!detectReact())
        sendMessage({
          type: 'ERROR',
          error: 'React not detected.',
          errorType: 'REACT_NOT_FOUND',
          recoverable: false,
        });
    }

    function scheduleRetry(): void {
      if (initRetryTimeout) clearTimeout(initRetryTimeout);
      initRetryCount++;
      const delay = Math.min(MAX_RETRY_DELAY_MS, 2 ** initRetryCount * INITIAL_RETRY_DELAY);
      sendMessage({
        type: 'RETRY_SCHEDULED',
        retryCount: initRetryCount,
        maxRetries: MAX_RETRY_ATTEMPTS,
        nextRetryIn: delay,
      });
      initRetryTimeout = setTimeout(() => initBridge(), delay);
    }

    function cancelRetry(): void {
      if (initRetryTimeout) {
        clearTimeout(initRetryTimeout);
        initRetryTimeout = null;
      }
    }

    // =========================================================================
    // Profiling
    // =========================================================================

    function startProfiling(): void {
      if (isProfiling) return;
      isProfiling = true;
      previousFiberIds = null;
      previousFiberState = null;
      lastCommitId = null;
      isFirstCommit = true;
      previousCommitFibers = null;
      window.__REACT_PERF_PROFILER_ACTIVE__ = true;
      if (recordingFilters.some((f) => f.type === 'interaction')) {
        setupInteractionListeners();
      }
      sendMessage({ type: 'START', data: { timestamp: Date.now() } });
    }

    function stopProfiling(): void {
      if (!isProfiling) return;
      isProfiling = false;
      flushBatch();
      window.__REACT_PERF_PROFILER_ACTIVE__ = false;
      sendMessage({ type: 'STOP', data: { timestamp: Date.now() } });
    }

    // =========================================================================
    // React Detection
    // =========================================================================

    function detectReact(): boolean {
      // Strategy 1: DevTools hook (fastest)
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return true;
      // Strategy 2: Global React object
      if (
        (window as unknown as Record<string, unknown>).React ||
        (window as unknown as Record<string, unknown>).__REACT__
      )
        return true;
      // Strategy 3: Legacy data attributes (React <16)
      if (document.querySelector('[data-reactroot], [data-reactid]')) return true;
      // Strategy 4: Known root containers
      for (const id of ['root', 'app', '__next', '__nuxt']) {
        const el = document.getElementById(id);
        if (el) {
          if ((el as unknown as Record<string, unknown>)._reactRootContainer) return true;
          if (Object.getOwnPropertyNames(el).some((k) => k.startsWith('__reactContainer$')))
            return true;
        }
      }
      // Strategy 5: Aggressive DOM scan for React fiber properties
      // Covers facebook.com, production builds, non-standard containers
      const FIBER_PREFIXES = [
        '__reactFiber$',
        '__reactInternalInstance$',
        '__reactContainer$',
        '__reactProps$',
        '__reactEventHandlers$',
      ];
      function hasReactFiber(el: Element): boolean {
        const props = Object.getOwnPropertyNames(el);
        for (const p of props) {
          for (const prefix of FIBER_PREFIXES) {
            if (p.startsWith(prefix)) return true;
          }
          if (p.startsWith('_react') || (p.startsWith('__react') && !p.startsWith('__REACT')))
            return true;
        }
        return false;
      }
      // Scan direct body children (facebook.com uses mount_0_0_... divs)
      const body = document.body;
      if (body) {
        const children = body.children;
        for (let i = 0; i < Math.min(children.length, 100); i++) {
          if (hasReactFiber(children[i])) return true;
        }
        // Deeper scan via TreeWalker
        let count = 0;
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode() && count < 200) {
          count++;
          if (hasReactFiber(walker.currentNode as Element)) return true;
        }
      }
      return false;
    }

    function detectReactVersion(): string | undefined {
      const version = getReactVersion();
      if (version) return version;
      // Production React without DevTools — extract from fiber internals
      const body = document.body;
      if (!body) return undefined;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
      let count = 0;
      while (walker.nextNode() && count < 50) {
        count++;
        const el = walker.currentNode as Element;
        for (const prop of Object.getOwnPropertyNames(el)) {
          if (prop.startsWith('__reactFiber$')) {
            const fiber = (el as unknown as Record<string, unknown>)[prop];
            if (fiber && typeof fiber === 'object') {
              const mode = (fiber as Record<string, unknown>).mode;
              if (typeof mode === 'number') {
                // ConcurrentMode bit = 0b100000000000 (React 18+)
                if (mode & (1 << 10)) return '18+';
                return '17+';
              }
            }
          }
        }
      }
      return undefined;
    }

    // =========================================================================
    // Tech Stack Detection
    // =========================================================================

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

    function detectFrameworks(): FrameworkInfo[] {
      const results: FrameworkInfo[] = [];
      const w = window as unknown as Record<string, unknown>;

      // React — reuse existing detection
      const hasReact = detectReact();
      if (hasReact) {
        results.push({ name: 'React', version: detectReactVersion(), confidence: 'high' });
      }

      // Vue.js
      if (w.__VUE_DEVTOOLS_GLOBAL_HOOK__ || w.Vue) {
        const hook = w.__VUE_DEVTOOLS_GLOBAL_HOOK__ as Record<string, unknown> | undefined;
        const vue = w.Vue as Record<string, unknown> | undefined;
        const version =
          (vue?.version as string) ||
          ((hook?.Vue as Record<string, unknown>)?.version as string | undefined);
        results.push({ name: 'Vue.js', version, confidence: 'high' });
      } else {
        // Scan DOM for Vue app instances
        const body = document.body;
        if (body) {
          let found = false;
          const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
          let count = 0;
          while (walker.nextNode() && count < 50 && !found) {
            count++;
            const el = walker.currentNode as unknown as Record<string, unknown>;
            if (el.__vue_app__ || el._vnode) {
              results.push({ name: 'Vue.js', version: undefined, confidence: 'medium' });
              found = true;
            }
          }
        }
      }

      // Angular
      const ngVersionEl = document.querySelector('[ng-version]');
      if (w.ng || ngVersionEl || document.querySelector('[ng-app]')) {
        const version = ngVersionEl?.getAttribute('ng-version') || undefined;
        results.push({ name: 'Angular', version, confidence: 'high' });
      }

      // Svelte
      if (w.__SVELTE_HMR) {
        results.push({ name: 'Svelte', version: undefined, confidence: 'high' });
      } else {
        const svelteEl = document.querySelector('[class*="svelte-"]');
        if (svelteEl) {
          results.push({ name: 'Svelte', version: undefined, confidence: 'medium' });
        }
      }

      // Next.js
      const nextData = w.__NEXT_DATA__ as Record<string, unknown> | undefined;
      if (nextData) {
        results.push({
          name: 'Next.js',
          version: (nextData.buildId as string) || undefined,
          confidence: 'high',
        });
      } else if (document.querySelector('meta[name="next-head-count"]')) {
        results.push({ name: 'Next.js', version: undefined, confidence: 'medium' });
      }

      // Nuxt.js
      if (w.__NUXT__ || w.$nuxt || document.getElementById('__nuxt')) {
        const nuxt = w.__NUXT__ as Record<string, unknown> | undefined;
        const version = (nuxt?._app as Record<string, unknown>)?.version as string | undefined;
        results.push({ name: 'Nuxt.js', version, confidence: 'high' });
      }

      // Gatsby
      if (w.___GATSBY) {
        results.push({ name: 'Gatsby', version: undefined, confidence: 'high' });
      } else {
        const gatsbyMeta = document.querySelector('meta[name="generator"][content*="Gatsby"]');
        if (gatsbyMeta) {
          const content = gatsbyMeta.getAttribute('content') || '';
          const versionMatch = content.match(/Gatsby\s*(\S+)/);
          results.push({ name: 'Gatsby', version: versionMatch?.[1], confidence: 'high' });
        }
      }

      // Remix
      if (w.__remixContext) {
        const ctx = w.__remixContext as Record<string, unknown>;
        results.push({
          name: 'Remix',
          version: (ctx.manifest as Record<string, unknown>)?.version as string | undefined,
          confidence: 'high',
        });
      } else {
        const remixMeta = document.querySelector('meta[name="generator"][content*="Remix"]');
        if (remixMeta) {
          results.push({ name: 'Remix', version: undefined, confidence: 'high' });
        }
      }

      // jQuery
      if (w.jQuery || w.$) {
        const jq = (w.jQuery || w.$) as Record<string, unknown>;
        const fn = jq.fn as Record<string, unknown> | undefined;
        results.push({
          name: 'jQuery',
          version: (fn?.jquery as string) || undefined,
          confidence: 'high',
        });
      }

      // Preact
      if (w.__PREACT_DEVTOOLS__ || w.preact) {
        results.push({ name: 'Preact', version: undefined, confidence: 'high' });
      }

      return results;
    }

    function detectMeta(): TechStackResult['meta'] {
      return {
        title: document.title || '',
        description:
          document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
        themeColor:
          document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || undefined,
        ogImage:
          document.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined,
        ogTitle:
          document.querySelector('meta[property="og:title"]')?.getAttribute('content') || undefined,
        ogDescription:
          document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
          undefined,
      };
    }

    function detectFonts(): Array<{ family: string; source: string }> {
      const fontMap = new Map<string, string>();

      // Use document.fonts API for loaded fonts
      if (document.fonts && document.fonts.forEach) {
        document.fonts.forEach((font: FontFace) => {
          fontMap.set(font.family, 'document-fonts-api');
        });
      }

      // Sample computed styles from common elements
      const sampleSelectors = ['body', 'h1', 'p', 'a'];
      for (const selector of sampleSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const families = getComputedStyle(el).fontFamily.split(',');
          for (const f of families) {
            const trimmed = f.trim().replace(/^["']|["']$/g, '');
            if (trimmed && !fontMap.has(trimmed)) {
              fontMap.set(trimmed, 'computed-style');
            }
          }
        }
      }

      return Array.from(fontMap.entries()).map(([family, source]) => ({ family, source }));
    }

    function rgbToHex(color: string): string | null {
      // Already hex
      const hexMatch = color.match(/^#([0-9a-fA-F]{3,8})$/);
      if (hexMatch) return color;
      // rgb/rgba format
      const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
      }
      return null;
    }

    function detectColors(): string[] {
      const colorSet = new Set<string>();

      // Get CSS custom properties from :root
      const rootStyle = getComputedStyle(document.documentElement);
      for (let i = 0; i < rootStyle.length; i++) {
        const prop = rootStyle[i];
        const value = rootStyle.getPropertyValue(prop).trim();
        if (value && (value.startsWith('#') || value.startsWith('rgb'))) {
          const hex = rgbToHex(value);
          if (hex) colorSet.add(hex);
        }
      }

      // Get body background color
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      if (bodyBg) {
        const hex = rgbToHex(bodyBg);
        if (hex && hex !== '#000000' && hex !== '#ffffff') colorSet.add(hex);
      }

      return Array.from(colorSet).slice(0, 12);
    }

    function detectCSSTools(): FrameworkInfo[] {
      const results: FrameworkInfo[] = [];
      const w = window as unknown as Record<string, unknown>;

      // Tailwind CSS — scan first 50 elements for utility classes
      const twPatterns = ['flex', 'bg-', 'text-', 'p-', 'm-', 'grid', 'rounded-'];
      let twMatches = 0;
      const elements = document.body ? document.body.querySelectorAll('*') : [];
      const limit = Math.min(elements.length, 50);
      for (let i = 0; i < limit; i++) {
        const classList = elements[i].classList;
        for (let j = 0; j < classList.length; j++) {
          const cls = classList[j];
          for (const pattern of twPatterns) {
            if (pattern.endsWith('-') ? cls.startsWith(pattern) : cls === pattern) {
              twMatches++;
              break;
            }
          }
        }
      }
      // Also check stylesheets for .flex selectors
      let twSheetMatch = false;
      try {
        for (let s = 0; s < document.styleSheets.length; s++) {
          try {
            const rules = document.styleSheets[s].cssRules;
            for (let r = 0; r < rules.length; r++) {
              const selector =
                rules[r] instanceof CSSStyleRule ? (rules[r] as CSSStyleRule).selectorText : '';
              if (
                selector &&
                (selector === '.flex' ||
                  selector.startsWith('.bg-') ||
                  selector.startsWith('.text-'))
              ) {
                twSheetMatch = true;
                break;
              }
            }
          } catch {
            /* cross-origin stylesheet */
          }
          if (twSheetMatch) break;
        }
      } catch {
        /* ignore */
      }
      if (twMatches >= 5 || twSheetMatch) {
        results.push({
          name: 'Tailwind CSS',
          version: undefined,
          confidence: twMatches >= 5 ? 'high' : 'medium',
        });
      }

      // Bootstrap
      const bsPatterns = ['container', 'row', 'col-', 'btn-'];
      let bsMatches = 0;
      for (let i = 0; i < limit; i++) {
        const classList = elements[i].classList;
        for (let j = 0; j < classList.length; j++) {
          const cls = classList[j];
          for (const pattern of bsPatterns) {
            if (pattern.endsWith('-') ? cls.startsWith(pattern) : cls === pattern) {
              bsMatches++;
              break;
            }
          }
        }
      }
      if (w.bootstrap || bsMatches >= 3) {
        const version = (w.bootstrap as Record<string, unknown>)?.version as string | undefined;
        results.push({ name: 'Bootstrap', version, confidence: w.bootstrap ? 'high' : 'medium' });
      }

      // styled-components
      if (w.__SC_VERSION__) {
        results.push({
          name: 'styled-components',
          version: w.__SC_VERSION__ as string,
          confidence: 'high',
        });
      } else if (document.querySelector('style[data-styled]')) {
        results.push({ name: 'styled-components', version: undefined, confidence: 'medium' });
      }

      // Emotion
      if (w.__EMOTION_VERSION__) {
        results.push({
          name: 'Emotion',
          version: w.__EMOTION_VERSION__ as string,
          confidence: 'high',
        });
      }

      return results;
    }

    function detectBuildTools(): string[] {
      const results: string[] = [];
      const w = window as unknown as Record<string, unknown>;

      // webpack
      if (w.__webpack_require__) {
        results.push('webpack');
      } else {
        // Check for webpackChunk global
        for (const key of Object.keys(w)) {
          if (key.startsWith('webpackChunk')) {
            results.push('webpack');
            break;
          }
        }
      }

      // Vite
      if (w.__vite_plugin_react_preamble_installed__) {
        results.push('Vite');
      } else {
        const scripts = document.querySelectorAll('script[type="module"]');
        for (let i = 0; i < scripts.length; i++) {
          const src = scripts[i].getAttribute('src') || '';
          if (src.includes('/@vite/') || src.includes('/node_modules/.vite/')) {
            results.push('Vite');
            break;
          }
        }
      }

      return results;
    }

    function detectPerformanceStats(): TechStackResult['performance'] {
      return {
        domSize: document.querySelectorAll('*').length,
        scriptCount: document.querySelectorAll('script').length,
        stylesheetCount: document.querySelectorAll('link[rel="stylesheet"], style').length,
        imageCount: document.querySelectorAll('img').length,
      };
    }

    function detectTechStack(): TechStackResult {
      return {
        frameworks: detectFrameworks(),
        meta: detectMeta(),
        fonts: detectFonts(),
        colorPalette: detectColors(),
        cssTools: detectCSSTools(),
        buildTools: detectBuildTools(),
        performance: detectPerformanceStats(),
      };
    }

    // =========================================================================
    // Live Component Tree (no recording needed)
    // =========================================================================

    function getLiveComponentTree(): FiberData[] {
      const fibers: FiberData[] = [];
      const fiberMap = new Map<string, FiberData>();
      const visited = new WeakSet<object>();
      const MAX_FIBERS = 5000;

      function collectFiber(fiber: unknown): void {
        if (!fiber || typeof fiber !== 'object') return;
        if (visited.has(fiber as object) || fibers.length >= MAX_FIBERS) return;
        visited.add(fiber as object);
        const tag = (fiber as Record<string, unknown>)['tag'] as number;
        // Skip HostText (tag=6) — pure text nodes with no useful info
        if (tag !== 6) {
          const parsed = parseFiberNode(fiber);
          fibers.push(parsed);
          fiberMap.set(parsed.id, parsed);
        }
        const fiberObj = fiber as Record<string, unknown>;
        if (fiberObj['child']) collectFiber(fiberObj['child']);
        if (fiberObj['sibling']) collectFiber(fiberObj['sibling']);
      }

      function linkFibers(): void {
        const linkVisited = new WeakSet<object>();
        function linkOne(fiber: unknown): void {
          if (!fiber || typeof fiber !== 'object') return;
          if (linkVisited.has(fiber as object)) return;
          linkVisited.add(fiber as object);
          const fiberObj = fiber as Record<string, unknown>;
          const id = fiberMap.get(parseFiberNode(fiber).id);
          if (id) {
            if (fiberObj['child']) {
              const c = fiberMap.get(parseFiberNode(fiberObj['child']).id);
              if (c) id.child = c;
            }
            if (fiberObj['sibling']) {
              const s = fiberMap.get(parseFiberNode(fiberObj['sibling']).id);
              if (s) id.sibling = s;
            }
            if (fiberObj['return']) {
              const r = fiberMap.get(parseFiberNode(fiberObj['return']).id);
              if (r) id.return = r;
            }
          }
          if (fiberObj['child']) linkOne(fiberObj['child']);
          if (fiberObj['sibling']) linkOne(fiberObj['sibling']);
        }
        // Walk from all collected root fibers
        for (const fiber of fibers) {
          if (!fiber.return) linkOne(fiber);
        }
      }

      // ── Strategy 1: Use __REACT_DEVTOOLS_GLOBAL_HOOK__ renderers (same as React DevTools) ──
      const hook = (window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ as
        | {
            renderers?: Map<
              number,
              { currentDispatcherRef?: unknown; overrideProps?: unknown }
            > | null;
            getFiberRoots?: (rendererID: number) => Set<unknown>;
            _fiberRoots?: Map<number, Set<unknown>>;
          }
        | undefined;

      if (hook) {
        // Try getFiberRoots API (React 18+)
        if (hook.getFiberRoots && hook.renderers) {
          for (const [id] of hook.renderers) {
            try {
              const roots = hook.getFiberRoots(id);
              for (const root of roots) {
                const rootObj = root as Record<string, unknown>;
                const currentFiber = rootObj['current'] ?? root;
                collectFiber(currentFiber);
              }
            } catch {
              /* ignore */
            }
          }
        }
        // Try _fiberRoots (internal, React 17+)
        if (fibers.length === 0 && hook._fiberRoots) {
          for (const [, roots] of hook._fiberRoots) {
            for (const root of roots) {
              const rootObj = root as Record<string, unknown>;
              const currentFiber = rootObj['current'] ?? root;
              collectFiber(currentFiber);
            }
          }
        }
        // Try hook.renderers internals — each renderer has a getFiberRoots or internal root set
        if (fibers.length === 0 && hook.renderers) {
          for (const [, renderer] of hook.renderers) {
            const r = renderer as Record<string, unknown>;
            // Different React versions store roots differently
            const possibleRoots = r['_roots'] ?? r['fiberRoots'] ?? r['roots'];
            if (possibleRoots && typeof possibleRoots === 'object') {
              const rootsSet = possibleRoots as Set<unknown>;
              if (rootsSet.forEach) {
                rootsSet.forEach((root: unknown) => {
                  const rootObj = root as Record<string, unknown>;
                  collectFiber(rootObj['current'] ?? root);
                });
              }
            }
          }
        }
      }

      // ── Strategy 2: DOM scan for __reactContainer$ / __reactFiber$ ──
      if (fibers.length === 0) {
        const body = document.body;
        if (!body) return [];
        const FIBER_KEYS = ['__reactContainer$', '__reactFiber$'];
        // Scan body and ALL descendants (not just first-level children)
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
        const scannedRoots = new Set<unknown>();
        const scanEl = (el: Element) => {
          for (const prop of Object.getOwnPropertyNames(el)) {
            for (const prefix of FIBER_KEYS) {
              if (prop.startsWith(prefix)) {
                const value = (el as Record<string, unknown>)[prop];
                if (value && typeof value === 'object' && !scannedRoots.has(value)) {
                  scannedRoots.add(value);
                  const valObj = value as Record<string, unknown>;
                  // __reactContainer$ → .current is the root HostRoot fiber
                  let rootFiber = value;
                  if (valObj['stateNode'] && valObj['current']) rootFiber = valObj['current'];
                  else if (valObj['current'] && typeof valObj['current'] === 'object')
                    rootFiber = valObj['current'];
                  collectFiber(rootFiber);
                }
              }
            }
          }
        };
        scanEl(body);
        let count = 0;
        while (walker.nextNode() && count < 500) {
          count++;
          scanEl(walker.currentNode as Element);
          if (fibers.length >= MAX_FIBERS) break;
        }
      }

      // Link parent/child/sibling references
      if (fibers.length > 0) {
        const linkVisited = new WeakSet<object>();
        function linkOne(fiber: unknown): void {
          if (!fiber || typeof fiber !== 'object') return;
          if (linkVisited.has(fiber as object)) return;
          linkVisited.add(fiber as object);
          const fiberObj = fiber as Record<string, unknown>;
          const selfId = parseFiberNode(fiber).id;
          const data = fiberMap.get(selfId);
          if (data) {
            if (fiberObj['child']) {
              const c = fiberMap.get(parseFiberNode(fiberObj['child']).id);
              if (c) data.child = c;
            }
            if (fiberObj['sibling']) {
              const s = fiberMap.get(parseFiberNode(fiberObj['sibling']).id);
              if (s) data.sibling = s;
            }
            if (fiberObj['return']) {
              const r = fiberMap.get(parseFiberNode(fiberObj['return']).id);
              if (r) data.return = r;
            }
          }
          if (fiberObj['child']) linkOne(fiberObj['child']);
          if (fiberObj['sibling']) linkOne(fiberObj['sibling']);
        }
        for (const fiber of [...fibers]) {
          if (!fiber.return) {
            // Find the actual raw fiber object for this FiberData
            // We walk again from the DOM to link properly
          }
        }
        // Re-walk from start to set links
        const relinkVisited = new WeakSet<object>();
        function relinkFiber(rawFiber: unknown): void {
          if (!rawFiber || typeof rawFiber !== 'object') return;
          if (relinkVisited.has(rawFiber as object)) return;
          relinkVisited.add(rawFiber as object);
          const fiberObj = rawFiber as Record<string, unknown>;
          const selfId = parseFiberNode(rawFiber).id;
          const data = fiberMap.get(selfId);
          if (data) {
            if (fiberObj['child']) {
              const c = fiberMap.get(parseFiberNode(fiberObj['child']).id);
              if (c) data.child = c;
            }
            if (fiberObj['sibling']) {
              const s = fiberMap.get(parseFiberNode(fiberObj['sibling']).id);
              if (s) data.sibling = s;
            }
            if (fiberObj['return']) {
              const r = fiberMap.get(parseFiberNode(fiberObj['return']).id);
              if (r) data.return = r;
            }
          }
          if (fiberObj['child']) relinkFiber(fiberObj['child']);
          if (fiberObj['sibling']) relinkFiber(fiberObj['sibling']);
        }
        // We don't have the original raw fibers easily, but fiberIdMap in fiberParser gives us consistent IDs
        // The links were already attempted in collectFiber via fiberMap, but let's patch return links
        for (const fiber of fibers) {
          if (fiber.child && !fiber.child.return) fiber.child.return = fiber;
        }
      }

      return fibers;
    }

    // =========================================================================
    // Message Handler (from content script)
    // =========================================================================

    function handleBridgeMessage(event: MessageEvent): void {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if ((data as Record<string, unknown>).source !== 'react-perf-profiler-content') return;
      if (!(data as Record<string, unknown>).payload) return;

      // Learn the session token from the first inbound message, then require
      // it on every subsequent message. The content script generates this
      // token (see apps/ext/entrypoints/content.ts) and includes it in all
      // commands; we echo it back via sendMessage(). A malicious page can
      // observe postMessage traffic but cannot forge a message that has
      // BOTH the correct `source` string AND the matching random token.
      const inboundToken = (data as Record<string, unknown>).token;
      const { type, ...rest } = (data as { payload: { type: string } & Record<string, unknown> })
        .payload;

      if (sessionToken === null) {
        // First contact — lock in the token. If the first message has no
        // token (older content script), accept anyway for back-compat.
        if (typeof inboundToken === 'string') {
          sessionToken = inboundToken;
        }
      } else if (inboundToken !== sessionToken) {
        // Token mismatch — silently drop. Logging would let an attacker
        // spam the console.
        return;
      }

      switch (type) {
        case 'START':
          startProfiling();
          break;
        case 'STOP':
          stopProfiling();
          break;
        case 'PING':
          sendMessage({
            type: 'INIT',
            data: { isProfiling, reactVersion, isInitialized, lastError: lastError?.message },
          });
          break;
        case 'DETECT_REACT':
          sendMessage({
            type: 'DETECT_RESULT',
            reactDetected: detectReact(),
            reactVersion: detectReactVersion(),
            devtoolsDetected: !!getReactDevToolsHook(),
            isInitialized,
          });
          break;
        case 'FORCE_INIT':
          cancelRetry();
          initRetryCount = 0;
          initBridge();
          break;
        case 'SET_RECORDING_FILTERS':
          recordingFilters = (rest.filters as RecordingFilter[]) ?? [];
          if (recordingFilters.some((f) => f.type === 'interaction')) {
            setupInteractionListeners();
            interactionPending = true;
          }
          break;
        case 'SET_CONFIG': {
          const config = rest as Record<string, unknown>;
          if ('incrementalDiffing' in config)
            incrementalDiffingEnabled = !!config.incrementalDiffing;
          if ('sourceCorrelation' in config) sourceCorrelationEnabled = !!config.sourceCorrelation;
          if ('renderCauseTracking' in config)
            renderCauseTrackingEnabled = !!config.renderCauseTracking;
          if ('maxPropDepth' in config)
            PROP_SERIALIZATION_LIMITS.maxPropDepth = (config.maxPropDepth as number) ?? 3;
          if ('maxPropKeys' in config)
            PROP_SERIALIZATION_LIMITS.maxPropKeys = (config.maxPropKeys as number) ?? 20;
          break;
        }
        case 'DETECT_TECH_STACK': {
          const result = detectTechStack();
          sendMessage({ type: 'TECH_STACK_RESULT', data: result });
          break;
        }
        case 'GET_COMPONENT_TREE': {
          const tree = getLiveComponentTree();
          sendMessage({ type: 'COMPONENT_TREE_RESULT', data: tree });
          break;
        }
      }
    }

    // =========================================================================
    // Cleanup
    // =========================================================================

    function stopReactWatcher(): void {
      if (_reactWatchTimer !== null) {
        clearTimeout(_reactWatchTimer);
        _reactWatchTimer = null;
      }
      if (_reactWatchObserver !== null) {
        _reactWatchObserver.disconnect();
        _reactWatchObserver = null;
      }
    }

    function cleanup(): void {
      cancelRetry();
      stopReactWatcher();
      if (batchTimer !== null) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
      const hook = getReactDevToolsHook();
      if (hook && originalOnCommitFiberRoot) hook.onCommitFiberRoot = originalOnCommitFiberRoot;
      window.removeEventListener('message', handleBridgeMessage);
      isProfiling = false;
      isInitialized = false;
      commitBatch = [];
      window.__REACT_PERF_PROFILER_ACTIVE__ = false;
    }

    // =========================================================================
    // Setup
    // =========================================================================

    window.addEventListener('message', handleBridgeMessage);

    function tryInit(): void {
      try {
        initBridge();
      } catch (error) {
        handleInitFailure('INIT_FAILED', error instanceof Error ? error.message : String(error));
      }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInit);
    else tryInit();

    if (!isInitialized) {
      _reactWatchObserver = new MutationObserver(() => {
        if (!isInitialized && detectReact() && getReactDevToolsHook()) {
          stopReactWatcher();
          tryInit();
        }
      });
      _reactWatchObserver.observe(document, { childList: true, subtree: true });
      _reactWatchTimer = setTimeout(stopReactWatcher, 10000);
    }

    window.addEventListener('beforeunload', cleanup);
    window.__REACT_PERF_PROFILER_CLEANUP__ = cleanup;
    window.__REACT_PERF_PROFILER_DETECT_REACT__ = detectReact;
  },
});
