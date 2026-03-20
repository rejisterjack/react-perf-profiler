/**
 * DevTools Panel Registration
 *
 * Registers the React Perf Profiler panel in browser DevTools
 * using the cross-browser adapter for Chrome/Firefox compatibility.
 */

import { createDevToolsPanel, detectBrowser } from '@/shared/browser';

async function initializeDevToolsPanel(): Promise<void> {
  const browserType = detectBrowser();
  console.log(`[React Perf Profiler] Initializing DevTools panel on ${browserType}`);

  // Check if DevTools API is available
  if (browserType === 'unknown') {
    console.error('[React Perf Profiler] DevTools API not available - unsupported browser');
    return;
  }

  try {
    // Create the DevTools panel using the cross-browser adapter
    const panel = await createDevToolsPanel({
      title: '⚡ Perf Profiler',
      iconPath: 'icons/icon16.png',
      pagePath: 'panel/index.html',
    });

    console.log(`[React Perf Profiler] Panel "${panel.title}" created successfully`);

    // Set up panel show/hide event listeners
    panel.onShown(() => {
      console.log('[React Perf Profiler] Panel shown');
    });

    panel.onHidden(() => {
      console.log('[React Perf Profiler] Panel hidden');
    });
  } catch (error) {
    console.error('[React Perf Profiler] Failed to create DevTools panel:', error);
  }
}

// Initialize the panel when the script loads
initializeDevToolsPanel();

// Optional: Add sidebar pane for element inspection
// chrome.devtools.panels.elements.createSidebarPane(...)
