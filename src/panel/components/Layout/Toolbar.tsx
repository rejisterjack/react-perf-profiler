/**
 * Toolbar Component
 * Top toolbar with recording controls, stats, and view toggles
 */

import React from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { useConnectionStore } from '@/panel/stores/connectionStore';
import { Button } from '../Common/Button/Button';
import { Icon } from '../Common/Icon/Icon';
import { ViewModeToggle } from './ViewModeToggle';
import { SettingsButton } from './SettingsButton';
import styles from './Toolbar.module.css';

// =============================================================================
// Component
// =============================================================================

export const Toolbar: React.FC = () => {
  const { 
    isRecording, 
    commits, 
    performanceScore,
    startRecording,
    stopRecording,
    clearData,
    exportData,
  } = useProfilerStore();
  
  const { isConnected, sendMessage } = useConnectionStore();

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleStartRecording = () => {
    sendMessage({ type: 'START_PROFILING' });
    startRecording();
  };

  const handleStopRecording = () => {
    sendMessage({ type: 'STOP_PROFILING' });
    stopRecording();
  };

  const handleClear = () => {
    clearData();
    sendMessage({ type: 'CLEAR_DATA' });
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `react-perf-profiler-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const recordingDuration = useProfilerStore((state) => state.recordingDuration);

  return (
    <header className={styles.toolbar} role="toolbar" aria-label="Profiler toolbar">
      {/* Left section - Recording controls */}
      <div className={styles.section}>
        <div className={styles.recordingControls}>
          <Button
            variant={isRecording ? 'danger' : 'primary'}
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={!isConnected}
            icon={isRecording ? 'stop' : 'record'}
            size="md"
            aria-label={isRecording ? 'Stop profiling' : 'Start profiling'}
          >
            {isRecording ? 'Stop' : 'Record'}
          </Button>

          {isRecording && (
            <span className={styles.recordingIndicator} aria-live="polite">
              <span className={styles.recordingDot} />
              Recording {formatDuration(recordingDuration)}
            </span>
          )}
        </div>

        <div className={styles.divider} role="separator" />

        <Button
          variant="secondary"
          onClick={handleClear}
          disabled={commits.length === 0}
          icon="clear"
          size="md"
          aria-label="Clear all data"
        >
          Clear
        </Button>

        <Button
          variant="secondary"
          onClick={handleExport}
          disabled={commits.length === 0}
          icon="download"
          size="md"
          aria-label="Export data"
        >
          Export
        </Button>
      </div>

      {/* Center section - Stats */}
      <div className={`${styles.section} ${styles.centerSection}`}>
        <div className={styles.stats} role="status" aria-live="polite">
          <span className={styles.statItem}>
            <Icon name="commit" size="sm" className={styles.statIcon} />
            {commits.length} commits
          </span>

          {commits.length > 0 && (
            <>
              <span className={styles.statDivider} />
              
              <span className={styles.statItem}>
                <Icon name="performance" size="sm" className={styles.statIcon} />
                {commits.reduce((sum, c) => sum + c.actualDuration, 0).toFixed(1)}ms total
              </span>
            </>
          )}

          {performanceScore && (
            <>
              <span className={styles.statDivider} />
              
              <span 
                className={`${styles.score} ${styles[`score${getScoreLevel(performanceScore.score)}`]}`}
                title={`Performance Score: ${performanceScore.score.toFixed(0)}/100`}
              >
                <Icon name="performance" size="sm" />
                {performanceScore.score.toFixed(0)}/100
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right section - View mode & Settings */}
      <div className={styles.section}>
        <ViewModeToggle />
        
        <div className={styles.divider} role="separator" />
        
        <SettingsButton />

        <div 
          className={`${styles.connectionStatus} ${isConnected ? styles.connected : styles.disconnected}`}
          title={isConnected ? 'Connected to React app' : 'Disconnected'}
          aria-label={isConnected ? 'Connected' : 'Disconnected'}
        >
          <Icon name="dot" size="sm" />
        </div>
      </div>
    </header>
  );
};

// =============================================================================
// Helper Functions
// =============================================================================

function getScoreLevel(score: number): 'Good' | 'Fair' | 'Poor' {
  if (score >= 80) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

export default Toolbar;
