/**
 * ViewModeToggle Component
 * Toggle buttons for switching between different visualization modes
 */

import type React from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { Icon, type IconName } from '../Common/Icon/Icon';
import styles from './ViewModeToggle.module.css';

// =============================================================================
// Types
// =============================================================================

type ViewMode = 'tree' | 'flamegraph' | 'timeline' | 'analysis' | 'compare' | 'cloud' | 'collab' | 'ai' | 'marketplace' | 'dashboard' | '3d';

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
  { mode: 'compare', label: 'Compare', icon: 'diff', shortcut: '5' },
  { mode: '3d', label: '3D', icon: 'box', shortcut: '6' },
  { mode: 'dashboard', label: 'Dashboard', icon: 'bar-chart', shortcut: '7' },
  { mode: 'ai', label: 'AI', icon: 'sparkles', shortcut: '8' },
  { mode: 'cloud', label: 'Cloud', icon: 'cloud', shortcut: '9' },
  { mode: 'collab', label: 'Team', icon: 'users', shortcut: '0' },
  { mode: 'marketplace', label: 'Store', icon: 'shopping-bag', shortcut: '-' },
];

// =============================================================================
// Component
// =============================================================================

export const ViewModeToggle: React.FC = () => {
  const { viewMode, setViewMode, commits } = useProfilerStore();

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const hasData = commits.length > 0;

  return (
    <div className={`${styles["viewModeToggle"]} ${styles["underline"]}`} role="radiogroup" aria-label="View mode">
      {VIEW_MODES.map(({ mode, label, icon, shortcut }) => {
        const isActive = viewMode === mode;
        const isDisabled = !hasData && mode !== 'analysis';

        return (
          <button
            type="button"
            key={mode}
            className={`${styles["modeButton"]} ${isActive ? styles["active"] : ''} ${isDisabled ? styles["disabled"] : ''}`}
            onClick={() => handleModeChange(mode)}
            disabled={isDisabled}
            aria-pressed={isActive}
            title={`${label} (${shortcut})${isDisabled ? ' - Start recording to enable' : ''}`}
          >
            <Icon name={icon} size={16} />
            <span className={styles["label"]}>{label}</span>
            <kbd className={styles["shortcut"]}>{shortcut}</kbd>
          </button>
        );
      })}
    </div>
  );
};

export default ViewModeToggle;
