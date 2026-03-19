/**
 * Toolbar Component
 * Top toolbar with recording controls, stats, and view toggles
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { useConnectionStore } from '@/panel/stores/connectionStore';
import { Button } from '../Common/Button/Button';
import { Icon } from '../Common/Icon/Icon';
import { ImportDialog } from '../Common/ImportDialog/ImportDialog';
import { ThemeToggle } from '../Theme/ThemeToggle';
import { ViewModeToggle } from './ViewModeToggle';
import { SettingsButton } from './SettingsButton';
import styles from './Toolbar.module.css';

// =============================================================================
// Component
// =============================================================================

export const Toolbar: React.FC = () => {
  const [isImportOpen, setIsImportOpen] = useState(false);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Record/Stop: Ctrl/Cmd + R
      if (modKey && e.key === 'r') {
        e.preventDefault();
        if (isRecording) {
          handleStopRecording();
        } else {
          handleStartRecording();
        }
      }

      // Clear: Ctrl/Cmd + Delete or Ctrl/Cmd + Backspace
      if (modKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        if (commits.length > 0) {
          handleClear();
        }
      }

      // Export: Ctrl/Cmd + S
      if (modKey && e.key === 's') {
        e.preventDefault();
        if (commits.length > 0) {
          handleExport();
        }
      }

      // Import: Ctrl/Cmd + O
      if (modKey && e.key === 'o') {
        e.preventDefault();
        setIsImportOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, commits.length, handleClear, handleExport, handleStartRecording, handleStopRecording]);

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const renderRecordingButton = () => {
    if (isRecording) {
      return (
        <Button
          variant="danger"
          size="sm"
          onClick={handleStopRecording}
          disabled={!isConnected}
          icon="stop" iconPosition="left"
        >
          Stop
        </Button>
      );
    }

    return (
      <Button
        variant="primary"
        size="sm"
        onClick={handleStartRecording}
        disabled={!isConnected}
        icon="record" iconPosition="left"
      >
        Record
      </Button>
    );
  };

  const renderConnectionStatus = () => {
    const statusClass = isConnected ? styles['connected'] : styles['disconnected'];
    const statusText = isConnected ? 'Connected' : 'Disconnected';

    return (
      <div className={styles['connectionStatus']}>
        <span className={`${styles['statusDot']} ${statusClass}`} />
        <span className={styles['statusText']}>{statusText}</span>
      </div>
    );
  };

  return (
    <header className={styles['toolbar']}>
      <div className={styles['leftSection']}>
        <div className={styles['logo']}>
          <Icon name="performance" size={20} />
          <span>React Perf Profiler</span>
        </div>

        {renderConnectionStatus()}

        <div className={styles['divider']} />

        <div className={styles['controls']}>
          {renderRecordingButton()}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleClear}
            disabled={commits.length === 0}
            icon="trash" iconPosition="left"
          >
            Clear
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={commits.length === 0}
            icon="download" iconPosition="left"
          >
            Export
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            icon="upload" iconPosition="left"
          >
            Import
          </Button>
        </div>
      </div>

      <div className={styles['rightSection']}>
        {commits.length > 0 && (
          <>
            <div className={styles['stats']}>
              <div className={styles['stat']}>
                <Icon name="commit" size={14} />
                <span>{commits.length} commits</span>
              </div>

              <div className={styles['stat']}>
                <Icon name="time" size={14} />
                <span>
                  {(commits.reduce((sum, c) => sum + (c['duration'] || 0), 0) / 1000).toFixed(2)}s
                </span>
              </div>

              <div className={styles['stat']}>
                <Icon name="lightbulb" size={14} />
                <span>Score: {Math.round(performanceScore?.score ?? 0)}</span>
              </div>
            </div>

            <div className={styles['divider']} />
          </>
        )}

        <div className={styles['toggles']}>
          <ViewModeToggle />
          <ThemeToggle />
          <SettingsButton />
        </div>
      </div>

      <ImportDialog isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
    </header>
  );
};
