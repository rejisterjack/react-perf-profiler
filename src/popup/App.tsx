import type React from 'react';
import { useEffect, useState } from 'react';

export const App: React.FC = () => {
  const [hasReact, setHasReact] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if React is present on the current page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;

      // Use scripting.executeScript to detect React directly in the page context.
      // This works even if the content script hasn't finished loading (CRXJS async modules).
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          world: 'MAIN',
          func: () => {
            // Check DevTools hook
            if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return true;
            // React globals
            if (window.React || window.__REACT__) return true;

            // Check root containers for React 18+ internal properties
            const roots = document.querySelectorAll('#root, #app, #__next, #__nuxt');
            for (let i = 0; i < roots.length; i++) {
              const el = roots[i];
              if (!el) continue;
              const names = Object.getOwnPropertyNames(el);
              for (let j = 0; j < names.length; j++) {
                const n = names[j];
                if (n && (n.startsWith('__reactContainer$') || n.startsWith('_reactRootContainer'))) {
                  return true;
                }
              }
            }

            // Check child elements for React fiber markers
            const selectors = ['#root > *', '#app > *', '#__next > *', 'body > div'];
            for (const sel of selectors) {
              try {
                const els = document.querySelectorAll(sel);
                for (let e = 0; e < Math.min(els.length, 10); e++) {
                  const el = els[e];
                  if (!el) continue;
                  const pnames = Object.getOwnPropertyNames(el);
                  for (let p = 0; p < pnames.length; p++) {
                    const pn = pnames[p];
                    if (pn && (pn.startsWith('__react') || pn.startsWith('_react'))) {
                      return true;
                    }
                  }
                }
              } catch (_) {}
            }

            return false;
          },
        },
        (results) => {
          if (chrome.runtime.lastError) {
            setError(chrome.runtime.lastError.message ?? 'Unknown error');
            setHasReact(false);
            return;
          }
          const detected = results?.[0]?.result === true;
          setHasReact(detected);
        },
      );
    });
  }, []);

  return (
    <div style={styles["container"]}>
      <header style={styles["header"]}>
        <h1 style={styles["title"]}>React Perf Profiler</h1>
        <p style={styles["subtitle"]}>Performance analysis for React applications</p>
      </header>

      <main style={styles["main"]}>
        {hasReact === null && <p style={styles["text"]}>Checking for React...</p>}

        {hasReact === false && (
          <div style={styles["alert"]}>
            <p style={styles["alertText"]}>⚠️ React was not detected on this page.</p>
            <p style={styles["hint"]}>
              Make sure you're on a page that uses React, or try refreshing.
            </p>
            {error && (
              <p style={{ ...styles["hint"], color: '#f14c4c', marginTop: '8px', wordBreak: 'break-all' }}>
                Debug: {error}
              </p>
            )}
          </div>
        )}

        {hasReact === true && (
          <div style={styles["success"]}>
            <p style={styles["successText"]}>✅ React detected!</p>
            <p style={styles["instruction"]}>
              Open Chrome DevTools and select the <strong>"Perf Profiler"</strong> panel to start
              profiling.
            </p>
            <ol style={styles["steps"]}>
              <li>Press F12 or Ctrl+Shift+J (Cmd+Option+J on Mac)</li>
              <li>Click the "Perf Profiler" tab</li>
              <li>Click the record button to start profiling</li>
            </ol>
          </div>
        )}
      </main>

      <footer style={styles["footer"]}>
        <a
          href="https://github.com/rejisterjack/react-perf-profiler"
          target="_blank"
          rel="noopener noreferrer"
          style={styles["link"]}
        >
          GitHub
        </a>
        <span style={styles["separator"]}>•</span>
        <span style={styles["version"]}>v1.0.0</span>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '400px',
    padding: '16px',
  },
  header: {
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #3c3c3c',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#4ec9b0',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#808080',
  },
  main: {
    flex: 1,
  },
  text: {
    color: '#d4d4d4',
    textAlign: 'center',
    padding: '20px 0',
  },
  alert: {
    background: '#3c1e1e',
    border: '1px solid #f14c4c',
    borderRadius: '6px',
    padding: '16px',
  },
  alertText: {
    color: '#f14c4c',
    fontWeight: 500,
    marginBottom: '8px',
  },
  hint: {
    color: '#808080',
    fontSize: '12px',
  },
  success: {
    background: '#1e3c2f',
    border: '1px solid #4ec9b0',
    borderRadius: '6px',
    padding: '16px',
  },
  successText: {
    color: '#4ec9b0',
    fontWeight: 500,
    marginBottom: '12px',
  },
  instruction: {
    color: '#d4d4d4',
    marginBottom: '12px',
    lineHeight: 1.5,
  },
  steps: {
    color: '#9cdcfe',
    fontSize: '12px',
    paddingLeft: '20px',
    lineHeight: 1.8,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    paddingTop: '16px',
    borderTop: '1px solid #3c3c3c',
    fontSize: '12px',
    color: '#808080',
  },
  link: {
    color: '#4ec9b0',
    textDecoration: 'none',
  },
  separator: {
    color: '#3c3c3c',
  },
  version: {
    color: '#808080',
  },
};
