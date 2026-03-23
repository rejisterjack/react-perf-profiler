import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './components/Theme/ThemeProvider';
import './styles/global.css';
import './styles/variables.css';

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

// Mount React app with null check
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Fatal: Could not find root element');
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
