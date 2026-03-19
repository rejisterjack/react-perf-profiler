// Register the DevTools panel
chrome.devtools.panels.create(
  'Perf Profiler', // Panel title
  'icons/icon16.png', // Icon
  'panel/index.html', // Panel HTML page
  (panel) => {

    // Set up panel show/hide events
    panel.onShown.addListener((window) => {
      // Panel is now visible
      window.postMessage({ type: 'PANEL_SHOWN' }, '*');
    });

    panel.onHidden.addListener(() => {
      // Panel is now hidden
    });
  }
);

// Optional: Add sidebar pane for element inspection
// chrome.devtools.panels.elements.createSidebarPane(...)
