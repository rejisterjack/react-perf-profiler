import type React from 'react';
import { useEffect } from 'react';
import { PanelLayout } from './components/Layout/PanelLayout';
import { Toolbar } from './components/Layout/Toolbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useConnectionStore } from './stores/connectionStore';
import { useProfilerStore } from './stores/profilerStore';
import styles from './App.module.css';

export const App: React.FC = () => {
  const { isConnected, lastError } = useConnectionStore();
  const { isRecording } = useProfilerStore();

  // Set up message handlers
  useEffect(() => {
    const { addMessageHandler } = useConnectionStore.getState();

    const unsubscribe = addMessageHandler((message) => {
      switch (message.type) {
        case 'COMMIT_DATA':
          useProfilerStore.getState().addCommit(message.payload);
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Show connection error
  if (lastError && !isConnected) {
    return (
      <div className={styles["errorContainer"]}>
        <h2>Connection Error</h2>
        <p>{lastError}</p>
        <button onClick={() => useConnectionStore.getState().connect()}>Retry Connection</button>
      </div>
    );
  }

  return (
    <ErrorBoundary context="React Perf Profiler">
      <div className={styles["app"]} data-recording={isRecording}>
        <ErrorBoundary context="toolbar">
          <Toolbar />
        </ErrorBoundary>
        <ErrorBoundary context="panel layout">
          <PanelLayout />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
};
