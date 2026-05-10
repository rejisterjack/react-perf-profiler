/**
 * App Component — Root of the DevTools panel
 *
 * Orchestrates connection lifecycle, message routing, and top-level layout.
 * Sub-components are kept in dedicated files for modularity.
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './App.module.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConnectionError } from './components/Layout/ConnectionError';
import { PanelLayout } from './components/Layout/PanelLayout';
import { SessionRestoreBanner } from './components/Layout/SessionRestoreBanner';
import { Toolbar } from './components/Layout/Toolbar';
import { WelcomeScreen } from './components/Layout/WelcomeScreen';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useConnectionStore } from './stores/connectionStore';
import { useProfilerStore } from './stores/profilerStore';
import { NotificationContainer } from './components/Notifications/NotificationContainer';
import { FirstRunOverlay } from './components/Onboarding/FirstRunOverlay';

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

  // Ref to store timeout IDs for cleanup
  const retryTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Guard against stacking multiple retry flows
  const retryInFlightRef = useRef(false);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      retryTimeoutsRef.current.forEach(clearTimeout);
      retryTimeoutsRef.current = [];
    };
  }, []);

  // Set up message handlers
  useEffect(() => {
    const { addMessageHandler } = useConnectionStore.getState();

    const unsubscribe = addMessageHandler((message) => {
      switch (message.type) {
        case 'COMMIT_DATA':
          useProfilerStore.getState().addCommit(message.payload);
          if (message.payload) {
            setShowWelcome(false);
          }
          break;
        case 'BRIDGE_INIT':
          if (message.payload?.success) {
            setIsRetrying(false);
            retryInFlightRef.current = false;
          }
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Handle retry connection with debounce guard
  const handleRetry = useCallback(() => {
    if (retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    setIsRetrying(true);

    // Clear any existing timeouts
    retryTimeoutsRef.current.forEach(clearTimeout);
    retryTimeoutsRef.current = [];

    try {
      sendMessage({ type: 'FORCE_INIT' });
      connect();

      retryTimeoutsRef.current.push(
        setTimeout(() => {
          sendMessage({ type: 'DETECT_REACT' });
        }, 1000)
      );
    } finally {
      retryTimeoutsRef.current.push(
        setTimeout(() => {
          const currentState = useConnectionStore.getState();
          if (!currentState.isConnected) {
            setIsRetrying(false);
          }
          retryInFlightRef.current = false;
        }, 5000)
      );
    }
  }, [connect, sendMessage]);

  // ── Connection error state ──────────────────────────────────────────────
  if (lastError && !isConnected) {
    return (
      <ErrorBoundary context="React Perf Profiler">
        <ConnectionError error={lastError} onRetry={handleRetry} isRetrying={isRetrying} />
      </ErrorBoundary>
    );
  }

  // ── Welcome / empty state ───────────────────────────────────────────────
  if (showWelcome && commits.length === 0 && !isRecording) {
    return (
      <ErrorBoundary context="React Perf Profiler">
        <div className={styles.app}>
          <ErrorBoundary context="toolbar" compact>
            <Toolbar />
          </ErrorBoundary>
          <div className={styles.scrollArea}>
            <WelcomeScreen />
          </div>
          <NotificationContainer />
        </div>
      </ErrorBoundary>
    );
  }

  // ── Main profiler interface ─────────────────────────────────────────────
  return (
    <ErrorBoundary context="React Perf Profiler">
      <FirstRunOverlay />
      <div className={styles.app} data-recording={isRecording}>
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

        <NotificationContainer />
      </div>
    </ErrorBoundary>
  );
};

export default App;
