/**
 * Theme Provider Component
 * Manages theme state and applies CSS theme classes based on current theme
 */

import type React from 'react';
import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/panel/stores/settingsStore';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Gets the effective theme based on user preference and system settings
 */
const getEffectiveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
};

/**
 * Applies CSS theme class to document root
 * CSS variables are automatically applied via CSS cascade
 */
const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  const effectiveTheme = getEffectiveTheme(theme);

  // Remove existing theme classes
  root.classList.remove('theme-light', 'theme-dark');

  // Apply new theme class
  root.classList.add(`theme-${effectiveTheme}`);

  // Set data attribute for any CSS that needs it
  root.setAttribute('data-theme', effectiveTheme);

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    const themeColor = effectiveTheme === 'dark' ? '#0d1117' : '#ffffff';
    metaThemeColor.setAttribute('content', themeColor);
  }
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const colorScheme = useSettingsStore((state) => state.colorScheme);

  // Apply theme when colorScheme changes
  useEffect(() => {
    applyTheme(colorScheme);
  }, [colorScheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (colorScheme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [colorScheme]);

  return <>{children}</>;
};

/**
 * Hook to get current theme and theme-related utilities
 */
export const useTheme = () => {
  const colorScheme = useSettingsStore((state) => state.colorScheme);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  const setTheme = useCallback(
    (theme: Theme) => {
      updateSetting('colorScheme', theme);
    },
    [updateSetting]
  );

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme =
      colorScheme === 'light' ? 'dark' : colorScheme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
  }, [colorScheme, setTheme]);

  const effectiveTheme = getEffectiveTheme(colorScheme);

  return {
    theme: colorScheme,
    effectiveTheme,
    setTheme,
    toggleTheme,
    isDark: effectiveTheme === 'dark',
    isLight: effectiveTheme === 'light',
    isSystem: colorScheme === 'system',
  };
};

export default ThemeProvider;
