/**
 * WelcomeScreen Component
 * Empty state displayed when no profiling data is available
 */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useConnectionStore } from '@/panel/stores/connectionStore';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { getErrorDisplay } from '@/panel/utils/errorMessages';
import { t } from '@/shared/i18n';
import { Button } from '../Common/Button/Button';
import { Icon, type IconName } from '../Common/Icon/Icon';
import styles from './WelcomeScreen.module.css';

// Types
// =============================================================================

type SetupState =
  | 'checking'
  | 'react-not-found'
  | 'devtools-not-found'
  | 'connected'
  | 'disconnected';

interface ReactDetectionState {
  isChecking: boolean;
  state: SetupState;
  message: string;
  canRetry: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const WelcomeScreen: React.FC = () => {
  const { isRecording, startRecording } = useProfilerStore();
  const {
    isConnected,
    sendMessage,
    reactDetected,
    devtoolsDetected,
    bridgeState,
    bridgeError: storeBridgeError,
  } = useConnectionStore();

  const [isDetecting, setIsDetecting] = useState(false);

  // Check React detection status
  const checkReactStatus = useCallback(() => {
    if (isConnected) {
      sendMessage({ type: 'GET_BRIDGE_STATUS' });
      sendMessage({ type: 'DETECT_REACT' });
    }
  }, [isConnected, sendMessage]);

  // Handle detection on mount and connection changes
  useEffect(() => {
    checkReactStatus();
  }, [checkReactStatus]);

  const handleStartRecording = () => {
    sendMessage({ type: 'START_PROFILING' });
    startRecording();
  };

  const handleDetectReact = () => {
    setIsDetecting(true);
    sendMessage({ type: 'DETECT_REACT' });
    sendMessage({ type: 'FORCE_INIT' });
    // Reset detection after a short delay to allow result to come back
    setTimeout(() => setIsDetecting(false), 2000);
  };

  const handleRetryConnection = () => {
    setIsDetecting(true);
    checkReactStatus();
    setTimeout(() => setIsDetecting(false), 2000);
  };

  // Determine current display state based on store
  let setupState: SetupState = 'checking';
  let displayMessage = t('status.checking');
  let canRetry = true;

  if (!isConnected) {
    setupState = 'disconnected';
    displayMessage = t('status.disconnected');
  } else if (reactDetected === true && devtoolsDetected === true) {
    setupState = 'connected';
    displayMessage = t('status.connected');
    canRetry = false;
  } else if (reactDetected === false) {
    setupState = 'react-not-found';
    displayMessage = t('status.reactNotFound');
  } else if (devtoolsDetected === false) {
    setupState = 'devtools-not-found';
    displayMessage = t('status.devtoolsNotFound');
  } else if (storeBridgeError) {
    const errDisplay = getErrorDisplay(storeBridgeError.type, storeBridgeError.message);
    setupState = 'devtools-not-found';
    displayMessage = `${errDisplay.title} \u2014 ${errDisplay.detail}`;
    canRetry = errDisplay.recoverable;
  }

  const showSetupInstructions =
    setupState === 'react-not-found' || setupState === 'devtools-not-found';

  return (
    <section className={styles.welcomeScreen} aria-label="Welcome">
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.logo}>
          <Icon name="performance" size={32} className={styles.logoIcon} />
          <div className={styles.flame} />
        </div>
        <h1 className={styles.title}>React Perf Profiler</h1>
        <p className={styles.subtitle}>
          Analyze and optimize your React application performance
        </p>
      </div>

      {/* Status */}
      <div className={styles.statusSection}>
        <StatusBadge state={setupState} message={displayMessage} />
      </div>

      {/* Setup Instructions */}
      {showSetupInstructions && (
        <SetupInstructions
          state={setupState}
          onDetect={handleDetectReact}
          isDetecting={isDetecting}
        />
      )}

      {/* Quick Actions */}
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="sm"
          icon="record"
          onClick={handleStartRecording}
          disabled={!isConnected || isRecording || setupState !== 'connected'}
          className={styles.recordButton}
        >
          {isRecording ? t('welcome.recording') : t('welcome.startProfiling')}
        </Button>

        {canRetry && (
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={handleRetryConnection}
            disabled={isDetecting}
          >
            {isDetecting ? t('welcome.checking') : t('welcome.retryConnection')}
          </Button>
        )}

        {!isConnected && !showSetupInstructions && (
          <p className={styles.helpText}>
            Make sure your React app is running with the development build
          </p>
        )}
      </div>

      {/* Connected State: Workflows + Features */}
      {setupState === 'connected' && (
        <>
          {/* Quick Workflows */}
          <div className={styles.workflows}>
            <h3 className={styles.workflowHeader}>{t('workflow.quickWorkflows')}</h3>
            <button
              type="button"
              className={`${styles.workflowCard} ${styles.blue}`}
              aria-label="Profile page load \u2014 auto-records 5 seconds to capture initial renders"
              onClick={() => {
                handleStartRecording();
                setTimeout(() => useProfilerStore.getState().stopRecording(), 5000);
              }}
            >
              <strong className={`${styles.workflowTitle} ${styles.blue}`}>
                {t('workflow.pageLoad')}
              </strong>
              <span className={styles.workflowDesc}>{t('workflow.pageLoadDesc')}</span>
            </button>
            <button
              type="button"
              className={`${styles.workflowCard} ${styles.purple}`}
              aria-label="Profile interaction \u2014 record while you interact with your app"
              onClick={handleStartRecording}
            >
              <strong className={`${styles.workflowTitle} ${styles.purple}`}>
                {t('workflow.interaction')}
              </strong>
              <span className={styles.workflowDesc}>{t('workflow.interactionDesc')}</span>
            </button>
          </div>

          {/* Features */}
          <div className={styles.features}>
            <FeatureCard
              icon="tree"
              title={t('feature.componentTree')}
              description={t('feature.componentTreeDesc')}
            />
            <FeatureCard
              icon="flame"
              title={t('feature.flamegraph')}
              description={t('feature.flamegraphDesc')}
            />
            <FeatureCard
              icon="timeline"
              title={t('feature.timeline')}
              description={t('feature.timelineDesc')}
            />
            <FeatureCard
              icon="analysis"
              title={t('feature.analysis')}
              description={t('feature.analysisDesc')}
            />
          </div>
        </>
      )}

      {/* Keyboard Shortcuts */}
      <div className={styles.shortcuts}>
        <h3>{t('shortcuts.title')}</h3>
        <div className={styles.shortcutList}>
          <Shortcut keyCombo="Ctrl/Cmd+Shift+P" description={t('shortcuts.toggleRecording')} />
          <Shortcut keyCombo="C" description={t('shortcuts.clearData')} />
          <Shortcut keyCombo="Ctrl/Cmd+E" description={t('shortcuts.export')} />
          <Shortcut keyCombo="Ctrl/Cmd+O" description={t('shortcuts.import')} />
          <Shortcut keyCombo="1-4" description={t('shortcuts.switchView')} />
          <Shortcut keyCombo="R" description={t('shortcuts.runAnalysis')} />
        </div>
      </div>

      {/* Tips */}
      <div className={styles.tips}>
        <div className={styles.tip}>
          <Icon name="info" size={16} className={styles.tipIcon} />
          <p>
            <strong>Tip:</strong> Click on any component in the tree to see detailed performance
            metrics and optimization suggestions.
          </p>
        </div>
      </div>
    </section>
  );
};

// =============================================================================
// Sub-components
// =============================================================================

interface StatusBadgeProps {
  state: SetupState;
  message: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ state, message }) => {
  const getIconName = (): IconName => {
    switch (state) {
      case 'checking':
        return 'spinner';
      case 'connected':
        return 'check';
      case 'react-not-found':
      case 'devtools-not-found':
        return 'warning';
      default:
        return 'dot';
    }
  };

  const getClassName = (): string => {
    switch (state) {
      case 'checking':
        return styles.checking ?? '';
      case 'connected':
        return styles.connected ?? '';
      case 'react-not-found':
      case 'devtools-not-found':
        return styles.warning ?? '';
      default:
        return styles.disconnected ?? '';
    }
  };

  const icon = getIconName();
  const className = getClassName();

  return (
    <div className={`${styles.statusCard} ${className}`} role="status" aria-live="polite">
      {state === 'checking' ? (
        <Icon name={icon} size={18} className={styles.spinning} aria-hidden="true" />
      ) : (
        <span className={styles.pulseDot} aria-hidden="true" />
      )}
      <span>{message}</span>
    </div>
  );
};

interface SetupInstructionsProps {
  state: SetupState;
  onDetect: () => void;
  isDetecting: boolean;
}

const SetupInstructions: React.FC<SetupInstructionsProps> = ({ state, onDetect, isDetecting }) => {
  if (state === 'react-not-found') {
    return (
      <div className={styles.setupPanel}>
        <div className={styles.setupHeader}>
          <Icon name="info" size={24} />
          <h3>React Not Detected</h3>
        </div>
        <div className={styles.setupContent}>
          <p>
            This page does not appear to be using React, or it is using a production build which
            does not expose the React DevTools hook.
          </p>
          <h4>Common fixes:</h4>
          <ol>
            <li>
              <strong>Development build required</strong> &mdash; Production React builds strip
              DevTools hooks. Use <code>npm run dev</code> / <code>next dev</code> /{' '}
              <code>vite</code> instead of <code>npm run build</code>.
            </li>
            <li>
              <strong>Next.js App Router</strong> &mdash; React loads asynchronously. Wait for the
              page to fully hydrate, then retry detection.
            </li>
            <li>
              <strong>Vite dev server</strong> &mdash; Ensure <code>@vitejs/plugin-react</code> is
              configured. Some setups use <code>react()</code> which may need{' '}
              <code>reactJsx()</code> instead for DevTools support.
            </li>
            <li>
              <strong>Extension permissions</strong> &mdash; Check that this extension has access to
              the current page (required for content script injection).
            </li>
          </ol>
          <p className={styles.setupHint}>
            Tip: Strict Mode, Fast Refresh, and concurrent rendering can affect render counts&mdash;see{' '}
            <a
              href="https://github.com/rejisterjack/react-perf-profiler/blob/main/docs/TROUBLESHOOTING.md#profiling-heuristics-strict-mode-fast-refresh-concurrent-react"
              target="_blank"
              rel="noopener noreferrer"
            >
              profiling heuristics
            </a>
            .
          </p>
          <div className={styles.setupActions}>
            <Button variant="secondary" size="sm" icon="refresh" onClick={onDetect} disabled={isDetecting}>
              {isDetecting ? t('setup.detecting') : t('setup.detectReact')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'devtools-not-found') {
    return (
      <div className={styles.setupPanel}>
        <div className={styles.setupHeader}>
          <Icon name="warning" size={24} />
          <h3>React DevTools Required</h3>
        </div>
        <div className={styles.setupContent}>
          <p>
            React was detected on this page, but the React DevTools extension is not installed or
            not activated. React Perf Profiler requires React DevTools to access React internals.
          </p>
          <h4>Installation Steps:</h4>
          <ol>
            <li>
              <strong>Chrome:</strong>{' '}
              <a
                href="https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi"
                target="_blank"
                rel="noopener noreferrer"
              >
                Install React Developer Tools
              </a>
            </li>
            <li>
              <strong>Firefox:</strong>{' '}
              <a
                href="https://addons.mozilla.org/en-US/firefox/addon/react-devtools/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Install React Developer Tools
              </a>
            </li>
            <li>Refresh this page after installation</li>
            <li>Click &quot;Detect React&quot; below to retry</li>
          </ol>
          <div className={styles.setupNote}>
            <Icon name="info" size={14} />
            <span>
              Already installed? Try refreshing the page, restarting your browser, or checking for
              extension conflicts.
            </span>
          </div>
          <div className={styles.setupActions}>
            <Button variant="primary" size="sm" icon="refresh" onClick={onDetect} disabled={isDetecting}>
              {isDetecting ? t('setup.detecting') : t('setup.detectReact')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

interface FeatureCardProps {
  icon: IconName;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <div className={styles.featureCard}>
    <div className={styles.featureIcon}>
      <Icon name={icon} size={24} />
    </div>
    <h3 className={styles.featureTitle}>{title}</h3>
    <p className={styles.featureDescription}>{description}</p>
  </div>
);

interface ShortcutProps {
  keyCombo: string;
  description: string;
}

const Shortcut: React.FC<ShortcutProps> = ({ keyCombo, description }) => (
  <div className={styles.shortcut}>
    <kbd className={styles.keyCombo}>{keyCombo}</kbd>
    <span className={styles.description}>{description}</span>
  </div>
);

export default WelcomeScreen;
