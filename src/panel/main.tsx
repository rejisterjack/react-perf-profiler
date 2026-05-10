import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './components/Theme/ThemeProvider';
import { initSentry } from '@/shared/sentry';
import './styles/global.css';
import './styles/variables.css';

// Initialize error reporting (no-op if VITE_SENTRY_DSN is not set)
initSentry();

// Lazy-import the store to avoid top-level side effects before DOM ready
const getConnectionStore = () =>
  import('./stores/connectionStore').then((m) => m.useConnectionStore);

// ---------------------------------------------------------------------------
// Extension Context Invalidation Detection
//
// Instead of a polling setInterval (which wastes cycles and never clears),
// we check on visibilitychange — only when the user actually returns to the
// DevTools tab. A one-time error listener also catches runtime disconnects.
// ---------------------------------------------------------------------------

let contextInvalidated = false;

function showInvalidationBanner(): void {
  if (contextInvalidated) return;
  contextInvalidated = true;

  const banner = document.createElement('div');
  banner.setAttribute('role', 'alert');
  banner.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:99999',
    'background:#d29922',
    'color:#0d1117',
    'padding:10px 16px',
    'font:600 13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    'text-align:center',
    'letter-spacing:-0.01em',
  ].join(';');
  banner.textContent =
    'Extension updated — close and reopen DevTools to continue profiling.';
  document.body.appendChild(banner);
}

function checkContextValidity(): void {
  try {
    // Accessing chrome.runtime.id throws if the extension context is invalid
    void chrome.runtime?.id;
  } catch {
    showInvalidationBanner();
  }
}

// Check on visibility change (user switches back to DevTools)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkContextValidity();
  }
});

// Also catch the runtime disconnect event
try {
  chrome.runtime?.onConnect?.addListener(() => {
    // No-op: just need the listener to keep the runtime alive
  });
} catch {
  // Extension context already invalid at load time
  showInvalidationBanner();
}

// ---------------------------------------------------------------------------
// Panel Lifecycle
// ---------------------------------------------------------------------------

// Handle panel visibility changes
window.addEventListener('message', (event) => {
  if (event.data?.type === 'PANEL_SHOWN') {
    getConnectionStore().then((store) => store.getState().connect());
  }
});

// Cleanup on panel unload
window.addEventListener('beforeunload', () => {
  getConnectionStore().then((store) => store.getState().disconnect());
});

// ---------------------------------------------------------------------------
// Mount the React application
// ---------------------------------------------------------------------------

function mountApp(): void {
  // Initialise connection
  getConnectionStore().then((store) => store.getState().connect());

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Could not find #root element — panel/index.html is malformed.');
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  );
}

// Ensure DOM is ready before mounting
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp, { once: true });
} else {
  mountApp();
}
