/**
 * Dropbox Cloud Provider
 * @module shared/cloud/providers/DropboxProvider
 */

import type {
  CloudSyncProvider,
  CloudProviderType,
  DropboxProviderSettings,
  SyncResult,
  ListProfilesResult,
  CloudProfileInfo,
} from '../types';
import type { ExportedProfileV1 } from '@/shared/types/export';
import { logger } from '@/shared/logger';

/**
 * Dropbox Cloud Provider Implementation
 * Uses Dropbox API v2 for file storage
 */
export class DropboxProvider implements CloudSyncProvider {
  readonly type: CloudProviderType = 'dropbox';
  readonly name = 'Dropbox';

  private config: DropboxProviderSettings;
  private _isAuthenticated = false;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: number;

  // OAuth configuration
  private readonly OAUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
  private readonly TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
  private readonly API_URL = 'https://api.dropboxapi.com/2';
  private readonly CONTENT_URL = 'https://content.dropboxapi.com/2';

  constructor(config: DropboxProviderSettings) {
    this.config = config;
  }

  isAuthenticated(): boolean {
    return this._isAuthenticated && !!this.accessToken;
  }

  /**
   * Authenticate with Dropbox using OAuth 2.0
   * Uses Chrome identity API for secure OAuth flow
   */
  async authenticate(): Promise<boolean> {
    try {
      // Check if we have a stored token
      const stored = await this.getStoredToken();
      if (stored && stored.expiresAt > Date.now()) {
        this.accessToken = stored.accessToken;
        this.refreshToken = stored.refreshToken;
        this.tokenExpiresAt = stored.expiresAt;
        this._isAuthenticated = true;
        return true;
      }

      // Need to authenticate
      if (typeof chrome !== 'undefined' && chrome.identity) {
        return this.authenticateWithChrome();
      }

      // Fallback: manual OAuth flow
      return this.authenticateManual();
    } catch (error) {
      logger.error('Dropbox authentication failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'DropboxProvider',
      });
      return false;
    }
  }

  private async authenticateWithChrome(): Promise<boolean> {
    return new Promise((resolve) => {
      const redirectUrl = chrome.identity.getRedirectURL();
      const authUrl = `${this.OAUTH_URL}?` + new URLSearchParams({
        client_id: this.config.appKey,
        response_type: 'token',
        redirect_uri: redirectUrl,
        scope: 'files.content.write files.content.read',
      });

      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (redirectUri) => {
          if (chrome.runtime.lastError || !redirectUri) {
            resolve(false);
            return;
          }

          // Extract token from redirect URL
          const hash = new URL(redirectUri).hash.slice(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const expiresIn = params.get('expires_in');

          if (accessToken) {
            this.accessToken = accessToken;
            this.tokenExpiresAt = Date.now() + (Number.parseInt(expiresIn || '14400', 10) * 1000);
            this._isAuthenticated = true;
            await this.storeToken();
            resolve(true);
          } else {
            resolve(false);
          }
        }
      );
    });
  }

  private async authenticateManual(): Promise<boolean> {
    // For testing/non-extension environments
    logger.warn('Manual Dropbox authentication not implemented', { source: 'DropboxProvider' });
    return false;
  }

  async signOut(): Promise<void> {
    // Revoke token if possible
    if (this.accessToken) {
      try {
        await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
      } catch {
        // Ignore revocation errors
      }
    }

    this._isAuthenticated = false;
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.tokenExpiresAt = undefined;
    await this.clearStoredToken();
    logger.info('Dropbox signed out', { source: 'DropboxProvider' });
  }

  async uploadProfile(
    profile: ExportedProfileV1,
    filename: string,
    options?: { overwrite?: boolean; metadata?: Record<string, string> }
  ): Promise<SyncResult> {
    try {
      await this.ensureAuthenticated();
      
      const path = this.getFilePath(filename);
      const body = JSON.stringify(profile);
      const blob = new Blob([body], { type: 'application/json' });

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: options?.overwrite ? 'overwrite' : 'add',
          autorename: !options?.overwrite,
          mute: false,
          strict_conflict: false,
        }),
        'Content-Type': 'application/octet-stream',
      };

      const response = await fetch(`${this.CONTENT_URL}/files/upload`, {
        method: 'POST',
        headers,
        body: blob,
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error_summary || `Upload failed: ${response.status}`,
        };
      }

      const result = await response.json();
      
      // Add custom metadata if provided
      if (options?.metadata) {
        await this.setFileMetadata(path, options.metadata);
      }

      return {
        success: true,
        syncId: result.id,
        timestamp: result.client_modified,
        fileInfo: {
          id: result.id,
          name: filename,
          size: result.size,
          url: result.path_display,
        },
      };
    } catch (error) {
      logger.error('Dropbox upload failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'DropboxProvider',
      });
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
      await this.ensureAuthenticated();

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: profileId }),
      };

      const response = await fetch(`${this.CONTENT_URL}/files/download`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (error.error?.['.tag'] === 'not_found') {
          return { success: false, error: 'Profile not found' };
        }
        return {
          success: false,
          error: error.error_summary || `Download failed: ${response.status}`,
        };
      }

      const data = await response.json() as ExportedProfileV1;
      return { success: true, data };
    } catch (error) {
      logger.error('Dropbox download failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'DropboxProvider',
      });
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
      await this.ensureAuthenticated();

      const folder = this.getFolderPath();

      if (options?.search) {
        return this.searchProfiles(options.search, options.limit);
      }

      const response = await fetch(`${this.API_URL}/files/list_folder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: folder,
          recursive: false,
          include_deleted: false,
          limit: options?.limit ?? 50,
          cursor: options?.pageToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        // If folder doesn't exist, return empty list
        if (error.error?.['.tag'] === 'not_found') {
          return { success: true, profiles: [] };
        }
        return {
          success: false,
          error: error.error_summary || `List failed: ${response.status}`,
        };
      }

      const result = await response.json();
      const profiles: CloudProfileInfo[] = result.entries
        .filter((entry: { '.tag': string; name: string }) => 
          entry['.tag'] === 'file' && entry.name.endsWith('.json')
        )
        .map((entry: { 
          id: string; 
          name: string; 
          size: number; 
          client_modified: string; 
          server_modified: string;
        }) => ({
          id: entry.id,
          name: entry.name,
          size: entry.size,
          modifiedAt: entry.client_modified,
          createdAt: entry.server_modified,
          version: '1',
        }));

      return {
        success: true,
        profiles,
        nextPageToken: result.has_more ? result.cursor : undefined,
      };
    } catch (error) {
      logger.error('Dropbox list failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'DropboxProvider',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List failed',
      };
    }
  }

  private async searchProfiles(query: string, limit?: number): Promise<ListProfilesResult> {
    const response = await fetch(`${this.API_URL}/files/search_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${query} ext:json`,
        options: {
          path: this.getFolderPath(),
          max_results: limit ?? 50,
          file_status: 'active',
        },
      }),
    });

    if (!response.ok) {
      return { success: false, error: 'Search failed' };
    }

    const result = await response.json();
    const profiles: CloudProfileInfo[] = result.matches
      .filter((match: { metadata: { metadata: { '.tag': string } } }) => 
        match.metadata?.metadata?.['.tag'] === 'file'
      )
      .map((match: { 
        metadata: { 
          metadata: { 
            id: string;
            name: string;
            size: number;
            client_modified: string;
            server_modified: string;
          } 
        } 
      }) => ({
        id: match.metadata.metadata.id,
        name: match.metadata.metadata.name,
        size: match.metadata.metadata.size,
        modifiedAt: match.metadata.metadata.client_modified,
        createdAt: match.metadata.metadata.server_modified,
        version: '1',
      }));

    return {
      success: true,
      profiles,
      nextPageToken: result.more ? result.cursor : undefined,
    };
  }

  async deleteProfile(profileId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.ensureAuthenticated();

      const response = await fetch(`${this.API_URL}/files/delete_v2`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: profileId }),
      });

      if (response.ok) {
        return { success: true };
      }

      const error = await response.json();
      if (error.error?.['.tag'] === 'not_found') {
        return { success: false, error: 'Profile not found' };
      }

      return {
        success: false,
        error: error.error_summary || `Delete failed: ${response.status}`,
      };
    } catch (error) {
      logger.error('Dropbox delete failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'DropboxProvider',
      });
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
      await this.ensureAuthenticated();

      const response = await fetch(`${this.API_URL}/users/get_space_usage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Quota check failed: ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        used: result.used,
        total: result.allocation?.allocated,
        available: result.allocation?.allocated - result.used,
      };
    } catch (error) {
      logger.error('Dropbox quota check failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'DropboxProvider',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Quota check failed',
      };
    }
  }

  // =============================================================================
  // Private Helpers
  // =============================================================================

  private getFilePath(filename: string): string {
    const folder = this.config.folder || 'react-perf-profiles';
    return `/${folder}/${filename}`;
  }

  private getFolderPath(): string {
    return `/${this.config.folder || 'react-perf-profiles'}`;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthenticated()) {
      const success = await this.authenticate();
      if (!success) {
        throw new Error('Not authenticated');
      }
    }

    // Check if token needs refresh
    if (this.tokenExpiresAt && Date.now() > this.tokenExpiresAt - 60000) {
      await this.refreshAccessToken();
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.config.appKey,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
        await this.storeToken();
        return true;
      }
    } catch (error) {
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'DropboxProvider',
      });
    }

    return false;
  }

  private async setFileMetadata(path: string, metadata: Record<string, string>): Promise<void> {
    try {
      await fetch(`${this.API_URL}/files/properties/template/add`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          template_id: 'react_perf_profile',
          fields: Object.entries(metadata).map(([name, value]) => ({ name, value })),
        }),
      });
    } catch {
      // Metadata is optional, ignore errors
    }
  }

  private async getStoredToken(): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number } | null> {
    if (typeof chrome === 'undefined' || !chrome.storage) return null;
    
    const result = await chrome.storage.local.get('dropbox_token');
    return result.dropbox_token || null;
  }

  private async storeToken(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    
    await chrome.storage.local.set({
      dropbox_token: {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.tokenExpiresAt,
      },
    });
  }

  private async clearStoredToken(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    
    await chrome.storage.local.remove('dropbox_token');
  }
}
