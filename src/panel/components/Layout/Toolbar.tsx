/**
 * Toolbar Component
 * Top toolbar with recording controls, stats, and view toggles
 */

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { formatShortcut, isMac, useKeyboardShortcuts } from '@/panel/hooks/useKeyboardShortcuts';
import { useConnectionStore } from '@/panel/stores/connectionStore';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Button } from '../Common/Button/Button';
import { Icon } from '../Common/Icon/Icon';
import { ImportDialog } from '../Common/ImportDialog/ImportDialog';
import { KeyboardShortcutsHelp } from '../Common/KeyboardShortcutsHelp/KeyboardShortcutsHelp';
import { Tooltip } from '../Common/Tooltip/Tooltip';
import { ThemeToggle } from '../Theme/ThemeToggle';
import { SettingsButton } from './SettingsButton';
import styles from './Toolbar.module.css';
import { ViewModeToggle } from './ViewModeToggle';
import { GITHUB_REPO_URL } from '@/shared/constants';
import { t } from '@/shared/i18n';

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
  }, [onClear]);

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
    const { sendMessage: send } = useConnectionStore.getState();
    if (isRecording) {
      send({ type: 'STOP_PROFILING' });
      useProfilerStore.getState().stopRecording();
    } else {
      send({ type: 'START_PROFILING' });
      useProfilerStore.getState().startRecording();
    }
  }, [isRecording]);

  const handlePreviousCommit = useCallback(() => {
    const state = useProfilerStore.getState();
    const currentIndex = state.commits.findIndex((c) => c.id === state.selectedCommitId);
    const newIndex = currentIndex > 0 ? currentIndex - 1 : state.commits.length - 1;
    if (state.commits[newIndex]) {
      selectCommit(state.commits[newIndex].id);
    }
  }, [selectCommit]);

  const handleNextCommit = useCallback(() => {
    const state = useProfilerStore.getState();
    const currentIndex = state.commits.findIndex((c) => c.id === state.selectedCommitId);
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
      const { sendMessage: send } = useConnectionStore.getState();
      useProfilerStore.getState().clearData();
      send({ type: 'CLEAR_DATA' });
    }
  }, [commits.length]);

  const handleExportProfile = useCallback(() => {
    if (commits.length > 0) {
      const data = useProfilerStore.getState().exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const a = document.createElement('a');
      a.href = url;
      a.download = `react-perf-profile-${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
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
    setIsHelpOpen((prev) => !prev);
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

  const recordShortcut = formatShortcut(isMac() ? 'cmd+shift+r' : 'ctrl+shift+r');
  const clearShortcut = formatShortcut('C');
  const exportShortcut = formatShortcut(isMac() ? 'cmd+e' : 'ctrl+e');
  const importShortcut = formatShortcut(isMac() ? 'cmd+shift+i' : 'ctrl+shift+i');

  const renderRecordingButton = () => {
    if (isRecording) {
      return (
        <Tooltip content={`Stop recording (${recordShortcut})`}>
          <Button
            variant="danger"
            size="sm"
            onClick={handleStopRecording}
            disabled={!isConnected}
            icon="stop"
            iconPosition="left"
            aria-label={`Stop recording. Keyboard shortcut: ${recordShortcut}`}
          >
            {t('toolbar.stop')}
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
          icon="record"
          iconPosition="left"
          aria-label={`Start recording. Keyboard shortcut: ${recordShortcut}`}
        >
          {t('toolbar.record')}
        </Button>
      </Tooltip>
    );
  };

  const renderConnectionStatus = () => {
    const statusClass = isConnected ? styles['connected'] : styles['disconnected'];
    const statusText = isConnected ? t('status.connectedShort') : t('status.disconnectedShort');

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
          <span>{t('welcome.title')}</span>
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
              icon="trash"
              iconPosition="left"
              aria-label={`Clear all data. Keyboard shortcut: ${clearShortcut}`}
            >
              {t('toolbar.clear')}
            </Button>
          </Tooltip>

          <Tooltip content={`Export profile (${exportShortcut})`}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={commits.length === 0}
              icon="download"
              iconPosition="left"
              aria-label={`Export profile. Keyboard shortcut: ${exportShortcut}`}
            >
              {t('toolbar.export')}
            </Button>
          </Tooltip>

          <Tooltip content={`Import profile (${importShortcut})`}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsImportOpen(true)}
              icon="upload"
              iconPosition="left"
              aria-label={`Import profile. Keyboard shortcut: ${importShortcut}`}
            >
              {t('toolbar.import')}
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
                <span>{commits.length} {t('toolbar.commits')}</span>
              </div>

              <div className={styles['stat']}>
                <Icon name="time" size={14} />
                <span>
                  {(commits.reduce((sum, c) => sum + (c['duration'] || 0), 0) / 1000).toFixed(2)}s
                </span>
              </div>

              <div className={styles['stat']}>
                <Icon name="lightbulb" size={14} />
                <span>{t('toolbar.score')} {Math.round(performanceScore?.score ?? 0)}</span>
              </div>
            </div>

            <div className={styles['divider']} />
          </>
        )}

        <div className={styles['toggles']}>
          <ThemeToggle />
          <Tooltip content={t('toolbar.help')}>
            <a
              href={`${GITHUB_REPO_URL}#readme`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles['helpLink']}
              aria-label="Help and documentation"
            >
              ?
            </a>
          </Tooltip>
          <SettingsButton />
        </div>
      </div>

      {/* View mode tabs — separate row below main controls */}
      <div className={styles['viewModeRow']}>
        <ViewModeToggle />
      </div>

      <ImportDialog isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <KeyboardShortcutsHelp
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        shortcuts={shortcuts}
      />

      {/* Visual Feedback Toast */}
      {feedback && <FeedbackToast message={feedback.message} onClear={clearFeedback} />}
    </header>
  );
};

export default Toolbar;
