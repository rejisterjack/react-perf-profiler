/**
 * Keyboard Shortcuts Help Dialog
 * Displays all available keyboard shortcuts grouped by category
 */

import type React from 'react';
import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  formatShortcut,
  groupShortcutsByCategory,
  type ShortcutConfig,
} from '@/panel/hooks/useKeyboardShortcuts';
import { Icon } from '../Icon/Icon';
import styles from './KeyboardShortcutsHelp.module.css';

// =============================================================================
// Types
// =============================================================================

export interface KeyboardShortcutsHelpProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should be closed */
  onClose: () => void;
  /** Array of shortcut configurations to display */
  shortcuts: ShortcutConfig[];
}

// =============================================================================
// Component
// =============================================================================

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  shortcuts,
}) => {
  // Handle escape key to close dialog
  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Attach escape key handler
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, handleEscapeKey]);

  // Lock body scroll when dialog is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle overlay click
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  // Group shortcuts by category
  const groupedShortcuts = groupShortcutsByCategory(shortcuts);

  return createPortal(
    <form
      className={styles['overlay']}
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      aria-label="Keyboard shortcuts overlay"
    >
      <div
        className={styles['dialog']}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles['header']}>
          <h2 id="keyboard-shortcuts-title" className={styles['title']}>
            <Icon name="info" size={20} className={styles['titleIcon']} />
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            className={styles['closeButton']}
            onClick={onClose}
            aria-label="Close keyboard shortcuts help"
            title="Close (Escape)"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={styles['content']}>
          {groupedShortcuts.map((group) => (
            <section key={group.category} className={styles['category']}>
              <h3 className={styles['categoryTitle']}>{group.label}</h3>
              <div className={styles['shortcutsList']}>
                {group.shortcuts.map((shortcut, index) => (
                  <ShortcutRow key={`${shortcut.key}-${index}`} shortcut={shortcut} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className={styles['footer']}>
          <span className={styles['footerHint']}>
            Press <kbd>?</kbd> anytime to show this help
          </span>
          <span className={styles['footerHint']}>Shortcuts work when not typing in an input</span>
        </div>
      </div>
    </form>,
    document.body
  );
};

// =============================================================================
// Sub-components
// =============================================================================

interface ShortcutRowProps {
  shortcut: ShortcutConfig;
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({ shortcut }) => {
  const formattedKeys = formatShortcut(shortcut.key);
  const keyParts = formattedKeys.split(mac ? ' ' : '+').filter((p) => p !== '+');

  return (
    <div className={styles['shortcutItem']}>
      <span className={styles['shortcutDescription']}>{shortcut.description}</span>
      <span className={styles['shortcutKeys']}>
        {keyParts.map((part, index) => {
          const isSeparator = part === ' ';
          const isWide = part.length > 1 && !isSeparator;

          if (isSeparator) {
            return null;
          }

          return (
            <kbd key={index} className={`${styles['key']} ${isWide ? styles['keyWide'] : ''}`}>
              {part}
            </kbd>
          );
        })}
      </span>
    </div>
  );
};

// Helper to detect Mac for key formatting display
const mac =
  typeof navigator !== 'undefined' &&
  ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ===
    'macOS' ||
    /Mac/i.test(navigator.platform));

export default KeyboardShortcutsHelp;
