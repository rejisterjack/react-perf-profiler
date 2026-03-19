import type React from 'react';
import styles from './Badge.module.css';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'critical';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  /** Visual variant of the badge */
  variant?: BadgeVariant;
  /** Size of the badge */
  size?: BadgeSize;
  /** Additional CSS class */
  className?: string;
  /** Badge content */
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  className = '',
  children,
}) => {
  const classNames = [styles["badge"], styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ');

  return <span className={classNames}>{children}</span>;
};

export default Badge;
