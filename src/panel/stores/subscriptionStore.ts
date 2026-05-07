/**
 * Usage tracking store — tracks anonymous usage stats for the free product.
 * All features are available to all users (free forever, no tiers).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UsageState {
  aiSuggestionsToday: number;
  aiSuggestionsResetAt: number;
  profilesStored: number;
}

interface UsageActions {
  incrementAiUsage: () => void;
  incrementProfiles: () => void;
  reset: () => void;
}

type UsageStore = UsageState & UsageActions;

const DEFAULT_STATE: UsageState = {
  aiSuggestionsToday: 0,
  aiSuggestionsResetAt: Date.now(),
  profilesStored: 0,
};

export const useSubscriptionStore = create<UsageStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      incrementAiUsage: () => {
        const state = get();
        if (Date.now() - state.aiSuggestionsResetAt > 24 * 60 * 60 * 1000) {
          set({ aiSuggestionsToday: 1, aiSuggestionsResetAt: Date.now() });
          return;
        }
        set({ aiSuggestionsToday: state.aiSuggestionsToday + 1 });
      },

      incrementProfiles: () => {
        const { profilesStored } = get();
        set({ profilesStored: (profilesStored ?? 0) + 1 });
      },

      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'subscription-store',
      partialize: () => ({}),
    }
  )
);
