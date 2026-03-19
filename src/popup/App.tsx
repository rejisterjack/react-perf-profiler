import type React from 'react';
import { useEffect, useState } from 'react';

export const App: React.FC = () => {
  const [hasReact, setHasReact] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if React is present on the current page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'CHECK_REACT' }, (response) => {
          if (chrome.runtime.lastError) {
            setHasReact(false);
            return;
          }
          setHasReact(response?.hasReact ?? false);
        });
      }
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
          href="https://github.com/yourusername/react-perf-profiler"
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
