/**
 * Profile Persistence Utility
 * Saves and loads profiling sessions to/from IndexedDB so data survives
 * DevTools panel reloads and browser restarts.
 */

import type { CommitData } from '@/content/types';

const DB_NAME = 'ReactPerfProfiler';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const LATEST_KEY = 'latest';

// ============================================================================
// DB initialisation
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Persisted session shape stored in IndexedDB
 */
export interface PersistedSession {
  key: string;
  commits: CommitData[];
  savedAt: number;
  commitCount: number;
}

/**
 * Save the current session's commits to IndexedDB under the "latest" key.
 * Silently no-ops if IndexedDB is unavailable (e.g. extensions with strict CSP).
 */
export async function saveSession(commits: CommitData[]): Promise<void> {
  if (commits.length === 0) return;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const session: PersistedSession = {
      key: LATEST_KEY,
      commits,
      savedAt: Date.now(),
      commitCount: commits.length,
    };

    await idbRequest(store.put(session));
  } catch {
    // Non-fatal — IndexedDB may be blocked in some extension sandbox environments
  }
}

/**
 * Load the last saved session from IndexedDB.
 * Returns null if nothing was saved or if IndexedDB is unavailable.
 */
export async function loadLastSession(): Promise<PersistedSession | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = await idbRequest<PersistedSession | undefined>(store.get(LATEST_KEY));
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Clear the persisted session (e.g. when the user clears data).
 */
export async function clearPersistedSession(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    await idbRequest(store.delete(LATEST_KEY));
  } catch {
    // Non-fatal
  }
}

// ============================================================================
// Helper
// ============================================================================

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
