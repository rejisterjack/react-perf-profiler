/**
 * Notification Container Component
 * Displays toast notifications
 * @module panel/components/Notifications
 */

import type React from 'react';
import { useEffect } from 'react';
import { useNotificationStore, type Notification, type NotificationType } from '@/panel/stores/notificationStore';
import { Icon } from '../Common/Icon/Icon';
import styles from './NotificationContainer.module.css';

/**
 * Get icon name for notification type
 */
function getIconName(type: NotificationType): React.ComponentProps<typeof Icon>['name'] {
  switch (type) {
    case 'success':
      return 'check';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'info';
  }
}

/**
 * Individual Notification Toast
 */
const NotificationToast: React.FC<{ notification: Notification }> = ({ notification }) => {
  const dismiss = useNotificationStore((state) => state.dismiss);
  const markAsRead = useNotificationStore((state) => state.markAsRead);

  useEffect(() => {
    // Mark as read when shown
    markAsRead(notification.id);
  }, [notification.id, markAsRead]);

  return (
    <div
      className={`${styles['notification']} ${styles[notification.type]}`}
      role="alert"
      aria-live="polite"
    >
      <div className={styles['icon']}>
        <Icon name={getIconName(notification.type)} size={20} />
      </div>
      <div className={styles['content']}>
        <div className={styles['title']}>{notification.title}</div>
        <div className={styles['message']}>{notification.message}</div>
      </div>
      <button
        type="button"
        className={styles['close']}
        onClick={() => dismiss(notification.id)}
        aria-label="Dismiss notification"
      >
        <Icon name="close" size={14} />
      </button>
      {notification.timeout > 0 && (
        <div
          className={styles['progress']}
          style={{ animationDuration: `${notification.timeout}ms` }}
        />
      )}
    </div>
  );
};

/**
 * Notification Container
 * Renders all active notifications
 */
export const NotificationContainer: React.FC = () => {
  const notifications = useNotificationStore((state) => state.notifications);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={styles['container']}>
      {notifications.map((notification) => (
        <NotificationToast key={notification.id} notification={notification} />
      ))}
    </div>
  );
};

export default NotificationContainer;
