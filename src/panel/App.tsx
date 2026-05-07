import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './App.module.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PanelLayout } from './components/Layout/PanelLayout';
import { Toolbar } from './components/Layout/Toolbar';
import { WelcomeScreen } from './components/Layout/WelcomeScreen';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useConnectionStore } from './stores/connectionStore';
import { useProfilerStore } from './stores/profilerStore';
import { t } from '@/shared/i18n';
import { NotificationContainer } from './components/Notifications/NotificationContainer';
import { FirstRunOverlay } from './components/Onboarding/FirstRunOverlay';

/**
 * Connection error display component
 */
const ConnectionError: React.FC<{
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}> = ({ error, onRetry, isRetrying }) => {
  const getErrorDetails = () => {
    const lower = error.toLowerCase();

    if (lower.includes('devtools') && (lower.includes('not found') || lower.includes('missing') || lower.includes('hook'))) {
      return {
        title: t('error.reactDevtoolsMissing'),
        message:
          t('error.reactDevtoolsMissingMsg'),
        action: t('error.reactDevtoolsMissingAction'),
        actionUrl: 'https://react.dev/learn/react-developer-tools',
        steps: [
          t('error.reactDevtoolsMissing.step1'),
          t('error.reactDevtoolsMissing.step2'),
          t('error.reactDevtoolsMissing.step3'),
        ],
      };
    }
    if (lower.includes('react') && (lower.includes('not detected') || lower.includes('not found'))) {
      return {
        title: t('error.reactNotDetected'),
        message: t('error.reactNotDetectedMsg'),
        action: t('error.reactNotDetectedAction'),
        actionUrl: 'https://react.dev/learn/thinking-in-react',
        steps: [
          t('error.reactNotDetected.step1'),
          t('error.reactNotDetected.step2'),
          t('error.reactNotDetected.step3'),
        ],
      };
    }
    if (lower.includes('csp') || lower.includes('content security policy')) {
      return {
        title: t('error.cspBlocked'),
        message: t('error.cspBlockedMsg'),
        action: null,
        actionUrl: null,
        steps: [
          t('error.cspBlocked.step1'),
          t('error.cspBlocked.step2'),
          t('error.cspBlocked.step3'),
        ],
      };
    }
    if (lower.includes('context') && (lower.includes('invalidated') || lower.includes('disconnected'))) {
      return {
        title: t('error.contextInvalidated'),
        message: t('error.contextInvalidatedMsg'),
        action: null,
        actionUrl: null,
        steps: [
          t('error.contextInvalidated.step1'),
          t('error.contextInvalidated.step2'),
          t('error.contextInvalidated.step3'),
        ],
      };
    }
    if (lower.includes('storage') && lower.includes('full')) {
      return {
        title: t('error.storageFull'),
        message: t('error.storageFullMsg'),
        action: null,
        actionUrl: null,
        steps: [
          'Open Settings and click "Clear Profile Data"',
          'Or reduce "Max Commits" in advanced settings',
          t('error.storageFull.step3'),
        ],
      };
    }
    if (lower.includes('navigated') || lower.includes('page') && lower.includes('closed')) {
      return {
        title: t('error.pageNavigated'),
        message: t('error.pageNavigatedMsg'),
        action: null,
        actionUrl: null,
        steps: [
          t('error.pageNavigated.step1'),
          t('error.pageNavigated.step2'),
          t('error.pageNavigated.step3'),
        ],
      };
    }
    return {
      title: t('error.generic'),
      message: error,
      action: null,
      actionUrl: null,
      steps: [
        t('error.generic.step1'),
        t('error.generic.step2'),
        t('error.generic.step3'),
      ],
    };
  };

  const details = getErrorDetails();

  return (
    <div className={styles['errorContainer']}>
      <div className={styles['errorContent']}>
        <div className={styles['errorIcon']}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            role="img"
            aria-label="Error"
          >
            <title>Error icon</title>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2>{details.title}</h2>
        <p>{details.message}</p>
        {details.steps && details.steps.length > 0 && (
          <ol className={styles['errorSteps']} style={{
            textAlign: 'left',
            paddingLeft: '20px',
            margin: '12px 0',
            fontSize: '12px',
            color: '#94a3b8',
            lineHeight: '1.8',
          }}>
            {details.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        <div className={styles['errorActions']}>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className={styles['retryButton']}
          >
            {isRetrying ? (
              <>
                <span className={styles['spinner']} />
                {t('error.retrying')}
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
              className={styles['helpLink']}
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
      {t('session.previousAvailable')} ({commitCount} commits, saved {new Date(savedAt).toLocaleTimeString()})
    </span>
    <button type="button" onClick={onRestore} className={styles['restoreButton']}>
      Restore
    </button>
    <button type="button" onClick={onDiscard} className={styles['discardButton']}>
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

  // Ref to store timeout IDs for cleanup
  const retryTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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

    // Clear any existing timeouts
    retryTimeoutsRef.current.forEach(clearTimeout);
    retryTimeoutsRef.current = [];

    try {
      // Force re-initialization
      sendMessage({ type: 'FORCE_INIT' });

      // Also try to reconnect
      connect();

      // Wait a bit and then check status
      retryTimeoutsRef.current.push(
        setTimeout(() => {
          sendMessage({ type: 'DETECT_REACT' });
        }, 1000)
      );
    } finally {
      // Reset retry state after delay only if still not connected
      retryTimeoutsRef.current.push(
        setTimeout(() => {
          const currentState = useConnectionStore.getState();
          if (!currentState.isConnected) {
            setIsRetrying(false);
          }
        }, 5000)
      );
    }
  }, [connect, sendMessage]);

  // Show connection error
  if (lastError && !isConnected) {
    return (
      <ErrorBoundary context="React Perf Profiler">
        <ConnectionError error={lastError} onRetry={handleRetry} isRetrying={isRetrying} />
      </ErrorBoundary>
    );
  }

  // Show welcome screen when no data and not recording
  if (showWelcome && commits.length === 0 && !isRecording) {
    return (
      <ErrorBoundary context="React Perf Profiler">
        <div className={styles['app']}>
          <ErrorBoundary context="toolbar" compact>
            <Toolbar />
          </ErrorBoundary>
          <WelcomeScreen />
          <NotificationContainer />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary context="React Perf Profiler">
      {/* First-run onboarding — shown once after install, stored in chrome.storage.local */}
      <FirstRunOverlay />
      <div className={styles['app']} data-recording={isRecording}>
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
