import type React from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  variant?: 'default' | 'error' | 'warning' | 'info';
  disabled?: boolean;
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onChange,
  variant = 'default',
  disabled = false,
  id,
}) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <label
      className={`${styles["checkbox"]} ${styles[variant]} ${disabled ? styles["disabled"] : ''}`}
    >
      <input
        type="checkbox"
        id={checkboxId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={styles["input"]}
      />
      <span className={styles["checkmark"]} aria-hidden="true">
        <svg viewBox="0 0 24 24" className={styles["checkIcon"]}>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </span>
      <span className={styles["label"]}>{label}</span>
    </label>
  );
};
