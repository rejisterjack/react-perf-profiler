/**
 * Theme Toggle Component
 * Allows switching between light, dark, and system themes
 */

import type React from 'react';
import { useTheme } from './ThemeProvider';
import { Icon } from '../Common/Icon/Icon';
import styles from './ThemeToggle.module.css';

// Icon mapping for theme modes
const iconMap: Record<string, string> = {
  light: 'lightbulb',
  dark: 'moon',
  system: 'settings',
};

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={styles["themeToggle"]}
      onClick={toggleTheme}
      title={`Current theme: ${theme}. Click to change`}
      aria-label={`Current theme: ${theme}. Click to change`}
    >
      <span className={styles["themeIcon"]}>
        <Icon name={iconMap[theme] as 'lightbulb' | 'component' | 'settings'} size={16} />
      </span>
      <span className={styles["themeLabel"]}>{theme}</span>
    </button>
  );
};

export default ThemeToggle;
