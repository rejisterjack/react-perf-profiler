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
  const { isConnected, sendMessage } = useConnectionStore();
  const [detectionState, setDetectionState] = useState<ReactDetectionState>({
    isChecking: true,
    state: 'checking',
    message: t('status.checking'),
    canRetry: true,
  });
  const [isDetecting, setIsDetecting] = useState(false);

  // Check React detection status
  const checkReactStatus = useCallback(() => {
    if (!isConnected) {
      setDetectionState({
        isChecking: false,
        state: 'disconnected',
        message: t('status.disconnected'),
        canRetry: true,
      });
      return;
    }

    // Request bridge status from content script
    sendMessage({ type: 'GET_BRIDGE_STATUS' });

    // Also request React detection
    sendMessage({ type: 'DETECT_REACT' });
  }, [isConnected, sendMessage]);

  // Handle detection on mount and connection changes
  useEffect(() => {
    checkReactStatus();
  }, [checkReactStatus]);

  // Listen for detection results from connection store
  useEffect(() => {
    const { addMessageHandler } = useConnectionStore.getState();

    const unsubscribe = addMessageHandler((message) => {
      switch (message.type) {
        case 'BRIDGE_STATUS':
        case 'REACT_DETECT_RESULT':
          handleDetectionResult(message.payload);
          break;
        case 'BRIDGE_INIT':
          if (message.payload?.success) {
            setDetectionState({
              isChecking: false,
              state: 'connected',
              message: t('status.connected'),
              canRetry: false,
            });
          }
          break;
        case 'BRIDGE_ERROR': {
          const errDisplay = getErrorDisplay(message.payload?.errorType, message.payload?.message);
          setDetectionState({
            isChecking: false,
            state: 'devtools-not-found',
            message: `${errDisplay.title} — ${errDisplay.detail}`,
            canRetry: errDisplay.recoverable,
          });
          break;
        }
      }
    });

    return unsubscribe;
  }, []);

  const handleDetectionResult = (payload: {
    reactDetected?: boolean;
    devtoolsDetected?: boolean;
    state?: string;
    error?: { type: string; message: string; recoverable: boolean } | null;
  }) => {
    setIsDetecting(false);

    // Check for explicit errors first
    if (payload.error) {
      const errDisplay = getErrorDisplay(payload.error.type, payload.error.message);
      const isReactMissing = payload.error.type === 'REACT_NOT_FOUND' || !payload.reactDetected;
      setDetectionState({
        isChecking: false,
        state: isReactMissing ? 'react-not-found' : 'devtools-not-found',
        message: `${errDisplay.title} — ${errDisplay.detail}`,
        canRetry: errDisplay.recoverable,
      });
      return;
    }

    // Check based on detection results
    if (payload.reactDetected && payload.devtoolsDetected) {
      setDetectionState({
        isChecking: false,
        state: 'connected',
        message: t('status.connected'),
        canRetry: false,
      });
    } else if (!payload.reactDetected) {
      setDetectionState({
        isChecking: false,
        state: 'react-not-found',
        message: t('status.reactNotFound'),
        canRetry: true,
      });
    } else if (!payload.devtoolsDetected) {
      setDetectionState({
        isChecking: false,
        state: 'devtools-not-found',
        message: t('status.devtoolsNotFound'),
        canRetry: true,
      });
    }
  };

  const handleStartRecording = () => {
    sendMessage({ type: 'START_PROFILING' });
    startRecording();
  };

  const handleDetectReact = () => {
    setIsDetecting(true);
    setDetectionState((prev) => ({ ...prev, isChecking: true }));
    sendMessage({ type: 'DETECT_REACT' });
    sendMessage({ type: 'FORCE_INIT' });
  };

  const handleRetryConnection = () => {
    setIsDetecting(true);
    setDetectionState((prev) => ({ ...prev, isChecking: true }));
    checkReactStatus();
  };

  // Determine if we should show setup instructions
  const showSetupInstructions =
    detectionState.state === 'react-not-found' || detectionState.state === 'devtools-not-found';

  return (
    <section className={styles['welcomeScreen']} aria-label="Welcome">
      {/* Logo and Title */}
      <div className={styles['hero']}>
        <div className={styles['logo']}>
          <Icon name="performance" size={32} className={styles['logoIcon']} />
          <div className={styles['flame']} />
        </div>
        <h1 className={styles['title']}>React Perf Profiler</h1>
        <p className={styles['subtitle']}>
          Analyze and optimize your React application performance
        </p>
      </div>

      {/* Status Indicator */}
      <div className={styles['statusSection']}>
        <StatusBadge state={detectionState.state} message={detectionState.message} />
      </div>

      {/* Setup Instructions (when React/DevTools not found) */}
      {showSetupInstructions && (
        <SetupInstructions
          state={detectionState.state}
          onDetect={handleDetectReact}
          isDetecting={isDetecting}
        />
      )}

      {/* Quick Actions */}
      <div className={styles['actions']}>
        <Button
          variant="primary"
          size="sm"
          icon="record"
          onClick={handleStartRecording}
          disabled={!isConnected || isRecording || detectionState.state !== 'connected'}
          className={styles['recordButton']}
        >
          {isRecording ? t('welcome.recording') : t('welcome.startProfiling')}
        </Button>

        {detectionState.canRetry && (
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
          <p className={styles['helpText']}>
            Make sure your React app is running with the development build
          </p>
        )}
      </div>

      {/* Features Grid - only show when connected */}
      {detectionState.state === 'connected' && (
        <>
          {/* Guided Workflows */}
          <div className={styles['features']}>
            <h3 style={{ gridColumn: '1 / -1', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
              Quick Workflows
            </h3>
            <button
              type="button"
              className={styles['featureCard']}
              aria-label="Profile page load — auto-records 5 seconds to capture initial renders"
              onClick={() => {
                handleStartRecording();
                setTimeout(() => useProfilerStore.getState().stopRecording(), 5000);
              }}
              style={{ cursor: 'pointer', textAlign: 'left', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', padding: '14px' }}
            >
              <strong style={{ color: '#60a5fa', display: 'block', marginBottom: '4px' }}>Profile Page Load</strong>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Auto-records 5s to capture initial renders</span>
            </button>
            <button
              type="button"
              className={styles['featureCard']}
              aria-label="Profile interaction — record while you interact with your app"
              onClick={handleStartRecording}
              style={{ cursor: 'pointer', textAlign: 'left', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '10px', padding: '14px' }}
            >
              <strong style={{ color: '#a78bfa', display: 'block', marginBottom: '4px' }}>Profile Interaction</strong>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Record while you interact with your app</span>
            </button>
          </div>

          <div className={styles['features']}>
          <FeatureCard
            icon="tree"
            title="Component Tree"
            description="Visualize your component hierarchy and render relationships"
          />
          <FeatureCard
            icon="flame"
            title="Flamegraph"
            description="Identify performance bottlenecks at a glance"
          />
          <FeatureCard
            icon="timeline"
            title="Timeline"
            description="Track render commits over time"
          />
          <FeatureCard
            icon="analysis"
            title="Analysis"
            description="Get actionable optimization recommendations"
          />
        </div>
        </>
      )}

      {/* Keyboard Shortcuts */}
      <div className={styles['shortcuts']}>
        <h3>Keyboard Shortcuts</h3>
        <div className={styles['shortcutList']}>
          <Shortcut keyCombo="Ctrl/Cmd+Shift+P" description="Start/Stop recording" />
          <Shortcut keyCombo="C" description="Clear data" />
          <Shortcut keyCombo="Ctrl/Cmd+E" description="Export data" />
          <Shortcut keyCombo="Ctrl/Cmd+O" description="Import data" />
          <Shortcut keyCombo="1-4" description="Switch view modes" />
          <Shortcut keyCombo="R" description="Run analysis" />
        </div>
      </div>

      {/* Tips */}
      <div className={styles['tips']}>
        <div className={styles['tip']}>
          <Icon name="info" size={16} className={styles['tipIcon']} />
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
        return styles['checking'] ?? '';
      case 'connected':
        return styles['connected'] ?? '';
      case 'react-not-found':
      case 'devtools-not-found':
        return styles['warning'] ?? '';
      default:
        return styles['disconnected'] ?? '';
    }
  };

  const icon = getIconName();
  const className = getClassName();

  return (
    <div className={`${styles['statusBadge']} ${className}`} role="status" aria-live="polite">
      <Icon name={icon} size={20} className={state === 'checking' ? styles['spinning'] : ''} aria-hidden="true" />
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
      <div className={styles['setupPanel']}>
        <div className={styles['setupHeader']}>
          <Icon name="info" size={24} />
          <h3>React Not Detected</h3>
        </div>
        <div className={styles['setupContent']}>
          <p>
            This page does not appear to be using React, or it is using a production build which
            does not expose the React DevTools hook.
          </p>
          <h4>Common fixes:</h4>
          <ol>
            <li><strong>Development build required</strong> — Production React builds strip DevTools hooks. Use <code>npm run dev</code> / <code>next dev</code> / <code>vite</code> instead of <code>npm run build</code>.</li>
            <li><strong>Next.js App Router</strong> — React loads asynchronously. Wait for the page to fully hydrate, then retry detection.</li>
            <li><strong>Vite dev server</strong> — Ensure <code>@vitejs/plugin-react</code> is configured. Some setups use <code>react()</code> which may need <code>reactJsx()</code> instead for DevTools support.</li>
            <li><strong>Extension permissions</strong> — Check that this extension has access to the current page (required for content script injection).</li>
          </ol>
          <p className={styles['setupHint']}>
            Tip: Strict Mode, Fast Refresh, and concurrent rendering can affect render counts—see{' '}
            <a
              href="https://github.com/rejisterjack/react-perf-profiler/blob/main/docs/TROUBLESHOOTING.md#profiling-heuristics-strict-mode-fast-refresh-concurrent-react"
              target="_blank"
              rel="noopener noreferrer"
            >
              profiling heuristics
            </a>
            .
          </p>
          <div className={styles['setupActions']}>
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={onDetect}
              disabled={isDetecting}
            >
              {isDetecting ? t('setup.detecting') : t('setup.detectReact')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'devtools-not-found') {
    return (
      <div className={styles['setupPanel']}>
        <div className={styles['setupHeader']}>
          <Icon name="warning" size={24} />
          <h3>React DevTools Required</h3>
        </div>
        <div className={styles['setupContent']}>
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
          <div className={styles['setupNote']}>
            <Icon name="info" size={14} />
            <span>Already installed? Try refreshing the page, restarting your browser, or checking for extension conflicts.</span>
          </div>
          <div className={styles['setupActions']}>
            <Button
              variant="primary"
              size="sm"
              icon="refresh"
              onClick={onDetect}
              disabled={isDetecting}
            >
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
  <div className={styles['featureCard']}>
    <div className={styles['featureIcon']}>
      <Icon name={icon} size={24} />
    </div>
    <h3 className={styles['featureTitle']}>{title}</h3>
    <p className={styles['featureDescription']}>{description}</p>
  </div>
);

interface ShortcutProps {
  keyCombo: string;
  description: string;
}

const Shortcut: React.FC<ShortcutProps> = ({ keyCombo, description }) => (
  <div className={styles['shortcut']}>
    <kbd className={styles['keyCombo']}>{keyCombo}</kbd>
    <span className={styles['description']}>{description}</span>
  </div>
);

export default WelcomeScreen;
