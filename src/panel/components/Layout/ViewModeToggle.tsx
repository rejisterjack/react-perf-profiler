/**
 * ViewModeToggle Component
 * Toggle buttons for switching between different visualization modes
 */

import React from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon, IconName } from '../Common/Icon/Icon';
import styles from './ViewModeToggle.module.css';

// =============================================================================
// Types
// =============================================================================

type ViewMode = 'tree' | 'flamegraph' | 'timeline' | 'analysis';

interface ViewModeOption {
  mode: ViewMode;
  label: string;
  icon: IconName;
  shortcut: string;
}

// =============================================================================
// View Mode Options
// =============================================================================

const VIEW_MODES: ViewModeOption[] = [
  { mode: 'tree', label: 'Tree', icon: 'tree', shortcut: '1' },
  { mode: 'flamegraph', label: 'Flame', icon: 'flame', shortcut: '2' },
  { mode: 'timeline', label: 'Timeline', icon: 'timeline', shortcut: '3' },
  { mode: 'analysis', label: 'Analysis', icon: 'analysis', shortcut: '4' },
];

// =============================================================================
// Component
// =============================================================================

export const ViewModeToggle: React.FC = () => {
  const { viewMode, setViewMode, commits } = useProfilerStore();

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  // Keyboard shortcuts handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case '1':
          setViewMode('tree');
          break;
        case '2':
          setViewMode('flamegraph');
          break;
        case '3':
          setViewMode('timeline');
          break;
        case '4':
          setViewMode('analysis');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode]);

  const hasData = commits.length > 0;

  return (
    <div 
      className={styles.viewModeToggle}
      role="radiogroup"
      aria-label="View mode"
    >
      {VIEW_MODES.map(({ mode, label, icon, shortcut }) => {
        const isActive = viewMode === mode;
        const isDisabled = !hasData && mode !== 'analysis';

        return (
          <button
            key={mode}
            className={`${styles.modeButton} ${isActive ? styles.active : ''} ${isDisabled ? styles.disabled : ''}`}
            onClick={() => handleModeChange(mode)}
            disabled={isDisabled}
            role="radio"
            aria-checked={isActive}
            title={`${label} (${shortcut})${isDisabled ? ' - Start recording to enable' : ''}`}
          >
            <Icon name={icon} size="sm" />
            <span className={styles.label}>{label}</span>
            <kbd className={styles.shortcut}>{shortcut}</kbd>
          </button>
        );
      })}
    </div>
  );
};

export default ViewModeToggle;
