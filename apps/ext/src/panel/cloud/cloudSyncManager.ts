/**
 * CloudSyncManager – orchestrates profile upload / download / list / delete
 * across multiple cloud providers (Dropbox, Google Drive, S3).
 */

import type { CloudConfig, CloudFile } from './types';
import * as dropboxProvider from './providers/dropboxProvider';
import * as gdriveProvider from './providers/gdriveProvider';
import * as s3Provider from './providers/s3Provider';

// ---------------------------------------------------------------------------
// Provider dispatch
// ---------------------------------------------------------------------------

function assertProvider(
  config: CloudConfig,
  expected: 'dropbox' | 'gdrive' | 's3',
): void {
  if (config.provider !== expected) {
    throw new Error(
      `Expected provider "${expected}" but got "${config.provider}".`,
    );
  }
}

// ---------------------------------------------------------------------------
// CloudSyncManager
// ---------------------------------------------------------------------------

export class CloudSyncManager {
  // -----------------------------------------------------------------------
  // Upload
  // -----------------------------------------------------------------------

  async uploadProfile(
    name: string,
    data: unknown,
    config: CloudConfig,
  ): Promise<void> {
    switch (config.provider) {
      case 'dropbox':
        return dropboxProvider.upload(name, data, config);

      case 'gdrive':
        assertProvider(config, 'gdrive');
        return gdriveProvider.upload(name, data, config);

      case 's3':
        assertProvider(config, 's3');
        return s3Provider.upload(name, data, config);

      default:
        throw new Error(`Unsupported cloud provider: ${(config as CloudConfig).provider}`);
    }
  }

  // -----------------------------------------------------------------------
  // Download
  // -----------------------------------------------------------------------

  async downloadProfile(
    name: string,
    config: CloudConfig,
  ): Promise<unknown> {
    switch (config.provider) {
      case 'dropbox':
        return dropboxProvider.download(name, config);

      case 'gdrive':
        assertProvider(config, 'gdrive');
        return gdriveProvider.download(name, config);

      case 's3':
        assertProvider(config, 's3');
        return s3Provider.download(name, config);

      default:
        throw new Error(`Unsupported cloud provider: ${(config as CloudConfig).provider}`);
    }
  }

  // -----------------------------------------------------------------------
  // List
  // -----------------------------------------------------------------------

  async listProfiles(config: CloudConfig): Promise<CloudFile[]> {
    switch (config.provider) {
      case 'dropbox':
        return dropboxProvider.list(config);

      case 'gdrive':
        assertProvider(config, 'gdrive');
        return gdriveProvider.list(config);

      case 's3':
        assertProvider(config, 's3');
        return s3Provider.list(config);

      default:
        throw new Error(`Unsupported cloud provider: ${(config as CloudConfig).provider}`);
    }
  }

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  async deleteProfile(
    name: string,
    config: CloudConfig,
  ): Promise<void> {
    switch (config.provider) {
      case 'dropbox':
        return dropboxProvider.deleteFile(name, config);

      case 'gdrive':
        assertProvider(config, 'gdrive');
        return gdriveProvider.deleteFile(name, config);

      case 's3':
        assertProvider(config, 's3');
        return s3Provider.deleteFile(name, config);

      default:
        throw new Error(`Unsupported cloud provider: ${(config as CloudConfig).provider}`);
    }
  }
}
