/**
 * WelcomeScreen Component
 * Empty state displayed when no profiling data is available
 */

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { useConnectionStore } from '@/panel/stores/connectionStore';
import { Icon, type IconName } from '../Common/Icon/Icon';
import { Button } from '../Common/Button/Button';
import styles from './WelcomeScreen.module.css';

// =============================================================================
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
    message: 'Checking React environment...',
    canRetry: true,
  });
  const [isDetecting, setIsDetecting] = useState(false);

  // Check React detection status
  const checkReactStatus = useCallback(() => {
    if (!isConnected) {
      setDetectionState({
        isChecking: false,
        state: 'disconnected',
        message: 'Waiting for connection to the page...',
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
              message: 'Connected to React',
              canRetry: false,
            });
          }
          break;
        case 'BRIDGE_ERROR':
          setDetectionState({
            isChecking: false,
            state: 'devtools-not-found',
            message: message.payload?.message || 'React DevTools not detected',
            canRetry: message.payload?.recoverable !== false,
          });
          break;
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
      if (payload.error.type === 'REACT_NOT_FOUND' || !payload.reactDetected) {
        setDetectionState({
          isChecking: false,
          state: 'react-not-found',
          message: payload.error.message || 'React not detected on this page',
          canRetry: payload.error.recoverable !== false,
        });
      } else if (payload.error.type === 'DEVTOOLS_NOT_FOUND' || !payload.devtoolsDetected) {
        setDetectionState({
          isChecking: false,
          state: 'devtools-not-found',
          message: payload.error.message || 'React DevTools extension not found',
          canRetry: payload.error.recoverable !== false,
        });
      }
      return;
    }

    // Check based on detection results
    if (payload.reactDetected && payload.devtoolsDetected) {
      setDetectionState({
        isChecking: false,
        state: 'connected',
        message: 'Connected to React',
        canRetry: false,
      });
    } else if (!payload.reactDetected) {
      setDetectionState({
        isChecking: false,
        state: 'react-not-found',
        message: 'React not detected on this page',
        canRetry: true,
      });
    } else if (!payload.devtoolsDetected) {
      setDetectionState({
        isChecking: false,
        state: 'devtools-not-found',
        message: 'React DevTools extension not found',
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
    setDetectionState(prev => ({ ...prev, isChecking: true }));
    sendMessage({ type: 'DETECT_REACT' });
    sendMessage({ type: 'FORCE_INIT' });
  };

  const handleRetryConnection = () => {
    setIsDetecting(true);
    setDetectionState(prev => ({ ...prev, isChecking: true }));
    checkReactStatus();
  };

  // Determine if we should show setup instructions
  const showSetupInstructions = detectionState.state === 'react-not-found' || 
                                 detectionState.state === 'devtools-not-found';

  return (
    <div className={styles["welcomeScreen"]} role="region" aria-label="Welcome">
      {/* Logo and Title */}
      <div className={styles["hero"]}>
        <div className={styles["logo"]}>
          <Icon name="performance" size={32} className={styles["logoIcon"]} />
          <div className={styles["flame"]} />
        </div>
        <h1 className={styles["title"]}>React Perf Profiler</h1>
        <p className={styles["subtitle"]}>
          Analyze and optimize your React application performance
        </p>
      </div>

      {/* Status Indicator */}
      <div className={styles["statusSection"]}>
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
      <div className={styles["actions"]}>
        <Button
          variant="primary"
          size="sm"
          icon="record"
          onClick={handleStartRecording}
          disabled={!isConnected || isRecording || detectionState.state !== 'connected'}
          className={styles["recordButton"]}
        >
          {isRecording ? 'Recording...' : 'Start Profiling'}
        </Button>

        {detectionState.canRetry && (
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={handleRetryConnection}
            disabled={isDetecting}
          >
            {isDetecting ? 'Checking...' : 'Retry Connection'}
          </Button>
        )}

        {!isConnected && !showSetupInstructions && (
          <p className={styles["helpText"]}>
            Make sure your React app is running with the development build
          </p>
        )}
      </div>

      {/* Features Grid - only show when connected */}
      {detectionState.state === 'connected' && (
        <div className={styles["features"]}>
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
      )}

      {/* Keyboard Shortcuts */}
      <div className={styles["shortcuts"]}>
        <h3>Keyboard Shortcuts</h3>
        <div className={styles["shortcutList"]}>
          <Shortcut keyCombo="R" description="Start/Stop recording" />
          <Shortcut keyCombo="C" description="Clear data" />
          <Shortcut keyCombo="E" description="Export data" />
          <Shortcut keyCombo="1-4" description="Switch view modes" />
        </div>
      </div>

      {/* Tips */}
      <div className={styles["tips"]}>
        <div className={styles["tip"]}>
          <Icon name="info" size={16} className={styles["tipIcon"]} />
          <p>
            <strong>Tip:</strong> Click on any component in the tree to see detailed performance
            metrics and optimization suggestions.
          </p>
        </div>
      </div>
    </div>
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
      case 'disconnected':
      default:
        return 'dot';
    }
  };

  const getClassName = (): string => {
    switch (state) {
      case 'checking':
        return styles["checking"] ?? '';
      case 'connected':
        return styles["connected"] ?? '';
      case 'react-not-found':
      case 'devtools-not-found':
        return styles["warning"] ?? '';
      case 'disconnected':
      default:
        return styles["disconnected"] ?? '';
    }
  };

  const icon = getIconName();
  const className = getClassName();

  return (
    <div className={`${styles["statusBadge"]} ${className}`}>
      <Icon name={icon} size={20} className={state === 'checking' ? styles["spinning"] : ''} />
      <span>{message}</span>
    </div>
  );
};

interface SetupInstructionsProps {
  state: SetupState;
  onDetect: () => void;
  isDetecting: boolean;
}

const SetupInstructions: React.FC<SetupInstructionsProps> = ({ 
  state, 
  onDetect,
  isDetecting 
}) => {
  if (state === 'react-not-found') {
    return (
      <div className={styles["setupPanel"]}>
        <div className={styles["setupHeader"]}>
          <Icon name="info" size={24} />
          <h3>React Not Detected</h3>
        </div>
        <div className={styles["setupContent"]}>
          <p>
            This page does not appear to be using React, or it is using a production build 
            which does not expose the React DevTools hook.
          </p>
          <h4>To use React Perf Profiler:</h4>
          <ol>
            <li>Navigate to a page that uses React</li>
            <li>Make sure React is running in development mode</li>
            <li>The page should load React before any profiling can begin</li>
          </ol>
          <div className={styles["setupActions"]}>
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={onDetect}
              disabled={isDetecting}
            >
              {isDetecting ? 'Detecting...' : 'Detect React'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'devtools-not-found') {
    return (
      <div className={styles["setupPanel"]}>
        <div className={styles["setupHeader"]}>
          <Icon name="warning" size={24} />
          <h3>React DevTools Required</h3>
        </div>
        <div className={styles["setupContent"]}>
          <p>
            React was detected on this page, but the React DevTools extension is not installed 
            or not activated. React Perf Profiler requires React DevTools to access React internals.
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
          <div className={styles["setupNote"]}>
            <Icon name="info" size={14} />
            <span>
              Already installed? Try refreshing the page or restarting your browser.
            </span>
          </div>
          <div className={styles["setupActions"]}>
            <Button
              variant="primary"
              size="sm"
              icon="refresh"
              onClick={onDetect}
              disabled={isDetecting}
            >
              {isDetecting ? 'Detecting...' : 'Detect React'}
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
  <div className={styles["featureCard"]}>
    <div className={styles["featureIcon"]}>
      <Icon name={icon} size={24} />
    </div>
    <h3 className={styles["featureTitle"]}>{title}</h3>
    <p className={styles["featureDescription"]}>{description}</p>
  </div>
);

interface ShortcutProps {
  keyCombo: string;
  description: string;
}

const Shortcut: React.FC<ShortcutProps> = ({ keyCombo, description }) => (
  <div className={styles["shortcut"]}>
    <kbd className={styles["keyCombo"]}>{keyCombo}</kbd>
    <span className={styles["description"]}>{description}</span>
  </div>
);

export default WelcomeScreen;
