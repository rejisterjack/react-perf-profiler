/**
 * Custom React hooks for React Perf Profiler
 * @module panel/hooks
 *
 * This module provides a collection of custom React hooks for managing
 * profiler state, analyzing component performance, and handling UI concerns
 * like virtualization and responsive design.
 *
 * @example
 * ```tsx
 * import { useProfiler, useComponentData, useVirtualList } from '@/panel/hooks';
 * ```
 */

// Main profiler hook
export { useProfiler } from './useProfiler';
export type { UseProfilerReturn } from './useProfiler';

// Component data analysis hook
export { useComponentData } from './useComponentData';
export type { UseComponentDataReturn } from './useComponentData';

// Performance analysis hook
export { useAnalysis } from './useAnalysis';
export type { UseAnalysisReturn } from './useAnalysis';

// Virtual list for performance
export { useVirtualList } from './useVirtualList';
export type {
  UseVirtualListOptions,
  UseVirtualListReturn,
  VirtualItem,
} from './useVirtualList';

// Element resize observation
export { useResizeObserver } from './useResizeObserver';
export type {
  UseResizeObserverOptions,
  UseResizeObserverReturn,
  ElementSize,
} from './useResizeObserver';

// Debounce utilities
export {
  useDebounce,
  useDebouncedCallback,
  useDebounceState,
} from './useDebounce';
export type { DebounceOptions } from './useDebounce';

// Local storage persistence
export {
  useLocalStorage,
  useLocalStorageObject,
  LocalStorageError,
} from './useLocalStorage';
export type {
  UseLocalStorageOptions,
  UseLocalStorageReturn,
} from './useLocalStorage';

// Keyboard shortcuts
export {
  useKeyboardShortcuts,
  isMac,
  isInputFocused,
  parseShortcut,
  matchesShortcut,
  formatShortcut,
  groupShortcutsByCategory,
  createDefaultShortcuts,
} from './useKeyboardShortcuts';
export type {
  ShortcutConfig,
  ShortcutActions,
  ShortcutCategory,
  ShortcutGroup,
  UseKeyboardShortcutsOptions,
  ModifierKey,
} from './useKeyboardShortcuts';
