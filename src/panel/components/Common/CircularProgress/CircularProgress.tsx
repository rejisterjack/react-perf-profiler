import type React from 'react';
import styles from './CircularProgress.module.css';

export type CircularProgressColor = 'default' | 'primary' | 'success' | 'warning' | 'error';

export interface CircularProgressProps {
  /** Progress value (0-100) */
  value: number;
  /** Size of the progress circle in pixels */
  size?: number;
  /** Color variant */
  color?: CircularProgressColor;
  /** Stroke width of the circle */
  strokeWidth?: number;
  /** Additional CSS class */
  className?: string;
  /** Whether to show the percentage text */
  showLabel?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 64,
  color = 'default',
  strokeWidth = 4,
  className = '',
  showLabel = true,
}) => {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));

  // Calculate circle geometry
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  // Center coordinates
  const center = size / 2;

  const classNames = [styles["container"], styles[color], className].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles["svg"]} aria-hidden="true">
        <title>Progress: {clampedValue}%</title>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={styles["background"]}
        />

        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={styles["progress"]}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
          }}
        />
      </svg>

      {showLabel && <span className={styles["label"]}>{Math.round(clampedValue)}</span>}
    </div>
  );
};

export default CircularProgress;
