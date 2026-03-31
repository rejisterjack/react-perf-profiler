/**
 * S3 Cloud Provider
 * AWS S3 and S3-compatible storage (MinIO, Wasabi, etc.)
 * @module shared/cloud/providers/S3Provider
 */

import type {
  CloudSyncProvider,
  CloudProviderType,
  S3ProviderSettings,
  SyncResult,
  ListProfilesResult,
  CloudProfileInfo,
} from '../types';
import type { ExportedProfileV1 } from '@/shared/types/export';
import { generateAWSSigV4Headers } from '../utils/awsSignature';
import { logger } from '@/shared/logger';

/**
 * S3 Cloud Provider Implementation
 * Supports AWS S3 and S3-compatible APIs
 */
export class S3Provider implements CloudSyncProvider {
  readonly type: CloudProviderType = 's3';
  readonly name = 'Amazon S3';

  private config: S3ProviderSettings;
  private _isAuthenticated = false;
  private sessionToken?: string;

  constructor(config: S3ProviderSettings) {
    this.config = config;
  }

  isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  /**
   * Authenticate with S3
   * For S3, this validates the credentials by listing buckets
   */
  async authenticate(): Promise<boolean> {
    try {
      // If using presigned URLs, we don't need to validate here
      if (this.config.usePresignedUrls) {
        this._isAuthenticated = true;
        return true;
      }

      // Test credentials by making a list request
      const response = await this.makeS3Request('GET', '/');
      if (response.ok) {
        this._isAuthenticated = true;
        logger.info('S3 authentication successful', { source: 'S3Provider' });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('S3 authentication failed', { 
        error: error instanceof Error ? error.message : String(error),
        source: 'S3Provider' 
      });
      return false;
    }
  }

  async signOut(): Promise<void> {
    this._isAuthenticated = false;
    this.sessionToken = undefined;
    logger.info('S3 signed out', { source: 'S3Provider' });
  }

  /**
   * Upload a profile to S3
   * Supports multipart upload for large files
   */
  async uploadProfile(
    profile: ExportedProfileV1,
    filename: string,
    options?: { overwrite?: boolean; metadata?: Record<string, string> }
  ): Promise<SyncResult> {
    try {
      const key = this.getObjectKey(filename);
      const body = JSON.stringify(profile);
      const size = new Blob([body]).size;

      // Check if exists (unless overwrite is true)
      if (!options?.overwrite) {
        const exists = await this.objectExists(key);
        if (exists) {
          return {
            success: false,
            error: 'Profile already exists. Use overwrite option to replace.',
          };
        }
      }

      // For large files (>5MB), use multipart upload
      if (size > 5 * 1024 * 1024) {
        return this.multipartUpload(key, body, options?.metadata);
      }

      // Single-part upload
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-amz-meta-version': profile.version,
        'x-amz-meta-exportedat': profile.metadata.exportedAt,
      };

      if (options?.metadata) {
        for (const [k, v] of Object.entries(options.metadata)) {
          headers[`x-amz-meta-${k.toLowerCase()}`] = v;
        }
      }

      const response = await this.makeS3Request('PUT', `/${key}`, body, headers);

      if (response.ok) {
        const etag = response.headers.get('ETag')?.replace(/"/g, '');
        return {
          success: true,
          syncId: key,
          timestamp: new Date().toISOString(),
          fileInfo: {
            id: key,
            name: filename,
            size,
            etag,
          },
        };
      }

      return {
        success: false,
        error: `Upload failed: ${response.status} ${response.statusText}`,
      };
    } catch (error) {
      logger.error('S3 upload failed', { 
        error: error instanceof Error ? error.message : String(error),
        source: 'S3Provider' 
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Download a profile from S3
   */
  async downloadProfile(profileId: string): Promise<{
    success: boolean;
    data?: ExportedProfileV1;
    error?: string;
  }> {
    try {
      const response = await this.makeS3Request('GET', `/${profileId}`);

      if (response.ok) {
        const data = await response.json() as ExportedProfileV1;
        return { success: true, data };
      }

      if (response.status === 404) {
        return { success: false, error: 'Profile not found' };
      }

      return {
        success: false,
        error: `Download failed: ${response.status} ${response.statusText}`,
      };
    } catch (error) {
      logger.error('S3 download failed', { 
        error: error instanceof Error ? error.message : String(error),
        source: 'S3Provider' 
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  /**
   * List profiles in S3 bucket
   */
  async listProfiles(options?: {
    limit?: number;
    pageToken?: string;
    search?: string;
  }): Promise<ListProfilesResult> {
    try {
      const prefix = this.config.folder ? `${this.config.folder}/` : '';
      const maxKeys = options?.limit ?? 50;
      const marker = options?.pageToken;

      let url = `/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=${maxKeys}`;
      if (marker) {
        url += `&continuation-token=${encodeURIComponent(marker)}`;
      }

      const response = await this.makeS3Request('GET', url);

      if (!response.ok) {
        return {
          success: false,
          error: `List failed: ${response.status} ${response.statusText}`,
        };
      }

      const xml = await response.text();
      const profiles = this.parseListResponse(xml);

      // Filter by search if provided
      const filtered = options?.search
        ? profiles.filter(p => p.name.toLowerCase().includes(options.search!.toLowerCase()))
        : profiles;

      // Extract next page token
      const nextTokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
      const nextPageToken = nextTokenMatch?.[1];

      return {
        success: true,
        profiles: filtered,
        nextPageToken,
      };
    } catch (error) {
      logger.error('S3 list failed', { 
        error: error instanceof Error ? error.message : String(error),
        source: 'S3Provider' 
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
      const response = await this.makeS3Request('DELETE', `/${profileId}`);

      if (response.ok || response.status === 204) {
        return { success: true };
      }

      return {
        success: false,
        error: `Delete failed: ${response.status} ${response.statusText}`,
      };
    } catch (error) {
      logger.error('S3 delete failed', { 
        error: error instanceof Error ? error.message : String(error),
        source: 'S3Provider' 
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
      // S3 doesn't have a direct quota API, so we estimate from bucket size
      const prefix = this.config.folder ? `${this.config.folder}/` : '';
      const url = `/?list-type=2&prefix=${encodeURIComponent(prefix)}`;
      
      const response = await this.makeS3Request('GET', url);
      
      if (!response.ok) {
        return {
          success: false,
          error: `Quota check failed: ${response.status}`,
        };
      }

      const xml = await response.text();
      let totalSize = 0;
      const sizeMatches = xml.matchAll(/<Size>(\d+)<\/Size>/g);
      for (const match of sizeMatches) {
        totalSize += Number.parseInt(match[1] || '0', 10);
      }

      // S3 buckets are effectively unlimited, report usage only
      return {
        success: true,
        used: totalSize,
        total: undefined,
        available: undefined,
      };
    } catch (error) {
      logger.error('S3 quota check failed', { 
        error: error instanceof Error ? error.message : String(error),
        source: 'S3Provider' 
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

  private getObjectKey(filename: string): string {
    const folder = this.config.folder ? `${this.config.folder}/` : '';
    return `${folder}react-perf-profiles/${filename}`;
  }

  private async objectExists(key: string): Promise<boolean> {
    try {
      const response = await this.makeS3Request('HEAD', `/${key}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async multipartUpload(
    key: string,
    body: string,
    metadata?: Record<string, string>
  ): Promise<SyncResult> {
    // Initiate multipart upload
    const uploadId = await this.initiateMultipartUpload(key, metadata);
    if (!uploadId) {
      return { success: false, error: 'Failed to initiate multipart upload' };
    }

    try {
      // Upload parts (5MB chunks)
      const chunkSize = 5 * 1024 * 1024;
      const parts: { ETag: string; PartNumber: number }[] = [];
      
      for (let i = 0; i < body.length; i += chunkSize) {
        const chunk = body.slice(i, i + chunkSize);
        const partNumber = Math.floor(i / chunkSize) + 1;
        
        const etag = await this.uploadPart(key, uploadId, partNumber, chunk);
        if (!etag) {
          throw new Error(`Failed to upload part ${partNumber}`);
        }
        
        parts.push({ ETag: etag, PartNumber: partNumber });
      }

      // Complete multipart upload
      const completed = await this.completeMultipartUpload(key, uploadId, parts);
      if (!completed) {
        throw new Error('Failed to complete multipart upload');
      }

      return {
        success: true,
        syncId: key,
        timestamp: new Date().toISOString(),
        fileInfo: {
          id: key,
          name: key.split('/').pop() || key,
          size: body.length,
        },
      };
    } catch (error) {
      // Abort multipart upload on failure
      await this.abortMultipartUpload(key, uploadId);
      throw error;
    }
  }

  private async initiateMultipartUpload(
    key: string,
    metadata?: Record<string, string>
  ): Promise<string | null> {
    const headers: Record<string, string> = {};
    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        headers[`x-amz-meta-${k.toLowerCase()}`] = v;
      }
    }

    const response = await this.makeS3Request('POST', `/${key}?uploads`, undefined, headers);
    
    if (!response.ok) return null;
    
    const xml = await response.text();
    const match = xml.match(/<UploadId>([^<]+)<\/UploadId>/);
    return match?.[1] || null;
  }

  private async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: string
  ): Promise<string | null> {
    const response = await this.makeS3Request(
      'PUT',
      `/${key}?partNumber=${partNumber}&uploadId=${uploadId}`,
      body
    );
    
    if (!response.ok) return null;
    
    return response.headers.get('ETag')?.replace(/"/g, '') || null;
  }

  private async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { ETag: string; PartNumber: number }[]
  ): Promise<boolean> {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUpload>
${parts.map(p => `  <Part><PartNumber>${p.PartNumber}</PartNumber><ETag>"${p.ETag}"</ETag></Part>`).join('\n')}
</CompleteMultipartUpload>`;

    const response = await this.makeS3Request(
      'POST',
      `/${key}?uploadId=${uploadId}`,
      body,
      { 'Content-Type': 'application/xml' }
    );
    
    return response.ok;
  }

  private async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.makeS3Request('DELETE', `/${key}?uploadId=${uploadId}`);
  }

  private async makeS3Request(
    method: string,
    path: string,
    body?: string,
    extraHeaders?: Record<string, string>
  ): Promise<Response> {
    const url = `${this.config.endpoint}/${this.config.bucket}${path}`;
    
    const baseHeaders: Record<string, string> = {
      'Host': new URL(this.config.endpoint).host,
      ...extraHeaders,
    };

    // Add SigV4 authentication if credentials provided
    if (this.config.accessKeyId) {
      const secretKey = this.getSecretKey();
      if (secretKey) {
        const signedHeaders = await generateAWSSigV4Headers(
          method,
          url,
          baseHeaders,
          body,
          {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: secretKey,
          },
          this.config.region,
          's3'
        );
        Object.assign(baseHeaders, signedHeaders);
      }
    }

    return fetch(url, {
      method,
      headers: baseHeaders,
      body,
    });
  }

  private getSecretKey(): string | undefined {
    // In real implementation, get from secure storage
    // For now, check if secret key was stored alongside access key
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // Async retrieval would happen here
      // Returning undefined for now - user must use presigned URLs
      return undefined;
    }
    return undefined;
  }

  private parseListResponse(xml: string): CloudProfileInfo[] {
    const profiles: CloudProfileInfo[] = [];
    const contentsMatches = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g);
    
    for (const match of contentsMatches) {
      const content = match[1] || '';
      const key = content.match(/<Key>([^<]+)<\/Key>/)?.[1];
      const size = Number.parseInt(content.match(/<Size>(\d+)<\/Size>/)?.[1] || '0', 10);
      const modified = content.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1];
      const etag = content.match(/<ETag>([^<]+)<\/ETag>/)?.[1];
      
      if (key && key.endsWith('.json')) {
        profiles.push({
          id: key,
          name: key.split('/').pop() || key,
          size,
          modifiedAt: modified || new Date().toISOString(),
          createdAt: modified || new Date().toISOString(),
          version: '1',
        });
      }
    }
    
    return profiles;
  }
}
