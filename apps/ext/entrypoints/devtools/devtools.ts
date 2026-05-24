/**
 * DevTools Page — registers the React Perf Profiler panel
 */
import { browser } from 'wxt/browser';

// Wait for devtools API to be available, then create panel
browser.devtools.panels.create(
  'React Perf',
  '/icon/icon16.png',
  '/devtools-panel.html',
);
