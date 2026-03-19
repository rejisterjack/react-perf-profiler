/**
 * Theme Provider Component
 * Manages theme state and applies CSS variables based on current theme
 */

import type React from 'react';
import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/panel/stores/settingsStore';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Applies CSS variables for the given theme
 */
const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;

  // Remove existing theme classes
  root.classList.remove('theme-light', 'theme-dark');

  // Determine effective theme
  let effectiveTheme: 'light' | 'dark';
  if (theme === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    effectiveTheme = theme;
  }

  // Apply theme class
  root.classList.add(`theme-${effectiveTheme}`);

  // Set CSS variables based on theme
  const variables = themeVariables[effectiveTheme];
  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
};

/**
 * CSS variable definitions for each theme
 */
const themeVariables = {
  light: {
    // Background
    'bg-primary': '#ffffff',
    'bg-secondary': '#f5f5f5',
    'bg-tertiary': '#e8e8e8',

    // Surface
    surface: '#ffffff',
    'surface-elevated': '#fafafa',
    'surface-hover': '#f0f0f0',

    // Text
    'text-primary': '#1a1a1a',
    'text-secondary': '#666666',
    'text-tertiary': '#999999',
    'text-inverse': '#ffffff',

    // Border
    border: '#e0e0e0',
    'border-focus': '#1976d2',

    // Primary
    primary: '#1976d2',
    'primary-hover': '#1565c0',
    'primary-light': '#e3f2fd',

    // Secondary
    secondary: '#5c5c5c',
    'secondary-hover': '#424242',

    // Status
    success: '#4caf50',
    'success-bg': '#e8f5e9',
    warning: '#ff9800',
    'warning-bg': '#fff3e0',
    error: '#f44336',
    'error-bg': '#ffebee',
    'error-border': '#ef5350',
    'error-text': '#c62828',
    info: '#2196f3',
    'info-bg': '#e3f2fd',

    // Severity
    critical: '#f44336',
    'critical-bg': '#ffebee',
    high: '#ff9800',
    'high-bg': '#fff3e0',
    medium: '#ffc107',
    'medium-bg': '#fff8e1',
    low: '#4caf50',
    'low-bg': '#e8f5e9',
  },
  dark: {
    // Background
    'bg-primary': '#0d1117',
    'bg-secondary': '#161b22',
    'bg-tertiary': '#21262d',

    // Surface
    surface: '#1c2128',
    'surface-elevated': '#22272e',
    'surface-hover': '#2d333b',

    // Text
    'text-primary': '#c9d1d9',
    'text-secondary': '#8b949e',
    'text-tertiary': '#6e7681',
    'text-inverse': '#0d1117',

    // Border
    border: '#30363d',
    'border-focus': '#58a6ff',

    // Primary
    primary: '#58a6ff',
    'primary-hover': '#79b8ff',
    'primary-light': '#1f6feb',

    // Secondary
    secondary: '#8b949e',
    'secondary-hover': '#b1bac4',

    // Status
    success: '#238636',
    'success-bg': '#0f3d0f',
    warning: '#d29922',
    'warning-bg': '#3d280a',
    error: '#f85149',
    'error-bg': '#3d0f0f',
    'error-border': '#f85149',
    'error-text': '#ff7b72',
    info: '#58a6ff',
    'info-bg': '#0d2137',

    // Severity
    critical: '#f85149',
    'critical-bg': '#3d0f0f',
    high: '#d29922',
    'high-bg': '#3d280a',
    medium: '#e3b341',
    'medium-bg': '#3d300a',
    low: '#238636',
    'low-bg': '#0f3d0f',
  },
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

  const effectiveTheme: 'light' | 'dark' =
    colorScheme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : colorScheme;

  return {
    theme: colorScheme,
    effectiveTheme,
    setTheme,
    toggleTheme,
    isDark: effectiveTheme === 'dark',
    isLight: effectiveTheme === 'light',
  };
};

export default ThemeProvider;
