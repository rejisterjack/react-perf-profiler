/**
 * SettingsButton Component
 * Settings dropdown with configuration options
 */

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
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

            <div className={styles["menuItem"]} role="none">
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

            <div className={styles["menuItem"]} role="none">
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

            <div className={styles["menuItem"]} role="none">
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

            <div className={styles["menuItem"]} role="none">
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

            <div className={styles["menuItem"]} role="none">
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

            <div className={styles["menuItem"]} role="none">
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
              Clear All Data
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
