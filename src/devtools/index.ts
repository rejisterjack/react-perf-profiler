/**
 * DevTools Panel Registration
 *
 * Registers the React Perf Profiler panel in browser DevTools
 * using the cross-browser adapter for Chrome/Firefox compatibility.
 */

import { createDevToolsPanel, detectBrowser } from '@/shared/browser';
import { logger } from '@/shared/logger';

async function initializeDevToolsPanel(): Promise<void> {
  const browserType = detectBrowser();
  logger.info(`Initializing DevTools panel on ${browserType}`, { source: 'DevTools' });

  // Check if DevTools API is available
  if (browserType === 'unknown') {
    logger.error('DevTools API not available - unsupported browser', { source: 'DevTools' });
    return;
  }

  try {
    // Create the DevTools panel using the cross-browser adapter
    const panel = await createDevToolsPanel({
      title: '⚡ Perf Profiler',
      iconPath: 'icons/icon16.png',
      pagePath: 'src/panel/index.html',
    });

    logger.info(`Panel "${panel.title}" created successfully`, { source: 'DevTools' });

    panel.onShown(() => {
      logger.debug('Panel shown', { source: 'DevTools' });
    });

    panel.onHidden(() => {
      logger.debug('Panel hidden', { source: 'DevTools' });
    });
  } catch (error) {
    logger.error('Failed to create DevTools panel', {
      error: error instanceof Error ? error.message : String(error),
      source: 'DevTools'
    });
  }
}

// Initialize the panel when the script loads
initializeDevToolsPanel();
