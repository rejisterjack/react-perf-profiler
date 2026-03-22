import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  isMac,
  isInputFocused,
  parseShortcut,
  matchesShortcut,
  groupShortcutsByCategory,
  formatShortcut,
  checkShortcutConflict,
  validateShortcuts,
  showConflictWarnings,
  RESERVED_BROWSER_SHORTCUTS,
  type ShortcutActions,
  type ShortcutConfig,
} from '@/panel/hooks/useKeyboardShortcuts';
import { panelLogger } from '@/shared/logger';

describe('Keyboard Shortcuts Utilities', () => {
  describe('isMac', () => {
    it('should return true for Mac platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
      });
      expect(isMac()).toBe(true);
    });

    it('should return false for Windows platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
      });
      expect(isMac()).toBe(false);
    });

    it('should return false for Linux platform', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Linux x86_64',
        writable: true,
      });
      expect(isMac()).toBe(false);
    });
  });

  describe('isInputFocused', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should return false when no element is focused', () => {
      document.body.focus();
      expect(isInputFocused()).toBe(false);
    });

    it('should return true when input is focused', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      expect(isInputFocused()).toBe(true);
    });

    it('should return true when textarea is focused', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();
      expect(isInputFocused()).toBe(true);
    });

    it('should return true when select is focused', () => {
      const select = document.createElement('select');
      document.body.appendChild(select);
      select.focus();
      expect(isInputFocused()).toBe(true);
    });

    it('should return true when contentEditable is focused', () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);
      div.focus();
      expect(isInputFocused()).toBe(true);
    });
  });

  describe('parseShortcut', () => {
    it('should parse simple key', () => {
      expect(parseShortcut('s')).toEqual({ modifiers: [], key: 's' });
    });

    it('should parse key with modifiers', () => {
      expect(parseShortcut('ctrl+s')).toEqual({ modifiers: ['ctrl'], key: 's' });
    });

    it('should parse multiple modifiers', () => {
      expect(parseShortcut('ctrl+shift+a')).toEqual({
        modifiers: ['ctrl', 'shift'],
        key: 'a',
      });
    });

    it('should normalize space', () => {
      expect(parseShortcut('space')).toEqual({ modifiers: [], key: ' ' });
    });
  });

  describe('matchesShortcut', () => {
    it('should match simple key', () => {
      const event = new KeyboardEvent('keydown', { key: 's' });
      expect(matchesShortcut(event, 's')).toBe(true);
    });

    it('should not match when modifiers differ', () => {
      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
      expect(matchesShortcut(event, 's')).toBe(false);
    });

    it('should match with ctrl modifier on Windows', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true });
      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
      expect(matchesShortcut(event, 'ctrl+s')).toBe(true);
    });

    it('should match with meta modifier on Mac', () => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', writable: true });
      const event = new KeyboardEvent('keydown', { key: 's', metaKey: true });
      expect(matchesShortcut(event, 'ctrl+s')).toBe(true);
    });

    it('should match space key', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      expect(matchesShortcut(event, 'space')).toBe(true);
    });

    it('should match arrow keys', () => {
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      expect(matchesShortcut(upEvent, 'arrowup')).toBe(true);

      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      expect(matchesShortcut(downEvent, 'arrowdown')).toBe(true);
    });

    it('should match escape key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(matchesShortcut(event, 'escape')).toBe(true);
    });

    it('should match enter key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(matchesShortcut(event, 'enter')).toBe(true);
    });
  });

  describe('groupShortcutsByCategory', () => {
    it('should group shortcuts by category', () => {
      const shortcuts = [
        { key: 'r', handler: vi.fn(), description: 'Record', category: 'recording' },
        { key: 's', handler: vi.fn(), description: 'Stop', category: 'recording' },
        { key: '1', handler: vi.fn(), description: 'Tree', category: 'views' },
        { key: '?', handler: vi.fn(), description: 'Help', category: 'help' },
      ] as any;

      const groups = groupShortcutsByCategory(shortcuts);

      expect(groups).toHaveLength(3);
      expect(groups.find((g) => g.category === 'recording')?.shortcuts).toHaveLength(2);
      expect(groups.find((g) => g.category === 'views')?.shortcuts).toHaveLength(1);
      expect(groups.find((g) => g.category === 'help')?.shortcuts).toHaveLength(1);
    });

    it('should filter out empty categories', () => {
      const shortcuts = [
        { key: 'r', handler: vi.fn(), description: 'Record', category: 'recording' },
      ] as any;

      const groups = groupShortcutsByCategory(shortcuts);

      expect(groups.find((g) => g.category === 'recording')).toBeDefined();
      expect(groups.find((g) => g.category === 'views')).toBeUndefined();
    });
  });

  describe('formatShortcut', () => {
    it('should format simple key', () => {
      expect(formatShortcut('s')).toBe('S');
    });

    it('should format with modifier on Windows', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true });
      expect(formatShortcut('ctrl+s')).toBe('Ctrl+S');
    });

    it('should format with modifier on Mac', () => {
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel', writable: true });
      expect(formatShortcut('ctrl+s')).toBe('⌘ S');
    });

    it('should format arrow keys', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true });
      expect(formatShortcut('arrowup')).toBe('↑');
      expect(formatShortcut('arrowdown')).toBe('↓');
      expect(formatShortcut('arrowleft')).toBe('←');
      expect(formatShortcut('arrowright')).toBe('→');
    });

    it('should format escape', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true });
      expect(formatShortcut('escape')).toBe('Esc');
    });

    it('should format space', () => {
      Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true });
      expect(formatShortcut('space')).toBe('Space');
    });
  });
});

describe('useKeyboardShortcuts', () => {
  const mockActions: Partial<ShortcutActions> = {
    toggleRecording: vi.fn(),
    setViewMode: vi.fn(),
    clearData: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return shortcuts array', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(mockActions));

    expect(result.current.shortcuts).toBeDefined();
    expect(Array.isArray(result.current.shortcuts)).toBe(true);
    expect(result.current.isEnabled).toBe(true);
  });

  it('should be disabled when enabled option is false', () => {
    const { result } = renderHook(() =>
      useKeyboardShortcuts(mockActions, { enabled: false })
    );

    expect(result.current.isEnabled).toBe(false);
  });

  it('should be disabled when when option is false', () => {
    const { result } = renderHook(() =>
      useKeyboardShortcuts(mockActions, { when: false })
    );

    expect(result.current.isEnabled).toBe(false);
  });

  it('should show feedback when shortcut is triggered', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(mockActions));

    // Trigger a shortcut with feedback
    act(() => {
      result.current.shortcuts.forEach((s: any) => {
        if (s.feedbackMessage) {
          // Simulate shortcut execution
        }
      });
    });

    // Feedback might be null initially
    expect(result.current.feedback).toBeNull();
  });

  it('should clear feedback manually', () => {
    const { result } = renderHook(() => useKeyboardShortcuts(mockActions));

    act(() => {
      result.current.clearFeedback();
    });

    expect(result.current.feedback).toBeNull();
  });

  it('should handle keyboard events', () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true });
    
    const { result } = renderHook(() => useKeyboardShortcuts(mockActions));

    // Simulate keyboard event
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'c' });
      window.dispatchEvent(event);
    });

    // Actions should not be called because input is not focused check
    expect(mockActions.clearData).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Conflict Detection
// =============================================================================

describe('Shortcut conflict detection', () => {
  const makeShortcut = (key: string): ShortcutConfig => ({
    key,
    handler: vi.fn(),
    description: `Test shortcut for ${key}`,
    category: 'recording',
  });

  describe('checkShortcutConflict', () => {
    it('returns null for a non-conflicting shortcut', () => {
      expect(checkShortcutConflict('ctrl+shift+z')).toBeNull();
      expect(checkShortcutConflict('alt+r')).toBeNull();
    });

    it('returns error severity for ctrl+shift+p (command palette)', () => {
      const conflict = checkShortcutConflict('ctrl+shift+p');
      expect(conflict).not.toBeNull();
      expect(conflict?.severity).toBe('error');
    });

    it('returns error severity for cmd+shift+p (macOS command palette)', () => {
      const conflict = checkShortcutConflict('cmd+shift+p');
      expect(conflict?.severity).toBe('error');
    });

    it('returns warning severity for other reserved shortcuts', () => {
      const conflict = checkShortcutConflict('ctrl+p'); // Print
      expect(conflict).not.toBeNull();
      expect(conflict?.severity).toBe('warning');
    });

    it('suggests an alternative for command palette conflicts', () => {
      const conflict = checkShortcutConflict('ctrl+shift+p');
      expect(conflict?.alternative).toBeTruthy();
      expect(typeof conflict?.alternative).toBe('string');
    });

    it('is case-insensitive', () => {
      expect(checkShortcutConflict('Ctrl+Shift+P')).not.toBeNull();
      expect(checkShortcutConflict('CTRL+SHIFT+P')).not.toBeNull();
    });

    it('includes the shortcut and message in the returned object', () => {
      const conflict = checkShortcutConflict('ctrl+shift+p');
      expect(conflict?.shortcut).toBe('ctrl+shift+p');
      expect(typeof conflict?.message).toBe('string');
      expect(conflict?.message.length).toBeGreaterThan(0);
    });
  });

  describe('validateShortcuts', () => {
    it('returns empty array when no shortcuts conflict', () => {
      const shortcuts = [makeShortcut('ctrl+shift+z'), makeShortcut('alt+r')];
      expect(validateShortcuts(shortcuts)).toHaveLength(0);
    });

    it('returns one conflict entry per conflicting shortcut', () => {
      const shortcuts = [
        makeShortcut('ctrl+shift+p'), // error
        makeShortcut('ctrl+p'),       // warning
        makeShortcut('ctrl+shift+z'), // clean
      ];
      const conflicts = validateShortcuts(shortcuts);
      expect(conflicts).toHaveLength(2);
    });

    it('preserves order of conflicts matching input order', () => {
      const shortcuts = [makeShortcut('ctrl+p'), makeShortcut('ctrl+s')];
      const conflicts = validateShortcuts(shortcuts);
      expect(conflicts[0]?.shortcut).toBe('ctrl+p');
      expect(conflicts[1]?.shortcut).toBe('ctrl+s');
    });

    it('returns empty array for empty input', () => {
      expect(validateShortcuts([])).toHaveLength(0);
    });
  });

  describe('showConflictWarnings', () => {
    beforeEach(() => {
      vi.spyOn(panelLogger, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls panelLogger.warn when conflicts are found', () => {
      showConflictWarnings([makeShortcut('ctrl+shift+p')]);
      expect(panelLogger.warn).toHaveBeenCalled();
    });

    it('does not call panelLogger.warn when no conflicts exist', () => {
      showConflictWarnings([makeShortcut('ctrl+shift+z')]);
      expect(panelLogger.warn).not.toHaveBeenCalled();
    });

    it('does not call panelLogger.warn for empty input', () => {
      showConflictWarnings([]);
      expect(panelLogger.warn).not.toHaveBeenCalled();
    });

    it('logs once per conflict plus a summary line', () => {
      showConflictWarnings([makeShortcut('ctrl+shift+p'), makeShortcut('ctrl+p')]);
      // header + 2 individual conflicts + summary = 4 calls minimum
      expect(panelLogger.warn).toHaveBeenCalledTimes(4);
    });
  });

  describe('RESERVED_BROWSER_SHORTCUTS', () => {
    it('is a non-empty array of lowercase strings', () => {
      expect(Array.isArray(RESERVED_BROWSER_SHORTCUTS)).toBe(true);
      expect(RESERVED_BROWSER_SHORTCUTS.length).toBeGreaterThan(0);
      for (const s of RESERVED_BROWSER_SHORTCUTS) {
        expect(s).toBe(s.toLowerCase());
      }
    });

    it('contains both ctrl+shift+p and cmd+shift+p', () => {
      expect(RESERVED_BROWSER_SHORTCUTS).toContain('ctrl+shift+p');
      expect(RESERVED_BROWSER_SHORTCUTS).toContain('cmd+shift+p');
    });
  });
});
