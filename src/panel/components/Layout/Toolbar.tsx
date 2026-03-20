/**
 * Toolbar Component
 * Top toolbar with recording controls, stats, and view toggles
 */

import type React from 'react';
import { useState, useCallback } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { useConnectionStore } from '@/panel/stores/connectionStore';
import { useKeyboardShortcuts, formatShortcut, isMac } from '@/panel/hooks/useKeyboardShortcuts';
import { Button } from '../Common/Button/Button';
import { Icon } from '../Common/Icon/Icon';
import { ImportDialog } from '../Common/ImportDialog/ImportDialog';
import { KeyboardShortcutsHelp } from '../Common/KeyboardShortcutsHelp/KeyboardShortcutsHelp';
import { Tooltip } from '../Common/Tooltip/Tooltip';
import { ThemeToggle } from '../Theme/ThemeToggle';
import { ViewModeToggle } from './ViewModeToggle';
import { SettingsButton } from './SettingsButton';
import styles from './Toolbar.module.css';

// =============================================================================
// Component
// =============================================================================

export const Toolbar: React.FC = () => {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const {
    isRecording,
    commits,
    performanceScore,
    startRecording,
    stopRecording,
    clearData,
    exportData,
    viewMode,
    setViewMode,
    selectedComponent,
    toggleDetailPanel,
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

  // Keyboard shortcut actions
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  }, [isRecording]);

  const handlePreviousCommit = useCallback(() => {
    // Navigate commits implementation
    const currentIndex = commits.findIndex(c => c.id === useProfilerStore.getState().selectedCommitId);
    const newIndex = currentIndex > 0 ? currentIndex - 1 : commits.length - 1;
    if (commits[newIndex]) {
      useProfilerStore.getState().selectCommit(commits[newIndex].id);
    }
  }, [commits]);

  const handleNextCommit = useCallback(() => {
    // Navigate commits implementation
    const currentIndex = commits.findIndex(c => c.id === useProfilerStore.getState().selectedCommitId);
    const newIndex = currentIndex < commits.length - 1 ? currentIndex + 1 : 0;
    if (commits[newIndex]) {
      useProfilerStore.getState().selectCommit(commits[newIndex].id);
    }
  }, [commits]);

  const handleNavigateUp = useCallback(() => {
    // Navigation is handled in TreeView component
    // This is a no-op here as TreeView has its own focus
  }, []);

  const handleNavigateDown = useCallback(() => {
    // Navigation is handled in TreeView component
  }, []);

  const handleOpenDetails = useCallback(() => {
    if (selectedComponent && viewMode !== 'analysis') {
      setViewMode('analysis');
    }
  }, [selectedComponent, viewMode, setViewMode]);

  const handleClosePanel = useCallback(() => {
    toggleDetailPanel();
    setIsHelpOpen(false);
    setIsImportOpen(false);
  }, [toggleDetailPanel]);

  const handleClearData = useCallback(() => {
    if (commits.length > 0) {
      handleClear();
    }
  }, [commits.length]);

  const handleExportProfile = useCallback(() => {
    if (commits.length > 0) {
      handleExport();
    }
  }, [commits.length]);

  // Initialize keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts({
    toggleRecording: handleToggleRecording,
    previousCommit: handlePreviousCommit,
    nextCommit: handleNextCommit,
    navigateUp: handleNavigateUp,
    navigateDown: handleNavigateDown,
    openDetails: handleOpenDetails,
    closePanel: handleClosePanel,
    setViewMode,
    exportData: handleExportProfile,
    importData: () => setIsImportOpen(true),
    clearData: handleClearData,
    toggleHelp: () => setIsHelpOpen(prev => !prev),
  });

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const recordShortcut = formatShortcut('space');
  const clearShortcut = formatShortcut(isMac() ? 'cmd+delete' : 'ctrl+delete');
  const exportShortcut = formatShortcut(isMac() ? 'cmd+s' : 'ctrl+s');
  const importShortcut = formatShortcut(isMac() ? 'cmd+o' : 'ctrl+o');

  const renderRecordingButton = () => {
    if (isRecording) {
      return (
        <Tooltip content={`Stop recording (${recordShortcut})`}>
          <Button
            variant="danger"
            size="sm"
            onClick={handleStopRecording}
            disabled={!isConnected}
            icon="stop" iconPosition="left"
            aria-label={`Stop recording. Keyboard shortcut: ${recordShortcut}`}
          >
            Stop
          </Button>
        </Tooltip>
      );
    }

    return (
      <Tooltip content={`Start recording (${recordShortcut})`}>
        <Button
          variant="primary"
          size="sm"
          onClick={handleStartRecording}
          disabled={!isConnected}
          icon="record" iconPosition="left"
          aria-label={`Start recording. Keyboard shortcut: ${recordShortcut}`}
        >
          Record
        </Button>
      </Tooltip>
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

          <Tooltip content={`Clear all data (${clearShortcut})`}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClear}
              disabled={commits.length === 0}
              icon="trash" iconPosition="left"
              aria-label={`Clear all data. Keyboard shortcut: ${clearShortcut}`}
            >
              Clear
            </Button>
          </Tooltip>

          <Tooltip content={`Export profile (${exportShortcut})`}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={commits.length === 0}
              icon="download" iconPosition="left"
              aria-label={`Export profile. Keyboard shortcut: ${exportShortcut}`}
            >
              Export
            </Button>
          </Tooltip>

          <Tooltip content={`Import profile (${importShortcut})`}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsImportOpen(true)}
              icon="upload" iconPosition="left"
              aria-label={`Import profile. Keyboard shortcut: ${importShortcut}`}
            >
              Import
            </Button>
          </Tooltip>

          <Tooltip content="Show keyboard shortcuts (?)" placement="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHelpOpen(true)}
              icon="info"
              aria-label="Show keyboard shortcuts. Press question mark key"
            />
          </Tooltip>
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
      <KeyboardShortcutsHelp
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        shortcuts={shortcuts}
      />
    </header>
  );
};
