/**
 * Cloud Sync Manager
 * Central manager for cloud synchronization with offline support
 * @module shared/cloud/CloudSyncManager
 */

import type {
  CloudSyncProvider,
  CloudSyncConfig,
  CloudProviderSettings,
  CloudProviderType,
  SyncResult,
  ListProfilesResult,
  SyncQueueItem,
  CloudSyncState,
} from './types';
import type { ExportedProfileV1 } from '@/shared/types/export';
import { S3Provider } from './providers/S3Provider';
import { DropboxProvider } from './providers/DropboxProvider';
import { GoogleDriveProvider } from './providers/GoogleDriveProvider';
import { LocalStorageProvider } from '../export/cloudSync';
import { logger } from '@/shared/logger';
import { isGoogleDriveCloudSyncEnabled } from './experimentalFlags';

/**
 * Cloud Sync Manager
 * Handles provider lifecycle, offline queue, and auto-sync
 */
export class CloudSyncManager {
  private provider: CloudSyncProvider | null = null;
  private config: CloudSyncConfig | null = null;
  private state: CloudSyncState = {
    isSyncing: false,
    lastSyncAt: null,
    lastError: null,
    queue: [],
    isOnline: true,
  };
  private listeners: Set<(state: CloudSyncState) => void> = new Set();
  private syncInterval?: number;

  constructor() {
    this.loadConfig();
    this.setupOnlineOfflineListeners();
  }

  // =============================================================================
  // Configuration
  // =============================================================================

  /**
   * Initialize with configuration
   */
  async initialize(config: CloudSyncConfig): Promise<boolean> {
    this.config = config;
    await this.saveConfig();

    if (!config.enabled) {
      this.provider = null;
      return true;
    }

    if (config.provider === 'google-drive' && !isGoogleDriveCloudSyncEnabled()) {
      logger.warn('Google Drive sync is disabled in this build (VITE_DISABLE_GOOGLE_DRIVE_SYNC)', {
        source: 'CloudSyncManager',
      });
      this.setState({
        lastError:
          'Google Drive is disabled in this build. Remove VITE_DISABLE_GOOGLE_DRIVE_SYNC or pick another provider.',
      });
      this.provider = null;
      return false;
    }

    // Create provider
    this.provider = this.createProvider(config.provider, config.settings);
    
    // Authenticate
    const authenticated = await this.provider.authenticate();
    
    if (authenticated) {
      // Process any queued items
      await this.processQueue();
      
      // Setup auto-sync
      this.setupAutoSync();
    }

    return authenticated;
  }

  /**
   * Get current configuration
   */
  getConfig(): CloudSyncConfig | null {
    return this.config;
  }

  /**
   * Check if cloud sync is enabled and authenticated
   */
  isReady(): boolean {
    return !!this.config?.enabled && !!this.provider?.isAuthenticated();
  }

  // =============================================================================
  // Sync Operations
  // =============================================================================

  /**
   * Upload a profile to cloud
   */
  async uploadProfile(
    profile: ExportedProfileV1,
    filename: string,
    options?: { overwrite?: boolean; metadata?: Record<string, string> }
  ): Promise<SyncResult> {
    if (!this.isReady()) {
      // Queue for later if offline
      if (!this.state.isOnline) {
        this.queueItem({
          id: crypto.randomUUID(),
          action: 'upload',
          profileId: filename,
          filename,
          data: profile,
          timestamp: Date.now(),
          retryCount: 0,
        });
        return { success: false, error: 'Queued for sync when online' };
      }
      return { success: false, error: 'Cloud sync not configured' };
    }

    this.setState({ isSyncing: true });

    try {
      const result = await this.provider!.uploadProfile(profile, filename, options);
      
      if (result.success) {
        this.setState({ 
          lastSyncAt: Date.now(),
          lastError: null,
        });
      } else {
        this.setState({ lastError: result.error || 'Upload failed' });
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      this.setState({ lastError: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      this.setState({ isSyncing: false });
    }
  }

  /**
   * Download a profile from cloud
   */
  async downloadProfile(profileId: string): Promise<{
    success: boolean;
    data?: ExportedProfileV1;
    error?: string;
  }> {
    if (!this.isReady()) {
      return { success: false, error: 'Cloud sync not configured' };
    }

    this.setState({ isSyncing: true });

    try {
      const result = await this.provider!.downloadProfile(profileId);
      
      if (result.success) {
        this.setState({ lastError: null });
      } else {
        this.setState({ lastError: result.error || 'Download failed' });
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Download failed';
      this.setState({ lastError: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      this.setState({ isSyncing: false });
    }
  }

  /**
   * List profiles from cloud
   */
  async listProfiles(options?: {
    limit?: number;
    pageToken?: string;
    search?: string;
  }): Promise<ListProfilesResult> {
    if (!this.isReady()) {
      return { success: false, error: 'Cloud sync not configured' };
    }

    try {
      return await this.provider!.listProfiles(options);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'List failed';
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Delete a profile from cloud
   */
  async deleteProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isReady()) {
      // Queue for later if offline
      if (!this.state.isOnline) {
        this.queueItem({
          id: crypto.randomUUID(),
          action: 'delete',
          profileId,
          timestamp: Date.now(),
          retryCount: 0,
        });
        return { success: false, error: 'Queued for sync when online' };
      }
      return { success: false, error: 'Cloud sync not configured' };
    }

    try {
      return await this.provider!.deleteProfile(profileId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Delete failed';
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get storage quota
   */
  async getQuota(): Promise<{
    success: boolean;
    used?: number;
    total?: number;
    available?: number;
    error?: string;
  }> {
    if (!this.isReady()) {
      return { success: false, error: 'Cloud sync not configured' };
    }

    try {
      return await this.provider!.getQuota();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Quota check failed';
      return { success: false, error: errorMsg };
    }
  }

  // =============================================================================
  // Offline Queue
  // =============================================================================

  /**
   * Add item to sync queue
   */
  private queueItem(item: SyncQueueItem): void {
    this.setState({ queue: [...this.state.queue, item] });
    this.saveQueue();
    logger.info(`Queued ${item.action} for ${item.profileId}`, { source: 'CloudSyncManager' });
  }

  /**
   * Process queued items
   */
  private async processQueue(): Promise<void> {
    if (this.state.queue.length === 0) return;
    if (!this.isReady()) return;

    logger.info(`Processing ${this.state.queue.length} queued items`, { source: 'CloudSyncManager' });

    const processed: string[] = [];
    const failed: SyncQueueItem[] = [];

    for (const item of this.state.queue) {
      try {
        if (item.action === 'upload' && item.data) {
          const result = await this.provider!.uploadProfile(
            item.data,
            item.filename || item.profileId,
            { overwrite: true }
          );
          if (result.success) {
            processed.push(item.id);
          } else if (item.retryCount < 3) {
            failed.push({ ...item, retryCount: item.retryCount + 1 });
          }
        } else if (item.action === 'delete') {
          const result = await this.provider!.deleteProfile(item.profileId);
          if (result.success) {
            processed.push(item.id);
          } else if (item.retryCount < 3) {
            failed.push({ ...item, retryCount: item.retryCount + 1 });
          }
        }
      } catch (error) {
        logger.error(`Failed to process queue item ${item.id}`, {
          error: error instanceof Error ? error.message : String(error),
          source: 'CloudSyncManager',
        });
        if (item.retryCount < 3) {
          failed.push({ ...item, retryCount: item.retryCount + 1 });
        }
      }
    }

    this.setState({ queue: failed });
    this.saveQueue();

    if (processed.length > 0) {
      logger.info(`Processed ${processed.length} queue items`, { source: 'CloudSyncManager' });
    }
    if (failed.length > 0) {
      logger.warn(`${failed.length} queue items failed and will retry`, { source: 'CloudSyncManager' });
    }
  }

  // =============================================================================
  // Auto Sync
  // =============================================================================

  private setupAutoSync(): void {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
    }

    if (!this.config?.autoSync?.enabled) return;

    const intervalMs = (this.config.autoSync.interval || 60) * 60 * 1000;
    
    this.syncInterval = window.setInterval(() => {
      if (this.isReady() && this.state.isOnline) {
        this.processQueue();
      }
    }, intervalMs);
  }

  // =============================================================================
  // Provider Factory
  // =============================================================================

  private createProvider(
    type: CloudProviderType,
    settings: CloudProviderSettings
  ): CloudSyncProvider {
    switch (type) {
      case 's3':
        return new S3Provider(settings as import('./types').S3ProviderSettings);
      case 'dropbox':
        return new DropboxProvider(settings as import('./types').DropboxProviderSettings);
      case 'google-drive':
        return new GoogleDriveProvider(settings as import('./types').GoogleDriveProviderSettings);
      case 'local':
      default:
        return new LocalStorageProvider(settings as import('./types').LocalProviderSettings);
    }
  }

  // =============================================================================
  // State Management
  // =============================================================================

  getState(): CloudSyncState {
    return { ...this.state };
  }

  private setState(updates: Partial<CloudSyncState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  subscribe(listener: (state: CloudSyncState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // =============================================================================
  // Persistence
  // =============================================================================

  private async loadConfig(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    try {
      const result = await chrome.storage.local.get('cloud_sync_config');
      if (result.cloud_sync_config) {
        this.config = result.cloud_sync_config;

        if (
          this.config?.enabled &&
          this.config.provider === 'google-drive' &&
          !isGoogleDriveCloudSyncEnabled()
        ) {
          this.config = { ...this.config, enabled: false };
          await chrome.storage.local.set({ cloud_sync_config: this.config });
          this.setState({
            lastError:
              'Google Drive sync was turned off: this build has VITE_DISABLE_GOOGLE_DRIVE_SYNC set.',
          });
        }

        // Re-initialize provider
        if (this.config?.enabled) {
          this.provider = this.createProvider(this.config.provider, this.config.settings);
        }
      }

      const queueResult = await chrome.storage.local.get('cloud_sync_queue');
      if (queueResult.cloud_sync_queue) {
        this.state.queue = queueResult.cloud_sync_queue;
      }
    } catch (error) {
      logger.error('Failed to load cloud config', {
        error: error instanceof Error ? error.message : String(error),
        source: 'CloudSyncManager',
      });
    }
  }

  private async saveConfig(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    try {
      await chrome.storage.local.set({ cloud_sync_config: this.config });
    } catch (error) {
      logger.error('Failed to save cloud config', {
        error: error instanceof Error ? error.message : String(error),
        source: 'CloudSyncManager',
      });
    }
  }

  private async saveQueue(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    try {
      await chrome.storage.local.set({ cloud_sync_queue: this.state.queue });
    } catch (error) {
      logger.error('Failed to save sync queue', {
        error: error instanceof Error ? error.message : String(error),
        source: 'CloudSyncManager',
      });
    }
  }

  // =============================================================================
  // Online/Offline
  // =============================================================================

  private setupOnlineOfflineListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.setState({ isOnline: true });
      if (this.isReady()) {
        this.processQueue();
      }
    });

    window.addEventListener('offline', () => {
      this.setState({ isOnline: false });
    });

    this.setState({ isOnline: navigator.onLine });
  }

  // =============================================================================
  // Cleanup
  // =============================================================================

  destroy(): void {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
    }
    this.listeners.clear();
  }
}

// Singleton instance
let cloudSyncManager: CloudSyncManager | null = null;

export function getCloudSyncManager(): CloudSyncManager {
  if (!cloudSyncManager) {
    cloudSyncManager = new CloudSyncManager();
  }
  return cloudSyncManager;
}

export function resetCloudSyncManager(): void {
  cloudSyncManager?.destroy();
  cloudSyncManager = null;
}
