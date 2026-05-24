/**
 * Keyboard shortcuts hook for the profiler panel.
 *
 * Shortcuts:
 *   Ctrl/Cmd + R   — toggle recording
 *   Ctrl/Cmd + E   — export profile
 *   Ctrl/Cmd + 1-4 — switch view modes (tree, flamegraph, timeline, analysis)
 *   Escape          — deselect component
 *   Ctrl/Cmd + F   — focus search
 */

import { useEffect } from 'react';
import type { ViewMode } from '@/src/panel/stores/profilerStore';

const VIEW_MODES: ViewMode[] = ['tree', 'flamegraph', 'timeline', 'analysis'];

export interface KeyboardShortcutCallbacks {
  /** Toggle profiling recording on / off. */
  onToggleRecording: () => void;
  /** Export the current profile data. */
  onExport: () => void;
  /** Switch the active view mode. */
  onSwitchView: (mode: ViewMode) => void;
  /** Deselect the currently selected component. */
  onDeselectComponent: () => void;
  /** Focus the search input. */
  onFocusSearch: () => void;
}

export function useKeyboardShortcuts(callbacks: KeyboardShortcutCallbacks): void {
  const { onToggleRecording, onExport, onSwitchView, onDeselectComponent, onFocusSearch } =
    callbacks;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // ─── Ctrl/Cmd + R  →  toggle recording ───────────────
      if (mod && e.key === 'r') {
        e.preventDefault();
        onToggleRecording();
        return;
      }

      // ─── Ctrl/Cmd + E  →  export ──────────────────────────
      if (mod && e.key === 'e') {
        e.preventDefault();
        onExport();
        return;
      }

      // ─── Ctrl/Cmd + F  →  focus search ────────────────────
      if (mod && e.key === 'f') {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      // ─── Ctrl/Cmd + 1-4  →  switch view mode ──────────────
      if (mod && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        onSwitchView(VIEW_MODES[index]);
        return;
      }

      // ─── Escape  →  deselect component ────────────────────
      if (e.key === 'Escape') {
        // Only act when not in an input/textarea to avoid interfering with dialog dismissal
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') {
          return;
        }
        e.preventDefault();
        onDeselectComponent();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleRecording, onExport, onSwitchView, onDeselectComponent, onFocusSearch]);
}
