/**
 * Cloud provider types for profile sync.
 */

/** Supported cloud storage providers. */
export type CloudProvider = 'dropbox' | 'gdrive' | 's3';

/** Configuration for connecting to a cloud provider. */
export interface CloudConfig {
  provider: CloudProvider;
  /** OAuth2 access token (Dropbox / Google Drive) or AWS access key (S3). */
  accessToken: string;
  /** S3-specific fields. */
  bucket?: string;
  region?: string;
  secretKey?: string;
  /** Optional base path / folder prefix for stored profiles. */
  basePath?: string;
}

/** Metadata for a file stored in the cloud. */
export interface CloudFile {
  name: string;
  modified: string;
  size: number;
  url: string;
}
