/**
 * Feature flags for cloud providers that are not yet production-complete.
 */

/**
 * Google Drive OAuth in this repo does not yet implement refresh-token exchange
 * (implicit flow only). Enable explicitly for development or experiments.
 */
export function isGoogleDriveCloudSyncEnabled(): boolean {
  try {
    return (
      import.meta.env?.VITE_ENABLE_EXPERIMENTAL_GOOGLE_DRIVE === 'true' ||
      import.meta.env?.DEV === true
    );
  } catch {
    return false;
  }
}
