/**
 * Cloud sync provider interface for React Perf Profiler
 * Defines the contract for cloud storage providers
 * @module shared/export/cloudSync
 */

import type { ExportedProfileV1 } from '@/shared/types/export';

/**
 * Cloud sync configuration
 */
export interface CloudSyncConfig {
  /** Whether cloud sync is enabled */
  enabled: boolean;
  /** Cloud provider identifier */
  provider: CloudProviderType;
  /** Provider-specific settings */
  settings: CloudProviderSettings;
  /** Auto-sync settings */
  autoSync?: {
    enabled: boolean;
    interval: number; // minutes
    onExport: boolean;
  };
}

/**
 * Supported cloud provider types
 */
export type CloudProviderType =
  | 'local'
  | 's3'
  | 'gcs'
  | 'dropbox'
  | 'onedrive'
  | 'custom';

/**
 * Provider-specific settings
 */
export type CloudProviderSettings =
  | LocalProviderSettings
  | S3ProviderSettings
  | GCSProviderSettings
  | DropboxProviderSettings
  | OneDriveProviderSettings
  | CustomProviderSettings;

/**
 * Local storage provider settings (uses browser storage)
 */
export interface LocalProviderSettings {
  type: 'local';
  maxStorageSize: number; // bytes
  storageKey: string;
}

/**
 * S3-compatible storage provider settings
 */
export interface S3ProviderSettings {
  type: 's3';
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId?: string;
  // Secret should be stored securely, not in settings
  usePresignedUrls: boolean;
  folder?: string;
  customHeaders?: Record<string, string>;
}

/**
 * Google Cloud Storage provider settings
 */
export interface GCSProviderSettings {
  type: 'gcs';
  bucket: string;
  projectId: string;
  folder?: string;
  // Credentials should be handled via OAuth
}

/**
 * Dropbox provider settings
 */
export interface DropboxProviderSettings {
  type: 'dropbox';
  appKey: string;
  folder: string;
  // Access token should be obtained via OAuth
}

/**
 * OneDrive provider settings
 */
export interface OneDriveProviderSettings {
  type: 'onedrive';
  clientId: string;
  folder: string;
  // Access token should be obtained via OAuth
}

/**
 * Custom provider settings
 */
export interface CustomProviderSettings {
  type: 'custom';
  endpoint: string;
  headers?: Record<string, string>;
  authType: 'none' | 'bearer' | 'apiKey';
}

/**
 * Sync result
 */
export interface SyncResult {
  /** Whether sync was successful */
  success: boolean;
  /** Sync operation ID */
  syncId?: string;
  /** Timestamp of sync */
  timestamp?: string;
  /** Error message if failed */
  error?: string;
  /** Uploaded file info */
  fileInfo?: {
    id: string;
    name: string;
    size: number;
    url?: string;
    etag?: string;
  };
}

/**
 * List profiles result
 */
export interface ListProfilesResult {
  /** Whether listing was successful */
  success: boolean;
  /** List of available profiles */
  profiles?: CloudProfileInfo[];
  /** Error message if failed */
  error?: string;
  /** Pagination token for next page */
  nextPageToken?: string;
}

/**
 * Cloud profile information
 */
export interface CloudProfileInfo {
  /** Profile ID */
  id: string;
  /** Profile name */
  name: string;
  /** Size in bytes */
  size: number;
  /** Last modified timestamp */
  modifiedAt: string;
  /** Created timestamp */
  createdAt: string;
  /** Version */
  version: string;
  /** Download URL (if available) */
  downloadUrl?: string;
  /** Thumbnail URL (if available) */
  thumbnailUrl?: string;
}

/**
 * Cloud sync provider interface
 * All cloud storage providers must implement this interface
 */
export interface CloudSyncProvider {
  /** Provider type identifier */
  readonly type: CloudProviderType;

  /** Provider display name */
  readonly name: string;

  /** Whether the provider is currently authenticated */
  isAuthenticated(): boolean;

  /** Authenticate with the provider */
  authenticate(): Promise<boolean>;

  /** Sign out from the provider */
  signOut(): Promise<void>;

  /** Upload a profile to cloud storage */
  uploadProfile(
    profile: ExportedProfileV1,
    filename: string,
    options?: {
      overwrite?: boolean;
      metadata?: Record<string, string>;
    }
  ): Promise<SyncResult>;

  /** Download a profile from cloud storage */
  downloadProfile(profileId: string): Promise<{
    success: boolean;
    data?: ExportedProfileV1;
    error?: string;
  }>;

  /** List available profiles in cloud storage */
  listProfiles(options?: {
    limit?: number;
    pageToken?: string;
    search?: string;
  }): Promise<ListProfilesResult>;

  /** Delete a profile from cloud storage */
  deleteProfile(profileId: string): Promise<{
    success: boolean;
    error?: string;
  }>;

  /** Get available storage quota */
  getQuota(): Promise<{
    success: boolean;
    used?: number;
    total?: number;
    available?: number;
    error?: string;
  }>;

  /** Sync local profiles with cloud */
  sync?(localProfiles: string[]): Promise<{
    success: boolean;
    uploaded: string[];
    downloaded: string[];
    conflicts: string[];
    error?: string;
  }>;
}

/**
 * Abstract base class for cloud sync providers
 */
export abstract class BaseCloudSyncProvider implements CloudSyncProvider {
  abstract readonly type: CloudProviderType;
  abstract readonly name: string;

  protected config: CloudProviderSettings;
  protected _isAuthenticated = false;

  constructor(config: CloudProviderSettings) {
    this.config = config;
  }

  isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  abstract authenticate(): Promise<boolean>;
  abstract signOut(): Promise<void>;
  abstract uploadProfile(
    profile: ExportedProfileV1,
    filename: string,
    options?: {
      overwrite?: boolean;
      metadata?: Record<string, string>;
    }
  ): Promise<SyncResult>;
  abstract downloadProfile(profileId: string): Promise<{
    success: boolean;
    data?: ExportedProfileV1;
    error?: string;
  }>;
  abstract listProfiles(options?: {
    limit?: number;
    pageToken?: string;
    search?: string;
  }): Promise<ListProfilesResult>;
  abstract deleteProfile(profileId: string): Promise<{
    success: boolean;
    error?: string;
  }>;
  abstract getQuota(): Promise<{
    success: boolean;
    used?: number;
    total?: number;
    available?: number;
    error?: string;
  }>;

  protected generateFilename(profile: ExportedProfileV1): string {
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const appName = profile.metadata.sourceUrl
      ? new URL(profile.metadata.sourceUrl).hostname.replace(/\./g, '-')
      : 'unknown';
    return `react-perf-${appName}-${date}.json`;
  }
}

/**
 * Local storage provider (uses browser's IndexedDB/LocalStorage)
 * This is the default provider and serves as a reference implementation
 */
export class LocalStorageProvider extends BaseCloudSyncProvider {
  readonly type = 'local' as const;
  readonly name = 'Browser Storage';

  private storage: Storage | null = null;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'ReactPerfProfiler';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'profiles';

  constructor(config: LocalProviderSettings) {
    super(config);
    this.initStorage();
  }

  private async initStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Try IndexedDB first for larger storage
    try {
      this.db = await this.openIndexedDB();
    } catch {
      // Fallback to localStorage
      this.storage = window.localStorage;
    }
  }

  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('modifiedAt', 'modifiedAt', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  async authenticate(): Promise<boolean> {
    // Local storage doesn't require authentication
    this._isAuthenticated = true;
    return true;
  }

  async signOut(): Promise<void> {
    this._isAuthenticated = false;
  }

  async uploadProfile(
    profile: ExportedProfileV1,
    filename: string,
    options?: { overwrite?: boolean; metadata?: Record<string, string> }
  ): Promise<SyncResult> {
    try {
      const id = filename.replace(/\.json$/, '');

      if (this.db) {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);

        const existing = await new Promise((resolve) => {
          const request = store.get(id);
          request.onsuccess = () => resolve(request.result);
        });

        if (existing && !options?.overwrite) {
          return {
            success: false,
            error: 'Profile already exists. Use overwrite option to replace.',
          };
        }

        const data = {
          id,
          name: filename,
          data: profile,
          size: JSON.stringify(profile).length,
          modifiedAt: new Date().toISOString(),
          createdAt: (existing as { createdAt?: string })?.createdAt || new Date().toISOString(),
          metadata: options?.metadata,
          version: profile.version,
        };

        await new Promise((resolve, reject) => {
          const request = store.put(data);
          request.onsuccess = () => resolve(undefined);
          request.onerror = () => reject(request.error);
        });

        return {
          success: true,
          syncId: id,
          timestamp: new Date().toISOString(),
          fileInfo: {
            id,
            name: filename,
            size: data.size,
          },
        };
      } else if (this.storage) {
        // Fallback to localStorage
        const key = `react-perf-profile-${id}`;
        const existing = this.storage.getItem(key);

        if (existing && !options?.overwrite) {
          return {
            success: false,
            error: 'Profile already exists. Use overwrite option to replace.',
          };
        }

        const profileJson = JSON.stringify(profile);
        this.storage.setItem(key, profileJson);

        return {
          success: true,
          syncId: id,
          timestamp: new Date().toISOString(),
          fileInfo: {
            id,
            name: filename,
            size: profileJson.length,
          },
        };
      }

      return { success: false, error: 'Storage not available' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async downloadProfile(profileId: string): Promise<{
    success: boolean;
    data?: ExportedProfileV1;
    error?: string;
  }> {
    try {
      if (this.db) {
        const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);

        const result = await new Promise<{ data: ExportedProfileV1 }>((resolve, reject) => {
          const request = store.get(profileId);
          request.onsuccess = () => resolve(request.result as { data: ExportedProfileV1 });
          request.onerror = () => reject(request.error);
        });

        if (!result) {
          return { success: false, error: 'Profile not found' };
        }

        return { success: true, data: result.data };
      } else if (this.storage) {
        const key = `react-perf-profile-${profileId}`;
        const data = this.storage.getItem(key);

        if (!data) {
          return { success: false, error: 'Profile not found' };
        }

        return { success: true, data: JSON.parse(data) };
      }

      return { success: false, error: 'Storage not available' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  async listProfiles(options?: {
    limit?: number;
    pageToken?: string;
    search?: string;
  }): Promise<ListProfilesResult> {
    try {
      const profiles: CloudProfileInfo[] = [];

      if (this.db) {
        const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);

        const results = await new Promise<
          Array<{
            id: string;
            name: string;
            size: number;
            modifiedAt: string;
            createdAt: string;
            version: string;
          }>
        >((resolve) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
        });

        for (const item of results) {
          if (options?.search && !item.name.includes(options.search)) {
            continue;
          }
          profiles.push({
            id: item.id,
            name: item.name,
            size: item.size,
            modifiedAt: item.modifiedAt,
            createdAt: item.createdAt,
            version: item.version,
          });
        }
      } else if (this.storage) {
        // Iterate localStorage keys
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key?.startsWith('react-perf-profile-')) {
            const data = this.storage.getItem(key);
            if (data) {
              const profile = JSON.parse(data) as ExportedProfileV1;
              profiles.push({
                id: key.replace('react-perf-profile-', ''),
                name: `${key.replace('react-perf-profile-', '')}.json`,
                size: data.length,
                modifiedAt: new Date().toISOString(),
                createdAt: profile.metadata.exportedAt,
                version: profile.version,
              });
            }
          }
        }
      }

      // Sort by modified date
      profiles.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

      // Apply limit
      const limit = options?.limit ?? 50;
      const paginatedProfiles = profiles.slice(0, limit);

      return {
        success: true,
        profiles: paginatedProfiles,
        nextPageToken: profiles.length > limit ? String(limit) : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list profiles',
      };
    }
  }

  async deleteProfile(profileId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (this.db) {
        const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);

        await new Promise((resolve, reject) => {
          const request = store.delete(profileId);
          request.onsuccess = () => resolve(undefined);
          request.onerror = () => reject(request.error);
        });

        return { success: true };
      } else if (this.storage) {
        const key = `react-perf-profile-${profileId}`;
        this.storage.removeItem(key);
        return { success: true };
      }

      return { success: false, error: 'Storage not available' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      };
    }
  }

  async getQuota(): Promise<{
    success: boolean;
    used?: number;
    total?: number;
    available?: number;
    error?: string;
  }> {
    try {
      if (this.db) {
        const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);

        const results = await new Promise<Array<{ size: number }>>((resolve) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
        });

        const used = results.reduce((sum, item) => sum + (item.size || 0), 0);
        const config = this.config as LocalProviderSettings;
        const total = config.maxStorageSize;

        return {
          success: true,
          used,
          total,
          available: total - used,
        };
      } else if (this.storage) {
        // Estimate localStorage usage
        let used = 0;
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key?.startsWith('react-perf-profile-')) {
            const value = this.storage.getItem(key);
            if (value) {
              used += key.length + value.length;
            }
          }
        }

        // localStorage is typically limited to 5-10MB
        const total = 5 * 1024 * 1024;

        return {
          success: true,
          used,
          total,
          available: total - used,
        };
      }

      return { success: false, error: 'Storage not available' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get quota',
      };
    }
  }
}

/**
 * Factory function to create cloud sync providers
 */
export function createCloudProvider(
  type: CloudProviderType,
  settings: CloudProviderSettings
): CloudSyncProvider {
  switch (type) {
    case 'local':
      return new LocalStorageProvider(settings as LocalProviderSettings);
    case 's3':
    case 'gcs':
    case 'dropbox':
    case 'onedrive':
    case 'custom':
      // These will be implemented when cloud sync is fully enabled
      throw new Error(`Cloud provider "${type}" is not yet implemented`);
    default:
      throw new Error(`Unknown cloud provider type: ${type}`);
  }
}

/**
 * Get cloud sync config from environment
 */
export function getCloudSyncConfigFromEnv(): CloudSyncConfig | null {
  if (typeof import.meta === 'undefined') return null;

  const enabled = import.meta.env?.['VITE_CLOUD_SYNC_ENABLED'] === 'true';
  const provider = (import.meta.env?.['VITE_CLOUD_PROVIDER'] as CloudProviderType) || 'local';

  if (!enabled) return null;

  return {
    enabled,
    provider,
    settings: { type: 'local', maxStorageSize: 50 * 1024 * 1024, storageKey: 'react-perf-profiles' },
    autoSync: {
      enabled: false,
      interval: 60,
      onExport: false,
    },
  };
}
