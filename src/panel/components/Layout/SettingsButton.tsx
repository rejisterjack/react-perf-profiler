/**
 * SettingsButton Component
 * Settings dropdown with configuration options
 */

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import { useSettingsStore } from '@/panel/stores/settingsStore';
import { setCrashReportingEnabled } from '@/shared/telemetry/sentry';
import { Icon } from '../Common/Icon/Icon';
import styles from './SettingsButton.module.css';

// =============================================================================
// Component
// =============================================================================

export const SettingsButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    componentTypeFilter,
    setComponentTypeFilter,
    severityFilter,
    setSeverityFilter,
    clearData,
  } = useProfilerStore();
  const deleteAllData = useSettingsStore((s) => s.deleteAllData);
  const enableCrashReporting = useSettingsStore((s) => s.enableCrashReporting);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleSeverityToggle = (severity: 'critical' | 'warning' | 'info') => {
    if (severityFilter.includes(severity)) {
      setSeverityFilter(
        severityFilter.filter((s: 'critical' | 'warning' | 'info') => s !== severity)
      );
    } else {
      setSeverityFilter([...severityFilter, severity]);
    }
  };

  return (
    <div className={styles["settingsContainer"]}>
      <button
        type="button"
        ref={buttonRef}
        className={`${styles["settingsButton"]} ${isOpen ? styles["active"] : ''}`}
        onClick={handleToggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Settings"
        title="Settings"
      >
        <Icon name="settings" size={16} />
      </button>

      {isOpen && (
        <div ref={menuRef} className={styles["dropdown"]} role="menu" aria-orientation="vertical">
          {/* Section: Filters */}
          <div className={styles["section"]}>
            <h4 className={styles["sectionTitle"]}>Filters</h4>

            <div className={styles["menuItem"]} role="presentation">
              <label className={styles["checkboxLabel"]}>
                <input
                  type="checkbox"
                  checked={severityFilter.includes('critical')}
                  onChange={() => handleSeverityToggle('critical')}
                  className={styles["checkbox"]}
                />
                <span className={`${styles["indicator"]} ${styles["critical"]}`} />
                Show Critical
              </label>
            </div>

            <div className={styles["menuItem"]} role="presentation">
              <label className={styles["checkboxLabel"]}>
                <input
                  type="checkbox"
                  checked={severityFilter.includes('warning')}
                  onChange={() => handleSeverityToggle('warning')}
                  className={styles["checkbox"]}
                />
                <span className={`${styles["indicator"]} ${styles["warning"]}`} />
                Show Warnings
              </label>
            </div>

            <div className={styles["menuItem"]} role="presentation">
              <label className={styles["checkboxLabel"]}>
                <input
                  type="checkbox"
                  checked={severityFilter.includes('info')}
                  onChange={() => handleSeverityToggle('info')}
                  className={styles["checkbox"]}
                />
                <span className={`${styles["indicator"]} ${styles["info"]}`} />
                Show Info
              </label>
            </div>
          </div>

          {/* Divider */}
          <hr className={styles["divider"]} />

          {/* Section: Component Type */}
          <div className={styles["section"]}>
            <h4 className={styles["sectionTitle"]}>Component Type</h4>

            <div className={styles["menuItem"]} role="presentation">
              <label className={styles["radioLabel"]}>
                <input
                  type="radio"
                  name="componentType"
                  checked={componentTypeFilter === 'all'}
                  onChange={() => setComponentTypeFilter('all')}
                  className={styles["radio"]}
                />
                All Components
              </label>
            </div>

            <div className={styles["menuItem"]} role="presentation">
              <label className={styles["radioLabel"]}>
                <input
                  type="radio"
                  name="componentType"
                  checked={componentTypeFilter === 'memoized'}
                  onChange={() => setComponentTypeFilter('memoized')}
                  className={styles["radio"]}
                />
                Memoized Only
              </label>
            </div>

            <div className={styles["menuItem"]} role="presentation">
              <label className={styles["radioLabel"]}>
                <input
                  type="radio"
                  name="componentType"
                  checked={componentTypeFilter === 'unmemoized'}
                  onChange={() => setComponentTypeFilter('unmemoized')}
                  className={styles["radio"]}
                />
                Unmemoized Only
              </label>
            </div>
          </div>

          {/* Divider */}
          <hr className={styles["divider"]} />

          {/* Section: Privacy */}
          <div className={styles["section"]}>
            <h4 className={styles["sectionTitle"]}>Privacy</h4>
            <div className={styles["menuItem"]} role="presentation">
              <label className={styles["checkboxLabel"]}>
                <input
                  type="checkbox"
                  checked={enableCrashReporting}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateSetting('enableCrashReporting', enabled);
                    setCrashReportingEnabled(enabled);
                  }}
                  className={styles["checkbox"]}
                />
                Crash Reports
              </label>
              <small style={{ display: 'block', marginTop: '2px', marginLeft: '22px', fontSize: '10px', color: '#64748b' }}>
                Sends anonymous error reports to help fix bugs
              </small>
            </div>
          </div>

          {/* Divider */}
          <hr className={styles["divider"]} />

          {/* Section: Actions */}
          <div className={styles["section"]}>
            <button
              type="button"
              className={styles["actionButton"]}
              onClick={() => {
                clearData();
                setIsOpen(false);
              }}
            >
              <Icon name="clear" size={16} />
              Clear Profile Data
            </button>

            <button
              type="button"
              className={styles["actionButton"]}
              style={{ color: '#ef4444' }}
              onClick={async () => {
                if (window.confirm('This will permanently delete ALL extension data including settings, API keys, and profile history. This cannot be undone. Continue?')) {
                  await deleteAllData();
                  setIsOpen(false);
                }
              }}
            >
              <Icon name="trash" size={16} />
              Delete All Extension Data
            </button>
          </div>

          {/* Divider */}
          <hr className={styles["divider"]} />

          {/* Footer */}
          <div className={styles["footer"]}>
            <span className={styles["hint"]}>ESC to close</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsButton;
