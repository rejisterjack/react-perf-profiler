import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WelcomeScreen } from './components/Layout/WelcomeScreen';
import { PanelLayout } from './components/Layout/PanelLayout';
import { Toolbar } from './components/Layout/Toolbar';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useConnectionStore } from './stores/connectionStore';
import { useProfilerStore } from './stores/profilerStore';
import styles from './App.module.css';

/**
 * Connection error display component
 */
const ConnectionError: React.FC<{
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}> = ({ error, onRetry, isRetrying }) => {
  // Parse error to provide better messages
  const getErrorDetails = () => {
    if (error.includes('React DevTools')) {
      return {
        title: 'React DevTools Not Found',
        message: 'React Perf Profiler requires the React DevTools browser extension to be installed.',
        action: 'Install React DevTools',
        actionUrl: 'https://react.dev/learn/react-developer-tools',
      };
    }
    if (error.includes('React not detected')) {
      return {
        title: 'React Not Detected',
        message: 'This page does not appear to be using React, or it is using a production build.',
        action: 'View Setup Guide',
        actionUrl: 'https://react.dev/learn/thinking-in-react',
      };
    }
    return {
      title: 'Connection Error',
      message: error,
      action: null,
      actionUrl: null,
    };
  };

  const details = getErrorDetails();

  return (
    <div className={styles["errorContainer"]}>
      <div className={styles["errorContent"]}>
        <div className={styles["errorIcon"]}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2>{details.title}</h2>
        <p>{details.message}</p>
        <div className={styles["errorActions"]}>
          <button 
            onClick={onRetry} 
            disabled={isRetrying}
            className={styles["retryButton"]}
          >
            {isRetrying ? (
              <>
                <span className={styles["spinner"]} />
                Retrying...
              </>
            ) : (
              'Retry Connection'
            )}
          </button>
          {details.action && details.actionUrl && (
            <a 
              href={details.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles["helpLink"]}
            >
              {details.action}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Banner shown when a previous session can be restored from IndexedDB
 */
const SessionRestoreBanner: React.FC<{
  commitCount: number;
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}> = ({ commitCount, savedAt, onRestore, onDiscard }) => (
  <div className={styles['restoreBanner']} role="alert">
    <span>
      Previous session ({commitCount} commits, saved{' '}
      {new Date(savedAt).toLocaleTimeString()}) available.
    </span>
    <button onClick={onRestore} className={styles['restoreButton']}>
      Restore
    </button>
    <button onClick={onDiscard} className={styles['discardButton']}>
      Discard
    </button>
  </div>
);

/**
 * Main App component
 */
export const App: React.FC = () => {
  const { isConnected, lastError, connect, sendMessage } = useConnectionStore();
  const { isRecording, commits } = useProfilerStore();
  const [isRetrying, setIsRetrying] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const { hasPersistedSession, persistedSession, restoreSession, discardSession } =
    useSessionPersistence();

  // Set up message handlers
  useEffect(() => {
    const { addMessageHandler } = useConnectionStore.getState();

    const unsubscribe = addMessageHandler((message) => {
      switch (message.type) {
        case 'COMMIT_DATA':
          useProfilerStore.getState().addCommit(message.payload);
          // Hide welcome screen when we receive data
          if (message.payload) {
            setShowWelcome(false);
          }
          break;
        case 'BRIDGE_INIT':
          // Bridge initialized successfully
          if (message.payload?.success) {
            setIsRetrying(false);
          }
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Handle retry connection
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      // Force re-initialization
      sendMessage({ type: 'FORCE_INIT' });
      
      // Also try to reconnect
      connect();
      
      // Wait a bit and then check status
      setTimeout(() => {
        sendMessage({ type: 'DETECT_REACT' });
      }, 1000);
    } finally {
      // Reset retry state after timeout
      setTimeout(() => setIsRetrying(false), 5000);
    }
  }, [connect, sendMessage]);

  // Show connection error
  if (lastError && !isConnected) {
    return (
      <ErrorBoundary context="React Perf Profiler">
        <ConnectionError 
          error={lastError} 
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      </ErrorBoundary>
    );
  }

  // Show welcome screen when no data and not recording
  if (showWelcome && commits.length === 0 && !isRecording) {
    return (
      <ErrorBoundary context="React Perf Profiler">
        <div className={styles["app"]}>
          <ErrorBoundary context="toolbar" compact>
            <Toolbar />
          </ErrorBoundary>
          <WelcomeScreen />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary context="React Perf Profiler">
      <div className={styles["app"]} data-recording={isRecording}>
        <ErrorBoundary context="toolbar" compact>
          <Toolbar />
        </ErrorBoundary>
        {hasPersistedSession && persistedSession && (
          <SessionRestoreBanner
            commitCount={persistedSession.commitCount}
            savedAt={persistedSession.savedAt}
            onRestore={restoreSession}
            onDiscard={discardSession}
          />
        )}
        <ErrorBoundary context="panel layout">
          <PanelLayout />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
};

export default App;
