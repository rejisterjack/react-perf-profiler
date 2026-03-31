/**
 * Google Drive Cloud Provider
 * @module shared/cloud/providers/GoogleDriveProvider
 */

import type {
  CloudSyncProvider,
  CloudProviderType,
  GoogleDriveProviderSettings,
  SyncResult,
  ListProfilesResult,
  CloudProfileInfo,
} from '../types';
import type { ExportedProfileV1 } from '@/shared/types/export';
import { logger } from '@/shared/logger';

/**
 * Google Drive Cloud Provider Implementation
 * Uses Google Drive API v3 for file storage
 */
export class GoogleDriveProvider implements CloudSyncProvider {
  readonly type: CloudProviderType = 'google-drive';
  readonly name = 'Google Drive';

  private config: GoogleDriveProviderSettings;
  private _isAuthenticated = false;
  private accessToken?: string;
  private folderId?: string;

  // OAuth and API configuration
  private readonly OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  // TODO: Use for token refresh implementation
  // private readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly API_URL = 'https://www.googleapis.com/drive/v3';
  private readonly UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
  private readonly SCOPES = ['https://www.googleapis.com/auth/drive.file'];

  constructor(config: GoogleDriveProviderSettings) {
    this.config = config;
    this.folderId = config.folderId;
  }

  isAuthenticated(): boolean {
    return this._isAuthenticated && !!this.accessToken;
  }

  /**
   * Authenticate with Google Drive using OAuth 2.0
   */
  async authenticate(): Promise<boolean> {
    try {
      // Check for stored token
      const stored = await this.getStoredToken();
      if (stored && stored.expiresAt > Date.now()) {
        this.accessToken = stored.accessToken;
        this._isAuthenticated = true;
        
        // Ensure folder exists
        if (!this.folderId) {
          await this.ensureFolder();
        }
        return true;
      }

      // Need to authenticate
      if (typeof chrome !== 'undefined' && chrome.identity) {
        return this.authenticateWithChrome();
      }

      return false;
    } catch (error) {
      logger.error('Google Drive authentication failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'GoogleDriveProvider',
      });
      return false;
    }
  }

  private async authenticateWithChrome(): Promise<boolean> {
    return new Promise((resolve) => {
      const redirectUrl = chrome.identity.getRedirectURL();
      const authUrl = `${this.OAUTH_URL}?` + new URLSearchParams({
        client_id: this.config.clientId,
        response_type: 'token',
        redirect_uri: redirectUrl,
        scope: this.SCOPES.join(' '),
        include_granted_scopes: 'true',
        state: 'react-perf-profiler',
      });

      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        async (redirectUri) => {
          if (chrome.runtime.lastError || !redirectUri) {
            resolve(false);
            return;
          }

          const hash = new URL(redirectUri).hash.slice(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const expiresIn = params.get('expires_in');

          if (accessToken) {
            this.accessToken = accessToken;
            this._isAuthenticated = true;
            
            await this.storeToken({
              accessToken,
              expiresAt: Date.now() + (Number.parseInt(expiresIn || '3600', 10) * 1000),
            });

            // Ensure folder exists
            await this.ensureFolder();
            
            resolve(true);
          } else {
            resolve(false);
          }
        }
      );
    });
  }

  async signOut(): Promise<void> {
    // Revoke token
    if (this.accessToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
          method: 'POST',
        });
      } catch {
        // Ignore revocation errors
      }
    }

    this._isAuthenticated = false;
    this.accessToken = undefined;
    await this.clearStoredToken();
    logger.info('Google Drive signed out', { source: 'GoogleDriveProvider' });
  }

  async uploadProfile(
    profile: ExportedProfileV1,
    filename: string,
    options?: { overwrite?: boolean; metadata?: Record<string, string> }
  ): Promise<SyncResult> {
    try {
      await this.ensureAuthenticated();
      await this.ensureFolder();

      const body = JSON.stringify(profile);
      const blob = new Blob([body], { type: 'application/json' });

      // Check for existing file if not overwriting
      let existingId: string | undefined;
      if (!options?.overwrite) {
        existingId = await this.findFileByName(filename);
        if (existingId) {
          return {
            success: false,
            error: 'Profile already exists. Use overwrite option to replace.',
          };
        }
      }

      // Upload using multipart
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const metadata: Record<string, unknown> = {
        name: filename,
        mimeType: 'application/json',
        parents: this.folderId ? [this.folderId] : undefined,
        appProperties: {
          version: profile.version,
          exportedAt: profile.metadata.exportedAt,
          ...options?.metadata,
        },
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        body +
        closeDelim;

      const response = await fetch(`${this.UPLOAD_URL}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body: multipartRequestBody,
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || `Upload failed: ${response.status}`,
        };
      }

      const result = await response.json();
      
      return {
        success: true,
        syncId: result.id,
        timestamp: new Date().toISOString(),
        fileInfo: {
          id: result.id,
          name: filename,
          size: blob.size,
          url: result.webViewLink,
        },
      };
    } catch (error) {
      logger.error('Google Drive upload failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'GoogleDriveProvider',
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

      const response = await fetch(`${this.API_URL}/files/${profileId}?alt=media`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (response.ok) {
        const data = await response.json() as ExportedProfileV1;
        return { success: true, data };
      }

      if (response.status === 404) {
        return { success: false, error: 'Profile not found' };
      }

      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || `Download failed: ${response.status}`,
      };
    } catch (error) {
      logger.error('Google Drive download failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'GoogleDriveProvider',
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
      await this.ensureFolder();

      let query = `mimeType='application/json'`;
      
      if (this.folderId) {
        query += ` and '${this.folderId}' in parents`;
      }
      
      if (options?.search) {
        query += ` and name contains '${options.search.replace(/'/g, "\\'")}'`;
      }

      const params = new URLSearchParams({
        q: query,
        spaces: 'drive',
        fields: 'nextPageToken,files(id,name,size,modifiedTime,createdTime,appProperties)',
        pageSize: String(options?.limit ?? 50),
        orderBy: 'modifiedTime desc',
      });

      if (options?.pageToken) {
        params.set('pageToken', options.pageToken);
      }

      const response = await fetch(`${this.API_URL}/files?${params}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error?.message || `List failed: ${response.status}`,
        };
      }

      const result = await response.json();
      
      const profiles: CloudProfileInfo[] = result.files.map((file: {
        id: string;
        name: string;
        size?: string;
        modifiedTime: string;
        createdTime: string;
        appProperties?: { version?: string };
      }) => ({
        id: file.id,
        name: file.name,
        size: Number.parseInt(file.size || '0', 10),
        modifiedAt: file.modifiedTime,
        createdAt: file.createdTime,
        version: file.appProperties?.version || '1',
      }));

      return {
        success: true,
        profiles,
        nextPageToken: result.nextPageToken,
      };
    } catch (error) {
      logger.error('Google Drive list failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'GoogleDriveProvider',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List failed',
      };
    }
  }

  async deleteProfile(profileId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.ensureAuthenticated();

      const response = await fetch(`${this.API_URL}/files/${profileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (response.ok || response.status === 204) {
        return { success: true };
      }

      if (response.status === 404) {
        return { success: false, error: 'Profile not found' };
      }

      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || `Delete failed: ${response.status}`,
      };
    } catch (error) {
      logger.error('Google Drive delete failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'GoogleDriveProvider',
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

      const response = await fetch(`${this.API_URL}/about?fields=storageQuota`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Quota check failed: ${response.status}`,
        };
      }

      const result = await response.json();
      const quota = result.storageQuota;

      return {
        success: true,
        used: Number.parseInt(quota.usage || '0', 10),
        total: quota.limit ? Number.parseInt(quota.limit, 10) : undefined,
        available: quota.limit ? Number.parseInt(quota.limit, 10) - Number.parseInt(quota.usage || '0', 10) : undefined,
      };
    } catch (error) {
      logger.error('Google Drive quota check failed', {
        error: error instanceof Error ? error.message : String(error),
        source: 'GoogleDriveProvider',
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

  private async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthenticated()) {
      const success = await this.authenticate();
      if (!success) {
        throw new Error('Not authenticated');
      }
    }
  }

  private async ensureFolder(): Promise<void> {
    if (this.folderId) return;

    const folderName = 'React Perf Profiles';
    
    // Check if folder exists
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    const response = await fetch(`${this.API_URL}/files?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.files.length > 0) {
        this.folderId = result.files[0].id;
        return;
      }
    }

    // Create folder
    const createResponse = await fetch(`${this.API_URL}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createResponse.ok) {
      const folder = await createResponse.json();
      this.folderId = folder.id;
      // Update config
      this.config = { ...this.config, folderId: folder.id };
    }
  }

  private async findFileByName(name: string): Promise<string | undefined> {
    if (!this.folderId) return undefined;

    const query = `name='${name.replace(/'/g, "\\'")}' and '${this.folderId}' in parents and trashed=false`;
    const response = await fetch(`${this.API_URL}/files?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (response.ok) {
      const result = await response.json();
      return result.files[0]?.id;
    }

    return undefined;
  }

  private async getStoredToken(): Promise<{ accessToken: string; expiresAt: number } | null> {
    if (typeof chrome === 'undefined' || !chrome.storage) return null;
    
    const result = await chrome.storage.local.get('gdrive_token');
    return result.gdrive_token || null;
  }

  private async storeToken(token: { accessToken: string; expiresAt: number }): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    
    await chrome.storage.local.set({ gdrive_token: token });
  }

  private async clearStoredToken(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    
    await chrome.storage.local.remove('gdrive_token');
  }
}
