import React, { InputHTMLAttributes } from 'react';
import { Icon, IconName } from '../Icon/Icon';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: IconName;
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon, error, label, className, id, ...props }, ref) => {
    const inputId = id || props.name;
    
    return (
      <div className={`${styles.inputWrapper} ${className || ''}`}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}
        <div className={styles.inputContainer}>
          {icon && (
            <Icon 
              name={icon} 
              className={styles.icon} 
              size={16}
              ariaLabel=""
            />
          )}
          <input 
            ref={ref}
            id={inputId}
            className={`${styles.input} ${icon ? styles.withIcon : ''} ${error ? styles.hasError : ''}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
        </div>
        {error && (
          <span id={`${inputId}-error`} className={styles.errorText} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
