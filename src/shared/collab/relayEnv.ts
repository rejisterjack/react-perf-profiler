/**
 * Build-time WebSocket URL for Team session signaling relay (optional).
 * @module shared/collab/relayEnv
 */

/**
 * Returns trimmed `VITE_COLLAB_RELAY_URL` when set at build time, else empty string.
 */
export function getCollabRelayWsUrl(): string {
  try {
    const raw = import.meta.env?.VITE_COLLAB_RELAY_URL;
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}
