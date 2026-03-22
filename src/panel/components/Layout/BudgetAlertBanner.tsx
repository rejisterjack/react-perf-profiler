/**
 * BudgetAlertBanner
 * Shows dismissible in-panel alerts when live profiling data crosses
 * configured performance budget thresholds.
 */

import type React from 'react';
import { useBudgetAlerts } from '@/panel/hooks/useBudgetAlerts';
import { Icon } from '../Common/Icon/Icon';
import styles from './BudgetAlertBanner.module.css';

export const BudgetAlertBanner: React.FC = () => {
  const { alerts, dismissedIds, dismiss, dismissAll } = useBudgetAlerts();

  const visible = alerts.filter((a) => !dismissedIds.has(a.id));

  if (visible.length === 0) return null;

  return (
    <div
      className={styles['banner']}
      role="alert"
      aria-label={`${visible.length} performance budget violation${visible.length > 1 ? 's' : ''}`}
    >
      <div className={styles['alertList']}>
        {visible.map((alert) => (
          <div
            key={alert.id}
            className={`${styles['alert']} ${styles[alert.severity]}`}
          >
            <Icon
              name={alert.severity === 'error' ? 'error' : 'warning'}
              size={14}
              aria-hidden="true"
            />
            <span className={styles['metric']}>{alert.metric}</span>
            <span className={styles['message']}>{alert.message}</span>
            <button
              className={styles['dismissBtn']}
              onClick={() => dismiss(alert.id)}
              aria-label={`Dismiss ${alert.metric} alert`}
              title="Dismiss"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
      </div>

      {visible.length > 1 && (
        <button
          className={styles['dismissAll']}
          onClick={dismissAll}
          aria-label="Dismiss all budget alerts"
        >
          Dismiss all
        </button>
      )}
    </div>
  );
};

export default BudgetAlertBanner;
