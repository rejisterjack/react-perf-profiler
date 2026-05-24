/**
 * Connection store — manages panel-to-background port connection
 */

import { create } from 'zustand';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface ConnectionStore {
  state: ConnectionState;
  error: string | null;
  retryCount: number;
  lastPing: number;

  connect: () => void;
  disconnect: () => void;
  setError: (error: string | null) => void;
  setRetryCount: (count: number) => void;
  ping: () => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  state: 'disconnected',
  error: null,
  retryCount: 0,
  lastPing: 0,

  connect: () => set({ state: 'connecting', error: null }),
  disconnect: () => set({ state: 'disconnected', error: null }),
  setError: (error) => set({ error }),
  setRetryCount: (retryCount) => set({ retryCount }),
  ping: () => set({ lastPing: Date.now() }),
}));
