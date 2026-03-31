/**
 * Cloud Sync Types
 * Type definitions for cloud storage providers
 * @module shared/cloud/types
 */

import type { ExportedProfileV1 } from '@/shared/types/export';

/**
 * Cloud provider types
 */
export type CloudProviderType = 'local' | 's3' | 'dropbox' | 'google-drive';

/**
 * Cloud sync configuration
 */
export interface CloudSyncConfig {
  enabled: boolean;
  provider: CloudProviderType;
  settings: CloudProviderSettings;
  autoSync?: {
    enabled: boolean;
    interval: number; // minutes
    onExport: boolean;
  };
}

/**
 * Provider-specific settings
 */
export type CloudProviderSettings =
  | LocalProviderSettings
  | S3ProviderSettings
  | DropboxProviderSettings
  | GoogleDriveProviderSettings;

export interface LocalProviderSettings {
  type: 'local';
  maxStorageSize: number;
  storageKey: string;
}

export interface S3ProviderSettings {
  type: 's3';
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId?: string;
  usePresignedUrls: boolean;
  folder?: string;
  customHeaders?: Record<string, string>;
}

export interface DropboxProviderSettings {
  type: 'dropbox';
  appKey: string;
  folder: string;
}

export interface GoogleDriveProviderSettings {
  type: 'google-drive';
  clientId: string;
  folderId?: string;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  syncId?: string;
  timestamp?: string;
  error?: string;
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
  success: boolean;
  profiles?: CloudProfileInfo[];
  error?: string;
  nextPageToken?: string;
}

/**
 * Cloud profile information
 */
export interface CloudProfileInfo {
  id: string;
  name: string;
  size: number;
  modifiedAt: string;
  createdAt: string;
  version: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
}

/**
 * Cloud sync provider interface
 */
export interface CloudSyncProvider {
  readonly type: CloudProviderType;
  readonly name: string;
  
  isAuthenticated(): boolean;
  authenticate(): Promise<boolean>;
  signOut(): Promise<void>;
  
  uploadProfile(
    profile: ExportedProfileV1,
    filename: string,
    options?: { overwrite?: boolean; metadata?: Record<string, string> }
  ): Promise<SyncResult>;
  
  downloadProfile(profileId: string): Promise<{
    success: boolean;
    data?: ExportedProfileV1;
    error?: string;
  }>;
  
  listProfiles(options?: {
    limit?: number;
    pageToken?: string;
    search?: string;
  }): Promise<ListProfilesResult>;
  
  deleteProfile(profileId: string): Promise<{
    success: boolean;
    error?: string;
  }>;
  
  getQuota(): Promise<{
    success: boolean;
    used?: number;
    total?: number;
    available?: number;
    error?: string;
  }>;
}

/**
 * Sync queue item for offline support
 */
export interface SyncQueueItem {
  id: string;
  action: 'upload' | 'delete';
  profileId: string;
  filename?: string;
  data?: ExportedProfileV1;
  timestamp: number;
  retryCount: number;
}

/**
 * Cloud sync state
 */
export interface CloudSyncState {
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  queue: SyncQueueItem[];
  isOnline: boolean;
}
