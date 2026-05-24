/**
 * Bridge store — tracks React detection and bridge initialization state
 */

import { create } from 'zustand';

type BridgeState = 'pending' | 'success' | 'failed';

interface BridgeStore {
  state: BridgeState;
  error: { type: string; message: string; recoverable: boolean } | null;
  reactDetected: boolean | null;
  devtoolsDetected: boolean | null;
  reactVersion: string | null;
  retryCount: number;

  setBridgeState: (state: BridgeState) => void;
  setBridgeError: (error: BridgeStore['error']) => void;
  setReactDetected: (detected: boolean | null) => void;
  setDevtoolsDetected: (detected: boolean | null) => void;
  setReactVersion: (version: string | null) => void;
  setRetryCount: (count: number) => void;
  reset: () => void;
}

const initialState = {
  state: 'pending' as BridgeState,
  error: null,
  reactDetected: null,
  devtoolsDetected: null,
  reactVersion: null,
  retryCount: 0,
};

export const useBridgeStore = create<BridgeStore>((set) => ({
  ...initialState,

  setBridgeState: (state) => set({ state }),
  setBridgeError: (error) => set({ error }),
  setReactDetected: (reactDetected) => set({ reactDetected }),
  setDevtoolsDetected: (devtoolsDetected) => set({ devtoolsDetected }),
  setReactVersion: (reactVersion) => set({ reactVersion }),
  setRetryCount: (retryCount) => set({ retryCount }),
  reset: () => set(initialState),
}));
