/**
 * Profile Persistence Utility
 * Saves and loads profiling sessions to/from IndexedDB so data survives
 * DevTools panel reloads and browser restarts.
 *
 * Uses in-memory buffering during recording and flushes in batches of 50
 * to reduce I/O overhead during high-frequency commit capture.
 */

import type { CommitData } from '@/content/types';

const DB_NAME = 'ReactPerfProfiler';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const LATEST_KEY = 'latest';

/** Number of commits to buffer before flushing to IndexedDB */
const FLUSH_BATCH_SIZE = 50;

// ============================================================================
// In-memory commit buffer for batched writes
// ============================================================================

let writeBuffer: CommitData[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 2000; // Flush every 2s during active recording

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
// Buffered write API (use during recording)
// ============================================================================

/**
 * Buffer a commit for later batched write to IndexedDB.
 * Automatically flushes when the buffer reaches FLUSH_BATCH_SIZE or after
 * FLUSH_INTERVAL_MS of inactivity.
 */
export function bufferCommit(commit: CommitData): void {
  writeBuffer.push(commit);

  // Flush immediately if buffer is full
  if (writeBuffer.length >= FLUSH_BATCH_SIZE) {
    void flushBuffer();
    return;
  }

  // Schedule a delayed flush for partial buffers
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      void flushBuffer();
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Flush the in-memory buffer to IndexedDB.
 * Called automatically when buffer is full or on timer, but can also
 * be called manually (e.g., when recording stops).
 */
export async function flushBuffer(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (writeBuffer.length === 0) return;

  // Swap buffer atomically
  const batch = writeBuffer;
  writeBuffer = [];

  try {
    await appendToSession(batch);
  } catch {
    // Re-insert at front of buffer on failure
    writeBuffer = [...batch, ...writeBuffer];
  }
}

/**
 * Clear the write buffer (e.g., on data clear).
 */
export function clearBuffer(): void {
  writeBuffer = [];
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

// ============================================================================
// Internal append
// ============================================================================

async function appendToSession(newCommits: CommitData[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Load existing session
    const existing = await idbRequest<PersistedSession | undefined>(store.get(LATEST_KEY));

    const session: PersistedSession = {
      key: LATEST_KEY,
      commits: [...(existing?.commits ?? []), ...newCommits],
      savedAt: Date.now(),
      commitCount: (existing?.commitCount ?? 0) + newCommits.length,
    };

    await idbRequest(store.put(session));
  } catch {
    // Non-fatal — IndexedDB may be blocked in some extension sandbox environments
  }
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
 * Flushes any pending buffer first, then writes the full dataset.
 */
export async function saveSession(commits: CommitData[]): Promise<void> {
  if (commits.length === 0) return;

  // Flush any buffered commits first
  await flushBuffer();

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
    // Non-fatal
  }
}

/**
 * Load the last saved session from IndexedDB.
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
 * Clear the persisted session.
 */
export async function clearPersistedSession(): Promise<void> {
  clearBuffer();
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
