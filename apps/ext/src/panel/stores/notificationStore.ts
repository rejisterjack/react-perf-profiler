/**
 * Notification store — in-app toast notifications
 */

import { create } from 'zustand';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
}

interface NotificationStore {
  notifications: Notification[];
  maxNotifications: number;

  show: (type: Notification['type'], title: string, message: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

let notifCounter = 0;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  maxNotifications: 10,

  show: (type, title, message) => {
    const id = `notif-${Date.now()}-${++notifCounter}`;
    const notification: Notification = { id, type, title, message, timestamp: Date.now() };
    set((state) => {
      const notifications = [notification, ...state.notifications].slice(0, state.maxNotifications);
      return { notifications };
    });
    // Auto-dismiss after 5s
    setTimeout(() => get().dismiss(id), 5000);
  },

  dismiss: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),

  clearAll: () => set({ notifications: [] }),
}));
