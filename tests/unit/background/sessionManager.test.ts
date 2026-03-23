/**
 * Tests for Background Session Manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '@/background/sessionManager';
import { ConnectionManager } from '@/background/connectionManager';
import type { TabConnection, SessionExport } from '@/background/types';
import type { CommitData } from '@/shared/types';
import { DEFAULT_PROFILER_CONFIG } from '@/shared/constants';

// Mock the connection manager
const createMockConnectionManager = () => {
  const connections = new Map<number, TabConnection>();

  return {
    getConnection: vi.fn((tabId: number) => connections.get(tabId) || null),
    getOrCreateConnection: vi.fn((tabId: number) => {
      if (!connections.has(tabId)) {
        connections.set(tabId, {
          tabId,
          contentPort: null,
          devtoolsPort: null,
          popupPort: null,
          isProfiling: false,
          sessionStartTime: null,
          commits: [],
          config: { ...DEFAULT_PROFILER_CONFIG },
          sessionStatus: 'idle',
          commitCount: 0,
        });
      }
      return connections.get(tabId)!;
    }),
    _connections: connections,
    _clear: () => connections.clear(),
  };
};

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockConnectionManager: ReturnType<typeof createMockConnectionManager>;
  const mockLogger = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Console;

  beforeEach(() => {
    mockConnectionManager = createMockConnectionManager();
    sessionManager = new SessionManager(
      mockConnectionManager as unknown as ConnectionManager,
      mockLogger,
      false
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockConnectionManager._clear();
  });

  describe('startSession', () => {
    it('should start a new session', () => {
      const result = sessionManager.startSession(1);

      expect(result.success).toBe(true);
      expect(mockConnectionManager.getOrCreateConnection).toHaveBeenCalledWith(1);

      const connection = mockConnectionManager._connections.get(1);
      expect(connection?.isProfiling).toBe(true);
      expect(connection?.sessionStatus).toBe('profiling');
      expect(connection?.sessionStartTime).toBeDefined();
    });

    it('should restart existing session', async () => {
      // Start first session
      sessionManager.startSession(1);
      const firstStartTime = mockConnectionManager._connections.get(1)?.sessionStartTime;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Start again - should restart
      const result = sessionManager.startSession(1);

      expect(result.success).toBe(true);
      const connection = mockConnectionManager._connections.get(1);
      expect(connection?.commits).toHaveLength(0);
      expect(connection?.sessionStartTime).not.toBe(firstStartTime);
    });

    it('should return error on exception', () => {
      mockConnectionManager.getOrCreateConnection.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const result = sessionManager.startSession(1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('stopSession', () => {
    it('should stop an active session and return commits', () => {
      // Start and add some commits
      sessionManager.startSession(1);
      const mockCommit: CommitData = {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 16,
        fibers: [],
      };
      sessionManager.addCommit(1, mockCommit);

      const commits = sessionManager.stopSession(1);

      expect(commits).toHaveLength(1);
      expect(commits[0].id).toBe('commit-1');

      const connection = mockConnectionManager._connections.get(1);
      expect(connection?.isProfiling).toBe(false);
      expect(connection?.sessionStatus).toBe('idle');
    });

    it('should return empty array when no connection', () => {
      const commits = sessionManager.stopSession(999);
      expect(commits).toEqual([]);
    });
  });

  describe('addCommit', () => {
    it('should add commit to session', () => {
      sessionManager.startSession(1);

      const mockCommit: CommitData = {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 16,
        fibers: [],
      };

      const result = sessionManager.addCommit(1, mockCommit);

      expect(result.success).toBe(true);
      const connection = mockConnectionManager._connections.get(1);
      expect(connection?.commits).toHaveLength(1);
      expect(connection?.commitCount).toBe(1);
    });

    it('should return error when no connection', () => {
      const mockCommit: CommitData = {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 16,
        fibers: [],
      };

      const result = sessionManager.addCommit(999, mockCommit);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_NOT_FOUND');
    });

    it('should respect max commits limit', () => {
      sessionManager.startSession(1);
      const connection = mockConnectionManager._connections.get(1);
      connection!.config.maxCommits = 3;

      // Add 5 commits
      for (let i = 0; i < 5; i++) {
        sessionManager.addCommit(1, {
          id: `commit-${i}`,
          timestamp: Date.now(),
          duration: 10,
          fibers: [],
        });
      }

      // Should only have 3 most recent commits
      expect(connection?.commits).toHaveLength(3);
      expect(connection?.commits[0].id).toBe('commit-2');
      expect(connection?.commits[2].id).toBe('commit-4');
    });
  });

  describe('clearSession', () => {
    it('should clear all session data', () => {
      sessionManager.startSession(1);
      sessionManager.addCommit(1, {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 16,
        fibers: [],
      });

      sessionManager.clearSession(1);

      const connection = mockConnectionManager._connections.get(1);
      expect(connection?.commits).toHaveLength(0);
      expect(connection?.commitCount).toBe(0);
      expect(connection?.isProfiling).toBe(false);
      expect(connection?.sessionStatus).toBe('idle');
    });

    it('should handle missing connection gracefully', () => {
      expect(() => sessionManager.clearSession(999)).not.toThrow();
    });
  });

  describe('getSessionData', () => {
    it('should return copy of session data', () => {
      sessionManager.startSession(1);
      sessionManager.addCommit(1, {
        id: 'commit-1',
        timestamp: Date.now(),
        duration: 16,
        fibers: [],
      });

      const data = sessionManager.getSessionData(1);

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('commit-1');

      // Should be a copy - modifying shouldn't affect original
      data.push({
        id: 'tampered',
        timestamp: Date.now(),
        duration: 0,
        fibers: [],
      });

      const connection = mockConnectionManager._connections.get(1);
      expect(connection?.commits).toHaveLength(1);
    });

    it('should return empty array when no connection', () => {
      const data = sessionManager.getSessionData(999);
      expect(data).toEqual([]);
    });
  });

  describe('getSessionMetadata', () => {
    it('should return session metadata', () => {
      sessionManager.startSession(1);

      const metadata = sessionManager.getSessionMetadata(1);

      expect(metadata).not.toBeNull();
      expect(metadata?.isProfiling).toBe(true);
      expect(metadata?.sessionStatus).toBe('profiling');
      expect(metadata?.commitCount).toBe(0);
      expect(metadata?.sessionStartTime).toBeDefined();
    });

    it('should return null when no connection', () => {
      const metadata = sessionManager.getSessionMetadata(999);
      expect(metadata).toBeNull();
    });
  });

  describe('exportSession', () => {
    it('should export session as JSON', () => {
      // Mock chrome.tabs if available
      const originalChrome = (globalThis as Record<string, unknown>).chrome;
      (globalThis as Record<string, unknown>).chrome = {
        tabs: {
          get: vi.fn((_tabId, callback: (tab: { url?: string; title?: string }) => void) => {
            callback({ url: 'https://example.com', title: 'Test' });
          }),
        },
        runtime: { lastError: null },
      };

      try {
        sessionManager.startSession(1);
        sessionManager.addCommit(1, {
          id: 'commit-1',
          timestamp: 1000,
          duration: 16,
          fibers: [],
        });

        const json = sessionManager.exportSession(1);
        const exported = JSON.parse(json) as SessionExport;

        expect(exported.version).toBeDefined();
        expect(exported.tabId).toBe(1);
        expect(exported.commits).toHaveLength(1);
        expect(exported.summary).toBeDefined();
      } finally {
        // Restore original chrome
        (globalThis as Record<string, unknown>).chrome = originalChrome;
      }
    });

    it('should throw when no connection', () => {
      expect(() => sessionManager.exportSession(999)).toThrow('No connection found');
    });
  });

  describe('importSession', () => {
    it('should import session from JSON', () => {
      const exportData: SessionExport = {
        version: '1.0.0',
        exportTime: Date.now(),
        tabId: 2,
        url: 'https://example.com',
        title: 'Test Page',
        startTime: Date.now() - 10000,
        endTime: Date.now(),
        config: DEFAULT_PROFILER_CONFIG,
        commits: [
          {
            id: 'imported-1',
            timestamp: Date.now() - 5000,
            duration: 20,
            fibers: [],
          },
        ],
        summary: {
          totalCommits: 1,
          totalNodes: 10,
          averageCommitDuration: 20,
          maxCommitDuration: 20,
          minCommitDuration: 20,
          uniqueComponents: 5,
          topRenderCountComponents: [],
        },
      };

      const result = sessionManager.importSession(1, JSON.stringify(exportData));

      expect(result.success).toBe(true);
      const connection = mockConnectionManager._connections.get(1);
      expect(connection?.commits).toHaveLength(1);
      expect(connection?.commits[0].id).toBe('imported-1');
    });

    it('should return error for invalid JSON', () => {
      const result = sessionManager.importSession(1, 'not valid json');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IMPORT_FAILED');
    });

    it('should return error for missing version', () => {
      const invalidData = { commits: [] };
      const result = sessionManager.importSession(1, JSON.stringify(invalidData));

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IMPORT_FAILED');
    });
  });

  describe('getSessionStats', () => {
    it('should calculate session statistics', () => {
      sessionManager.startSession(1);
      sessionManager.addCommit(1, {
        id: 'c1',
        timestamp: Date.now(),
        duration: 20,
        fibers: [],
        nodes: [{ id: 'n1' }, { id: 'n2' }],
      } as CommitData);
      sessionManager.addCommit(1, {
        id: 'c2',
        timestamp: Date.now(),
        duration: 30,
        fibers: [],
        nodes: [{ id: 'n3' }],
      } as CommitData);

      const stats = sessionManager.getSessionStats(1);

      expect(stats).not.toBeNull();
      expect(stats?.totalCommits).toBe(2);
      expect(stats?.totalNodes).toBe(3);
      expect(stats?.averageCommitDuration).toBe(25);
      expect(stats?.sessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should return null when no connection', () => {
      const stats = sessionManager.getSessionStats(999);
      expect(stats).toBeNull();
    });

    it('should return null when no commits', () => {
      sessionManager.startSession(1);
      const stats = sessionManager.getSessionStats(1);
      expect(stats).toBeNull();
    });
  });
});
