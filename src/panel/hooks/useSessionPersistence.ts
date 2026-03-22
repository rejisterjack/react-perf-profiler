/**
 * useSessionPersistence
 * Automatically saves the profiling session to IndexedDB when recording stops
 * and offers restoring the last session on panel load.
 */

import { useEffect, useRef, useState } from 'react';
import { useProfilerStore } from '@/panel/stores/profilerStore';
import {
  saveSession,
  loadLastSession,
  clearPersistedSession,
  type PersistedSession,
} from '@/panel/utils/profilePersistence';

export interface SessionRestoreInfo {
  /** Whether there is a persisted session available to restore */
  hasPersistedSession: boolean;
  /** Metadata about the persisted session */
  persistedSession: PersistedSession | null;
  /** Call to restore the persisted session into the store */
  restoreSession: () => void;
  /** Call to discard the persisted session without restoring */
  discardSession: () => void;
}

/**
 * Auto-saves commits to IndexedDB whenever recording stops.
 * On mount, checks for a persisted session and surfaces it to the caller
 * so the user can choose to restore or discard it.
 */
export function useSessionPersistence(): SessionRestoreInfo {
  const [persistedSession, setPersistedSession] = useState<PersistedSession | null>(null);
  const wasRecordingRef = useRef(false);

  const isRecording = useProfilerStore((s) => s.isRecording);
  const commits = useProfilerStore((s) => s.commits);
  const addCommits = useProfilerStore((s) => s.addCommits);

  // On mount: check for a previous session
  useEffect(() => {
    loadLastSession().then((session) => {
      if (session && session.commitCount > 0) {
        setPersistedSession(session);
      }
    });
  }, []);

  // Auto-save when recording transitions from active → stopped
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording && commits.length > 0) {
      saveSession(commits);
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, commits]);

  const restoreSession = () => {
    if (persistedSession) {
      addCommits(persistedSession.commits);
      setPersistedSession(null);
    }
  };

  const discardSession = () => {
    clearPersistedSession();
    setPersistedSession(null);
  };

  return {
    hasPersistedSession: persistedSession !== null,
    persistedSession,
    restoreSession,
    discardSession,
  };
}
