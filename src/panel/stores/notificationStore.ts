/**
 * Notification Store
 * Manages toast notifications for important events
 * @module panel/stores/notificationStore
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { t } from '@/shared/i18n';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  /** Unique notification ID */
  id: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Auto-dismiss timeout in ms (0 = no auto-dismiss) */
  timeout: number;
  /** Creation timestamp */
  timestamp: number;
  /** Whether notification has been read */
  read: boolean;
}

interface NotificationState {
  /** Active notifications queue */
  notifications: Notification[];
  /** Maximum number of notifications to show at once */
  maxNotifications: number;
  /** Whether to enable sound effects */
  enableSound: boolean;
  /** Whether notifications are enabled */
  enabled: boolean;
  /** Notification titles the user has permanently dismissed */
  mutedTitles: string[];
  /** Recent notification history (last 50) */
  history: Notification[];
}

interface NotificationActions {
  /** Show a new notification */
  show: (options: {
    type: NotificationType;
    title: string;
    message: string;
    timeout?: number;
  }) => string;
  /** Dismiss a notification by ID */
  dismiss: (id: string) => void;
  /** Mark notification as read */
  markAsRead: (id: string) => void;
  /** Clear all notifications */
  clearAll: () => void;
  /** Mute a notification title so it never shows again */
  muteTitle: (title: string) => void;
  /** Unmute a notification title */
  unmuteTitle: (title: string) => void;
  /** Clear notification history */
  clearHistory: () => void;
  /** Update settings */
  updateSettings: (settings: Partial<Pick<NotificationState, 'maxNotifications' | 'enableSound' | 'enabled'>>) => void;
}

type NotificationStore = NotificationState & NotificationActions;

/** Default auto-dismiss timeouts by type */
const DEFAULT_TIMEOUTS: Record<NotificationType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

/** Sound effect frequencies (for future implementation) */
const SOUND_FREQUENCIES: Record<NotificationType, number> = {
  success: 523.25, // C5
  error: 261.63,   // C4
  warning: 329.63, // E4
  info: 440.00,    // A4
};

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    immer((set, get) => ({
      notifications: [],
      maxNotifications: 5,
      enableSound: false,
      enabled: true,
      mutedTitles: [],
      history: [],

      show: (options) => {
        const { enabled, maxNotifications, enableSound, mutedTitles } = get();

        if (!enabled) return '';
        if (mutedTitles.includes(options.title)) return '';

        const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const timeout = options.timeout ?? DEFAULT_TIMEOUTS[options.type];

        const notification: Notification = {
          id,
          type: options.type,
          title: options.title,
          message: options.message,
          timeout,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => {
          // Add to beginning, remove oldest if over limit
          state.notifications.unshift(notification);
          if (state.notifications.length > maxNotifications) {
            state.notifications = state.notifications.slice(0, maxNotifications);
          }
          // Add to history (keep last 50)
          state.history.unshift({ ...notification });
          if (state.history.length > 50) {
            state.history = state.history.slice(0, 50);
          }
        });

        // Play sound if enabled (placeholder for future implementation)
        if (enableSound && typeof window !== 'undefined') {
          try {
            const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = SOUND_FREQUENCIES[options.type];
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
          } catch {
            // Ignore audio errors
          }
        }

        // Auto-dismiss
        if (timeout > 0) {
          setTimeout(() => {
            get().dismiss(id);
          }, timeout);
        }

        return id;
      },

      dismiss: (id) => {
        set((state) => {
          state.notifications = state.notifications.filter((n) => n.id !== id);
        });
      },

      markAsRead: (id) => {
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (notification) {
            notification.read = true;
          }
        });
      },

      clearAll: () => {
        set((state) => {
          state.notifications = [];
        });
      },

      muteTitle: (title) => {
        set((state) => {
          if (!state.mutedTitles.includes(title)) {
            state.mutedTitles.push(title);
          }
        });
      },

      unmuteTitle: (title) => {
        set((state) => {
          state.mutedTitles = state.mutedTitles.filter((t) => t !== title);
        });
      },

      clearHistory: () => {
        set((state) => {
          state.history = [];
        });
      },

      updateSettings: (settings) => {
        set((state) => {
          Object.assign(state, settings);
        });
      },
    })),
    {
      name: 'notification-store',
    }
  )
);

/** Helper functions for common notification types - exported for use outside React components */
export const notifications = {
  success: (title: string, message: string, timeout?: number) =>
    useNotificationStore.getState().show({ type: 'success', title, message, timeout }),
  
  error: (title: string, message: string, timeout?: number) =>
    useNotificationStore.getState().show({ type: 'error', title, message, timeout }),
  
  warning: (title: string, message: string, timeout?: number) =>
    useNotificationStore.getState().show({ type: 'warning', title, message, timeout }),
  
  info: (title: string, message: string, timeout?: number) =>
    useNotificationStore.getState().show({ type: 'info', title, message, timeout }),
  
  /** Budget exceeded notification */
  budgetExceeded: (metric: string, value: number, threshold: number) =>
    useNotificationStore.getState().show({
      type: 'warning',
      title: t('notification.budgetExceeded'),
      message: t('notification.budgetExceededMsg', { metric, value: value.toFixed(2), threshold: String(threshold) }),
      timeout: 5000,
    }),

  /** Analysis complete notification */
  analysisComplete: (score: number) =>
    useNotificationStore.getState().show({
      type: 'success',
      title: t('notification.analysisComplete'),
      message: t('notification.analysisCompleteMsg', { score: String(Math.round(score)) }),
      timeout: 3000,
    }),

  /** Export ready notification */
  exportReady: (filename: string) =>
    useNotificationStore.getState().show({
      type: 'success',
      title: t('notification.exportReady'),
      message: t('notification.exportReadyMsg', { filename }),
      timeout: 3000,
    }),

  /** Import success notification */
  importSuccess: (migrated?: boolean) =>
    useNotificationStore.getState().show({
      type: 'success',
      title: t('notification.importSuccess'),
      message: migrated ? t('notification.importMigratedMsg') : t('notification.importSuccessMsg'),
      timeout: 3000,
    }),

  /** Recording started notification */
  recordingStarted: () =>
    useNotificationStore.getState().show({
      type: 'info',
      title: t('recording.startedTitle'),
      message: t('recording.started'),
      timeout: 2000,
    }),

  /** Recording stopped notification */
  recordingStopped: (commitCount: number) =>
    useNotificationStore.getState().show({
      type: 'success',
      title: t('recording.stoppedTitle'),
      message: t('recording.stopped', { count: String(commitCount) }),
      timeout: 3000,
    }),
};

export default useNotificationStore;
