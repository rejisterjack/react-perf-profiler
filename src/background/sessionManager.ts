/**
 * Session Manager
 * Manages profiling sessions, data storage, and export/import functionality
 * @module background/sessionManager
 */

import { DEFAULT_PROFILER_CONFIG } from '@/shared/constants';
import type { CommitData } from '@/shared/types';
import type { ConnectionManager } from './connectionManager';
import {
  LogLevel,
  BackgroundErrorCode,
  type SessionExport,
  type SessionSummary,
  type BackgroundResult,
} from './types';

/**
 * Manages profiling sessions for all tabs
 * Handles data collection, storage limits, and session lifecycle
 */
export class SessionManager {
  /** Connection manager instance */
  private connectionManager: ConnectionManager;

  /** Logger instance */
  private logger: Console;

  /** Whether debug logging is enabled */
  private enableDebugLog: boolean;

  /**
   * Creates a new SessionManager instance
   * @param connectionManager - Connection manager instance
   * @param logger - Optional custom logger
   * @param enableDebugLog - Whether to enable debug logging
   */
  constructor(
    connectionManager: ConnectionManager,
    logger: Console = console,
    enableDebugLog = false
  ) {
    this.connectionManager = connectionManager;
    this.logger = logger;
    this.enableDebugLog = enableDebugLog;
  }

  /**
   * Starts a new profiling session for a tab
   * @param tabId - Chrome tab ID
   * @returns Result indicating success or failure
   */
  startSession(tabId: number): BackgroundResult<void> {
    try {
      const connection = this.connectionManager.getOrCreateConnection(tabId);

      // Check if session is already active
      if (connection.isProfiling) {
        this.log(LogLevel.WARN, 'Session already active, restarting', { tabId });
        this.clearSession(tabId);
      }

      // Initialize new session
      connection.isProfiling = true;
      connection.sessionStartTime = Date.now();
      connection.commits = [];
      connection.commitCount = 0;
      connection.sessionStatus = 'profiling';

      this.log(LogLevel.INFO, 'Profiling session started', {
        tabId,
        startTime: connection.sessionStartTime,
      });

      return { success: true };
    } catch (error) {
      this.log(LogLevel.ERROR, 'Failed to start session', { tabId, error });
      return {
        success: false,
        error: {
          code: BackgroundErrorCode.UNKNOWN_ERROR,
          message: `Failed to start session: ${error instanceof Error ? error.message : String(error)}`,
          tabId,
          originalError: error,
        },
      };
    }
  }

  /**
   * Stops the profiling session for a tab
   * @param tabId - Chrome tab ID
   * @returns Array of collected commits
   */
  stopSession(tabId: number): CommitData[] {
    const connection = this.connectionManager.getConnection(tabId);
    if (!connection) {
      this.log(LogLevel.WARN, 'No connection found when stopping session', {
        tabId,
      });
      return [];
    }

    connection.isProfiling = false;
    connection.sessionStatus = 'idle';

    const sessionDuration = connection.sessionStartTime
      ? Date.now() - connection.sessionStartTime
      : 0;

    this.log(LogLevel.INFO, 'Profiling session stopped', {
      tabId,
      duration: sessionDuration,
      totalCommits: connection.commitCount,
    });

    return [...connection.commits];
  }

  /**
   * Adds a commit to the session
   * @param tabId - Chrome tab ID
   * @param commit - Commit data to add
   * @returns Result indicating success or failure
   */
  addCommit(tabId: number, commit: CommitData): BackgroundResult<void> {
    const connection = this.connectionManager.getConnection(tabId);
    if (!connection) {
      this.log(LogLevel.WARN, 'Cannot add commit - no connection', { tabId });
      return {
        success: false,
        error: {
          code: BackgroundErrorCode.CONNECTION_NOT_FOUND,
          message: `No connection found for tab ${tabId}`,
          tabId,
        },
      };
    }

    // Check if we're at max commits limit
    const maxCommits = connection.config.maxCommits;
    if (connection.commits.length >= maxCommits) {
      // Remove oldest commit
      connection.commits.shift();
      this.log(LogLevel.DEBUG, 'Removed oldest commit due to limit', {
        tabId,
        maxCommits,
      });
    }

    // Add the new commit
    connection.commits.push(commit);
    connection.commitCount++;

    this.log(LogLevel.DEBUG, 'Commit added to session', {
      tabId,
      commitId: commit.id,
      totalCommits: connection.commits.length,
    });

    return { success: true };
  }

  /**
   * Clears all session data for a tab
   * @param tabId - Chrome tab ID
   */
  clearSession(tabId: number): void {
    const connection = this.connectionManager.getConnection(tabId);
    if (!connection) {
      this.log(LogLevel.WARN, 'Cannot clear session - no connection', {
        tabId,
      });
      return;
    }

    connection.commits = [];
    connection.commitCount = 0;
    connection.sessionStartTime = null;
    connection.isProfiling = false;
    connection.sessionStatus = 'idle';

    this.log(LogLevel.INFO, 'Session data cleared', { tabId });
  }

  /**
   * Gets all session data for a tab
   * @param tabId - Chrome tab ID
   * @returns Array of collected commits
   */
  getSessionData(tabId: number): CommitData[] {
    const connection = this.connectionManager.getConnection(tabId);
    if (!connection) {
      return [];
    }

    return [...connection.commits];
  }

  /**
   * Gets session metadata for a tab
   * @param tabId - Chrome tab ID
   * @returns Session metadata or null if no session
   */
  getSessionMetadata(tabId: number): {
    isProfiling: boolean;
    sessionStartTime: number | null;
    commitCount: number;
    sessionStatus: string;
  } | null {
    const connection = this.connectionManager.getConnection(tabId);
    if (!connection) {
      return null;
    }

    return {
      isProfiling: connection.isProfiling,
      sessionStartTime: connection.sessionStartTime,
      commitCount: connection.commitCount,
      sessionStatus: connection.sessionStatus,
    };
  }

  /**
   * Exports session data as JSON string
   * @param tabId - Chrome tab ID
   * @returns JSON string of session data
   */
  exportSession(tabId: number): string {
    const connection = this.connectionManager.getConnection(tabId);
    if (!connection) {
      throw new Error(`No connection found for tab ${tabId}`);
    }

    const exportData: SessionExport = {
      version: '1.0.0',
      exportTime: Date.now(),
      tabId,
      url: '', // Would need to get from tab if available
      title: '', // Would need to get from tab if available
      startTime: connection.sessionStartTime ?? Date.now(),
      endTime: Date.now(),
      config: connection.config,
      commits: [...connection.commits],
      summary: this.generateSessionSummary(connection.commits),
    };

    // Try to get tab info if available
    this.enrichWithTabInfo(exportData);

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Imports session data from JSON string
   * @param tabId - Chrome tab ID to import to
   * @param jsonData - JSON string of session data
   * @returns Result indicating success or failure
   */
  importSession(tabId: number, jsonData: string): BackgroundResult<void> {
    try {
      const parsed = JSON.parse(jsonData) as SessionExport;

      // Validate version
      if (!parsed.version || !parsed.commits) {
        return {
          success: false,
          error: {
            code: BackgroundErrorCode.IMPORT_FAILED,
            message: 'Invalid session data format',
            tabId,
          },
        };
      }

      // Clear existing session
      this.clearSession(tabId);

      const connection = this.connectionManager.getOrCreateConnection(tabId);

      // Import commits
      parsed.commits.forEach((commit) => {
        connection.commits.push(commit);
      });

      connection.commitCount = parsed.commits.length;
      connection.sessionStartTime = parsed.startTime;
      connection.config = { ...DEFAULT_PROFILER_CONFIG, ...parsed.config };

      this.log(LogLevel.INFO, 'Session imported', {
        tabId,
        importedCommits: parsed.commits.length,
        version: parsed.version,
      });

      return { success: true };
    } catch (error) {
      this.log(LogLevel.ERROR, 'Failed to import session', { tabId, error });
      return {
        success: false,
        error: {
          code: BackgroundErrorCode.IMPORT_FAILED,
          message: `Failed to import session: ${error instanceof Error ? error.message : String(error)}`,
          tabId,
          originalError: error,
        },
      };
    }
  }

  /**
   * Gets statistics for a session
   * @param tabId - Chrome tab ID
   * @returns Session statistics or null if no session
   */
  getSessionStats(tabId: number): {
    totalCommits: number;
    totalNodes: number;
    averageCommitDuration: number;
    sessionDuration: number;
  } | null {
    const connection = this.connectionManager.getConnection(tabId);
    if (!connection || connection.commits.length === 0) {
      return null;
    }

    const commits = connection.commits;
    const totalNodes = commits.reduce((sum, c) => sum + (c.nodes?.length ?? 0), 0);
    const totalDuration = commits.reduce((sum, c) => sum + c.duration, 0);
    const sessionDuration = connection.sessionStartTime
      ? Date.now() - connection.sessionStartTime
      : 0;

    return {
      totalCommits: commits.length,
      totalNodes,
      averageCommitDuration: totalDuration / commits.length,
      sessionDuration,
    };
  }

  /**
   * Generates a summary of the session
   * @param commits - Array of commits
   * @returns Session summary
   */
  private generateSessionSummary(commits: CommitData[]): SessionSummary {
    const totalNodes = commits.reduce((sum, c) => sum + (c.nodes?.length ?? 0), 0);
    const durations = commits.map((c) => c.duration);

    // Count renders per component
    const componentRenderCounts = new Map<string, number>();
    commits.forEach((commit) => {
      commit.nodes?.forEach((node) => {
        const name = node.displayName;
        const current = componentRenderCounts.get(name) || 0;
        componentRenderCounts.set(name, current + 1);
      });
    });

    // Get top components by render count
    const topRenderCountComponents = Array.from(componentRenderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, renderCount]) => ({ name, renderCount }));

    return {
      totalCommits: commits.length,
      totalNodes,
      averageCommitDuration:
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      maxCommitDuration: durations.length > 0 ? Math.max(...durations) : 0,
      minCommitDuration: durations.length > 0 ? Math.min(...durations) : 0,
      uniqueComponents: componentRenderCounts.size,
      topRenderCountComponents,
    };
  }

  /**
   * Attempts to enrich export data with tab information
   * @param exportData - Export data to enrich
   */
  private enrichWithTabInfo(exportData: SessionExport): void {
    // Note: This requires the 'tabs' permission
    // In a real implementation, you'd check for this permission
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.get(exportData.tabId, (tab) => {
        if (chrome.runtime.lastError) {
          this.log(LogLevel.WARN, 'Could not get tab info', {
            error: chrome.runtime.lastError,
          });
          return;
        }

        if (tab) {
          exportData.url = tab.url || '';
          exportData.title = tab.title || '';
        }
      });
    }
  }

  /**
   * Logs a message if logging is enabled
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.enableDebugLog && level === LogLevel.DEBUG) return;

    const logData = {
      timestamp: Date.now(),
      ...data,
    };

    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug('[SessionManager]', message, logData);
        break;
      case LogLevel.INFO:
        this.logger.info('[SessionManager]', message, logData);
        break;
      case LogLevel.WARN:
        this.logger.warn('[SessionManager]', message, logData);
        break;
      case LogLevel.ERROR:
        this.logger.error('[SessionManager]', message, logData);
        break;
    }
  }
}
