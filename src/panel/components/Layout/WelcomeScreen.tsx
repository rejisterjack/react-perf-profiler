/**
 * WelcomeScreen Component
 * Empty state displayed when no profiling data is available
 */

import type React from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { useConnectionStore } from '@/panel/stores/connectionStore';
import { Icon } from '../Common/Icon/Icon';
import { Button } from '../Common/Button/Button';
import styles from './WelcomeScreen.module.css';

// =============================================================================
// Component
// =============================================================================

export const WelcomeScreen: React.FC = () => {
  const { isRecording, startRecording } = useProfilerStore();
  const { isConnected, sendMessage } = useConnectionStore();

  const handleStartRecording = () => {
    sendMessage({ type: 'START_PROFILING' });
    startRecording();
  };

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
        <div
          className={`${styles["statusBadge"]} ${isConnected ? styles["connected"] : styles["disconnected"]}`}
        >
          <Icon name="dot" size={20} />
          <span>{isConnected ? 'Connected to React app' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles["actions"]}>
        <Button
          variant="primary"
          size="sm"
          icon="record"
          onClick={handleStartRecording}
          disabled={!isConnected || isRecording}
          className={styles["recordButton"]}
        >
          {isRecording ? 'Recording...' : 'Start Profiling'}
        </Button>

        {!isConnected && (
          <p className={styles["helpText"]}>
            Make sure your React app is running with the development build
          </p>
        )}
      </div>

      {/* Features Grid */}
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

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <div className={styles["featureCard"]}>
    <div className={styles["featureIcon"]}>
      <Icon name={icon as any} size={24} />
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
