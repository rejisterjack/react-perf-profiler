import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './components/Theme/ThemeProvider';
import { initSentry } from '@/shared/sentry';
import './styles/global.css';
import './styles/variables.css';

// Initialize error reporting (no-op if VITE_SENTRY_DSN is not set)
initSentry();

// Connect to background script
import { useConnectionStore } from './stores/connectionStore';

// Initialize connection when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Connect to background
  useConnectionStore.getState().connect();
});

// Handle panel visibility changes
window.addEventListener('message', (event) => {
  if (event.data?.type === 'PANEL_SHOWN') {
    // Panel is visible, ensure connection
    useConnectionStore.getState().connect();
  }
});

// Cleanup timers on panel unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  useConnectionStore.getState().disconnect();
});

// Detect extension context invalidation (extension updated while panel open)
setInterval(() => {
  try {
    chrome.runtime?.id;
  } catch {
    // Context invalidated — extension was updated or reloaded
    const banner = document.createElement('div');
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#000;' +
      'padding:10px 16px;font:600 13px system-ui;text-align:center;';
    banner.textContent = 'Extension updated — close and reopen DevTools to continue profiling.';
    document.body.appendChild(banner);
  }
}, 5000);

// Mount React app with null check
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element');
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
