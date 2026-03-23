/**
 * Keyboard Shortcuts Hook
 * Comprehensive keyboard shortcut management for React Perf Profiler
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SHORTCUT_FEEDBACK_TIMEOUT_MS } from '@/shared/constants';
import { panelLogger } from '@/shared/logger';

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
  /** Visual feedback message when shortcut is triggered */
  feedbackMessage?: string;
}

export type ShortcutCategory = 'recording' | 'navigation' | 'views' | 'data' | 'analysis' | 'help';

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

export interface ShortcutFeedback {
  message: string;
  timestamp: number;
  id: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Browser shortcuts that are reserved and may cause conflicts
 * These should be avoided or used with caution
 */
export const RESERVED_BROWSER_SHORTCUTS: string[] = [
  // Browser command palette / quick open
  'ctrl+shift+p', // Chrome/Edge/Firefox command palette
  'cmd+shift+p', // macOS
  // Common browser shortcuts
  'ctrl+p', // Print
  'cmd+p', // Print (macOS)
  'ctrl+s', // Save
  'cmd+s', // Save (macOS)
  'ctrl+o', // Open file
  'cmd+o', // Open file (macOS)
  'ctrl+t', // New tab
  'cmd+t', // New tab (macOS)
  'ctrl+w', // Close tab
  'cmd+w', // Close tab (macOS)
  'ctrl+r', // Reload
  'cmd+r', // Reload (macOS)
  'f5', // Reload
  'ctrl+f', // Find
  'cmd+f', // Find (macOS)
  'ctrl+h', // History
  'cmd+y', // History (macOS)
  'ctrl+j', // Downloads
  'cmd+shift+j', // Downloads (macOS)
  'f12', // DevTools
  'ctrl+shift+i', // DevTools
  'cmd+option+i', // DevTools (macOS)
];

/**
 * Conflict warning information
 */
export interface ShortcutConflict {
  shortcut: string;
  severity: 'error' | 'warning';
  message: string;
  alternative?: string;
}

/**
 * Check if a shortcut conflicts with browser defaults
 */
export const checkShortcutConflict = (shortcut: string): ShortcutConflict | null => {
  const normalizedShortcut = shortcut.toLowerCase().replace(/\s/g, '');

  // Check against reserved browser shortcuts
  if (RESERVED_BROWSER_SHORTCUTS.includes(normalizedShortcut)) {
    const isCommandPalette =
      normalizedShortcut === 'ctrl+shift+p' || normalizedShortcut === 'cmd+shift+p';

    return {
      shortcut,
      severity: isCommandPalette ? 'error' : 'warning',
      message: isCommandPalette
        ? `\`${shortcut}\` conflicts with browser Command Palette (Quick Open). Users may accidentally trigger browser features.`
        : `\`${shortcut}\` may conflict with browser shortcuts.`,
      alternative: isCommandPalette
        ? normalizedShortcut.startsWith('cmd')
          ? 'Cmd+Shift+R'
          : 'Ctrl+Shift+R'
        : undefined,
    };
  }

  return null;
};

/**
 * Validate all shortcuts and return any conflicts
 */
export const validateShortcuts = (shortcuts: ShortcutConfig[]): ShortcutConflict[] => {
  const conflicts: ShortcutConflict[] = [];

  for (const shortcut of shortcuts) {
    const conflict = checkShortcutConflict(shortcut.key);
    if (conflict) {
      conflicts.push(conflict);
    }
  }

  return conflicts;
};

/**
 * Show conflict warning via structured logger
 */
export const showConflictWarnings = (shortcuts: ShortcutConfig[]): void => {
  const conflicts = validateShortcuts(shortcuts);

  if (conflicts.length === 0) return;

  panelLogger.warn('Keyboard shortcut conflicts detected', { source: 'useKeyboardShortcuts' });

  for (const conflict of conflicts) {
    panelLogger.warn(conflict.message, {
      source: 'useKeyboardShortcuts',
      severity: conflict.severity,
      ...(conflict.alternative ? { alternative: conflict.alternative } : {}),
    });
  }

  panelLogger.warn('Consider using different shortcuts to avoid browser conflicts.', {
    source: 'useKeyboardShortcuts',
  });
};

/**
 * Check if the current platform is macOS
 */
export const isMac = (): boolean => {
  // Check for macOS using modern userAgentData or deprecated navigator.platform
  const uaPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform;
  if (uaPlatform) {
    return uaPlatform === 'macOS';
  }
  return /Mac/i.test(navigator.platform);
};

/**
 * Check if an input element is currently focused.
 * Uses the `contentEditable` attribute directly (instead of the computed
 * `isContentEditable` property) for reliable behaviour in jsdom test environments.
 */
export const isInputFocused = (): boolean => {
  const activeElement = document.activeElement;
  // Treat no focus or focus on the document body as "not in an input"
  if (!activeElement || activeElement === document.body) return false;

  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  const ce = (activeElement as HTMLElement).contentEditable;
  return ce === 'true' || ce === '';
};

/**
 * Parse a shortcut key string into components
 * e.g., "ctrl+s" -> { modifiers: ['ctrl'], key: 's' }
 * e.g., "Space" -> { modifiers: [], key: ' ' }
 */
export const parseShortcut = (shortcut: string): { modifiers: ModifierKey[]; key: string } => {
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
export const matchesShortcut = (event: KeyboardEvent, shortcut: string): boolean => {
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
  if (expectedKey === 'delete' && (eventKey === 'delete' || eventKey === 'del')) return true;
  if (expectedKey === 'escape' && eventKey === 'escape') return true;
  if (expectedKey === 'enter' && eventKey === 'enter') return true;
  if (expectedKey === 'space' && (eventKey === ' ' || eventKey === 'space')) return true;

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

export const createDefaultShortcuts = (actions: ShortcutActions): ShortcutConfig[] => [
  // Recording
  {
    key: isMac() ? 'cmd+shift+r' : 'ctrl+shift+r',
    handler: actions.toggleRecording,
    description: 'Start/Stop profiling',
    category: 'recording',
    preventDefault: true,
    requireNonInput: true,
    feedbackMessage: 'Profiling toggled',
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
    handler: actions.selectNode,
    description: 'Select component / Expand node',
    category: 'navigation',
    preventDefault: false,
    requireNonInput: true,
  },
  {
    key: 'space',
    handler: actions.toggleNodeExpansion,
    description: 'Toggle node expansion',
    category: 'navigation',
    preventDefault: true,
    requireNonInput: true,
  },
  {
    key: 'escape',
    handler: actions.closePanel,
    description: 'Close detail panel / Cancel operation',
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
    feedbackMessage: 'Tree view',
  },
  {
    key: '2',
    handler: () => actions.setViewMode('flamegraph'),
    description: 'Switch to Flamegraph view',
    category: 'views',
    preventDefault: false,
    requireNonInput: true,
    feedbackMessage: 'Flamegraph view',
  },
  {
    key: '3',
    handler: () => actions.setViewMode('timeline'),
    description: 'Switch to Timeline view',
    category: 'views',
    preventDefault: false,
    requireNonInput: true,
    feedbackMessage: 'Timeline view',
  },
  {
    key: '4',
    handler: () => actions.setViewMode('analysis'),
    description: 'Switch to Analysis view',
    category: 'views',
    preventDefault: false,
    requireNonInput: true,
    feedbackMessage: 'Analysis view',
  },

  // Data
  {
    key: isMac() ? 'cmd+e' : 'ctrl+e',
    handler: actions.exportData,
    description: 'Export profile',
    category: 'data',
    preventDefault: true,
    requireNonInput: true,
    feedbackMessage: 'Profile exported',
  },
  {
    key: isMac() ? 'cmd+shift+i' : 'ctrl+shift+i',
    handler: actions.importData,
    description: 'Import profile',
    category: 'data',
    preventDefault: true,
    requireNonInput: true,
  },
  {
    key: 'c',
    handler: actions.clearData,
    description: 'Clear all data',
    category: 'data',
    preventDefault: false,
    requireNonInput: true,
    feedbackMessage: 'Data cleared',
  },

  // Analysis
  {
    key: 'r',
    handler: actions.runAnalysis,
    description: 'Run analysis',
    category: 'analysis',
    preventDefault: false,
    requireNonInput: true,
    feedbackMessage: 'Running analysis...',
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
  selectNode: () => void;
  toggleNodeExpansion: () => void;
  closePanel: () => void;
  setViewMode: (mode: 'tree' | 'flamegraph' | 'timeline' | 'analysis') => void;
  exportData: () => void;
  importData: () => void;
  clearData: () => void;
  runAnalysis: () => void;
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
  feedback: ShortcutFeedback | null;
  clearFeedback: () => void;
} => {
  const { enabled = true, when = true } = options;
  const isEnabled = enabled && when;

  // State for visual feedback
  const [feedback, setFeedback] = useState<ShortcutFeedback | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show feedback message
  const showFeedback = useCallback((message: string) => {
    // Clear existing timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    // Set new feedback
    const id = Math.random().toString(36).substring(7);
    setFeedback({ message, timestamp: Date.now(), id });

    // Auto-clear after 2 seconds
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, SHORTCUT_FEEDBACK_TIMEOUT_MS);
  }, []);

  // Clear feedback manually
  const clearFeedback = useCallback(() => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedback(null);
  }, []);

  // Create shortcuts configuration
  const shortcuts = useRef<ShortcutConfig[]>([]);

  // Update shortcuts when actions change
  useEffect(() => {
    shortcuts.current = createDefaultShortcuts(actions as ShortcutActions);

    // Check for conflicts and warn in development
    if (import.meta.env?.DEV) {
      showConflictWarnings(shortcuts.current);
    }
  }, [actions]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

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

        // Show visual feedback if configured
        if (shortcut.feedbackMessage) {
          showFeedback(shortcut.feedbackMessage);
        }

        shortcut.handler(event);
        break; // Only execute first matching shortcut
      }
    },
    [isEnabled, showFeedback]
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
    feedback,
    clearFeedback,
  };
};

// =============================================================================
// Additional Exports
// =============================================================================

/**
 * Group shortcuts by category for display in help dialog
 */
export const groupShortcutsByCategory = (shortcuts: ShortcutConfig[]): ShortcutGroup[] => {
  const groups: Record<ShortcutCategory, ShortcutConfig[]> = {
    recording: [],
    navigation: [],
    views: [],
    data: [],
    analysis: [],
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
    { category: 'analysis', label: 'Analysis', shortcuts: groups.analysis },
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
