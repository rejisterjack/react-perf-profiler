/**
 * Hook for persisting state to localStorage with type safety
 * @module panel/hooks/useLocalStorage
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Options for useLocalStorage hook
 */
export interface UseLocalStorageOptions<T> {
  /** Key for localStorage */
  key: string;
  /** Default value if no value exists in localStorage */
  defaultValue: T;
  /** Optional serializer function */
  serializer?: (value: T) => string;
  /** Optional deserializer function */
  deserializer?: (value: string) => T;
  /** Whether to sync with other tabs/windows */
  sync?: boolean;
}

/**
 * Return type for useLocalStorage hook
 */
export interface UseLocalStorageReturn<T> {
  /** Current value */
  value: T;
  /** Set value (accepts value or updater function) */
  setValue: (value: T | ((prev: T) => T)) => void;
  /** Remove value from localStorage and reset to default */
  removeValue: () => void;
  /** Check if value has been loaded from localStorage */
  isLoaded: boolean;
}

/**
 * Custom error for localStorage operations
 */
export class LocalStorageError extends Error {
  constructor(
    message: string,
    public readonly key: string
  ) {
    super(message);
    this.name = 'LocalStorageError';
  }
}

/**
 * Default serializer (JSON stringify)
 */
const defaultSerializer = <T>(value: T): string => JSON.stringify(value);

/**
 * Default deserializer (JSON parse)
 */
const defaultDeserializer = <T>(value: string): T => JSON.parse(value);

/**
 * Hook for persisting state to localStorage with full TypeScript support
 *
 * Automatically syncs with localStorage and optionally across browser tabs.
 * Handles serialization errors gracefully and provides loading state.
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { value: theme, setValue: setTheme } = useLocalStorage({
 *     key: 'app-theme',
 *     defaultValue: 'light' as 'light' | 'dark',
 *   });
 *
 *   return (
 *     <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
 *       Current: {theme}
 *     </button>
 *   );
 * }
 * ```
 *
 * @param options - Configuration options
 * @returns Object containing value, setter, remover, and loading state
 */
export function useLocalStorage<T>(options: UseLocalStorageOptions<T>): UseLocalStorageReturn<T> {
  const {
    key,
    defaultValue,
    serializer = defaultSerializer,
    deserializer = defaultDeserializer,
    sync = true,
  } = options;

  const [state, setState] = useState<T>(defaultValue);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const isInternalChange = useRef<boolean>(false);

  /**
   * Read value from localStorage
   */
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return deserializer(item);
    } catch (_error) {
      return defaultValue;
    }
  }, [key, defaultValue, deserializer]);

  /**
   * Write value to localStorage
   */
  const writeValue = useCallback(
    (value: T): void => {
      if (typeof window === 'undefined') {
        return;
      }

      try {
        const serialized = serializer(value);
        window.localStorage.setItem(key, serialized);
      } catch (error) {

        // Check for quota exceeded error
        if (error instanceof Error && error.name === 'QuotaExceededError') {
        }

        throw new LocalStorageError(
          error instanceof Error ? error.message : 'Failed to write to localStorage',
          key
        );
      }
    },
    [key, serializer]
  );

  /**
   * Remove value from localStorage
   */
  const removeValue = useCallback((): void => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(key);
      isInternalChange.current = true;
      setState(defaultValue);
    } catch (_error) {
    }
  }, [key, defaultValue]);

  /**
   * Set value (handles both direct values and updater functions)
   */
  const setValue = useCallback(
    (value: T | ((prev: T) => T)): void => {
      try {
        const newValue = value instanceof Function ? value(state) : value;

        isInternalChange.current = true;
        setState(newValue);
        writeValue(newValue);
      } catch (_error) {
      }
    },
    [state, writeValue]
  );

  /**
   * Initial load from localStorage
   */
  useEffect(() => {
    const value = readValue();
    setState(value);
    setIsLoaded(true);
  }, [readValue]);

  /**
   * Listen for changes from other tabs/windows
   */
  useEffect(() => {
    if (!sync || typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (event: StorageEvent): void => {
      // Ignore changes to other keys
      if (event.key !== key) {
        return;
      }

      // Skip if this was an internal change
      if (isInternalChange.current) {
        isInternalChange.current = false;
        return;
      }

      try {
        if (event.newValue === null) {
          // Key was removed
          setState(defaultValue);
        } else {
          const newValue = deserializer(event.newValue);
          setState(newValue);
        }
      } catch (_error) {
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, defaultValue, deserializer, sync]);

  return {
    value: state,
    setValue,
    removeValue,
    isLoaded,
  };
}

/**
 * Hook for managing multiple related localStorage values
 *
 * @example
 * ```tsx
 * const settings = useLocalStorageObject({
 *   theme: { key: 'theme', defaultValue: 'light' },
 *   sidebar: { key: 'sidebar', defaultValue: true },
 * });
 *
 * // Access individual values
 * settings.theme.value; // 'light'
 * settings.theme.setValue('dark');
 * ```
 */
export function useLocalStorageObject<T extends Record<string, unknown>>(
  config: { [K in keyof T]: { key: string; defaultValue: T[K] } }
): { [K in keyof T]: UseLocalStorageReturn<T[K]> } {
  // Convert config to entries array for stable hook calls
  const entries = Object.entries(config) as Array<
    [keyof T, { key: string; defaultValue: T[keyof T] }]
  >;

  // Create an array of hook results in a stable order
  const hookResults = entries.map(([, configItem]) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useLocalStorage({
      key: configItem.key,
      defaultValue: configItem.defaultValue,
    })
  );

  // Reconstruct the result object
  const result = {} as { [K in keyof T]: UseLocalStorageReturn<T[K]> };
  entries.forEach(([key], index) => {
    result[key] = hookResults[index] as UseLocalStorageReturn<T[keyof T]>;
  });

  return result;
}
