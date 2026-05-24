/**
 * Export / import hook that wires profilePersistence utilities to the profiler store.
 *
 * - exportProfile: creates a downloadable JSON file with all commits and metadata.
 * - importProfile: opens a file dialog, parses the JSON, and loads commits into the store.
 */

import { useCallback } from 'react';
import { useProfilerStore } from '@/src/panel/stores/profilerStore';
import {
  exportToFile,
  importFromFile,
  type ProfileData,
} from '@/src/panel/utils/profilePersistence';
import { exportAsCPUProfile } from '@/src/panel/utils/cpuProfileExport';

interface UseExportReturn {
  /** Export all current commits as a downloadable JSON file. */
  exportProfile: (filename?: string) => void;
  /**
   * Open a file picker, parse the selected JSON, and load commits into the store.
   * Returns the imported data or null if cancelled / invalid.
   */
  importProfile: () => Promise<ProfileData | null>;
  /** Export commits as a Chrome DevTools CPU Profile (.cpuprofile) file. */
  exportAsCPUProfile: (filename?: string) => void;
}

export function useExport(): UseExportReturn {
  const addCommit = useProfilerStore((s) => s.addCommit);
  const clearCommits = useProfilerStore((s) => s.clearCommits);

  const exportProfile = useCallback((filename?: string) => {
    const { commits } = useProfilerStore.getState();
    const commitArray = commits.toArray();

    const timestamp = Date.now();
    const defaultName = `profile-${new Date(timestamp).toISOString().replace(/[:.]/g, '-')}.json`;

    exportToFile(
      {
        commits: commitArray,
        timestamp,
      },
      filename ?? defaultName,
    );
  }, []);

  const importProfile = useCallback(async (): Promise<ProfileData | null> => {
    const data = await importFromFile();
    if (!data) return null;

    // Clear existing data before loading imported commits
    clearCommits();

    // Push each commit into the store's circular buffer
    for (const commit of data.commits) {
      addCommit(commit);
    }

    return data;
  }, [addCommit, clearCommits]);

  const exportCPUProfile = useCallback((filename?: string) => {
    const { commits } = useProfilerStore.getState();
    const commitArray = commits.toArray();
    if (commitArray.length === 0) return;
    exportAsCPUProfile(commitArray, filename);
  }, []);

  return { exportProfile, importProfile, exportAsCPUProfile: exportCPUProfile };
}
