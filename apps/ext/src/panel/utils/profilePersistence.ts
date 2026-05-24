/**
 * Profile persistence utilities — save, load, list, delete, export, import.
 * Uses chrome.storage.local for session data and URL.createObjectURL for file download.
 */

import { browser } from 'wxt/browser';
import type { CommitData } from '@/src/shared/types';
import { STORAGE_KEYS, DATA_FORMAT_VERSION } from '@/src/shared/constants';

/** Shape of a saved profile in chrome.storage.local */
export interface SavedProfile {
  version: number;
  name: string;
  commits: CommitData[];
  timestamp: number;
  savedAt: number;
}

/** Shape of the data accepted by save / export functions */
export interface ProfileData {
  commits: CommitData[];
  timestamp: number;
}

// ─── Storage helpers ───────────────────────────────────────────────

const PROFILE_PREFIX = 'react-perf-profiler:profile:';

function storageKey(name: string): string {
  return `${PROFILE_PREFIX}${name}`;
}

/**
 * Read a raw value from chrome.storage.local.
 * Gracefully returns null when the API is unavailable (e.g. in a normal browser).
 */
async function readStorage<T>(key: string): Promise<T | null> {
  try {
    const result = await browser.storage.local.get(key);
    return (result[key] as T) ?? null;
  } catch {
    return null;
  }
}

/**
 * Write a key/value pair to chrome.storage.local.
 * Silently no-ops when the API is unavailable.
 */
async function writeStorage(key: string, value: unknown): Promise<void> {
  try {
    await browser.storage.local.set({ [key]: value });
  } catch {
    // storage unavailable — ignore
  }
}

async function removeStorage(key: string): Promise<void> {
  try {
    await browser.storage.local.remove(key);
  } catch {
    // storage unavailable — ignore
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Save a profiling session to chrome.storage.local.
 */
export function saveProfile(name: string, data: ProfileData): void {
  const profile: SavedProfile = {
    version: DATA_FORMAT_VERSION,
    name,
    commits: data.commits,
    timestamp: data.timestamp,
    savedAt: Date.now(),
  };
  // fire-and-forget — callers that need confirmation can await writeStorage directly
  writeStorage(storageKey(name), profile);

  // Also keep a directory entry so listProfiles is fast
  (async () => {
    const index: string[] = (await readStorage<string[]>(STORAGE_KEYS.SESSION)) ?? [];
    if (!index.includes(name)) {
      index.push(name);
      await writeStorage(STORAGE_KEYS.SESSION, index);
    }
  })();
}

/**
 * Load a previously saved profiling session.
 * Returns null if not found or storage is unavailable.
 */
export async function loadProfile(name: string): Promise<ProfileData | null> {
  const profile = await readStorage<SavedProfile>(storageKey(name));
  if (!profile) return null;
  return { commits: profile.commits, timestamp: profile.timestamp };
}

/**
 * List all saved profile names.
 */
export async function listProfiles(): Promise<string[]> {
  const index = await readStorage<string[]>(STORAGE_KEYS.SESSION);
  return index ?? [];
}

/**
 * Delete a saved profile.
 */
export async function deleteProfile(name: string): Promise<void> {
  await removeStorage(storageKey(name));

  const index = await readStorage<string[]>(STORAGE_KEYS.SESSION);
  if (index) {
    const updated = index.filter((n) => n !== name);
    await writeStorage(STORAGE_KEYS.SESSION, updated);
  }
}

/**
 * Export profile data to a JSON file and trigger a browser download.
 */
export function exportToFile(data: ProfileData, filename: string): void {
  const payload: SavedProfile = {
    version: DATA_FORMAT_VERSION,
    name: filename.replace(/\.json$/i, ''),
    commits: data.commits,
    timestamp: data.timestamp,
    savedAt: Date.now(),
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  // cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  }, 100);
}

/**
 * Open a native file picker, read the selected JSON file, and return parsed data.
 * Returns null if the user cancels or the file is invalid.
 */
export function importFromFile(): Promise<ProfileData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);

      if (!file) {
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as SavedProfile;

        // Accept both the wrapper format and raw profile data
        if (parsed.commits && Array.isArray(parsed.commits)) {
          resolve({
            commits: parsed.commits,
            timestamp: parsed.timestamp ?? Date.now(),
          });
          return;
        }

        // Unexpected shape
        resolve(null);
      } catch {
        resolve(null);
      }
    };

    // User cancelled the dialog
    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };

    input.click();
  });
}
