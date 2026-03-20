/**
 * Keyboard Shortcuts Hook
 * Comprehensive keyboard shortcut management for React Perf Profiler
 */

import { useEffect, useCallback, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

export type ShortcutKey = string;
export type ModifierKey = 'ctrl' | 'cmd' | 'alt' | 'shift';

export interface ShortcutConfig {
  /** Key or key combination (e.g., 'Space', 'ctrl+s') */
  key: string;
  /** Handler function */
  handler: (event: KeyboardEvent) => void;
  /** Description for help dialog */
  description: string;
  /** Category for grouping in help dialog */
  category: ShortcutCategory;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Whether to stop event propagation */
  stopPropagation?: boolean;
  /** Whether shortcut requires an input element to NOT be focused */
  requireNonInput?: boolean;
}

export type ShortcutCategory =
  | 'recording'
  | 'navigation'
  | 'views'
  | 'data'
  | 'help';

export interface ShortcutGroup {
  category: ShortcutCategory;
  label: string;
  shortcuts: ShortcutConfig[];
}

export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
  /** Container element to scope shortcuts to (default: window) */
  containerRef?: React.RefObject<HTMLElement>;
  /** Additional condition to enable shortcuts */
  when?: boolean;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if the current platform is macOS
 */
export const isMac = (): boolean => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

/**
 * Check if an input element is currently focused
 */
export const isInputFocused = (): boolean => {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  const editable = (activeElement as HTMLElement).isContentEditable;

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    editable
  );
};

/**
 * Parse a shortcut key string into components
 * e.g., "ctrl+s" -> { modifiers: ['ctrl'], key: 's' }
 * e.g., "Space" -> { modifiers: [], key: ' ' }
 */
export const parseShortcut = (
  shortcut: string
): { modifiers: ModifierKey[]; key: string } => {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop() || '';
  const modifiers = parts as ModifierKey[];

  // Convert ' ' to 'space' for consistency
  const normalizedKey = key === 'space' ? ' ' : key;

  return { modifiers, key: normalizedKey };
};

/**
 * Check if a keyboard event matches a shortcut configuration
 */
export const matchesShortcut = (
  event: KeyboardEvent,
  shortcut: string
): boolean => {
  const { modifiers, key } = parseShortcut(shortcut);
  const mac = isMac();

  // Check modifier keys
  for (const modifier of modifiers) {
    switch (modifier) {
      case 'ctrl':
        if (mac ? !event.metaKey : !event.ctrlKey) return false;
        break;
      case 'cmd':
        if (!event.metaKey) return false;
        break;
      case 'alt':
        if (!event.altKey) return false;
        break;
      case 'shift':
        if (!event.shiftKey) return false;
        break;
    }
  }

  // Check that no extra modifiers are pressed (unless specified)
  const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
  const requiresModifier = modifiers.length > 0;

  // For non-modifier shortcuts, ensure no modifiers are pressed
  if (!requiresModifier && hasModifier) return false;

  // Check the main key
  const eventKey = event.key.toLowerCase();
  const expectedKey = key.toLowerCase();

  // Handle special keys
  if (expectedKey === ' ' && eventKey === ' ') return true;
  if (expectedKey === 'delete' && (eventKey === 'delete' || eventKey === 'del'))
    return true;
  if (expectedKey === 'escape' && eventKey === 'escape') return true;
  if (expectedKey === 'enter' && eventKey === 'enter') return true;
  if (expectedKey === 'space' && (eventKey === ' ' || eventKey === 'space'))
    return true;

  // Handle arrow keys
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(expectedKey)) {
    return eventKey === expectedKey;
  }

  // Handle regular keys (letters, numbers)
  return eventKey === expectedKey;
};

// =============================================================================
// Default Shortcuts
// =============================================================================

export const createDefaultShortcuts = (
  actions: ShortcutActions
): ShortcutConfig[] => [
  // Recording
  {
    key: 'space',
    handler: actions.toggleRecording,
    description: 'Start/Stop profiling',
    category: 'recording',
    preventDefault: true,
    requireNonInput: true,
  },

  // Navigation
  {
    key: 'arrowleft',
    handler: actions.previousCommit,
    description: 'Navigate to previous commit',
    category: 'navigation',
    preventDefault: false,
    requireNonInput: true,
  },
  {
    key: 'arrowright',
    handler: actions.nextCommit,
    description: 'Navigate to next commit',
    category: 'navigation',
    preventDefault: false,
    requireNonInput: true,
  },
  {
    key: 'arrowup',
    handler: actions.navigateUp,
    description: 'Navigate up in component tree',
    category: 'navigation',
    preventDefault: false,
    requireNonInput: true,
  },
  {
    key: 'arrowdown',
    handler: actions.navigateDown,
    description: 'Navigate down in component tree',
    category: 'navigation',
    preventDefault: false,
    requireNonInput: true,
  },
  {
    key: 'enter',
    handler: actions.openDetails,
    description: 'Open component details',
    category: 'navigation',
    preventDefault: false,
    requireNonInput: true,
  },
  {
    key: 'escape',
    handler: actions.closePanel,
    description: 'Close detail panel / dialogs',
    category: 'navigation',
    preventDefault: false,
    requireNonInput: false, // Allow escape even in inputs
  },

  // Views
  {
    key: '1',
    handler: () => actions.setViewMode('tree'),
    description: 'Switch to Tree view',
    category: 'views',
    preventDefault: false,
    requireNonInput: true,
  },
  {
    key: '2',
    handler: () => actions.setViewMode('flamegraph'),
    description: 'Switch to Flamegraph view',
    category: 'views',
    preventDefault: false,
    requireNonInput: true,
  },
  {
    key: '3',
    handler: () => actions.setViewMode('timeline'),
    description: 'Switch to Timeline view',
    category: 'views',
    preventDefault: false,
    requireNonInput: true,
  },
  {
    key: '4',
    handler: () => actions.setViewMode('analysis'),
    description: 'Switch to Analysis view',
    category: 'views',
    preventDefault: false,
    requireNonInput: true,
  },

  // Data
  {
    key: isMac() ? 'cmd+s' : 'ctrl+s',
    handler: actions.exportData,
    description: 'Export profile data',
    category: 'data',
    preventDefault: true,
    requireNonInput: true,
  },
  {
    key: isMac() ? 'cmd+o' : 'ctrl+o',
    handler: actions.importData,
    description: 'Import profile data',
    category: 'data',
    preventDefault: true,
    requireNonInput: true,
  },
  {
    key: isMac() ? 'cmd+delete' : 'ctrl+delete',
    handler: actions.clearData,
    description: 'Clear all data',
    category: 'data',
    preventDefault: true,
    requireNonInput: true,
  },
  {
    key: isMac() ? 'cmd+backspace' : 'ctrl+backspace',
    handler: actions.clearData,
    description: 'Clear all data (alternative)',
    category: 'data',
    preventDefault: true,
    requireNonInput: true,
  },

  // Help
  {
    key: '?',
    handler: actions.toggleHelp,
    description: 'Show keyboard shortcuts help',
    category: 'help',
    preventDefault: true,
    requireNonInput: true,
  },
];

// =============================================================================
// Shortcut Actions Interface
// =============================================================================

export interface ShortcutActions {
  toggleRecording: () => void;
  previousCommit: () => void;
  nextCommit: () => void;
  navigateUp: () => void;
  navigateDown: () => void;
  openDetails: () => void;
  closePanel: () => void;
  setViewMode: (mode: 'tree' | 'flamegraph' | 'timeline' | 'analysis') => void;
  exportData: () => void;
  importData: () => void;
  clearData: () => void;
  toggleHelp: () => void;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Custom hook for managing keyboard shortcuts
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   toggleRecording: handleToggleRecording,
 *   setViewMode: handleSetViewMode,
 *   // ... other actions
 * });
 * ```
 */
export const useKeyboardShortcuts = (
  actions: Partial<ShortcutActions>,
  options: UseKeyboardShortcutsOptions = {}
): {
  shortcuts: ShortcutConfig[];
  isEnabled: boolean;
} => {
  const { enabled = true, when = true } = options;
  const isEnabled = enabled && when;

  // Create shortcuts configuration
  const shortcuts = useRef<ShortcutConfig[]>([]);

  // Update shortcuts when actions change
  useEffect(() => {
    shortcuts.current = createDefaultShortcuts(actions as ShortcutActions);
  }, [actions]);

  // Main keyboard handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isEnabled) return;

      for (const shortcut of shortcuts.current) {
        if (!matchesShortcut(event, shortcut.key)) continue;

        // Check if we should skip because an input is focused
        if (shortcut.requireNonInput !== false && isInputFocused()) {
          continue;
        }

        // Execute the handler
        if (shortcut.preventDefault) {
          event.preventDefault();
        }
        if (shortcut.stopPropagation) {
          event.stopPropagation();
        }

        shortcut.handler(event);
        break; // Only execute first matching shortcut
      }
    },
    [isEnabled]
  );

  // Attach/detach event listener
  useEffect(() => {
    if (!isEnabled) return;

    // Use capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, isEnabled]);

  return {
    shortcuts: shortcuts.current,
    isEnabled,
  };
};

// =============================================================================
// Additional Exports
// =============================================================================

/**
 * Group shortcuts by category for display in help dialog
 */
export const groupShortcutsByCategory = (
  shortcuts: ShortcutConfig[]
): ShortcutGroup[] => {
  const groups: Record<ShortcutCategory, ShortcutConfig[]> = {
    recording: [],
    navigation: [],
    views: [],
    data: [],
    help: [],
  };

  for (const shortcut of shortcuts) {
    groups[shortcut.category].push(shortcut);
  }

  const result: ShortcutGroup[] = [
    { category: 'recording', label: 'Recording', shortcuts: groups.recording },
    { category: 'navigation', label: 'Navigation', shortcuts: groups.navigation },
    { category: 'views', label: 'Views', shortcuts: groups.views },
    { category: 'data', label: 'Data Management', shortcuts: groups.data },
    { category: 'help', label: 'Help', shortcuts: groups.help },
  ];
  
  return result.filter((group) => group.shortcuts.length > 0);
};

/**
 * Format a shortcut key for display
 */
export const formatShortcut = (key: string): string => {
  const mac = isMac();
  return key
    .split('+')
    .map((part) => {
      switch (part.toLowerCase()) {
        case 'ctrl':
          return mac ? '⌘' : 'Ctrl';
        case 'cmd':
          return '⌘';
        case 'alt':
          return mac ? '⌥' : 'Alt';
        case 'shift':
          return mac ? '⇧' : 'Shift';
        case 'delete':
          return 'Del';
        case 'escape':
          return 'Esc';
        case 'arrowup':
          return '↑';
        case 'arrowdown':
          return '↓';
        case 'arrowleft':
          return '←';
        case 'arrowright':
          return '→';
        case 'space':
          return 'Space';
        default:
          return part.length === 1 ? part.toUpperCase() : part;
      }
    })
    .join(mac ? ' ' : '+');
};

export default useKeyboardShortcuts;
