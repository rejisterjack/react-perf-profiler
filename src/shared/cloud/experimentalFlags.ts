/**
 * Feature flags for cloud providers.
 */

/**
 * Google Drive uses PKCE + refresh tokens in production builds.
 * Set `VITE_DISABLE_GOOGLE_DRIVE_SYNC=true` to hide the provider (e.g. fork CI or enterprise builds).
 */
export function isGoogleDriveCloudSyncEnabled(): boolean {
  try {
    if (import.meta.env?.VITE_DISABLE_GOOGLE_DRIVE_SYNC === 'true') {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}
