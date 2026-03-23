/**
 * Toolbar Component
 * Top toolbar with recording controls, stats, and view toggles
 */

import type React from 'react';
import { useState, useCallback, useEffect } from 'react';
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
// Visual Feedback Toast Component
// =============================================================================

interface FeedbackToastProps {
  message: string;
  onClear: () => void;
}

const FeedbackToast: React.FC<FeedbackToastProps> = ({ message, onClear }) => {
  useEffect(() => {
    const timer = setTimeout(onClear, 2000);
    return () => clearTimeout(timer);
  }, [message, onClear]);

  return (
    <div className={styles['feedbackToast']} role="status" aria-live="polite">
      <Icon name="check" size={16} />
      <span>{message}</span>
    </div>
  );
};

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
    selectCommit,
    runAnalysis,
    toggleNodeExpanded,
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

  // Note: Import is handled via the ImportDialog component

  // Keyboard shortcut actions
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  }, [isRecording]);

  const handlePreviousCommit = useCallback(() => {
    const state = useProfilerStore.getState();
    const currentIndex = state.commits.findIndex(c => c.id === state.selectedCommitId);
    const newIndex = currentIndex > 0 ? currentIndex - 1 : state.commits.length - 1;
    if (state.commits[newIndex]) {
      selectCommit(state.commits[newIndex].id);
    }
  }, [selectCommit]);

  const handleNextCommit = useCallback(() => {
    const state = useProfilerStore.getState();
    const currentIndex = state.commits.findIndex(c => c.id === state.selectedCommitId);
    const newIndex = currentIndex < state.commits.length - 1 ? currentIndex + 1 : 0;
    if (state.commits[newIndex]) {
      selectCommit(state.commits[newIndex].id);
    }
  }, [selectCommit]);

  const handleNavigateUp = useCallback(() => {
    // Navigation is handled in TreeView component with its own focus
    // Dispatch a custom event that TreeView can listen to
    window.dispatchEvent(new CustomEvent('profiler:navigateUp'));
  }, []);

  const handleNavigateDown = useCallback(() => {
    // Navigation is handled in TreeView component
    window.dispatchEvent(new CustomEvent('profiler:navigateDown'));
  }, []);

  const handleSelectNode = useCallback(() => {
    // If a component is selected, open analysis view
    if (selectedComponent && viewMode !== 'analysis') {
      setViewMode('analysis');
    }
  }, [selectedComponent, viewMode, setViewMode]);

  const handleToggleNodeExpansion = useCallback(() => {
    // Toggle expansion of currently selected node
    if (selectedComponent) {
      const state = useProfilerStore.getState();
      const componentData = state.componentData.get(selectedComponent);
      if (componentData) {
        // Find a node ID associated with this component
        const state2 = useProfilerStore.getState();
        const commits = state2.commits;
        for (const commit of commits) {
          for (const node of commit.nodes ?? []) {
            if (node.displayName === selectedComponent && node.id !== undefined) {
              toggleNodeExpanded(String(node.id));
              return;
            }
          }
        }
      }
    }
  }, [selectedComponent, toggleNodeExpanded]);

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

  const handleImportProfile = useCallback(() => {
    setIsImportOpen(true);
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    if (commits.length > 0) {
      await runAnalysis();
    }
  }, [commits.length, runAnalysis]);

  const handleToggleHelp = useCallback(() => {
    setIsHelpOpen(prev => !prev);
  }, []);

  // Initialize keyboard shortcuts
  const { shortcuts, feedback, clearFeedback } = useKeyboardShortcuts({
    toggleRecording: handleToggleRecording,
    previousCommit: handlePreviousCommit,
    nextCommit: handleNextCommit,
    navigateUp: handleNavigateUp,
    navigateDown: handleNavigateDown,
    selectNode: handleSelectNode,
    toggleNodeExpansion: handleToggleNodeExpansion,
    closePanel: handleClosePanel,
    setViewMode,
    exportData: handleExportProfile,
    importData: handleImportProfile,
    clearData: handleClearData,
    runAnalysis: handleRunAnalysis,
    toggleHelp: handleToggleHelp,
  });

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const recordShortcut = formatShortcut(isMac() ? 'cmd+shift+p' : 'ctrl+shift+p');
  const clearShortcut = formatShortcut('C');
  const exportShortcut = formatShortcut(isMac() ? 'cmd+e' : 'ctrl+e');
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
      
      {/* Visual Feedback Toast */}
      {feedback && (
        <FeedbackToast 
          message={feedback.message} 
          onClear={clearFeedback}
        />
      )}
    </header>
  );
};

export default Toolbar;
