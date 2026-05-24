/**
 * Hook that auto-saves and restores profiling sessions.
 *
 * - On mount: checks chrome.storage for the last session and offers restore via callback.
 * - While recording: auto-saves every 5 seconds.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useProfilerStore } from '@/src/panel/stores/profilerStore';
import {
  saveProfile,
  loadProfile,
  type ProfileData,
} from '@/src/panel/utils/profilePersistence';
import { TIMING } from '@/src/shared/constants';

const AUTO_SAVE_KEY = 'react-perf-profiler:auto-save';

interface UseSessionPersistenceOptions {
  /** Called when a saved session is found on mount. Receives the saved data. */
  onSessionFound?: (data: ProfileData) => void;
}

interface UseSessionPersistenceReturn {
  /** Manually save the current session under a given name. */
  saveSession: (name: string) => void;
  /** Restore a previously saved session by name. */
  restoreSession: (name: string) => Promise<ProfileData | null>;
  /** Whether a saved session was detected on mount. */
  hasSavedSession: boolean;
  /** The loaded session data, if any. */
  savedSessionData: ProfileData | null;
  /** Dismiss the restore prompt. */
  dismissSavedSession: () => void;
}

export function useSessionPersistence(
  options: UseSessionPersistenceOptions = {},
): UseSessionPersistenceReturn {
  const { onSessionFound } = options;

  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState<ProfileData | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable store access via refs to avoid re-subscribing
  const storeRef = useRef(useProfilerStore.getState);
  storeRef.current = useProfilerStore.getState;

  // ─── Restore on mount ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function checkForSession() {
      const data = await loadProfile(AUTO_SAVE_KEY);
      if (cancelled) return;

      if (data && data.commits.length > 0) {
        setSavedSessionData(data);
        setHasSavedSession(true);
        onSessionFound?.(data);
      }
    }

    checkForSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps — run once on mount
  }, []);

  // ─── Auto-save while recording ─────────────────────────────────

  useEffect(() => {
    const unsubscribe = useProfilerStore.subscribe((state, prevState) => {
      const startedRecording = !prevState.isRecording && state.isRecording;
      const stoppedRecording = prevState.isRecording && !state.isRecording;

      if (startedRecording) {
        // Start auto-save interval
        intervalRef.current = setInterval(() => {
          const { commits } = storeRef.current();
          const commitArray = commits.toArray();
          if (commitArray.length > 0) {
            saveProfile(AUTO_SAVE_KEY, {
              commits: commitArray,
              timestamp: Date.now(),
            });
          }
        }, TIMING.AUTO_SAVE_INTERVAL_MS);
      }

      if (stoppedRecording) {
        // Stop auto-save and do a final save
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        const { commits } = storeRef.current();
        const commitArray = commits.toArray();
        if (commitArray.length > 0) {
          saveProfile(AUTO_SAVE_KEY, {
            commits: commitArray,
            timestamp: Date.now(),
          });
        }
      }
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // ─── Manual actions ────────────────────────────────────────────

  const saveSession = useCallback((name: string) => {
    const { commits } = storeRef.current();
    const commitArray = commits.toArray();
    saveProfile(name, {
      commits: commitArray,
      timestamp: Date.now(),
    });
  }, []);

  const restoreSession = useCallback(async (name: string): Promise<ProfileData | null> => {
    const data = await loadProfile(name);
    if (data) {
      setSavedSessionData(data);
      setHasSavedSession(true);
    }
    return data;
  }, []);

  const dismissSavedSession = useCallback(() => {
    setHasSavedSession(false);
  }, []);

  return {
    saveSession,
    restoreSession,
    hasSavedSession,
    savedSessionData,
    dismissSavedSession,
  };
}
