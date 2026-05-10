chrome.devtools.panels.create(
  'Perf Profiler',
  'icons/icon16.png',
  'src/panel/index.html',
  function(panel) {
    if (chrome.runtime.lastError) {
      console.error('[PerfProfiler] Failed to create panel:', chrome.runtime.lastError.message);
    } else {
      console.log('[PerfProfiler] Panel created successfully');
    }
  }
);
