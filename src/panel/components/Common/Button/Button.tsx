import React, { ButtonHTMLAttributes } from 'react';
import { Icon, IconName } from '../Icon/Icon';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'secondary', 
    size = 'md', 
    icon, 
    iconPosition = 'left',
    loading,
    children,
    className,
    disabled,
    ...props 
  }, ref) => {
    const classes = [
      styles.button,
      styles[variant],
      styles[size],
      className || ''
    ].join(' ');
    
    return (
      <button 
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <span className={styles.spinner} aria-hidden="true" />}
        {!loading && icon && iconPosition === 'left' && (
          <Icon name={icon} className={styles.iconLeft} />
        )}
        <span className={styles.content}>{children}</span>
        {!loading && icon && iconPosition === 'right' && (
          <Icon name={icon} className={styles.iconRight} />
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
